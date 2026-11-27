import {readFile,stat} from 'node:fs/promises';
import {createGateway} from '../native-protocol.mjs';
import {parseProject} from '../code-mode-x-project.mjs';
import {createMcpAdapter} from '../mcp-adapter.mjs';
try{
 const [path,...rest]=process.argv.slice(2);if(!path||rest.length||(await stat(path)).size>2000000)throw Error('Project required');
 const project=parseProject(JSON.parse(await readFile(path,'utf8')));
 const handle=createMcpAdapter(createGateway({app:'mcp-local',project,permissions:['project.read'],maxCalls:20}));
 let pending=Buffer.alloc(0);
 for await(const chunk of process.stdin){
  pending=Buffer.concat([pending,chunk]);
  let i;
  while((i=pending.indexOf(10))!==-1){
   if(i>24000)throw Error('Frame too large');
   const line=pending.subarray(0,i).toString('utf8');pending=pending.subarray(i+1);
   if(!line.trim())continue;
   let req;try{req=JSON.parse(line);}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');continue;}
   const r=await handle(req);if(r)process.stdout.write(JSON.stringify(r)+'\n');
  }
  if(pending.length>24000)throw Error('Frame too large');
 }
}catch{console.error('MCP local adapter stopped');process.exitCode=1;}
