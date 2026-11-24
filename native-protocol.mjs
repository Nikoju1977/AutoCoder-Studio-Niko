// Studio Niko Native Protocol 1 — local JSON request/response.
import {createNativeBus} from './code-mode-x-tools.mjs';
export const PROTOCOL='studio-niko-tools/1';
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const permitted=new Set(['project.read','quantum.compute']);
const encode=x=>new TextEncoder().encode(JSON.stringify(x)).length;
export function createGateway({project=null,permissions=['project.read'],app='local',maxCalls=10}={}){
 if(typeof app!=='string'||!ID.test(app)||!Array.isArray(permissions)||permissions.some(p=>!permitted.has(p)))throw Error('Invalid local operator policy');
 const bus=createNativeBus({project,permissions,maxCalls});
 const allowed=new Set(bus.list().map(t=>t.name));
 let requests=0;
 return Object.freeze({async dispatch(req){
  const id=typeof req?.id==='string'&&ID.test(req.id)?req.id:null;
  const response=(payload)=>({protocol:PROTOCOL,id,...payload});
  const fail=(code)=>response({ok:false,error:{code}});
  if(++requests>maxCalls*2+2)return fail('SESSION_LIMIT');
  if(!object(req)||id===null||req.protocol!==PROTOCOL||!object(req.params)||Object.keys(req).some(k=>!['protocol','id','method','params'].includes(k))||encode(req)>24000)return fail('INVALID_REQUEST');
  if(req.method==='tools.list'){
   if(Object.keys(req.params).length)return fail('INVALID_PARAMS');
   return response({ok:true,result:{app,tools:bus.list()}});
  }
  if(req.method!=='tools.call')return fail('UNKNOWN_METHOD');
  const {name,args}=req.params;
  if(Object.keys(req.params).length!==2||typeof name!=='string'||!object(args))return fail('INVALID_PARAMS');
  if(!allowed.has(name))return fail('TOOL_DENIED');
  try{
   const r=await bus.call(name,args);
   const out=response({ok:true,result:r.result});
   if(encode(out)>256000)return fail('RESULT_LIMIT');
   return out;
  }catch{return fail('TOOL_FAILED');}
 }});
}
export function createClient(transport){
 if(typeof transport!=='function')throw Error('Transport required');
 let seq=0;
 async function request(method,params){
  const id='req-'+(++seq);
  const res=await transport({protocol:PROTOCOL,id,method,params});
  if(!object(res)||res.protocol!==PROTOCOL||res.id!==id||typeof res.ok!=='boolean')throw Error('Invalid response');
  if(!res.ok)throw Error(res.error?.code||'GATEWAY_ERROR');
  return res.result;
 }
 return Object.freeze({list:()=>request('tools.list',{}),call:(name,args={})=>request('tools.call',{name,args})});
}
