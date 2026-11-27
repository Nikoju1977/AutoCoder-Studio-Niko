import {createClient} from '../native-protocol.mjs';
export function httpClient({port=8765,app,token,fetchImpl=globalThis.fetch}={}){
 if(!Number.isInteger(port)||port<1||port>65535||typeof app!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(app)||typeof token!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw Error('Invalid local client settings');
 return createClient(async req=>{
  const body=JSON.stringify(req);if(new TextEncoder().encode(body).length>24000)throw Error('Request too large');
  const response=await fetchImpl('http://127.0.0.1:'+port+'/v1/tools',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-App':app,Authorization:'Bearer '+token},body,redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Gateway HTTP '+response.status);
  const reader=response.body.getReader();let n=0,raw='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>256000){await reader.cancel();throw Error('Response too large');}raw+=decoder.decode(value,{stream:true});}return JSON.parse(raw+decoder.decode());}finally{reader.releaseLock();}
 });
}
