import test from 'node:test';
import assert from 'node:assert/strict';
import {uiBrief,cursorKey,assertUiChanges} from '../ui-engine.mjs';
import {selectPaths,runBatch,readCursor,CURSOR} from '../autopilot.mjs';
test('UI selection is bounded, excludes JS and secrets',()=>{
 const files=['app.js','index.html','styles.css','theme.css','api/x.css','secret.css','third.css'].map(path=>({path,size:30}));
 assert.deepEqual(selectPaths({files},'cinematic'),['index.html','styles.css','theme.css']);
 assert.deepEqual(selectPaths({files:[{path:'app.js',size:10}]},'audio'),[]);
 assert.throws(()=>selectPaths({files},'invalid'));
});
test('cursor is independent for each mode',()=>{
 const s={getItem:k=>k===CURSOR?'general-repo':k===cursorKey(CURSOR,'audio')?'audio-repo':null};
 assert.equal(readCursor(s),'general-repo');
 assert.equal(readCursor(s,'audio'),'audio-repo');
 assert.equal(readCursor(s,'luxury'),'');
 assert.match(uiBrief('audio'),/responsive/);
});
test('UI lexical contract rejects changed IDs, scripts, external resources and JS',()=>{
 const p={github:{mapping:[{name:'a.html',path:'index.html'},{name:'b.css',path:'style.css'}]},files:[{name:'a.html',content:'<div id="a">Old</div><script src="a.js"></script>'},{name:'b.css',content:'body{color:red}'}]};
 const check=(path,content)=>assertUiChanges(p,{changes:[{path,content}]});
 assert.doesNotThrow(()=>check('index.html','<div id="a">New</div><script src="a.js"></script>'));
 assert.doesNotThrow(()=>check('style.css','body{color:blue}'));
 assert.throws(()=>check('index.html','<div id="b">Old</div><script src="a.js"></script>'));
 assert.throws(()=>check('index.html','<div id="a">Old</div><script src="b.js"></script>'));
 assert.throws(()=>check('style.css','body{background:url(https://example.test/a)}'));
 assert.throws(()=>check('app.js','alert(1)'));
});
test('UI still uses four calls and requires review',async()=>{
 const repo='Nikoju1977/UI',roles=[];
 const r=await runBatch({mode:'minimal',rows:[{repo}],loadRepo:async()=>({commit:'a'.repeat(40),files:[{path:'style.css',size:20}]}),loadFiles:async(s,paths)=>{assert.deepEqual(paths,['style.css']);return {files:[{name:'file-01.css',content:'body{color:red}'}],github:{repo,branch:'main',commit:'a'.repeat(40),mapping:[{name:'file-01.css',path:'style.css',sha:'b'.repeat(40)}]}};},request:async({role,prompt})=>{roles.push(role);assert.match(prompt,/UI Engine Pro/);return {files:[role==='innovator'?{name:'ideas.json',content:JSON.stringify({ideas:[{title:'Clarté',benefit:'Lisibilité',effort:'low',test:'Contraste'}]})}:role==='architect'?{name:'plan.md',content:'Améliorer le contraste'}:role==='developer'?{name:'file-01.css',content:'body{color:blue}'}:{name:'review.json',content:'{"accept":true,"issues":[]}'}]};}});
 assert.deepEqual(roles,['innovator','architect','developer','critic']);
 assert.equal(r.results[0].status,'review_required');
 assert.equal(r.results[0].proposal.testsExecuted,false);
});

import {chooseProfile} from '../ui-engine.mjs';
test('automatic profile resolves locally with deterministic fallback',()=>{
 assert.equal(chooseProfile({repo:'Nikoju1977/RAUSBEAT'}),'audio');
 assert.equal(chooseProfile({repo:'Nikoju1977/Niko-3D-vibes'}),'spatial');
 assert.equal(chooseProfile({repo:'Nikoju1977/unknown'}),'minimal');
 assert.equal(cursorKey(CURSOR,'auto'),CURSOR+'-ui-auto');
});
