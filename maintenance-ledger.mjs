// V24 persistent maintenance ledger: metadata only; no execution or publication.
import {createHash} from 'node:crypto';
import {parseRepo} from './code-mode-x-github.mjs';
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-f0-9]{64}$/;
const secret=/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/;
const states=['queued','running','blocked','review_required','evidence_recorded','cancelled'];
const transitions={queued:['running','cancelled'],running:['blocked','review_required','queued','cancelled'],blocked:['queued','cancelled'],review_required:['evidence_recorded','queued','cancelled'],evidence_recorded:[],cancelled:[]};
const codes=new Set(['SYNTAX_INVALID','JSON_INVALID','POSSIBLE_SECRET','DYNAMIC_EXECUTION','REVIEW_HTML_SINK','RELATIVE_REFERENCE_UNRESOLVED','FUNCTIONAL_REGRESSION','COVERAGE_LIMIT','READ_FAILED']);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function clean(s,max){if(typeof s!=='string'||!s.length||s.length>max||secret.test(s)||/[\x00-\x1f\x7f]/.test(s))throw Error('Invalid metadata');return s;}
function ownerRepo(s){const r=parseRepo(s);if(r.split('/')[0].toLowerCase()!=='nikoju1977')throw Error('Outside scope');return r;}
function pathOf(s){clean(s,300);if(s.startsWith('/')||s.includes('\\')||s.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid path');return s;}
function evidence(e){
 if(!e||!['parser_recheck','fixture_comparison','operator_note','audit_report'].includes(e.kind)||!['confirmed','reported','inconclusive'].includes(e.result)||typeof e.url!=='string'||!/^https:\/\/github\.com\/Nikoju1977\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+(?:\/artifacts\/\d+)?$/.test(e.url))throw Error('Invalid evidence reference');
 return {kind:e.kind,result:e.result,url:e.url,note:clean(e.note,400),...(e.correctedCommit&&SHA.test(e.correctedCommit)?{correctedCommit:e.correctedCommit}:{})};
}
export function makeIssue(raw){
 const repo=ownerRepo(raw.repo),path=pathOf(raw.path),commit=raw.commit,blob=raw.blob??null;
 if(!SHA.test(commit)||!(blob===null||SHA.test(blob))||!codes.has(raw.code)||!['parser_rejected','heuristic_only','operator_review','fixture_improved','coverage'].includes(raw.confirmation))throw Error('Invalid issue');
 const priority=raw.code==='POSSIBLE_SECRET'?0:['SYNTAX_INVALID','JSON_INVALID','FUNCTIONAL_REGRESSION'].includes(raw.code)?1:raw.code==='COVERAGE_LIMIT'?3:2;
 return {id:hash([repo.toLowerCase(),commit,path,blob,raw.code]),repo,commit,path,blob,code:raw.code,confirmation:raw.confirmation,priority,state:'queued',attempts:0,note:clean(raw.note||raw.code,400),evidence:[],history:[]};
}
export function newLedger(){return {version:24,revision:0,issues:[]};}
export function validateLedger(l){
 if(l?.version!==24||!Number.isSafeInteger(l.revision)||l.revision<0||!Array.isArray(l.issues)||l.issues.length>15000)throw Error('Invalid ledger');
 const ids=new Set();
 for(const t of l.issues){
  const canonical=makeIssue(t);
  if(t.id!==canonical.id||t.priority!==canonical.priority||ids.has(t.id)||!states.includes(t.state)||!Number.isInteger(t.attempts)||t.attempts<0||t.attempts>100||!Array.isArray(t.evidence)||t.evidence.length>12||!Array.isArray(t.history)||t.history.length>100)throw Error('Invalid issue state');
  ids.add(t.id);t.evidence.forEach(evidence);
  for(const h of t.history){if(!states.includes(h.from)||!states.includes(h.to)||!transitions[h.from].includes(h.to)||typeof h.at!=='string'||!Number.isFinite(Date.parse(h.at)))throw Error('Invalid history');}
  if(t.state==='evidence_recorded'&&!t.evidence.length)throw Error('Missing evidence');
 }
 return l;
}
export function upsertIssues(l,raws){
 validateLedger(l);if(!Array.isArray(raws)||raws.length>15000)throw Error('Invalid import');
 const map=new Map(l.issues.map(t=>[t.id,t]));
 for(const raw of raws){const t=makeIssue(raw);if(!map.has(t.id))map.set(t.id,t);}
 return validateLedger({...l,revision:l.revision+1,issues:[...map.values()]});
}
export function importFleet(l,report,url){
 if(!Array.isArray(report?.rows)||report.rows.length>100)throw Error('Invalid fleet report');
 const raws=[];
 for(const r of report.rows){
  if(!r.commit||!Array.isArray(r.files))continue;
  for(const f of r.files){
   if(!Array.isArray(f.findings))continue;
   for(const x of f.findings){
    if(!codes.has(x.code))continue;
    raws.push({repo:r.repo,commit:r.commit,path:f.path,blob:f.sha,code:x.code,confirmation:x.confirmation==='parser_rejected'?'parser_rejected':'heuristic_only',note:'Imported audit finding; verify context'});
   }
  }
 }
 let next=upsertIssues(l,raws);
 const imported=new Set(raws.map(r=>makeIssue(r).id));
 const ref=evidence({kind:'audit_report',result:'reported',url,note:'Imported local report; URL not independently authenticated'});
 next={...next,issues:next.issues.map(t=>imported.has(t.id)&&!t.evidence.some(e=>e.url===url)&&t.evidence.length<12?{...t,evidence:[...t.evidence,ref]}:t)};
 return validateLedger(next);
}
export function moveIssue(l,id,state,{proof,at=new Date().toISOString()}={}){
 validateLedger(l);const t=l.issues.find(x=>x.id===id);
 if(!ID.test(id)||!t||!transitions[t.state].includes(state)||!Number.isFinite(Date.parse(at)))throw Error('Invalid transition');
 if(state==='evidence_recorded'&&!proof)throw Error('Evidence required');
 const ev=proof?evidence(proof):null;
 const next={...t,state,attempts:t.attempts+(state==='running'?1:0),history:[...t.history,{from:t.state,to:state,at}],evidence:ev?[...t.evidence,ev]:t.evidence};
 return validateLedger({...l,revision:l.revision+1,issues:l.issues.map(x=>x.id===id?next:x)});
}
export function resumeInterrupted(l,at=new Date().toISOString()){
 validateLedger(l);return l.issues.filter(t=>t.state==='running').reduce((a,t)=>moveIssue(a,t.id,'queued',{at}),l);
}
export function nextIssues(l,limit=3){validateLedger(l);if(!Number.isInteger(limit)||limit<1||limit>3)throw Error('Batch limit');return l.issues.filter(t=>t.state==='queued').sort((a,b)=>a.priority-b.priority||a.repo.localeCompare(b.repo)||a.path.localeCompare(b.path)||a.id.localeCompare(b.id)).slice(0,limit);}
export function summary(l){validateLedger(l);return {revision:l.revision,total:l.issues.length,states:l.issues.reduce((m,t)=>(m[t.state]=(m[t.state]||0)+1,m),{}),next:nextIssues(l).map(({id,repo,path,commit,code,priority})=>({id,repo,path,commit,code,priority})),productionVerified:false};}
