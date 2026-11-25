// Studio Niko Design — read-only public GitHub integration.
import {audit,validateFiles} from './code-mode-x.mjs';
const API='https://api.github.com';
const SHA=/^[a-f0-9]{40}$/;
const safePath=p=>typeof p==='string'&&p.length<=300&&!p.split('/').some(s=>!s||s==='.'||s==='..')&&!/[\\\x00-\x1f\x7f]/.test(p)&&!/(^|\/)(?:\.[^/]+|node_modules|vendor|dist|build|coverage|credentials[^/]*|secrets?[^/]*)(\/|$)/i.test(p);
const extension=p=>p.split('.').pop().toLowerCase();
const supported=p=>safePath(p)&&['py','html','css','js','md','json','mjs','cjs'].includes(extension(p));
export function parseRepo(value){
 const match=/^(?:https:\/\/github\.com\/)?([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(String(value).trim());
 if(!match||['.','..'].includes(match[2]))throw Error('Dépôt attendu : propriétaire/nom');
 return match[1]+'/'+match[2].replace(/\.git$/,'');
}
async function get(path,{fetchImpl=globalThis.fetch,signal}={}){
 const c=new AbortController(),cancel=()=>c.abort();
 if(signal?.aborted)cancel();signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,15000);
 try{
  const r=await fetchImpl(API+path,{headers:{Accept:'application/vnd.github+json'},signal:c.signal,credentials:'omit',redirect:'error',cache:'no-store'});
  if(!r.ok)throw Error('GitHub HTTP '+r.status+(r.status===403||r.status===429?' — quota ou accès limité':''));
  if(!r.body?.getReader){const v=await r.text();if(v.length>4000000)throw Error('Réponse GitHub trop volumineuse');return JSON.parse(v);}
  const reader=r.body.getReader();let size=0;const decoder=new TextDecoder();let text='';
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000){await reader.cancel();throw Error('Réponse GitHub trop volumineuse');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{reader.releaseLock();}
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function listPublicRepo(value,options={}){
 const repo=parseRepo(value),base='/repos/'+repo;
 const info=await get(base,options);
 if(info.private!==false||typeof info.default_branch!=='string')throw Error('Dépôt public uniquement');
 const branch=options.branch===undefined||options.branch===''?info.default_branch:options.branch;
 if(typeof branch!=='string'||branch.length>150||!/^[A-Za-z0-9_.\/-]+$/.test(branch)||branch.includes('..')||branch.startsWith('/')||branch.endsWith('/'))throw Error('Branche invalide');
 const commit=await get(base+'/commits/'+encodeURIComponent(branch),options);
 if(!SHA.test(commit.sha)||!SHA.test(commit.commit?.tree?.sha))throw Error('Version GitHub invalide');
 const tree=await get(base+'/git/trees/'+commit.commit.tree.sha+'?recursive=1',options);
 if(!Array.isArray(tree.tree))throw Error('Arborescence invalide');
 const maxFileBytes=options.maxFileBytes??12000;
 if(!Number.isInteger(maxFileBytes)||maxFileBytes<12000||maxFileBytes>1048576)throw Error('Limite fichier invalide');
 const allowed=p=>supported(p)||(options.deepAudit===true&&safePath(p)&&['ts','tsx','jsx','yaml','yml','toml','sql','sh'].includes(extension(p)));
 const candidates=tree.tree.filter(f=>f.type==='blob'&&['100644','100755'].includes(f.mode)&&SHA.test(f.sha)&&Number.isInteger(f.size)&&f.size>=0&&allowed(f.path));
 const oversized=candidates.filter(f=>f.size>maxFileBytes).length;
 const eligible=tree.tree.filter(f=>f.type==='blob'&&['100644','100755'].includes(f.mode)&&SHA.test(f.sha)&&Number.isInteger(f.size)&&f.size>=0&&f.size<=maxFileBytes&&allowed(f.path));
 const limit=options.inventoryLimit??500;
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Limite inventaire invalide');
 return {repo,commit:commit.sha,branch,total:tree.tree.length,eligibleTotal:eligible.length,oversized,treeTruncated:!!tree.truncated,...(options.deepAudit===true?{allPaths:tree.tree.filter(f=>f.type==='blob'&&typeof f.path==='string').map(f=>f.path)}:{}),partial:!!tree.truncated||eligible.length>limit,files:eligible.slice(0,limit).map(({path,sha,size})=>({path,sha,size}))};
}
export async function loadPublicSelection(snapshot,paths,options={}){
 if(!Array.isArray(paths)||!paths.length||paths.length>12||new Set(paths).size!==paths.length)throw Error('Choisir 1 à 12 fichiers');
 const selected=paths.map(p=>snapshot.files.find(f=>f.path===p));
 if(selected.some(f=>!f)||selected.reduce((n,f)=>n+f.size,0)>60000)throw Error('Sélection trop volumineuse ou invalide');
 const mapping=[],files=[];
 for(const f of selected){
  const blob=await get('/repos/'+parseRepo(snapshot.repo)+'/git/blobs/'+f.sha,options);
  if(blob.sha!==f.sha||blob.encoding!=='base64'||typeof blob.content!=='string'||blob.content.length>20000)throw Error('Blob GitHub invalide');
  const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  if(bytes.length!==f.size)throw Error('Taille du fichier incohérente');
  const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(content.includes('\0'))throw Error('Fichier non textuel');
  const ext=extension(f.path),name='file-'+String(files.length+1).padStart(2,'0')+'.'+(['mjs','cjs'].includes(ext)?'js':ext);
  if(audit([{name,content}]).findings.some(x=>x.code==='POSSIBLE_SECRET'))throw Error('Secret potentiel détecté : import bloqué');
  files.push({name,content});mapping.push({name,path:f.path,sha:f.sha});
 }
 validateFiles(files);
 return {name:snapshot.repo,files,github:{repo:snapshot.repo,branch:snapshot.branch,commit:snapshot.commit,mapping}};
}
export function githubProposal(project,result){
 if(result?.status!=='review_required'||!project.github)throw Error('Aucune proposition GitHub');
 const files=validateFiles(result.proposal),map=new Map(project.github.mapping.map(m=>[m.name,m]));
 if(files.length!==map.size||files.some(f=>!map.has(f.name)))throw Error('Nouveau fichier ou suppression non autorisé dans cette sélection');
 if(!audit(files).passed)throw Error('Audit statique refusé');
 const changes=files.filter(f=>project.files.find(o=>o.name===f.name)?.content!==f.content).map(f=>({path:map.get(f.name).path,expectedBlob:map.get(f.name).sha,content:f.content}));
 return {format:'code-mode-x-github-proposal-v1',repo:project.github.repo,branch:project.github.branch,commit:project.github.commit,testsExecuted:false,status:'review_required',changes};
}

export async function listOwnerPage(owner,page=1,options={}){
 if(typeof owner!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner)||!Number.isInteger(page)||page<1||page>20)throw Error('Compte ou page invalide');
 const rows=await get('/users/'+owner+'/repos?type=owner&sort=pushed&direction=desc&per_page=100&page='+page,options);
 if(!Array.isArray(rows))throw Error('Réponse GitHub invalide');
 return {rows,hasNext:rows.length===100&&page<20,capped:rows.length===100&&page===20};
}

export async function readPublicAuditBlob(snapshot,path,options={}){
 const f=snapshot.files.find(x=>x.path===path);
 if(!f||!safePath(path)||!SHA.test(f.sha)||!Number.isInteger(f.size)||f.size<0||f.size>1048576)throw Error('Fichier audit invalide');
 const blob=await get('/repos/'+parseRepo(snapshot.repo)+'/git/blobs/'+f.sha,options);
 if(blob.sha!==f.sha||blob.encoding!=='base64'||typeof blob.content!=='string'||blob.content.length>1500000)throw Error('Blob GitHub invalide');
 const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
 if(bytes.length!==f.size)throw Error('Taille du fichier incohérente');
 const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 if(content.includes('\0'))throw Error('Fichier non textuel');
 return {path,sha:f.sha,bytes,content};
}
