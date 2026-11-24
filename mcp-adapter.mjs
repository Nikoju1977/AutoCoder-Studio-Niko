// Optional legacy MCP stdio adapter, limited to tools/list and tools/call.
import {PROTOCOL} from './native-protocol.mjs';
export function createMcpAdapter(gateway){
 let initialized=false,ready=false,seq=0;
 return async req=>{
  const id=req?.id??null,reply=result=>({jsonrpc:'2.0',id,result}),fail=(code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
  if(!req||Array.isArray(req)||req.jsonrpc!=='2.0'||typeof req.method!=='string')return fail(-32600,'Invalid request');
  if(!Object.hasOwn(req,'id')){if(initialized&&req.method==='notifications/initialized')ready=true;return null;}
  if(typeof id!=='string'&&typeof id!=='number')return fail(-32600,'Invalid ID');
  if(req.method==='initialize'){
   if(initialized)return fail(-32600,'Already initialized');
   if(typeof req.params?.protocolVersion!=='string')return fail(-32602,'Invalid params');
   initialized=true;return reply({protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'studio-niko-tools',version:'1.0.0'}});
  }
  if(req.method==='ping')return reply({});
  if(!ready)return fail(-32002,'Not initialized');
  const dispatch=async(method,params)=>gateway.dispatch({protocol:PROTOCOL,id:'mcp-'+(++seq),method,params});
  if(req.method==='tools/list'){
   const r=await dispatch('tools.list',{});if(!r.ok)return fail(-32000,r.error.code);
   return reply({tools:r.result.tools.map(({name,description,inputSchema})=>({name:name.replaceAll('.','_'),description,inputSchema}))});
  }
  if(req.method==='tools/call'){
   const name=req.params?.name,args=req.params?.arguments??{};
   if(typeof name!=='string'||!args||typeof args!=='object'||Array.isArray(args))return fail(-32602,'Invalid params');
   const r=await dispatch('tools.call',{name:name.replaceAll('_','.'),args});
   return reply({content:[{type:'text',text:JSON.stringify(r.ok?r.result:r.error)}],isError:!r.ok});
  }
  return fail(-32601,'Method not found');
 };
}
