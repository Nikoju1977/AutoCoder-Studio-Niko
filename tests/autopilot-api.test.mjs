import test from 'node:test';
import assert from 'node:assert/strict';
import session from '../api/session.mjs';
import generate from '../api/generate.mjs';
const requestHeaders={host:'example.test',origin:'https://example.test','sec-fetch-site':'same-origin','content-type':'application/json'};
function response(){return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};}
test('session API and generation integration using fake provider only',async()=>{
 const names=['AUTOCODER_ACCESS_TOKEN','AGNES_API_KEY','OPENAI_API_KEY','MISTRAL_API_KEY','AUTOCODER_MAX_OUTPUT_TOKENS'];
 const saved=Object.fromEntries(names.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 try{
  const fake='test-only-'.repeat(5);
  process.env.AUTOCODER_ACCESS_TOKEN=fake;
  process.env.AGNES_API_KEY='fixture-not-a-real-key';
  delete process.env.OPENAI_API_KEY;delete process.env.MISTRAL_API_KEY;delete process.env.AUTOCODER_MAX_OUTPUT_TOKENS;
  let res=response();
  session({method:'GET',headers:{}},res);assert.deepEqual(res.body,{authenticated:false});
  res=response();session({method:'POST',headers:{...requestHeaders,origin:'https://foreign.test'},body:{action:'login',token:fake}},res);assert.equal(res.code,403);
  res=response();session({method:'POST',headers:requestHeaders,body:{action:'login',token:'wrong'.repeat(8)}},res);assert.equal(res.code,401);
  res=response();session({method:'POST',headers:requestHeaders,body:{action:'login',token:fake}},res);assert.equal(res.code,200);
  const cookie=res.headers['Set-Cookie'].split(';')[0];assert.ok(cookie);assert.ok(!cookie.includes(fake));
  res=response();session({method:'GET',headers:{cookie}},res);assert.deepEqual(res.body,{authenticated:true});
  let calls=0;
  globalThis.fetch=async (url,opts)=>{
   calls++;assert.match(url,/apihub\.agnes-ai\.com/);assert.equal(JSON.parse(opts.body).max_tokens,4096);
   return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({plan:[],notes:'fixture',files:[{name:'plan.md',content:'Plan de test.'}]})}}]})};
  };
  const payload={provider:'agnes',role:'architect',prompt:'Test du plan',files:[]};
  res=response();await generate({method:'POST',headers:{...requestHeaders,cookie,origin:'https://foreign.test'},body:payload},res);assert.equal(res.code,401);assert.equal(calls,0);
  res=response();await generate({method:'POST',headers:{...requestHeaders,cookie},body:payload},res);assert.equal(res.code,200);assert.equal(calls,1);assert.equal(res.body.files[0].name,'plan.md');
  res=response();session({method:'POST',headers:{...requestHeaders,cookie},body:{action:'logout'}},res);assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
