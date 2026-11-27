import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.AUTOCODER_URL||'http://127.0.0.1:4173')+'/ui-factory.html');
 await page.locator('#preview-A').waitFor();
 const before=await page.locator('#preview-B').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('#preset').selectOption('luxury');await page.locator('#apply').click();
 assert.equal(await page.locator('#preview-A').evaluate(el=>el.style.getPropertyValue('--niko-bg')),'#171411');
 assert.equal(await page.locator('#preview-B').evaluate(el=>getComputedStyle(el).backgroundColor),before);
 await page.locator('#copy').click();assert.equal(await page.locator('#preview-B').evaluate(el=>el.style.getPropertyValue('--niko-bg')),'#171411');
 await page.locator('#preview-A').getByRole('button',{name:'Lire'}).click();assert.equal(await page.locator('#preview-A [role=status]').textContent(),'Lecture démo');
 await page.locator('#save').click();await page.reload();await page.locator('#preview-A').waitFor();assert.equal(await page.locator('#preview-A').evaluate(el=>el.style.getPropertyValue('--niko-bg')),'#171411');
 const d=page.waitForEvent('download');await page.locator('#export-css').click();assert.equal((await d).suggestedFilename(),'niko-theme-A.css');
 await page.locator('#import-theme').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await page.getByText('Import refusé : thème invalide.').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('PASS V5 theme edit, independent variants, copy, demo, persistence, download, invalid import and mobile');
}finally{await browser.close();}
