/** Optionnel : génération IA avec OpenAI Responses API sur Vercel.
 * Variables serveur obligatoires : OPENAI_API_KEY, AUTOCODER_ACCESS_TOKEN.
 * Ne jamais placer de clé fournisseur dans le JavaScript servi au navigateur.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
const FILENAME = /^(?!\.)(?!.*\.\.)([a-zA-Z0-9][a-zA-Z0-9_.-]{0,63})\.(py|html|css|js|md|json)$/;
const asJson = (res,status,obj) => res.status(status).json(obj);
const hash = str => createHash('sha256').update(str).digest();
const safeToken = (input,expected) => {
  if(typeof input!=='string'||!expected)return false;
  return timingSafeEqual(hash(input),hash(expected));
};
const schema = {
  type:'object',additionalProperties:false,
  properties:{
    plan:{type:'array',items:{type:'string'}},
    notes:{type:'string'},
    files:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},content:{type:'string'}},required:['name','content']}}
  },required:['plan','notes','files']
};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return asJson(res,405,{error:'Méthode non autorisée.'});}
  const expected=process.env.AUTOCODER_ACCESS_TOKEN;
  const apiKey=process.env.OPENAI_API_KEY;
  if(!expected || expected.length<16 || !apiKey)return asJson(res,503,{error:'Le serveur IA n’est pas configuré.'});
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer ')||!safeToken(authorization.slice(7),expected))return asJson(res,401,{error:'Jeton d’accès invalide.'});
  const contentLength=Number(req.headers['content-length']||0);
  if(contentLength>80_000)return asJson(res,413,{error:'Demande trop volumineuse.'});
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(raw.length>80_000)return asJson(res,413,{error:'Demande trop volumineuse.'});
  let body;
  try {body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return asJson(res,400,{error:'JSON invalide.'});}
  if(!body || typeof body.prompt!=='string' || body.prompt.trim().length<3 || body.prompt.length>4000 || !Array.isArray(body.files)||body.files.length>12) return asJson(res,400,{error:'Demande invalide.'});
  const context=[];
  for(const file of body.files){
    if(!file||typeof file.name!=='string'||typeof file.content!=='string'||!FILENAME.test(file.name)||file.content.length>12000) return asJson(res,400,{error:'Contexte fichier invalide.'});
    context.push({name:file.name,content:file.content});
  }
  try {
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),58_000);
    let upstream;
    try {
      upstream=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},signal:abort.signal,
        body:JSON.stringify({
          model:process.env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:12000,
          instructions:`Tu es un assistant de développement logiciel exigeant, francophone. Génère des fichiers exécutables et cohérents, pas de simulation de tests. Retourne uniquement du JSON structuré. Liste plate de fichiers, sans dossiers. Extensions autorisées : py, html, css, js, md, json. Pas de clé secrète, pas de contenu caché, pas de dépendances inutiles. Pour Python, génère main.py et test_main.py avec unittest si applicable ; pour le web, index.html, style.css et script.js. Le plan décrit les actions proposées, pas des actions prétendument réalisées. L'utilisateur exécutera lui-même les fichiers et les tests.`,
          input:JSON.stringify({demande:body.prompt,projetExistant:context}),
          text:{format:{type:'json_schema',name:'autocoder_project',strict:true,schema}}
        })
      });
    } finally {clearTimeout(timeout);}
    if(!upstream.ok){
      // Éviter de divulguer des informations du fournisseur ou des secrets.
      return asJson(res,502,{error:'Le service de génération IA a refusé la demande ('+upstream.status+').'});
    }
    const response=await upstream.json();
    const plain=(response.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('');
    if(!plain)return asJson(res,502,{error:'Le modèle n’a pas renvoyé de code exploitable.'});
    let payload;
    try {payload=JSON.parse(plain);}catch{return asJson(res,502,{error:'La réponse du modèle n’est pas un JSON valide.'});}
    if(!payload || !Array.isArray(payload.files)||!payload.files.length||payload.files.length>30)return asJson(res,502,{error:'Le modèle a retourné un projet invalide.'});
    let total=0;const names=new Set();
    for(const file of payload.files){
      if(!file||!FILENAME.test(file.name)||typeof file.content!=='string'||file.content.length>120000||names.has(file.name))return asJson(res,502,{error:'Fichier généré invalide.'});
      names.add(file.name);total+=file.content.length;
    }
    if(total>300000)return asJson(res,502,{error:'Projet généré trop volumineux.'});
    return asJson(res,200,{plan:Array.isArray(payload.plan)?payload.plan.slice(0,6):[],notes:String(payload.notes||''),files:payload.files});
  }catch(err){
    if(err.name==='AbortError')return asJson(res,504,{error:'Le fournisseur IA a dépassé la durée autorisée.'});
    return asJson(res,502,{error:'Service IA momentanément indisponible.'});
  }
}
