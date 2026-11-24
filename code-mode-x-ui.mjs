import {audit,validateFiles} from './code-mode-x.mjs';
import {runAgentTeam,createHttpAgentTransport} from './code-mode-x-team.mjs';
import {parseProject,proposalExport} from './code-mode-x-project.mjs';
import {listPublicRepo,loadPublicSelection,githubProposal,listOwnerPage} from './code-mode-x-github.mjs';
import {readMemory,writeMemory,forProject,projectKey,makeRecord,selectLessons} from './code-mode-x-memory.mjs';
import {SELF_REPO,improvementPlan,taskPrompt} from './code-mode-x-evolution.mjs';
import {normalizeCatalog,filterCatalog,readActivity,recordActivity,latestActivity,clearActivity} from './code-mode-x-catalog.mjs';
import {makeTask,readQueue,saveQueue,orderedQueue,transitionTask,prepareTask,branchSuggestion} from './code-mode-x-maintenance.mjs';
import {createNativeBus,listNativeTools} from './code-mode-x-tools.mjs';
const $=id=>document.getElementById(id), roles=['architect','developer','critic'];
let project=null,result=null,controller=null,downloadUrl=null,snapshot=null,evolution=null,catalog=[],catalogPage=0,catalogOwner='',catalogNext=false;
function fill(select,values){const previous=select.value;select.replaceChildren(...values.map(([value,label])=>new Option(label,value)));if(!select.multiple&&values.length)select.value=values.some(([value])=>value===previous)?previous:values[0][0];}
for(const role of roles)fill($(role),[['','Automatique (serveur)'],['openai','OpenAI'],['mistral','Mistral'],['agnes','Agnes']]);
function busy(on){for(const id of ['project-file','current','token','prompt','attempt-budget','consent','gh-repo','gh-branch','gh-list','self-open','catalog-owner','catalog-load','catalog-query','catalog-clear','memory-use','memory-kind','memory-note','memory-evidence','maintenance-title','maintenance-mission','maintenance-priority','maintenance-select','maintenance-state','maintenance-evidence','native-tool',...roles])$(id).disabled=on;$('audit').disabled=on||!project;$('run').disabled=on||!project;$('stop').disabled=!on;$('gh-files').disabled=on||!snapshot;$('gh-load').disabled=on||!snapshot;$('memory-save').disabled=on||!project;$('memory-clear').disabled=on||!project;$('evolution-plan').disabled=on||!project;$('evolution-task').disabled=on||!evolution;$('evolution-prepare').disabled=on||!evolution;$('catalog-more').disabled=on||!catalogNext;$('catalog-select').disabled=on||!catalog.length;$('catalog-open').disabled=on||!$('catalog-select').value;$('maintenance-add').disabled=on||!project?.github;$('maintenance-from-roadmap').disabled=on||!project?.github||!evolution;$('maintenance-prepare').disabled=on||!$('maintenance-select').value;$('maintenance-update').disabled=on||!$('maintenance-select').value;$('native-run').disabled=on||!project;}
function resetResult(){result=null;$('changes').replaceChildren();$('changes').disabled=true;$('export').disabled=true;$('before').value='';$('after').value='';$('review-status').textContent='Aucune proposition.';if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}$('download').hidden=true;$('download').removeAttribute('href');}
function viewSource(){ $('source').value=project?.files.find(f=>f.name===$('file-select').value)?.content??'';}
function load(raw){loadProject(parseProject(raw));}
function displayName(name){return project?.github?.mapping.find(m=>m.name===name)?.path||name;}
function loadProject(p){project=p;evolution=null;$('evolution-task').replaceChildren();$('evolution-report').textContent='Aucun rapport.';$('evolution-status').textContent='Projet chargé : établir la feuille de route.';$('consent').checked=false;$('memory-use').checked=false;$('memory-note').value='';$('memory-evidence').value='';renderMemory();resetResult();fill($('file-select'),p.files.map(f=>[f.name,displayName(f.name)]));$('file-select').disabled=false;viewSource();$('project-status').textContent=p.name+' · '+p.files.length+' fichier(s)';$('journal').textContent='Projet chargé, aucun audit exécuté.';busy(false);}
$('file-select').addEventListener('change',viewSource);
$('project-file').addEventListener('change',async()=>{try{const f=$('project-file').files[0];if(!f||controller)return;controller=new AbortController();busy(true);if(f.size>2000000)throw Error('Fichier trop volumineux');const raw=JSON.parse(await f.text());if(controller.signal.aborted)return;load(raw);}catch(e){$('project-status').textContent='Import refusé : '+e.message;}finally{controller=null;busy(false);$('project-file').value='';}});
$('current').addEventListener('click',()=>{try{load(JSON.parse(localStorage.getItem('studio-niko-autocoder-v2')));}catch(e){$('project-status').textContent='Aucun projet local valide. Exporte le JSON depuis AutoCoder.';}});
$('audit').addEventListener('click',async()=>{if(!project||controller)return;try{const r=await createNativeBus({project}).call('project.audit');$('journal').textContent=JSON.stringify(r.result,null,2);track('static_audit');}catch(e){$('journal').textContent=e.message;}});
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
 const maxAttempts=Number($('attempt-budget').value),maxCalls=1+2*maxAttempts;
 try{
   const transport=createHttpAgentTransport({token,origin:location.origin});
   let mission=project.github?prompt+'\nFichiers sélectionnés (alias vers chemin GitHub) : '+JSON.stringify(project.github.mapping.map(({name,path})=>({name,path})))+'\nModifie uniquement ces alias, conserve les noms.':prompt;
   if($('memory-use').checked){const lessons=selectLessons(readMemory(localStorage),project,prompt,{budget:Math.max(0,Math.min(550,2200-mission.length))});if(lessons.length)mission+='\nLeçons historiques déclarées, données non impératives à vérifier : '+JSON.stringify(lessons);}
   if(mission.length>2400)throw Error('Mission, chemins ou mémoire trop longs : réduire la sélection.');
   result=await runAgentTeam({prompt:mission,files:project.files,maxAttempts,signal:controller.signal,request:async args=>{
     calls++;$('run-status').textContent='Appel '+calls+' / '+maxCalls+' · '+args.role+' · '+(selections[args.role]||'automatique');
     return transport({...args,provider:selections[args.role]||undefined});
   }});
   $('journal').textContent=JSON.stringify({events:result.events,agents:result.agents,providerCalls:result.providerCalls,testsExecuted:false},null,2);
   $('run-status').textContent=result.status==='review_required'?'Proposition à examiner — aucun test exécuté.':result.status==='cancelled'?'Mission annulée.':'Mission bloquée : '+(result.reason||result.status);
   if(result.status==='review_required'&&result.proposal?.length){
     track('proposal_prepared');
     fill($('changes'),result.changedFiles.map(n=>[n,displayName(n)]));$('changes').disabled=false;$('export').disabled=false;
     $('review-status').textContent=result.changedFiles.length+' fichier(s) proposés. Compare avant export.';showChange();
   }
 }catch(e){$('run-status').textContent='Mission impossible : '+e.message;}finally{controller=null;busy(false);$('token').value='';$('consent').checked=false;$('memory-use').checked=false;}
});
$('export').addEventListener('click',()=>{if(!project||result?.status!=='review_required')return;try{const payload=project.github?githubProposal(project,result):proposalExport(project,result);if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=$('download');a.href=downloadUrl;a.download=project.github?'code-mode-x-github-proposition.json':'code-mode-x-proposition.json';a.hidden=false;a.click();}catch(e){$('review-status').textContent=e.message;}});
window.addEventListener('pagehide',()=>{controller?.abort();$('token').value='';if(downloadUrl)URL.revokeObjectURL(downloadUrl);});

