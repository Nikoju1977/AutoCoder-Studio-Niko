// Studio Niko Design — Code Mode X v1.0
// Pure orchestration: no network, filesystem writes or code execution.
const limits = Object.freeze({files:30, file:120000, total:300000, prompt:4000});
const safeName = /^(?!\.)(?!.*\.\.)([a-zA-Z0-9][a-zA-Z0-9_.-]{0,63})\.(py|html|css|js|md|json)$/;
export function validateFiles(files) {
  if (!Array.isArray(files) || files.length > limits.files) throw new Error('Liste de fichiers invalide');
  const names = new Set(); let total = 0;
  return files.map(f => {
    if (!f || typeof f.name !== 'string' || !safeName.test(f.name) || names.has(f.name.toLowerCase()) ||
        typeof f.content !== 'string' || f.content.length > limits.file) throw new Error('Fichier invalide ou doublon');
    names.add(f.name.toLowerCase()); total += f.content.length;
    if (total > limits.total) throw new Error('Budget de taille dépassé');
    return {name:f.name, content:f.content};
  });
}
export function audit(files) {
  const checked = validateFiles(files); const findings = [];
  const add = (file,code,severity,line) => findings.push({file,code,severity,line});
  for (const f of checked) {
    if (f.name.endsWith('.json')) {
      try { JSON.parse(f.content); } catch { add(f.name,'JSON_INVALID','error',null); }
    }
    f.content.split(/\r?\n/).forEach((line,i) => {
      if (/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/.test(line))
        add(f.name,'POSSIBLE_SECRET','error',i+1);
      if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(line))
        add(f.name,'DYNAMIC_EXECUTION','warning',i+1);
      if (/\binnerHTML\s*=/.test(line))
        add(f.name,'REVIEW_HTML_SINK','warning',i+1);
    });
  }
  return {fileCount:checked.length,findings,passed:!findings.some(f=>f.severity==='error'),scope:'Contrôles statiques limités; aucun test exécuté'};
}
export async function runCodeMode({prompt,files=[],generate,maxAttempts=2,signal}={}) {
  if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>limits.prompt) throw new Error('Demande invalide');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3) throw new Error('Budget de tentatives invalide');
  const original=validateFiles(files); const events=[];
  const log=(stage,status,details={})=>events.push({stage,status,...details});
  const initial=audit(original);
  log('analyse','complete',{findings:initial.findings});
  if(initial.findings.some(f=>f.code==='POSSIBLE_SECRET')) return {status:'blocked',reason:'possible_secret',events,proposal:null};
  if(typeof generate!=='function') return {status:'audit_only',events,audit:initial,proposal:null};
  let feedback=[];
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    if(signal?.aborted) return {status:'cancelled',events,proposal:null};
    let generated;
    log('generation','started',{attempt});
    try{
      generated=await generate({prompt,files:original.map(f=>({...f})),feedback:feedback.map(f=>({...f})),signal});
      if(signal?.aborted) return {status:'cancelled',events,proposal:null};
      const changes=validateFiles(generated?.files);
      if(!changes.length) throw new Error('Empty proposal');
      const merged=new Map(original.map(f=>[f.name.toLowerCase(),f]));
      for(const f of changes) merged.set(f.name.toLowerCase(),f);
      const candidate=validateFiles([...merged.values()]);
      const result=audit(candidate);
      feedback=result.findings;
      log('verification',result.passed?'static_pass':'static_fail',{attempt,findings:feedback});
      if(feedback.some(f=>f.code==='POSSIBLE_SECRET')) return {status:'blocked',reason:'possible_secret',events,proposal:null};
      if(result.passed) return {status:'review_required',events,audit:result,proposal:candidate,
        changedFiles:changes.map(f=>f.name),testsExecuted:false};
    }catch{
      if(signal?.aborted) return {status:'cancelled',events,proposal:null};
      feedback=[{code:'INVALID_OR_FAILED_GENERATION',severity:'error'}];
      log('generation','failed',{attempt});
    }
  }
  return {status:'blocked',reason:'attempt_budget_exhausted',events,proposal:null,testsExecuted:false};
}
