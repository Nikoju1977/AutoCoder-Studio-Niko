import test from 'node:test';
import assert from 'node:assert/strict';
import {targetRepo,linkedStylesheet,loadPair,createVariant,comparisonBundle,authorizeVariant} from '../ui-architect.mjs';
import {THEMES} from '../ui-theme.mjs';
const html='<link rel="stylesheet" href="./style.css"><button id="play">Play</button>',css='body{margin:0}';
const snapshot={repo:'Nikoju1977/Creative',branch:'main',commit:'a'.repeat(40),files:[{path:'index.html',size:html.length},{path:'style.css',size:css.length}]};
const project={files:[{name:'file-01.html',content:html},{name:'file-02.css',content:css}],github:{repo:snapshot.repo,branch:'main',commit:snapshot.commit,mapping:[{path:'index.html',name:'file-01.html',sha:'b'.repeat(40)},{path:'style.css',name:'file-02.css',sha:'c'.repeat(40)}]}};
test('restrict source owner and sensitive repositories',()=>{assert.equal(targetRepo('https://github.com/Nikoju1977/Creative'),snapshot.repo);assert.throws(()=>targetRepo('other/Creative'));assert.throws(()=>targetRepo('Nikoju1977/DiabCare'));});
test('linked CSS pair and baseline verified',async()=>{assert.equal(linkedStylesheet(html,'index.html','style.css'),true);assert.equal(linkedStylesheet('<base href="/other/">'+html,'index.html','style.css'),false);assert.equal(linkedStylesheet(html,'sub/index.html','style.css'),false);assert.equal(await loadPair(snapshot,'index.html','style.css',{loadFiles:async()=>project}),project);});
test('two variants only append CSS, preserve source SHA and require review',()=>{const a=createVariant(project,THEMES.audio),b=createVariant(project,THEMES.minimal);assert.equal(a.proposal.changes.length,1);assert.equal(a.proposal.changes[0].expectedBlob,'c'.repeat(40));assert.ok(a.proposal.changes[0].content.startsWith(css));assert.notEqual(a.proposal.changes[0].content,b.proposal.changes[0].content);assert.equal(comparisonBundle(a,b).format,'niko-ui-compare-v1');assert.throws(()=>authorizeVariant(a,false));assert.equal(authorizeVariant(a,true).publicationAuthorized,false);});

import {detectStack,createAgentVariant} from '../ui-architect.mjs';
test('framework inventory is metadata only',()=>{assert.deepEqual(detectStack(['src/App.tsx','src/Panel.vue'],{devDependencies:{tailwindcss:'4'}}).frameworks,['react','vue','tailwind']);});
test('multi CSS pair requires both links and preserves two source blobs',async()=>{
 const multiHtml=html+'<link rel="stylesheet" href="theme.css">';
 const multi={...project,files:[{...project.files[0],content:multiHtml},project.files[1],{name:'file-03.css',content:'a{color:red}'}],github:{...project.github,mapping:[...project.github.mapping,{path:'theme.css',name:'file-03.css',sha:'d'.repeat(40)}]}};
 const snap={...snapshot,files:[...snapshot.files,{path:'theme.css',size:12}]};
 const loaded=await loadPair(snap,'index.html','style.css',{extraCss:'theme.css',loadFiles:async()=>multi});
 const a=createVariant(loaded,THEMES.audio);assert.equal(a.proposal.changes.length,2);assert.equal(a.proposal.changes[1].expectedBlob,'d'.repeat(40));
 await assert.rejects(loadPair(snap,'index.html','style.css',{extraCss:'style.css',loadFiles:async()=>multi}));
});
test('AI variant is opt-in and limited to selected CSS and four calls',async()=>{
 let calls=0;
 const request=async({role,files})=>{calls++;assert.ok(files.every(f=>f.name.endsWith('.css')));return {files:[role==='innovator'?{name:'ideas.json',content:JSON.stringify({ideas:[{title:'Palette',benefit:'Contraste',effort:'low',test:'Visuel'}]})}:role==='architect'?{name:'plan.md',content:'Améliorer la couleur'}:role==='developer'?{name:'file-02.css',content:'body{margin:0;color:#123}'}:{name:'review.json',content:'{"accept":true,"issues":[]}'}]};};
 await assert.rejects(createAgentVariant(project,'audio',{request}));assert.equal(calls,0);
 const a=await createAgentVariant(project,'audio',{request,approved:true});assert.equal(calls,4);assert.equal(a.proposal.changes.length,1);assert.equal(a.proposal.testsExecuted,false);
});
