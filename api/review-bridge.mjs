import {verified,sameOrigin} from '../server-session.mjs';
import {createBridge,ReviewError,MAX_BODY} from '../review-bridge.mjs';

export function makeHandler({env=process.env,fetchImpl=globalThis.fetch}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'&&req.method!=='POST'){
   res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Méthode non autorisée.'});
  }
  if(!verified(req,env.AUTOCODER_ACCESS_TOKEN))return res.status(401).json({error:'Session Autopilot requise.'});
  const bridge=createBridge({token:env.AUTOPILOT_REVIEW_TOKEN,fetchImpl});
  if(req.method==='GET')return res.status(200).json(await bridge.status());
  if(!sameOrigin(req)||!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']||''))return res.status(403).json({error:'Origine ou type refusé.'});
  try{
   const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});
   if(Buffer.byteLength(raw)>MAX_BODY)return res.status(413).json({error:'Proposition trop volumineuse.'});
   const data=JSON.parse(raw);
   // Exact known credential guard, in addition to the generic secret filters.
   const candidates=data?.proposal?.changes;
   if(Array.isArray(candidates)){
    const secrets=[env.AUTOCODER_ACCESS_TOKEN,env.AGNES_API_KEY,env.MISTRAL_API_KEY,env.OPENAI_API_KEY,env.AUTOPILOT_REVIEW_TOKEN].filter(x=>typeof x==='string'&&x.length>=12);
    if(candidates.some(c=>typeof c?.content==='string'&&secrets.some(x=>c.content.includes(x))))return res.status(422).json({error:'Secret potentiel détecté : transfert refusé.'});
   }
   const result=await bridge.submit(data);
   return res.status(result.reused?200:201).json(result);
  }catch(e){
   if(e instanceof SyntaxError)return res.status(400).json({error:'JSON invalide.'});
   if(e instanceof ReviewError)return res.status(e.status).json({error:e.message});
   return res.status(502).json({error:'Transfert privé impossible. Aucun détail sensible journalisé.'});
  }
 };
}
export default makeHandler();
