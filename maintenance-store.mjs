import {openSync,closeSync,readFileSync,writeFileSync,renameSync,unlinkSync,statSync,fsyncSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {newLedger,validateLedger} from './maintenance-ledger.mjs';
const MAX=24*1024*1024;
export function readLedger(path){try{if(statSync(path).size>MAX)throw Error('Ledger too large');return validateLedger(JSON.parse(readFileSync(path,'utf8')));}catch(e){if(e.code==='ENOENT')return newLedger();throw e;}}
export function transactLedger(path,update){
 const lock=path+'.lock';const fd=openSync(lock,'wx',0o600);let tmp;
 try{
  const previous=readLedger(path),next=validateLedger(update(previous));
  if(next.revision<previous.revision)throw Error('Revision rollback');
  const raw=JSON.stringify(next,null,2)+'\n';if(Buffer.byteLength(raw)>MAX)throw Error('Ledger too large');
  tmp=path+'.'+randomUUID()+'.tmp';const out=openSync(tmp,'wx',0o600);
  try{writeFileSync(out,raw);fsyncSync(out);}finally{closeSync(out);}
  renameSync(tmp,path);tmp=null;return next;
 }finally{if(tmp)try{unlinkSync(tmp);}catch{}closeSync(fd);unlinkSync(lock);}
}
