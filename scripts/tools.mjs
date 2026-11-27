import {readFile,stat} from 'node:fs/promises';
import {createNativeBus,listNativeTools} from '../code-mode-x-tools.mjs';
import {parseProject} from '../code-mode-x-project.mjs';
try{
 const [command,name,argsText='{}',projectPath,...flags]=process.argv.slice(2);
 if(command==='list'){console.log(JSON.stringify({protocol:'studio-niko-native-tools/1',tools:listNativeTools()},null,2));}
 else if(command==='call'&&name){
  if(argsText.length>4000||flags.some(f=>f!=='--allow-public-network'))throw Error('Arguments invalides');
  let project=null;if(projectPath&&projectPath!=='-'){if((await stat(projectPath)).size>2000000)throw Error('Projet trop volumineux');project=parseProject(JSON.parse(await readFile(projectPath,'utf8')));}
  const bus=createNativeBus({project,permissions:flags.includes('--allow-public-network')?['project.read','github.public.read']:['project.read'],maxCalls:1});
  console.log(JSON.stringify(await bus.call(name,JSON.parse(argsText)),null,2));
 }else throw Error('Usage: node scripts/tools.mjs list | call outil JSON [projet.json|-] [--allow-public-network]');
}catch(e){console.error(e.message);process.exitCode=1;}
