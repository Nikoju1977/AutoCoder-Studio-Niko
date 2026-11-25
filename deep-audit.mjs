// V21 Node-only static audit. Source text is never executed.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
export const AUDIT_VERSION='deep-audit-v21.1';
const ext=p=>p.split('.').pop().toLowerCase();
export function checkBlobIntegrity(bytes,sha){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===sha;}
function parser(cmd,args,content,spawn){
 const r=spawn(cmd,args,{input:content,encoding:'utf8',timeout:5000,maxBuffer:65536,windowsHide:true,env:{PATH:process.env.PATH||'',SYSTEMROOT:process.env.SYSTEMROOT||'',LANG:'C'}});
 if(r.error||typeof r.status!=='number')return 'unavailable';
 return r.status===0?'valid':'invalid';
}
export function inspectSyntax(path,content,{spawn=spawnSync}={}){
 const e=ext(path);
 if(e==='json'){try{JSON.parse(content);return {language:'json',status:'valid'};}catch{return {language:'json',status:'invalid'};}}
 if(e==='py')return {language:'python',status:parser('python3',['-I','-S','-c','import ast,sys; ast.parse(sys.stdin.buffer.read())'],content,spawn)};
 if(['js','mjs','cjs'].includes(e)){
  const modes=e==='mjs'?['module']:e==='cjs'?['commonjs']:['commonjs','module'];
  const results=modes.map(mode=>parser(process.execPath,['--check','--input-type='+mode],content,spawn));
  if(results.includes('valid'))return {language:'javascript',status:'valid'};
  if(results.includes('unavailable'))return {language:'javascript',status:'unavailable'};
  // Some host frameworks consume a function expression, not a standalone script.
  if(e==='js'&&/^\s*(?:async\s+)?function\s*\(/.test(content)){
   const expression=parser(process.execPath,['--check','--input-type=commonjs'],'('+content+'\n)',spawn);
   if(expression==='valid')return {language:'javascript',status:'valid_expression',contextVerified:false};
  }
  return {language:'javascript',status:'invalid'};
 }
 return {language:e,status:'not_supported'};
}
export function inspectFile({path,content},{allPaths=[],treeTruncated=false,spawn=spawnSync}={}){
 if(typeof content!=='string'||Buffer.byteLength(content)>1048576)throw Error('Audit size limit');
 const findings=[],scope=/(^|\/)(tests?|ron-tests|__tests__|tools|scripts)(\/|$)/i.test(path)?'test_or_tool_candidate':/\.md$/i.test(path)?'documentation':'source_candidate';
 let totalFindings=0;
 const add=(code,severity,line,confirmation='heuristic_only')=>{totalFindings++;if(findings.length<500)findings.push({code,severity,line,scope,confirmation});};
 const lines=content.split(/\r?\n/);
 const syntax=inspectSyntax(path,content,{spawn});
 if(syntax.status==='invalid')add(syntax.language==='json'?'JSON_INVALID':'SYNTAX_INVALID','error',null,'parser_rejected');
 for(let i=0;i<lines.length;i++){
  const s=lines[i];
  if(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/.test(s))add('POSSIBLE_SECRET','error',i+1);
  if(/\beval\s*\(|\bnew\s+Function\s*\(/.test(s))add('DYNAMIC_EXECUTION','warning',i+1);
  if(/\binnerHTML\s*=/.test(s))add('REVIEW_HTML_SINK','warning',i+1);
 }
 const dependency={checked:0,unresolved:0,status:treeTruncated?'tree_incomplete':'heuristic_only'};
 if(!treeTruncated&&['js','mjs','cjs','ts','tsx','jsx'].includes(ext(path))){
  const known=allPaths instanceof Set?allPaths:new Set(allPaths);
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(?:import\s+(?:[^"'\n]+?\s+from\s+)?|export\s+[^"'\n]+?\s+from\s+)["'](\.{1,2}\/[^"'?#]+)["']/.exec(lines[i]);
   if(!m)continue;
   const p=posix.normalize(posix.join(posix.dirname(path),m[1]));
   const candidates=[p,...['js','mjs','cjs','ts','tsx','jsx','json'].map(e=>p+'.'+e),...['js','mjs','ts','tsx','jsx'].map(e=>p+'/index.'+e)];
   dependency.checked++;
   if(!candidates.some(x=>known.has(x))){dependency.unresolved++;add('RELATIVE_REFERENCE_UNRESOLVED','warning',i+1);}
  }
 }
 return {findings,totalFindings,findingsCapped:totalFindings>findings.length,syntax,dependency};
}
