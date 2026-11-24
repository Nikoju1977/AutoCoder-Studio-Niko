import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeBus,listNativeTools} from '../code-mode-x-tools.mjs';
const project={name:'demo',files:[{name:'config.json',content:'{'}]};
test('registry describes five typed tools without credentials',()=>{assert.equal(listNativeTools().length,5);assert.equal(createNativeBus().list().length,3);});
test('local audit and roadmap execute, budget enforced',async()=>{const b=createNativeBus({project,maxCalls:2});assert.equal((await b.call('project.audit')).result.findings[0].code,'JSON_INVALID');assert.equal((await b.call('project.roadmap')).result.tasks[0].id,'JSON_INVALID');await assert.rejects(b.call('project.inventory'));assert.equal(b.journal().length,2);});
test('unknown tools, injected properties and network denied by default',async()=>{const b=createNativeBus({project,fetchImpl:()=>assert.fail('network')});await assert.rejects(b.call('shell.exec'));await assert.rejects(b.call('__proto__'));await assert.rejects(b.call('project.audit',{cmd:'x'}));await assert.rejects(b.call('github.catalog',{owner:'Niko',page:1}));});
test('explicit public network permission routes only the fixed GitHub endpoint',async()=>{const b=createNativeBus({permissions:['github.public.read'],fetchImpl:async(url,opts)=>{assert.equal(new URL(url).hostname,'api.github.com');assert.equal(opts.credentials,'omit');return new Response('[]');}});const r=await b.call('github.catalog',{owner:'Niko',page:1});assert.deepEqual(r.result.rows,[]);await assert.rejects(b.call('project.audit'));});
