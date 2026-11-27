// Conservative local repair candidate. No repository write or publication.
import {snapshots,auditVisual,compareMetrics} from './ui-visual.mjs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const patchFor=size=>'\n/* Niko UI candidate: native button minimum size */\nbutton:not(:disabled){min-inline-size:'+size+'px;min-block-size:'+size+'px}\n';
export function proposeSizeRepair(bundle,report,size=24){
 if(![24,44].includes(size))throw Error('Taille non autorisée');
 const PATCH=patchFor(size);
 const {after}=snapshots(bundle);
 const styles=[...after.keys()].filter(p=>/\.css$/i.test(p));
 if(styles.length!==1||!report?.results?.some(x=>x.after.smallButtons>0))return null;
 const path=styles[0],content=after.get(path);
 if(content.includes(PATCH)||content.length+PATCH.length>120000)return null;
 const old=bundle.proposal.changes.find(x=>x.path===path);
 if(!old||!/^[a-f0-9]{40}$/.test(old.expectedBlob||''))return null;
 return {...bundle,proposal:{...bundle.proposal,changes:bundle.proposal.changes.map(x=>x.path===path?{...x,content:content+PATCH}:x),testsExecuted:false,publicationAuthorized:false}};
}
export function repairImproved(initial,next){
 if(!initial.axeComplete||!next.axeComplete||initial.results.length!==next.results.length||!initial.results.length)return false;
 return next.results.every((x,i)=>x.viewport.width===initial.results[i].viewport.width&&x.regressions.length===0&&compareMetrics(initial.results[i].after,x.after).length===0&&x.after.smallButtons<=initial.results[i].after.smallButtons)&&next.results.some((x,i)=>x.after.smallButtons<initial.results[i].after.smallButtons);
}
export async function repairVisual(bundle,out){
 const initial=await auditVisual(bundle,join(out,'initial'));
 if(!initial.axeComplete)return {status:'audit_incomplete',publicationAuthorized:false};
 const attempts=[];
 for(const size of [24,44]){
  const candidate=proposeSizeRepair(bundle,initial,size);
  if(!candidate)continue;
  const next=await auditVisual(candidate,join(out,'repair-'+size));
  const accepted=repairImproved(initial,next);
  attempts.push({size,accepted});
  if(accepted){
   await writeFile(join(out,'repair-candidate.json'),JSON.stringify(candidate,null,2));
   return {status:'review_required',attempts,publicationAuthorized:false};
  }
 }
 return {status:attempts.length?'rejected':'no_candidate',attempts,publicationAuthorized:false};
}
