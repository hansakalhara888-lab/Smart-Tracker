const CACHE_NAME = 'smarttracker-pwa-v5';
const RUNTIME_CACHE = 'smarttracker-runtime-v2';

const APP_SHELL = [
    './',
    './login.html',
    './index.html',
    './transactions.html',
    './savings.html',
    './planning.html',
    './reports.html',
    './report-detail.html',
    './calendar.html',
    './account.html',
    './manifest.json',
    './css/main.css',
    './css/login.css',
    './css/dashboard.css',
    './css/transactions.css',
    './css/savings.css',
    './css/planning.css',
    './css/reports.css',
    './css/report-detail.css',
    './css/calendar.css',
    './css/account.css',
    './css/features.css',
    './js/firebase-config.js',
    './js/firebase-init.js',
    './js/main.js',
    './js/login.js',
    './js/dashboard.js',
    './js/transactions.js',
    './js/savings.js',
    './js/planning.js',
    './js/reports.js',
    './js/report-detail.js',
    './js/calendar.js',
    './js/account.js',
    './images/logo 2.png',
    './images/footer logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    // Cache external JavaScript/CSS libraries after the first successful load.
    // This helps the installed desktop/mobile PWA reopen with its UI libraries
    // available even if the connection temporarily drops. Firebase API/data
    // requests are not cached here.
    if (url.origin !== self.location.origin) {
        if (request.destination === 'script' || request.destination === 'style') {
            event.respondWith(
                caches.open(RUNTIME_CACHE).then(async cache => {
                    const cached = await cache.match(request);
                    if (cached) return cached;
                    const response = await fetch(request);
                    try { await cache.put(request, response.clone()); } catch (_) {}
                    return response;
                })
            );
        }
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(async () => {
                    return (await caches.match(request)) || (await caches.match('./login.html'));
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                return cached;
            }
            return fetch(request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});
