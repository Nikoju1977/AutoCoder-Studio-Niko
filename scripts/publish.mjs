// Node 20+; never put a GitHub token in a command argument or project file.
import {readFile,stat} from 'node:fs/promises';
import {createGitHubClient,inspectProposal,publishDraft} from '../code-mode-x-publish.mjs';
try{
 const [path,mode,approval,...extra]=process.argv.slice(2);
 if(!path||extra.length||!(mode===undefined||(mode==='--publish'&&approval)))throw Error('Usage: node scripts/publish.mjs proposition.json [--publish SHA256]');
 if((await stat(path)).size>500000)throw Error('Fichier trop volumineux');
 const raw=JSON.parse(await readFile(path,'utf8'));
 const request=createGitHubClient({token:process.env.CMX_GITHUB_TOKEN});
 if(mode==='--publish'){
  const result=await publishDraft(raw,{request,approval});console.log(JSON.stringify(result,null,2));if(result.status!=='draft_created')process.exitCode=1;
 }else{
  const r=await inspectProposal(raw,request);
  console.log(JSON.stringify({status:'review_required',repo:r.p.repo,branch:r.p.branch,commit:r.p.commit,files:r.p.changes.map(f=>f.path),approval:r.digest,testsExecuted:false},null,2));
 }
}catch(e){console.error(e.message);process.exitCode=1;}
