// Reviewed functional fixtures on actual public commits. No target scripts executed outside Docker.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {checkBlobIntegrity} from '../deep-audit.mjs';
import {prepareSandbox,runSandbox} from '../sandbox-runner.mjs';
const catalog=JSON.parse(readFileSync(new URL('../tests/real-regression-fixtures.json',import.meta.url),'utf8'));
const [repository, ...extra] = process.argv.slice(2);
const fixtures = repository ? catalog.filter(f => f.repo === repository) : catalog;
if (extra.length || !fixtures.length) throw Error('Unknown regression fixture');
const image=process.env.CMX_TEST_IMAGE;
if(!/^sha256:[a-f0-9]{64}$/.test(image??''))throw Error('Missing image');
const rows=[];
const evidence=['# Code Mode Pro · Preuves de régression'];
for(const f of fixtures){
 const root=mkdtempSync(join(tmpdir(),'cmx-regression-'));
 const row={repo:'Nikoju1977/'+f.repo,scenario:f.test,originalCommit:f.before,correctedCommit:f.after,path:f.path,status:'not_tested',providerCalls:0};
 const git=(args,opts={})=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore'],env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'},...opts});
 try{
  if(!/^[A-Za-z0-9_.-]+$/.test(f.repo)||![f.before,f.after].every(x=>/^[a-f0-9]{40}$/.test(x)))throw Error('Invalid fixture');
  git(['init','--quiet']);
  for(const sha of [f.before,f.after])git(['-c','protocol.file.allow=never','fetch','--quiet','--depth=1','--no-tags','https://github.com/'+row.repo+'.git',sha]);
  const read=commit=>{const sha=git(['rev-parse',commit+':'+f.path]).trim(),b=git(['cat-file','blob',sha],{encoding:'buffer'});if(!checkBlobIntegrity(b,sha))throw Error('Integrity');return {path:f.path,sha,content:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b)};};
  const a=read(f.before),b=read(f.after);row.originalBlob=a.sha;row.correctedBlob=b.sha;
  const spec={proposal:{format:'code-mode-x-github-proposal-v1',status:'review_required',repo:row.repo,branch:'main',commit:f.before,changes:[{path:f.path,expectedBlob:a.sha,content:b.content}]},originals:[a],harness:f.harness,image,language:'javascript'};
  const plan=prepareSandbox(spec);row.execution=runSandbox({spec,approval:plan.approvalDigest});row.status=row.execution.status==='fixture_improved'?'passed':'not_validated';
 }catch(e){row.status='blocked';row.errorType=e.name;}
 finally{rmSync(root,{recursive:true,force:true});}
 rows.push(row);console.log('REAL_REGRESSION '+JSON.stringify(row));writeFileSync('real-regression-report.json',JSON.stringify({rows},null,2));
}
for (const row of rows) {
 const link = commit => 'https://github.com/' + row.repo + '/commit/' + commit;
 evidence.push('', '## ' + row.scenario, '',
  '- Avant : [' + row.originalCommit + '](' + link(row.originalCommit) + ') · ' + (row.execution?.before.status ?? 'non exécuté'),
  '- Après : [' + row.correctedCommit + '](' + link(row.correctedCommit) + ') · ' + (row.execution?.after.status ?? 'non exécuté'),
  '- Résultat du scénario : ' + row.status);
}
writeFileSync('real-regression-evidence.md', evidence.join('\n') + '\n');
if(rows.some(r=>r.status!=='passed'))process.exitCode=1;
