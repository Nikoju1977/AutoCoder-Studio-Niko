import {TARGET,MISSION,innovateNative} from '../innovator-native.mjs';
import {createHttpAgentTransport} from '../code-mode-x-team.mjs';
const args=process.argv.slice(2);
if(args.length===0){console.log(JSON.stringify({target:TARGET,mission:MISSION,status:'prepared',providerCalls:0},null,2));}
else if(args.length===1&&args[0]==='--run'){
 try{
  const request=createHttpAgentTransport({token:process.env.AUTOCODER_ACCESS_TOKEN});
  const result=await innovateNative({approved:true,request});
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error('Innovation refusée ou indisponible : '+String(e.message).slice(0,200));process.exitCode=1;}
}else{console.error('Usage: node scripts/innovator-native.mjs [--run]');process.exitCode=2;}
