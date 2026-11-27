// V6 — bounded, deterministic CSS redesign proposals; no repository write.
import {parseRepo,listPublicRepo,loadPublicSelection,githubProposal} from './code-mode-x-github.mjs';
import {selectPaths,sensitiveRepo,approvedExport} from './autopilot.mjs';
import {assertUiChanges} from './ui-engine.mjs';
import {validateTheme,cssVars} from './ui-theme.mjs';
const MARK='/* Studio Niko UI Architect V6 */';
export function targetRepo(input){
 const repo=parseRepo(input);
 if(!/^Nikoju1977\/[a-z0-9][a-z0-9._-]{0,99}$/i.test(repo)||sensitiveRepo(repo)||/\/Studio-Niko-Autopilot-Inbox$/i.test(repo))throw Error('Dépôt hors périmètre : propriétaire ou projet sensible');
 return repo;
}
const pathOK=p=>typeof p==='string'&&p.length<=240&&/^[A-Za-z0-9_./ -]+$/.test(p)&&p.split('/').every(x=>x&&!x.startsWith('.'));
export function eligibleFiles(snapshot){
 return snapshot.files.filter(f=>pathOK(f.path)&&selectPaths({files:[f]},'minimal').length===1);
}
export async function inspectRepo(input,{signal,loadRepo=listPublicRepo}={}){
 const repo=targetRepo(input),snapshot=await loadRepo(repo,{signal});
 if(snapshot.partial)throw Error('Inventaire incomplet : sélectionner manuellement hors outil');
 return {...snapshot,files:eligibleFiles(snapshot)};
}
export function linkedStylesheet(html,htmlPath,cssPath){
 if(/<base\b/i.test(html))return false;
 const root=new URL(htmlPath.split('/').map(encodeURIComponent).join('/'),'https://niko.invalid/');
 return [...html.matchAll(/<link\b[^>]*>/gi)].some(([tag])=>{
  const attr=name=>new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i').exec(tag)?.slice(1).find(x=>x!==undefined);
  const href=attr('href');
  if(attr('rel')?.toLowerCase()!=='stylesheet'||!href||/^(?:[a-z]+:|\/\/)/i.test(href))return false;
  try{const u=new URL(href,root);return u.origin===root.origin&&decodeURIComponent(u.pathname.slice(1))===cssPath;}catch{return false;}
 });
}
export async function loadPair(snapshot,htmlPath,cssPath,{signal,loadFiles=loadPublicSelection}={}){
 targetRepo(snapshot.repo);
 const allowed=new Set(eligibleFiles(snapshot).map(f=>f.path));
 if(!allowed.has(htmlPath)||!allowed.has(cssPath)||! /\.html$/i.test(htmlPath)||! /\.css$/i.test(cssPath))throw Error('Sélection HTML/CSS invalide');
 const project=await loadFiles(snapshot,[htmlPath,cssPath],{signal});
 const html=project.files.find(f=>f.name===project.github.mapping.find(m=>m.path===htmlPath)?.name)?.content;
 if(!linkedStylesheet(html||'',htmlPath,cssPath))throw Error('Lien CSS non reconnu dans le HTML : revue manuelle');
 return project;
}
export function redesignCSS(theme){
 const t=validateTheme(theme),vars=Object.entries(cssVars(t)).map(([k,v])=>k+':'+v).join(';');
 return '\n'+MARK+'\n:root{'+vars+'}\nbody{background-color:var(--niko-bg);color:var(--niko-text)}\nbutton:not(:disabled),input:not([type=hidden]),select,textarea{color:var(--niko-text);background-color:var(--niko-surface);border-color:var(--niko-line);border-radius:var(--niko-radius)}\na{color:var(--niko-accent)}\n:focus-visible{outline:2px solid var(--niko-accent);outline-offset:3px}\n';
}
export function createVariant(project,theme){
 targetRepo(project.github.repo);
 const map=project.github.mapping.find(m=>/\.css$/i.test(m.path));
 if(!map||project.github.mapping.length!==2)throw Error('Paire HTML/CSS requise');
 const old=project.files.find(f=>f.name===map.name);
 if(!old||old.content.includes(MARK))throw Error('Style déjà traité ou absent');
 const content=old.content+redesignCSS(theme);
 if(new TextEncoder().encode(content).length>12000)throw Error('Candidat trop volumineux pour la revue');
 const proposal=githubProposal(project,{status:'review_required',proposal:project.files.map(f=>f.name===map.name?{...f,content}:f)});
 assertUiChanges(project,proposal);
 return {status:'review_required',proposal,original:project.github.mapping.map(m=>({path:m.path,content:project.files.find(f=>f.name===m.name).content}))};
}
export function comparisonBundle(a,b){
 if(a.proposal.commit!==b.proposal.commit||a.proposal.repo!==b.proposal.repo||JSON.stringify(a.original)!==JSON.stringify(b.original))throw Error('Versions incompatibles');
 return {format:'niko-ui-compare-v1',variants:{A:{format:'niko-ui-visual-v1',original:a.original,proposal:a.proposal},B:{format:'niko-ui-visual-v1',original:b.original,proposal:b.proposal}}};
}
export function authorizeVariant(entry,approved){return approvedExport(entry,approved);}
