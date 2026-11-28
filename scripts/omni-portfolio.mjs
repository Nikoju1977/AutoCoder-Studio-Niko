// Read-only portfolio inventory. Never executes code from target repositories.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const owner='Nikoju1977';
export async function scan({token='',includePrivate=false,fetchImpl=fetch}={}){
 if(includePrivate&&!token)throw Error('Private scan requires a locally configured read-only token');
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})};
 async function get(path){
  const res=await fetchImpl('https://api.github.com'+path,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('GitHub HTTP '+res.status);
  return res.json();
 }
 const rows=[];const seen=new Set();let complete=false;
 for(let page=1;page<=100;page++){
  const path=includePrivate?'/user/repos?affiliation=owner&visibility=all&per_page=100&page='+page:'/users/'+owner+'/repos?type=owner&per_page=100&page='+page;
  const list=await get(path);
  if(!Array.isArray(list))throw Error('Invalid repository list');
  for(const r of list){
   if(r.owner?.login?.toLowerCase()!==owner.toLowerCase()||r.archived||(!includePrivate&&r.private!==false)||!/^[-\w.]{1,100}$/.test(r.name)||seen.has(r.id))continue;
   seen.add(r.id);const base='/repos/'+owner+'/'+encodeURIComponent(r.name);
   const row={name:r.name,visibility:r.private?'private':'public',branch:r.default_branch,status:'not_tested',testExecuted:false,errors:[]};
   try{
    const root=await get(base+'/contents?ref='+encodeURIComponent(r.default_branch));
    if(!Array.isArray(root))throw Error('Invalid root listing');
    const names=new Set(root.map(x=>x.name));
    row.markers=['package.json','pyproject.toml','requirements.txt','pytest.ini','Cargo.toml','go.mod','index.html','Makefile','pom.xml','build.gradle','tests','test','.github'].filter(x=>names.has(x));
    if(names.has('package.json')){
     try{const p=await get(base+'/contents/package.json?ref='+encodeURIComponent(r.default_branch));if(p.encoding!=='base64'||p.size>100000)throw Error('Unsupported manifest');const json=JSON.parse(Buffer.from(p.content,'base64').toString('utf8'));row.scripts=['test','check','build','test:e2e','lint'].filter(k=>typeof json.scripts?.[k]==='string');}catch(e){row.errors.push('manifest: '+e.message);}
    }
   }catch(e){row.errors.push('root: '+e.message);}
   try{
    const data=await get(base+'/actions/runs?branch='+encodeURIComponent(r.default_branch)+'&per_page=1');
    const run=data.workflow_runs?.[0];row.lastCI=run?{id:run.id,status:run.status,conclusion:run.conclusion,sha:run.head_sha,url:'https://github.com/'+owner+'/'+r.name+'/actions/runs/'+run.id}:null;
   }catch(e){row.errors.push('CI: '+e.message);}
   rows.push(row);
  }
  if(list.length<100){complete=true;break;}
 }
 return {owner,scope:includePrivate?'accessible-owned-public-and-private':'public',inventoryComplete:complete,generatedAt:new Date().toISOString(),note:'Inventory only; CI refers to the latest returned workflow, not necessarily every check or HEAD. No target code executed.',rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const privateMode=process.argv.includes('--include-private');
 if(privateMode&&process.env.GITHUB_ACTIONS)throw Error('Private reports must remain local, not CI artifacts');
 const report=await scan({token:process.env.OMNI_READ_TOKEN||process.env.GITHUB_TOKEN||'',includePrivate:privateMode});
 const path=privateMode?'omni-private-report.json':'omni-public-report.json';
 await writeFile(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log('OMNI: '+report.rows.length+' repositories; scope '+report.scope+'; complete='+report.inventoryComplete);
 if(!report.inventoryComplete||report.rows.some(r=>r.errors.length))process.exitCode=1;
}
