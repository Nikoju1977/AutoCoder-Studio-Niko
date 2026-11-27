// Studio Niko Design — Code Mode Pro V12. Node-only, explicit draft PR publication.
import {createHash,randomUUID} from 'node:crypto';
import {audit,validateFiles} from './code-mode-x.mjs';
import {parseRepo} from './code-mode-x-github.mjs';
const SHA=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const safePath=p=>typeof p==='string'&&p.length<=300&&/^[A-Za-z0-9_./-]+$/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..'||s.startsWith('.'))&&!/(^|\/)(?:node_modules|vendor|dist|build|coverage|credentials[^/]*|secrets?[^/]*)(\/|$)/i.test(p)&&!/(^|\/)(?:package(?:-lock)?\.json|vercel\.json|manifest\.webmanifest|AGENTS\.md|CODEOWNERS)$/i.test(p)&&/\.(?:py|html|css|js|mjs|cjs|md|json)$/i.test(p);
const validBranch=b=>typeof b==='string'&&b.length<=150&&/^[A-Za-z0-9_./-]+$/.test(b)&&!b.includes('..')&&!b.includes('//')&&!b.startsWith('/')&&!b.endsWith('/')&&!b.split('/').some(s=>s.startsWith('.')||s.endsWith('.lock'));
export function validateProposal(raw){
 if(!raw||raw.format!=='code-mode-x-github-proposal-v1'||raw.status!=='review_required'||!SHA.test(raw.commit)||!validBranch(raw.branch)||!Array.isArray(raw.changes)||!raw.changes.length||raw.changes.length>12)throw Error('Proposition invalide ou ancienne : exporter à nouveau depuis V12');
 const repo=parseRepo(raw.repo);if(repo.split('/')[0].toLowerCase()!=='nikoju1977')throw Error('Dépôt hors périmètre Studio Niko');
 const seen=new Set(),changes=[];
 for(const f of raw.changes){
  if(!f||!safePath(f.path)||!SHA.test(f.expectedBlob)||typeof f.content!=='string'||seen.has(f.path.toLowerCase()))throw Error('Chemin, blob ou fichier interdit');
  seen.add(f.path.toLowerCase());changes.push({path:f.path,expectedBlob:f.expectedBlob,content:f.content});
 }
 const files=changes.map((f,i)=>({name:'file-'+i+'.'+(f.path.toLowerCase().endsWith('.json')?'json':'md'),content:f.content}));
 validateFiles(files);if(!audit(files).passed)throw Error('Audit statique refusé');
 if(Buffer.byteLength(JSON.stringify(changes))>350000)throw Error('Proposition trop volumineuse');
 return {repo,branch:raw.branch,commit:raw.commit,changes};
}
export function proposalDigest(p){return createHash('sha256').update(JSON.stringify(validateProposal(p))).digest('hex');}
export function createGitHubClient({token,fetchImpl=globalThis.fetch}={}){
 if(typeof token!=='string'||token.length<20)throw Error('Jeton GitHub local requis');
 return async(method,path,body)=>{
  if(!path.startsWith('/repos/')||path.includes('..'))throw Error('Route GitHub invalide');
  const response=await fetchImpl('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'Content-Type':'application/json','User-Agent':'Studio-Niko-Code-Mode-Pro'},redirect:'error',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('GitHub HTTP '+response.status+' ('+method+')');
  return response.json();
 };
}
export async function inspectProposal(raw,request){
 const p=validateProposal(raw),base='/repos/'+p.repo;
 const info=await request('GET',base);
 if(info?.private!==false||info?.archived||info?.full_name?.toLowerCase()!==p.repo.toLowerCase())throw Error('Dépôt non public, archivé ou différent');
 const head=await request('GET',base+'/git/ref/heads/'+p.branch.split('/').map(encodeURIComponent).join('/'));
 if(head?.object?.sha!==p.commit)throw Error('La branche a avancé : réexaminer la proposition');
 const commit=await request('GET',base+'/git/commits/'+p.commit);
 if(!SHA.test(commit?.tree?.sha))throw Error('Arbre Git invalide');
 const tree=await request('GET',base+'/git/trees/'+commit.tree.sha+'?recursive=1');
 if(tree?.truncated||!Array.isArray(tree?.tree))throw Error('Arborescence incomplète');
 const entries=p.changes.map(f=>{
  const entry=tree.tree.find(t=>t.path===f.path);
  if(!entry||entry.type!=='blob'||!['100644','100755'].includes(entry.mode)||entry.sha!==f.expectedBlob)throw Error('Fichier modifié ou non régulier : '+f.path);
  return {path:f.path,mode:entry.mode,type:'blob',content:f.content};
 });
 return {p,base,tree:commit.tree.sha,entries,digest:proposalDigest(raw)};
}
export async function publishDraft(raw,{request,approval,uuid=randomUUID,regressionEvidence}={}){
 const inspected=await inspectProposal(raw,request);
 const {p,base,tree,entries,digest}=inspected;
 if(approval!==digest)throw Error('Approbation SHA-256 exacte obligatoire');
 const tested=regressionEvidence?.status==='fixture_improved'&&regressionEvidence.testsExecuted===true&&
  regressionEvidence.before?.status==='failed'&&regressionEvidence.after?.status==='passed'&&
  regressionEvidence.manifest?.proposalDigest===digest&&
  SHA256.test(regressionEvidence.manifest?.harnessSha256??'')&&/^sha256:[a-f0-9]{64}$/.test(regressionEvidence.manifest?.image??'');
 if(regressionEvidence&&!tested)throw Error('Preuve de régression incompatible');
 const validation=tested
  ? 'Scénario Docker local : échec avant, réussite après. SHA-256 du scénario : '+regressionEvidence.manifest.harnessSha256+
    '. Image : '+regressionEvidence.manifest.image+'. Validation limitée à ce scénario.'
  : 'Tests du code proposé non exécutés par Code Mode Pro.';
 const suffix=uuid();if(typeof suffix!=='string'||!/^[a-f0-9-]{8,50}$/i.test(suffix))throw Error('Identifiant de branche invalide');
 const branch='maintenance/cmx-'+p.commit.slice(0,8)+'-'+suffix;
 const newTree=await request('POST',base+'/git/trees',{base_tree:tree,tree:entries});
 if(!SHA.test(newTree?.sha))throw Error('Arbre créé invalide');
 const newCommit=await request('POST',base+'/git/commits',{message:'fix: reviewed Code Mode Pro proposal',tree:newTree.sha,parents:[p.commit]});
 if(!SHA.test(newCommit?.sha))throw Error('Commit créé invalide');
 const head=await request('GET',base+'/git/ref/heads/'+p.branch.split('/').map(encodeURIComponent).join('/'));
 if(head?.object?.sha!==p.commit)throw Error('Branche source modifiée pendant la préparation');
 await request('POST',base+'/git/refs',{ref:'refs/heads/'+branch,sha:newCommit.sha});
 try{
  const pr=await request('POST',base+'/pulls',{title:'Code Mode Pro — proposition à vérifier',head:branch,base:p.branch,draft:true,body:'Proposition approuvée pour revue. Commit source : '+p.commit+'. SHA-256 : '+digest+'. '+validation+' Vérifier les changements et les contrôles CI avant fusion.'});
  return {status:'draft_created',branch,commit:newCommit.sha,prNumber:pr.number,url:pr.html_url,testsExecuted:tested};
 }catch{return {status:'branch_created_pr_unconfirmed',branch,commit:newCommit.sha,testsExecuted:tested};}
}
