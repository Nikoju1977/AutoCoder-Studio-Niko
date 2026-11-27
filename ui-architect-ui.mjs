import {inspectRepo,loadPair,createVariant,comparisonBundle,authorizeVariant} from './ui-architect.mjs';
import {THEMES,decodeTheme} from './ui-theme.mjs';
import {bridgeStatus,sendReview} from './review-bridge-client.mjs';
const $=id=>document.getElementById(id);
let snap=null,project=null,entries=null,busy=false,custom={A:null,B:null};
function sync(){
 $('inspect').disabled=busy;$('repo').disabled=busy;
 for(const id of ['html-path','css-path'])$(id).disabled=busy||!snap;
 $('load').disabled=busy||!snap||!$('html-path').value||!$('css-path').value;
 for(const id of ['theme-a','theme-b','custom-a','custom-b','selected'])$(id).disabled=busy;
 $('generate').disabled=busy||!project;$('export-compare').disabled=busy||!entries;
 $('approved').disabled=busy||!entries;$('send').disabled=$('export').disabled=busy||!entries||!$('approved').checked;
}
function clearCandidate(){entries=null;$('approved').checked=false;$('diff-a').textContent=$('diff-b').textContent='';$('receipt').textContent='Revue requise.';sync();}
function clearProject(){project=null;$('baseline').textContent='';clearCandidate();}
for(const id of ['theme-a','theme-b']){for(const n of Object.keys(THEMES)){const o=document.createElement('option');o.value=n;o.textContent=n;$(id).append(o);}$(id).onchange=()=>{custom[id.endsWith('a')?'A':'B']=null;clearCandidate();};}
$('theme-b').value='minimal';
for(const v of ['A','B'])$('custom-'+v.toLowerCase()).onchange=async e=>{const f=e.target.files[0];clearCandidate();if(!f)return;busy=true;sync();try{if(f.size>10000)throw Error('Fichier trop volumineux');custom[v]=decodeTheme(await f.text());$('status').textContent='Thème personnalisé '+v+' chargé.';}catch(err){custom[v]=null;$('status').textContent=err.message;}finally{e.target.value='';busy=false;sync();}};
function fill(id,files){$(id).replaceChildren();for(const f of files){const o=document.createElement('option');o.value=f.path;o.textContent=f.path+' · '+f.size+' octets';$(id).append(o);}}
$('repo').oninput=()=>{snap=null;clearProject();fill('html-path',[]);fill('css-path',[]);sync();};
$('html-path').onchange=$('css-path').onchange=clearProject;
async function task(fn){if(busy)return;busy=true;sync();try{await fn();}catch(e){$('status').textContent=String(e.message||e).slice(0,200);}finally{busy=false;sync();}}
$('inspect').onclick=()=>task(async()=>{snap=null;clearProject();fill('html-path',[]);fill('css-path',[]);$('status').textContent='Lecture publique GitHub…';snap=await inspectRepo($('repo').value);fill('html-path',snap.files.filter(f=>/\.html$/i.test(f.path)));fill('css-path',snap.files.filter(f=>/\.css$/i.test(f.path)));$('status').textContent=snap.repo+' @ '+snap.commit+' · '+snap.files.length+' fichiers admissibles.';});
$('load').onclick=()=>task(async()=>{clearProject();project=await loadPair(snap,$('html-path').value,$('css-path').value);$('baseline').textContent=project.github.mapping.map(m=>m.path+' @ '+m.sha).join(' | ');$('status').textContent='Paire chargée, aucune exécution.';});
$('generate').onclick=()=>{if(busy||!project)return;clearCandidate();try{entries={A:createVariant(project,custom.A||THEMES[$('theme-a').value]),B:createVariant(project,custom.B||THEMES[$('theme-b').value])};for(const v of ['A','B']){const c=entries[v].proposal.changes[0],old=entries[v].original.find(f=>f.path===c.path);$('diff-'+v.toLowerCase()).textContent=c.path+'\n'+c.content.slice(old.content.length);}$('status').textContent='Deux candidats prêts pour analyse locale ; aucun test exécuté.';}catch(e){$('status').textContent=e.message;}sync();};
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('export-compare').onclick=()=>{if(entries&&!busy)download('niko-ui-comparison.json',comparisonBundle(entries.A,entries.B));};
$('selected').onchange=()=>{$('approved').checked=false;sync();};$('approved').onchange=sync;
$('export').onclick=()=>{if(entries&&!busy&&$('approved').checked)download('niko-ui-proposal.json',authorizeVariant(entries[$('selected').value],true));};
$('send').onclick=()=>task(async()=>{if(!entries||!$('approved').checked)return;const p=authorizeVariant(entries[$('selected').value],true);const b=await bridgeStatus();if(!b.ready)throw Error('Passerelle privée indisponible');const r=await sendReview(p,true);const a=document.createElement('a');a.href=r.url;a.textContent='Ticket privé #'+r.number;a.target='_blank';a.rel='noopener noreferrer';$('receipt').replaceChildren(a);$('approved').checked=false;});
sync();
