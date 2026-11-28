import {readFile} from 'node:fs/promises';
import {runLocal} from '../omni-local.mjs';
const [provider,selector,path,flag]=process.argv.slice(2);
try{
 if(!path||flag!=='--run'||!['ollama','langflow'].includes(provider))throw Error('Usage : node scripts/omni-local.mjs ollama|langflow modèle|flow mission.json --run');
 const raw=await readFile(path,'utf8');if(raw.length>16000)throw Error('Mission trop volumineuse');
 const m=JSON.parse(raw);if(m.schema!=='niko-omni-mission-v1'||typeof m.goal!=='string'||typeof m.repository!=='string'||typeof m.instruction!=='string')throw Error('Mission invalide');
 const output=await runLocal({provider,model:selector,flow:selector,prompt:[m.repository,m.goal,m.instruction].join('\n'),consent:true,key:process.env.LANGFLOW_API_KEY});
 console.log(JSON.stringify(output,null,2));
}catch(e){console.error('OMNI : '+e.message);process.exitCode=1;}
