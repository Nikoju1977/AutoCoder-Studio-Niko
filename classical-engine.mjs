// Studio Niko Classical Compute Engine: deterministic local task execution.
const ID=/^[a-zA-Z0-9_-]{1,48}$/;
const tools=new Set(['project.audit','project.inventory','project.roadmap']);
export function planWorkflow(raw){
 if(!raw||!Array.isArray(raw.tasks)||raw.tasks.length<1||raw.tasks.length>20||Object.keys(raw).some(k=>k!=='tasks'))throw Error('Workflow : 1 à 20 tâches');
 const map=new Map();
 for(const t of raw.tasks){
  if(!t||typeof t.id!=='string'||!ID.test(t.id)||map.has(t.id)||!tools.has(t.tool)||Object.keys(t).some(k=>!['id','tool','dependsOn','priority','estimate'].includes(k)))throw Error('Tâche ou outil invalide');
  const deps=t.dependsOn??[],priority=t.priority??2,estimate=t.estimate??1;
  if(!Array.isArray(deps)||deps.some(d=>typeof d!=='string'||!ID.test(d))||new Set(deps).size!==deps.length||!Number.isInteger(priority)||priority<0||priority>3||!Number.isFinite(estimate)||estimate<1||estimate>10000)throw Error('Dépendance, priorité ou estimation invalide');
  map.set(t.id,{id:t.id,tool:t.tool,dependsOn:[...deps],priority,estimate});
 }
 for(const t of map.values())if(t.dependsOn.some(d=>!map.has(d)||d===t.id))throw Error('Dépendance absente ou circulaire');
 const done=new Set(),order=[],finish=new Map();
 while(done.size<map.size){
  const ready=[...map.values()].filter(t=>!done.has(t.id)&&t.dependsOn.every(d=>done.has(d))).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  if(!ready.length)throw Error('Cycle détecté');
  const t=ready[0];done.add(t.id);order.push(t);
  finish.set(t.id,Math.max(0,...t.dependsOn.map(d=>finish.get(d)))+t.estimate);
 }
 return {order,criticalPathEstimate:Math.max(...finish.values()),serialEstimate:order.reduce((n,t)=>n+t.estimate,0),estimateUnit:'relative_work_units',testsExecuted:false};
}
export async function executeWorkflow(raw,{bus,signal,onEvent=()=>{}}={}){
 const plan=planWorkflow(raw);
 if(!bus||typeof bus.call!=='function'||typeof bus.list!=='function')throw Error('Registre autorisé requis');
 const available=new Set(bus.list().filter(t=>!t.network&&t.permission==='project.read').map(t=>t.name));
 if(plan.order.some(t=>!available.has(t.tool)))throw Error('Outil non autorisé');
 const statuses=new Map(),results=[],started=globalThis.performance.now();
 const emit=row=>{results.push(row);statuses.set(row.id,row.status);try{onEvent({id:row.id,status:row.status});}catch{}};
 for(const task of plan.order){
  if(signal?.aborted){emit({id:task.id,tool:task.tool,status:'cancelled'});continue;}
  if(task.dependsOn.some(d=>statuses.get(d)!=='completed')){emit({id:task.id,tool:task.tool,status:'skipped_dependency'});continue;}
  await new Promise(resolve=>setTimeout(resolve,0));
  if(signal?.aborted){emit({id:task.id,tool:task.tool,status:'cancelled'});continue;}
  const t0=globalThis.performance.now();
  try{
   const response=await bus.call(task.tool,{});
   if(signal?.aborted){emit({id:task.id,tool:task.tool,status:'cancelled'});continue;}
   emit({id:task.id,tool:task.tool,status:'completed',durationMs:globalThis.performance.now()-t0,result:response.result});
  }catch{emit({id:task.id,tool:task.tool,status:'failed',durationMs:globalThis.performance.now()-t0});}
 }
 return {engine:'Studio Niko CCE',mode:'classical_local',status:results.every(r=>r.status==='completed')?'completed':signal?.aborted?'cancelled':'partial',durationMs:globalThis.performance.now()-started,plan,results,testsExecuted:false};
}
export function optimizeBudget(items,budget){
 if(!Array.isArray(items)||items.length>100||!Number.isInteger(budget)||budget<0||budget>10000)throw Error('Budget ou liste invalide');
 const seen=new Set();
 for(const item of items){
  if(!item||typeof item.id!=='string'||!ID.test(item.id)||seen.has(item.id)||!Number.isInteger(item.cost)||item.cost<1||item.cost>10000||!Number.isInteger(item.value)||item.value<0||item.value>100000||Object.keys(item).some(k=>!['id','cost','value'].includes(k)))throw Error('Option invalide');
  seen.add(item.id);
 }
 const dp=new Float64Array(budget+1),take=items.map(()=>new Uint8Array(budget+1));
 for(let i=0;i<items.length;i++){
  const {cost,value}=items[i];
  for(let b=budget;b>=cost;b--){const candidate=dp[b-cost]+value;if(candidate>dp[b]){dp[b]=candidate;take[i][b]=1;}}
 }
 let b=budget;const selected=[];
 for(let i=items.length-1;i>=0;i--)if(take[i][b]){selected.push(items[i].id);b-=items[i].cost;}
 return {selected:selected.reverse(),usedBudget:budget-b,remainingBudget:b,totalValue:dp[budget],optimal:true,scope:'independent_items_integer_costs',method:'exact_dynamic_programming'};
}
export const defaultWorkflow={tasks:[{id:'inventory',tool:'project.inventory',estimate:1},{id:'audit',tool:'project.audit',dependsOn:['inventory'],priority:1,estimate:2},{id:'roadmap',tool:'project.roadmap',dependsOn:['audit'],estimate:2}]};
