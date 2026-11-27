import {catalog,runBatch,readCursor,CURSOR,MAX_REPOS,MAX_CALLS,approvedExport} from './autopilot.mjs';
import {bridgeStatus,sendReview} from './review-bridge-client.mjs';
import {cursorKey} from './ui-engine.mjs';
const $=id=>document.getElementById(id);
let authenticated=false,controller=null,entries=[],sessionBusy=false,bridgeReady=false,bridgeBusy=false,bridgeControls=[],receipts=new WeakMap();
function state(){const busy=Boolean(controller)||sessionBusy||bridgeBusy;$('start').disabled=!authenticated||busy;$('stop').disabled=!controller;$('login').disabled=authenticated||busy;$('logout').disabled=!authenticated||busy;$('token').disabled=authenticated||busy;$('reset').disabled=busy;$('mode').disabled=busy;$('bridge-refresh').disabled=!authenticated||busy;for(const sync of bridgeControls)sync();}
async function session(body){
 const r=await fetch('/api/session',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Session HTTP '+r.status);return r.json();
}
async function refreshBridge(){
 bridgeReady=false;
 if(!authenticated){$('bridge-state').textContent='Connexion Autopilot requise.';return;}
 try{
  const result=await bridgeStatus();bridgeReady=result.ready;
  $('bridge-state').textContent=result.ready?'Boîte GitHub privée vérifiée.':result.configured?'Boîte inaccessible : vérifier confidentialité et permissions.':'Configuration initiale requise : boîte privée et variable AUTOPILOT_REVIEW_TOKEN.';
 }catch(e){$('bridge-state').textContent=e.message;}
}
$('bridge-refresh').onclick=async()=>{if(!authenticated||sessionBusy||controller||bridgeBusy)return;sessionBusy=true;state();try{await refreshBridge();}finally{sessionBusy=false;state();}};
async function refresh(){sessionBusy=true;state();try{authenticated=(await session()).authenticated===true;$('session').textContent=authenticated?'Session active — jeton non requis':'Connexion requise';}catch(e){authenticated=false;$('session').textContent=e.message;}finally{await refreshBridge();sessionBusy=false;state();}}
$('login').onclick=async()=>{if(sessionBusy||controller||bridgeBusy)return;sessionBusy=true;state();try{authenticated=(await session({action:'login',token:$('token').value})).authenticated===true;$('session').textContent='Session active pour sept jours';}catch(e){$('session').textContent=e.message;}finally{$('token').value='';await refreshBridge();sessionBusy=false;state();}};
$('logout').onclick=async()=>{if(sessionBusy||controller||bridgeBusy)return;sessionBusy=true;state();try{await session({action:'logout'});authenticated=false;bridgeReady=false;entries=[];receipts=new WeakMap();render();$('bridge-state').textContent='Connexion Autopilot requise.';$('session').textContent='Session fermée';}catch(e){$('session').textContent=e.message;}finally{sessionBusy=false;state();}};
function render(){
 $('results').replaceChildren();bridgeControls=[];
 for(const entry of entries){
  const el=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=entry.repo;p.textContent=(entry.profile&&entry.profile!=='general'?'Profil '+entry.profile+' · ':'')+entry.status+(entry.reason?' — '+entry.reason:'')+' · tests applicatifs non exécutés';el.append(h,p);
  if(entry.proposal){
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Comparer '+entry.proposal.changes.length+' correction(s)';details.append(summary);
   for(const c of entry.proposal.changes){const heading=document.createElement('h4'),pre=document.createElement('pre');heading.textContent=c.path;pre.textContent='AVANT\n'+(entry.original.find(x=>x.path===c.path)?.content||'')+'\n\nAPRÈS\n'+c.content;details.append(heading,pre);}
   let visual=null;
   if(entry.profile&&entry.profile!=='general'&&entry.original.some(f=>/\.html$/i.test(f.path))){
    visual=document.createElement('button');visual.disabled=true;visual.type='button';visual.textContent='Exporter dossier de preuve visuelle';
    visual.onclick=()=>{if(!check.checked)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'niko-ui-visual-v1',original:entry.original,proposal:entry.proposal},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='niko-ui-visual.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
    el.append(visual);
   }
   const label=document.createElement('label'),check=document.createElement('input'),btn=document.createElement('button'),send=document.createElement('button'),report=document.createElement('p');
   label.className='consent';check.type='checkbox';label.append(check,document.createTextNode(' J’ai examiné la proposition et j’autorise son export ou son transfert privé pour revue. Aucune publication autorisée.'));
   btn.type='button';btn.textContent='Exporter JSON (facultatif)';
   send.type='button';send.textContent='Transmettre pour revue ChatGPT';
   report.setAttribute('role','status');
   function showReceipt(){const receipt=receipts.get(entry);if(!receipt)return;const a=document.createElement('a');a.href=receipt.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Ticket privé #'+receipt.number;report.replaceChildren(document.createTextNode('Proposition disponible pour revue : '),a);}
   const sync=()=>{btn.disabled=!check.checked;if(visual)visual.disabled=!check.checked;send.disabled=!check.checked||!authenticated||!bridgeReady||Boolean(controller)||sessionBusy||bridgeBusy||receipts.has(entry);};
   bridgeControls.push(sync);check.onchange=sync;sync();showReceipt();
   btn.onclick=()=>{try{const data=approvedExport(entry,check.checked),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='autopilot-proposition.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){report.textContent=e.message;}};
   send.onclick=async()=>{
    if(send.disabled||!check.checked||!authenticated||!bridgeReady||controller||sessionBusy||bridgeBusy||receipts.has(entry))return;
    bridgeBusy=true;state();report.textContent='Transmission privée en cours…';
    try{const receipt=await sendReview(approvedExport(entry,check.checked),check.checked);receipts.set(entry,receipt);showReceipt();}
    catch(e){report.textContent=e.message;}
    finally{bridgeBusy=false;state();}
   };
   el.append(details,label,send,btn,report);
  }
  $('results').append(el);
 }
}
$('start').onclick=async()=>{
 if(!authenticated||controller||sessionBusy||bridgeBusy)return;
 if(!$('consent').checked){$('progress').textContent='Autorise les appels Agnes avant le lancement.';return;}
 if(entries.some(x=>x.proposal&&!receipts.has(x))&&!confirm('Des propositions ne sont pas transmises. Le prochain lot efface leur affichage. Continuer ?'))return;
 const mode=$('mode').value;
 controller=new AbortController();state();entries=[];receipts=new WeakMap();render();
 try{
  $('progress').textContent='Inventaire public GitHub…';
  const rows=await catalog({signal:controller.signal});
  let cursor='';try{cursor=readCursor(localStorage,mode);}catch{}
  $('inventory').textContent=rows.length+' dépôts publics admissibles · reprise après '+(cursor||'début');
  const r=await runBatch({rows,cursor,mode,signal:controller.signal,limit:MAX_REPOS,onProgress:({repo,stage,calls,cursor,entry})=>{
   $('progress').textContent=repo+' · '+stage+' · '+calls+'/'+MAX_CALLS+' appels maximum';
   if(entry){entries.push(entry);render();}
   if(cursor)try{localStorage.setItem(cursorKey(CURSOR,mode),cursor);}catch{}
  }});
  entries=r.results;render();$('progress').textContent=(r.complete?'Catalogue parcouru':'Lot terminé ou arrêté')+' · '+r.calls+' appels tentés · '+r.results.length+' dépôt(s). Aucun push. Reprendre pour le lot suivant.';
 }catch(e){$('progress').textContent=String(e.message||e);}
 finally{controller=null;$('consent').checked=false;state();await refresh();}
};
$('stop').onclick=()=>controller?.abort();
$('reset').onclick=()=>{if(!controller&&!sessionBusy&&!bridgeBusy&&confirm('Recommencer au premier dépôt ?')){try{localStorage.removeItem(cursorKey(CURSOR,$('mode').value));$('progress').textContent='Curseur réinitialisé.';}catch{$('progress').textContent='Stockage local indisponible.';}}};
window.addEventListener('pagehide',()=>controller?.abort());
refresh();
