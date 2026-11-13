// Tiko service worker - works fully offline after first load.
const VERSION = 'tiko-v51';
// phonics clips live in their own long-lived cache, so an app update never wipes them
// (they still refresh in the background whenever the tablet is online)
const SOUNDS = 'tiko-sounds';
const ASSETS = ['./', 'index.html', 'styles.css', 'voice.js', 'app.js', 'data.js', 'sheets.js', 'science.js', 'placement.js', 'cloud.js', 'manifest.webmanifest', 'privacy.html',
  'fonts/andika-latin-400-normal.woff2', 'fonts/andika-latin-700-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-700-normal.woff2',
  'fonts/opendyslexic-latin-400-normal.woff2', 'fonts/opendyslexic-latin-700-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
// Install only waits for the small core files. Sound clips are fetched afterwards by the page,
// one at a time, and cached by the fetch handler below, so a slow/stalled download can never block an update.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SOUNDS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// stale-while-revalidate: answer instantly from the cache, refresh it from the network in the background
function swr(cacheName, req, e, fallbackToPage) {
  return caches.open(cacheName).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.status === 200) c.put(req, r.clone()).catch(() => {}); return r; })
      // only a page navigation may fall back to the app page — never hand index.html back for a sound or a script
      .catch(() => hit || (fallbackToPage ? c.match('index.html') : Response.error()));
    if (hit) e.waitUntil(net.catch(() => {}));
    return hit || net;
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // the app asks no other site for anything
  // recorded-voice clips: their names are hashes of the TEXT (not the audio), so a cached clip is final (a redone clip needs a new name): no re-fetch (and no request to the host) when one plays
  if (url.pathname.includes('/sounds/voice/')) { e.respondWith(caches.open(SOUNDS).then(async c => (await c.match(req, { ignoreSearch: true })) ||
    fetch(req).then(r => { if (r.status === 200) c.put(req, r.clone()).catch(() => {}); return r; }))); return; }
  if (url.pathname.includes('/sounds/')) { e.respondWith(swr(SOUNDS, req, e, false)); return; }
  e.respondWith(swr(VERSION, req, e, req.mode === 'navigate'));
});
