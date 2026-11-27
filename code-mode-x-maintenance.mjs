// Studio Niko Design — V11. Explicit, local, version-pinned maintenance queue.
import {audit} from './code-mode-x.mjs';
import {parseRepo} from './code-mode-x-github.mjs';
const KEY='studio-niko-maintenance-v1';
const SHA=/^[a-f0-9]{40}$/;
const states=['queued','proposal_ready','blocked','verified_by_user','cancelled'];
const transitions={queued:['proposal_ready','blocked','cancelled'],proposal_ready:['queued','blocked','verified_by_user','cancelled'],blocked:['queued','cancelled'],verified_by_user:[],cancelled:[]};
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
function checkText(v){if(audit([{name:'note.md',content:v}]).findings.some(f=>f.code==='POSSIBLE_SECRET'))throw Error('Secret potentiel : opération refusée');}
function valid(t){return t&&typeof t.id==='string'&&t.id.length>0&&t.id.length<=100&&typeof t.repo==='string'&&t.repo.length<=150&&SHA.test(t.commit)&&typeof t.title==='string'&&t.title.length>0&&t.title.length<=180&&typeof t.mission==='string'&&t.mission.length>=3&&t.mission.length<=1000&&[0,1,2,3].includes(t.priority)&&states.includes(t.state)&&typeof t.evidence==='string'&&t.evidence.length<=300&&(t.state!=='verified_by_user'||!!t.evidence)&&typeof t.at==='string'&&t.at.length<=40;}
export function makeTask(project,{id,title,mission,priority=2,at}={}){
 if(!project?.github)throw Error('Charger une sélection GitHub');
 const row={id:text(id,100),repo:parseRepo(project.github.repo),commit:project.github.commit,title:text(title,180),mission:text(mission,1000),priority,state:'queued',evidence:'',at:text(at,40)};
 if(!valid(row))throw Error('Intervention invalide');checkText(row.title+'\n'+row.mission);return row;
}
export function readQueue(storage){
 const raw=storage.getItem(KEY);if(!raw)return [];
 if(raw.length>400000)throw Error('File trop volumineuse');
 const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||!rows.every(valid)||new Set(rows.map(t=>t.id)).size!==rows.length)throw Error('File invalide');
 return rows;
}
export function saveQueue(storage,rows){
 if(!Array.isArray(rows)||rows.length>100||!rows.every(valid)||new Set(rows.map(t=>t.id)).size!==rows.length)throw Error('File pleine ou invalide');
 storage.setItem(KEY,JSON.stringify(rows));
}
export function orderedQueue(rows){return [...rows].sort((a,b)=>a.priority-b.priority||a.at.localeCompare(b.at));}
export function transitionTask(task,state,evidence=''){
 if(!valid(task)||!transitions[task.state].includes(state))throw Error('Transition interdite');
 evidence=text(evidence,300);checkText(evidence);
 if(state==='verified_by_user'&&!evidence)throw Error('Preuve de test déclarée obligatoire');
 return {...task,state,evidence};
}
export function prepareTask(task,project){
 if(!valid(task)||task.state!=='queued')throw Error('Intervention non disponible');
 if(!project?.github||project.github.repo.toLowerCase()!==task.repo.toLowerCase()||project.github.commit!==task.commit)throw Error('Charger le même dépôt et le même commit; créer une nouvelle intervention si la version a changé.');
 return task.mission;
}
export function branchSuggestion(task){
 if(!valid(task))throw Error('Intervention invalide');
 return 'maintenance/cmx-'+task.commit.slice(0,8)+'-'+task.id.replace(/[^a-zA-Z0-9-]/g,'').slice(0,30);
}
