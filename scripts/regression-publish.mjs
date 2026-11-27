import {readFile, stat} from 'node:fs/promises';
import {validateAndPublish} from '../regression-publication.mjs';
import {createGitHubClient} from '../code-mode-x-publish.mjs';

try {
  const [path, flag, digest, ...extra] = process.argv.slice(2);
  if (!path || extra.length || (flag && (flag !== '--approve' || !digest))) {
    throw Error('Usage: node scripts/regression-publish.mjs spec.json [--approve SHA256]');
  }
  if ((await stat(path)).size > 1000000) throw Error('Spec too large');
  const spec = JSON.parse(await readFile(path, 'utf8'));
  const request = digest ? createGitHubClient({token: process.env.CMX_GITHUB_TOKEN}) : undefined;
  const result = await validateAndPublish(spec, {approval: digest, request});
  console.log(JSON.stringify(result, null, 2));
  if (!['draft_created', 'approval_required'].includes(result.status)) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
