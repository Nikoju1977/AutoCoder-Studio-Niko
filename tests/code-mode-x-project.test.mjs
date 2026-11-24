import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProject,proposalExport} from '../code-mode-x-project.mjs';
import {createHttpAgentTransport} from '../code-mode-x-team.mjs';
test('native AutoCoder format round trip',()=>{const p=parseProject({projectName:'Niko',files:{'main.py':'print(1)'}});const v=proposalExport(p,{status:'review_required',proposal:[{name:'main.py',content:'print(2)'}]});assert.equal(v.files['main.py'],'print(2)');assert.equal(p.files[0].content,'print(1)');});
test('blocked or destructive exports are refused',()=>{const p=parseProject({files:{'main.py':'x'}});assert.throws(()=>proposalExport(p,{status:'blocked'}));assert.throws(()=>proposalExport(p,{status:'review_required',proposal:[{name:'other.py',content:'x'}]}));});
test('explicit provider reaches API',async()=>{const request=createHttpAgentTransport({token:'a'.repeat(32),fetchImpl:async(_url,opts)=>{assert.equal(JSON.parse(opts.body).provider,'mistral');return {ok:true,json:async()=>({files:[]})};}});await request({role:'critic',provider:'mistral',prompt:'audit',files:[]});});
