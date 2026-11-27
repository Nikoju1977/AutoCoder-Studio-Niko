import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const html='<link rel="stylesheet" href="style.css"><button>Play</button>',css='body{margin:0}',repo='Nikoju1977/Creative',commit='a'.repeat(40),tree='b'.repeat(40),h='c'.repeat(40),c='d'.repeat(40);
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://api.github.com/**',async route=>{
 const p=new URL(route.request().url()).pathname;
 let json=p.endsWith('/'+repo)?{private:false,archived:false,default_branch:'main'}:p.endsWith('/commits/main')?{sha:commit,commit:{tree:{sha:tree}}}:p.endsWith('/trees/'+tree)?{tree:[{path:'index.html',type:'blob',mode:'100644',sha:h,size:html.length},{path:'style.css',type:'blob',mode:'100644',sha:c,size:css.length}]}:p.endsWith('/blobs/'+h)?{sha:h,encoding:'base64',content:Buffer.from(html).toString('base64')}:p.endsWith('/blobs/'+c)?{sha:c,encoding:'base64',content:Buffer.from(css).toString('base64')}:null;
 if(!json)return route.abort();await route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto((process.env.AUTOCODER_URL||'http://127.0.0.1:4173')+'/ui-architect.html');
 await page.locator('#repo').fill(repo);await page.locator('#inspect').click();await page.locator('#load').click();await page.locator('#generate').click();
 assert.match(await page.locator('#diff-a').textContent(),/Studio Niko UI Architect V6/);
 assert.equal(await page.locator('#send').isDisabled(),true);
 const d=page.waitForEvent('download');await page.locator('#export-compare').click();assert.equal((await d).suggestedFilename(),'niko-ui-comparison.json');
 await page.locator('#approved').check();assert.equal(await page.locator('#export').isDisabled(),false);
 await page.locator('#selected').selectOption('B');assert.equal(await page.locator('#export').isDisabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log('PASS V6 targeted GitHub read fixture, variants, comparison export and consent reset');
}finally{await browser.close();}
