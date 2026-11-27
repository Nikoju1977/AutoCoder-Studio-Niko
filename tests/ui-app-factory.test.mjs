import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationTemplate} from '../ui-builder.mjs';
import {generateLayout,pwaFiles,zipFiles} from '../ui-app-factory.mjs';
test('AI requires consent and accepts only constrained JSON',async()=>{
 let calls=0;const d={...applicationTemplate('tasks'),theme:'audio'};
 const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'/api/generate');assert.equal(JSON.parse(options.body).provider,'agnes');return {ok:true,json:async()=>({files:[{name:'layout.json',content:JSON.stringify(d)}]})};};
 await assert.rejects(generateLayout('test',{fetchImpl}));assert.equal(calls,0);
 assert.equal((await generateLayout('liste',{approved:true,fetchImpl})).items.length,4);assert.equal(calls,1);
 await assert.rejects(generateLayout('test',{approved:true,fetchImpl:async()=>({ok:true,json:async()=>({files:[{name:'app.js',content:'evil'}]})})}));
});
test('PWA bundle includes manifest, service worker and optional persistent runtime',async()=>{
 const files=pwaFiles(applicationTemplate('tasks'),{persistent:true});
 assert.equal(Object.keys(files).length,6);assert.match(files['app.js'],/indexedDB\.open/);assert.match(files['index.html'],/manifest-src 'self'/);
 assert.equal(JSON.parse(files['manifest.webmanifest']).start_url,'./index.html');
 const b=new Uint8Array(await zipFiles(files).arrayBuffer());assert.equal(new DataView(b.buffer).getUint32(0,true),0x04034b50);assert.equal(new DataView(b.buffer).getUint32(b.length-22,true),0x06054b50);
 assert.throws(()=>zipFiles({'../bad':'x'}));
});
