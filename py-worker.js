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
      // Le répertoire virtuel du projet doit être importable par unittest.
      py.runPython("import os, sys\n_autocoder_dir = os.getcwd()\nif _autocoder_dir not in sys.path: sys.path.insert(0, _autoc���q�^