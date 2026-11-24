// Studio Niko Design — Native Tool Bus v1. No MCP server or arbitrary code execution.
import {audit,validateFiles} from './code-mode-x.mjs';
import {improvementPlan} from './code-mode-x-evolution.mjs';
import {listPublicRepo,listOwnerPage,parseRepo} from './code-mode-x-github.mjs';
import {normalizeCatalog} from './code-mode-x-catalog.mjs';
import {simulateCircuit} from './quantum-core.mjs';
import {readConnector} from './code-mode-x-connectors.mjs';
const definitions=Object.freeze({
 'quantum.simulate':{description:'Simulation idéale de circuit quantique',permission:'quantum.compute',network:false,fields:{circuit:'json-string'}},
 'connector.read':{description:'Lecture REST de connecteur autorisé',permission:'connector.public.read',network:true,fields:{id:'string',repo:'optional-string'}},
 'project.audit':{description:'Contrôles statiques des fichiers sélectionnés',permission:'project.read',network:false,fields:{}},
 'project.roadmap':{description:'Feuille de route fondée sur les constats locaux',permission:'project.read',network:false,fields:{}},
 'project.inventory':{description:'Inventaire de la sélection, sans contenu source',permission:'project.read',network:false,fields:{}},
 'github.snapshot':{description:'Inventaire public GitHub à un commit donné',permission:'github.public.read',network:true,fields:{repo:'string',branch:'optional-string'}},
 'github.catalog':{description:'Page du catalogue public d’un compte GitHub',permission:'github.public.read',network:true,fields:{owner:'string',page:'integer'}}
});
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function listNativeTools(){return Object.entries(definitions).map(([name,d])=>({name,description:d.description,permission:d.permission,network:d.network,inputSchema:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(d.fields).map(([k,t])=>[k,{type:t==='integer'?'integer':'string'}])),required:Object.keys(d.fields).filter(k=>d.fields[k]!=='optional-string')}}));}
function validateArgs(d,args){
 if(!isObject(args)||Object.keys(args).some(k=>!Object.hasOwn(d.fields,k)))throw Error('Arguments inconnus ou invalides');
 for(const [key,type] of Object.entries(d.fields)){
  const v=args[key];
  if(type==='optional-string'&&v===undefined)continue;
  if(type==='integer'?!Number.isInteger(v):typeof v!=='string'||v.length>(type==='json-string'?12000:200))throw Error('Argument invalide : '+key);
 }
}
export function createNativeBus({project=null,permissions=['project.read'],maxCalls=10,fetchImpl,signal}={}){
 if(!Array.isArray(permissions)||permissions.some(p=>!['project.read','github.public.read','quantum.compute','connector.public.read'].includes(p))||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>20)throw Error('Politique invalide');
 const allowed=new Set(permissions);let calls=0;
 const records=[];
 const local=()=>{if(!project?.files?.length)throw Error('Charger un projet');validateFiles(project.files);return project;};
 return Object.freeze({
  list:()=>listNativeTools().filter(d=>allowed.has(d.permission)),
  journal:()=>records.map(r=>({...r})),
  async call(name,args={}){
   if(typeof name!=='string'||!Object.hasOwn(definitions,name))throw Error('Outil inconnu');
   const d=definitions[name];if(!allowed.has(d.permission))throw Error('Permission refusée');
   validateArgs(d,args);if(signal?.aborted)throw Error('Annulé');if(calls>=maxCalls)throw Error('Budget d’outils épuisé');
   const call=++calls;let result;
   try{
    if(name==='quantum.simulate')result=simulateCircuit(JSON.parse(args.circuit));
    else if(name==='connector.read')result=await readConnector(args.id,args.repo===undefined?{}:{repo:args.repo},{fetchImpl,signal});
    else if(name==='project.audit')result=audit(local().files);
    else if(name==='project.roadmap')result=improvementPlan(local());
    else if(name==='project.inventory'){const p=local();result={name:p.name,commit:p.github?.commit??null,files:p.files.map(f=>({name:f.name,characters:f.content.length})),testsExecuted:false};}
    else if(name==='github.snapshot')result=await listPublicRepo(parseRepo(args.repo),{branch:args.branch,fetchImpl,signal});
    else if(name==='github.catalog'){const p=await listOwnerPage(args.owner,args.page,{fetchImpl,signal});result={rows:normalizeCatalog(p.rows),hasNext:p.hasNext,capped:p.capped};}
    if(signal?.aborted)throw Error('Annulé');
    records.push({call,tool:name,status:'completed'});return {tool:name,result};
   }catch(e){records.push({call,tool:name,status:'failed'});throw e;}
  }
 });
}
