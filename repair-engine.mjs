// Studio Niko V22 — deterministic, review-only repair engine.
import {createHash} from 'node:crypto';
import {inspectSyntax,checkBlobIntegrity} from './deep-audit.mjs';
import {audit,validateFiles} from './code-mode-x.mjs';
import {validateProposal,proposalDigest} from './code-mode-x-publish.mjs';
const MAX=120000;
const bytes=s=>Buffer.byteLength(s,'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
const ws=c=>c===' '||c==='\t'||c==='\n'||c==='\r';
function containsSecret(content){return audit([{name:'source.md',content}]).findings.some(f=>f.code==='POSSIBLE_SECRET');}
export function repairJson(content){
 if(typeof content!=='string'||bytes(content)>MAX)throw Error('Repair size limit');
 if(containsSecret(content))return {status:'blocked_secret'};
 if(inspectSyntax('file.json',content).status==='valid')return {status:'already_valid'};
 const edits=[];
 let inString=false,escaped=false,previous='';
 for(let i=0;i<content.length;i++){
  const c=content[i];
  if(i===0&&c==='\uFEFF'){edits.push({offset:i,rule:'JSON_BOM'});continue;}
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"'){inString=false;previous='"';}continue;}
  if(c==='"'){inString=true;continue;}
  if(ws(c))continue;
  if(c===','){
   let j=i+1;while(ws(content[j]))j++;
   if((content[j]===']'||content[j]==='}')&&previous&& !['[','{',',',':'].includes(previous))edits.push({offset:i,rule:'JSON_TRAILING_COMMA'});
  }
  previous=c;
 }
 if(!edits.length||edits.length>100)return {status:'manual_review'};
 const offsets=new Set(edits.map(e=>e.offset));
 // Remove exactly the proposed characters, never rewrite the data or formatting.
 let candidate='',start=0;
 for(const offset of offsets){candidate+=content.slice(start,offset);start=offset+1;}
 candidate+=content.slice(start);
 if(inspectSyntax('file.json',candidate).status!=='valid'||containsSecret(candidate))return {status:'manual_review'};
 return {status:'repair_candidate',content:candidate,edits,proof:{before:'invalid',after:'valid',beforeSha256:digest(content),afterSha256:digest(candidate),removedCharacters:edits.length,semanticIntentVerified:false,functionalTests:false}};
}
export function prepareRepair({repo,branch,commit,files}={}){
 if(!Array.isArray(files)||files.length<1||files.length>3)throw Error('Select 1–3 files');
 const reports=[],changes=[],seen=new Set();
 for(const f of files){
  if(!f||typeof f.path!=='string'||typeof f.content!=='string'||typeof f.sha!=='string'||!(/^[a-f0-9]{40}$/).test(f.sha)||seen.has(f.path.toLowerCase()))throw Error('Invalid file');
  seen.add(f.path.toLowerCase());
  if(bytes(f.content)>MAX){reports.push({path:f.path,status:'size_limit'});continue;}
  if(!checkBlobIntegrity(Buffer.from(f.content,'utf8'),f.sha))throw Error('Blob integrity mismatch');
  if(containsSecret(f.content)){reports.push({path:f.path,status:'blocked_secret'});continue;}
  if(!f.path.toLowerCase().endsWith('.json')){reports.push({path:f.path,status:'manual_review',reason:'no_deterministic_rule'});continue;}
  const r=repairJson(f.content);
  if(r.status!=='repair_candidate'){reports.push({path:f.path,status:r.status});continue;}
  const change={path:f.path,expectedBlob:f.sha,content:r.content};
  const single={format:'code-mode-x-github-proposal-v1',status:'review_required',repo,branch,commit,changes:[change]};
  try{validateProposal(single);}catch{reports.push({path:f.path,status:'publication_policy_blocked'});continue;}
  changes.push(change);reports.push({path:f.path,status:r.status,edits:r.edits,proof:r.proof});
 }
 if(!changes.length)return {status:'no_proposal',reports,testsExecuted:false};
 const proposal={format:'code-mode-x-github-proposal-v1',status:'review_required',repo,branch,commit,changes,testsExecuted:false};
 validateProposal(proposal);
 return {status:'review_required',reports,proposal,approvalDigest:proposalDigest(proposal),testsExecuted:false};
}
