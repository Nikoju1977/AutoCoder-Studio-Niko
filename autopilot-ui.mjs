import {catalog,runBatch,readCursor,CURSOR,MAX_REPOS,MAX_CALLS,approvedExport} from './autopilot.mjs';
const $=id=>document.getElementById(id);
let authenticated=false,controller=null,entries=[],sessionBusy=false;
function state(){const busy=Boolean(controller)||sessionBusy;$('start').disabled=!authenticated||busy;$('stop').disabled=!controller;$('login').disabled=authenticated||busy;$('logout').disabled=!authenticated||busy;$('token').disabled=authenticated||busy;$('reset').disabled=busy;}
async function session(body){
 const r=await fetch('/api/session',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Session HTTP '+r.status);return r.json();
}
async function refresh(){sessionBusy=true;state();try{authenticated=(await session()).authenticated===true;$('session').textContent=authenticated?'Session active — jeton non requis':'Connexion requise';}catch(e){authenticated=false;$('session').textContent=e.message;}finally{sessionBusy=false;state();}}
$('login').onclick=async()=>{if(sessionBusy||controller)return;sessionBusy=true;state();try{authenticated=(await session({action:'login',token:$('token').value})).authenticated===true;$('session').textContent='Session active pour sept jours';}catch(e){$('session').textContent=e.message;}finally{$('token').value='';sessionBusy=false;state();}};
$('logout').onclick=async()=>{if(sessionBusy||controller)return;sessionBusy=true;state();try{await session({action:'logout'});authenticated=false;entries=[];render();$('session').textContent='Session fermée';}catch(e){$('session').textContent=e.message;}finally{sessionBusy=false;state();}};
function render(){
 $('results').replaceChildren();
 for(const entry of entries){
  const el=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=entry.repo;p.textContent=entry.status+(entry.reason?' — '+entry.reason:'')+' · tests applicatifs non exécutés';el.append(h,p);
  if(entry.proposal){
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Comparer '+entry.proposal.changes.length+' correction(s)';details.append(summary);
   for(const c of entry.proposal.changes){const heading=document.createElement('h4'),pre=document.createElement('pre');heading.textContent=c.path;pre.textContent='AVANT\n'+(entry.original.find(x=>x.path===c.path)?.content||'')+'\n\nAPRÈS\n'+c.content;details.append(heading,pre);}
   const label=document.createElement('label'),check=document.createElement('input'),btn=document.createElement('button');check.type='checkbox';label.className='consent';label.append(check,document.createTextNode(' J’ai examiné la proposition (export uniquement, publication interdite sans revue et tests)'));btn.textContent='Exporter la proposition';btn.disabled=true;check.onchange=()=>{btn.disabled=!check.checked;};btn.onclick=()=>{try{const data=approvedExport(entry,check.checked),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='autopilot-proposition.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){$('progress').textContent=e.message;}};el.append(details,label,btn);
  }
  $('results').append(el);
 }
}
$('start').onclick=async()=>{
 if(!authenticated||controller||sessionBusy)return;
 if(!$('consent').checked){$('progress').textContent='Autorise les appels Agnes avant le lancement.';return;}
 if(entries.some(x=>x.proposal)&&!confirm('Le prochain lot remplace les propositions affichées. Les exporter avant de continuer ? Continuer ?'))return;
 controller=new AbortController();state();entries=[];render();
 try{
  $('progress').textContent='Inventaire public GitHub…';
  const rows=await catalog({signal:controller.signal});
  let cursor='';try{cursor=readCursor(localStorage);}catch{}
  $('inventory').textContent=rows.length+' dépôts publics admissibles · reprise après '+(cursor||'début');
  const r=await runBatch({rows,cursor,signal:controller.signal,limit:MAX_REPOS,onProgress:({repo,stage,calls,cursor,entry})=>{
   $('progress').textContent=repo+' · '+stage+' · '+calls+'/'+MAX_CALLS+' appels maximum';
   if(entry){entries.push(entry);render();}
   if(cursor)try{localStorage.setItem(CURSOR,cursor);}catch{}
  }});
  entries=r.results;render();$('progress').textContent=(r.complete?'Catalogue parcouru':'Lot terminé ou arrêté')+' · '+r.calls+' appels tentés · '+r.results.length+' dépôt(s). Aucun push. Reprendre pour le lot suivant.';
 }catch(e){$('progress').textContent=String(e.message||e);}
 finally{controller=null;$('consent').checked=false;state();await refresh();}
};
$('stop').onclick=()=>controller?.abort();
$('reset').onclick=()=>{if(!controller&&confirm('Recommencer au premier dépôt ?')){try{localStorage.removeItem(CURSOR);$('progress').textContent='Curseur réinitialisé.';}catch{$('progress').textContent='Stockage local indisponible.';}}};
window.addEventListener('pagehide',()=>controller?.abort());
refresh();
