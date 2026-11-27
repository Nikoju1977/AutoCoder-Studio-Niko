import test from 'node:test';
import assert from 'node:assert/strict';
import {INBOX,configured,normalizeReview,makeIssue,createBridge,MAX_BODY} from '../review-bridge.mjs';
import {makeHandler} from '../api/review-bridge.mjs';
import {bridgeStatus,sendReview} from '../review-bridge-client.mjs';
import {issue,NAME} from '../server-session.mjs';

const TOKEN=['github','pat',''].join('_')+'x'.repeat(60);
const ACCESS='fixture-session-key-'.repeat(3);
const SOURCE='Nikoju1977/Audio';
const COMMIT='a'.repeat(40),BLOB='b'.repeat(40);
const proposal=()=>({format:'code-mode-x-github-proposal-v1',repo:SOURCE,branch:'main',commit:COMMIT,status:'review_required',testsExecuted:false,reviewedForExport:true,publicationAuthorized:false,changes:[{path:'app.js',expectedBlob:BLOB,content:'export const answer = 42;'}]});
const input=()=>({approved:true,proposal:proposal()});
const metadata=(repo,isPrivate)=>({full_name:repo,private:isPrivate,visibility:isPrivate?'private':'public',archived:false,has_issues:true});

function fixture(options={}){
 const calls=[];let checks=0;
 const fetchImpl=async(url,init)=>{
  const u=new URL(url),method=init.method;
  calls.push({path:u.pathname+u.search,method,authorized:!!init.headers.Authorization,body:init.body?JSON.parse(init.body):undefined,redirect:init.redirect});
  assert.equal(u.origin,'https://api.github.com');
  const mailbox=u.pathname==='/repos/'+INBOX||u.pathname.startsWith('/repos/'+INBOX+'/issues');
  assert.equal(!!init.headers.Authorization,mailbox);
  if(mailbox)assert.equal(init.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(init.redirect,'error');
  let result,status=200;
  if(u.pathname==='/repos/'+SOURCE)result=metadata(SOURCE,options.sourcePrivate===true);
  else if(u.pathname==='/repos/'+SOURCE+'/contents/app.js'){assert.equal(u.searchParams.get('ref'),COMMIT);result={type:'file',path:'app.js',sha:options.stale?'c'.repeat(40):BLOB,size:24};}
  else if(u.pathname==='/repos/'+INBOX){checks++;result=metadata(INBOX,!options.publicInbox&&!(options.flip&&checks>=2));}
  else if(u.pathname==='/repos/'+INBOX+'/issues'&&method==='GET')result=options.existing?[{number:17,...options.existing}]:[];
  else if(u.pathname==='/repos/'+INBOX+'/issues'&&method==='POST'){result={number:19,html_url:'https://example.invalid/untrusted'};status=201;}
  else assert.fail('Unexpected GitHub route: '+u.pathname);
  return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});
 };
 return {calls,bridge:createBridge({token:TOKEN,fetchImpl}),fetchImpl};
}

