import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepo,listPublicRepo,loadPublicSelection,githubProposal} from '../code-mode-x-github.mjs';
const sha='a'.repeat(40),tree='b'.repeat(40),blob='c'.repeat(40);
const fetchImpl=async(url,opts)=>{
 assert.equal(new URL(url).hostname,'api.github.com');assert.equal(opts.credentials,'omit');
 const p=new URL(url).pathname;
 let data;
 if(p.endsWith('/commits/main'))data={sha,commit:{tree:{sha:tree}}};
 else if(p.includes('/git/trees/'))data={tree:[{path:'src/app.mjs',sha:blob,size:3,type:'blob',mode:'100644'},{path:'.env',sha:blob,size:3,type:'blob',mode:'100644'},{path:'link.js',sha:blob,size:3,type:'blob',mode:'120000'}]};
 else if(p.includes('/git/blobs/'))data={sha:blob,encoding:'base64',content:'YWJj'};
 else data={private:false,default_branch:'main'};
 return new Response(JSON.stringify(data));
};
test('fixed public host and valid repository syntax',()=>{assert.equal(parseRepo('https://github.com/Nikoju1977/AutoCoder-Studio-Niko'),'Nikoju1977/AutoCoder-Studio-Niko');assert.throws(()=>parseRepo('https://other.example/a/b'));});
test('snapshot pins version, excludes secrets and symlinks',async()=>{const s=await listPublicRepo('niko/repo',{fetchImpl});assert.equal(s.commit,sha);assert.equal(s.files.length,1);const p=await loadPublicSelection(s,['src/app.mjs'],{fetchImpl});assert.equal(p.files[0].name,'file-01.js');assert.equal(p.files[0].content,'abc');const proposal=githubProposal(p,{status:'review_required',proposal:[{name:'file-01.js',content:'xyz'}]});assert.equal(proposal.changes[0].path,'src/app.mjs');assert.equal(proposal.changes[0].expectedBlob,blob);assert.equal(proposal.testsExecuted,false);assert.throws(()=>githubProposal(p,{status:'review_required',proposal:[{name:'other.js',content:'x'}]}));});
test('unselected path is refused',async()=>{const s=await listPublicRepo('niko/repo',{fetchImpl});await assert.rejects(loadPublicSelection(s,['.env'],{fetchImpl}));});
