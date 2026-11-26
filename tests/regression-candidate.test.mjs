import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateRegressionCandidate} from '../regression-candidate.mjs';
import {prepareSandbox} from '../sandbox-runner.mjs';

test('the three agents generate a scoped candidate without receiving the local fixture', async () => {
  const content = 'export const count = 1;';
  const sha = createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0' + content).digest('hex');
  const input = {
    mission: {repo: 'Nikoju1977/demo', branch: 'main', commit: 'a'.repeat(40), provider: 'mistral',
      prompt: 'Le compteur de départ doit valoir deux.', files: [{path: 'count.mjs', sha, content}]},
    harness: 'throw Error("local fixture");',
    language: 'javascript', image: 'sha256:' + 'b'.repeat(64)
  };
  const plan = await generateRegressionCandidate(input);
  const roles = [];
  const result = await generateRegressionCandidate(input, {approval: plan.approvalDigest, request: async request => {
    roles.push(request.role);
    assert.equal(request.provider, 'mistral');
    assert.ok(!JSON.stringify(request).includes('local fixture'));
    const responses = {
      architect: {name: 'plan.md', content: 'Modifier la constante.'},
      developer: {name: 'file-1.js', content: 'export const count = 2;'},
      critic: {name: 'review.json', content: '{"accept":true,"issues":[]}'}
    };
    return {files: [responses[request.role]]};
  }});
  assert.deepEqual(roles, ['architect', 'developer', 'critic']);
  assert.equal(result.bundle.proposal.changes[0].expectedBlob, sha);
  assert.equal(result.bundle.harness, input.harness);
  assert.equal(prepareSandbox(result.bundle).approvalDigest, result.validationDigest);
  assert.equal(result.testsExecuted, false);
});
