import {stat} from 'node:fs/promises';
import {runMaintenanceAgents} from '../maintenance-agents.mjs';
import {readLedger} from '../maintenance-store.mjs';

try {
  const [ledger, directory, ...rest] = process.argv.slice(2);
  if (!ledger || !directory || rest.length || !(await stat(directory)).isDirectory()) {
    throw Error('Invalid arguments');
  }
  const token = process.env.CMX_GITHUB_READ_TOKEN;
  const fetchImpl = (url, options) => {
    if (new URL(url).origin !== 'https://api.github.com') throw Error('Invalid origin');
    return fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {...options.headers, ...(token ? {Authorization: 'Bearer ' + token} : {})}
    });
  };
  const report = await runMaintenanceAgents(readLedger(ledger), directory, {fetchImpl});
  console.log(JSON.stringify(report, null, 2));
  if (report.results.some(result => result.status === 'execution_failed')) process.exitCode = 1;
} catch {
  console.error('Usage: node scripts/maintenance-agents.mjs LEDGER.json PRIVATE_OUTPUT_DIR');
  process.exitCode = 1;
}
