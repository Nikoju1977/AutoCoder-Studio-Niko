import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {listPublicRepo, readPublicAuditBlob} from './code-mode-x-github.mjs';
import {nextIssues} from './maintenance-ledger.mjs';
import {prepareRepair} from './repair-engine.mjs';

export async function runMaintenanceAgents(ledger, outputDirectory, {fetchImpl} = {}) {
  const queued = nextIssues(ledger);
  const deferred = queued.filter(issue => issue.code !== 'JSON_INVALID' ||
    issue.confirmation !== 'parser_rejected' || !issue.blob);
  const eligible = ledger.issues.filter(issue => issue.code === 'JSON_INVALID' &&
    issue.confirmation === 'parser_rejected' && issue.blob);
  const batch = nextIssues({...ledger, issues: eligible});
  const options = {fetchImpl, inventoryLimit: 10000, maxFileBytes: 120000};
  const results = deferred.map(({id, repo, path}) => ({id, repo, path, status: 'manual_review'}));
  for (const issue of batch) {
    const {id, repo, path, commit, blob} = issue;
    const result = {id, repo, path, commit};
    try {
      const snapshot = await listPublicRepo(repo, options);
      if (snapshot.commit !== commit) {
        results.push({...result, status: 'stale_commit'});
        continue;
      }
      if (snapshot.partial || !snapshot.files.some(file => file.path === path && file.sha === blob)) {
        results.push({...result, status: 'source_unconfirmed'});
        continue;
      }
      const file = await readPublicAuditBlob(snapshot, path, options);
      const repair = prepareRepair({...snapshot, files: [file]});
      if (!repair.proposal) {
        results.push({...result, status: repair.reports[0].status});
        continue;
      }
      const output = join(outputDirectory, id + '.json');
      await writeFile(output, JSON.stringify(repair.proposal, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      results.push({...result, status: repair.status, output, approvalDigest: repair.approvalDigest,
        syntax: repair.reports[0].proof});
    } catch (error) {
      results.push({...result, status: error.code === 'EEXIST' ? 'output_exists' : 'execution_failed'});
    }
  }
  return {ledgerRevision: ledger.revision, results, functionalTests: false, published: false};
}
