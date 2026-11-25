import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const OWNER='Nikoju1977',MAX=2*1024*1024;
const allowed=new Set(['the-lovestronautes-machine','oracle-du-jardinier','Neural-Art-mars-2026','ia-studio-cine']);
const hash=b=>createHash('sha256').update(b).digest('hex');
export function validateManifest(m){
 if(m?.version!==1||!Array.isArray(m.targets)||!m.targets.length||m.targets.length>8)throw Error('Invalid manifest');
 const repos=new Set();
 for(const t of m.targets){
  if(!allowed.has(t.repo)||repos.has(t.repo)||!/^[0-9a-f]{40}$/.test(t.commit)||!Number.isSafeInteger(t.pagesRun)||t.pagesRun<1||!Array.isArray(t.files)||!t.files.length||t.files.length>12||new Set(t.files).size!==t.files.length)throw Error('Invalid target');
  repos.add(t.repo);
  for(const p of t.files)if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(p)||p==='.'||p==='..')throw Error('Invalid file');
 }
 return m;
}
export function compare(source,served){
 if(!source.ok||!served.ok)return {status:'unavailable',sourceStatus:source.status,publicStatus:served.status,sourceSha256:source.sha256??null,publicSha256:served.sha256??null};
 return {status:source.sha256===served.sha256?'match':'mismatch',sourceStatus:source.status,publicStatus:served.status,sourceSha256:source.sha256,publicSha256:served.sha256,sourceBytes:source.bytes,publicBytes:served.bytes};
}
export async function fetchDigest(url,fetcher=fetch){
 let res;
 try{
  res=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'cache-control':'no-cache','accept-encoding':'identity','user-agent':'Studio-Niko-Integrity-Audit'}});
  if(!res.ok)return {ok:false,status:res.status};
  if(Number(res.headers.get('content-length'))>MAX){await res.body?.cancel();return {ok:false,status:res.status,error:'size-limit'};}
  const reader=res.body.getReader(),chunks=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX){await reader.cancel();return {ok:false,status:res.status,error:'size-limit'};}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return {ok:true,status:res.status,bytes,sha256:hash(Buffer.concat(chunks,bytes))};
 }catch{return {ok:false,status:res?.status??null,error:'fetch-failed'};}
}
export async function audit(m,reader=fetchDigest){
 validateManifest(m);const rows=[];
 for(const t of m.targets)for(const path of t.files){
  const sourceUrl='https://raw.githubusercontent.com/'+OWNER+'/'+t.repo+'/'+t.commit+'/'+path;
  const publicUrl='https://nikoju1977.github.io/'+t.repo+'/'+path;
  const [source,served]=await Promise.all([reader(sourceUrl),reader(publicUrl)]);
  rows.push({repo:t.repo,commit:t.commit,pagesRun:t.pagesRun,path,...compare(source,served)});
 }
 return {checkedAt:new Date().toISOString(),scope:'selected static files only; no runtime or complete revision certification',productionRuntimeVerified:false,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const m=JSON.parse(readFileSync(new URL('../tests/static-pages-targets.json',import.meta.url),'utf8'));
 const report=await audit(m);
 writeFileSync('static-pages-proof.json',JSON.stringify(report,null,2)+'\n');
 for(const row of report.rows)console.log('PAGES_FILE '+JSON.stringify(row));
 const counts={match:0,mismatch:0,unavailable:0};for(const row of report.rows)counts[row.status]++;
 console.log('PAGES_SUMMARY '+JSON.stringify(counts));
 if(counts.mismatch||counts.unavailable)process.exitCode=1;
}
