import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProposal,proposalDigest,inspectProposal,publishDraft} from '../code-mode-x-publish.mjs';
const sha='a'.repeat(40),blob='b'.repeat(40),tree='c'.repeat(40),next='d'.repeat(40);
const raw={format:'code-mode-x-github-proposal-v1',status:'review_required',repo:'Nikoju1977/Audio',branch:'main',commit:sha,changes:[{path:'src/app.js',expectedBlob:blob,content:'const x=2;'}]};
function fixture({stale=false,failPR=false}={}){
 const calls=[];const request=async(method,path,body)=>{calls.push({method,path,body});
  if(method==='GET'&&path.endsWith('/Audio'))return {private:false,archived:false,full_name:raw.repo};
  if(method==='GET'&&path.includes('/git/ref/'))return {object:{sha:stale?next:sha}};
  if(method==='GET'&&path.includes('/git/commits/'))return {tree:{sha:tree}};
  if(method==='GET'&&path.includes('/git/trees/'))return {tree:[{path:'src/app.js',sha:blob,mode:'100644',type:'blob'}]};
  if(path.endsWith('/git/trees')||path.endsWith('/git/commits'))return {sha:next};
  if(path.endsWith('/git/refs'))return {};
  if(path.endsWith('/pulls')){if(failPR)throw Error('failed');return {number:1,html_url:'https://github.com/Nikoju1977/Audio/pull/1'};}
  throw Error('unexpected');
 };return {request,calls};
}
test('read-only inspection and exact approval required',async()=>{const f=fixture();const r=await inspectProposal(raw,f.request);assert.equal(r.digest,proposalDigest(raw));assert.ok(f.calls.every(c=>c.method==='GET'));await assert.rejects(publishDraft(raw,{request:f.request,approval:'wrong'}));assert.ok(f.calls.every(c=>c.method==='GET'));});
test('publishes only a new branch and a draft pull request',async()=>{const f=fixture();const r=await publishDraft(raw,{request:f.request,approval:proposalDigest(raw),uuid:()=> '12345678'});assert.equal(r.status,'draft_created');const writes=f.calls.filter(c=>c.method==='POST');assert.equal(writes.length,4);assert.equal(writes[2].body.ref,'refs/heads/maintenance/cmx-aaaaaaaa-12345678');assert.equal(writes[3].body.draft,true);assert.equal(writes[3].body.base,'main');assert.equal(r.testsExecuted,false);});
test('stale source refuses every write; sensitive paths and foreign repositories rejected',async()=>{const f=fixture({stale:true});await assert.rejects(publishDraft(raw,{request:f.request,approval:proposalDigest(raw)}));assert.ok(f.calls.every(c=>c.method==='GET'));assert.throws(()=>validateProposal({...raw,repo:'other/Audio'}));assert.throws(()=>validateProposal({...raw,changes:[{...raw.changes[0],path:'.github/workflows/test.yml'}]}));});
test('partial publication reports branch instead of claiming PR',async()=>{const f=fixture({failPR:true});const r=await publishDraft(raw,{request:f.request,approval:proposalDigest(raw)});assert.equal(r.status,'branch_created_pr_unconfirmed');});
