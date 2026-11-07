import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.AUTOCODER_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({acceptDownloads:true});
const page=await context.newPage();
const exceptions=[];
page.on('dialog',dialog=>dialog.accept());
page.on('pageerror',error=>exceptions.push(String(error)));

async function generate(prompt){
  await page.locator('#prompt-input').fill(prompt);
  await page.locator('#btn-generate').click();
  await page.waitForFunction(()=>/fichier\(s\) créés/.test(document.querySelector('#status-coder').textContent),null,{timeout:10000});
  assert.equal(await page.locator('#status-architect').innerText(),'Modèle sélectionné');
}
async function testPython(prompt,count){
  await generate(prompt);
  await page.locator('#btn-tests').click();
  await page.waitForFunction(n=>document.querySelector('#status-critic').textContent.includes(n+' test(s), 0 échec(s)') ||
    document.querySelector('#status-executor').textContent==='Échec d’exécution',count,{timeout:90000});
  const actual=await page.locator('#status-critic').innerText();
  assert.equal(actual,count+' test(s), 0 échec(s)',prompt+': '+(await page.locator('#log-list').innerText()).slice(-500));
  assert.equal(await page.locator('#status-executor').innerText(),'Terminé');
  console.log('OK Python: '+prompt+' ('+count+' tests)');
}
try{
  const response=await page.goto(base,{waitUntil:'load',timeout:30000});
  assert.equal(response.status(),200);
  await testPython('Crée une calculatrice Python avec tests',5);
  await page.locator('#btn-run').click();
  await page.waitForFunction(()=>document.querySelector('#status-executor').textContent==='Terminé',null,{timeout:20000});
  assert.match(await page.locator('#log-list').innerText(),/12 \+ 8 = 20/);

  await testPython('Crée un gestionnaire de tâches avec tests',3);
  await testPython('Crée un analyseur de texte avec tests',3);
  await testPython('Crée un programme qui traite un fichier CSV avec tests',2);

  await generate('Crée un site portfolio responsive');
  const outer=page.frameLocator('#preview-frame');
  const inner=outer.frameLocator('#preview-content');
  await inner.locator('#action').waitFor({timeout:15000});
  const padding=await inner.locator('.hero').evaluate(el=>getComputedStyle(el).paddingLeft);
  assert.equal(padding,'24px','La feuille CSS du projet est active');
  await inner.locator('#action').click();
  assert.equal(await inner.locator('#message').innerText(),'Bienvenue dans ton projet Studio Niko !');
  console.log('OK Aperçu HTML/CSS/JS dans les iframes sandboxées');

  await page.locator('.activity-tab[data-view="diagnostic"]').click();
  await page.locator('#btn-analyze').click();
  assert.match(await page.locator('#diagnostic-list').innerText(),/3 fichier\(s\) analysé/);

  const downloadPromise=page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const download=await downloadPromise;
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.deepEqual(Object.keys(exported.files).sort(),['index.html','script.js','style.css']);
  await generate('Crée une calculatrice Python');
  await page.locator('#file-import').setInputFiles({name:'projet.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.waitForFunction(()=>document.querySelector('#file-list').textContent.includes('style.css'),null,{timeout:7000});
  console.log('OK Export/import JSON et analyse statique');

  await page.locator('#btn-settings').click();
  await page.locator('#settings-mode').selectOption('server');
  await page.waitForFunction(()=>!document.querySelector('#server-status').textContent.includes('Vérification'),null,{timeout:12000});
  assert.ok((await page.locator('#server-status').innerText()).length>20);
  await page.locator('#btn-cancel-settings').click();
  console.log('OK Diagnostic de configuration IA');

  assert.deepEqual(exceptions,[],'Erreurs JavaScript dans le navigateur');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  const mobilePage=await mobile.newPage();
  await mobilePage.goto(base,{waitUntil:'load'});
  const sizes=await mobilePage.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
  assert.ok(sizes.body<=sizes.viewport+1,'Débordement horizontal mobile: '+JSON.stringify(sizes));
  await mobile.close();
  console.log('OK Réactivité mobile à 390 pixels');
  console.log('PASS : AutoCoder E2E terminé');
}finally{
  await browser.close();
}
