// Studio Niko Design — V8 responsive layout builder, pure data model.
import {THEMES,cssVars,validateTheme} from './ui-theme.mjs';
export const TYPES=Object.freeze({heading:'Titre',text:'Texte',card:'Carte',button:'Bouton',input:'Champ',progress:'Progression',viewport:'Aperçu'});
const cleanText=v=>{if(typeof v!=='string'||v.length>300)throw Error('Texte invalide');return v;};
const integer=(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error('Dimension invalide');return v;};
export function normalize(doc){
 if(doc?.format!=='niko-layout-v1'||!Array.isArray(doc.items)||doc.items.length>50)throw Error('Projet invalide');
 const seen=new Set();
 const items=doc.items.map(x=>{
  if(!x||!/^n[1-9]\d{0,7}$/.test(x.id)||seen.has(x.id)||!Object.hasOwn(TYPES,x.type))throw Error('Composant invalide');
  seen.add(x.id);return {id:x.id,type:x.type,text:cleanText(x.text),span:integer(x.span,1,12),height:integer(x.height,44,480)};
 });
 return {format:'niko-layout-v1',title:cleanText(doc.title),theme:validateTheme(doc.theme),items};
}
export function blank(){return normalize({format:'niko-layout-v1',title:'Creative Workspace',theme:THEMES.cinematic,items:[]});}
export function change(doc,action){
 const d=normalize(doc);
 const i=d.items.findIndex(x=>x.id===action.id);
 if(action.type==='add'){
  if(!Object.hasOwn(TYPES,action.kind)||d.items.length>=50)throw Error('Ajout impossible');
  const id='n'+(1+Math.max(0,...d.items.map(x=>Number(x.id.slice(1)))));
  d.items.push({id,type:action.kind,text:TYPES[action.kind],span:action.kind==='heading'?12:6,height:action.kind==='viewport'?180:64});
 }else if(action.type==='title')d.title=action.value;
 else if(action.type==='theme')d.theme=action.value;
 else{
  if(i<0)throw Error('Composant absent');
  if(action.type==='remove')d.items.splice(i,1);
  else if(action.type==='move'){const to=integer(action.to,0,d.items.length-1);const [item]=d.items.splice(i,1);d.items.splice(to,0,item);}
  else if(action.type==='edit'){for(const k of ['text','span','height'])if(Object.hasOwn(action,k))d.items[i][k]=action[k];}
  else throw Error('Action inconnue');
 }
 return normalize(d);
}
export function history(initial=blank()){
 let current=normalize(initial),past=[],future=[];
 return {get value(){return normalize(current);},get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
  apply(action){return this.replace(change(current,action));},
  replace(doc){const next=normalize(doc);if(JSON.stringify(next)===JSON.stringify(current))return this.value;past.push(current);if(past.length>50)past.shift();current=next;future=[];return this.value;},
  undo(){if(past.length){future.push(current);current=past.pop();}return this.value;},
  redo(){if(future.length){past.push(current);current=future.pop();}return this.value;}
 };
}
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function componentMarkup(item){
 const text=esc(item.text);
 switch(item.type){
  case 'heading':return '<h2>'+text+'</h2>';
  case 'text':return '<p>'+text+'</p>';
  case 'card':return '<section><h2>'+text+'</h2></section>';
  case 'button':return '<button type="button" disabled>'+text+'</button>';
  case 'input':return '<label>'+text+'<input type="text"></label>';
  case 'progress':return '<label>'+text+'<progress max="100" value="65">65 %</progress></label>';
  case 'viewport':return '<div class="viewport">'+text+'</div>';
  default:throw Error('Type invalide');
 }
}
export const BASE_CSS='*{box-sizing:border-box}body{margin:0;font:1rem/1.5 system-ui,sans-serif;background:var(--niko-bg);color:var(--niko-text)}main{max-width:1200px;margin:auto;padding:clamp(16px,4vw,48px)}.layout-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--niko-gap)}.layout-item{min-width:0;padding:16px;background:var(--niko-surface);border:1px solid var(--niko-line);border-radius:var(--niko-radius);overflow-wrap:anywhere}.layout-item h2,.layout-item p{margin:0 0 8px}input,button,progress{max-width:100%;font:inherit}input,button{min-height:44px;background:var(--niko-bg);color:var(--niko-text);border:1px solid var(--niko-line);border-radius:8px;padding:8px}input,progress{display:block;width:100%}button:disabled{opacity:.7}.viewport{display:grid;place-items:center;min-height:100px;border:1px dashed var(--niko-line)}:focus-visible{outline:3px solid var(--niko-accent);outline-offset:3px}@media(max-width:600px){.layout-grid{grid-template-columns:minmax(0,1fr)}.layout-item{grid-column:1!important}}';
export function exportLayout(doc){
 const d=normalize(doc);
 const css='/* Studio Niko Design V8 */\n:root{'+Object.entries(cssVars(d.theme)).map(([k,v])=>k+':'+v).join(';')+'}\n'+BASE_CSS+'\n'+d.items.map(x=>'#'+x.id+'{grid-column:span '+x.span+';min-height:'+x.height+'px}').join('\n');
 const html='<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(d.title)+'</title><link rel="stylesheet" href="layout.css"></head><body><main><h1>'+esc(d.title)+'</h1><div class="layout-grid">'+d.items.map(x=>'<div class="layout-item" id="'+x.id+'">'+componentMarkup(x)+'</div>').join('\n')+'</div></main></body></html>';
 return {html,css};
}
export function decodeLayout(raw){if(typeof raw!=='string'||raw.length>100000)throw Error('Fichier invalide');return normalize(JSON.parse(raw));}
