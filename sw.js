const CACHE='musicandbeats-v8';
const ASSETS=['./','./index.html','./styles.css','./v4.css','./v5.css','./v6.css','./v6-patch.css','./v7.css','./v8.css','./app.js','./workflow-fixes.js','./v4-fixes.js','./v5-fixes.js','./v5-hotfix.js','./v6.js','./v6-patch.js','./v7.js','./v8.js','./recorder-worklet.js','./manifest.webmanifest','./icon.svg','./assets/instruments/grand-piano.svg','./assets/instruments/electric-piano.svg','./assets/instruments/organ.svg','./assets/instruments/synth.svg','./assets/instruments/pad.svg','./assets/instruments/bass.svg','./assets/instruments/guitar-rig.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>{
    const fresh=fetch(e.request).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>cached);
    return cached||fresh;
  }));
});
