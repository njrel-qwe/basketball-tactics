// Офлайн-работа: файлы приложения кэшируются при установке.
// При изменении файлов увеличьте VERSION, чтобы телефоны получили обновление.
const VERSION = 'v1';
const CACHE = `tacticboard-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/editor.js',
  'js/exporter.js',
  'js/geometry.js',
  'js/model.js',
  'js/playbook.js',
  'js/player.js',
  'js/render.js',
  'js/share.js',
  'js/storage.js',
  'js/ui.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Сначала сеть (чтобы сразу видеть обновления), но не дольше 3 секунд — затем кэш.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    });
    if (!cached) return network.catch(() => caches.match('index.html'));
    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 3000));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});