test('review bridge normalizes only explicitly approved, untested proposals',()=>{
 const p=normalizeReview(input());assert.equal(p.publicationAuthorized,false);assert.equal(p.reviewedForExport,true);
 for(const patch of [{approved:false},{approved:1},{proposal:{...proposal(),testsExecuted:true}},{proposal:{...proposal(),publicationAuthorized:true}},{proposal:{...proposal(),reviewedForExport:false}},{proposal:{...proposal(),status:'approved'}},{proposal:{...proposal(),repo:'other/Audio'}},{proposal:{...proposal(),repo:'Nikoju1977/MedVision'}},{proposal:{...proposal(),repo:INBOX}},{proposal:{...proposal(),commit:'main'}}])assert.throws(()=>normalizeReview({...input(),...patch}));
});
test('review bridge blocks dangerous paths, duplicate paths, oversized files and potential secrets',()=>{
 for(const path of ['../app.js','.github/workflows/a.yml','api/generate.mjs','config.js','secret.js','patient.js','node_modules/a.js','app.txt'])assert.throws(()=>normalizeReview({approved:true,proposal:{...proposal(),changes:[{...proposal().changes[0],path}]}}),path);
 assert.throws(()=>normalizeReview({approved:true,proposal:{...proposal(),changes:[proposal().changes[0],{...proposal().changes[0],path:'APP.js'}]}}));
 assert.throws(()=>normalizeReview({approved:true,proposal:{...proposal(),changes:[{...proposal().changes[0],content:'z'.repeat(12001)}]}}));
 const p=proposal();p.changes[0].content='const api_key = "'+['sk','proj',''].join('-')+'x'.repeat(30)+'";';
 assert.throws(()=>normalizeReview({approved:true,proposal:p}),e=>e.status===422);
});
test('issue body preserves source exactly without allowing code-fence escape',()=>{
 const p=proposal();p.changes[0].content='// '+String.fromCharCode(96).repeat(3)+'\\n@person\\n<script>';
 const normalized=normalizeReview({approved:true,proposal:p}),item=makeIssue(normalized);
 const fence=String.fromCharCode(96).repeat(3);
 assert.deepEqual(JSON.parse(item.body.split(fence+'json\n')[1].split('\n'+fence)[0]),normalized);
 assert.equal(item.body.split(fence).length,3);assert.match(item.fingerprint,/^[a-f0-9]{64}$/);assert.equal(makeIssue(normalized).fingerprint,item.fingerprint);
});
test('missing or broad token fails closed without network',async()=>{
 assert.equal(configured(TOKEN),true);assert.equal(configured('classic-example'),false);
 const bridge=createBridge({fetchImpl:()=>assert.fail('network prohibited')});
 assert.equal((await bridge.status()).state,'setup_required');
 await assert.rejects(bridge.submit(input()),e=>e.status===503);
});
test('approved transfer performs exactly one issue write to fixed private inbox',async()=>{
 const {bridge,calls}=fixture();
 assert.equal((await bridge.status()).ready,true);
 const result=await bridge.submit(input());
 assert.equal(result.number,19);assert.equal(result.publicationAuthorized,false);assert.equal(result.url,'https://github.com/'+INBOX+'/issues/19');
 const posts=calls.filter(x=>x.method==='POST');
 assert.equal(posts.length,1);assert.equal(posts[0].path,'/repos/'+INBOX+'/issues');assert.match(posts[0].body.title,/^Autopilot /);
 assert.equal(calls.filter(x=>x.path.startsWith('/repos/'+SOURCE)).every(x=>!x.authorized),true);
 assert.equal(calls.filter(x=>x.path==='/repos/'+INBOX).length,3);
});
test('recent identical proposal reuses ticket instead of writing another',async()=>{
 const item=makeIssue(normalizeReview(input())),{bridge,calls}=fixture({existing:{title:item.title,body:item.body}});
 const result=await bridge.submit(input());assert.equal(result.number,17);assert.equal(result.reused,true);assert.ok(!calls.some(x=>x.method==='POST'));
});
test('public inbox, private source, stale blob or changed visibility prevent any write',async()=>{
 for(const options of [{publicInbox:true},{sourcePrivate:true},{stale:true},{flip:true}]){
  const {bridge,calls}=fixture(options);await assert.rejects(bridge.submit(input()),e=>e.status===409);assert.ok(!calls.some(x=>x.method==='POST'));
 }
});
function response(){return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};}
const headers={host:'example.test',origin:'https://example.test','sec-fetch-site':'same-origin','content-type':'application/json',cookie:NAME+'='+issue(ACCESS)};
test('review HTTP API requires session and same-origin JSON',async()=>{
 const handler=makeHandler({env:{AUTOCODER_ACCESS_TOKEN:ACCESS,AUTOPILOT_REVIEW_TOKEN:TOKEN},fetchImpl:()=>assert.fail('network prohibited')});
 for(const [req,code] of [[{method:'GET',headers:{}},401],[{method:'POST',headers:{...headers,cookie:''},body:input()},401],[{method:'POST',headers:{...headers,origin:'https://foreign.test'},body:input()},403],[{method:'POST',headers:{...headers,'content-type':'text/plain'},body:input()},403],[{method:'DELETE',headers},405],[{method:'POST',headers,body:'x'.repeat(MAX_BODY+1)},413],[{method:'POST',headers,body:'{'},400]]){
  const res=response();await handler(req,res);assert.equal(res.code,code);assert.match(res.headers['Cache-Control'],/no-store/);
 }
});
test('review HTTP API refuses exact configured secret, then sends validated fixture',async()=>{
 const {fetchImpl,calls}=fixture(),env={AUTOCODER_ACCESS_TOKEN:ACCESS,AUTOPILOT_REVIEW_TOKEN:TOKEN,AGNES_API_KEY:'fixture-agnes-'+ 'z'.repeat(30)};
 const handler=makeHandler({env,fetchImpl});
 let res=response();await handler({method:'GET',headers},res);assert.equal(res.body.ready,true);
 const p=proposal();p.changes[0].content=env.AGNES_API_KEY;
 res=response();await handler({method:'POST',headers,body:{approved:true,proposal:p}},res);assert.equal(res.code,422);assert.ok(!calls.some(x=>x.method==='POST'));
 res=response();await handler({method:'POST',headers,body:input()},res);assert.equal(res.code,201);assert.equal(res.body.number,19);
});
test('browser bridge refuses missing approval and hostile receipt links',async()=>{
 await assert.rejects(sendReview(proposal(),false,()=>assert.fail('network prohibited')));
 const responseWith=(data)=>async()=>new Response(JSON.stringify(data),{status:200});
 const receipt={ok:true,publicationAuthorized:false,number:1,url:'https://foreign.test',fingerprint:'a'.repeat(64)};
 await assert.rejects(sendReview(proposal(),true,responseWith(receipt)));
 const status=await bridgeStatus(responseWith({configured:false,ready:false,destination:INBOX,state:'setup_required'}));assert.equal(status.ready,false);
 let sent;
 const valid={...receipt,url:'https://github.com/'+INBOX+'/issues/1'};
 const r=await sendReview(proposal(),true,async(url,options)=>{sent={url,options};return new Response(JSON.stringify(valid),{status:201});});
 assert.equal(r.number,1);assert.equal(sent.url,'/api/review-bridge');assert.equal(sent.options.credentials,'same-origin');assert.equal(JSON.parse(sent.options.body).approved,true);assert.equal(sent.options.headers.Authorization,undefined);
});
