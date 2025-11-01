const CACHE = 'pwa-budget-v1';
const ASSETS = [
  '/public/index.html',
  '/public/styles.css',
  '/public/app.js',
  '/public/manifest.webmanifest',
  '/public/icons/icon-192.png',
  '/public/icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    // network first for API
    e.respondWith(fetch(e.request).catch(()=> new Response(JSON.stringify({ ok:false, offline:true }), { headers:{'Content-Type':'application/json'} })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c=> c.put(e.request, copy));
      return resp;
    }).catch(()=> caches.match('/public/index.html')))
  );
});
