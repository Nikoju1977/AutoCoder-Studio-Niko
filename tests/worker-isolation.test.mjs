import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const workerSource=readFileSync(resolve(root,'py-worker.js'),'utf8');
const PREFIX='/home/pyodide/autocoder/';

function mockedWorker(){
  const files=new Map();
  const actions=[];
  const pythonScripts=[];
  const replies=[];
  const pyodide={
    FS:{
      mkdirTree:directory=>actions.push(['mkdir',directory]),
      chdir:directory=>actions.push(['chdir',directory]),
      unlink:filepath=>{
        actions.push(['unlink',filepath]);
        if(!files.has(filepath))throw Error('Missing virtual file');
        files.delete(filepath);
      },
      writeFile:(filepath,data)=>{actions.push(['write',filepath]);files.set(filepath,data);}
    },
    setStdout(){},setStderr(){},
    runPython:code=>pythonScripts.push(code),
    async runPythonAsync(){return undefined;}
  };
  const self={
    postMessage:reply=>replies.push(reply),
    importScripts:()=>{},
    async loadPyodide(){return pyodide;}
  };
  runInNewContext(workerSource,{self,console});
  async function execute(id,files,selected='main.py'){
    await self.onmessage({data:{type:'execute',requestId:id,mode:'run',selected,files}});
    return replies.filter(reply=>reply.requestId===id).at(-1);
  }
  return {files,actions,pythonScripts,replies,execute};
}

test('Pyodide removes deleted modules from the import cache between runs',async()=>{
  const worker=mockedWorker();
  const first=await worker.execute(1,{'main.py':'import helper','helper.py':'VALUE = 7'});
  assert.equal(first.type,'result');
  assert.equal(worker.files.get(PREFIX+'helper.py'),'VALUE = 7');
  const second=await worker.execute(2,{'main.py':'print("New project")'});
  assert.equal(second.type,'result');
  assert.equal(worker.files.has(PREFIX+'helper.py'),false,'Removed project file must leave virtual FS');
  const invalidation=worker.pythonScripts.at(-1);
  assert.match(invalidation,/sys\.modules\.pop\(_autocoder_name, None\)/);
  assert.match(invalidation,/"helper"/,'The deleted Python module must also leave sys.modules');
  assert.match(invalidation,/"main"/,'Reloaded modules must also be invalidated');
});

test('invalid project import does not destroy the existing Pyodide project',async()=>{
  const worker=mockedWorker();
  assert.equal((await worker.execute(1,{'main.py':'import helper','helper.py':'VALUE = 2'})).type,'result');
  const oldFiles=[...worker.files.entries()].sort();
  const opsBefore=worker.actions.length;
  const rejected=await worker.execute(2,{'main.py':'print("replace")','invalid.txt':'not python'});
  assert.equal(rejected.type,'error');
  assert.match(rejected.message,/Fichier non autorisé/);
  assert.deepEqual([...worker.files.entries()].sort(),oldFiles);
  assert.equal(worker.actions.length,opsBefore,'Validation must happen before unlink/write');
  assert.equal((await worker.execute(3,{'main.py':'print("Valid again")'})).type,'result');
  assert.equal(worker.files.has(PREFIX+'helper.py'),false);
});
