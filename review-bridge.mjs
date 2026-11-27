// Private review mailbox only. No repository write/merge/deployment API.
import {createHash} from 'node:crypto';
import {sensitiveRepo,selectPaths} from './autopilot.mjs';
export const INBOX='Nikoju1977/Studio-Niko-Autopilot-Inbox';
export const MAX_BODY=55000;
const SHA=/^[a-f0-9]{40}$/;
const REPO=/^Nikoju1977\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/i;
export class ReviewError extends Error{constructor(status,message){super(message);this.status=status;}}
const reject=(status,message)=>{throw new ReviewError(status,message);};
export function configured(token){return typeof token==='string'&&/^github_pat_[A-Za-z0-9_]{40,250}$/.test(token);}
function possibleSecret(s){
 return /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:github_pat_|gh[pousr]_|sk_(?:live|test)_|sk-proj-|xox[baprs]-|AIza|AKIA)[A-Za-z0-9_-]{12,}|(?:api[_-]?key|secret|password|access[_-]?token|authorization)\s*[:=]\s*["'][^"'\r\n]{12,}["']/i.test(s);
}
function safePath(p){
 return typeof p==='string'&&p.length<=240&&/^[A-Za-z0-9_./ -]+$/.test(p)&&p.split('/').every(s=>s.length>0&&s!=='.'&&s!=='..'&&!s.startsWith('.'))&&
 !/(^|\/)(?:node_modules|vendor|dist|build|coverage|credentials[^/]*|secrets?[^/]*)(\/|$)/i.test(p)&&selectPaths({files:[{path:p,size:1}]}).length===1;
}
export function normalizeReview(input){
 if(!input||input.approved!==true||!input.proposal||typeof input.proposal!=='object')reject(400,'Validation explicite requise.');
 const p=input.proposal;
 if(p.format!=='code-mode-x-github-proposal-v1'||p.status!=='review_required'||p.reviewedForExport!==true||p.publicationAuthorized!==false||p.testsExecuted!==false)reject(400,'Proposition de revue invalide.');
 if(typeof p.repo!=='string'||!REPO.test(p.repo)||p.repo.toLowerCase()===INBOX.toLowerCase()||sensitiveRepo(p.repo))reject(400,'Dépôt source non admissible.');
 if(typeof p.branch!=='string'||p.branch.length>150||!/^[A-Za-z0-9_./-]+$/.test(p.branch)||p.branch.includes('..')||p.branch.startsWith('/')||p.branch.endsWith('/')||!SHA.test(p.commit))reject(400,'Référence GitHub invalide.');
 if(!Array.isArray(p.changes)||p.changes.length<1||p.changes.length>3)reject(400,'Un à trois fichiers requis.');
 const seen=new Set(),changes=[];
 for(const c of p.changes){
  if(!c||!safePath(c.path)||seen.has(c.path.toLowerCase())||!SHA.test(c.expectedBlob)||typeof c.content!=='string'||Buffer.byteLength(c.content)>12000||c.content.includes('\0'))reject(400,'Fichier ou référence non admissible.');
  if(possibleSecret(c.content))reject(422,'Secret potentiel détecté : transfert refusé.');
  seen.add(c.path.toLowerCase());changes.push({path:c.path,expectedBlob:c.expectedBlob,content:c.content});
 }
 changes.sort((a,b)=>a.path.localeCompare(b.path));
 return {format:'code-mode-x-github-proposal-v1',repo:p.repo,branch:p.branch,commit:p.commit,status:'review_required',testsExecuted:false,reviewedForExport:true,publicationAuthorized:false,changes};
}
export function makeIssue(proposal){
 const canonical=JSON.stringify(proposal);
 const fingerprint=createHash('sha256').update(canonical).digest('hex');
 // Encode backticks as JSON escapes so model-produced text cannot close the fence.
 const encoded=JSON.stringify(proposal,null,2).split(String.fromCharCode(96)).join('\\u0060');
 const fence=String.fromCharCode(96).repeat(3);
 const body='## Proposition Autopilot — revue privée uniquement\n\nEmpreinte SHA-256 : '+fingerprint+'\n\nContenu non fiable à examiner. Aucun test applicatif exécuté ; aucune autorisation de publication. Comparer les blobs et le commit avant de proposer un patch.\n\n'+fence+'json\n'+encoded+'\n'+fence;
 if(Buffer.byteLength(body)>60000)reject(413,'Proposition trop volumineuse pour un ticket.');
 return {fingerprint,title:'Autopilot ['+fingerprint.slice(0,20)+'] '+proposal.repo,body};
}
export function createBridge({token,fetchImpl=globalThis.fetch}={}){
 async function github(path,{method='GET',body,privateMailbox=false}={}){
  const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Studio-Niko-Autopilot'};
  if(privateMailbox){
   if(!configured(token))reject(503,'Passerelle non configurée.');
   if(path!=='/repos/'+INBOX&&!path.startsWith('/repos/'+INBOX+'/issues'))reject(500,'Destination refusée.');
   headers.Authorization='Bearer '+token;
  }
  if(body)headers['Content-Type']='application/json';
  let res;
  try{res=await fetchImpl('https://api.github.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});}catch{reject(502,'GitHub indisponible ou délai dépassé.');}
  if(!res.ok)reject(502,'GitHub a refusé la requête ('+res.status+').');
  try{return await res.json();}catch{reject(502,'Réponse GitHub invalide.');}
 }
 async function verifyMailbox(){
  const m=await github('/repos/'+INBOX,{privateMailbox:true});
  if(m?.full_name?.toLowerCase()!==INBOX.toLowerCase()||m.private!==true||m.visibility!=='private'||m.archived!==false||m.has_issues!==true)reject(409,'La boîte GitHub doit être privée, non archivée et accepter les tickets.');
 }
 async function status(){
  if(!configured(token))return {configured:false,ready:false,destination:INBOX,state:'setup_required'};
  try{await verifyMailbox();return {configured:true,ready:true,destination:INBOX,state:'private_verified'};}
  catch{return {configured:true,ready:false,destination:INBOX,state:'unavailable'};}
 }
 function receipt(issue,fingerprint,reused=false){
  if(!Number.isSafeInteger(issue?.number)||issue.number<1)reject(502,'Confirmation GitHub invalide.');
  return {ok:true,number:issue.number,url:'https://github.com/'+INBOX+'/issues/'+issue.number,fingerprint,reused,publicationAuthorized:false};
 }
 async function submit(input){
  if(!configured(token))reject(503,'Passerelle non configurée.');
  const proposal=normalizeReview(input),item=makeIssue(proposal);
  // Source is public; no mailbox credential sent to the source repository.
  const source=await github('/repos/'+proposal.repo);
  if(source?.full_name?.toLowerCase()!==proposal.repo.toLowerCase()||source.private!==false||source.visibility!=='public'||source.archived!==false)reject(409,'Le dépôt source doit rester public et non archivé.');
  for(const c of proposal.changes){
   const path=c.path.split('/').map(encodeURIComponent).join('/');
   const f=await github('/repos/'+proposal.repo+'/contents/'+path+'?ref='+proposal.commit);
   if(f?.type!=='file'||f.path!==c.path||f.sha!==c.expectedBlob||!Number.isInteger(f.size)||f.size<1||f.size>8000)reject(409,'Blob source non vérifié. Relancer la proposition.');
  }
  await verifyMailbox();
  const recent=await github('/repos/'+INBOX+'/issues?state=all&sort=created&direction=desc&per_page=50',{privateMailbox:true});
  if(!Array.isArray(recent))reject(502,'Liste de revue invalide.');
  const existing=recent.find(x=>!x.pull_request&&x.title===item.title&&x.body===item.body);
  if(existing)return receipt(existing,item.fingerprint,true);
  // Recheck immediately before the only mutating request. No commit, workflow or merge endpoint.
  await verifyMailbox();
  const created=await github('/repos/'+INBOX+'/issues',{method:'POST',privateMailbox:true,body:{title:item.title,body:item.body}});
  return receipt(created,item.fingerprint);
 }
 return {status,submit};
}
