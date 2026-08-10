// Nombre de la caché actual de la aplicación.
// Al cambiar esta versión, el bloque de activación eliminará cachés antiguas.
const CACHE_NAME = 'rechargeev-v3';

// Recursos básicos necesarios para que RechargeEV pueda abrirse sin conexión.
// Se usan rutas relativas para mantener compatibilidad con GitHub Pages.
const APP_SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación del Service Worker.
// Crea la caché principal y almacena los archivos esenciales de la PWA.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker.
// Elimina cualquier caché anterior para evitar servir recursos obsoletos.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

// Intercepta las peticiones de la aplicación.
// Solo se gestionan peticiones GET; otros métodos como POST, PUT, PATCH o DELETE
// no se cachean y se dejan pasar directamente a la red.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(networkFirst(request));
});

// Estrategia Network First.
// Primero intenta obtener el recurso desde la red. Si funciona, guarda una copia
// en caché. Si la red falla, devuelve la versión almacenada en caché si existe.
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}