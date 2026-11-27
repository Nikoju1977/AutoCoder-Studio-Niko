import {matches,issue,verified,setCookie,sameOrigin} from '../server-session.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 const secret=process.env.AUTOCODER_ACCESS_TOKEN;
 if(req.method==='GET')return res.status(200).json({authenticated:verified(req,secret)});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Méthode non autorisée'});}
 if(!sameOrigin(req)||!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']||''))return res.status(403).json({error:'Origine ou type refusé'});
 let body;try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});if(Buffer.byteLength(raw)>2048)return res.status(413).json({error:'Demande trop longue'});body=JSON.parse(raw);}catch{return res.status(400).json({error:'JSON invalide'});}
 if(body?.action==='logout'){res.setHeader('Set-Cookie',setCookie('',0));return res.status(200).json({authenticated:false});}
 if(body?.action!=='login')return res.status(400).json({error:'Action invalide'});
 if(!secret||secret.length<32)return res.status(503).json({error:'Session non configurée'});
 if(typeof body.token!=='string'||body.token.length<32||!matches(body.token,secret))return res.status(401).json({error:'Jeton incorrect'});
 res.setHeader('Set-Cookie',setCookie(issue(secret)));return res.status(200).json({authenticated:true,expiresInDays:7});
}