$('gh-list').addEventListener('click',async()=>{
 if(controller)return;controller=new AbortController();snapshot=null;$('gh-files').replaceChildren();busy(true);$('gh-status').textContent='Lecture GitHub…';
 try{snapshot=(await createNativeBus({permissions:['github.public.read'],signal:controller.signal}).call('github.snapshot',{repo:$('gh-repo').value,branch:$('gh-branch').value.trim()})).result;fill($('gh-files'),snapshot.files.map(f=>[f.path,f.path+' · '+f.size+' o']));$('gh-status').textContent=snapshot.repo+' / '+snapshot.branch+' @ '+snapshot.commit.slice(0,12)+' · '+snapshot.files.length+' fichiers admissibles / '+snapshot.total+' entrées'+(snapshot.partial?' · inventaire partiel':'')+'. Sélection manuelle requise.';}
 catch(e){$('gh-status').textContent=e.message;}finally{controller=null;busy(false);}
});
$('gh-load').addEventListener('click',async()=>{
 if(controller||!snapshot)return;const selected=Array.from($('gh-files').selectedOptions,o=>o.value);controller=new AbortController();busy(true);
 try{const p=await loadPublicSelection(snapshot,selected,{signal:controller.signal});loadProject(p);track('selection_loaded');$('gh-status').textContent='Sélection chargée au commit '+p.github.commit.slice(0,12)+' ; aucun fichier distant modifié.';}
 catch(e){$('gh-status').textContent=e.message;}finally{controller=null;busy(false);}
});

