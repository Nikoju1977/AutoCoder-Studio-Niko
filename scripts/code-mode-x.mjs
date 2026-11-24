// Read-only local audit for an AutoCoder JSON export.
import { readFile, stat } from 'node:fs/promises';
import { runCodeMode } from '../code-mode-x.mjs';
try {
  const path=process.argv[2];
  if(!path)throw Error('Usage: node scripts/code-mode-x.mjs projet.json');
  if((await stat(path)).size>2_000_000)throw Error('Export trop volumineux');
  const input=JSON.parse(await readFile(path,'utf8'));
  const files=Array.isArray(input)?input:input.files;
  if(!Array.isArray(files))throw Error('Export attendu : tableau files avec name et content');
  const result=await runCodeMode({prompt:'Audit local du projet',files});
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.status==='blocked'||!result.audit?.passed?1:0;
}catch(e){ console.error(e.message);process.exitCode=2; }
