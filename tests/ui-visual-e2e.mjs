import assert from 'node:assert/strict';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditVisual,snapshots} from '../ui-visual.mjs';
const original=[{path:'index.html',content:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><button>Play</button><p class="probe">Visible probe</p><script>document.body.innerHTML="bad"</script>'},{path:'style.css',content:'button{min-width:44px;min-height:44px}'}];
const bundle={format:'niko-ui-visual-v1',original,proposal:{changes:[{path:'style.css',content:'button{display:none}.probe{width:1800px;height:20px}'}]}};
assert.throws(()=>snapshots({...bundle,original:[{path:'../index.html',content:'bad'}]}));
const out=await mkdtemp(join(tmpdir(),'niko-visual-test-'));
try{
 const r=await auditVisual(bundle,out);
 assert.equal(r.status,'regression_detected');
 assert.equal(r.results.length,3);
 for(const x of r.results){assert.equal(x.before.visibleControls,1);assert.equal(x.after.visibleControls,0);assert.ok(x.regressions.includes('Débordement horizontal accru'),JSON.stringify(x));assert.ok(x.regressions.includes('Nombre de commandes visibles réduit'));for(const p of Object.values(x.screenshots))assert.ok((await stat(join(out,p))).size>100);}
 assert.equal(r.publicationAuthorized,false);assert.equal(r.fullApplicationTested,false);
 console.log('PASS isolated Chromium screenshot and regression proof');
}finally{await rm(out,{recursive:true,force:true});}
