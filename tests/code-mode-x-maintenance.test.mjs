import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTask,readQueue,saveQueue,orderedQueue,transitionTask,prepareTask,branchSuggestion} from '../code-mode-x-maintenance.mjs';
const p={github:{repo:'Niko/Audio',commit:'a'.repeat(40)}};
const task=(id,priority)=>makeTask(p,{id,title:'Correction',mission:'Corriger le buffer',priority,at:'2026-11-25'});
test('queue prioritizes and persists exact commit',()=>{const m=new Map(),s={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};saveQueue(s,[task('a',3),task('b',0)]);assert.equal(orderedQueue(readQueue(s))[0].id,'b');assert.equal(prepareTask(task('a',3),p),'Corriger le buffer');assert.throws(()=>prepareTask(task('a',3),{github:{...p.github,commit:'b'.repeat(40)}}));});
test('verification requires explicit evidence and proposal state',()=>{const t=task('a',1);assert.throws(()=>transitionTask(t,'verified_by_user','test'));const r=transitionTask(t,'proposal_ready');assert.throws(()=>transitionTask(r,'verified_by_user'));assert.equal(transitionTask(r,'verified_by_user','test manuel').state,'verified_by_user');});
test('branch suggestion is only a name and no secret notes',()=>{assert.match(branchSuggestion(task('a',1)),/^maintenance\/cmx-aaaaaaaa-a$/);assert.throws(()=>makeTask(p,{id:'b',title:'x',mission:'-----BEGIN PRIVATE KEY-----',at:'now'}));});
