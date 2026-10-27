const CACHE = 'mygoals-shell-v3';
const ASSETS = ['./', './index.html', './css/base.css', './css/components.css', './css/pages.css', './js/util.js', './js/dates.js', './js/icons.js', './js/schema.js', './js/storage.js', './js/habits.js', './js/tasks.js', './js/gamification.js', './js/calendar.js', './js/backup.js', './js/actions.js', './js/views.js', './js/sheets.js', './js/app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match('./index.html'))));
});
