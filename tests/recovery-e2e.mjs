import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const BASE=process.env.AUTOCODER_URL||'http://127.0.0.1:4173';
const PRIMARY_KEY='studio-niko-autocoder-v2';
const RECOVERY_KEY='studio-niko-autocoder-files-previous-v1';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];

async function openIsolatedPage(){
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(BASE,{waitUntil:'load',timeout:30000});
  assert.equal(response.status(),200,'AutoCoder must be served through HTTP');
  return {page,context};
}

try {
  // Simulate a browser with full or disabled backup storage.
  const guarded=await openIsolatedPage();
  const page=guarded.page;
  const originalEditor=await page.locator('#code-editor').inputValue();
  assert.match(originalEditor,/def saluer/,'Default code is available');
  await page.evaluate(key=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){
      if(name===key)throw new DOMException('Simulated full local storage','QuotaExceededError');
      return original.call(this,name,value);
    };
  },RECOVERY_KEY);

  await page.locator('#file-list .file-item').filter({hasText:'test_main.py'})
    .locator('.delete-file').click();
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Suppression annulée'));
  assert.equal(await page.locator('#file-list .file-item').count(),2,'Deletion must not proceed without backup');

  const replacement={format:'autocoder-studio-niko-v2',projectName:'nouveau-projet',
    files:{'main.py':'print("CONTENU IMPORTE")'}};
  await page.locator('#file-import').setInputFiles({
    name:'projet.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(replacement))
  });
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Import annulé'));
  assert.equal(await page.locator('#code-editor').inputValue(),originalEditor,
    'Import must not replace existing code without backup');

  await page.locator('#prompt-input').fill('Crée une calculatrice Python avec tests');
  await page.locator('#btn-generate').click();
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Génération annulée'));
  assert.equal(await page.locator('#code-editor').inputValue(),originalEditor,
    'Generation must not replace existing code without backup');
  assert.equal(await page.locator('#btn-generate').isEnabled(),true);
  console.log('OK sauvegarde indisponible : suppression, import et génération refusés');
  await guarded.context.close();

  // Restore from a previously created backup, then verify reverse recovery.
  const restored=await openIsolatedPage();
  const ui=restored.page;
  const backup={schema:1,savedAt:new Date().toISOString(),projectName:'projet-sauve',
    files:{'main.py':'print("REPRISE_VALIDEE")'}};
  await ui.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),
    {key:RECOVERY_KEY,value:backup});
  await ui.reload({waitUntil:'load'});
  await ui.locator('#btn-settings').click();
  await ui.locator('#recovery-panel > summary').click();
  assert.equal(await ui.locator('#btn-restore-previous').isEnabled(),true,
    'Previous local copy is detected');
  await ui.locator('#btn-restore-previous').click();
  assert.equal(await ui.locator('#code-editor').inputValue(),'print("REPRISE_VALIDEE")');
  assert.equal(await ui.locator('#project-name').innerText(),'projet-sauve');
  const saved=await ui.evaluate(key=>JSON.parse(localStorage.getItem(key)),PRIMARY_KEY);
  assert.equal(saved.files['main.py'],'print("REPRISE_VALIDEE")');

  const reverse=await ui.evaluate(key=>JSON.parse(localStorage.getItem(key)),RECOVERY_KEY);
  assert.match(reverse.files['main.py'],/def saluer/,
    'The pre-restoration project remains available as a reverse backup');
  const downloadPromise=ui.waitForEvent('download');
  await ui.locator('#btn-export-previous').click();
  const download=await downloadPromise;
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.match(exported.files['main.py'],/def saluer/);
  assert.equal(exported.format,'autocoder-studio-niko-v2');
  console.log('OK restauration et export de secours (JSON non vide)');
  await restored.context.close();

  assert.deepEqual(errors,[],'No uncaught JavaScript browser error');
  console.log('PASS recovery E2E');
} finally {
  await browser.close();
}
