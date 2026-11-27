// Audit committed files in a local Git checkout. No execution of repository code.
import {appendFile} from 'node:fs/promises';
import {readSnapshot,memoryRecord} from '../code-mode-x-factory.mjs';
try{
 const args=process.argv.slice(2);
 if(args.length!==1&&!(args.length===4&&args[1]==='--remember'))throw Error('Usage: node scripts/factory.mjs checkout [--remember project-id journal.jsonl]');
 const snapshot=readSnapshot(args[0]);
 if(args[1]==='--remember'){
   const record=memoryRecord(snapshot.report,args[2]);
   await appendFile(args[3],JSON.stringify(record)+'\n',{encoding:'utf8',mode:0o600});
 }
 console.log(JSON.stringify(snapshot.report,null,2));
 process.exitCode=snapshot.report.findings.some(f=>f.severity==='error')?1:0;
}catch{console.error('Audit impossible. Vérifier le chemin Git et les arguments.');process.exitCode=2;}
