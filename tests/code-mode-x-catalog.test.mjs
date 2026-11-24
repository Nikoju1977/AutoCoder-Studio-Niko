import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,filterCatalog,recordActivity,readActivity,latestActivity,clearActivity} from '../code-mode-x-catalog.mjs';
import {listOwnerPage} from '../code-mode-x-github.mjs';
test('catalog includes only public nonarchived valid repositories',()=>{
 const rows=normalizeCatalog([{full_name:'Niko/Audio',private:false,archived:false,description:'Synthé',language:'JavaScript'},{full_name:'Niko/Hidden',private:true,archived:false},{full_name:'Niko/Old',private:false,archived:true}]);
 assert.equal(rows.length,1);assert.equal(filterCatalog(rows,'audio javascript').length,1);assert.equal(filterCatalog(rows,'video').length,0);
});
test('local activity is tied to repository and commit, not a test claim',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 const p={github:{repo:'Niko/Audio',commit:'a'.repeat(40)},files:[{}]};
 recordActivity(storage,p,'static_audit','2026-11-25');const rows=readActivity(storage);
 assert.equal(latestActivity(rows,'niko/audio').commit,p.github.commit);assert.equal(latestActivity(rows,'Niko/Video'),null);assert.throws(()=>recordActivity(storage,p,'stable'));clearActivity(storage);assert.deepEqual(readActivity(storage),[]);
});
test('owner pagination uses only fixed public endpoint',async()=>{
 const r=await listOwnerPage('Niko',2,{fetchImpl:async url=>{assert.equal(url,'https://api.github.com/users/Niko/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=2');return new Response('[]');}});assert.equal(r.hasNext,false);await assert.rejects(listOwnerPage('../bad',1));
});
