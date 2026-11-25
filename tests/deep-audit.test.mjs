import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectSyntax,inspectFile,checkBlobIntegrity} from '../deep-audit.mjs';
test('syntax parser does not execute JS',()=>{assert.equal(inspectSyntax('x.mjs','throw Error("must never execute");').status,'valid');assert.equal(inspectSyntax('x.cjs','const = ;').status,'invalid');assert.equal(inspectSyntax('x.js','export const n=1;').status,'valid');});
test('JSON invalid and Python parser status',()=>{assert.equal(inspectSyntax('x.json','{').status,'invalid');assert.equal(inspectSyntax('x.py','x = 1',{spawn:()=>({status:0})}).status,'valid');assert.equal(inspectSyntax('x.py','x =',{spawn:()=>({status:1})}).status,'invalid');assert.equal(inspectSyntax('x.py','x=1',{spawn:()=>({error:Error('missing')})}).status,'unavailable');});
test('large files and contextual warnings',()=>{const r=inspectFile({path:'tests/a.js',content:'// '+ 'x'.repeat(13000)+'\neval("x");'});assert.equal(r.syntax.status,'valid');assert.equal(r.findings[0].scope,'test_or_tool_candidate');assert.equal(r.findings[0].line,2);});
test('relative import candidates and incomplete tree',()=>{const f={path:'src/a.mjs',content:'import x from "./b.js";\nimport y from "./missing";'};const r=inspectFile(f,{allPaths:['src/b.js']});assert.equal(r.dependency.checked,2);assert.equal(r.dependency.unresolved,1);assert.equal(inspectFile(f,{treeTruncated:true}).dependency.checked,0);});
test('blob integrity and unsupported syntax',()=>{const b=Buffer.from('hello');const h=createHash('sha1').update('blob 5\0').update(b).digest('hex');assert.equal(checkBlobIntegrity(b,h),true);assert.equal(checkBlobIntegrity(b,'0'.repeat(40)),false);assert.equal(inspectSyntax('x.ts','let x:number=1;').status,'not_supported');});

test('Python UTF-8 BOM is accepted as bytes',()=>{const result=inspectSyntax('x.py','\uFEFFx=1\n');if(result.status==='unavailable')return;assert.equal(result.status,'valid');});
test('anonymous JavaScript host expression is distinguished from standalone syntax',()=>{const r=inspectSyntax('x.js','function() { return 42; }');assert.equal(r.status,'valid_expression');assert.equal(r.contextVerified,false);assert.equal(inspectSyntax('x.js','function() { const = ; }').status,'invalid');});
