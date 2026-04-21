const CACHE_NAME = 'gozetmenlik-ai-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './logic.js',
    './ai_features.js',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('[Service Worker] Caching all assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
        .then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event (Network First, fallback to cache for dynamic PWA)
self.addEventListener('fetch', event => {
    if (event.request.url.startsWith(self.location.origin) || typeof event.request.url === 'string') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});
