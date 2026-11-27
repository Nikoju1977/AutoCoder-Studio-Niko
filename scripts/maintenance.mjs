import {readFileSync,statSync} from 'node:fs';
import {reconcileWan} from '../maintenance-reconciliation.mjs';
import {readLedger,transactLedger} from '../maintenance-store.mjs';
import {makeIssue,upsertIssues,importFleet,moveIssue,resumeInterrupted,summary} from '../maintenance-ledger.mjs';
try{
 const [file,cmd,...args]=process.argv.slice(2);if(!file||!cmd)throw Error('Usage');
 let result;
 if(cmd==='status'&&args.length===0)result=readLedger(file);
 else if(cmd==='seed'&&!args.length)result=transactLedger(file,l=>{
  const seed=JSON.parse(readFileSync(new URL('../tests/maintenance-seed.json',import.meta.url),'utf8'));
  const existing=new Set(l.issues.map(t=>t.id));let next=upsertIssues(l,seed);
  for(const raw of seed){const id=makeIssue(raw).id;if(existing.has(id)||!raw.proof)continue;
   if(raw.confirmation==='fixture_improved'){for(const state of ['running','review_required','evidence_recorded'])next=moveIssue(next,id,state,state==='evidence_recorded'?{proof:raw.proof}:{});}
   else next={...next,issues:next.issues.map(t=>t.id===id?{...t,evidence:[raw.proof]}:t)};
  }return next;
 });
 else if(cmd==='import'&&args.length===2){if(statSync(args[0]).size>24*1024*1024)throw Error('Report too large');const report=JSON.parse(readFileSync(args[0],'utf8'));result=transactLedger(file,l=>importFleet(l,report,args[1]));}
 else if(cmd==='reconcile-wan'&&!args.length)result=transactLedger(file,reconcileWan);
 else if(cmd==='resume'&&!args.length)result=transactLedger(file,resumeInterrupted);
 else if(cmd==='move'&&(args.length===2||args.length===3)){const proof=args[2]?JSON.parse(args[2]):undefined;result=transactLedger(file,l=>moveIssue(l,args[0],args[1],{proof}));}
 else throw Error('Usage');
 console.log(JSON.stringify(summary(result),null,2));
}catch(e){console.error('Maintenance operation refused or failed. Check ledger, lock, arguments and evidence.');process.exitCode=1;}
