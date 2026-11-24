import test from 'node:test';
import assert from 'node:assert/strict';
import {improvementPlan,taskPrompt} from '../code-mode-x-evolution.mjs';
import {listPublicRepo} from '../code-mode-x-github.mjs';
test('roadmap groups observed findings and distinguishes recommendations',()=>{
 const p={name:'demo',files:[{name:'file-01.json',content:'{'},{name:'file-02.js',content:'el.innerHTML = value;'}],github:{commit:'a'.repeat(40),mapping:[{name:'file-01.json',path:'src/config.json'}]}};
 const r=improvementPlan(p);assert.equal(r.tasks[0].id,'JSON_INVALID');assert.equal(r.tasks[0].locations[0].path,'src/config.json');assert.equal(r.testsExecuted,false);assert.equal(r.tasks.at(-1).origin,'recommended_not_verified');assert.match(taskPrompt(r,'JSON_INVALID'),/Aucun déploiement/);
});
test('potential secrets block AI mission preparation',()=>{
 const r=improvementPlan({name:'p',files:[{name:'a.md',content:'-----BEGIN PRIVATE KEY-----'}]});assert.equal(r.tasks[0].id,'POSSIBLE_SECRET');assert.throws(()=>taskPrompt(r,'POSSIBLE_SECRET'));assert.throws(()=>taskPrompt(r,'REGRESSION_REVIEW'));
});
test('clean audit never claims functional validation',()=>{
 const r=improvementPlan({name:'p',files:[{name:'a.json',content:'{}'}]});assert.equal(r.tasks.length,1);assert.equal(r.testsExecuted,false);
});
test('public GitHub branch is explicitly selected and pinned',async()=>{
 const seen=[];const sha='a'.repeat(40);const fetchImpl=async url=>{seen.push(url);return new Response(JSON.stringify(url.includes('/commits/')?{sha,commit:{tree:{sha}}}:url.includes('/git/trees/')?{tree:[]}:{private:false,default_branch:'main'}));};
 const r=await listPublicRepo('niko/repo',{branch:'feature/code-mode-x-v1',fetchImpl});assert.equal(r.branch,'feature/code-mode-x-v1');assert.equal(r.commit,sha);assert.match(seen[1],/feature%2Fcode-mode-x-v1/);await assert.rejects(listPublicRepo('niko/repo',{branch:'../bad',fetchImpl}));
});
