/** Indique uniquement si le serveur IA possède les paramètres requis, sans secret. */
import { availableProviders } from './providers.mjs';
const MIN_TOKEN_LENGTH = 32;

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const configured = Boolean(
    availableProviders().length &&
    (process.env.AUTOCODER_ACCESS_TOKEN || '').length >= MIN_TOKEN_LENGTH,
  );

  return res.status(200).json({ configured, mode: configured ? 'server-ready' : 'local-only' });
}
