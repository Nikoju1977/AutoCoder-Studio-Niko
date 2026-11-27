// Declarative REST connector registry. Reviewed routes only; no arbitrary URL or credentials.
import {parseRepo} from './code-mode-x-github.mjs';
const manifests=Object.freeze({
 'github.repository':{method:'GET',origin:'https://api.github.com',path:'/repos/{repo}',permission:'public.read',auth:'none',input:'repo',description:'Métadonnées publiques du dépôt GitHub'},
 'autocoder.status':{method:'GET',origin:'same-origin',path:'/api/status',permission:'public.read',auth:'none',input:'none',description:'Configuration déclarée du serveur AutoCoder'}
});
export function listConnectors(){return Object.entries(manifests).map(([id,m])=>({id,...m}));}
export async function readConnector(id,args={},options={}){
 if(!Object.hasOwn(manifests,id)||!args||typeof args!=='object'||Array.isArray(args))throw Error('Connecteur inconnu');
 const m=manifests[id],keys=Object.keys(args);
 if(m.input==='repo'?(keys.length!==1||!Object.hasOwn(args,'repo')||typeof args.repo!=='string'):keys.length!==0)throw Error('Arguments invalides');
 const url=m.input==='repo'?m.origin+'/repos/'+parseRepo(args.repo):'/api/status';
 const c=new AbortController(),cancel=()=>c.abort(),signal=options.signal;
 if(signal?.aborted)throw Error('Annulé');
 signal?.addEventListener('abort',cancel,{once:true});const timeout=setTimeout(cancel,10000);
 try{
 const r=await (options.fetchImpl||globalThis.fetch)(url,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:c.signal});
 if(!r.ok)throw Error('HTTP '+r.status);
 const reader=r.body?.getReader();if(!reader)throw Error('Flux indisponible');
 let bytes=0,raw='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>256000){await reader.cancel();throw Error('Réponse trop volumineuse');}raw+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
 const data=JSON.parse(raw+decoder.decode());
 if(id==='github.repository'){
  if(data.private!==false||typeof data.full_name!=='string')throw Error('Dépôt public requis');
  return {repository:data.full_name,description:String(data.description||'').slice(0,300),branch:data.default_branch,archived:!!data.archived,pushedAt:data.pushed_at,testsVerified:false};
 }
 return {configured:data.configured===true,providers:Array.isArray(data.providers)?data.providers.filter(x=>['openai','mistral','agnes'].includes(x)):[],keysVerified:false};
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
