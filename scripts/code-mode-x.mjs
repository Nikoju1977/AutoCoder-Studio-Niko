// Studio Niko Design — local CLI, no writes or publishing.
import { readFile, stat } from 'node:fs/promises';
import { runCodeMode } from '../code-mode-x.mjs';
import { runAgentTeam, createHttpAgentTransport } from '../code-mode-x-team.mjs';
try {
  const path=process.argv[2];
  if(!path)throw Error('Usage: node scripts/code-mode-x.mjs projet.json [--team "demande"]');
  if((await stat(path)).size>2_000_000)throw Error('Export trop volumineux');
  const input=JSON.parse(await readFile(path,'utf8'));
  const raw=Array.isArray(input)?input:input.files;
  const files=Array.isArray(raw)?raw:raw&&typeof raw==='object'?Object.entries(raw).map(([name,content])=>({name,content})):null;
  if(!files)throw Error('Export AutoCoder invalide');
  let result;
  if(process.argv[3]==='--team'){
    if(!process.argv[4])throw Error('Demande requise');
    const request=createHttpAgentTransport({token:process.env.AUTOCODER_ACCESS_TOKEN});
    result=await runAgentTeam({prompt:process.argv[4],files,request});
  }else if(process.argv.length===3){
    result=await runCodeMode({prompt:'Audit local du projet',files});
  }else throw Error('Option inconnue');
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.status==='blocked'||result.status==='cancelled'||!result.audit?.passed?1:0;
}catch(e){console.error(e.message);process.exitCode=2;}
