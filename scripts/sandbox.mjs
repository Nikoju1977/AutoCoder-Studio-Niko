import {readFile,stat,writeFile} from 'node:fs/promises';
import {prepareSandbox,runSandbox} from '../sandbox-runner.mjs';
try{
 const [specFile,reportFile,flag,approval,...extra]=process.argv.slice(2);
 if(!specFile||!reportFile||extra.length||(flag!==undefined&&(flag!=='--approve'||!approval)))throw Error('Usage: node scripts/sandbox.mjs spec.json report.json [--approve DIGEST]');
 if((await stat(specFile)).size>1000000)throw Error('Spec too large');
 const spec=JSON.parse(await readFile(specFile,'utf8'));
 const plan=prepareSandbox(spec);
 if(!approval)console.log(JSON.stringify({status:'approval_required',manifest:plan.manifest,approvalDigest:plan.approvalDigest,testsExecuted:false},null,2));
 else{
  const report=runSandbox({spec,approval});
  await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(report,null,2));
 }
}catch{console.error('Sandbox refused or failed: check fixture, local Docker, image and approval.');process.exitCode=1;}
