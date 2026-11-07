/** Indique uniquement si le serveur IA possède les paramètres requis, sans secret. */
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Méthode non autorisée.'});
  }
  const configured=Boolean(process.env.OPENAI_API_KEY && (process.env.AUTOCODER_ACCESS_TOKEN||'').length>=16);
  return res.status(200).json({configured,mode:configured?'server-ready':'local-only'});
}
