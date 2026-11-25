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
async function check(repo){
 const row={repo,status:'not_tested',commit:null,eligible:0,selected:0,loaded:0,findings:{},functionalTests:false,providerCalls:0};
 try{
  const snapshot=await listPublicRepo(repo,opts);row.commit=snapshot.commit;row.eligible=snapshot.files.length;row.treeEntries=snapshot.total;row.partial=snapshot.partial;
  const selection=[...snapshot.files].sort((a,b)=>score(a)-score(b)||a.path.localeCompare(b.path)).slice(0,3);
  row.selected=selection.length;
  if(!selection.length){row.status='no_eligible_files';return row;}
  const project=await loadPublicSelection(snapshot,selection.map(f=>f.path),opts);row.loaded=project.files.length;
  const result=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});
  row.workflow=result.status;
  if(result.status!=='completed'){row.status='workflow_failed';return row;}
  const audit=result.results.find(r=>r.id==='audit').result;
  for(const f of audit.findings)row.findings[f.code]=(row.findings[f.code]||0)+1;
  const sdk=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));
  const inventory=await sdk.call('project.inventory');
  if(inventory.files.length!==project.files.length)throw Error('SDK inventory mismatch');
  row.sdk='passed';row.status=audit.passed?'audit_completed':'audit_findings_error';return row;
 }catch(e){row.status=category(e);return row;}
}
for(let i=0;i<names.length;i+=4){
 const batch=await Promise.all(names.slice(i,i+4).map(check));rows.push(...batch);for(const row of batch)console.log('FLEET_ROW '+JSON.stringify(row));
}
const summary={publicRepos:names.length,results:rows.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{}),filesLoaded:rows.reduce((n,r)=>n+r.loaded,0),sdkPassed:rows.filter(r=>r.sdk==='passed').length,scope:'Maximum three eligible files per public repo; no functional project tests; no source logs, writes, AI or QPU.',rows};
console.log('FLEET_SUMMARY '+JSON.stringify({...summary,rows:undefined}));
await writeFile('fleet-audit.json',JSON.stringify(summary,null,2));
if(!names.length||rows.some(r=>['workflow_failed','read_or_validation_error'].includes(r.status)))process.exitCode=1;
