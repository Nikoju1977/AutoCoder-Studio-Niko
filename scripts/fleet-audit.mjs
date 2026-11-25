// Read-only fleet interoperability test: real public GitHub data, existing V20 modules.
import {listOwnerPage,listPublicRepo,readPublicAuditBlob} from '../code-mode-x-github.mjs';
import {audit,validateFiles} from '../code-mode-x.mjs';
import {createNativeBus} from '../code-mode-x-tools.mjs';
import {executeWorkflow,defaultWorkflow} from '../classical-engine.mjs';
import {createGateway,createClient} from '../native-protocol.mjs';
import {normalizeCatalog} from '../code-mode-x-catalog.mjs';
import {writeFile,readFile,rename} from 'node:fs/promises';
import {inspectFile,checkBlobIntegrity,AUDIT_VERSION} from '../deep-audit.mjs';
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

const output='fleet-audit-'+shard+'.json';
let previous=new Map();
if(process.env.FLEET_RESUME==='1'){
 try{const data=JSON.parse(await readFile(output,'utf8'));if(data.version===AUDIT_VERSION&&data.shard===shard&&data.shards===shards&&JSON.stringify(data.names)===JSON.stringify(assigned))previous=new Map(data.rows.map(r=>[r.repo,r]));}catch{}
}
async function checkpoint(current){
 const data={version:AUDIT_VERSION,shard,shards,names:assigned,expected:names.length,rows:[...rows,...(current?[current]:[])]};
 await writeFile(output+'.tmp',JSON.stringify(data,null,2));await rename(output+'.tmp',output);
}
async function check(repo){
 const row={repo,status:'not_tested',commit:null,eligible:0,oversized:0,audited:0,failed:0,batches:0,sdkPassed:0,findings:{},syntax:{},functionalTests:false,providerCalls:0,files:[]};
 try{
  const snapshot=await listPublicRepo(repo,{...opts,inventoryLimit:10000,maxFileBytes:1048576,deepAudit:true});
  row.commit=snapshot.commit;row.eligible=snapshot.eligibleTotal;row.oversized=snapshot.oversized;row.partial=snapshot.partial;
  const selection=[...snapshot.files].sort((a,b)=>score(a)-score(b)||a.path.localeCompare(b.path));
  row.listed=selection.length;
  const known=new Set(snapshot.allPaths);
  const saved=previous.get(repo);
  const reusable=new Map(saved?.commit===row.commit&&Array.isArray(saved.files)?saved.files.filter(f=>f.status==='audited').map(f=>[f.path,f]):[]);
  for(let i=0;i<selection.length;i+=3){
   const batch=selection.slice(i,i+3);row.batches++;
   const smallFiles=[];
   for(const f of batch){
    let entry=reusable.get(f.path);
    if(!entry||entry.sha!==f.sha){
     try{
      const blob=await readPublicAuditBlob(snapshot,f.path,opts);
      if(!checkBlobIntegrity(blob.bytes,f.sha))throw Error('Blob digest mismatch');
      entry={path:f.path,sha:f.sha,status:'audited',...inspectFile(blob,{allPaths:known,treeTruncated:snapshot.treeTruncated})};
      if(f.size<=12000&&/\.(py|html|css|js|md|json|mjs|cjs)$/i.test(f.path)){
       const ext=f.path.split('.').pop().toLowerCase();
       smallFiles.push({name:'file-'+String(smallFiles.length+1).padStart(2,'0')+'.'+(['mjs','cjs'].includes(ext)?'js':ext),content:blob.content});
      }
     }catch(e){entry={path:f.path,sha:f.sha,status:category(e)};}
    }
    row.files.push(entry);
    if(entry.status==='audited'){
     row.audited++;row.syntax[entry.syntax.status]=(row.syntax[entry.syntax.status]||0)+1;
     for(const x of entry.findings)row.findings[x.code]=(row.findings[x.code]||0)+1;
    }else row.failed++;
   }
   // Existing local SDK path remains separately verified for small supported files.
   if(smallFiles.length){try{
    const files=validateFiles(smallFiles);
    if(audit(files).findings.some(f=>f.code==='POSSIBLE_SECRET'))throw Error('Secret potentiel');
    const project={name:repo,files};
    const result=await executeWorkflow(defaultWorkflow,{bus:createNativeBus({project,maxCalls:3})});
    if(result.status!=='completed')throw Error('Workflow failed');
    const sdk=createClient(r=>createGateway({project,maxCalls:1}).dispatch(r));
    if((await sdk.call('project.inventory')).files.length!==files.length)throw Error('SDK inventory mismatch');
    row.sdkPassed++;
   }catch{row.sdkBlocked=(row.sdkBlocked||0)+1;}}
   if(row.batches%10===0)await checkpoint(row);
   console.log('FLEET_BATCH '+JSON.stringify({repo,batch:row.batches,done:Math.min(i+3,selection.length),listed:selection.length,audited:row.audited,failed:row.failed}));
  }
  row.status=row.failed||row.partial||row.oversized?'partial':!selection.length?'no_eligible_files':row.findings.SYNTAX_INVALID||row.findings.JSON_INVALID?'audit_findings_error':'audit_completed';
 }catch(e){
  row.status=category(e);
  if(row.status==='GitHub HTTP 409')try{
   const base='https://api.github.com/repos/'+repo;
   const [meta,branches]=await Promise.all([fetchImpl(base),fetchImpl(base+'/branches?per_page=1')]);
   if(meta.ok&&branches.ok){const m=await meta.json(),b=await branches.json();if(m.private===false&&m.size===0&&Array.isArray(b)&&b.length===0)row.status='empty_repository';}
  }catch{}
 }
 return row;
}
for(const name of assigned){const row=await check(name);rows.push(row);await checkpoint();console.log('FLEET_ROW '+JSON.stringify({...row,files:undefined}));}
console.log('FLEET_SUMMARY '+JSON.stringify({version:AUDIT_VERSION,shard,shards,publicRepos:names.length,assigned:assigned.length,completed:rows.length,filesAudited:rows.reduce((n,r)=>n+r.audited,0),filesFailed:rows.reduce((n,r)=>n+r.failed,0),oversized:rows.reduce((n,r)=>n+r.oversized,0),batches:rows.reduce((n,r)=>n+r.batches,0),results:rows.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{}),functionalTests:false}));
if(!names.length||rows.some(r=>!['audit_completed','audit_findings_error','no_eligible_files','empty_repository'].includes(r.status)))process.exitCode=1;
