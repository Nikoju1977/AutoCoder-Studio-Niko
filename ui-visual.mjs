// Studio Niko Design — local, network-isolated static visual evidence.
import {chromium} from 'playwright';
import axe from 'axe-core';
import {pixelDiff} from './ui-pixels.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
// JavaScript engine enabled for trusted DevTools axe evaluation only; project scripts blocked by HTTP CSP and request routing.
function deadline(p,ms){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audit timeout')),ms);})]).finally(()=>clearTimeout(timer));}
const ORIGIN='https://niko-visual.invalid';
const pathOK=p=>typeof p==='string'&&p.length<=300&&/^[a-zA-Z0-9_./ -]+\.(html|css)$/i.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..');
export const VIEWPORTS=[{width:360,height:800},{width:768,height:1024},{width:1440,height:900}];
export function snapshots(bundle){
 if(bundle?.format!=='niko-ui-visual-v1'||!Array.isArray(bundle.original)||bundle.original.length<1||bundle.original.length>3||!Array.isArray(bundle.proposal?.changes)||bundle.proposal.changes.length>3)throw Error('Dossier visuel invalide');
 const before=new Map();
 for(const f of bundle.original){if(!pathOK(f.path)||before.has(f.path)||typeof f.content!=='string'||f.content.length>12000)throw Error('Fichier original invalide');before.set(f.path,f.content);}
 const after=new Map(before),seen=new Set();
 for(const f of bundle.proposal.changes){if(!before.has(f.path)||seen.has(f.path)||typeof f.content!=='string'||f.content.length>120000)throw Error('Candidat invalide');seen.add(f.path);after.set(f.path,f.content);}
 const entry=[...before.keys()].find(p=>/\.html$/i.test(p));
 if(!entry)throw Error('HTML absent : preuve visuelle indisponible');
 return {before,after,entry};
}
export function compareMetrics(before,after){
 const regressions=[];
 if(after.overflow>before.overflow+1)regressions.push('Débordement horizontal accru');
 if(after.visibleControls<before.visibleControls)regressions.push('Nombre de commandes visibles réduit');
 if(after.unnamedControls>before.unnamedControls)regressions.push('Commandes sans nom apparent supplémentaires');
 if(after.smallControls>before.smallControls)regressions.push('Petites cibles supplémentaires');
 if(after.lowContrast>before.lowContrast)regressions.push('Contrastes texte faibles supplémentaires (fonds simples)');
 if(after.positiveTabindex>before.positiveTabindex)regressions.push('Ordres de tabulation positifs supplémentaires');
 if(before.axe?.status==='measured'&&after.axe?.status==='measured'){
  const prior=new Map(before.axe.violations.map(v=>[v.id,v.nodes]));
  for(const v of after.axe.violations)if(v.nodes>(prior.get(v.id)||0))regressions.push('axe-core : '+v.id);
 }else if(before.axe?.status==='measured'&&after.axe?.status!=='measured')regressions.push('Mesure axe-core indisponible après modification');
 return regressions;
}
async function capture(browser,files,entry,viewport,screenshot){
 const ctx=await browser.newContext({viewport,javaScriptEnabled:true,serviceWorkers:'block',acceptDownloads:false,reducedMotion:'reduce'});
 try{
  const blocked=new Set();
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());let path='';
   try{path=decodeURIComponent(u.pathname.slice(1));}catch{}
   if(u.origin!==ORIGIN||!files.has(path)||route.request().method()!=='GET'||!['document','stylesheet'].includes(route.request().resourceType())){blocked.add(u.origin===ORIGIN?'ressource locale non incluse':'ressource externe');return route.abort();}
   return route.fulfill({status:200,contentType:/\.css$/i.test(path)?'text/css; charset=utf-8':'text/html; charset=utf-8',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'",'X-Content-Type-Options':'nosniff'},body:files.get(path)});
  });
  const page=await ctx.newPage();
  await page.goto(ORIGIN+'/'+entry.split('/').map(encodeURIComponent).join('/'),{waitUntil:'load',timeout:10000});
  const metrics=await page.evaluate(()=>{
   const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')];
   const visibleElement=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(r.width<=0||r.height<=0||s.visibility!=='visible'||s.display==='none')return false;for(let p=el;p;p=p.parentElement)if(Number(getComputedStyle(p).opacity)===0)return false;return true;};
   const visible=controls.filter(visibleElement);
   const named=el=>Boolean((el.getAttribute('aria-label')||((el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim())||el.textContent?.trim()||el.getAttribute('title')||el.getAttribute('alt')||[...(el.labels||[])].map(l=>l.textContent).join(' ')).trim());
   const small=el=>{const r=el.getBoundingClientRect();return r.width<24||r.height<24;};
   const rgb=value=>{const m=/^rgb\(\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\s*\)$/.exec(value);return m?m.slice(1).map(Number):null;};
   const luminance=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   let lowContrast=0,contrastChecked=0,contrastUnknown=0;
   for(const el of [...document.querySelectorAll('body *')].slice(0,2000)){
    if(!visibleElement(el)||!Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())||el.matches('script,style,svg,option'))continue;
    const cs=getComputedStyle(el),fg=rgb(cs.color);let bg=null,unknown=!fg;
    for(let p=el;p;p=p.parentElement){const st=getComputedStyle(p);
     if(st.backgroundImage!=='none'||Number(st.opacity)!==1||st.filter!=='none'||st.mixBlendMode!=='normal'){unknown=true;break;}
     const solid=rgb(st.backgroundColor);
     if(!bg&&solid)bg=solid;
     else if(!bg&&st.backgroundColor!=='rgba(0, 0, 0, 0)'){unknown=true;break;}
    }
    if(unknown||!bg){contrastUnknown++;continue;}
    contrastChecked++;
    const size=parseFloat(cs.fontSize),weight=parseInt(cs.fontWeight,10);
    if(contrast(fg,bg)<(size>=24||(size>=18.67&&weight>=700)?3:4.5))lowContrast++;
   }
   return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth,(document.body?.scrollWidth||0)-innerWidth,Math.ceil(document.body?.getBoundingClientRect().right||0)-innerWidth),visibleControls:visible.length,unnamedControls:visible.filter(e=>!named(e)).length,smallControls:visible.filter(small).length,smallButtons:visible.filter(e=>e.matches('button:not(:disabled)')&&small(e)).length,positiveTabindex:visible.filter(e=>e.tabIndex>0).length,lowContrast,contrastChecked,contrastUnknown};
  });
  await page.screenshot({path:screenshot,animations:'disabled',timeout:10000});
  let accessibility={status:'unavailable'};
  try{
   // DevTools evaluation injects only the pinned trusted audit library. Project scripts remain blocked by CSP.
   await deadline(page.evaluate(axe.source),10000);
   const a=await deadline(page.evaluate(async()=>await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations','incomplete','passes','inapplicable']})),15000);
   accessibility={status:'measured',version:axe.version,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),incomplete:a.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),passedRules:a.passes.length};
  }catch{accessibility={status:'unavailable',reason:'Injection ou audit axe-core non exécuté'};}
  return {...metrics,axe:accessibility,blockedResources:[...blocked]};
 }finally{await ctx.close();}
}
export async function auditVisual(bundle,out){
 const {before,after,entry}=snapshots(bundle);
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const results=[];
  for(const viewport of VIEWPORTS){
   const b='before-'+viewport.width+'.png',a='after-'+viewport.width+'.png';
   const old=await capture(browser,before,entry,viewport,join(out,b));
   const next=await capture(browser,after,entry,viewport,join(out,a));
   const diff='diff-'+viewport.width+'.png';
   const pixels=await pixelDiff(browser,join(out,b),join(out,a),join(out,diff));
   results.push({viewport,before:old,after:next,screenshots:{before:b,after:a,diff},pixels,regressions:compareMetrics(old,next)});
  }
  const report={kind:'static-visual-proof',entry,fullApplicationTested:false,accessibilityCertified:false,axeComplete:results.every(r=>r.before.axe.status==='measured'&&r.after.axe.status==='measured'),publicationAuthorized:false,status:results.some(r=>r.regressions.length)?'regression_detected':'manual_review_required',results,limitations:['Scripts projet interdits par CSP et routage; JavaScript DevTools réservé à l’audit','Ressources externes et fichiers non inclus bloqués','Contrôles de noms et tailles heuristiques; axe-core partiel, cas incomplets à revoir','Contrastes approximatifs sur fonds opaques simples uniquement; pas de test métier ni de performances runtime; taux de pixels modifiés ≠ qualité esthétique']};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
  return report;
 }finally{await browser.close();}
}
