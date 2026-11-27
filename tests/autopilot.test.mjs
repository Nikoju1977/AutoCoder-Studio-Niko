import test from 'node:test';
import assert from 'node:assert/strict';
import {issue,verified,setCookie,sameOrigin,LIFETIME,NAME} from '../server-session.mjs';
import {selectPaths,nextBatch,approvedExport,runBatch} from '../autopilot.mjs';
const secret='x'.repeat(40);
test('signed session expires, rotation revokes, no raw token',()=>{
 const s=issue(secret,1000),req={headers:{cookie:NAME+'='+s}};
 assert.equal(verified(req,secret,1001),true);
 assert.equal(verified(req,secret,1000+LIFETIME),false);
 assert.equal(verified(req,'y'.repeat(40),1001),false);
 assert.equal(verified({headers:{cookie:NAME+'='+s+'x'}},secret,1001),false);
 assert.equal(verified({headers:{cookie:NAME+'='+s+'; '+NAME+'='+s}},secret,1001),false);
 assert.ok(!s.includes(secret));
 assert.match(setCookie(s),/Secure; HttpOnly; SameSite=Strict/);
 assert.match(setCookie('',0),/Max-Age=0/);
});
test('same origin HTTPS only',()=>{
 assert.ok(sameOrigin({headers:{host:'example.test',origin:'https://example.test','sec-fetch-site':'same-origin'}}));
 for(const origin of ['https://evil.test','http://example.test','null',undefined])assert.equal(sameOrigin({headers:{host:'example.test',origin}}),false);
 assert.equal(sameOrigin({headers:{host:'example.test',origin:'https://example.test','sec-fetch-site':'cross-site'}}),false);
});
test('selection and batch bounds',()=>{
 assert.deepEqual(selectPaths({files:[{path:'app.js',size:20},{path:'api/generate.mjs',size:20},{path:'token.js',size:20},{path:'huge.js',size:9000},{path:'b.py',size:100}]}),['app.js','b.py']);
 const rows=['a','b','c','d','e'].map(repo=>({repo}));
 assert.deepEqual(nextBatch(rows,'b').map(x=>x.repo),['c','d','e']);
 assert.deepEqual(nextBatch(rows,'e'),[]);
 assert.throws(()=>nextBatch(rows,'',4));
});
test('export requires human approval and never authorizes publish',()=>{
 const e={status:'review_required',proposal:{status:'review_required',testsExecuted:false,changes:[{path:'a.js'}]}};
 assert.throws(()=>approvedExport(e,false));
 assert.equal(approvedExport(e,true).publicationAuthorized,false);
});
test('orchestration with mock provider: four roles and no write',async()=>{
 const rows=[{repo:'Nikoju1977/test'}],roles=[];
 const r=await runBatch({rows,loadRepo:async()=>({commit:'a'.repeat(40),files:[{path:'app.js',size:10}]}),loadFiles:async()=>({files:[{name:'file-01.js',content:'const a=1;'}],github:{repo:rows[0].repo,branch:'main',commit:'a'.repeat(40),mapping:[{name:'file-01.js',path:'app.js',sha:'b'.repeat(40)}]}}),request:async({role})=>{roles.push(role);return {files:[role==='innovator'?{name:'ideas.json',content:JSON.stringify({ideas:[{title:'a',benefit:'b',effort:'low',test:'c'}]})}:role==='architect'?{name:'plan.md',content:'Simplifier'}:role==='developer'?{name:'file-01.js',content:'const a = 1;'}:{name:'review.json',content:'{"accept":true,"issues":[]}'}]};}});
 assert.deepEqual(roles,['innovator','architect','developer','critic']);
 assert.equal(r.calls,4);assert.equal(r.results[0].status,'review_required');assert.equal(r.results[0].proposal.testsExecuted,false);assert.equal(r.complete,true);
});
test('quota failure stops without advancing cursor',async()=>{
 const r=await runBatch({rows:[{repo:'a'},{repo:'b'}],loadRepo:async()=>{throw Error('GitHub HTTP 403');}});
 assert.equal(r.cursor,'');assert.equal(r.results.length,1);assert.equal(r.results[0].status,'blocked');
});
test('sensitive repositories never transmitted',async()=>{
 const r=await runBatch({rows:[{repo:'Nikoju1977/MedVision'}],loadRepo:async()=>assert.fail('read prohibited'),request:async()=>assert.fail('transmission prohibited')});
 assert.equal(r.calls,0);assert.equal(r.results[0].status,'manual_review');
});
