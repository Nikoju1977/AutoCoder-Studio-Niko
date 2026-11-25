// Targeted repeat of the 12 parser rejections from the actual fleet report.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {inspectSyntax,checkBlobIntegrity} from '../deep-audit.mjs';
const repo='Nikoju1977/Wan2GP',commit='a02526122d204caa1efcf7ac76d7075fc7224c0b';
const paths=["models/hidream/utils.py","models/longcat/modules/block_sparse_attention/flash_attn_bsa_varlen_mask.py","models/ltx2/ltx_core/model/audio_vae/vocoder.py","models/magi_human/upstream/inference/__init__.py","models/magi_human/upstream/inference/infra/__init__.py","models/magi_human/upstream/inference/model/__init__.py","models/magi_human/upstream/inference/model/dit/__init__.py","models/magi_human/upstream/inference/model/sa_audio/__init__.py","models/magi_human/upstream/inference/pipeline/__init__.py","models/TTS/ace_step15/pipeline_ace_step15.py","models/TTS/omnivoice/modeling_omnivoice.py","shared/gradio/ui_scripts.js"];
const root=mkdtempSync(join(tmpdir(),'cmx-wan-parser-')),rows=[];
const env={PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'};
const git=(args,opts={})=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore'],env,...opts});
try{
 git(['init','--quiet']);git(['-c','protocol.file.allow=never','fetch','--quiet','--depth=1','--no-tags','https://github.com/'+repo+'.git',commit]);
 for(const path of paths){
  const sha=git(['rev-parse',commit+':'+path]).trim(),bytes=git(['cat-file','blob',sha],{encoding:'buffer'});
  if(!checkBlobIntegrity(bytes,sha))throw Error('Integrity');
  const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const syntax=inspectSyntax(path,content);
  const row={path,sha,utf8Bom:content.startsWith('\uFEFF'),syntax,previousStatus:'invalid'};
  if(path.endsWith('.py')&&syntax.status==='invalid'){
   // Capture only diagnostic class, line and column, not the source line.
   const r=spawnSync('python3',['-I','-S','-c','import ast,sys,json\ntry: ast.parse(sys.stdin.buffer.read())\nexcept SyntaxError as e: print(json.dumps({"type":type(e).__name__,"line":e.lineno,"column":e.offset,"kind":("duplicate_argument" if "duplicate argument" in e.msg else "invalid_syntax" if "invalid syntax" in e.msg else "other")}))'],{input:bytes,encoding:'utf8',timeout:5000,maxBuffer:8192,env});
   try{row.diagnostic=JSON.parse(r.stdout);}catch{}
  }
  rows.push(row);console.log('WAN_RECHECK '+JSON.stringify(row));
 }
 const tree=git(['ls-tree','-r','-l','-z',commit]).split('\0').filter(Boolean).map(s=>{const i=s.indexOf('\t');const [mode,type,sha,size]=s.slice(0,i).trim().split(/\s+/);return {path:s.slice(i+1),size:Number(size),type,mode};});
 const oversized=tree.filter(f=>f.type==='blob'&&['100644','100755'].includes(f.mode)&&f.size>1048576&&/\.(js|mjs|cjs|py|json|html|css|md|ts|tsx|jsx|yaml|yml|toml|sql|sh)$/i.test(f.path)&&!/(^|\/)(?:\.[^/]+|node_modules|vendor|dist|build|coverage|credentials[^/]*|secrets?[^/]*)(\/|$)/i.test(f.path));
 // Recheck the actual host contract instead of treating the JS fragment as standalone.
 const hostPath='wgp.py',fragmentPath='shared/gradio/ui_scripts.js';
 const host=git(['cat-file','blob',git(['rev-parse',commit+':'+hostPath]).trim()]);
 const fragment=git(['cat-file','blob',git(['rev-parse',commit+':'+fragmentPath]).trim()]);
 const fragmentRow=rows.find(r=>r.path===fragmentPath);
 const hostConfirmed=host.includes('"shared", "gradio", "ui_scripts.js"')&&host.includes('js = f.read()')&&host.includes('js += AudioGallery.get_javascript()')&&host.includes('js += """\n    }\n    """')&&host.includes('ui_studio.Blocks(css=css, js=js,');
 const closureOnly=inspectSyntax(fragmentPath,fragment+'\n}\n');
 if(!hostConfirmed||!['valid','valid_expression'].includes(closureOnly.status))throw Error('Host assembly evidence changed');
 fragmentRow.context={status:'intentional_fragment',host:hostPath,closureOnly:closureOnly.status,fullAssemblyTested:false};
 const correctedCommit='78fbfba2287bd7057513f3417b988820997d98e4';
 git(['-c','protocol.file.allow=never','fetch','--quiet','--depth=1','--no-tags','https://github.com/'+repo+'.git',correctedCommit]);
 const kernelPath='models/longcat/modules/block_sparse_attention/flash_attn_bsa_varlen_mask.py';
 const correctedBlob=git(['rev-parse',correctedCommit+':'+kernelPath]).trim(),corrected=git(['cat-file','blob',correctedBlob],{encoding:'buffer'});
 const original=git(['cat-file','blob',rows.find(r=>r.path===kernelPath).sha],{encoding:'buffer'});
 if(!checkBlobIntegrity(corrected,correctedBlob))throw Error('Corrected integrity');
 const before=original.toString('utf8').split('\n'),after=corrected.toString('utf8').split('\n');
 const changed=before.flatMap((line,i)=>line!==after[i]?[i+1]:[]);
 if(before.length!==after.length||changed.join(',')!=='111,140,143,247,273,276'||changed.some(n=>before[n-1].trimStart()!==after[n-1].trimStart()))throw Error('Unexpected source changes');
 const syntax=inspectSyntax(kernelPath,corrected.toString('utf8'));
 const compile=spawnSync('python3',['-I','-S','-c','import sys; compile(sys.stdin.buffer.read(), "<kernel>", "exec")'],{input:corrected,timeout:5000,env});
 const comparison={originalCommit:commit,correctedCommit,correctedBlob,changedLines:changed,before:rows.find(r=>r.path===kernelPath).syntax.status,after:syntax.status,compilePassed:compile.status===0,gpuTested:false,numericalEquivalenceTested:false};
 console.log('WAN_CONTEXT '+JSON.stringify(fragmentRow.context));console.log('WAN_REPAIR '+JSON.stringify(comparison));
 if(comparison.before!=='invalid'||comparison.after!=='valid'||!comparison.compilePassed)throw Error('Kernel parser or compile check failed');
 const report={repo,commit,comparison,pythonVersion:execFileSync('python3',['--version'],{encoding:'utf8'}).trim(),rows,oversized,summary:rows.reduce((m,r)=>(m[r.syntax.status]=(m[r.syntax.status]||0)+1,m),{}),functionalTests:false};
 writeFileSync('wan-syntax-report.json',JSON.stringify(report,null,2));console.log('WAN_SUMMARY '+JSON.stringify({...report,rows:undefined}));
}finally{rmSync(root,{recursive:true,force:true});}
