import test from 'node:test';
import assert from 'node:assert/strict';
import generateHandler from '../api/generate.mjs';
import statusHandler from '../api/status.mjs';

const TOKEN = 'test-token-with-at-least-thirty-two-characters';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function callGenerate({ method = 'POST', token = TOKEN, body = { prompt: 'Créer un exemple', files: [] }, headers = {} } = {}) {
  const res = response();
  await generateHandler({ method, headers: { authorization: token ? `Bearer ${token}` : '', ...headers }, body }, res);
  return res;
}

async function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const validModelResponse = (files = [{ name: 'main.py', content: 'print(42)' }]) => ({
  output: [{ content: [{ type: 'output_text', text: JSON.stringify({ plan: ['Créer'], notes: 'À vérifier', files }) }] }],
});

test('l’API refuse les méthodes non autorisées et ne met pas en cache les réponses', async () => {
  const res = await callGenerate({ method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
});

test('l’API ne s’active pas avec un jeton trop court et le statut suit la même règle', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', AUTOCODER_ACCESS_TOKEN: 'short-token' }, async () => {
    const generated = await callGenerate();
    assert.equal(generated.statusCode, 503);
    const status = response();
    statusHandler({ method: 'GET' }, status);
    assert.equal(status.body.configured, false);
    assert.equal(JSON.stringify(status.body).includes('test-key'), false);
  });
});

test('l’API exige le jeton exact et un corps JSON valide', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', AUTOCODER_ACCESS_TOKEN: TOKEN }, async () => {
    assert.equal((await callGenerate({ token: 'wrong-token' })).statusCode, 401);
    const invalidJson = await callGenerate({ body: '{invalid json' });
    assert.equal(invalidJson.statusCode, 400);
    assert.equal(invalidJson.body.error, 'JSON invalide.');
  });
});

test('l’API valide les limites du prompt, des fichiers et de la taille de requête', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', AUTOCODER_ACCESS_TOKEN: TOKEN }, async () => {
    assert.equal((await callGenerate({ body: { prompt: 'ok', files: [] } })).statusCode, 400);
    assert.equal((await callGenerate({ body: { prompt: 'Créer', files: [{ name: '../secret.py', content: 'x' }] } })).statusCode, 400);
    assert.equal((await callGenerate({ headers: { 'content-length': '80001' } })).statusCode, 413);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => validModelResponse() });
    try {
      const validJson = await callGenerate({ body: JSON.stringify({ prompt: 'Créer', files: [] }), headers: {} });
      assert.equal(validJson.statusCode, 200);
      assert.equal(validJson.body.files[0].name, 'main.py');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('l’API valide la réponse fournisseur et ne révèle pas la clé', async () => {
  await withEnv({ OPENAI_API_KEY: 'private-test-key', AUTOCODER_ACCESS_TOKEN: TOKEN }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer private-test-key');
      assert.equal(options.signal instanceof AbortSignal, true);
      return { ok: true, json: async () => validModelResponse() };
    };
    try {
      const res = await callGenerate();
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.files[0].name, 'main.py');
      assert.equal(JSON.stringify(res.body).includes('private-test-key'), false);
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('l’API refuse les fichiers invalides et gère les erreurs fournisseur sans fuite', async () => {
  await withEnv({ OPENAI_API_KEY: 'private-test-key', AUTOCODER_ACCESS_TOKEN: TOKEN }, async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({ ok: true, json: async () => validModelResponse([{ name: 'bad/path.js', content: 'x' }]) });
      assert.equal((await callGenerate()).statusCode, 502);
      globalThis.fetch = async () => ({ ok: false, status: 429 });
      const rejected = await callGenerate();
      assert.equal(rejected.statusCode, 502);
      assert.equal(JSON.stringify(rejected.body).includes('private-test-key'), false);
      globalThis.fetch = async () => { throw new Error('private-test-key should not leak'); };
      const unavailable = await callGenerate();
      assert.equal(unavailable.statusCode, 502);
      assert.equal(unavailable.body.error, 'Service IA momentanément indisponible.');
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('le statut refuse les méthodes non GET et ne divulgue aucune variable secrète', () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousToken = process.env.AUTOCODER_ACCESS_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.AUTOCODER_ACCESS_TOKEN;
  try {
    const res = response();
    statusHandler({ method: 'POST' }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET');
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousToken === undefined) delete process.env.AUTOCODER_ACCESS_TOKEN;
    else process.env.AUTOCODER_ACCESS_TOKEN = previousToken;
  }
});
