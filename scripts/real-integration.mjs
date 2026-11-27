// Real GitHub integration: reviewed source blobs, no arbitrary checkout execution.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {checkBlobIntegrity,inspectFile} from '../deep-audit.mjs';
import {prepareSandbox,runSandbox} from '../sandbox-runner.mjs';
import {createNativeBus} from '../code-mode-x-tools.mjs';
import {createClient,createGateway} from '../native-protocol.mjs';
import {executeWorkflow,defaultWorkflow} from '../classical-engine.mjs';
const repo='Nikoju1977/the-lovestronautes-machine';
const originalCommit='3903bb23403db04bb4f27e9cf840b837dc4f6ff2';
const correctedCommit='d5436d4af6c0a53d28bbfe9b66d05546295668d2';
const root=mkdtempSync(join(tmpdir(),'cmx-real-git-'));
const report={repo,originalCommit,correctedCommit,providerCalls:0,gitWrites:false,staticAudit:[],sandbox:null};
const git=(args,opts={})=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'},...opts});
try{
 git(['init','--quiet']);
 for(const sha of [originalCommit,correctedCommit])git(['-c','protocol.file.allow=never','fetch','--quiet','--no-tags','--depth=1','https://github.com/'+repo+'.git',sha]);
 const read=(commit,path)=>{
  const sha=git(['rev-parse',commit+':'+path]).trim();
  const bytes=git(['show',commit+':'+path],{encoding:'buffer'});
  assert.ok(checkBlobIntegrity(bytes,sha),'Git blob integrity');
  return {path,sha,content:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)};
 };
 const originals=['loop-studio.js','mobile-v17.js','sw.js'].map(path=>read(originalCommit,path));
 const fixed=originals.map(f=>read(correctedCommit,f.path));
 for(let i=0;i<originals.length;i++){
  const a=inspectFile(originals[i],{treeTruncated:true}),b=inspectFile(fixed[i],{treeTruncated:true});
  report.staticAudit.push({path:originals[i].path,originalBlob:originals[i].sha,correctedBlob:fixed[i].sha,before:a.syntax.status,after:b.syntax.status,beforeFindings:a.totalFindings,afterFindings:b.totalFindings});
  assert.equal(b.syntax.status,'valid');
 }
 // This project fits the local V20 bus limits, unlike the remote provider context.
 const project={name:repo,files:fixed.map(f=>({name:f.path,content:f.content}))};
 const workflow=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});
 assert.equal(workflow.status,'completed');
 const client=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));
 const inv=await client.call('project.inventory');assert.equal(inv.files.length,3);
 report.classicalWorkflow=workflow.status;report.sdkInventory=inv.files.length;
 const image=process.env.CMX_TEST_IMAGE;
 assert.match(image??'',/^sha256:[a-f0-9]{64}$/);
 const harness=`import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
 const source=fs.readFileSync('/work/loop-studio.js','utf8');
 const bank={C:{kick:Array(16).fill(1)}};
 const scope={patterns:bank,bpm:145,document:{getElementById:()=>null},saveLiveState:()=>{}};
 const api=vm.runInNewContext(source+'\\n({loopsRestoreState,loopsProjectState,loopsSaveClip,loopsState:()=>loopsState})',scope);
 api.loopsRestoreState({loops:{pattern:'C',bars:4,nextId:Number.MAX_SAFE_INTEGER,clips:[{id:9999999,name:'original',pattern:'C',bars:4,bpm:145,data:{kick:Array(16).fill(1)}}]}});
 assert.equal(api.loopsSaveClip('new'),true);
 const saved=api.loopsProjectState();
 api.loopsRestoreState({loops:saved});
 assert.equal(api.loopsState().clips.length,2);
 assert.equal(api.loopsState().clips[1].id,1);
 `;
 const spec={proposal:{format:'code-mode-x-github-proposal-v1',status:'review_required',repo,branch:'main',commit:originalCommit,changes:[{path:originals[0].path,expectedBlob:originals[0].sha,content:fixed[0].content}]},originals:[originals[0]],harness,image,language:'javascript'};
 const plan=prepareSandbox(spec);
 report.sandbox=runSandbox({spec,approval:plan.approvalDigest});
 assert.equal(report.sandbox.status,'fixture_improved');
 assert.equal(report.sandbox.before.status,'failed');
 assert.equal(report.sandbox.after.status,'passed');
 report.status='passed';
}catch(e){report.status='failed';report.errorType=e.name;process.exitCode=1;console.error('Real integration failed:',e.message);}
finally{rmSync(root,{recursive:true,force:true});writeFileSync('real-integration-report.json',JSON.stringify(report,null,2));console.log('REAL_INTEGRATION '+JSON.stringify(report));}
