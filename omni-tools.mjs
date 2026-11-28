// Studio Niko Design — OMNI registry. No external code is executed.
export const TOOLS=Object.freeze([
 ['openhands','OpenHands','OpenHands/OpenHands','development','Transfert manuel vers un agent de code isolé'],
 ['langflow','Langflow','langflow-ai/langflow','agents','API locale de workflows'],
 ['ollama','Ollama','ollama/ollama','ai','API locale de modèles'],
 ['scrapling','Scrapling','D4Vinci/Scrapling','data','Collecte autorisée, à installer séparément'],
 ['mcp','Awesome MCP Servers','punkpeye/awesome-mcp-servers','connectors','Annuaire de serveurs, pas un serveur MCP'],
 ['llm','Awesome LLM Apps','Shubhamsaboo/awesome-llm-apps','agents','Exemples de RAG et agents'],
 ['apis','Public APIs','public-apis/public-apis','data','Annuaire API, quotas à vérifier'],
 ['free','Free for Dev','ripienaar/free-for-dev','hosting','Offres gratuites à vérifier'],
 ['awesome','Awesome','sindresorhus/awesome','research','Annuaire de ressources']
].map(([id,name,repo,category,description])=>Object.freeze({id,name,repo,category,description})));
export function searchTools(query=''){
 if(typeof query!=='string'||query.length>200)throw Error('Recherche invalide');
 const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return TOOLS.filter(t=>words.every(w=>Object.values(t).join(' ').toLowerCase().includes(w)));
}
export function makeMission({repo,goal,tool}={}){
 if(typeof repo!=='string'||!/^[-\w.]{1,39}\/[-\w.]{1,100}$/.test(repo)||repo.split('/').some(s=>s==='.'||s==='..'))throw Error('Dépôt invalide');
 if(typeof goal!=='string'||goal.trim().length<3||goal.length>1800)throw Error('Mission invalide');
 const t=TOOLS.find(t=>t.id===tool);if(!t)throw Error('Outil inconnu');
 return {schema:'niko-omni-mission-v1',repository:repo,tool:t.id,goal:goal.trim(),instruction:'Proposer une modification limitée et justifiée. Préserver les licences et la confidentialité. Ne pas publier, fusionner, déployer ou accéder aux secrets. Fournir diff, plan de tests et preuves disponibles. Toute modification exige une revue humaine.',status:'review_required',testsExecuted:false};
}
