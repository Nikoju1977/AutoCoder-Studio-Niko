import {audit,validateFiles} from './code-mode-x.mjs';
import {runAgentTeam,createHttpAgentTransport} from './code-mode-x-team.mjs';
import {parseProject,proposalExport} from './code-mode-x-project.mjs';
const $=id=>document.getElementById(id), roles=['architect','developer','critic'];
let project=null,result=null,controller=null,downloadUrl=null;
function fill(select,values){select.replaceChildren(...values.map(([value,label])=>new Option(label,value)));}
for(const role of roles)fill($(role),[['','Automatique (serveur)'],['openai','OpenAI'],['mistral','Mistral'],['agnes','Agnes']]);
function busy(on){for(const id of ['project-file','current','token','prompt','consent',...roles])$(id).disabled=on;$('audit').disabled=on||!project;$('run').disabled=on||!project;$('stop').disabled=!on;}
function resetResult(){result=null;$('changes').replaceChildren();$('changes').disabled=true;$('export').disabled=true;$('before').value='';$('after').value='';$('review-status').textContent='Aucune proposition.';if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}$('download').hidden=true;$('download').removeAttribute('href');}
function viewSource(){ $('source').value=project?.files.find(f=>f.name===$('file-select').value)?.content??'';}
function load(raw){const p=parseProject(raw);project=p;resetResult();fill($('file-select'),p.files.map(f=>[f.name,f.name]));$('file-select').disabled=false;viewSource();$('project-status').textContent=p.name+' · '+p.files.length+' fichier(s)';$('journal').textContent='Projet chargé, aucun audit exécuté.';busy(false);}
$('file-select').addEventListener('change',viewSource);
$('project-file').addEventListener('change',async()=>{try{const f=$('project-file').files[0];if(!f)return;if(f.size>2000000)throw Error('Fichier trop volumineux');load(JSON.parse(await f.text()));}catch(e){$('project-status').textContent='Import refusé : '+e.message;}finally{$('project-file').value='';}});
$('current').addEventListener('click',()=>{try{load(JSON.parse(localStorage.getItem('studio-niko-autocoder-v2')));}catch(e){$('project-status').textContent='Aucun projet local valide. Exporte le JSON depuis AutoCoder.';}});
$('audit').addEventListener('click',()=>{if(!project)return;const r=audit(project.files);$('journal').textContent=JSON.stringify(r,null,2);});
async function refresh(){ $('server').textContent='Vérification en cours…';try{const r=await fetch('./api/status',{cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(8000):undefined});if(!r.ok)throw Error();const data=await r.json();$('server').textContent=data.configured?'Serveur configuré : '+(data.providers?.join(', ')||'fournisseurs non précisés')+' (clés non testées)':'Serveur IA non configuré.';}catch{$('server').textContent='API indisponible ou hors ligne. Audit local disponible.';}}
$('refresh').addEventListener('click',refresh);
function showChange(){const name=$('changes').value;$('before').value=project?.files.find(f=>f.name.toLowerCase()===name.toLowerCase())?.content??'';$('after').value=result?.proposal?.find(f=>f.name===name)?.content??'';}
$('changes').addEventListener('change',showChange);
$('stop').addEventListener('click',()=>controller?.abort());
$('run').addEventListener('click',async()=>{
 if(!project||controller)return;
 const token=$('token').value,prompt=$('prompt').value.trim();
 if(token.length<32||prompt.length<3||!$('consent').checked){$('run-status').textContent='Jeton, mission et autorisation requis.';return;}
 resetResult();controller=new AbortController();busy(true);
 const selections=Object.fromEntries(roles.map(role=>[role,$(role).value]));
 let calls=0;
 try{
   const transport=createHttpAgentTransport({token,origin:location.origin});
   result=await runAgentTeam({prompt,files:project.files,signal:controller.signal,request:async args=>{
     calls++;$('run-status').textContent='Appel '+calls+' / 7 · '+args.role+' · '+(selections[args.role]||'automatique');
     return transport({...args,provider:selections[args.role]||undefined});
   }});
   $('journal').textContent=JSON.stringify({events:result.events,agents:result.agents,providerCalls:result.providerCalls,testsExecuted:false},null,2);
   $('run-status').textContent=result.status==='review_required'?'Proposition à examiner — aucun test exécuté.':result.status==='cancelled'?'Mission annulée.':'Mission bloquée : '+(result.reason||result.status);
   if(result.status==='review_required'&&result.proposal?.length){
     fill($('changes'),result.changedFiles.map(n=>[n,n]));$('changes').disabled=false;$('export').disabled=false;
     $('review-status').textContent=result.changedFiles.length+' fichier(s) proposés. Compare avant export.';showChange();
   }
 }catch(e){$('run-status').textContent='Mission impossible : '+e.message;}finally{controller=null;busy(false);$('token').value='';$('consent').checked=false;}
});
$('export').addEventListener('click',()=>{if(!project||result?.status!=='review_required')return;try{const payload=proposalExport(project,result);if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=$('download');a.href=downloadUrl;a.download='code-mode-x-proposition.json';a.hidden=false;a.click();}catch(e){$('review-status').textContent=e.message;}});
window.addEventListener('pagehide',()=>{controller?.abort();$('token').value='';if(downloadUrl)URL.revokeObjectURL(downloadUrl);});
