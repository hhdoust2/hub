// سرویس‌ورکر PWA — «پوسته‌ی اپ» (HTML/CSS/JS/آیکون‌ها) رو کش می‌کنه تا اپ حتی
// بدون اینترنت هم بالا بیاد.
//
// نکته‌ی مهم درباره‌ی استراتژی کش: عمداً «network-first» انتخاب شده (نه
// cache-first) — یعنی هر بار اول از خودِ سرور می‌خونه و کش رو فقط به‌عنوان
// fallback برای حالت آفلاین نگه می‌داره. دلیلش: چون این اپ مدام آپدیت می‌شه،
// cache-first باعث می‌شد بعد از هر دیپلوی جدید، گوشیِ کاربر همچنان نسخه‌ی
// قدیمیِ کش‌شده‌ی JS رو اجرا کنه (و دکمه‌های تازه‌اضافه‌شده بی‌واکنش بمونن) —
// این باگ دقیقاً همینه که این فایل داره حلش می‌کنه.
//
// نکته‌ی امنیتی/عملکردیِ دیگه: مسیرهای API (/chat-ai، /search-web،
// /generate-image) هرگز کش یا رهگیری نمی‌شن — چون پاسخ چت به‌صورت استریم
// (SSE) میاد و هر پیام حاوی کلید API و محتوای خصوصیِ کاربره؛ این مسیرها باید
// همیشه مستقیم به شبکه برن.

// هر بار که تغییر محسوسی توی فایل‌های اپ می‌دیم، این نسخه رو دستی بالا
// می‌بریم تا کشِ قدیمی به‌طور کامل پاک بشه (نه فقط بازنویسیِ تدریجی).
const CACHE_VERSION = 'aichat-shell-v3';
const APP_SHELL = [
    '/',
    '/index.html',
    
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];



self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
            // اگه یکی از فایل‌ها موقتاً در دسترس نبود، نصب سرویس‌ورکر نباید
            // کلاً fail بشه.
        })
    );
    // فوراً جایگزینِ سرویس‌ورکر قبلی می‌شه، بدون منتظرموندن برای بسته‌شدنِ
    // تمام تب‌های بازِ اپ.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        )
    );
    // کنترل تمام تب‌های بازِ اپ رو فوراً به‌دست می‌گیره (به‌جای اینکه فقط
    // بارگذاری‌های بعدی رو کنترل کنه) — همراه با کدِ controllerchange توی
    // main.js، همین باعث می‌شه تب‌های بازِ قدیمی هم خودکار رفرش بشن.
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // فقط درخواست‌های GET هم‌مبدأ رو مدیریت می‌کنیم؛ بقیه (POST، CDNهای
    // خارجی، مسیرهای زنده‌ی بالا) دست‌نخورده به شبکه می‌رن.
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (NEVER_INTERCEPT.some((p) => url.pathname.startsWith(p))) return;

    // Network-first برای همه‌ی فایل‌های پوسته‌ی اپ (HTML/CSS/JS/آیکون): اول
    // از سرور می‌خونه (همیشه آخرین نسخه)، و فقط وقتی آفلاینه یا شبکه خطا داد
    // می‌ره سراغ کش.
    //
    // نکته‌ی مهم: علاوه بر کشِ خودِ سرویس‌ورکر (که بالا مدیریتش می‌کنیم)، خودِ
    // مرورگر هم یه HTTP cache جداگانه داره که می‌تونه به fetch() زیر جواب
    // کهنه بده، حتی وقتی این کد صریحاً از شبکه می‌خواد بخونه. برای همین با
    // { cache: 'no-store' } دقیقاً همون HTTP cache مرورگر رو هم دور می‌زنیم —
    // این باعث می‌شه بعد از هر دیپلوی، همون بار اول (بدون نیاز به پاک‌کردنِ
    // دستیِ کش) آخرین نسخه بیاد.
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
            .catch(() => caches.match(event.request).then((res) => res || (event.request.mode === 'navigate' ? caches.match('/index.html') : undefined)))
    );
});
