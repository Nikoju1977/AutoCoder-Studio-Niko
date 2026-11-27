import {THEMES,validateTheme,cssVars,themeCSS,assessTheme,encodeTheme,decodeTheme} from './ui-theme.mjs';
const $=id=>document.getElementById(id);
const KEY='niko-ui-factory-v1';
const defaults=()=>({A:{...THEMES.cinematic},B:{...THEMES.minimal}});
let variants=defaults();
try{const raw=localStorage.getItem(KEY);if(raw&&raw.length<20000){const data=JSON.parse(raw);variants={A:validateTheme(data.A),B:validateTheme(data.B)};}}catch{}
const active=()=>$('variant').value;
const labels={bg:'Fond',surface:'Carte',text:'Texte',muted:'Texte secondaire',accent:'Accent',line:'Bordure'};
const previewNodes={},scoreNodes={};
for(const [key,label] of Object.entries(labels)){
 const wrap=document.createElement('div'),lab=document.createElement('label'),input=document.createElement('input');lab.htmlFor=key;lab.textContent=label;input.id=key;input.type='color';wrap.append(lab,input);$('fields').append(wrap);
 input.addEventListener('input',()=>{variants[active()]=validateTheme({...variants[active()],[key]:input.value});render();});
}
for(const v of ['A','B']){
 const p=document.createElement('section');p.className='niko-ui niko-custom factory-preview';p.id='preview-'+v;p.setAttribute('aria-label','Aperçu '+v);
 // Static trusted template; user-entered values are applied only as validated CSS properties.
 p.innerHTML='<h3>Variante '+v+'</h3><div class="niko-grid"><section class="niko-card"><h4>Creative workspace</h4><p class="niko-muted">Projet de démonstration</p><div class="niko-toolbar"><button type="button" class="niko-button niko-primary">Lire</button><button type="button" class="niko-button">Stop</button></div><p class="niko-status" role="status">Arrêt</p><label>Nom du projet<input class="niko-input" value="Studio Niko"></label><label>Niveau<input class="niko-input" type="range" value="65"></label><div class="niko-track"><span>Vidéo</span><div class="niko-clip">Plan A</div></div><div class="niko-viewport">Aperçu statique</div></section></div>';
 const [play,stop]=p.querySelectorAll('button'),status=p.querySelector('[role=status]');play.onclick=()=>status.textContent='Lecture démo';stop.onclick=()=>status.textContent='Arrêt';
 $('previews').append(p);previewNodes[v]=p;
 const score=document.createElement('section');score.className='factory-score';$('scores').append(score);scoreNodes[v]=score;
}
function render(){
 for(const v of ['A','B']){
  for(const [k,val] of Object.entries(cssVars(variants[v])))previewNodes[v].style.setProperty(k,val);
  const rows=assessTheme(variants[v]),node=scoreNodes[v],h=document.createElement('h3'),list=document.createElement('ul');h.textContent=v+' · '+rows.filter(r=>r.pass).length+'/'+rows.length+' contrastes';
  for(const r of rows){const li=document.createElement('li');li.className=r.pass?'pass':'fail';li.textContent=(r.pass?'OK ':'À corriger ')+r.label+' : '+r.ratio.toFixed(2)+':1 (cible '+r.target+':1)';list.append(li);}
  node.replaceChildren(h,list);
 }
 for(const k of [...Object.keys(labels),'scheme','radius','gap','motion'])$(k).value=variants[active()][k];
 for(const k of ['radius','gap','motion'])$(k+'-value').textContent=String(variants[active()][k]);
}
$('variant').onchange=render;
$('apply').onclick=()=>{variants[active()]={...THEMES[$('preset').value]};render();};
$('scheme').onchange=()=>{variants[active()]=validateTheme({...variants[active()],scheme:$('scheme').value});render();};
for(const k of ['radius','gap','motion'])$(k).oninput=()=>{variants[active()]=validateTheme({...variants[active()],[k]:Number($(k).value)});render();};
$('device').onchange=()=>$('previews').dataset.device=$('device').value;
$('copy').onclick=()=>{variants[active()==='A'?'B':'A']={...variants[active()]};render();$('status').textContent='Variante copiée.';};
$('reset-theme').onclick=()=>{variants[active()]=defaults()[active()];render();};
$('save').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(variants));$('status').textContent='Deux variantes enregistrées sur cet appareil.';}catch{$('status').textContent='Stockage indisponible.';}};
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('export-css').onclick=()=>download('niko-theme-'+active()+'.css',themeCSS(variants[active()]),'text/css');
$('export-json').onclick=()=>download('niko-theme-'+active()+'.json',encodeTheme(variants[active()]),'application/json');
$('import-theme').onchange=async()=>{const file=$('import-theme').files[0],target=active();if(!file)return;try{if(file.size>10000)throw Error('Fichier trop volumineux');variants[target]=decodeTheme(await file.text());render();$('status').textContent='Thème importé dans '+target+'.';}catch{$('status').textContent='Import refusé : thème invalide.';}finally{$('import-theme').value='';}};
render();
