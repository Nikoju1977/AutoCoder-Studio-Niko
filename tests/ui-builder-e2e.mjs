import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.AUTOCODER_URL||'http://127.0.0.1:4173')+'/ui-builder.html');
 await page.locator('#kind').selectOption('heading');await page.locator('#add').click();
 await page.locator('#kind').selectOption('card');await page.locator('#add').click();assert.equal(await page.locator('#grid > div').count(),2);
 await page.locator('#up').click();assert.equal(await page.locator('#grid > div').first().getAttribute('data-id'),'n2');
 await page.locator('#undo').click();assert.equal(await page.locator('#grid > div').first().getAttribute('data-id'),'n1');
 await page.locator('#redo').click();assert.equal(await page.locator('#grid > div').first().getAttribute('data-id'),'n2');
 await page.locator('#span').fill('4');await page.locator('#span').dispatchEvent('change');
 assert.equal(await page.locator('#grid [data-id=n2]').evaluate(el=>el.style.gridColumn),'span 4');
 await page.locator('#label-text').fill('Carte test');await page.locator('#label-text').press('Tab');
 assert.match(await page.locator('#grid [data-id=n2]').textContent(),/Carte test/);
 await page.locator('#save').click();await page.reload();assert.equal(await page.locator('#grid > div').count(),2);
 const d=page.waitForEvent('download');await page.locator('#export-html').click();assert.equal((await d).suggestedFilename(),'index.html');
 await page.locator('#import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.getByText('Import refusé : projet invalide.').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log('PASS V8 visual composition, order, sizing, history, persistence, export and mobile');
}finally{await browser.close();}
