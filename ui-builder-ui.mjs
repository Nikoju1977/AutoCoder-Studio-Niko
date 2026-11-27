import {TYPES,blank,history,decodeLayout,exportLayout,componentMarkup,ACTIONS,bindRuntime,applicationTemplate} from './ui-builder.mjs';
import {generateLayout,pwaFiles,zipFiles} from './ui-app-factory.mjs';
import {THEMES,cssVars} from './ui-theme.mjs';
const $=id=>document.getElementById(id),KEY='niko-visual-builder-v1';
let initial=blank();
try{const raw=localStorage.getItem(KEY);if(raw)initial=decodeLayout(raw);}catch{}
const state=history(initial);
let selected=null,drag=null,testMode=false;
for(const [id,values] of [['theme',Object.keys(THEMES).map(k=>[k,k])],['kind',Object.entries(TYPES)]]){
 for(const [k,v] of values){const o=document.createElement('option');o.value=k;o.textContent=v;$(id).append(o);}
}
function apply(action){try{state.apply(action);render();}catch(e){$('status').textContent=e.message;}}
function select(id){selected=id;render();}
function render(){
 const d=state.value;
 if(!d.items.some(i=>i.id===selected))selected=d.items[0]?.id||null;
 const item=d.items.find(i=>i.id===selected),idx=d.items.indexOf(item);
 $('title').value=d.title;$('canvas-title').textContent=d.title;
 for(const [k,v] of Object.entries(cssVars(d.theme)))$('canvas').style.setProperty(k,v);
 $('theme').value=Object.keys(THEMES).find(k=>JSON.stringify(THEMES[k])===JSON.stringify(d.theme))||'';
 $('layers').replaceChildren();$('grid').replaceChildren();
 for(const x of d.items){
  const b=document.createElement('button');b.type='button';b.textContent=TYPES[x.type]+' · '+x.text;b.draggable=true;b.dataset.id=x.id;b.setAttribute('aria-pressed',String(x.id===selected));
  b.onclick=()=>select(x.id);b.ondragstart=e=>{drag=x.id;e.dataTransfer.setData('text/plain',x.id);e.dataTransfer.effectAllowed='move';};
  b.ondragend=()=>{drag=null;};b.ondragover=e=>{if(drag)e.preventDefault();};
  b.ondrop=e=>{e.preventDefault();if(!drag)return;const id=drag;drag=null;apply({type:'move',id,to:state.value.items.findIndex(i=>i.id===x.id)});select(id);};
  $('layers').append(b);
  const el=document.createElement('div');el.className='builder-item';el.dataset.id=x.id;el.dataset.nikoNode=x.id;el.setAttribute('aria-current',String(x.id===selected));el.style.gridColumn='span '+x.span;el.style.minHeight=x.height+'px';
  // Markup generator escapes all user text and only emits predefined native elements.
  el.innerHTML=componentMarkup(x);if(!testMode)el.onclick=()=>select(x.id);$('grid').append(el);
 }
 if(testMode)bindRuntime($('grid'),d.items.filter(x=>x.action).map(x=>({id:x.id,action:x.action})));
 const action=item?.action;
 $('action-kind').replaceChildren(new Option('Aucune',''),...Object.entries(ACTIONS).map(([k,v])=>new Option(v,k)));
 $('action-kind').value=action?.kind||'';
 $('action-kind').disabled=item?.type!=='button'||testMode;
 fillTargets(d,action?.kind||'',action?.target,action?.source);
 $('action-save').disabled=item?.type!=='button'||testMode;
 $('test-mode').textContent=testMode?'Quitter le test':'Tester les interactions';
 for(const id of ['label-text','span','height','remove'])$(id).disabled=!item;
 $('up').disabled=!item||idx===0;$('down').disabled=!item||idx===d.items.length-1;
 $('undo').disabled=!state.canUndo;$('redo').disabled=!state.canRedo;$('add').disabled=d.items.length>=50;
 $('label-text').value=item?.text||'';$('span').value=item?.span||6;$('height').value=item?.height||64;
 $('span-value').textContent=item?String(item.span):'—';$('height-value').textContent=item?String(item.height):'—';
}
function fillTargets(d,kind,target='',source=''){
 const type={copy:'output',append:'list',increment:'progress',reset:'progress',clear:'list'}[kind];
 $('action-target').replaceChildren(new Option('Sélectionner',''),...d.items.filter(x=>x.type===type).map(x=>new Option(x.text+' ('+x.id+')',x.id)));
 $('action-source').replaceChildren(new Option('Sélectionner',''),...d.items.filter(x=>x.type==='input').map(x=>new Option(x.text+' ('+x.id+')',x.id)));
 $('action-target').value=target;$('action-source').value=source;
 $('action-target').disabled=!type||testMode;$('action-source').disabled=!['copy','append'].includes(kind)||testMode;
}
$('action-kind').onchange=()=>fillTargets(state.value,$('action-kind').value);
$('action-save').onclick=()=>{const kind=$('action-kind').value;apply({type:'edit',id:selected,action:kind?{kind,target:$('action-target').value,source:$('action-source').value}:null});};
$('test-mode').onclick=()=>{testMode=!testMode;render();$('status').textContent=testMode?'Test local : les données de saisie sont temporaires.':'Mode édition.';};
$('load-template').onclick=()=>{if(state.value.items.length&&!confirm('Remplacer la composition actuelle ? Annuler reste disponible.'))return;testMode=false;state.replace(applicationTemplate($('template').value));selected=null;render();};
$('title').onchange=()=>apply({type:'title',value:$('title').value});
$('theme').onchange=()=>{if(THEMES[$('theme').value])apply({type:'theme',value:THEMES[$('theme').value]});};
$('add').onclick=()=>{apply({type:'add',kind:$('kind').value});select(state.value.items.at(-1)?.id);};
$('label-text').onchange=()=>apply({type:'edit',id:selected,text:$('label-text').value});
for(const k of ['span','height']){$(k).oninput=()=>{$(k+'-value').textContent=$(k).value;const el=[...$('grid').children].find(x=>x.dataset.id===selected);if(el){if(k==='span')el.style.gridColumn='span '+$(k).value;else el.style.minHeight=$(k).value+'px';}};$(k).onchange=()=>apply({type:'edit',id:selected,[k]:Number($(k).value)});}
for(const [id,offset] of [['up',-1],['down',1]])$(id).onclick=()=>apply({type:'move',id:selected,to:state.value.items.findIndex(x=>x.id===selected)+offset});
$('remove').onclick=()=>apply({type:'remove',id:selected});
$('undo').onclick=()=>{state.undo();render();};$('redo').onclick=()=>{state.redo();render();};
$('device').onchange=()=>$('canvas').dataset.device=$('device').value;
$('save').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(state.value));$('status').textContent='Projet sauvegardé.';}catch{$('status').textContent='Stockage indisponible.';}};
function download(name,value,type){const url=URL.createObjectURL(new Blob([value],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('generate-prompt').onclick=async()=>{
 if(!$('prompt-consent').checked)return;
 $('generate-prompt').disabled=true;$('prompt-consent').disabled=true;
 try{const candidate=await generateLayout($('prompt').value,{approved:true,signal:AbortSignal.timeout(65000)});
  if(state.value.items.length&&!confirm('Remplacer la composition actuelle par la proposition IA ?'))return;
  testMode=false;state.replace(candidate);selected=null;render();$('status').textContent='Composition IA importée. Vérifier les liaisons et tester avant export.';
 }catch(e){$('status').textContent=String(e.message||e).slice(0,200);}
 finally{$('generate-prompt').disabled=false;$('prompt-consent').disabled=false;$('prompt-consent').checked=false;}
};
$('export-pwa').onclick=()=>{try{download('niko-app-pwa.zip',zipFiles(pwaFiles(state.value,{persistent:$('persist-lists').checked})),'application/zip');$('status').textContent='Archive PWA préparée. Extraire et servir via HTTPS ou localhost.';}catch(e){$('status').textContent=e.message;}};
$('export-json').onclick=()=>download('niko-layout.json',JSON.stringify(state.value,null,2),'application/json');
$('export-html').onclick=()=>download('index.html',exportLayout(state.value).html,'text/html');
$('export-js').onclick=()=>download('app.js',exportLayout(state.value).js,'text/javascript');
$('export-css').onclick=()=>download('layout.css',exportLayout(state.value).css,'text/css');
$('import').onchange=async()=>{const f=$('import').files[0];if(!f)return;try{if(f.size>100000)throw Error('Taille dépassée');state.replace(decodeLayout(await f.text()));render();$('status').textContent='Projet importé.';}catch{$('status').textContent='Import refusé : projet invalide.';}finally{$('import').value='';}};
render();
