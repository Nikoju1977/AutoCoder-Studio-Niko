/** Optional AI generation endpoint for Vercel (Node.js runtime). */
import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_REQUEST_BYTES = 80_000;
const MAX_PROMPT_LENGTH = 4_000;
const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_FILE_LENGTH = 12_000;
const MAX_GENERATED_FILES = 30;
const MAX_GENERATED_FILE_LENGTH = 120_000;
const MAX_GENERATED_TOTAL = 300_000;
const MIN_TOKEN_LENGTH = 32;
const UPSTREAM_TIMEOUT_MS = 58_000;
const FILENAME = /^(?!\.)(?!.*\.\.)([a-zA-Z0-9][a-zA-Z0-9_.-]{0,63})\.(py|html|css|js|md|json)$/;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plan: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  required: ['plan', 'notes', 'files'],
};

const asJson = (res, status, value) => res.status(status).json(value);
const hash = value => createHash('sha256').update(String(value)).digest();

function safeToken(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  return timingSafeEqual(hash(input), hash(expected));
}

function parseRequestBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body ?? null;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.prompt !== 'string' || body.prompt.trim().length < 3 ||
      body.prompt.length > MAX_PROMPT_LENGTH || !Array.isArray(body.files) ||
      body.files.length > MAX_CONTEXT_FILES) {
    return { error: 'Demande invalide.' };
  }

  const context = [];
  for (const file of body.files) {
    if (!file || typeof file !== 'object' || typeof file.name !== 'string' ||
        typeof file.content !== 'string' || !FILENAME.test(file.name) ||
        file.content.length > MAX_CONTEXT_FILE_LENGTH) {
      return { error: 'Contexte fichier invalide.' };
    }
    context.push({ name: file.name, content: file.content });
  }
  return { context };
}

function validateResponse(payload) {
  if (!payload || !Array.isArray(payload.files) || payload.files.length === 0 ||
      payload.files.length > MAX_GENERATED_FILES) return null;

  let total = 0;
  const names = new Set();
  for (const file of payload.files) {
    if (!file || typeof file.name !== 'string' || !FILENAME.test(file.name) ||
        typeof file.content !== 'string' || file.content.length > MAX_GENERATED_FILE_LENGTH ||
        names.has(file.name)) return null;
    names.add(file.name);
    total += file.content.length;
    if (total > MAX_GENERATED_TOTAL) return null;
  }

  return {
    plan: Array.isArray(payload.plan) ? payload.plan.filter(item => typeof item === 'string').slice(0, 6) : [],
    notes: typeof payload.notes === 'string' ? payload.notes.slice(0, 4_000) : '',
    files: payload.files,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return asJson(res, 405, { error: 'Méthode non autorisée.' });
  }

  const expected = process.env.AUTOCODER_ACCESS_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!expected || expected.length < MIN_TOKEN_LENGTH || !apiKey || !apiKey.trim()) {
    return asJson(res, 503, { error: 'Le serveur IA n’est pas configuré.' });
  }

  const authorization = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  if (!authorization.startsWith('Bearer ') || !safeToken(authorization.slice(7), expected)) {
    return asJson(res, 401, { error: 'Jeton d’accès invalide.' });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const contentLength = Number(req.headers?.['content-length']);
  if ((Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) ||
      Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
    return asJson(res, 413, { error: 'Demande trop volumineuse.' });
  }

  const parsedBody = parseRequestBody(req.body);
  if (parsedBody === null) {
    return asJson(res, 400, { error: 'JSON invalide.' });
  }

  const validation = validateRequest(parsedBody);
  if (validation.error) {
    return asJson(res, 400, { error: validation.error });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        store: false,
        max_output_tokens: 12_000,
        instructions: 'Tu es un assistant de développement logiciel exigeant et francophone. Génère des fichiers exécutables et cohérents, sans prétendre avoir exécuté les tests. Retourne un plan concis, des notes utiles et le contenu complet de chaque fichier demandé. N’inclus aucun secret.',
        input: JSON.stringify({ demande: parsedBody.prompt, projetExistant: validation.context }),
        text: { format: { type: 'json_schema', name: 'autocoder_project', strict: true, schema } },
      }),
    });

    if (!upstream.ok) {
      return asJson(res, 502, { error: `Le service de génération IA a refusé la demande (${upstream.status}).` });
    }

    const response = await upstream.json();
    const plain = (Array.isArray(response?.output) ? response.output : [])
      .flatMap(item => Array.isArray(item?.content) ? item.content : [])
      .filter(item => item?.type === 'output_text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('');

    if (!plain) {
      return asJson(res, 502, { error: 'Le modèle n’a pas renvoyé de code exploitable.' });
    }

    let payload;
    try {
      payload = JSON.parse(plain);
    } catch {
      return asJson(res, 502, { error: 'La réponse du modèle n’est pas un JSON valide.' });
    }

    const result = validateResponse(payload);
    if (!result) {
      return asJson(res, 502, { error: 'Le modèle a retourné un projet invalide.' });
    }

    return asJson(res, 200, result);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return asJson(res, 504, { error: 'Le fournisseur IA a dépassé la durée autorisée.' });
    }
    return asJson(res, 502, { error: 'Service IA momentanément indisponible.' });
  } finally {
    clearTimeout(timeout);
  }
}
