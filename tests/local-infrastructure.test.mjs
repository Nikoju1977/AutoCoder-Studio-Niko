import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createLocalServer} from '../local-infrastructure.mjs';
import {httpClient} from '../sdk/http-client.mjs';
import {createGateway,PROTOCOL} from '../native-protocol.mjs';
import {createMcpAdapter} from '../mcp-adapter.mjs';
const project={name:'demo',files:[{name:'config.json',content:'{'}]};
test('actual loopback HTTP authentication and isolation',async()=>{
 const token='a'.repeat(43),other='b'.repeat(43);
 const server=createLocalServer({apps:[{id:'audio',token,project,permissions:['project.read']},{id:'quantum',token:other,permissions:['quantum.compute']}]});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
 const port=server.address().port,c=httpClient({port,app:'audio',token});
 assert.equal((await c.list()).tools.length,3);assert.match(JSON.stringify(await c.call('project.audit')),/JSON_INVALID/);
 await assert.rejects(c.call('quantum.simulate',{circuit:'{}'}),/TOOL_DENIED/);
 await assert.rejects(httpClient({port,app:'audio',token:other}).list(),/401/);
 const r=await fetch('http://127.0.0.1:'+port+'/v1/tools',{method:'POST',headers:{Origin:'https://example.com'}});assert.equal(r.status,403);
 for(let i=0;i<27;i++)await c.list();await assert.rejects(c.list(),/429/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('duplicate secrets rejected',()=>{assert.throws(()=>createLocalServer({apps:['a','b'].map(id=>({id,token:'a'.repeat(43),permissions:[]}))}));});
test('legacy MCP lifecycle, discovery and actual tool result',async()=>{
 const handle=createMcpAdapter(createGateway({project}));
 const req=(id,method,params={})=>handle({jsonrpc:'2.0',id,method,params});
 assert.equal((await req(1,'tools/list')).error.code,-32002);
 assert.equal((await req(2,'initialize',{protocolVersion:'2025-06-18'})).result.protocolVersion,'2025-06-18');
 await handle({jsonrpc:'2.0',method:'notifications/initialized'});
 const list=await req(3,'tools/list');assert.equal(list.result.tools.length,3);
 const result=await req(4,'tools/call',{name:'project_audit',arguments:{}});assert.equal(result.result.isError,false);assert.match(result.result.content[0].text,/JSON_INVALID/);
 assert.equal((await req(5,'tools/call',{name:'shell_exec'})).result.isError,true);
});
