import test from 'node:test';
import assert from 'node:assert/strict';
import {readSnapshot,prepareContext,prepareChanges,memoryRecord} from '../code-mode-x-factory.mjs';
const sha='a'.repeat(40),one='b'.repeat(40),two='c'.repeat(40),three='d'.repeat(40);
const data={[one]:Buffer.from('const x = 1;'),[two]:Buffer.from('{'),[three]:Buffer.from('secret')};
const read=(_root,args)=>{
 if(args[0]==='rev-parse')return sha;
 if(args[0]==='ls-tree')return ['100644 blob '+one+' '+data[one].length+'\tsrc/app.js','100644 blob '+two+' 1\tconfig.json','100644 blob '+three+' 6\t.env','120000 blob '+three+' 6\tlink.js'].join('\0')+'\0';
 if(args[0]==='cat-file'){assert.notEqual(args[2],three);return data[args[2]];}
 throw Error('unexpected git call');
};
test('audit pins HEAD, excludes secrets and symlinks, no source in report',()=>{
 const s=readSnapshot('.',{read});assert.equal(s.report.commit,sha);assert.equal(s.report.findings[0].code,'JSON_INVALID');
 assert.equal(s.sources.size,2);assert.equal(s.report.inventory[2].status,'excluded');
 assert.equal(s.report.inventory[3].status,'non_regular');assert.equal(JSON.stringify(s.report).includes('const x'),false);
});
test('context preserves exact nested path and blob identity',()=>{
 const s=readSnapshot('.',{read}),c=prepareContext(s,['src/app.js']);
 assert.equal(c.mapping[0].path,'src/app.js');assert.equal(c.files[0].name,'file-01.js');
 const p=prepareChanges(c,[{name:'file-01.js',content:'const x = 2;'}]);
 assert.equal(p.changes[0].expectedBlob,one);assert.equal(p.status,'review_required');
 assert.throws(()=>prepareChanges(c,[{name:'other.js',content:''}]));
 assert.throws(()=>prepareContext(s,['.env']));
});
test('memory records findings but never source contents',()=>{
 const s=readSnapshot('.',{read}),r=memoryRecord(s.report,'project');
 assert.equal(r.testsExecuted,false);assert.equal(r.fingerprint.length,64);
 assert.equal(JSON.stringify(r).includes('const x'),false);
});
test('budget reports skipped files',()=>{
 const s=readSnapshot('.',{read,maxFiles:1});assert.equal(s.report.inventory[1].status,'budget');
});
