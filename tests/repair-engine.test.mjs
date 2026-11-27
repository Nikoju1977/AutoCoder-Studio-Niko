import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {repairJson,prepareRepair} from '../repair-engine.mjs';
import {proposalDigest} from '../code-mode-x-publish.mjs';
const sha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const spec=files=>({repo:'Nikoju1977/demo',branch:'main',commit:'a'.repeat(40),files:files.map(([path,content])=>({path,content,sha:sha(content)}))});
test('repairs only BOM and trailing commas; strings and CRLF unchanged',()=>{const input='\uFEFF{\r\n "a": "comma, }", "b": [1,2,],\r\n}';const r=repairJson(input);assert.equal(r.status,'repair_candidate');assert.equal(r.content,'{\r\n "a": "comma, }", "b": [1,2]\r\n}');assert.equal(r.edits.length,3);assert.equal(r.proof.after,'valid');assert.equal(r.proof.functionalTests,false);});
test('no guesses for missing values, comments or malformed JSON',()=>{for(const s of ['[,]','{"a":,}','{"a":1,,}','{"a":1 // comment\n}','{"a":'])assert.equal(repairJson(s).status,'manual_review',s);assert.equal(repairJson('{"a":1}').status,'already_valid');});
test('secret blocks candidate without returning source',()=>{const r=repairJson('{"x":"-----BEGIN PRIVATE KEY-----",}');assert.deepEqual(r,{status:'blocked_secret'});});
test('proposal pins original blob and digest; config policy and unsupported language remain blocked',()=>{const r=prepareRepair(spec([['data.json','{"a":1,}'],['package.json','{"a":1,}'],['app.js','const =']]));assert.equal(r.status,'review_required');assert.equal(r.proposal.changes.length,1);assert.equal(r.proposal.changes[0].expectedBlob,sha('{"a":1,}'));assert.equal(r.approvalDigest,proposalDigest(r.proposal));assert.equal(r.reports[1].status,'publication_policy_blocked');assert.equal(r.reports[2].status,'manual_review');});
test('reject stale or forged bytes, duplicate files and excess selection',()=>{const x=spec([['a.json','[1,]']]);x.files[0].sha='0'.repeat(40);assert.throws(()=>prepareRepair(x),/integrity/);assert.throws(()=>prepareRepair(spec([['a.json','[1,]'],['a.json','[1,]']])));assert.throws(()=>prepareRepair(spec(Array.from({length:4},(_,i)=>[i+'.json','[1,]']))));});

test('UTF-8 BOM is retained by GitHub audit reader for exact repair',async()=>{
 const {readPublicAuditBlob}=await import('../code-mode-x-github.mjs');
 const content='\uFEFF{"a":1}',b=Buffer.from(content),id=sha(content);
 const snapshot={repo:'Nikoju1977/demo',files:[{path:'data.json',sha:id,size:b.length}]};
 const blob=await readPublicAuditBlob(snapshot,'data.json',{fetchImpl:async()=>new Response(JSON.stringify({sha:id,encoding:'base64',content:b.toString('base64')}))});
 assert.equal(blob.content,content);assert.equal(prepareRepair({...spec([['data.json',content]]),files:[blob]}).status,'review_required');
});
