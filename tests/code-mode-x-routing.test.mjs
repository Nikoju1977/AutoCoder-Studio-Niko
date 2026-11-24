import test from 'node:test';
import assert from 'node:assert/strict';
import {parseToolSelection,selectAndRunTools} from '../code-mode-x-routing.mjs';
const project={name:'demo',files:[{name:'config.json',content:'{'}]};
const response=tools=>({files:[{name:'tools.json',content:JSON.stringify({tools})}]});
test('architect selects and executes allowed local tools with no project upload during selection',async()=>{
 let calls=0;const r=await selectAndRunTools({project,prompt:'Corriger JSON',request:async args=>{calls++;assert.deepEqual(args.files,[]);return response(['project.audit','project.roadmap']);}});
 assert.equal(calls,1);assert.equal(r.journal.length,2);assert.match(r.context,/JSON_INVALID/);assert.equal(r.testsExecuted,false);
});
test('reject forbidden network, shell, duplicate and invented tools',()=>{
 for(const tools of [['github.snapshot'],['shell.exec'],['project.audit','project.audit'],['__proto__']])assert.throws(()=>parseToolSelection(response(tools)));
});
test('secret and cancellation prevent provider request',async()=>{
 const request=()=>assert.fail('provider called');
 await assert.rejects(selectAndRunTools({project:{files:[{name:'a.md',content:'-----BEGIN PRIVATE KEY-----'}]},prompt:'audit',request}));
 const c=new AbortController();c.abort();await assert.rejects(selectAndRunTools({project,prompt:'audit',request,signal:c.signal}));
});
test('empty selection is valid and no tool is executed',async()=>{const r=await selectAndRunTools({project,prompt:'audit',request:async()=>response([])});assert.deepEqual(r.journal,[]);assert.equal(r.context,'[]');});