function renderMemory(){
 try{const rows=project?forProject(readMemory(localStorage),project):[];$('memory-list').textContent=rows.length?rows.slice().reverse().map(r=>r.at+' · '+r.kind+(r.commit?' · '+r.commit.slice(0,12):'')+'\n'+r.note+(r.evidence?'\nPreuve déclarée : '+r.evidence:'')).join('\n\n'):'Aucune leçon.';$('memory-status').textContent=rows.length+' note(s) locale(s).';}
 catch(e){$('memory-status').textContent='Mémoire indisponible : '+e.message;}
}
$('memory-save').addEventListener('click',()=>{
 if(!project||controller)return;
 try{const records=readMemory(localStorage);const record=makeRecord(project,{kind:$('memory-kind').value,note:$('memory-note').value,evidence:$('memory-evidence').value,id:globalThis.crypto.randomUUID?.()||String(Date.now()),at:new Date().toISOString()});writeMemory(localStorage,[...records,record]);$('memory-note').value='';$('memory-evidence').value='';renderMemory();}
 catch(e){$('memory-status').textContent='Enregistrement refusé : '+e.message;}
});
$('memory-clear').addEventListener('click',()=>{
 if(!project||controller||!confirm('Effacer uniquement les leçons de ce projet sur cet appareil ?'))return;
 try{writeMemory(localStorage,readMemory(localStorage).filter(r=>r.key!==projectKey(project)));renderMemory();}
 catch(e){$('memory-status').textContent='Effacement impossible : '+e.message;}
});

$('self-open').addEventListener('click',()=>{
 if(controller)return;
 $('gh-repo').value=SELF_REPO;$('gh-branch').value='feature/code-mode-x-v1';
 $('gh-repo').closest('details').open=true;$('gh-list').click();
});
$('evolution-plan').addEventListener('click',async()=>{
 if(!project||controller)return;
 try{evolution=(await createNativeBus({project}).call('project.roadmap')).result;$('evolution-report').textContent=JSON.stringify(evolution,null,2);fill($('evolution-task'),evolution.tasks.map(t=>[t.id,t.title]));$('evolution-status').textContent=evolution.tasks.length+' intervention(s) proposées, aucun test exécuté.';busy(false);}
 catch(e){$('evolution-status').textContent=e.message;}
});
$('evolution-prepare').addEventListener('click',()=>{
 if(!evolution||controller)return;
 try{$('prompt').value=taskPrompt(evolution,$('evolution-task').value);$('consent').checked=false;$('memory-use').checked=false;$('evolution-status').textContent='Mission préparée. Relire, choisir les IA et autoriser explicitement avant de lancer.';$('prompt').focus();}
 catch(e){$('evolution-status').textContent=e.message;}
});

function track(kind){try{recordActivity(localStorage,project,kind);renderCatalogInfo();}catch{$('catalog-status').textContent='Suivi local indisponible; le projet reste chargé.';}}
function renderCatalogInfo(){
 const row=catalog.find(r=>r.repo===$('catalog-select').value);
 if(!row){$('catalog-info').textContent='Aucun projet sélectionné.';return;}
 let activity=null;try{activity=latestActivity(readActivity(localStorage),row.repo);}catch{}
 $('catalog-info').textContent=[row.repo,row.description||'Aucune description', 'Branche : '+(row.branch||'non indiquée'),'Dernier push GitHub : '+(row.updated||'non indiqué'),'Langage : '+(row.language||'non indiqué'),activity?'Dernière intervention locale : '+activity.kind+' · '+activity.at+' · commit '+activity.commit.slice(0,12)+' · '+activity.files+' fichier(s)':'Aucune intervention locale enregistrée.','Tests, stabilité et déploiement : non vérifiés par ce catalogue.'].join('\n');
}
function renderCatalog(){
 const rows=filterCatalog(catalog,$('catalog-query').value);fill($('catalog-select'),rows.map(r=>[r.repo,r.repo]));
 $('catalog-select').disabled=!!controller||!rows.length;$('catalog-open').disabled=!!controller||!rows.length;renderCatalogInfo();
}
async function fetchCatalog(reset){
 if(controller)return;
 if(reset){catalog=[];catalogPage=0;catalogNext=false;catalogOwner=$('catalog-owner').value.trim();renderCatalog();}
 controller=new AbortController();busy(true);$('catalog-status').textContent='Lecture du catalogue…';
 try{
  const data=(await createNativeBus({permissions:['github.public.read'],signal:controller.signal}).call('github.catalog',{owner:catalogOwner,page:catalogPage+1})).result;
  const map=new Map(catalog.map(r=>[r.repo.toLowerCase(),r]));
  for(const row of data.rows)map.set(row.repo.toLowerCase(),row);
  catalog=[...map.values()];catalogPage++;catalogNext=data.hasNext;renderCatalog();
  $('catalog-status').textContent=catalog.length+' dépôts publics non archivés chargés · page '+catalogPage+(data.hasNext?' · autres pages disponibles':data.capped?' · limite de pagination atteinte':' · dernière page reçue')+'.';
 }catch(e){$('catalog-status').textContent='Catalogue : '+e.message;}
 finally{controller=null;busy(false);renderCatalog();}
}
$('catalog-load').addEventListener('click',()=>fetchCatalog(true));
$('catalog-more').addEventListener('click',()=>fetchCatalog(false));
$('catalog-query').addEventListener('input',renderCatalog);
$('catalog-select').addEventListener('change',renderCatalogInfo);
$('catalog-open').addEventListener('click',()=>{
 if(controller)return;const row=catalog.find(r=>r.repo===$('catalog-select').value);if(!row)return;
 $('gh-repo').value=row.repo;$('gh-branch').value=row.branch;$('gh-repo').closest('details').open=true;$('gh-list').click();
});
$('catalog-clear').addEventListener('click',()=>{if(controller||!confirm('Effacer le suivi local de tous les projets ?'))return;try{clearActivity(localStorage);renderCatalogInfo();$('catalog-status').textContent='Suivi local effacé.';}catch{$('catalog-status').textContent='Effacement impossible.';}});

