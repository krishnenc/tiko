// Tiko service worker – works fully offline after first load.
const VERSION = 'tiko-v6';
const FONTS = 'tiko-fonts';
const CLIPS = {
  en: ['a', 'ar', 'b', 'c', 'ch', 'ck', 'd', 'e', 'ee', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'll', 'm', 'n', 'ng', 'o', 'oo',
    'p', 'q', 'r', 's', 'sh', 't', 'th', 'u', 'v', 'w', 'x', 'y', 'z'],
  fr: ['b', 'c', 'ch', 'd', 'f', 'g', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 's', 't', 'v', 'z'],
};
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  ...Object.entries(CLIPS).flatMap(([l, keys]) => keys.map(k => `sounds/${l}-${k}.wav`))];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // stale-while-revalidate: instant + offline, picks up updates on next launch
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit || c.match('index.html'));
    return hit || net;
  }));
});
