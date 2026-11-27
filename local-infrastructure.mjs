// Studio Niko Infrastructure V20 — authenticated loopback HTTP, no public exposure.
import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createGateway} from './native-protocol.mjs';
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const TOKEN=/^[A-Za-z0-9_-]{43,128}$/;
const hash=x=>createHash('sha256').update(x).digest();
export function createLocalServer({apps,now=Date.now}={}){
 if(!Array.isArray(apps)||apps.length<1||apps.length>20)throw Error('Invalid app policy');
 const policies=new Map(),tokens=new Set();
 for(const a of apps){
  if(!a||!ID.test(a.id)||typeof a.token!=='string'||!TOKEN.test(a.token)||policies.has(a.id)||tokens.has(a.token)||!Array.isArray(a.permissions)||a.permissions.some(p=>!['project.read','quantum.compute'].includes(p)))throw Error('Invalid app policy');
  if(a.permissions.includes('project.read')&&!a.project?.files?.length)throw Error('Project required');
  const permissions=[...a.permissions],project=a.project?structuredClone(a.project):null;
  createGateway({app:a.id,project,permissions,maxCalls:1});
  tokens.add(a.token);policies.set(a.id,{digest:hash(a.token),permissions,project,window:-1,used:0,total:0});
 }
 tokens.clear();
 let active=0;
 const server=createServer({maxHeaderSize:8192,requestTimeout:10000,headersTimeout:5000},async(req,res)=>{
  const reply=(status,body)=>{if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Connection':'close'});res.end(JSON.stringify(body));};
  const error=(status,code)=>reply(status,{error:{code}});
  const port=server.address()?.port;
  if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!=='127.0.0.1:'+port||req.headers.origin!==undefined||req.headers['sec-fetch-site']!==undefined)return error(403,'LOCAL_CLIENT_ONLY');
  if(req.method!=='POST'||req.url!=='/v1/tools')return error(404,'NOT_FOUND');
  const id=req.headers['x-studio-app'],auth=req.headers.authorization;
  const p=typeof id==='string'?policies.get(id):null;
  if(!p||typeof auth!=='string'||!auth.startsWith('Bearer ')||!TOKEN.test(auth.slice(7))||!timingSafeEqual(p.digest,hash(auth.slice(7))))return error(401,'UNAUTHORIZED');
  if(req.headers['content-type']?.split(';')[0]!=='application/json')return error(415,'JSON_REQUIRED');
  const minute=Math.floor(now()/60000);
  if(minute!==p.window){p.window=minute;p.used=0;}
  if(p.used>=30||p.total>=1000)return error(429,'APP_LIMIT');
  if(active>=4)return error(503,'BUSY');
  p.used++;p.total++;active++;
  try{
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>24000){error(413,'REQUEST_LIMIT');return;}chunks.push(chunk);}
   let raw;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return error(400,'INVALID_JSON');}
   const gateway=createGateway({app:id,project:p.project,permissions:p.permissions,maxCalls:1});
   reply(200,await gateway.dispatch(raw));
  }catch{error(500,'GATEWAY_ERROR');}finally{active--;}
 });
 server.maxConnections=32;server.keepAliveTimeout=1000;
 return server;
}
