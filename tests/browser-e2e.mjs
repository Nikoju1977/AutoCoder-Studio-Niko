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
  console.log('OK Python: '+prompt+' ('+cou���q�^