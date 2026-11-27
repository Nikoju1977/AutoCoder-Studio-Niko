import {readFile, stat, writeFile} from 'node:fs/promises';
import {generateRegressionCandidate} from '../regression-candidate.mjs';
import {listPublicRepo} from '../code-mode-x-github.mjs';
import {createHttpAgentTransport} from '../code-mode-x-team.mjs';

try {
  const [input, output, flag, approval, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length || (flag && (flag !== '--approve' || !approval))) {
    throw Error('Usage: node scripts/regression-candidate.mjs mission.json spec.json [--approve SHA256]');
  }
  if ((await stat(input)).size > 256000) throw Error('Mission too large');
  const inputData = JSON.parse(await readFile(input, 'utf8'));
  if (approval) {
    const plan = await generateRegressionCandidate(inputData);
    if (approval !== plan.approvalDigest) throw Error('AI transfer approval mismatch');
    const {repo, branch, commit, files} = plan.manifest;
    const snapshot = await listPublicRepo(repo, {branch, inventoryLimit: 10000});
    if (snapshot.partial || snapshot.commit !== commit ||
        files.some(file => !snapshot.files.some(entry => entry.path === file.path && entry.sha === file.sha))) {
      throw Error('Public GitHub source changed or could not be verified');
    }
  }
  const request = approval ? createHttpAgentTransport({token: process.env.AUTOCODER_ACCESS_TOKEN}) : undefined;
  const {bundle, ...result} = await generateRegressionCandidate(inputData, {approval, request});
  if (bundle) await writeFile(output, JSON.stringify(bundle, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({...result, output: bundle ? output : null}, null, 2));
  if (!bundle && result.status !== 'approval_required') process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
