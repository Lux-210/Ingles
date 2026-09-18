/* Bridge English — Service Worker
   Permite usar la app sin conexión a internet.
   Estrategia: cache-first para los recursos propios, network-first para el resto. */

/* Sube este número (v2, v3…) en cada despliegue nuevo: es lo que hace que
   los usuarios con la app ya instalada reciban la versión actualizada. */
const CACHE_NAME = 'bridge-english-v2';
const CORE_ASSETS = [
  './',
  './index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo manejamos peticiones GET
  if (req.method !== 'GET') return;

  // Nunca cachear las llamadas a la API de GitHub (sincronización en la nube)
  if (req.url.includes('api.github.com')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Actualiza en segundo plano
        fetch(req).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(req).then((res) => {
        // Cachea las respuestas exitosas (incluye las fuentes y scripts de CDN)
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Sin conexión y sin caché: si es una navegación, devolvemos el index
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});
