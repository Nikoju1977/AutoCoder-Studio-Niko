// Explicit historical reconciliation, scoped to exact source versions.
import {makeIssue,upsertIssues,moveIssue,validateLedger} from './maintenance-ledger.mjs';
const repo='Nikoju1977/Wan2GP',commit='a02526122d204caa1efcf7ac76d7075fc7224c0b';
const kernel='models/longcat/modules/block_sparse_attention/flash_attn_bsa_varlen_mask.py';
const fragment='shared/gradio/ui_scripts.js';
const url='https://github.com/Nikoju1977/AutoCoder-Studio-Niko/actions/runs/45522322331';
const correctedCommit='78fbfba2287bd7057513f3417b988820997d98e4',correctedBlob='a5cb821d935ee687d692c24af036ef11a3341824';
export const records=[
 {repo,commit,path:kernel,blob:'64171c7e4c96416f14e184122c955605ae070a55',code:'SYNTAX_INVALID',confirmation:'parser_rejected',note:'Original parser rejection; exact six-line indentation repair compiled in CI'},
 {repo,commit,path:fragment,blob:'8035d5f06ecfe6f949f14fedd132f363a7a6f996',code:'SYNTAX_INVALID',confirmation:'parser_rejected',note:'Original standalone parser rejection; host context reviewed'}
];
export const gpuFollowup={repo,commit:correctedCommit,path:kernel,blob:correctedBlob,code:'COVERAGE_LIMIT',confirmation:'coverage',note:'Parser and compile checks passed; CUDA kernel execution and numerical equivalence remain untested. Draft PR 4, not merged.'};
export function reconcileWan(l){
 validateLedger(l);
 const ids=records.map(r=>makeIssue(r).id),follow=makeIssue(gpuFollowup).id;
 // Never steal a live reservation or rewrite a terminal operator decision.
 const missing=[...records,gpuFollowup].filter(r=>!l.issues.some(t=>t.id===makeIssue(r).id));
 let next=missing.length?upsertIssues(l,missing):l;
 const lookup=id=>next.issues.find(t=>t.id===id);
 const k=lookup(ids[0]),f=lookup(ids[1]);
 const proof={kind:'parser_recheck',result:'confirmed',url,correctedCommit,note:'Original invalid; six indentation-only changes compile. GPU execution, numerical equivalence and production unverified.'};
 if(k.state==='queued'){next=moveIssue(next,k.id,'running');next=moveIssue(next,k.id,'review_required');next=moveIssue(next,k.id,'evidence_recorded',{proof});}
 else if(k.state==='review_required'){next=moveIssue(next,k.id,'evidence_recorded',{proof});}
 if(f.state==='queued'||f.state==='review_required'||f.state==='blocked'){
  next=moveIssue(next,f.id,'cancelled',{proof:{kind:'parser_recheck',result:'confirmed',url,note:'Intentional fragment: wgp.py appends the closing brace after module assembly. Closure-only expression parses; full assembly untested. No source change.'}});
 }
 if(!lookup(follow))throw Error('Missing follow-up');
 return validateLedger(next);
}
