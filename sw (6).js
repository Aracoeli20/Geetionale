const C='aracoeli-v142';
const SHELL=['./','./index.html','./config.js','./guida.html','./manifest.json','./icon-192.png','./icon-512.png'];
// Oltre questo tempo, se esiste già una copia salvata, l'app parte da quella (la risposta lenta aggiorna comunque la copia).
const ATTESA=3000;
// File esterni che servono per partire: l'SDK di Firebase e i caratteri. Hanno la versione nell'indirizzo, quindi non cambiano.
const FISSI=['www.gstatic.com','fonts.gstatic.com'];
const CARATTERI='fonts.googleapis.com';

self.addEventListener('install',e=>{
  // un file alla volta: se ne manca uno (un'icona, la guida) l'installazione non salta più per intero
  e.waitUntil(caches.open(C).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>k!==C?caches.delete(k):null))).then(()=>self.clients.claim()))});

function salva(chiave,resp){
  if(!resp||resp.status!==200)return Promise.resolve();
  const copia=resp.clone();
  return caches.open(C).then(c=>c.put(chiave,copia)).catch(()=>{});
}
function tieniVivo(e,p){try{e.waitUntil(p)}catch(_){}}

// File dell'app: rete prima (online hai sempre la versione aggiornata), copia salvata se la rete manca, sbaglia o ci mette troppo.
function retePoiCopia(e){
  const req=e.request;
  const rete=fetch(req).then(resp=>{tieniVivo(e,salva(req,resp));return resp});
  return caches.match(req,{ignoreSearch:req.mode==='navigate'}).then(copia=>{
    if(!copia)return rete;                                  // nessuna copia: si aspetta la rete, come prima
    tieniVivo(e,rete.catch(()=>{}));
    return Promise.race([
      rete.then(resp=>(resp&&resp.status<500)?resp:copia).catch(()=>copia),
      new Promise(ok=>setTimeout(()=>ok(copia),ATTESA))
    ]);
  });
}

// File esterni: si richiedono in modo "cors", così la risposta è leggibile e si salva solo se è davvero buona.
function scarica(url){
  return fetch(url,{mode:'cors',credentials:'omit'}).then(resp=>{
    if(!resp||resp.status!==200)throw new Error('risposta non buona');
    return salva(url,resp).then(()=>resp);
  });
}
// Copia prima; rete solo se la copia manca. Se il sito non concede il permesso si torna alla richiesta normale, come prima.
function copiaPoiRete(e,rinfresca){
  const req=e.request;
  return caches.match(req.url,{ignoreVary:true}).then(copia=>{
    if(copia){if(rinfresca)tieniVivo(e,scarica(req.url).catch(()=>{}));return copia}
    return scarica(req.url).catch(()=>fetch(req));
  });
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.hostname==='firestore.googleapis.com'||u.hostname.indexOf('identitytoolkit')>=0||u.hostname.indexOf('securetoken')>=0)return;
  if(FISSI.indexOf(u.hostname)>=0){e.respondWith(copiaPoiRete(e,false));return}
  if(u.hostname===CARATTERI){e.respondWith(copiaPoiRete(e,true));return}
  if(u.origin===self.location.origin){e.respondWith(retePoiCopia(e));return}
  // tutto il resto: rete prima, senza limite di tempo, come è sempre stato
  e.respondWith(
    fetch(e.request).then(resp=>{tieniVivo(e,salva(e.request,resp));return resp}).catch(()=>caches.match(e.request))
  );
});
