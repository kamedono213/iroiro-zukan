// いろいろ図鑑のサービスワーカー: ネットがあれば新しいものを、なければしまってあるものを使う
const CACHE = 'iroiro-2';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && c.put(u, r))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('iroiro-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-store' }).then(res => {
    const ct = res.headers.get('content-type') || '';
    const okType = !/\.js$/.test(url.pathname) || !ct.includes('text/html');
    if (res.ok && okType) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request.mode === 'navigate' ? './' : e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request.mode === 'navigate' ? './' : e.request, { ignoreSearch: true })));
});
