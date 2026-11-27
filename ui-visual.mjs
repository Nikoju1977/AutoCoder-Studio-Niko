// Studio Niko Design — local, network-isolated static visual evidence.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
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
 return regressions;
}
async function capture(browser,files,entry,viewport,screenshot){
 const ctx=await browser.newContext({viewport,javaScriptEnabled:false,serviceWorkers:'block',acceptDownloads:false,reducedMotion:'reduce'});
 try{
  const blocked=new Set();
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());let path='';
   try{path=decodeURIComponent(u.pathname.slice(1));}catch{}
   if(u.origin!==ORIGIN||!files.has(path)||route.request().method()!=='GET'){blocked.add(u.origin===ORIGIN?'ressource locale non incluse':'ressource externe');return route.abort();}
   return route.fulfill({status:200,contentType:/\.css$/i.test(path)?'text/css; charset=utf-8':'text/html; charset=utf-8',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'",'X-Content-Type-Options':'nosniff'},body:files.get(path)});
  });
  const page=await ctx.newPage();
  await page.goto(ORIGIN+'/'+entry.split('/').map(encodeURIComponent).join('/'),{waitUntil:'load',timeout:10000});
  const metrics=await page.evaluate(()=>{
   const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')];
   const visible=controls.filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'&&s.opacity!=='0';});
   const named=el=>Boolean((el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.textContent||el.getAttribute('title')||el.getAttribute('alt')||[...el.labels||[]].map(l=>l.textContent).join(' ')).trim());
   return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),visibleControls:visible.length,unnamedControls:visible.filter(e=>!named(e)).length,smallControls:visible.filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<24;}).length};
  });
  await page.screenshot({path:screenshot,animations:'disabled',timeout:10000});
  return {...metrics,blockedResources:[...blocked]};
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
   results.push({viewport,before:old,after:next,screenshots:{before:b,after:a},regressions:compareMetrics(old,next)});
  }
  const report={kind:'static-visual-proof',entry,fullApplicationTested:false,accessibilityCertified:false,publicationAuthorized:false,status:results.some(r=>r.regressions.length)?'regression_detected':'manual_review_required',results,limitations:['JavaScript désactivé','Ressources externes et fichiers non inclus bloqués','Contrôles de noms et tailles heuristiques','Pas de test des fonctions, contrastes WCAG ou performances runtime']};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
  return report;
 }finally{await browser.close();}
}
