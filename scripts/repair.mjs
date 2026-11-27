// Local CLI only. Never publish automatically or send source to an AI.
import {writeFile} from 'node:fs/promises';
import {listPublicRepo,readPublicAuditBlob,parseRepo} from '../code-mode-x-github.mjs';
import {prepareRepair} from '../repair-engine.mjs';
try{
 const [repo,branch,output,...paths]=process.argv.slice(2);
 if(!repo||!branch||!output||paths.length<1||paths.length>3||new Set(paths).size!==paths.length)throw Error('Usage: node scripts/repair.mjs OWNER/REPO BRANCH OUTPUT.json PATH [PATH PATH]');
 if(parseRepo(repo).split('/')[0].toLowerCase()!=='nikoju1977')throw Error('Repository outside scope');
 const token=process.env.CMX_GITHUB_READ_TOKEN;
 const fetchImpl=(url,options)=>{if(new URL(url).origin!=='https://api.github.com')throw Error('Invalid URL');return fetch(url,{...options,redirect:'error',headers:{...options.headers,...(token?{Authorization:'Bearer '+token}:{})}});};
 const options={branch,fetchImpl,inventoryLimit:10000,maxFileBytes:120000};
 const snapshot=await listPublicRepo(repo,options);
 if(snapshot.partial)throw Error('Incomplete inventory');
 const files=[];
 for(const path of paths)files.push(await readPublicAuditBlob(snapshot,path,options));
 const result=prepareRepair({repo:snapshot.repo,branch:snapshot.branch,commit:snapshot.commit,files});
 if(result.proposal)await writeFile(output,JSON.stringify(result.proposal,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:result.status,reports:result.reports,approvalDigest:result.approvalDigest,output:result.proposal?output:null,testsExecuted:false},null,2));
}catch{console.error('Repair preparation failed; check arguments, GitHub access, file limits and output path.');process.exitCode=1;}
