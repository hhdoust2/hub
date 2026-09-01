// سرویس‌ورکر PWA — «پوسته‌ی اپ» رو کش می‌کنه تا بعد از یک بار باز شدن،
// حتی بدون اینترنت هم بالا بیاد. لینک‌های خودِ کاربر توی localStorage
// ذخیره می‌شن (نه این‌جا)، پس آفلاین‌بودن روی داده‌ها اثری نداره.
//
// استراتژی کش عمداً «network-first»ه (نه cache-first): هر بار اول از
// خودِ سرور می‌خونه و کش رو فقط به‌عنوان fallback برای حالت آفلاین نگه
// می‌داره. دلیلش: اگه بعداً این فایل‌ها آپدیت بشن، cache-first باعث می‌شد
// گوشیِ کاربر همچنان نسخه‌ی قدیمی رو اجرا کنه.

// هر بار تغییر محسوسی توی فایل‌های اپ دادید، این نسخه رو دستی بالا ببرید
// تا کشِ قدیمی به‌طور کامل پاک بشه.
const CACHE_VERSION = 'jelly-links-shell-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
            // اگه یکی از فایل‌ها موقتاً در دسترس نبود، نصب سرویس‌ورکر نباید
            // کلاً fail بشه.
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // فقط درخواست‌های GET هم‌مبدأ رو مدیریت می‌کنیم؛ فونت‌های خارجی
    // (Google Fonts) و بقیه دست‌نخورده به شبکه می‌رن.
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    const freshRequest = new Request(event.request, { cache: 'no-store' });

    event.respondWith(
        fetch(freshRequest)
            .then((res) => {
                if (res && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(event.request).then((res) => res || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
});
