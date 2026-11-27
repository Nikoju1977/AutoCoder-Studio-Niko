import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,change,history,exportLayout,decodeLayout,normalize} from '../ui-builder.mjs';
test('add, reorder, resize, remove and undo/redo',()=>{
 const h=history();h.apply({type:'add',kind:'heading'});h.apply({type:'add',kind:'card'});h.apply({type:'move',id:'n2',to:0});h.apply({type:'edit',id:'n2',span:4,height:180,text:'Test'});
 assert.equal(h.value.items[0].span,4);h.undo();assert.equal(h.value.items[0].span,6);h.redo();assert.equal(h.value.items[0].height,180);
 h.apply({type:'remove',id:'n2'});assert.equal(h.value.items.length,1);assert.equal(h.canRedo,false);
});
test('safe export and schema limits',()=>{
 let d=change(blank(),{type:'add',kind:'button'});d=change(d,{type:'edit',id:'n1',text:'<script>alert(1)</script>',span:3});
 const x=exportLayout(d);assert.ok(x.html.includes('&lt;script&gt;'));assert.ok(!x.html.includes('<script>'));assert.match(x.css,/grid-column:span 3/);
 assert.deepEqual(decodeLayout(JSON.stringify(d)),d);assert.throws(()=>change(d,{type:'edit',id:'n1',span:13}));assert.throws(()=>normalize({...d,items:[d.items[0],d.items[0]]}));
});

import {applicationTemplate} from '../ui-builder.mjs';
test('functional templates, strict links, deletion clears dependent action',()=>{
 const d=applicationTemplate('tasks');assert.equal(d.items[1].action.kind,'append');
 assert.throws(()=>change(d,{type:'edit',id:'n2',action:{kind:'append',source:'n1',target:'n3'}}));
 assert.throws(()=>change(d,{type:'edit',id:'n2',action:{kind:'eval',target:'n4'}}));
 const cleaned=change(d,{type:'remove',id:'n1'});assert.equal(cleaned.items.find(x=>x.id==='n2').action,undefined);
 const x=exportLayout(d);assert.match(x.html,/app\.js/);assert.match(x.js,/addEventListener/);assert.match(x.html,/data-niko-node="n2"/);
 assert.deepEqual(decodeLayout(JSON.stringify(d)),d);
});
