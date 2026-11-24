// Studio Niko Design — V14. AI-selected, bounded, read-only native tools.
import {audit,validateFiles} from './code-mode-x.mjs';
import {createNativeBus} from './code-mode-x-tools.mjs';
const allowed=['project.audit','project.inventory','project.roadmap'];
export function parseToolSelection(response){
 const files=validateFiles(response?.files);
 if(files.length!==1||files[0].name!=='tools.json'||files[0].content.length>1000)throw Error('Sélection d’outils invalide');
 const data=JSON.parse(files[0].content);
 if(!data||Object.keys(data).length!==1||!Array.isArray(data.tools)||data.tools.length>3||new Set(data.tools).size!==data.tools.length||data.tools.some(n=>!allowed.includes(n)))throw Error('Outil non autorisé ou sélection invalide');
 return data.tools;
}
function safeSummary(name,result){
 if(name==='project.audit')return {tool:name,count:result.fileCount,passed:result.passed,findings:result.findings.slice(0,8).map(({file,code,severity,line})=>({file,code,severity,line})),totalFindings:result.findings.length};
 if(name==='project.inventory')return {tool:name,fileCount:result.files.length,characters:result.files.reduce((n,f)=>n+f.characters,0)};
 return {tool:name,tasks:result.tasks.map(({id,priority,occurrences})=>({id,priority,occurrences}))};
}
export async function selectAndRunTools({project,prompt,request,signal}={}){
 if(typeof request!=='function'||typeof prompt!=='string'||prompt.trim().length<3||prompt.length>2400)throw Error('Mission invalide');
 const files=validateFiles(project?.files);
 if(!files.length||files.length>12||files.some(f=>f.content.length>12000))throw Error('Contexte trop volumineux ou vide');
 if(audit([...files]).findings.some(f=>f.code==='POSSIBLE_SECRET')||audit([{name:'mission.md',content:prompt}]).findings.some(f=>f.code==='POSSIBLE_SECRET'))throw Error('Secret potentiel : aucun appel IA');
 if(signal?.aborted)throw Error('Annulé');
 const bus=createNativeBus({project:{...project,files},permissions:['project.read'],maxCalls:3,signal});
 // Planner receives the mission only, not project files. The full project is sent by the existing team only after consent.
 const description=bus.list().map(t=>t.name+': '+t.description).join('; ');
 const response=await request({role:'architect',prompt:'Sélectionne zéro à trois outils locaux utiles à la mission. Retourne uniquement tools.json contenant {"tools":["nom"]}. N’invente aucun outil et ne demande aucune exécution de code. Outils disponibles : '+description+'\nMission : '+prompt,files:[],signal});
 if(signal?.aborted)throw Error('Annulé');
 const selected=parseToolSelection(response),summaries=[];
 for(const name of selected){
  const {result}=await bus.call(name,{});
  summaries.push(safeSummary(name,result));
 }
 // Only compact structured metadata goes into the next prompt; never insert source or free-form tool output.
 const compact=[];
 for(const item of summaries){
  const summary={tool:item.tool,...(item.tool==='project.audit'?{passed:item.passed,totalFindings:item.totalFindings,codes:[...new Set(item.findings.map(f=>f.code))]}:item.tool==='project.inventory'?{fileCount:item.fileCount,characters:item.characters}:{tasks:item.tasks.map(t=>t.id)})};
  compact.push(summary);
 }
 const encoded=JSON.stringify(compact);
 if(encoded.length>800)throw Error('Résumé d’outils trop long');
 return {selected,summaries,journal:bus.journal(),context:encoded,providerCalls:1,testsExecuted:false};
}
