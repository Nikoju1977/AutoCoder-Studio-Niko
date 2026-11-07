import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import handler from '../api/generate.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const text=name=>readFileSync(resolve(base,name),'utf8');
const request=async(method,token,body)=>{
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};
  await handler({method,headers:{authorization:token?'Bearer '+token:'','content-length':'200'},body},res);
  return res;
};
test('la coque contient tous les fichiers de la PWA',()=>{
  for(const name of ['index.html','styles.css','app.js','py-worker.js','sw.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png']){
    assert.equal(existsSync(resolve(base,name)),true,name);
  }
});
test('les contrôles principaux sont présents',()=>{
  const html=text('index.html');
  for(const id of ['btn-generate','code-editor','btn-run','btn-stop','btn-tests','btn-preview','btn-export','btn-import','log-list','diagnostic-list'])assert.match(html,new RegExp(`id="${id}"`));
});
test('la CSP de l’interface interdit les scripts distants et les objets',()=>{
  assert.match(text('index.html'),/script-src 'self'/);
  assert.match(text('index.html'),/object-src 'none'/);
});
test('le Worker utilise Pyodide dans un thread séparé',()=>{
  assert.match(text('app.js'),/new Worker\('\.\/py-worker\.js'\)/);
  assert.match(text('py-worker.js'),/loadPyodide/);
});
test('l’API IA refuse les méthodes autres que POST',async()=>{
  const res=await request('GET',null,{});assert.equal(res.statusCode,405);
});
test('l’API IA refuse si les paramètres secrets manquent',async()=>{
  const old=process.env.OPENAI_API_KEY;const tok=process.env.AUTOCODER_ACCESS_TOKEN;
  delete process.env.OPENAI_API_KEY;delete process.env.AUTOCODER_ACCESS_TOKEN;
  try {const res=await request('POST',null,{});assert.equal(res.statusCode,503);}finally{if(old)process.env.OPENAI_API_KEY=old;if(tok)process.env.AUTOCODER_ACCESS_TOKEN=tok;}
});
test('l’API IA exige l’authentification',async()=>{
  process.env.OPENAI_API_KEY='fake-key';process.env.AUTOCODER_ACCESS_TOKEN='example-only-strong-token-456';
  const res=await request('POST','mauvais-jeton',{prompt:'Bonjour',files:[]});assert.equal(res.statusCode,401);
});
test('l’API IA refuse les données invalides',async()=>{
  process.env.OPENAI_API_KEY='fake-key';process.env.AUTOCODER_ACCESS_TOKEN='example-only-strong-token-456';
  const res=await request('POST','example-only-strong-token-456',{prompt:'',files:[]});assert.equal(res.statusCode,400);
});
test('l’API IA interprète une réponse JSON structurée valide sans exposer de clé',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({plan:['Architecture'],notes:'À tester',files:[{name:'main.py',content:'print(42)'}]})}]}]})});
  try{
    process.env.OPENAI_API_KEY='fake-key';process.env.AUTOCODER_ACCESS_TOKEN='example-only-strong-token-456';
    const res=await request('POST','example-only-strong-token-456',{prompt:'Une fonction simple',files:[]});
    assert.equal(res.statusCode,200);assert.equal(res.body.files[0].name,'main.py');assert.equal(JSON.stringify(res.body).includes('fake-key'),false);
  }finally{globalThis.fetch=original;}
});
