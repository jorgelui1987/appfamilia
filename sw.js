'use strict';
/* MiFamilia Service Worker: cachea la app para instalarla y usarla offline. */
var CACHE = 'mifamilia-v8';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/store.js',
  './js/api.js',
  './js/app.js',
  './js/extras.js',
  './js/extras2.js',
  './js/extras3.js',
  './js/chat.js',
  './js/forms.js',
  './js/auth.js',
  './js/backend.js',
  './js/pwa.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  var isCore = CORE.some(function (p) {
    var name = p.replace('./', '');
    return url.pathname.endsWith('/' + name) || url.pathname === '/' || url.pathname.endsWith('index.html');
  });
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var go = fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      // HTML y JS: red primero para que la PWA siempre tome la version nueva.
      if (isCore) return go;
      return hit || go;
    })
  );
});
