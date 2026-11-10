const CACHE_NAME = 'gozetmenlik-ai-v64';

// Ortak bildirim kuralları (dokunma davranışı sitedeki ve sunucudaki bildirimlerle aynı dosyadan)
try { importScripts('./bildirim_kurallari.js?v=20261110b'); } catch (e) { /* aşağıdaki güvenli yedek kullanılır */ }

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './bildirim_kurallari.js',
    './style.css',
    './mobil.css',
    './tema_uyum.css',
    './tema.js',
    './final_forecast_engine.js',
    './mobil_tablo.js',
    './app.js',
    './atama_destek.js',
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
// Sitenin kendi dosyaları her seferinde sunucuyla doğrulanır (cache: 'no-cache'); GitHub Pages
// dosyaları 10 dk önbellekte tuttuğu için yeni sürüm yayınlandıktan sonra eski kod gelebiliyordu.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method === 'GET' && req.url.startsWith(self.location.origin)) {
        const fresh = req.mode === 'navigate'
            ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
            : fetch(new Request(req, { cache: 'no-cache' }));
        event.respondWith(fresh.catch(() => caches.match(req)));
        return;
    }
    event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// Push & Notification Click Event (PWA Bildirimine Dokunulduğunda Uygulamayı Açar)
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    // Ne yapılacağına ortak kural karar verir: süre teyidi penceresi YALNIZCA süre teyidi türünde açılır.
    // Kurallar yüklenemediyse güvenli yedek: yalnızca açık süre türü/eylemi pencere açar, varsayılan yoktur.
    const hedef = (self.BildirimKurallari && self.BildirimKurallari.tiklamaHedefi)
        ? self.BildirimKurallari.tiklamaHedefi(data)
        : (() => {
            const sure = data.tur ? (data.tur === 'sure_teyidi' || data.tur === 'sure_girisi')
                : (data.action === 'verify_duration' || data.action === 'input_duration');
            if (sure && data.examId) {
                return { sureEkrani: true, takasEkrani: false, examId: data.examId, step: data.step || ((data.tur === 'sure_girisi' || data.action === 'input_duration') ? 'input' : 'question'), url: data.url || './index.html' };
            }
            const isSwap = data.tur === 'swap_offer' || data.tur === 'swap_accepted' || data.action === 'open_swap' || data.action === 'open_swap_request' || data.tab === 'swap-history';
            if (isSwap) {
                const reqId = data.requestId || '';
                const baseUrl = (data.url || './index.html').split('?')[0];
                const swapUrl = reqId ? `${baseUrl}?tab=swap-history&requestId=${encodeURIComponent(reqId)}` : `${baseUrl}?tab=swap-history`;
                return { sureEkrani: false, takasEkrani: true, requestId: reqId, tab: 'swap-history', url: swapUrl };
            }
            return { sureEkrani: false, takasEkrani: false, url: data.url || './index.html' };
        })();
    const isDurationAction = hedef.sureEkrani;
    const isSwapAction = hedef.takasEkrani;
    const examId = hedef.examId;
    const step = hedef.step;
    const requestId = hedef.requestId;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Açık sekme varsa odaklan; süre teyidi veya takas bildirimiyse pencereyi açması için mesaj ilet
            for (let client of windowClients) {
                if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
                    if (isDurationAction && examId && 'postMessage' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_ACTION',
                            tur: data.tur || null,
                            action: step === 'input' ? 'input_duration' : 'verify_duration',
                            examId: examId,
                            step: step
                        });
                    } else if (isSwapAction && 'postMessage' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_ACTION',
                            tur: data.tur || 'swap_offer',
                            action: 'open_swap_request',
                            requestId: requestId,
                            tab: 'swap-history'
                        });
                    }
                    return client.focus();
                }
            }
            // Açık sekme yoksa hedef url ile aç
            const targetUrl = (isDurationAction && examId)
                ? `./index.html?verifyDurationExamId=${encodeURIComponent(examId)}&step=${encodeURIComponent(step)}`
                : hedef.url;
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
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
    const tag = payload.tag || 'gtu_broadcast';
    const options = {
        body: payload.body || payload.message,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: tag,
        renotify: true,
        data: Object.assign({ url: './index.html' }, payload.data || {})
    };
    // Aynı bildirim uygulama açıkken zaten gösterildiyse sessizce yerini al (ikinci kez titretme)
    event.waitUntil(
        self.registration.getNotifications({ tag: tag })
            .then(existing => { if (existing.length) options.renotify = false; })
            .catch(() => {})
            .then(() => self.registration.showNotification(payload.title, options))
    );
});
