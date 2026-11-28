// Local-only provider transport. No shell, no remote URL, no GitHub write.
export async function runLocal({provider,model,flow,prompt,consent=false,key,fetchImpl=globalThis.fetch}={}){
 if(consent!==true)throw Error('Consentement explicite requis');
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)throw Error('Mission invalide');
 let url,body,headers={'Content-Type':'application/json'};
 if(provider==='ollama'){
  if(typeof model!=='string'||!/^[-a-zA-Z0-9._:/]{1,100}$/.test(model)||model.endsWith(':cloud')||model.includes('-cloud'))throw Error('Modèle local requis');
  url='http://127.0.0.1:11434/api/chat';body={model,stream:false,messages:[{role:'system',content:'Propose uniquement du code et des tests à revoir. Ne prétends pas avoir exécuté des tests.'},{role:'user',content:prompt}]};
 }else if(provider==='langflow'){
  if(typeof flow!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(flow))throw Error('Flow invalide');
  if(typeof key!=='string'||!key||key.length>1000)throw Error('Clé Langflow requise');
  url='http://127.0.0.1:7860/api/v1/run/'+flow;headers['x-api-key']=key;body={input_value:prompt,input_type:'chat',output_type:'chat'};
 }else throw Error('Fournisseur inconnu');
 const res=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!res.ok)throw Error('HTTP '+res.status);
 const reader=res.body?.getReader();if(!reader)throw Error('Réponse indisponible');
 let n=0,raw='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>1000000){await reader.cancel();throw Error('Réponse trop volumineuse');}raw+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
 const data=JSON.parse(raw+decoder.decode());
 if(provider==='ollama'&&typeof data?.message?.content!=='string')throw Error('Réponse Ollama invalide');
 return {provider,status:'review_required',testsExecuted:false,result:provider==='ollama'?data.message.content:data};
}
