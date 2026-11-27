import {validateFiles} from './code-mode-x.mjs';
export function parseProject(raw){
 if(!raw||!raw.files||typeof raw.files!=='object')throw Error('Export AutoCoder invalide');
 const files=validateFiles(Array.isArray(raw.files)?raw.files:Object.entries(raw.files).map(([name,content])=>({name,content})));
 if(!files.length)throw Error('Projet vide');
 return {name:typeof raw.projectName==='string'?raw.projectName.slice(0,50):'projet',files};
}
export function proposalExport(project,result){
 if(result?.status!=='review_required')throw Error('Aucune proposition à exporter');
 const files=validateFiles(result.proposal);
 if(!files.length)throw Error('Proposition vide');
 const names=new Set(files.map(f=>f.name.toLowerCase()));
 if(project.files.some(f=>!names.has(f.name.toLowerCase())))throw Error('Fichier original manquant');
 return {format:'autocoder-studio-niko-v2',projectName:project.name,files:Object.fromEntries(files.map(f=>[f.name,f.content]))};
}