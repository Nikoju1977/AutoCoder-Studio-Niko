// Studio Niko Design — AutoLearning V7. Local, explicit experience records.
import {audit} from './code-mode-x.mjs';
export const MEMORY_KEY='studio-niko-code-mode-x-memory-v1';
const statuses=['observed','failed','user_confirmed'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const secret=v=>audit([{name:'note.md',content:v}]).findings.some(f=>f.code==='POSSIBLE_SECRET');
export function projectKey(project){
 if(!project?.name)throw Error('Projet requis');
 return project.github?'github:'+project.github.repo.toLowerCase():'local:'+project.name.trim().toLowerCase();
}
export function makeRecord(project,{note,kind,evidence='',id,at}={}){
 const key=projectKey(project);note=clean(note,600);evidence=clean(evidence,300);
 if(!note||!statuses.includes(kind)||!id||!at)throw Error('Note et état requis');
 if(kind==='user_confirmed'&&!evidence)throw Error('Indiquer le test ou la preuve de validation');
 if(secret(note+'\n'+evidence))throw Error('Secret potentiel : enregistrement refusé');
 return {id:String(id).slice(0,100),at:String(at).slice(0,40),key,commit:project.github?.commit??null,kind,note,evidence};
}
function valid(r){
 return r&&typeof r.id==='string'&&r.id.length<=100&&typeof r.at==='string'&&r.at.length<=40&&typeof r.key==='string'&&r.key.length<=250&&statuses.includes(r.kind)&&typeof r.note==='string'&&r.note.length>0&&r.note.length<=600&&typeof r.evidence==='string'&&r.evidence.length<=300&&(r.kind!=='user_confirmed'||!!r.evidence)&&!secret(r.note+'\n'+r.evidence);
}
export function readMemory(storage){
 const raw=storage.getItem(MEMORY_KEY);if(!raw)return [];
 if(raw.length>250000)throw Error('Mémoire trop volumineuse');
 const data=JSON.parse(raw);if(data?.schema!==1||!Array.isArray(data.records)||data.records.length>150||!data.records.every(valid))throw Error('Mémoire invalide');
 return data.records;
}
export function writeMemory(storage,records){
 if(!Array.isArray(records)||records.length>150||!records.every(valid))throw Error('Mémoire pleine ou invalide');
 storage.setItem(MEMORY_KEY,JSON.stringify({schema:1,records}));
}
export function forProject(records,project){const key=projectKey(project);return records.filter(r=>r.key===key);}
const words=s=>new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9_-]{3,}/g)||[]);
export function selectLessons(records,project,mission,{budget=550}={}){
 const target=words(mission);const scored=forProject(records,project).filter(r=>r.kind==='user_confirmed').map(r=>({r,score:[...words(r.note)].filter(w=>target.has(w)).length}));
 scored.sort((a,b)=>b.score-a.score||b.r.at.localeCompare(a.r.at));
 const selected=[];
 for(const {r,score} of scored){if(!score||selected.length>=3)continue;const item={note:r.note,evidence:r.evidence,validation:'déclarée par utilisateur'};const next=[...selected,item];if(JSON.stringify(next).length<=budget)selected.push(item);}
 return selected;
}
