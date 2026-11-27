// Conservative local repair candidate. No repository write or publication.
import {snapshots,auditVisual,compareMetrics} from './ui-visual.mjs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const PATCH='\n/* Niko UI candidate: native button minimum size */\nbutton:not(:disabled){min-inline-size:24px;min-block-size:24px}\n';
export function proposeSizeRepair(bundle,report){
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
 if(initial.results.length!==next.results.length||!initial.results.length)return false;
 return next.results.every((x,i)=>x.viewport.width===initial.results[i].viewport.width&&x.regressions.length===0&&compareMetrics(initial.results[i].after,x.after).length===0&&x.after.smallButtons<=initial.results[i].after.smallButtons)&&next.results.some((x,i)=>x.after.smallButtons<initial.results[i].after.smallButtons);
}
export async function repairVisual(bundle,out){
 const initial=await auditVisual(bundle,join(out,'initial'));
 const candidate=proposeSizeRepair(bundle,initial);
 if(!candidate)return {status:'no_candidate',publicationAuthorized:false};
 const next=await auditVisual(candidate,join(out,'repair'));
 if(!repairImproved(initial,next))return {status:'rejected',publicationAuthorized:false};
 await writeFile(join(out,'repair-candidate.json'),JSON.stringify(candidate,null,2));
 return {status:'review_required',publicationAuthorized:false};
}
