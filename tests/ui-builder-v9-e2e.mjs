import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {applicationTemplate,exportLayout} from '../ui-builder.mjs';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.AUTOCODER_URL||'http://127.0.0.1:4173')+'/ui-builder.html');
 await page.locator('#template').selectOption('tasks');await page.locator('#load-template').click();
 await page.locator('#test-mode').click();await page.locator('#grid [data-id=n1] input').fill('<img src=x>');
 await page.locator('#grid [data-id=n2] button').click();
 assert.equal(await page.locator('#grid [data-id=n4] li').textContent(),'<img src=x>');
 assert.equal(await page.locator('#grid img').count(),0);
 await page.locator('#grid [data-id=n3] button').click();assert.equal(await page.locator('#grid li').count(),0);
 const x=exportLayout(applicationTemplate('progress'));
 await page.route('https://niko-export.invalid/**',async r=>{const p=new URL(r.request().url()).pathname;const f={'/index.html':[x.html,'text/html'],'/layout.css':[x.css,'text/css'],'/app.js':[x.js,'text/javascript']}[p];if(!f)return r.abort();await r.fulfill({body:f[0],contentType:f[1]});});
 await page.goto('https://niko-export.invalid/index.html');
 await page.locator('#n2 button').click();assert.equal(await page.locator('#n1 progress').evaluate(e=>e.value),10);
 await page.locator('#n3 button').click();assert.equal(await page.locator('#n1 progress').evaluate(e=>e.value),0);
 assert.deepEqual(errors,[]);
 console.log('PASS V9 local actions, safe text and exported runtime');
}finally{await browser.close();}
