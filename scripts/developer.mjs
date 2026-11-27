import {writeFile} from 'node:fs/promises';
import {listPublicRepo,readPublicAuditBlob} from '../code-mode-x-github.mjs';
import {prepareDeveloper,develop} from '../developer-runtime.mjs';
import {createHttpAgentTransport} from '../code-mode-x-team.mjs';
try{
 const [repo,branch,provider,output,prompt,...args]=process.argv.slice(2);
 const i=args.indexOf('--approve'),paths=i<0?args:args.slice(0,i),approval=i<0?null:args[i+1];
 if(!repo||!branch||!provider||!output||!prompt||paths.length<1||paths.length>3||new Set(paths).size!==paths.length||(i>=0&&(!approval||args.length!==i+2)))throw Error('Usage');
 const token=process.env.CMX_GITHUB_READ_TOKEN;
 const fetchImpl=(url,opts)=>{if(new URL(url).origin!=='https://api.github.com')throw Error('Invalid URL');return fetch(url,{...opts,redirect:'error',headers:{...opts.headers,...(token?{Authorization:'Bearer '+token}:{})}});};
 const options={branch,fetchImpl,inventoryLimit:10000};
 const snapshot=await listPublicRepo(repo,options);if(snapshot.partial)throw Error('Incomplete tree');
 const files=[];for(const p of paths)files.push(await readPublicAuditBlob(snapshot,p,options));
 const spec={repo:snapshot.repo,branch:snapshot.branch,commit:snapshot.commit,provider,prompt,files};
 const plan=prepareDeveloper(spec);
 if(!approval){console.log(JSON.stringify({status:'approval_required',manifest:plan.manifest,before:plan.before,approvalDigest:plan.approvalDigest,notice:'Approval authorizes transfer of selected public source to configured AI provider. Calls may cost money.'},null,2));}
 else{
  const result=await develop({spec,approval,request:createHttpAgentTransport({token:process.env.AUTOCODER_ACCESS_TOKEN})});
  if(result.proposal)await writeFile(output,JSON.stringify(result.proposal,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:result.status,reports:result.reports,providerCalls:result.providerCalls,approvalDigest:result.approvalDigest,testsExecuted:false},null,2));
 }
}catch{console.error('Developer mission refused or failed. Check public repository, syntax, approval, API configuration and file limits.');process.exitCode=1;}
