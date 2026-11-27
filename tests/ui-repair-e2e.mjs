import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repairVisual} from '../ui-repair.mjs';
import {auditVisual} from '../ui-visual.mjs';
const original=[{path:'index.html',content:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><button>Go</button><p>Texte test</p>'},{path:'style.css',content:'body{background:#fff;color:#111}button{width:20px;height:20px;padding:0;border:0}'}];
const bundle={format:'niko-ui-visual-v1',original,proposal:{changes:[{path:'style.css',expectedBlob:'a'.repeat(40),content:original[1].content+'p{margin:8px}'}]}};
const out=await mkdtemp(join(tmpdir(),'niko-v3-'));
try{
 const r=await repairVisual(bundle,out);assert.equal(r.status,'review_required',JSON.stringify(r));
 const c=JSON.parse(await readFile(join(out,'repair-candidate.json'),'utf8'));assert.match(c.proposal.changes[0].content,/min-inline-size:24px/);assert.equal(c.proposal.publicationAuthorized,false);
 const contrast=await auditVisual({...bundle,proposal:{changes:[{path:'style.css',content:'body{background:#fff;color:#eee}button{width:20px;height:20px;padding:0;border:0}'}]}},join(out,'contrast'));
 assert.ok(contrast.results.every(x=>x.after.lowContrast>x.before.lowContrast),JSON.stringify(contrast));
 console.log('PASS V3: measured size repair, low-contrast detection, review gate');
}finally{await rm(out,{recursive:true,force:true});}
