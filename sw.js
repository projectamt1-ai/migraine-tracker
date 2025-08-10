/* sw.js
 *
 * Service worker for AI Migraine Tracker. It caches the application shell
 * to enable offline use. Dynamic data is stored in localStorage so
 * there's no need to cache API calls. The cache is limited in size
 * implicitly by listing only necessary resources.
 */

const CACHE_NAME = 'migraine-cache-v1';
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './assets/style.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './src/main.js',
  './src/app.js',
  './src/ui.js',
  './src/storage.js',
  './src/patterns.js',
  './src/charts.js',
  './src/reminders.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // remove old caches
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // only handle GET requests
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        // fallback to index.html for navigation requests when offline
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});