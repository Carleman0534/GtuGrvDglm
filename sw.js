const CACHE_NAME = 'gozetmenlik-ai-v39';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './logic.js',
    './auth_google.js',
    './veri_koruma.js',
    './swap_email.js',
    './swap_market.js',
    './smart_doc_parser.js',
    './notification_engine.js',
    './mobile_app_engine.js',
    './ai_features.js',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
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

// Push & Notification Click Event (PWA Bildirimine Dokunulduğunda Uygulamayı Açar)
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Açık sekme varsa odaklan
            for (let client of windowClients) {
                if (client.url.includes('index.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Açık sekme yoksa yeni pencerede aç
            if (clients.openWindow) {
                return clients.openWindow('./index.html');
            }
        })
    );
});

// Web Push Event (Arka Planda veya Telefon Kapalıyken Gelen Bildirimler)
self.addEventListener('push', event => {
    let payload = {
        title: '📢 GTÜ Gözetmenlik Bildirimi',
        body: 'Yeni bir duyuru veya sınav görevi güncellemesi yayınlandı.'
    };
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }
    }
    const options = {
        body: payload.body || payload.message,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: payload.tag || 'gtu_broadcast',
        renotify: true,
        data: Object.assign({ url: './index.html' }, payload.data || {})
    };
    event.waitUntil(self.registration.showNotification(payload.title, options));
});
