const CACHE = 'musicandbeats-v40';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './recorder-worklet.js',
  './update-guard.js',
  './build-version.json',
  './src/styles.css',
  './src/main.js',
  './src/app-core.js',
  './src/state.js',
  './src/audio-engine.js',
  './src/scheduler.js',
  './src/effects.js',
  './src/arp-engine.js',
  './src/groove-box.js',
  './src/recording.js',
  './src/looper.js',
  './src/projects.js',
  './src/play-ui.js',
  './src/record-ui.js',
  './src/help.js',
  './src/instruments/smart-keys.js',
  './src/instruments/bass.js',
  './src/instruments/guitar.js',
  './src/instruments/lead.js',
  './assets/instruments/grand-piano.svg',
  './assets/instruments/electric-piano.svg',
  './assets/instruments/organ.svg',
  './assets/instruments/synth.svg',
  './assets/instruments/pad.svg',
  './assets/instruments/bass.svg',
  './assets/instruments/guitar-rig.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const sameOrigin = url.origin === self.location.origin;
  const critical = sameOrigin && (/\.(?:js|css|webmanifest|json)$/.test(url.pathname));

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (critical) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