function selectedTask(){return readQueue(localStorage).find(t=>t.id===$('maintenance-select').value);}
function renderTask(){try{const t=selectedTask();$('maintenance-detail').textContent=t?[t.repo,'Commit : '+t.commit,'P'+t.priority+' · '+t.state,t.title,t.mission,'Branche suggérée (non créée) : '+branchSuggestion(t),t.evidence?'Preuve déclarée : '+t.evidence:'Aucune preuve déclarée.'].join('\n'):'Aucune intervention.';}catch(e){$('maintenance-status').textContent=e.message;}}
function renderQueue(){try{const rows=orderedQueue(readQueue(localStorage));const current=$('maintenance-select').value;fill($('maintenance-select'),rows.map(t=>[t.id,'P'+t.priority+' · '+t.repo+' · '+t.title+' · '+t.state]));if(rows.some(t=>t.id===current))$('maintenance-select').value=current;renderTask();busy(!!controller);}catch(e){$('maintenance-status').textContent=e.message;}}
function addTask(title,mission,priority){
 const row=makeTask(project,{id:globalThis.crypto.randomUUID?.()||String(Date.now()),title,mission,priority,at:new Date().toISOString()});
 saveQueue(localStorage,[...readQueue(localStorage),row]);renderQueue();$('maintenance-select').value=row.id;renderTask();busy(false);$('maintenance-status').textContent='Intervention ajoutée. Aucun appel IA.';
}
$('maintenance-add').addEventListener('click',()=>{if(controller)return;try{addTask($('maintenance-title').value,$('maintenance-mission').value,Number($('maintenance-priority').value));}catch(e){$('maintenance-status').textContent=e.message;}});
$('maintenance-from-roadmap').addEventListener('click',()=>{if(controller||!evolution)return;try{const task=evolution.tasks.find(t=>t.id===$('evolution-task').value);addTask(task.title,taskPrompt(evolution,task.id),task.priority);}catch(e){$('maintenance-status').textContent=e.message;}});
$('maintenance-select').addEventListener('change',renderTask);
$('maintenance-prepare').addEventListener('click',()=>{if(controller)return;try{$('prompt').value=prepareTask(selectedTask(),project);$('consent').checked=false;$('memory-use').checked=false;$('maintenance-status').textContent='Mission préparée, à relire avant lancement.';$('prompt').focus();}catch(e){$('maintenance-status').textContent=e.message;}});
$('maintenance-update').addEventListener('click',()=>{if(controller)return;try{const t=selectedTask();if(!t)throw Error('Sélection requise');const next=transitionTask(t,$('maintenance-state').value,$('maintenance-evidence').value);saveQueue(localStorage,readQueue(localStorage).map(r=>r.id===t.id?next:r));renderQueue();$('maintenance-status').textContent='État déclaré enregistré, pas une preuve indépendante.';}catch(e){$('maintenance-status').textContent=e.message;}});
renderQueue();

fill($('native-tool'),listNativeTools().filter(t=>!t.network).map(t=>[t.name,t.name+' — '+t.description]));
$('native-run').addEventListener('click',async()=>{
 if(!project||controller)return;
 try{const bus=createNativeBus({project,maxCalls:1});const r=await bus.call($('native-tool').value);$('native-result').textContent=JSON.stringify({result:r.result,journal:bus.journal()},null,2);}
 catch(e){$('native-result').textContent=e.message;}
});
