const CACHE='musicandbeats-v34';
const ASSETS=['./','./index.html','./styles.css','./v4.css','./v5.css','./v6.css','./v6-patch.css','./v7.css','./v8.css','./v9.css','./v10.css','./v12.css','./v14.css','./v15.css','./v16.css','./v17.css','./v18.css','./v19.css','./v22.css','./v23.css','./v24.css','./v25.css','./v26.css','./v27.css','./v28.css','./v29.css','./help.css','./keyboard-ui.css','./v34-looper.css','./brand-v11.css','./app.js','./workflow-fixes.js','./v4-fixes.js','./v5-fixes.js','./v5-hotfix.js','./v6.js','./v6-patch.js','./v7.js','./v8.js','./v9.js','./v10.js','./v12.js','./v13.js','./v14.js','./v15.js','./v16.js','./v17.js','./v17-fixes.js','./v17-post.js','./v18.js','./v18-fixes.js','./v19.js','./v22.js','./v23.js','./v24.js','./v25.js','./v26.js','./v27.js','./v28.js','./v29.js','./core-performance.js','./core-performance-fixes.js','./ui-core.js','./help.js','./keyboard-ui.js','./v34-looper.js','./perf-debug.js','./perf-debug.css','./update-guard.js','./recorder-worklet.js','./manifest.webmanifest','./icon.svg','./assets/instruments/grand-piano.svg','./assets/instruments/electric-piano.svg','./assets/instruments/organ.svg','./assets/instruments/synth.svg','./assets/instruments/pad.svg','./assets/instruments/bass.svg','./assets/instruments/guitar-rig.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:')return;
  const sameOrigin=url.origin===self.location.origin;
  const critical=sameOrigin&&(/\.(?:js|css|webmanifest)$/.test(url.pathname));
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(critical){
    e.respondWith(fetch(e.request).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>{
    const fresh=fetch(e.request).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>cached);
    return cached||fresh;
  }));
});