/* La coque de l'application est consultable hors-ligne après un premier chargement.
   Pyodide provient d'un CDN : première exécution Python = connexion nécessaire. */
const CACHE = 'studio-niko-autocoder-v7';
const SHELL = ['./code-mode-x-memory.mjs','./code-mode-x-github.mjs','./code-mode-x.html','./code-mode-x.css','./code-mode-x-ui.mjs','./code-mode-x-project.mjs','./code-mode-x.mjs','./code-mode-x-team.mjs','./','./index.html','./styles.css','./app.js','./web-guidance.js','./studio-niko-core.js','./py-worker.js','./preview.html','./preview-host.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
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
  }).catch(async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    // Seules les navigations peuvent utiliser la page d'accueil de secours.
    // Un JS/CSS/manifest absent ne doit jamais recevoir du HTML à la place.
    if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
    return Response.error();
  }));
});
