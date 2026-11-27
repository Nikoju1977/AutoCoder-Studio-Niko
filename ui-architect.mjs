// V6 — bounded, deterministic CSS redesign proposals; no repository write.
import {parseRepo,listPublicRepo,loadPublicSelection,githubProposal,readPublicAuditBlob} from './code-mode-x-github.mjs';
import {runAgentTeam} from './code-mode-x-team.mjs';
import {selectPaths,sensitiveRepo,approvedExport,requestAgnes} from './autopilot.mjs';
import {assertUiChanges,uiBrief} from './ui-engine.mjs';
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
 const repo=targetRepo(input),snapshot=await loadRepo(repo,{signal,deepAudit:true});
 if(snapshot.partial)throw Error('Inventaire incomplet : sélectionner manuellement hors outil');
 return {...snapshot,stack:detectStack(snapshot.allPaths||snapshot.files.map(f=>f.path)),manifest:snapshot.files.find(f=>f.path==='package.json'&&f.size<=12000)||null,files:eligibleFiles(snapshot)};
}
export function detectStack(paths,manifest={}){
 const deps={...manifest.dependencies,...manifest.devDependencies};
 const p=Array.isArray(paths)?paths:[];
 const flags={react:Object.hasOwn(deps,'react')||p.some(x=>/\.[jt]sx$/i.test(x)),vue:Object.hasOwn(deps,'vue')||p.some(x=>/\.vue$/i.test(x)),tailwind:Object.hasOwn(deps,'tailwindcss')||p.some(x=>/(^|\/)tailwind\.config\./i.test(x)),svelte:Object.hasOwn(deps,'svelte')||p.some(x=>/\.svelte$/i.test(x))};
 return {frameworks:Object.keys(flags).filter(k=>flags[k]),components:p.filter(x=>/\.(?:jsx|tsx|vue|svelte)$/i.test(x)).length,scope:'indices de fichiers et dépendances, pas de compilation'};
}
export async function inspectManifest(snapshot,{signal,read=readPublicAuditBlob}={}){
 targetRepo(snapshot.repo);
 if(!snapshot.manifest)return snapshot.stack||detectStack(snapshot.allPaths||[]);
 const raw=await read({...snapshot,files:[snapshot.manifest]},'package.json',{signal});
 return detectStack(snapshot.allPaths||[],JSON.parse(raw.content));
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
export async function loadPair(snapshot,htmlPath,cssPath,{signal,loadFiles=loadPublicSelection,extraCss}={}){
 targetRepo(snapshot.repo);
 const allowed=new Set(eligibleFiles(snapshot).map(f=>f.path));
 if(!allowed.has(htmlPath)||!allowed.has(cssPath)||! /\.html$/i.test(htmlPath)||! /\.css$/i.test(cssPath))throw Error('Sélection HTML/CSS invalide');
 if(extraCss&&(!allowed.has(extraCss)||extraCss===cssPath||! /\.css$/i.test(extraCss)))throw Error('Seconde feuille CSS invalide');
 const project=await loadFiles(snapshot,[htmlPath,cssPath,...(extraCss?[extraCss]:[])],{signal});
 const html=project.files.find(f=>f.name===project.github.mapping.find(m=>m.path===htmlPath)?.name)?.content;
 if(!linkedStylesheet(html||'',htmlPath,cssPath)||(extraCss&&!linkedStylesheet(html||'',htmlPath,extraCss)))throw Error('Lien CSS non reconnu dans le HTML : revue manuelle');
 return project;
}
export function redesignCSS(theme){
 const t=validateTheme(theme),vars=Object.entries(cssVars(t)).map(([k,v])=>k+':'+v).join(';');
 return '\n'+MARK+'\n:root{'+vars+'}\nbody{background-color:var(--niko-bg);color:var(--niko-text)}\nbutton:not(:disabled),input:not([type=hidden]),select,textarea{color:var(--niko-text);background-color:var(--niko-surface);border-color:var(--niko-line);border-radius:var(--niko-radius)}\na{color:var(--niko-accent)}\n:focus-visible{outline:2px solid var(--niko-accent);outline-offset:3px}\n';
}
export function createVariant(project,theme){
 targetRepo(project.github.repo);
 const sheets=project.github.mapping.filter(m=>/\.css$/i.test(m.path)),map=sheets[0];
 if(!map||sheets.length>2||project.github.mapping.length!==sheets.length+1)throw Error('Un HTML et une à deux feuilles CSS requis');
 const old=project.files.find(f=>f.name===map.name);
 if(!old||old.content.includes(MARK))throw Error('Style déjà traité ou absent');
 const content=old.content+redesignCSS(theme);
 if(new TextEncoder().encode(content).length>12000)throw Error('Candidat trop volumineux pour la revue');
 const secondary=sheets[1];
 const extra=secondary?project.files.find(f=>f.name===secondary.name):null;
 const extraContent=extra?extra.content+'\n'+MARK+'\n:focus-visible{outline-offset:3px}\n':null;
 if(extra&&(extra.content.includes(MARK)||new TextEncoder().encode(extraContent).length>12000))throw Error('Seconde feuille non admissible');
 const proposal=githubProposal(project,{status:'review_required',proposal:project.files.map(f=>f.name===map.name?{...f,content}:f.name===secondary?.name?{...f,content:extraContent}:f)});
 assertUiChanges(project,proposal);
 return {status:'review_required',proposal,original:project.github.mapping.map(m=>({path:m.path,content:project.files.find(f=>f.name===m.name).content}))};
}
export function comparisonBundle(a,b){
 if(a.proposal.commit!==b.proposal.commit||a.proposal.repo!==b.proposal.repo||JSON.stringify(a.original)!==JSON.stringify(b.original))throw Error('Versions incompatibles');
 return {format:'niko-ui-compare-v1',variants:{A:{format:'niko-ui-visual-v1',original:a.original,proposal:a.proposal},B:{format:'niko-ui-visual-v1',original:b.original,proposal:b.proposal}}};
}
export function authorizeVariant(entry,approved){return approvedExport(entry,approved);}

export async function createAgentVariant(project,profile,{approved=false,request=requestAgnes,signal}={}){
 targetRepo(project.github.repo);
 if(approved!==true)throw Error('Consentement fournisseur requis');
 if(!['cinematic','audio','spatial','luxury','minimal','clinical'].includes(profile))throw Error('Profil invalide');
 const css=project.files.filter(f=>f.name.endsWith('.css'));
 if(!css.length||css.length>2)throw Error('Une à deux feuilles CSS requises');
 let calls=0;
 const r=await runAgentTeam({prompt:uiBrief(profile)+' Modifie uniquement les feuilles CSS fournies. Conserve leurs alias exacts, aucune nouvelle ressource ni changement HTML ou JavaScript. Retourne les feuilles complètes.',files:css,maxAttempts:1,innovation:true,signal,request:async args=>{if(calls>=4||signal?.aborted)throw Error('Budget atteint');calls++;return request(args);}});
 if(r.status!=='review_required'||r.proposal.some(f=>!css.some(x=>x.name===f.name)))throw Error('Variante IA non admissible');
 const proposal=githubProposal(project,{status:'review_required',proposal:project.files.map(f=>r.proposal.find(x=>x.name===f.name)||f)});
 assertUiChanges(project,proposal);
 if(!proposal.changes.length||proposal.changes.some(c=>!c.path.endsWith('.css')||new TextEncoder().encode(c.content).length>12000))throw Error('Aucun changement admissible ou budget dépassé');
 return {status:'review_required',proposal,calls,original:project.github.mapping.map(m=>({path:m.path,content:project.files.find(f=>f.name===m.name).content}))};
}
