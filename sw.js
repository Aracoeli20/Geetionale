const C='aracoeli-v23';
const SHELL=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>k!==C?caches.delete(k):null))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.hostname==='firestore.googleapis.com'||u.hostname.indexOf('identitytoolkit')>=0||u.hostname.indexOf('securetoken')>=0)return;
  // NETWORK-FIRST: quando sei online scarichi sempre la versione aggiornata; offline ripieghi sulla cache
  e.respondWith(
    fetch(e.request).then(resp=>{
      if(resp&&resp.status===200){const cl=resp.clone();caches.open(C).then(c=>c.put(e.request,cl))}
      return resp;
    }).catch(()=>caches.match(e.request))
  );
});
