// Studio Niko Design — Master Control V10. Public metadata and local evidence only.
import {parseRepo} from './code-mode-x-github.mjs';
const KEY='studio-niko-project-activity-v1';
const kinds=['selection_loaded','static_audit','proposal_prepared'];
export function normalizeCatalog(rows){
 if(!Array.isArray(rows))throw Error('Réponse GitHub invalide');
 return rows.filter(r=>r&&r.private===false&&r.archived===false&&typeof r.full_name==='string').flatMap(r=>{
  try{return [{repo:parseRepo(r.full_name),description:typeof r.description==='string'?r.description.slice(0,250):'',branch:typeof r.default_branch==='string'?r.default_branch.slice(0,150):'',updated:typeof r.pushed_at==='string'?r.pushed_at.slice(0,40):'',language:typeof r.language==='string'?r.language.slice(0,40):''}];}catch{return [];}
 });
}
export function filterCatalog(rows,query){
 const terms=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
 return rows.filter(r=>terms.every(t=>(r.repo+' '+r.description+' '+r.language).toLowerCase().includes(t)));
}
export function readActivity(storage){
 const raw=storage.getItem(KEY);if(!raw)return [];
 if(raw.length>150000)throw Error('Historique trop volumineux');
 const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>200||!rows.every(r=>r&&typeof r.repo==='string'&&/^[a-f0-9]{40}$/.test(r.commit)&&kinds.includes(r.kind)&&typeof r.at==='string'&&Number.isInteger(r.files)&&r.files>=0&&r.files<=30))throw Error('Historique invalide');
 return rows;
}
export function recordActivity(storage,project,kind,at=new Date().toISOString()){
 if(!project?.github)return;
 const {repo,commit}=project.github;
 if(!kinds.includes(kind)||!/^[a-f0-9]{40}$/.test(commit))throw Error('Événement invalide');
 const row={repo:parseRepo(repo),commit,kind,at,files:project.files.length};
 storage.setItem(KEY,JSON.stringify([...readActivity(storage),row].slice(-200)));
}
export function latestActivity(rows,repo){
 return rows.filter(r=>r.repo.toLowerCase()===repo.toLowerCase()).at(-1)||null;
}
export function clearActivity(storage){storage.removeItem(KEY);}
