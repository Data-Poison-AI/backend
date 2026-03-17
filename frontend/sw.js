// ============================================================
// PoisonAI Service Worker - PWA Support
// ============================================================

const CACHE_NAME = 'poisonai-v1';

// Recursos a cachear para funcionamiento offline
const STATIC_ASSETS = [
    '/html/index.html',
    '/html/login.html',
    '/html/scanner.html',
    '/html/docs.html',
    '/html/contacto.html',
    '/css/styles.css',
    '/js/index.js',
    '/js/login.js',
    '/js/scanner.js',
    '/js/docs.js',
    '/icons/icon.svg',
    '/manifest.json'
];

// ── INSTALL: pre-cachear recursos estáticos ──────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing PoisonAI Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            // Ignoramos fallos individuales para no bloquear la instalación
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(err => {
                    console.warn('[SW] Failed to cache:', url, err);
                }))
            );
        })
    );
    // Activar inmediatamente sin esperar a que se cierre la pestaña anterior
    self.skipWaiting();
});

// ── ACTIVATE: limpiar caches antiguas ───────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating PoisonAI Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Tomar control de todas las páginas abiertas
    self.clients.claim();
});

// ── FETCH: estrategia Network First con fallback a cache ─────
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') return;

    // No interceptar peticiones a CDNs externos (Tailwind, FontAwesome, etc.)
    const url = new URL(event.request.url);
    const isExternal = url.origin !== self.location.origin;
    if (isExternal) return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Si la respuesta es válida, actualizamos el cache
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Sin red → servir desde cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Fallback final para páginas HTML
                    if (event.request.destination === 'document') {
                        return caches.match('/html/index.html');
                    }
                });
            })
    );
});
