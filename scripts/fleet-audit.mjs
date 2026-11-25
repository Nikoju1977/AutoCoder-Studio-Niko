// Read-only fleet interoperability test: real public GitHub data, existing V20 modules.
import {listOwnerPage,listPublicRepo,loadPublicSelection} from '../code-mode-x-github.mjs';
import {createNativeBus} from '../code-mode-x-tools.mjs';
import {executeWorkflow,defaultWorkflow} from '../classical-engine.mjs';
import {createGateway,createClient} from '../native-protocol.mjs';
import {normalizeCatalog} from '../code-mode-x-catalog.mjs';
import {writeFile} from 'node:fs/promises';
const token=process.env.GITHUB_TOKEN;
const fetchImpl=(url,options={})=>{
 const u=new URL(url);
 if(u.origin!=='https://api.github.com'||u.username||u.password||(options.method&&options.method!=='GET'))throw Error('Blocked transport');
 return fetch(u,{...options,headers:{...options.headers,...(token?{Authorization:'Bearer '+token}:{})},redirect:'error'});
};
const opts={fetchImpl};
const owner='Nikoju1977',rows=[],catalog=[];
for(let page=1;page<=20;page++){
 const r=await listOwnerPage(owner,page,opts);catalog.push(...normalizeCatalog(r.rows));if(!r.hasNext)break;
}
const names=[...new Set(catalog.map(x=>x.repo))].sort();
const score=f=>{const p=f.path.toLowerCase();return /(^|\/)(index\.html|app\.js|main\.py|package\.json|vite\.config\.js)$/.test(p)?0:/\.(js|mjs|cjs|py|html|css)$/.test(p)?1:/\.json$/.test(p)?2:3;};
function category(e){const m=String(e?.message||'');return /Secret potentiel/.test(m)?'possible_secret_blocked':/GitHub HTTP \d+/.test(m)?m.match(/GitHub HTTP \d+/)[0]:'read_or_validation_error';}

const shard=Number(process.env.FLEET_SHARD??0),shards=Number(process.env.FLEET_SHARDS??1);
if(!Number.isInteger(shards)||shards<1||shards>20||!Number.isInteger(shard)||shard<0||shard>=shards)throw Error('Invalid shard');
const assigned=names.filter((_,i)=>i%shards===shard);
async function check(repo){
 const row={repo,status:'not_tested',commit:null,eligible:0,loaded:0,audited:0,failed:0,batches:0,sdkPassed:0,findings:{},errors:{},functionalTests:false,providerCalls:0,files:[]};
 try{
  const snapshot=await listPublicRepo(repo,{...opts,inventoryLimit:10000});row.commit=snapshot.commit;row.eligible=snapshot.eligibleTotal??snapshot.files.length;row.treeEntries=snapshot.total;row.partial=snapshot.partial;
  const selection=[...snapshot.files].sort((a,b)=>score(a)-score(b)||a.path.localeCompare(b.path));
  row.listed=selection.length;
  if(!selection.length){row.status='no_eligible_files';return row;}
  async function processBatch(files){
   let project;
   try{project=await loadPublicSelection(snapshot,files.map(f=>f.path),opts);}
   catch(e){
    // Isolate only the import failures; valid neighbours are still examined.
    if(files.length>1){for(const f of files)await processBatch([f]);return;}
    const status=category(e);row.failed++;row.errors[status]=(row.errors[status]||0)+1;row.files.push({path:files[0].path,status});return;
   }
   row.loaded+=project.files.length;
   try{
    const result=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});
    if(result.status!=='completed')throw Error('workflow_failed');
    const audit=result.results.find(r=>r.id==='audit').result;
    const sdk=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));
    const inventory=await sdk.call('project.inventory');
    if(inventory.files.length!==project.files.length)throw Error('sdk_inventory_mismatch');
    row.sdkPassed++;row.audited+=project.files.length;
    for(const f of files){
     const alias=project.github.mapping.find(m=>m.path===f.path)?.name;
     const scope=/(^|\/)(tests?|ron-tests|__tests__|tools)(\/|$)/i.test(f.path)?'test_or_tool_candidate':/\.md$/i.test(f.path)?'documentation':'source_candidate';
     const findings=audit.findings.filter(x=>x.file===alias).map(({code,severity,line})=>({code,severity,line,scope,confirmation:'heuristic_only'}));
     for(const x of findings)row.findings[x.code]=(row.findings[x.code]||0)+1;
     row.files.push({path:f.path,status:'audited',findings});
    }
   }catch{
    row.failed+=files.length;row.errors.workflow_or_sdk_failed=(row.errors.workflow_or_sdk_failed||0)+files.length;
    for(const f of files)row.files.push({path:f.path,status:'workflow_or_sdk_failed'});
   }
  }
  for(let i=0;i<selection.length;i+=3){
   row.batches++;const batch=selection.slice(i,i+3);
   await processBatch(batch);
   console.log('FLEET_BATCH '+JSON.stringify({repo,commit:row.commit,batch:row.batches,done:Math.min(i+3,selection.length),listed:selection.length,audited:row.audited,failed:row.failed}));
  }
  row.status=row.failed||row.partial?'partial':row.findings.JSON_INVALID?'audit_findings_error':'audit_completed';
  return row;
 }catch(e){
  row.status=category(e);
  if(row.status==='GitHub HTTP 409'){
   try{
    const base='https://api.github.com/repos/'+repo;
    const [meta,branches]=await Promise.all([fetchImpl(base),fetchImpl(base+'/branches?per_page=1')]);
    if(meta.ok&&branches.ok){const m=await meta.json(),b=await branches.json();if(m.private===false&&m.size===0&&Array.isArray(b)&&b.length===0)row.status='empty_repository';}
   }catch{/* retain original error */}
  }
  return row;
 }
}
for(const name of assigned){
 const row=await check(name);rows.push(row);
 console.log('FLEET_ROW '+JSON.stringify({...row,files:undefined}));
 await writeFile('fleet-audit-'+shard+'.json',JSON.stringify({shard,shards,expected:names.length,assigned:assigned.length,rows},null,2));
}
const summary={shard,shards,publicRepos:names.length,assigned:assigned.length,completed:rows.length,results:rows.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{}),filesLoaded:rows.reduce((n,r)=>n+r.loaded,0),filesAudited:rows.reduce((n,r)=>n+r.audited,0),filesFailed:rows.reduce((n,r)=>n+r.failed,0),batches:rows.reduce((n,r)=>n+r.batches,0),scope:'All listed eligible files in successive batches of 3; static checks only; no AI, QPU, source logs or writes.'};
console.log('FLEET_SUMMARY '+JSON.stringify(summary));
if(!names.length||rows.some(r=>!['audit_completed','audit_findings_error','no_eligible_files','empty_repository'].includes(r.status)))process.exitCode=1;
