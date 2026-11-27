import test from 'node:test';import assert from 'node:assert/strict';
import {validateManifest,compare,fetchDigest,audit} from '../scripts/static-pages-proof.mjs';
const m={version:1,targets:[{repo:'oracle-du-jardinier',commit:'a'.repeat(40),pagesRun:1,files:['index.html']}]};
test('allowlist and exact commit only',()=>{assert.equal(validateManifest(m),m);for(const patch of [{repo:'other'},{commit:'main'},{files:['../index.html']},{files:['index.html','index.html']}])assert.throws(()=>validateManifest({version:1,targets:[{...m.targets[0],...patch}]}));});
test('bytes matched, mismatched and unavailable are distinct',async()=>{const a=await fetchDigest('https://example.invalid',async()=>new Response('same')),b=await fetchDigest('https://example.invalid',async()=>new Response('different'));assert.equal(compare(a,a).status,'match');assert.equal(compare(a,b).status,'mismatch');assert.equal(compare(a,{ok:false,status:404}).status,'unavailable');assert.equal((await fetchDigest('https://example.invalid',async()=>new Response(new Uint8Array(2*1024*1024+1)))).error,'size-limit');});
test('audit uses immutable source and exact public URL',async()=>{const urls=[];const r=await audit(m,async url=>{urls.push(url);return {ok:true,status:200,bytes:4,sha256:'a'.repeat(64)}});assert.equal(r.rows[0].status,'match');assert.equal(r.productionRuntimeVerified,false);assert.deepEqual(urls,['https://raw.githubusercontent.com/Nikoju1977/oracle-du-jardinier/'+m.targets[0].commit+'/index.html','https://nikoju1977.github.io/oracle-du-jardinier/index.html']);});

test('expanded manifest covers four static sites and twelve files',async()=>{const {readFileSync}=await import('node:fs');const m=JSON.parse(readFileSync(new URL('./static-pages-targets.json',import.meta.url),'utf8'));assert.equal(validateManifest(m).targets.length,4);assert.equal(m.targets.reduce((n,t)=>n+t.files.length,0),12);const report=await audit(m,async()=>({ok:true,status:200,bytes:1,sha256:'b'.repeat(64)}));assert.equal(report.rows.length,12);assert.equal(report.rows.filter(r=>r.repo==='Neural-Art-mars-2026').length,3);assert.equal(report.rows.filter(r=>r.repo==='ia-studio-cine').length,2);});

test('byte proof can omit unconfirmed Pages attribution', async () => {
 const candidate={version:1,targets:[{...m.targets[0],pagesRun:null}]};
 const report=await audit(candidate,async()=>({ok:true,status:200,bytes:1,sha256:'a'.repeat(64)}));
 assert.equal(report.rows[0].pagesRun,null);
 assert.equal(report.rows[0].status,'match');
});
