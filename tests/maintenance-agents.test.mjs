import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runMaintenanceAgents} from '../maintenance-agents.mjs';
import {newLedger, upsertIssues} from '../maintenance-ledger.mjs';

test('agents recheck a pinned JSON blob and prepare a publisher-compatible proposal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'niko-agents-'));
  try {
    const content = '{"title":"Studio Niko",}';
    const blob = createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0' + content).digest('hex');
    const commit = 'a'.repeat(40);
    const tree = 'b'.repeat(40);
    const ledger = upsertIssues(newLedger(), [{
      repo: 'Nikoju1977/demo', path: 'data.json', commit, blob,
      code: 'JSON_INVALID', confirmation: 'parser_rejected'
    }]);
    const responses = [
      {private: false, default_branch: 'main'},
      {sha: commit, commit: {tree: {sha: tree}}},
      {tree: [{type: 'blob', mode: '100644', path: 'data.json', sha: blob, size: Buffer.byteLength(content)}]},
      {sha: blob, encoding: 'base64', content: Buffer.from(content).toString('base64')}
    ];
    let calls = 0;
    const fetchImpl = async () => Response.json(responses[calls++ % responses.length]);
    const run = await runMaintenanceAgents(ledger, directory, {fetchImpl});
    const [result] = run.results;
    assert.equal(result.status, 'review_required');
    assert.equal(result.syntax.after, 'valid');
    const proposal = JSON.parse(await readFile(result.output, 'utf8'));
    assert.equal(proposal.commit, commit);
    assert.equal(proposal.changes[0].expectedBlob, blob);
    assert.deepEqual(JSON.parse(proposal.changes[0].content), {title: 'Studio Niko'});
    assert.equal(run.published, false);
    assert.equal((await runMaintenanceAgents(ledger, directory, {fetchImpl})).results[0].status, 'output_exists');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
