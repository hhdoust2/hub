// سرویس‌ورکر PWA — پوسته‌ی اپ (index.html + مانیفست + فایل‌های ثابت خارجی مثل
// فونت/آیکون/بوت‌استرپ) رو کش می‌کنه تا اپ حتی بدون اینترنت هم بالا بیاد.
//
// استراتژی «خودآپدیت»: برای خودِ صفحه، همیشه اول از سرور می‌خونیم
// (network-first)، نه cache-first — یعنی هر بار که کاربر اپ رو باز می‌کنه یا
// سرویس‌ورکر آپدیت رو تشخیص می‌ده، آخرین نسخه رو می‌گیره و خودکار جایگزین
// می‌کنه (با کمک منطق skipWaiting/controllerchange که توی index.html هم
// هست). کش فقط به‌عنوان fallback برای حالت آفلاین نگه داشته می‌شه.

// هر بار تغییر محسوسی توی فایل‌های اپ دادید، این نسخه رو بالا ببرید تا کش
// قدیمی به‌طور کامل پاک بشه.
const CACHE_VERSION = 'api-manager-shell-v3';

// پوسته‌ی اصلی اپ. چون این پروژه تک‌فایلیه، CSS و JS همگی داخل خودِ
// index.html هستن؛ چیز جداگانه‌ای برای کش کردن نیست.
const APP_SHELL = ['./', './index.html', './manifest.json'];

// فایل‌های ثابت خارجی (فونت/آیکون/کتابخانه) که کمتر عوض می‌شن؛ این‌ها رو
// cache-first با به‌روزرسانی در پس‌زمینه سرو می‌کنیم چون سرعت مهم‌تره.
const STATIC_ASSETS = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600;700&display=swap',
    'https://cdn-icons-png.flaticon.com/512/1041/1041886.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.addAll([...APP_SHELL, ...STATIC_ASSETS]).catch(() => {
                // اگه یکی از فایل‌های خارجی موقتاً در دسترس نبود، نصب سرویس‌ورکر
                // نباید کلاً fail بشه.
            })
        )
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
    const req = event.request;

    // فقط درخواست‌های GET رو کنترل کن؛ بقیه (مثل POST به API سرویس‌ها)
    // همیشه مستقیم به شبکه برن.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isAppShell =
        req.mode === 'navigate' ||
        url.pathname.endsWith('/index.html') ||
        url.pathname.endsWith('/manifest.json') ||
        url.pathname === '/';

    if (isAppShell) {
        // Network-first: همیشه اول شبکه، تا هم محتوا همیشه تازه باشه و هم
        // سرویس‌ورکر بفهمه نسخه‌ی جدیدی منتشر شده. فقط وقتی آفلاینی یا شبکه
        // خطا داد، سراغ کش می‌ریم.
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
                    return res;
                })
                .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
        );
        return;
    }

    // بقیه‌ی فایل‌های ثابت (فونت/CSS/JS خارجی/آیکون): کش-اول برای سرعت،
    // با به‌روزرسانیِ کش در پس‌زمینه (stale-while-revalidate).
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});

// اجازه می‌ده صفحه با postMessage به سرویس‌ورکرِ در حال انتظار بگه فوراً
// فعال بشه (بدون این‌که کاربر مجبور باشه همه‌ی تب‌های باز رو ببنده).
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
