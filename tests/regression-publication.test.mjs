import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateAndPublish} from '../regression-publication.mjs';

const content = 'const value = 1;';
const blob = createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0' + content).digest('hex');
const commit = 'a'.repeat(40);
const repo = 'Nikoju1977/demo';
const spec = {
  image: 'sha256:' + 'c'.repeat(64), language: 'javascript', harness: 'if (false) throw Error();',
  originals: [{path: 'app.js', content}],
  proposal: {format: 'code-mode-x-github-proposal-v1', status: 'review_required', repo,
    branch: 'main', commit, changes: [{path: 'app.js', expectedBlob: blob, content: 'const value = 2;'}]}
};

test('publication requires an actual before-fail and after-pass comparison', {skip: process.platform !== 'linux'}, async () => {
  const {approvalDigest: approval} = await validateAndPublish(spec);
  const request = async () => assert.fail('GitHub must not be contacted');
  const blocked = await validateAndPublish(spec, {approval, request, spawn: () => ({status: 0})});
  assert.equal(blocked.status, 'publication_blocked');
  assert.equal(blocked.evidence.status, 'fixture_both_passed');

  let run = 0;
  const published = await validateAndPublish(spec, {
    approval,
    spawn: (_, args) => ({status: args.includes('run') && ++run === 1 ? 1 : 0}),
    request: async (method, path, body) => {
      if (path.endsWith('/git/ref/heads/main')) return {object: {sha: commit}};
      if (path.endsWith('/git/commits/' + commit)) return {tree: {sha: commit}};
      if (path.endsWith('?recursive=1')) return {tree: [{path: 'app.js', type: 'blob', mode: '100644', sha: blob}]};
      if (method === 'GET') return {private: false, full_name: repo};
      if (path.endsWith('/pulls')) {
        assert.equal(body.draft, true);
        assert.match(body.body, /échec avant, réussite après/);
        return {number: 1, html_url: 'https://github.com/' + repo + '/pull/1'};
      }
      return {sha: commit};
    }
  });
  assert.equal(published.status, 'draft_created');
  assert.equal(published.testsExecuted, true);
});
