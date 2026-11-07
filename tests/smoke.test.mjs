import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import handler from '../api/generate.mjs';
import statusHandler from '../api/status.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const text=name=>readFileSync(resolve(base,name),'utf8');
const request=async(method,token,body)=>{
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};
  await handler({method,headers:{authorization:token?'Bearer '+token:'','content-length':'200'},body},res);
  return res;
};
test('la coque contient tous les fichiers de la PWA',()=>{
  for(const name of ['index.html','styles.css','app.js','py-worker.js','preview.html','preview-host.js','sw.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png']){
    assert.equal(existsSync(resolve(base,name)),true,name);
  }
});
test('les contrÃ´les principaux sont prÃ©sents',()=>{
  const html=text('index.html');
  for(const id of ['btn-generate','code-editor','btn-run','btn-stop','btn-tests','btn-preview','btn-export','btn-import','log-list','diagnostic-list'])assert.match(html,new RegExp(`id="${id}"`));
});
test('la CSP de lâ€™interface interdit les scripts distants et les objets',()=>{
  assert.match(text('index.html'),/script-src 'self'/);
  as¶»§q«^