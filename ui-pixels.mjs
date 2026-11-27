// Pixel comparison uses a trusted blank Chromium page; no project HTML or scripts.
import {readFile,writeFile} from 'node:fs/promises';
export async function pixelDiff(browser,before,after,output){
 const ctx=await browser.newContext({serviceWorkers:'block'});
 try{
  await ctx.route('**/*',route=>route.abort());
  const page=await ctx.newPage();
  const data=await Promise.all([before,after].map(async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64')));
  const result=await page.evaluate(async ([a,b])=>{
   const load=async src=>{const img=new Image();img.src=src;await img.decode();return img;};
   const [old,next]=await Promise.all([load(a),load(b)]);
   const w=old.width,h=old.height;
   if(w!==next.width||h!==next.height||w*h>4000000)throw Error('Dimensions incompatibles');
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   c.drawImage(old,0,0);const x=c.getImageData(0,0,w,h);
   c.drawImage(next,0,0);const y=c.getImageData(0,0,w,h);
   const d=c.createImageData(w,h);let changed=0,exact=0;
   for(let i=0;i<x.data.length;i+=4){
    const distance=Math.max(...[0,1,2,3].map(k=>Math.abs(x.data[i+k]-y.data[i+k])));
    if(distance>0)exact++;
    if(distance>16){changed++;d.data.set([255,76,105,255],i);}
    else{const gray=Math.round((x.data[i]+x.data[i+1]+x.data[i+2])/9);d.data.set([gray,gray,gray,255],i);}
   }
   c.putImageData(d,0,0);
   return {width:w,height:h,pixels:w*h,changedPixels:changed,exactChangedPixels:exact,changedFraction:changed/(w*h),threshold:16,png:canvas.toDataURL('image/png').split(',')[1]};
  },data);
  const {png,...metrics}=result;await writeFile(output,Buffer.from(png,'base64'));
  return metrics;
 }finally{await ctx.close();}
}
