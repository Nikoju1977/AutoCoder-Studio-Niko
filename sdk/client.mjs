// Node SDK for external local applications. No network listener.
import {spawn} from 'node:child_process';
import {createClient} from '../native-protocol.mjs';
export function localClient({gateway,app,project='-',quantumSimulation=false,node='node'}={}){
 if(typeof gateway!=='string'||!gateway||typeof app!=='string'||!app)throw Error('Gateway and app required');
 return createClient(req=>new Promise((resolve,reject)=>{
  const payload=JSON.stringify(req);
  if(Buffer.byteLength(payload)>24000){reject(Error('Request too large'));return;}
  const child=spawn(node,[gateway,app,project,...(quantumSimulation?['--quantum-simulation']:[])],{shell:false,stdio:['pipe','pipe','ignore']});
  let size=0,output='';const timeout=setTimeout(()=>{child.kill();reject(Error('Gateway timeout'));},15000);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>256000){child.kill();reject(Error('Response too large'));}else output+=chunk;});
  child.on('error',err=>{clearTimeout(timeout);reject(err);});
  child.stdin.on('error',()=>{});
  child.on('close',code=>{clearTimeout(timeout);if(code!==0){reject(Error('Gateway rejected request'));return;}try{resolve(JSON.parse(output));}catch{reject(Error('Invalid JSON response'));}});
  child.stdin.end(payload);
 }));
}
