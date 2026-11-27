import {readFile,mkdtemp,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditVisual} from '../ui-visual.mjs';
const path=process.argv[2];if(!path||(await stat(path)).size>500000)throw Error('Usage: npm run ui:compare -- dossier.json');
const bundle=JSON.parse(await readFile(path,'utf8'));
if(bundle.format!=='niko-ui-compare-v1'||!bundle.variants?.A||!bundle.variants?.B)throw Error('Format comparatif invalide');
const {A,B}=bundle.variants;
if(JSON.stringify(A.original)!==JSON.stringify(B.original)||A.proposal?.commit!==B.proposal?.commit||A.proposal?.repo!==B.proposal?.repo)throw Error('Baselines incompatibles');
const out=await mkdtemp(join(tmpdir(),'niko-ui-compare-'));
const results={};
for(const [v,b] of Object.entries({A,B})){const r=await auditVisual(b,join(out,v));results[v]={status:r.status,axeComplete:r.axeComplete,regressions:r.results.flatMap(x=>x.regressions),changedFractions:r.results.map(x=>x.pixels.changedFraction)};}
const report={out,results,publicationAuthorized:false,selection:'manual_review_required'};
await writeFile(join(out,'comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(Object.values(results).some(r=>!r.axeComplete||r.regressions.length))process.exitCode=1;
