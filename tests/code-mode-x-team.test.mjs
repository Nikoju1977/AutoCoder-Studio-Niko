import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgentTeam,createHttpAgentTransport} from '../code-mode-x-team.mjs';
const artifact=(name,content)=>({files:[{name,content}]});
test('architecture, development, criticism, then human review',async()=>{
 const roles=[];
 const r=await runAgentTeam({prompt:'ajouter configuration',files:[{name:'main.py',content:'print(1)'}],request:async({role})=>{
 roles.push(role);
 return role==='architect'?artifact('plan.md','Ajouter JSON'):role==='developer'?artifact('config.json','{}'):artifact('review.json','{"accept":true,"issues":[]}');
 }});
 assert.deepEqual(roles,['architect','developer','critic']);
 assert.equal(r.status,'review_required');assert.equal(r.providerCalls,3);
 assert.equal(r.proposal.length,2);assert.equal(r.testsExecuted,false);
});
test('critic rejection requests bounded revision',async()=>{
 let count=0;
 const r=await runAgentTeam({prompt:'ajouter configuration',request:async({role,prompt})=>{
 if(role==='architect')return artifact('plan.md','Ajouter JSON');
 if(role==='developer'){count++;if(count===2)assert.match(prompt,/corriger/);return artifact('config.json','{}');}
 return artifact('review.json',JSON.stringify({accept:count===2,issues:count===1?['corriger']:[]}));
 }});
 assert.equal(r.status,'review_required');assert.equal(r.providerCalls,5);
});
test('no provider call for secret in project',async()=>{
 const r=await runAgentTeam({prompt:'audit code',files:[{name:'a.md',content:'-----BEGIN PRIVATE KEY-----'}],request:async()=>{assert.fail('network call');}});
 assert.equal(r.status,'blocked');assert.equal(r.providerCalls,0);
});
test('oversized context is not silently truncated',async()=>{
 const r=await runAgentTeam({prompt:'audit code',files:[{name:'a.md',content:'a'.repeat(12001)}],request:async()=>{assert.fail('network call');}});
 assert.equal(r.status,'blocked');assert.equal(r.providerCalls,0);
});
test('HTTP transport calls only the configured API',async()=>{
 const request=createHttpAgentTransport({token:'a'.repeat(32),fetchImpl:async(url,options)=>{
 assert.equal(url.href,'https://autocoder-studio-niko.vercel.app/api/generate');assert.equal(options.redirect,'error');
 assert.equal(JSON.parse(options.body).prompt,'demo');return {ok:true,json:async()=>artifact('a.md','test')};
 }});
 assert.equal((await request({prompt:'demo',files:[]})).files[0].name,'a.md');
});
