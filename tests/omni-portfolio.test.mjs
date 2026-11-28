import test from 'node:test';
import assert from 'node:assert/strict';
import {scan} from '../scripts/omni-portfolio.mjs';
test('public scan reads only owned public repositories; never claims tests executed',async()=>{
 const calls=[];const fetchImpl=async(url,init)=>{calls.push(url);assert.equal(init.redirect,'error');const p=new URL(url).pathname;
 if(p==='/users/Nikoju1977/repos')return Response.json([{id:1,name:'ron',owner:{login:'Nikoju1977'},private:false,default_branch:'main'},{id:2,name:'private',owner:{login:'Nikoju1977'},private:true,default_branch:'main'}]);
 if(p.endsWith('/contents/package.json'))return Response.json({encoding:'base64',size:50,content:Buffer.from(JSON.stringify({scripts:{test:'node --test'}})).toString('base64')});
 if(p.endsWith('/contents'))return Response.json([{name:'package.json'}]);
 if(p.endsWith('/actions/runs'))return Response.json({workflow_runs:[{id:123,status:'completed',conclusion:'success',head_sha:'abc'}]});
 throw Error('unexpected path');};
 const r=await scan({fetchImpl});assert.equal(r.rows.length,1);assert.deepEqual(r.rows[0].scripts,['test']);assert.equal(r.rows[0].testExecuted,false);assert.equal(r.rows[0].lastCI.conclusion,'success');assert.ok(!calls.some(x=>x.includes('/private/')));
});
test('private scan requires explicit token',async()=>{await assert.rejects(scan({includePrivate:true}),/token/);});
test('unavailable CI is not interpreted as success',async()=>{const r=await scan({fetchImpl:async url=>url.includes('/users/')?Response.json([{id:1,name:'a',owner:{login:'Nikoju1977'},private:false,default_branch:'main'}]):new Response('',{status:403})});assert.equal(r.rows[0].status,'not_tested');assert.equal(r.rows[0].errors.length,2);});
