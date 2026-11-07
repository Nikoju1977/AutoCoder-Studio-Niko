/* La coque de l'application est consultable hors-ligne après un premier chargement.
   Pyodide provient d'un CDN : première exécution Python = connexion nécessaire. */
const CACHE = 'studio-niko-autocoder-v2.0.2';
const SHELL = ['./','./index.html','./styles.css','./app.js','./py-worker.js','./preview.html','./preview-host.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin || url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(req).then(res=>{
    if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
    return res;
  }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
});
