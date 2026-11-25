// Code Mode Pro V24: audit immutable Nexus deployment, never initiate a broadcast.
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {patchRecording} from './nexus-recording-patch.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {inspectFile} from '../deep-audit.mjs';
import {createNativeBus} from '../code-mode-x-tools.mjs';
import {createGateway,createClient} from '../native-protocol.mjs';
import {executeWorkflow,defaultWorkflow} from '../classical-engine.mjs';
const base='https://niko-nexus-remote-17-5-ev4e2sn29-nikoju1977s-projects.vercel.app/';
const inventory=[{"path":"README.md","sha":"8d2a2bb53ebe89a47c4801dec61c9c2d39966ecb"},{"path":"app.js","sha":"259d9071991f084ae8cb9f2bba2762f611b79fc4"},{"path":"hybrid.js","sha":"b108d9be751d9ecf57a8b9c2bbcf0596fb2befbc"},{"path":"icon-192.png","sha":"36b8c3e878c1f2abf8c3b468ca76183f7ef65c37"},{"path":"icon-512.png","sha":"79ec034ccf0942f136e61e0890058e927ac6e459"},{"path":"index.html","sha":"f0a4b65e27d833e20131033373d3cb1a258cfc4b"},{"path":"manifest.webmanifest","sha":"863b49e0629adb4efa0c17cd50d8c89c540dbab7"},{"path":"overlay.js","sha":"c34eef7e56e7ec57003b47ee1f4d50ac892b328e"},{"path":"style.css","sha":"ce5d545bac1f4cd64eaf23808f57ee8b32afa43f"},{"path":"sw.js","sha":"af190e81f67f328e60a6fb888ba891c92155e255"},{"path":"vercel.json","sha":"3ff22e109aff90b23ca20941674b8cf05ae5dbc4"},{"path":"video-core.js","sha":"0cf25094da4072364ecdb73dd234efe8cab8fdb8"},{"path":"video.css","sha":"071f915c396dbba400b40d0e4c251983e856bc04"},{"path":"video.html","sha":"48af92ec2e149eb435c29d12937830edad486c01"},{"path":"video.js","sha":"b352fd87b471e2cae4b3aeb30576673d1f6453bf"}];
const report={deployment:'dpl_HMzqjvVJ7cJDoRsQtKo88xTL8W3C',base,files:[],lots:[],browser:[],providerCalls:0,liveTransmissionTested:false,localEngineTested:false};
const assets=new Map();
const mime=p=>p.endsWith('.html')?'text/html':p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.webmanifest')?'application/manifest+json':'text/plain';
const save=()=>writeFileSync('nexus-audit-report.json',JSON.stringify(report,null,2));
try{
 for(let i=0;i<inventory.length;i+=3){
  const lot=[],native=[];let number=0;
  for(const f of inventory.slice(i,i+3)){
   const row={path:f.path,expectedSha1:f.sha};lot.push(row);report.files.push(row);
   try{
    // Public alias is a fallback transport, never a substitute for the pinned bytes.
    row.attempts=[];
    let b=null;
    for(const origin of [base,'https://niko-nexus-remote-17-5.vercel.app/']){
     const attempt={origin};row.attempts.push(attempt);
     try{
      const r=await fetch(new URL(f.path,origin),{redirect:'error',signal:AbortSignal.timeout(10000)});
      attempt.http=r.status;if(!r.ok)continue;
      const candidate=Buffer.from(await r.arrayBuffer());
      if(candidate.length>1048576){attempt.status='size_limit';continue;}
      attempt.sha1=createHash('sha1').update(candidate).digest('hex');
      if(attempt.sha1!==f.sha){attempt.status='hash_mismatch';continue;}
      b=candidate;attempt.status='verified';row.http=r.status;break;
     }catch(e){attempt.status='request_failed';attempt.errorType=e.name;attempt.errorCode=String(e.cause?.code||'unknown').slice(0,60);}
    }
    if(!b){row.status=row.attempts.some(a=>a.status==='hash_mismatch')?'hash_mismatch':row.attempts.some(a=>a.http)?'unavailable':'read_failed';continue;}
    row.bytes=b.length;row.sha1=createHash('sha1').update(b).digest('hex');
    row.status='verified';assets.set(f.path,b);
    if(f.path.endsWith('.png')){row.binary=true;continue;}
    const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);
    const path=f.path.endsWith('.webmanifest')?'manifest.json':f.path;
    const audit=inspectFile({path,content},{allPaths:inventory.map(x=>x.path)});
    row.syntax=audit.syntax.status;row.findings=audit.findings;row.findingsCapped=audit.findingsCapped;
    if(!audit.findingsCapped&&!audit.findings.some(x=>x.code==='POSSIBLE_SECRET')&&content.length<=120000&&/\.(js|json|html|css|md)$/.test(path))native.push({name:'file-'+(++number)+'.'+path.split('.').pop(),content});
   }catch{row.status='read_failed';}
  }
  const result={batch:i/3+1,files:lot.map(r=>r.path),sdk:'not_applicable'};
  if(native.length)try{const project={name:'Nexus 17.5',files:native};const wf=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});assert.equal(wf.status,'completed');const sdk=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));assert.equal((await sdk.call('project.inventory')).files.length,native.length);result.sdk='passed';}catch{result.sdk='blocked';}
  report.lots.push(result);save();
 }
 const originalVideo=assets.get('video.js');
 if(originalVideo){
  const candidate=patchRecording(originalVideo.toString('utf8'));
  const audit=inspectFile({path:'video.js',content:candidate});
  assert.equal(audit.syntax.status,'valid');
  report.repair={originalSha1:createHash('sha1').update(originalVideo).digest('hex'),candidateSha1:createHash('sha1').update(candidate).digest('hex'),syntax:audit.syntax.status,productionChanged:false};
  assets.set('video.js',Buffer.from(candidate));
 }
 // Exact bytes served through intercepted local-origin requests. No real relay, media or remote control.
 const required=['index.html','video.html','app.js','hybrid.js','overlay.js','video-core.js','video.js','style.css','video.css'];
 if(required.some(p=>!assets.has(p)))throw Error('Required verified assets missing');
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
   const context=await browser.newContext({viewport,serviceWorkers:'block',permissions:[]});
   const errors=[],external=[];
   await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://nexus-audit.invalid'){external.push(u.origin);return route.abort();}const p=u.pathname==='/'?'index.html':u.pathname.slice(1),data=assets.get(p);return data?route.fulfill({status:200,contentType:mime(p),body:data}):route.fulfill({status:404,body:'Not found'});});
   const page=await context.newPage();page.on('pageerror',()=>errors.push('pageerror'));
   const row={viewport,tests:{},status:'not_tested'};report.browser.push(row);
   try{
    await page.goto('https://nexus-audit.invalid/',{waitUntil:'load'});
    await page.locator('#checks').waitFor();assert.equal(await page.locator('#bar').count(),1);
    row.tests.portal=true;
    await page.goto('https://nexus-audit.invalid/video.html',{waitUntil:'load'});
    await page.locator('#sourceStatus3').waitFor();
    assert.equal(await page.locator('#sources .source-box').count(),4);
    assert.equal(await page.locator('#effects .fxbox').count(),4);
    assert.equal(await page.locator('#layout option').count(),6);
    assert.equal(await page.locator('#transition option').count(),7);
    row.tests.controls=true;row.stage='render';
    const tested=await page.evaluate(()=>{
     const V=VideoDirector,src=document.createElement('canvas');src.width=160;src.height=90;
     src.getContext('2d').fillStyle='#ff0000';src.getContext('2d').fillRect(0,0,160,90);
     const out=document.createElement('canvas');out.width=320;out.height=180;
     const other=document.createElement('canvas');other.width=320;other.height=180;other.getContext('2d').fillStyle='#00ff00';other.getContext('2d').fillRect(0,0,320,180);
     let effects=0,layouts=0,transitions=0;
     for(const layout of ['single','pip','split','quad','focus','vertical']){const scene={...V.defaults(),layout,fit:'cover',banner:false};V.render(out,[src,src,src,src],scene,1000);for(const [,x,y,w,h] of V.layout(layout,out.width,out.height,0)){const d=out.getContext('2d').getImageData(Math.floor(x+w/2),Math.floor(y+h/2),1,1).data;if(d[0]<250||d[1]>5||d[2]>5)throw Error('Layout render: '+layout);}layouts++;}
     for(const id of Object.keys(V.FX)){const scene=V.defaults();scene.fx[0]={id,amount:50};V.render(out,[src,null,null,null],scene,1000);effects++;}
     for(const mode of ['cut','fade','wipe','vertical','dip','iris','slide']){V.transition(out,src,other,mode,1);const d=out.getContext('2d').getImageData(160,90,1,1).data;if(d[1]<240||d[0]>10)throw Error('Transition endpoint: '+mode);transitions++;}
     return {effects,layouts,transitions};
    });
    row.tests.render=tested;row.stage='take_black';
    await page.locator('#transition').selectOption('cut');await page.locator('#layout').selectOption('quad');await page.locator('#take').click();
    await page.locator('#black').click();
    await page.waitForFunction(()=>{const d=document.querySelector('#program').getContext('2d').getImageData(640,360,1,1).data;return d[0]===0&&d[1]===0&&d[2]===0;});
    row.tests.takeAndBlack=true;row.stage='complete';
    assert.equal(errors.length,0);row.status='passed';
   }catch(e){row.status='failed';row.errorType=e.name;row.diagnostic=String(e.message).replace(/[^a-zA-Z0-9 _:.\-]/g,' ').slice(0,180);}
   finally{row.pageErrors=errors.length;row.externalRequestsBlocked=external.length;await context.close();save();}
  }
  // Simulated encoder events exercise cap/discard behavior without allocating 150 MiB.
  report.recordingRegression=[];
  for(const version of ['original','candidate']){
   const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
   await context.addInitScript(()=>{
    const state=window.__recordTest={downloads:0,stops:0};
    HTMLCanvasElement.prototype.captureStream=function(){return {getTracks:()=>[{stop:()=>{}}]}};
    const old=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download){state.downloads++;return;}return old.call(this)};
    window.MediaRecorder=class {
     static isTypeSupported(){return true}
     constructor(){this.state='inactive';this.mimeType='video/webm';state.recorder=this;}
     start(){this.state='recording'}
     emit(size){const b=new Blob(['fixture']);Object.defineProperty(b,'size',{value:size});this.ondataavailable({data:b});}
     stop(){if(this.state==='inactive')return;this.state='inactive';state.stops++;queueMicrotask(()=>this.onstop());}
    };
   });
   await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://nexus-audit.invalid')return route.abort();const p=u.pathname.slice(1),data=p==='video.js'&&version==='original'?originalVideo:assets.get(p);return data?route.fulfill({status:200,contentType:mime(p),body:data}):route.fulfill({status:404,body:'Not found'});});
   try{
    const page=await context.newPage();await page.goto('https://nexus-audit.invalid/video.html');
    await page.locator('#rec').click();
    const first=await page.evaluate(async()=>{const s=window.__recordTest;s.recorder.emit(100*1024**2);s.recorder.emit(25*1024**2);if(s.recorder.state==='recording')s.recorder.emit(30*1024**2);await Promise.resolve();return {downloads:s.downloads,stops:s.stops};});
    assert.equal(first.stops,1);assert.equal(first.downloads,version==='candidate'?1:0);
    await page.locator('#rec').click();
    const discard=await page.evaluate(async()=>{const s=window.__recordTest;s.recorder.emit(1024);document.querySelector('#clear').click();document.querySelector('#stop').click();await Promise.resolve();return s.downloads;});
    assert.equal(discard,first.downloads);
    report.recordingRegression.push({version,capExport:first.downloads===1,discardPreserved:true,encoder:'mock',passed:true});
   }finally{await context.close();save();}
  }
 }finally{await browser.close();}
 report.status=report.recordingRegression?.length===2&&report.recordingRegression.every(r=>r.passed)&&report.browser.every(r=>r.status==='passed')&&report.lots.every(r=>r.sdk!=='blocked')&&report.files.every(r=>r.status==='verified'||(['README.md','vercel.json'].includes(r.path)&&r.status==='unavailable'))?'passed':'partial';
}catch(e){report.status='blocked';report.errorType=e.name;}
finally{save();console.log('NEXUS_AUDIT '+JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;}
