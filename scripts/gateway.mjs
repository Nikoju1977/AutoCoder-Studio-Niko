// One request over stdin; operator chooses the project and grants permissions.
import {readFile,stat} from 'node:fs/promises';
import {createGateway} from '../native-protocol.mjs';
import {parseProject} from '../code-mode-x-project.mjs';
try{
 const [app,projectPath,...flags]=process.argv.slice(2);
 if(!app||!projectPath||flags.some(f=>f!=='--quantum-simulation'))throw Error('Usage: node scripts/gateway.mjs APP PROJECT_JSON|- [--quantum-simulation]');
 let project=null;
 if(projectPath!=='-'){
  if((await stat(projectPath)).size>2000000)throw Error('Project too large');
  project=parseProject(JSON.parse(await readFile(projectPath,'utf8')));
 }
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>24000)throw Error('Request too large');chunks.push(chunk);}
 const req=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const gateway=createGateway({app,project,permissions:[...(project?['project.read']:[]),...(flags.includes('--quantum-simulation')?['quantum.compute']:[])],maxCalls:1});
 process.stdout.write(JSON.stringify(await gateway.dispatch(req))+'\n');
}catch{process.stderr.write('Gateway request rejected\n');process.exitCode=1;}
