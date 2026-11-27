import {readFileSync,writeFileSync} from 'node:fs';
import {readLedger,transactLedger} from '../maintenance-store.mjs';
import {supervise,renderSupervisor,planBatch,claimBatch} from '../maintenance-supervisor.mjs';
try{
 const [file,cmd,...args]=process.argv.slice(2);if(!file||!cmd)throw Error('Usage');
 const snapshot=JSON.parse(readFileSync(new URL('../tests/maintenance-releases.json',import.meta.url),'utf8'));
 if(cmd==='status'&&!args.length)console.log(JSON.stringify(supervise(readLedger(file),snapshot),null,2));
 else if(cmd==='plan'&&!args.length)console.log(JSON.stringify(planBatch(readLedger(file)),null,2));
 else if(cmd==='html'&&args.length===1){writeFileSync(args[0],renderSupervisor(readLedger(file),snapshot),{flag:'wx',mode:0o600});console.log('Local report created; no publication');}
 else if(cmd==='claim'&&args.length===1){const l=transactLedger(file,l=>claimBatch(l,args[0]));console.log(JSON.stringify(supervise(l,snapshot),null,2));}
 else throw Error('Usage');
}catch{console.error('Supervisor operation refused or failed. Check ledger, revision, plan and destination.');process.exitCode=1;}
