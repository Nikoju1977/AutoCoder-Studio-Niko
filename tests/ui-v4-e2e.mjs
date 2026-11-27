import assert from 'node:assert/strict';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditVisual} from '../ui-visual.mjs';
const html='<!doctype html><html lang="fr"><head><title>Test</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><main><h1>Test</h1><button>Lire</button></main><script>document.body.innerHTML="bad"</script></body></html>';
const css='body{background:#fff;color:#111}button{width:80px;height:44px}';
const original=[{path:'index.html',content:html},{path:'style.css',content:css}];
const bundle={format:'niko-ui-visual-v1',original,proposal:{changes:[{path:'index.html',content:html.replace('>Lire</button>','></button>')},{path:'style.css',content:css+'body{background:#b3d5ff}'}]}};
const out=await mkdtemp(join(tmpdir(),'niko-v4-'));
try{
 const r=await auditVisual(bundle,out);
 assert.equal(r.axeComplete,true,JSON.stringify(r));
 for(const x of r.results){
  assert.ok(x.pixels.changedPixels>0);assert.ok(x.pixels.changedFraction<=1);
  assert.ok((await stat(join(out,x.screenshots.diff))).size>100);
  assert.ok(x.after.axe.violations.some(v=>v.id==='button-name'),JSON.stringify(x.after.axe));
  assert.ok(x.regressions.includes('axe-core : button-name'));
 }
 assert.equal(r.accessibilityCertified,false);assert.equal(r.publicationAuthorized,false);
 console.log('PASS V4 pixel difference and axe-core regression evidence');
}finally{await rm(out,{recursive:true,force:true});}
