// Definimos el nombre y la versión de nuestro caché
const CACHE_NAME = 'iflow-pro-cache-v1';

// Listamos los archivos y recursos que queremos cachear
// IMPORTANTE: Añadimos index.html (landing) y app.html (la aplicación)
const assetsToCache = [
    '/',
    '/index.html',
    '/app.html',
    '/manifest.json',
    '/js/main.js',
    '/js/api.js',
    '/js/auth.js',
    '/js/events.js',
    '/js/firebase-config.js',
    '/js/state.js',
    '/js/ui.js',
    '/icon-192x192.png',
    '/icon-512x512.png',
    // URLs externas que también queremos cachear para que funcionen offline
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Evento 'install': se dispara cuando el Service Worker se instala
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  // Esperamos a que la promesa de abrir el caché y añadir los assets se resuelva
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache abierto. Cacheando archivos iniciales...');
        return cache.addAll(assetsToCache);
      })
      .then(() => {
        console.log('[SW] Todos los assets fueron cacheados exitosamente.');
        // Forzamos al nuevo Service Worker a activarse inmediatamente
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Falló el cacheo de archivos durante la instalación:', error);
      })
  );
});

// Evento 'activate': se dispara cuando el Service Worker se activa
// Se usa para limpiar cachés antiguos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Limpiando caché antiguo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Toma el control de las páginas abiertas inmediatamente
    return self.clients.claim();
});


// Evento 'fetch': se dispara cada vez que la aplicación solicita un recurso (una imagen, un script, una página, etc.)
self.addEventListener('fetch', (event) => {
    // Usamos una estrategia "Cache First" (Primero caché)
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Si encontramos una respuesta en el caché, la devolvemos
                if (response) {
                    // console.log(`[SW] Sirviendo desde caché: ${event.request.url}`);
                    return response;
                }
                // Si no, vamos a la red a buscarlo
                // console.log(`[SW] Buscando en la red: ${event.request.url}`);
                return fetch(event.request);
            })
            .catch(error => {
                console.error(`[SW] Error en el fetch: ${error}`);
                // Podríamos devolver una página de fallback offline aquí si quisiéramos
            })
    );
});
