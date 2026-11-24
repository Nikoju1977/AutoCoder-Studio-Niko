import test from 'node:test';
import assert from 'node:assert/strict';
import {audit,validateFiles,runCodeMode} from '../code-mode-x.mjs';
test('rejects unsafe paths and case collisions',()=>{
  assert.throws(()=>validateFiles([{name:'../a.js',content:''}]));
  assert.throws(()=>validateFiles([{name:'a.js',content:''},{name:'A.js',content:''}]));
});
test('local audit distinguishes syntax and warnings',()=>{
  const r=audit([{name:'a.json',content:'{'},{name:'b.js',content:'eval("1")'}]);
  assert.equal(r.passed,false);assert.equal(r.findings.length,2);
});
test('without provider, no generation is claimed',async()=>{
  const r=await runCodeMode({prompt:'audit project'});
  assert.equal(r.status,'audit_only');assert.equal(r.proposal,null);
});
test('repair is bounded and originals are preserved',async()=>{
  let calls=0;
  const files=[{name:'index.html',content:'<p>keep</p>'}];
  const r=await runCodeMode({prompt:'add json',files,generate:async ({feedback})=>{
    calls++;if(calls===2)assert.equal(feedback[0].code,'JSON_INVALID');
    return {files:[{name:'a.json',content:calls===1?'{':'{}'}]};
  }});
  assert.equal(calls,2);assert.equal(r.status,'review_required');
  assert.equal(r.testsExecuted,false);assert.equal(r.proposal.length,2);assert.equal(files.length,1);
});
test('secret blocks before provider call',async()=>{
  const r=await runCodeMode({prompt:'audit project',files:[{name:'a.md',content:'-----BEGIN PRIVATE KEY-----'}],generate:async()=>{throw Error('must not call')}});
  assert.equal(r.status,'blocked');assert.equal(r.reason,'possible_secret');
});
test('repeated failures cannot produce a proposal',async()=>{
  let calls=0;const r=await runCodeMode({prompt:'repair project',maxAttempts:2,generate:async()=>{calls++;throw Error('upstream')}});
  assert.equal(calls,2);assert.equal(r.proposal,null);assert.equal(r.status,'blocked');
});
test('cancelled signal prevents generation',async()=>{
  const c=new AbortController();c.abort();const r=await runCodeMode({prompt:'repair project',signal:c.signal,generate:async()=>{throw Error('must not call')}});
  assert.equal(r.status,'cancelled');
});
