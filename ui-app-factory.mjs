// V10: constrained AI layout data, local-only PWA packaging.
import {normalize,exportLayout,bindRuntime,TYPES,ACTIONS,blank} from './ui-builder.mjs';
import {THEMES} from './ui-theme.mjs';
export async function generateLayout(prompt,{approved=false,fetchImpl=globalThis.fetch,signal}={}){
 if(approved!==true)throw Error('Consentement Agnes requis');
 if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>1800)throw Error('Prompt de 3 à 1800 caractères requis');
 const instruction='Retourne exactement un fichier layout.json contenant un objet JSON avec format "niko-layout-v1", title, theme (nom parmi '+Object.keys(THEMES).join(',')+'), items (1 à 20). Chaque item: id n1, n2 etc., type parmi '+Object.keys(TYPES).join(',')+', text (300 caractères max), span entier 1-12, height entier 44-480. Les boutons peuvent avoir action {kind,target,source?}: copy vers output avec input source; append vers list avec input source; clear vers list; increment/reset vers progress. Aucun code, aucun réseau. Si fonctionnalité non représentable, ne pas inventer une liaison. Demande: '+prompt;
 const res=await fetchImpl('/api/generate',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({provider:'agnes',role:'developer',prompt:instruction,files:[{name:'layout.json',content:JSON.stringify({...blank(),theme:'cinematic'})}]})});
 if(!res.ok)throw Error('Agnes HTTP '+res.status+' — vérifier session et quota');
 const data=await res.json();
 if(data?.files?.length!==1||data.files[0].name!=='layout.json'||typeof data.files[0].content!=='string'||data.files[0].content.length>30000)throw Error('Réponse IA hors schéma');
 const doc=JSON.parse(data.files[0].content);
 if(!doc||!Object.hasOwn(THEMES,doc.theme)||!Array.isArray(doc.items)||doc.items.length<1||doc.items.length>20)throw Error('Composition IA invalide');
 return normalize({...doc,theme:THEMES[doc.theme]});
}
// This function is serialized into the generated app. No external closures.
export async function installLists(root,bindings,projectKey){
 const doc=root.ownerDocument,nodes=new Map([...root.querySelectorAll('[data-niko-node]')].map(e=>[e.dataset.nikoNode,e]));
 const controls=bindings.map(b=>nodes.get(b.id)?.querySelector('button')).filter(Boolean);
 controls.forEach(b=>b.disabled=true);
 const status=doc.createElement('p');status.setAttribute('role','status');root.before(status);
 let db;
 try{
  db=await new Promise((resolve,reject)=>{const r=indexedDB.open('niko-app-data-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('lists');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Stockage bloqué'));});
 }catch{status.textContent='Stockage local indisponible : listes désactivées.';return;}
 const operation=(key,value)=>new Promise((resolve,reject)=>{
  const tx=db.transaction('lists',value===undefined?'readonly':'readwrite'),store=tx.objectStore('lists'),r=value===undefined?store.get(key):store.put(value,key);
  tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Transaction annulée'));
 });
 for(const [id,node] of nodes){
  const list=node.querySelector('ul');if(!list)continue;
  const key=projectKey+':'+location.pathname+':'+id,related=bindings.filter(b=>b.action.target===id);
  let rows=[],busy=false;
  try{const saved=await operation(key);if(saved!==undefined){if(!Array.isArray(saved)||saved.length>100||saved.some(x=>typeof x!=='string'||x.length>300))throw Error('Données invalides');rows=saved;}}
  catch{status.textContent='Lecture locale impossible : '+id;continue;}
  const buttons=related.map(b=>nodes.get(b.id)?.querySelector('button')).filter(Boolean);
  function paint(){
   list.replaceChildren();
   rows.forEach((value,i)=>{
    const li=doc.createElement('li'),input=doc.createElement('input'),save=doc.createElement('button'),remove=doc.createElement('button');
    input.type='text';input.maxLength=300;input.value=value;input.setAttribute('aria-label','Entrée '+(i+1));save.type=remove.type='button';save.textContent='Modifier';remove.textContent='Supprimer';
    save.onclick=()=>{const v=input.value.trim();if(v)commit(rows.map((x,j)=>j===i?v:x));};remove.onclick=()=>commit(rows.filter((_,j)=>j!==i));
    li.append(input,save,remove);list.append(li);
   });
  }
  async function commit(next){
   if(busy)return false;busy=true;buttons.forEach(b=>b.disabled=true);list.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await operation(key,next);rows=next;status.textContent='Liste enregistrée localement.';paint();return true;}
   catch{status.textContent='Échec de sauvegarde : données non modifiées.';paint();return false;}
   finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  for(const b of related){
   const el=nodes.get(b.id)?.querySelector('button');if(!el)continue;
   el.onclick=async()=>{if(b.action.kind==='clear'){if(rows.length&&confirm('Vider cette liste locale ?'))await commit([]);}
    else if(b.action.kind==='append'){const input=nodes.get(b.action.source)?.querySelector('input'),v=input?.value.trim().slice(0,300);if(v&&rows.length<100&&await commit([...rows,v]))input.value='';}};
   el.disabled=false;
  }
  paint();
 }
 status.textContent=status.textContent||'Données de liste conservées sur cet appareil.';
}
function hash(text){let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return (n>>>0).toString(16);}
export function pwaFiles(doc,{persistent=false}={}){
 const d=normalize(doc),x=exportLayout(d);
 const bindings=d.items.filter(i=>i.action).map(({id,action})=>({id,action}));
 const list=bindings.filter(b=>['append','clear'].includes(b.action.kind)),others=persistent?bindings.filter(b=>!list.includes(b)):bindings;
 const projectKey=hash(JSON.stringify(d));
 const html=x.html.replace("default-src 'none';script-src 'self';style-src 'self';","default-src 'none';script-src 'self';style-src 'self';manifest-src 'self';worker-src 'self';img-src 'self';connect-src 'self';").replace('<link rel="stylesheet"','<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="'+d.theme.bg+'"><link rel="stylesheet"');
 const js='('+bindRuntime.toString()+')(document.querySelector(".layout-grid"),'+JSON.stringify(others)+');\n'+(persistent?'('+installLists.toString()+')(document.querySelector(".layout-grid"),'+JSON.stringify(list)+','+JSON.stringify(projectKey)+');\n':'')+'if("serviceWorker" in navigator && isSecureContext)navigator.serviceWorker.register("./sw.js").catch(()=>{const p=document.createElement("p");p.textContent="Mode hors ligne indisponible.";document.body.append(p);});\n';
 const manifest=JSON.stringify({name:d.title||'Studio Niko App',short_name:(d.title||'Niko App').slice(0,24),id:'./',start_url:'./index.html',scope:'./',display:'standalone',background_color:d.theme.bg,theme_color:d.theme.bg,icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},null,2);
 const icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="'+d.theme.bg+'"/><path d="M132 365V147h47l154 218h47V147h-48v137L235 147h-54v218z" fill="'+d.theme.accent+'"/></svg>';
 const css=x.css+'\noutput{display:block;white-space:pre-wrap;overflow-wrap:anywhere}li{margin:8px 0}li input{margin-bottom:4px}li button{margin:4px}\n';
 const cacheKey=hash(html+css+js+manifest+icon);
 const sw='const prefix="niko-app:"+self.registration.scope+":";const name=prefix+"'+cacheKey+'";const files=["index.html","layout.css","app.js","manifest.webmanifest","icon.svg"];const urls=files.map(x=>new URL(x,self.registration.scope).href);self.addEventListener("install",e=>e.waitUntil(caches.open(name).then(c=>c.addAll(urls))));self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==name).map(k=>caches.delete(k))))));self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);const key=u.href===self.registration.scope?urls[0]:u.href;if(!urls.includes(key))return;e.respondWith(caches.open(name).then(async c=>(await c.match(key))||fetch(e.request)));});';
 return {'index.html':html,'layout.css':css,'app.js':js,'manifest.webmanifest':manifest,'icon.svg':icon,'sw.js':sw};
}
// ZIP STORE (no compression); bounded inputs and ASCII file names.
export function zipFiles(files){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0,centralSize=0;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const block=n=>{const a=new Uint8Array(n),v=new DataView(a.buffer);return {a,u16:(i,x)=>v.setUint16(i,x,true),u32:(i,x)=>v.setUint32(i,x,true)};};
 const rows=Object.entries(files);if(!rows.length||rows.length>20)throw Error('Archive invalide');
 for(const [filename,content] of rows){
  if(!/^[a-z0-9._-]{1,60}$/i.test(filename)||filename==='.'||filename==='..'||typeof content!=='string')throw Error('Fichier invalide');
  const n=enc.encode(filename),d=enc.encode(content);if(d.length>200000)throw Error('Fichier trop volumineux');const sum=crc(d);
  const h=block(30);h.u32(0,0x04034b50);h.u16(4,20);h.u16(12,33);h.u32(14,sum);h.u32(18,d.length);h.u32(22,d.length);h.u16(26,n.length);chunks.push(h.a,n,d);
  const c=block(46);c.u32(0,0x02014b50);c.u16(4,20);c.u16(6,20);c.u16(14,33);c.u32(16,sum);c.u32(20,d.length);c.u32(24,d.length);c.u16(28,n.length);c.u32(42,offset);central.push(c.a,n);centralSize+=46+n.length;offset+=30+n.length+d.length;
 }
 const end=block(22);end.u32(0,0x06054b50);end.u16(8,rows.length);end.u16(10,rows.length);end.u32(12,centralSize);end.u32(16,offset);
 return new Blob([...chunks,...central,end.a],{type:'application/zip'});
}
