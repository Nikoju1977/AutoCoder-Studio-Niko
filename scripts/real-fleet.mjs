// Real fleet test: git objects only, no checkout or execution of arbitrary repository code.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,chmodSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkBlobIntegrity,inspectFile} from '../deep-audit.mjs';
import {audit} from '../code-mode-x.mjs';
import {createNativeBus} from '../code-mode-x-tools.mjs';
import {createClient,createGateway} from '../native-protocol.mjs';
import {executeWorkflow,defaultWorkflow} from '../classical-engine.mjs';
const inventory=JSON.parse(readFileSync(new URL('../tests/public-fleet.json',import.meta.url),'utf8'));
const shard=Number(process.env.FLEET_SHARD??0),count=6;
if(!Number.isInteger(shard)||shard<0||shard>=count)throw Error('Invalid shard');
const assigned=inventory.repositories.filter((_,i)=>i%count===shard);
const image=process.env.CMX_TEST_IMAGE;
if(!/^sha256:[a-f0-9]{64}$/.test(image??''))throw Error('Immutable local image required');
const rows=[],output='real-fleet-'+shard+'.json';
const supported=new Set(['js','mjs','cjs','py','json','html','css','md','ts','tsx','jsx','yaml','yml','toml','sql','sh']);
const native=new Set(['js','mjs','cjs','py','json','html','css','md']);
const ext=p=>p.split('.').pop().toLowerCase();
const safe=p=>p.length<=300&&!/[\\\x00-\x1f\x7f]/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..')&&!/(^|\/)(?:\.[^/]+|node_modules|vendor|dist|build|coverage|credentials[^/]*|secrets?[^/]*)(\/|$)/i.test(p);
const harness=`import fs from 'node:fs';import {createHash} from 'node:crypto';
const list=JSON.parse(fs.readFileSync('/work/manifest.json','utf8'));
let checked=0;
for(let i=0;i<list.length;i+=3){
 for(const f of list.slice(i,i+3)){
  const b=fs.readFileSync('/work/'+f.alias);
  if(createHash('sha1').update('blob '+b.length+'\\0').update(b).digest('hex')!==f.sha)throw Error('Blob mismatch');
  new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);
  checked++;
 }
}
if(checked!==list.length)throw Error('Incomplete fixture');
`;
function checkpoint(){writeFileSync(output+'.tmp',JSON.stringify({shard,inventoryDate:inventory.date,assigned:assigned.length,rows},null,2));renameSync(output+'.tmp',output);}
function git(root,args,opts={}){
 return execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','ignore'],env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'},...opts});
}
function container(root,manifest){
 const name='cmx-fleet-'+randomUUID();
 const run=args=>spawnSync('docker',['--host','unix:///var/run/docker.sock',...args],{timeout:60000,stdio:'ignore',env:{PATH:process.env.PATH,HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});
 writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest),{mode:0o644});
 writeFileSync(join(root,'check.mjs'),harness,{mode:0o644});
 try{
  const r=run(['run','--rm','--name',name,'--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--memory=256m','--memory-swap=256m','--cpus=1','--pids-limit=64','--mount','type=bind,src='+root+',dst=/work,readonly','--entrypoint','node',image,'/work/check.mjs']);
  return {status:r.error||r.status===null||[125,126,127].includes(r.status)?'inconclusive':r.status===0?'passed':'failed',files:manifest.length,scope:'isolated_integrity_check_only'};
 }finally{run(['rm','-f',name]);}
}
async function examine(item){
 const row={repo:'Nikoju1977/'+item.name,commit:null,status:'not_tested',eligible:0,audited:0,failed:0,oversized:0,excludedByBudget:0,batches:0,sdkPassed:0,sdkBlocked:0,syntax:{},findings:{},files:[],sandbox:null,functionalTests:false,providerCalls:0};
 if(!/^[A-Za-z0-9_.-]{1,100}$/.test(item.name)||!/^[A-Za-z0-9_.\/-]{1,150}$/.test(item.branch)||item.branch.includes('..'))throw Error('Invalid inventory');
 const root=mkdtempSync(join(tmpdir(),'cmx-git-')),stage=mkdtempSync(join(tmpdir(),'cmx-fleet-'));
 chmodSync(stage,0o755);
 try{
  const url='https://github.com/'+row.repo+'.git';
  const refs=git(root,['ls-remote','--heads',url]);
  if(!refs.trim()){row.status='empty_repository';return row;}
  git(root,['init','--quiet']);
  git(root,['-c','protocol.file.allow=never','fetch','--quiet','--depth=1','--no-tags',url,'refs/heads/'+item.branch]);
  row.commit=git(root,['rev-parse','FETCH_HEAD']).trim();
  const entries=git(root,['ls-tree','-r','-l','-z',row.commit]).split('\0').filter(Boolean).map(s=>{const i=s.indexOf('\t');const [mode,type,sha,size]=s.slice(0,i).trim().split(/\s+/);return {mode,type,sha,size:Number(size),path:s.slice(i+1)};});
  const known=new Set(entries.filter(f=>f.type==='blob').map(f=>f.path));
  const candidates=entries.filter(f=>f.type==='blob'&&['100644','100755'].includes(f.mode)&&safe(f.path)&&supported.has(ext(f.path)));
  row.oversized=candidates.filter(f=>f.size>1048576).length;
  const eligible=candidates.filter(f=>f.size<=1048576).sort((a,b)=>a.path.localeCompare(b.path));row.eligible=eligible.length;
  const list=eligible.slice(0,10000);row.excludedByBudget=eligible.length-list.length;
  let stagedBytes=0;const manifest=[];
  for(let i=0;i<list.length;i+=3){
   const batch=list.slice(i,i+3),files=[];row.batches++;
   for(const f of batch){
    try{
     const bytes=git(root,['cat-file','blob',f.sha],{encoding:'buffer'});
     if(bytes.length!==f.size||!checkBlobIntegrity(bytes,f.sha))throw Error('Integrity');
     const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);if(content.includes('\0'))throw Error('Binary');
     const result=inspectFile({path:f.path,content},{allPaths:known});
     row.audited++;row.syntax[result.syntax.status]=(row.syntax[result.syntax.status]||0)+1;
     for(const x of result.findings)row.findings[x.code]=(row.findings[x.code]||0)+1;
     row.files.push({path:f.path,sha:f.sha,syntax:result.syntax,findings:result.findings,findingsCapped:result.findingsCapped});
     const secret=result.findings.some(x=>x.code==='POSSIBLE_SECRET')||result.findingsCapped;
     if(!secret&&stagedBytes+bytes.length<=64*1024*1024){const alias='blob-'+manifest.length;writeFileSync(join(stage,alias),bytes,{mode:0o644});manifest.push({alias,sha:f.sha});stagedBytes+=bytes.length;}
     else row.sandboxExcluded=(row.sandboxExcluded||0)+1;
     if(!secret&&native.has(ext(f.path))&&content.length<=120000){const e=ext(f.path);files.push({name:'file-'+files.length+'.'+(['mjs','cjs'].includes(e)?'js':e),content});}
    }catch{row.failed++;row.files.push({path:f.path,sha:f.sha,status:'read_or_audit_failed'});}
   }
   // Three source files per mission; native bus aggregate cap remains 300k.
   if(files.length){
    if(files.reduce((n,f)=>n+f.content.length,0)>300000){row.sdkBlocked++;}else try{
     const project={name:row.repo,files};
     if(audit(files).findings.some(x=>x.code==='POSSIBLE_SECRET'))throw Error('Secret');
     const result=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});
     if(result.status!=='completed')throw Error('Workflow');
     const sdk=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));
     if((await sdk.call('project.inventory')).files.length!==files.length)throw Error('SDK');
     row.sdkPassed++;
    }catch{row.sdkBlocked++;}
   }
   if(row.batches%25===0)console.log('REAL_FLEET_PROGRESS '+JSON.stringify({repo:row.repo,audited:row.audited,eligible:row.eligible}));
  }
  if(manifest.length)row.sandbox=container(stage,manifest);
  row.status=!list.length?'no_eligible_files':row.failed||row.oversized||row.excludedByBudget||row.sdkBlocked||row.sandbox?.status!=='passed'||row.sandboxExcluded?'partial':'audited';
 }catch{row.status='git_or_audit_failed';}
 finally{rmSync(root,{recursive:true,force:true});rmSync(stage,{recursive:true,force:true});}
 return row;
}
for(const item of assigned){const row=await examine(item);rows.push(row);checkpoint();console.log('REAL_FLEET_ROW '+JSON.stringify({...row,files:undefined}));}
console.log('REAL_FLEET_SUMMARY '+JSON.stringify({shard,assigned:assigned.length,completed:rows.length,files:rows.reduce((n,r)=>n+r.audited,0),batches:rows.reduce((n,r)=>n+r.batches,0),sandboxPassed:rows.filter(r=>r.sandbox?.status==='passed').length,results:rows.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{}),functionalTests:false}));
if(rows.some(r=>!['audited','empty_repository','no_eligible_files'].includes(r.status)))process.exitCode=1;
