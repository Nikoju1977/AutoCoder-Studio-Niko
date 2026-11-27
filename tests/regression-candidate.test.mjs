import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateRegressionCandidate} from '../regression-candidate.mjs';
import {prepareSandbox} from '../sandbox-runner.mjs';

for (const innovation of [false, true]) {
test('scoped candidate with innovation ' + innovation + ' keeps the local fixture private', async () => {
  const content = 'export const count = 1;';
  const sha = createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0' + content).digest('hex');
  const input = {
    mission: {repo: 'Nikoju1977/demo', branch: 'main', commit: 'a'.repeat(40), provider: 'mistral', innovation,
      prompt: 'Le compteur de départ doit valoir deux.', files: [{path: 'count.mjs', sha, content}]},
    harness: 'throw Error("local fixture");',
    language: 'javascript', image: 'sha256:' + 'b'.repeat(64)
  };
  const plan = await generateRegressionCandidate(input);
  assert.equal(plan.manifest.maxProviderCalls, innovation ? 4 : 3);
  const roles = [];
  const result = await generateRegressionCandidate(input, {approval: plan.approvalDigest, request: async request => {
    roles.push(request.role);
    assert.equal(request.provider, 'mistral');
    assert.ok(!JSON.stringify(request).includes('local fixture'));
    const responses = {
      innovator: {name: 'ideas.json', content: '{"ideas":[{"title":"Corriger le compteur","benefit":"Valeur initiale conforme","effort":"low","test":"Vérifier count au démarrage"}]}' },
      architect: {name: 'plan.md', content: 'Modifier la constante.'},
      developer: {name: 'file-1.js', content: 'export const count = 2;'},
      critic: {name: 'review.json', content: '{"accept":true,"issues":[]}'}
    };
    return {files: [responses[request.role]]};
  }});
  assert.deepEqual(roles, [...(innovation ? ['innovator'] : []), 'architect', 'developer', 'critic']);
  if (innovation) assert.equal(result.ideas[0].test, 'Vérifier count au démarrage');
  assert.equal(result.bundle.proposal.changes[0].expectedBlob, sha);
  assert.equal(result.bundle.harness, input.harness);
  assert.equal(prepareSandbox(result.bundle).approvalDigest, result.validationDigest);
  assert.equal(result.testsExecuted, false);
});
}
