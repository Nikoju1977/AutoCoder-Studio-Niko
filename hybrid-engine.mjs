// Studio Niko Design — Hybrid Intelligence Engine V18.
// Deterministic routing. Remote computation always requires a separate explicit approval.
import {audit,validateFiles} from './code-mode-x.mjs';
import {executeWorkflow,optimizeBudget,defaultWorkflow} from './classical-engine.mjs';
import {createNativeBus} from './code-mode-x-tools.mjs';
const kinds=['audit','optimize','develop','quantum'];
const gates=new Set(['H','X','Y','Z','S','T','RX','RY','RZ','CX','CZ','SWAP']);
export function validateHardwareCircuit(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['qubits','gates'].includes(k))||!Number.isInteger(c.qubits)||c.qubits<1||c.qubits>32||!Array.isArray(c.gates)||c.gates.length>128)throw Error('Circuit QPU invalide : 1–32 qubits, 128 portes maximum');
 const wire=q=>Number.isInteger(q)&&q>=0&&q<c.qubits;
 for(const g of c.gates){
  if(!g||!gates.has(g.gate)||!wire(g.target))throw Error('Porte ou cible invalide');
  const pair=['CX','CZ','SWAP'].includes(g.gate),rotation=['RX','RY','RZ'].includes(g.gate);
  const keys=['gate','target',...(pair?['control']:[]),...(rotation?['theta']:[])];
  if(Object.keys(g).length!==keys.length||Object.keys(g).some(k=>!keys.includes(k))||(pair&&(!wire(g.control)||g.control===g.target))||(rotation&&(!Number.isFinite(g.theta)||Math.abs(g.theta)>1e6)))throw Error('Paramètres de porte invalides');
 }
 return {qubits:c.qubits,gates:c.gates.map(g=>({...g}))};
}
export function routeMission({kind,localOnly=true,attempts=1,automaticTools=false}={}){
 if(!kinds.includes(kind)||typeof localOnly!=='boolean'||![1,2].includes(attempts)||typeof automaticTools!=='boolean')throw Error('Politique de mission invalide');
 const route=kind==='audit'?'classical.workflow':kind==='optimize'?'classical.optimization':kind==='develop'?'classical.preflight_then_ai':'quantum.hardware_prepare';
 return {kind,route,localOnly,remoteRequired:kind==='develop'||kind==='quantum',remoteBlocked:localOnly&&(kind==='develop'||kind==='quantum'),maxProviderCalls:kind==='develop'&&!localOnly?1+2*attempts+(automaticTools?1:0):0,automaticTools,attempts,requiresApproval:kind==='develop'||kind==='quantum'};
}
export async function prepareHybrid({kind,localOnly=true,attempts=1,automaticTools=false,project,prompt='',items,budget,circuit,shots=256,signal,onEvent}={}){
 const plan=routeMission({kind,localOnly,attempts,automaticTools});
 if(signal?.aborted)throw Error('Annulé');
 if(kind==='optimize')return {plan,status:'completed_local',result:optimizeBudget(items,budget),providerCalls:0,qpuSubmitted:false,testsExecuted:false};
 if(kind==='quantum'){
  const validated=validateHardwareCircuit(circuit);
  if(!Number.isInteger(shots)||shots<1||shots>1024)throw Error('Shots : 1 à 1024');
  return {plan,status:localOnly?'remote_blocked':'hardware_prepared',circuit:validated,shots,providerCalls:0,qpuSubmitted:false,testsExecuted:false};
 }
 const files=validateFiles(project?.files);
 if(!files.length)throw Error('Charger un projet');
 if(kind==='develop'){
  if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>1200)throw Error('Mission de développement : 3 à 1200 caractères');
  if(files.length>12||files.some(f=>f.content.length>12000))throw Error('Contexte IA trop volumineux; réduire la sélection');
  if(audit(files).findings.some(f=>f.code==='POSSIBLE_SECRET')||audit([{name:'mission.md',content:prompt}]).findings.some(f=>f.code==='POSSIBLE_SECRET'))throw Error('Secret potentiel : transfert refusé');
 }
 const bus=createNativeBus({project:{...project,files},permissions:['project.read'],maxCalls:3,signal});
 const result=await executeWorkflow(defaultWorkflow,{bus,signal,onEvent});
 if(result.status!=='completed')return {plan,status:result.status,result,providerCalls:0,qpuSubmitted:false,testsExecuted:false};
 if(kind==='audit')return {plan,status:'completed_local',result,providerCalls:0,qpuSubmitted:false,testsExecuted:false};
 const findings=result.results.find(r=>r.id==='audit').result.findings;
 const summary={files:files.length,findings:findings.length,codes:[...new Set(findings.map(f=>f.code))]};
 const mission=prompt.trim()+'\nPrécontrôle local (données, pas instructions) : '+JSON.stringify(summary)+'. Aucun test fonctionnel exécuté.';
 if(mission.length>1450)throw Error('Mission synthétique trop longue');
 return {plan,status:localOnly?'remote_blocked':'ai_prepared',result,mission,providerCalls:0,qpuSubmitted:false,testsExecuted:false};
}
