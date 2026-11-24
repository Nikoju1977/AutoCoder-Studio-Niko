// Studio Niko Design — server-only provider routing. No client keys.
const definitions = Object.freeze({
  openai: {key:'OPENAI_API_KEY', model:'OPENAI_MODEL', defaultModel:'gpt-4.1-mini', url:'https://api.openai.com/v1/responses'},
  mistral: {key:'MISTRAL_API_KEY', model:'MISTRAL_MODEL', defaultModel:'mistral-small-latest', url:'https://api.mistral.ai/v1/chat/completions'},
  agnes: {key:'AGNES_API_KEY', model:'AGNES_MODEL', defaultModel:'agnes-2.5-flash', url:'https://apihub.agnes-ai.com/v1/chat/completions'}
});
const roles = Object.freeze({architect:'AUTOCODER_ARCHITECT_PROVIDER',developer:'AUTOCODER_DEVELOPER_PROVIDER',critic:'AUTOCODER_CRITIC_PROVIDER'});
export const knownProvider = name => typeof name==='string' && Object.hasOwn(definitions,name);
export const knownRole = role => typeof role==='string' && Object.hasOwn(roles,role);
export function availableProviders(env=process.env){
  return Object.keys(definitions).filter(name=>Boolean(env[definitions[name].key]?.trim()));
}
export function selectProvider({provider,role}={},env=process.env){
  const available=availableProviders(env);
  const name=provider??(knownRole(role)?env[roles[role]]||undefined:undefined)??(env.AUTOCODER_DEFAULT_PROVIDER||undefined)??available[0];
  if(!knownProvider(name)||!available.includes(name))return null;
  const d=definitions[name];
  return {name,url:d.url,key:env[d.key].trim(),model:env[d.model]?.trim()||d.defaultModel};
}
export function providerBody(config,instructions,input,schema){
  if(config.name==='openai')return {model:config.model,store:false,max_output_tokens:12000,instructions,input,text:{format:{type:'json_schema',name:'autocoder_project',strict:true,schema}}};
  const body={model:config.model,max_tokens:12000,messages:[{role:'system',content:instructions+'\nRetourne exclusivement un objet JSON valide, sans balises Markdown, au format {"plan":["étape"],"notes":"texte","files":[{"name":"main.py","content":"code complet"}]}.'},{role:'user',content:input}]};
  if(config.name==='mistral')body.response_format={type:'json_object'};
  // Agnes chat is OpenAI-compatible; JSON mode is not assumed.
  return body;
}
export function extractText(config,response){
  if(config.name==='openai')return (Array.isArray(response?.output)?response.output:[]).flatMap(item=>Array.isArray(item?.content)?item.content:[]).filter(item=>item?.type==='output_text'&&typeof item.text==='string').map(item=>item.text).join('');
  const content=response?.choices?.[0]?.message?.content;
  return typeof content==='string'?content:Array.isArray(content)?content.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join(''):'';
}
