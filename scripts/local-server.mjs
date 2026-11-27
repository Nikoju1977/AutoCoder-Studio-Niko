import {readFile,stat} from 'node:fs/promises';
import {createLocalServer} from '../local-infrastructure.mjs';
import {parseProject} from '../code-mode-x-project.mjs';
try{
 const [configPath,portText='8765',...extra]=process.argv.slice(2);
 const port=Number(portText);
 if(!configPath||extra.length||!Number.isInteger(port)||port<1024||port>65535||(await stat(configPath)).size>32000)throw Error('Invalid config or port');
 const config=JSON.parse(await readFile(configPath,'utf8'));
 if(!Array.isArray(config.apps)||config.apps.length>20)throw Error('Invalid apps');
 const apps=[];
 for(const a of config.apps){
  if(typeof a.tokenEnv!=='string'||!/^CMX_APP_[A-Z0-9_]+$/.test(a.tokenEnv))throw Error('Token environment required');
  let project=null;
  if(a.project){if((await stat(a.project)).size>2000000)throw Error('Project too large');project=parseProject(JSON.parse(await readFile(a.project,'utf8')));}
  apps.push({id:a.id,token:process.env[a.tokenEnv],permissions:a.permissions,project});
 }
 const server=createLocalServer({apps});
 server.on('error',()=>{console.error('Local gateway unavailable');process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.error('Studio Niko local gateway: http://127.0.0.1:'+port));
 for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>server.close());
}catch{console.error('Invalid local gateway configuration');process.exitCode=1;}
