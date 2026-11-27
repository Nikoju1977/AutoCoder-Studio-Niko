import test from 'node:test';import assert from 'node:assert/strict';
import {newLedger,upsertIssues,moveIssue,makeIssue} from '../maintenance-ledger.mjs';
import {reconcileWan,records,gpuFollowup} from '../maintenance-reconciliation.mjs';
test('exact Wan context and compile proof preserve GPU follow-up; idempotent',()=>{
 const old=upsertIssues(newLedger(),records);const next=reconcileWan(old);
 assert.equal(next.issues.length,3);assert.equal(next.issues.find(t=>t.id===makeIssue(records[0]).id).state,'evidence_recorded');
 const f=next.issues.find(t=>t.id===makeIssue(records[1]).id);assert.equal(f.state,'cancelled');assert.match(f.evidence.at(-1).note,/Intentional fragment/);
 assert.equal(next.issues.find(t=>t.id===makeIssue(gpuFollowup).id).state,'queued');
 assert.deepEqual(reconcileWan(next),next);assert.equal(old.issues[0].state,'queued');
});
test('reconciliation never changes a running reservation or another commit',()=>{
 const other={...records[0],commit:'c'.repeat(40)};
 let l=upsertIssues(newLedger(),[...records,other]);l=moveIssue(l,makeIssue(records[0]).id,'running');
 const next=reconcileWan(l);assert.equal(next.issues.find(t=>t.id===makeIssue(records[0]).id).state,'running');assert.equal(next.issues.find(t=>t.id===makeIssue(other).id).state,'queued');
});
