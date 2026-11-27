import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {applicationTemplate} from '../ui-builder.mjs';
import {pwaFiles} from '../ui-app-factory.mjs';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/generate',r=>r.fulfill({json:{files:[{name:'layout.json',content:JSON.stringify({...applicationTemplate('tasks'),theme:'audio'})}]}}));
 await page.goto((process.env.AUTOCODER_URL||'http://127.0.0.1:4173')+'/ui-builder.html');
 await page.locator('#prompt').fill('Liste de tâches');await page.locator('#prompt-consent').check();await page.locator('#generate-prompt').click();await page.getByText('Composition IA importée.',{exact:false}).waitFor();assert.equal(await page.locator('#grid > div').count(),4);
 const files=pwaFiles(applicationTemplate('tasks'),{persistent:true});
 await page.route('https://niko-pwa.invalid/**',r=>{const key=new URL(r.request().url()).pathname.slice(1),value=files[key];if(value===undefined)return r.abort();return r.fulfill({body:value,contentType:key.endsWith('.html')?'text/html':key.endsWith('.css')?'text/css':key.endsWith('.js')?'text/javascript':'application/json'});});
 await page.goto('https://niko-pwa.invalid/index.html');
 await page.locator('#n1 input').fill('Première tâche');await page.locator('#n2 button').click();
 await page.locator('#n4 li input').waitFor();assert.equal(await page.locator('#n4 li input').inputValue(),'Première tâche');
 await page.reload();await page.locator('#n4 li input').waitFor();assert.equal(await page.locator('#n4 li input').inputValue(),'Première tâche');
 await page.locator('#n4 li input').fill('Modifiée');await page.getByRole('button',{name:'Modifier'}).click();await page.getByText('Liste enregistrée localement.').waitFor();
 await page.reload();await page.locator('#n4 li input').waitFor();assert.equal(await page.locator('#n4 li input').inputValue(),'Modifiée');
 await page.getByRole('button',{name:'Supprimer'}).click();await page.locator('#n4 li').waitFor({state:'detached'});
 assert.deepEqual(errors,[]);console.log('PASS V10 AI fixture and IndexedDB create/read/update/delete');
}finally{await browser.close();}
