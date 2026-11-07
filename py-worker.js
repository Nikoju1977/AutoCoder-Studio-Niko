/* Exécution Python dans un Worker dédié. Ne constitue PAS une sandbox hostile certifiée. */
'use strict';
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/';
let pyodidePromise = null;
let pyodide = null;
let activeId = null;
let stdoutChars = 0;
let truncatedOutput = false;
let previousFiles = [];
const DIR = '/home/pyodide/autocoder';
const FILENAME = /^(?!\.)(?!.*\.\.)([a-zA-Z0-9][a-zA-Z0-9_.-]{0,63})\.py$/;
const reply = payload => self.postMessage({requestId:activeId,...payload});

function output(message,type) {
  const chunk = String(message);
  if (stdoutChars > 45_000) {
    if (!truncatedOutput) { truncatedOutput = true; reply({type:'stderr',message:'Sortie limitée à 45 000 caractères.'}); }
    return;
  }
  stdoutChars += chunk.length;
  reply({type,message:chunk.slice(0,3000)});
}

async function loadRuntime() {
  if (pyodide) return pyodide;
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      reply({type:'loading'});
      self.importScripts(PYODIDE_BASE + 'pyodide.js');
      const py = await self.loadPyodide({indexURL:PYODIDE_BASE});
      py.setStdout({batched: message => output(message,'stdout')});
      py.setStderr({batched: message => output(message,'stderr')});
      py.FS.mkdirTree(DIR);
      py.FS.chdir(DIR);
      pyodide = py;
      reply({type:'ready'});
      return py;
    })().catch(error => {pyodidePromise=null;throw error;});
  }
  return pyodidePromise;
}
function syncFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Fichiers absents.');
  const entries = Object.entries(files);
  if (entries.length > 30) throw new Error('Trop de fichiers Python.');
  for (const name of previousFiles) {
    try {pyodide.FS.unlink(DIR+'/'+name);} catch (_) {/* possible suppression antérieure */}
  }
  previousFiles=[];
  for (const [name,source] of entries) {
    if (!FILENAME.test(name) || typeof source!=='string' || source.length>120_000) throw new Error('Fichier non autorisé : '+name);
    pyodide.FS.writeFile(DIR+'/'+name,source,{encoding:'utf8'});
    previousFiles.push(name);
  }
  // Réinitialiser les modules du projet pour ne pas réutiliser un ancien code.
  const stems = entries.map(([name])=>name.slice(0,-3));
  const list = JSON.stringify(stems);
  pyodide.runPython(`import sys, importlib\nfor _autocoder_name in ${list}:\n    sys.modules.pop(_autocoder_name, None)\nimportlib.invalidate_caches()`);
}
function testSource() {
  return `import importlib, sys, json, types, unittest
sys.modules.pop("main", None)
importlib.invalidate_caches()
module = importlib.import_module("main")
tests = types.ModuleType("autocoder_tests")
tests.__file__ = "test_main.py"
tests.__dict__["__name__"] = "autocoder_tests"
with open("test_main.py", encoding="utf8") as f:
    contents = f.read()
exec(compile(contents, "test_main.py", "exec"), tests.__dict__)
suite = unittest.defaultTestLoader.loadTestsFromModule(tests)
result = unittest.TextTestRunner(verbosity=2, stream=sys.stdout).run(suite)
json.dumps({"testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors)})`;
}
self.onmessage = async event => {
  const m=event.data||{};
  if (m.type!=='execute') return;
  activeId=m.requestId;
  stdoutChars=0;truncatedOutput=false;
  try {
    await loadRuntime();
    syncFiles(m.files);
    if (m.mode==='test' && (!m.files['test_main.py'] || !m.files['main.py'])) throw Error('main.py et test_main.py sont nécessaires.');
    if (m.mode==='run' && (!FILENAME.test(m.selected) || !(m.selected in m.files))) throw Error('Fichier Python non autorisé.');
    reply({type:'start'});
    if (m.mode==='test') {
      const str=await pyodide.runPythonAsync(testSource());
      const testResult=JSON.parse(str);
      reply({type:'result',testResult});
    } else {
      const selected=JSON.stringify(m.selected);
      const script=`_autocoder_name=${selected}\nwith open(_autocoder_name, encoding="utf8") as _autocoder_file:\n    _autocoder_code=_autocoder_file.read()\nexec(compile(_autocoder_code, _autocoder_name, "exec"), {"__name__":"__main__","__file__":_autocoder_name})`;
      await pyodide.runPythonAsync(script);
      reply({type:'result'});
    }
  } catch (error) {
    reply({type:'error',message:String(error?.message||error).slice(0,6000)});
  }
};
