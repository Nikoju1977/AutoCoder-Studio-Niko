// Optional Linux Docker runner. No Docker installation or image pulls.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {checkBlobIntegrity} from './deep-audit.mjs';
import {validateProposal,proposalDigest} from './code-mode-x-publish.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const dockerHost='unix:///var/run/docker.sock';
const env=()=>({PATH:process.env.PATH||'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent',LANG:'C'});
export function prepareSandbox({proposal,originals,harness,image,language}={}){
 const p=validateProposal(proposal);
 if(!['javascript','python'].includes(language)||typeof image!=='string'||!/^sha256:[a-f0-9]{64}$/.test(image)||typeof harness!=='string'||!harness.trim()||Buffer.byteLength(harness)>20000||!Array.isArray(originals)||originals.length!==p.changes.length||originals.length>3)throw Error('Invalid sandbox fixture');
 const suffix=language==='python'?'py':'mjs';
 const reserved='cmx-operator-test.'+suffix;
 const before=[],after=[];
 for(const change of p.changes){
  if(change.path===reserved||!(language==='python'?/\.py$/:/\.(js|mjs|cjs)$/).test(change.path))throw Error('Unsupported fixture path or language');
  const matches=originals.filter(f=>f?.path===change.path);
  if(matches.length!==1||typeof matches[0].content!=='string'||Buffer.byteLength(matches[0].content)>120000||!checkBlobIntegrity(Buffer.from(matches[0].content),change.expectedBlob))throw Error('Original blob mismatch');
  before.push({path:change.path,content:matches[0].content});after.push({path:change.path,content:change.content});
 }
 const manifest={proposalDigest:proposalDigest(proposal),image,language,harnessSha256:hash(harness),files:before.map(f=>f.path),limits:{memoryMB:256,cpus:1,pids:64,timeoutMs:20000},network:'none'};
 return {manifest,approvalDigest:hash(JSON.stringify(manifest)),before,after,harness,reserved};
}
export function dockerArgs({image,language,root,name,reserved}){
 if(!/^sha256:[a-f0-9]{64}$/.test(image)||!/^cmx-[a-f0-9-]{36}$/.test(name)||!root.startsWith('/')||root.includes(',')||!['javascript','python'].includes(language)||reserved!=='cmx-operator-test.'+(language==='python'?'py':'mjs'))throw Error('Invalid container arguments');
 return ['--host',dockerHost,'run','--rm','--name',name,'--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--memory=256m','--memory-swap=256m','--cpus=1','--pids-limit=64','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16m','--mount','type=bind,src='+root+',dst=/work,readonly','--workdir','/work','--entrypoint',language==='python'?'python3':'node',image,...(language==='python'?['-B','-s']:[]),'/work/'+reserved];
}
function stage(root,files,harness,reserved){
 chmodSync(root,0o755);
 for(const f of [...files,{path:reserved,content:harness}]){
  const dest=join(root,f.path);mkdirSync(dirname(dest),{recursive:true,mode:0o755});writeFileSync(dest,f.content,{flag:'wx',mode:0o644});chmodSync(dest,0o644);
 }
}
export function runSandbox({spec,approval,spawn=spawnSync}={}){
 const plan=prepareSandbox(spec);
 if(approval!==plan.approvalDigest)throw Error('Explicit execution approval required');
 if(process.platform!=='linux')throw Error('Linux local Docker socket required');
 const invoke=(args,timeout)=>spawn('docker',args,{timeout,encoding:'utf8',maxBuffer:65536,env:env(),stdio:['ignore','ignore','ignore'],windowsHide:true});
 const probe=invoke(['--host',dockerHost,'image','inspect',plan.manifest.image],5000);
 if(probe.status!==0||probe.error)return {status:'sandbox_unavailable',testsExecuted:false,manifest:plan.manifest};
 const run=files=>{
  const root=mkdtempSync(join(tmpdir(),'cmx-fixture-')),name='cmx-'+randomUUID();
  try{
   stage(root,files,plan.harness,plan.reserved);
   const r=invoke(dockerArgs({image:plan.manifest.image,language:plan.manifest.language,root,name,reserved:plan.reserved}),20000);
   if(r.error||r.status===null||[125,126,127].includes(r.status))return {status:'inconclusive',exitCode:r.status??null};
   return {status:r.status===0?'passed':'failed',exitCode:r.status};
  }finally{
   // Explicit cleanup even if the client timed out; no arbitrary shell command.
   invoke(['--host',dockerHost,'rm','-f',name],5000);
   rmSync(root,{recursive:true,force:true});
  }
 };
 const before=run(plan.before),after=run(plan.after);
 const conclusive=before.status!=='inconclusive'&&after.status!=='inconclusive';
 return {status:!conclusive?'inconclusive':before.status==='failed'&&after.status==='passed'?'fixture_improved':before.status==='passed'&&after.status==='failed'?'fixture_regression':before.status==='passed'&&after.status==='passed'?'fixture_both_passed':'fixture_both_failed',before,after,testsExecuted:conclusive,scope:'operator_supplied_fixture_only',manifest:plan.manifest,recordedAt:new Date().toISOString()};
}
