// Studio Niko Design — Software Factory V4: local Git snapshot, read-only.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {audit,validateFiles} from './code-mode-x.mjs';
const SOURCE=/\.(?:js|mjs|cjs|ts|tsx|jsx|py|html|css|json|md|yml|yaml|sh)$/i;
const PRIVATE=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials[^/]*|secrets?[^/]*|id_rsa|id_ed25519)(?:$|\/)/i;
const EXCLUDED=/(?:^|\/)(?:node_modules|vendor|dist|build|coverage)(?:\/|$)/;
function git(root,args,encoding='utf8'){
  return execFileSync('git',['-C',root,...args],{encoding,maxBuffer:8*1024*1024,timeout:15000,windowsHide:true,stdio:['ignore','pipe','pipe']});
}
export function readSnapshot(root,{maxFiles=150,maxBytes=1500000,read=git}={}){
  if(!Number.isInteger(maxFiles)||maxFiles<1||maxFiles>500||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>5000000)throw Error('Invalid budget');
  const commit=read(root,['rev-parse','--verify','HEAD^{commit}']).trim();
  if(!/^[a-f0-9]{40,64}$/.test(commit))throw Error('Invalid commit');
  const rows=read(root,['ls-tree','-r','-l','-z',commit]).split('\0').filter(Boolean);
  let scannedBytes=0;const inventory=[],findings=[],sources=new Map();
  for(const row of rows){
    const m=/^(\d+) (\w+) ([a-f0-9]+)\s+(\d+|-)\t([\s\S]+)$/.exec(row);
    if(!m)throw Error('Invalid Git tree');
    const [,mode,type,sha,sizeText,path]=m;const size=Number(sizeText);
    let status='scanned';
    if(type!=='blob'||!['100644','100755'].includes(mode))status='non_regular';
    else if(PRIVATE.test(path)||EXCLUDED.test(path)||!SOURCE.test(path))status='excluded';
    else if(size>120000||sources.size>=maxFiles||scannedBytes+size>maxBytes)status='budget';
    if(status==='scanned'){
      const bytes=read(root,['cat-file','blob',sha],null);
      if(!Buffer.isBuffer(bytes)||bytes.length!==size)throw Error('Blob size mismatch');
      const source=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
      scannedBytes+=size;
      // Never return source in the report. Keep it only for explicit selection.
      if(source.includes('\0')||source.includes('\uFFFD'))status='non_text';
      else{
        const name=path.toLowerCase().endsWith('.json')?'file.json':'file.md';
        const result=audit([{name,content:source}]);
        for(const {code,severity,line} of result.findings)findings.push({path,code,severity,line});
        if(result.findings.some(f=>f.code==='POSSIBLE_SECRET'))status='possible_secret';
        else sources.set(path,{source,sha});
      }
    }
    inventory.push({path,mode,type,sha,size:Number.isFinite(size)?size:null,status});
  }
  return {report:{schema:1,commit,inventory,findings,scannedBytes,testsExecuted:false,scope:'Snapshot HEAD; static heuristics only; working tree not inspected'},sources};
}
export function prepareContext(snapshot,paths){
  if(!Array.isArray(paths)||!paths.length||paths.length>12||new Set(paths).size!==paths.length)throw Error('Select 1–12 unique files');
  const mapping=[],files=[];
  for(const path of paths){
    const entry=snapshot.sources.get(path);
    if(!entry||entry.source.length>12000)throw Error('File unavailable or exceeds API context limit');
    const ext=path.split('.').pop().toLowerCase();
    if(!['py','html','css','js','md','json'].includes(ext))throw Error('File extension unsupported by generation API');
    const name='file-'+String(mapping.length+1).padStart(2,'0')+'.'+ext;
    mapping.push({name,path,sha:entry.sha});files.push({name,content:entry.source});
  }
  validateFiles(files);
  if(Buffer.byteLength(JSON.stringify({files}),'utf8')>74000)throw Error('API context too large');
  return {commit:snapshot.report.commit,mapping,files};
}
export function prepareChanges(context,proposal){
  const files=validateFiles(proposal),map=new Map(context.mapping.map(m=>[m.name,m]));
  if(!files.length||files.some(f=>!map.has(f.name)))throw Error('Unexpected generated file; explicit review required');
  if(!audit(files).passed)throw Error('Static audit failed');
  return {commit:context.commit,testsExecuted:false,status:'review_required',changes:files.map(f=>({path:map.get(f.name).path,expectedBlob:map.get(f.name).sha,content:f.content}))};
}
export function memoryRecord(report,projectId,at=new Date().toISOString()){
  if(typeof projectId!=='string'||!/^[a-zA-Z0-9_.-]{1,80}$/.test(projectId))throw Error('Invalid project ID');
  const summary={schema:1,projectId,commit:report.commit,at,counts:{files:report.inventory.length,scanned:report.inventory.filter(f=>f.status==='scanned').length,findings:report.findings.length},findings:report.findings,testsExecuted:false};
  return {...summary,fingerprint:createHash('sha256').update(JSON.stringify(summary)).digest('hex')};
}
