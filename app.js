/* ============================================================
   مولّد التطبيقات — المنطق الأمامي (نسخة نهائية نظيفة)
   ============================================================ */

// ⚙️ عند النشر: غيّر إلى رابط سيرفرك (مثل https://my-app.onrender.com)
const SERVER_URL = 'http://localhost:3000';

/* ------------------------------------------------------------
   عناصر الواجهة
   ------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const appNameInput    = $('appName');
const themeColorInput = $('themeColor');
const htmlCodeInput   = $('htmlCode');
const cssCodeInput    = $('cssCode');
const jsCodeInput     = $('jsCode');
const phoneHeader     = $('phoneHeader');
const previewTitle    = $('previewTitle');
const previewFrame    = $('previewFrame');
const btnPwa          = $('btnPwa');
const btnAndroid      = $('btnAndroid');

/* ------------------------------------------------------------
   أدوات مساعدة
   ------------------------------------------------------------ */

// تنظيف اسم الملف مع حد أقصى للطول
function safeFilename(name) {
    let cleaned = (name || 'app')
        .replace(/[\\/:*?"<>|\n\r\t]/g, '_')
        .trim();
    if (cleaned.length > 60) cleaned = cleaned.substring(0, 60);
    return cleaned || 'app';
}

// تقصير الاسم لـ short_name (12 حرف كحد آمن)
function toShortName(name, max = 12) {
    const t = (name || 'App').trim();
    return t.length <= max ? t : t.substring(0, max);
}

// تهريب النصوص المستخدمة داخل HTML (لمنع كسر المولَّد)
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------
   1. المعاينة الحية (Debounced)
   ------------------------------------------------------------ */
let previewTimer;

function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        const css = cssCodeInput.value;
        const js = jsCodeInput.value;
        const html = htmlCodeInput.value;
        const themeColor = themeColorInput.value;
        const appName = appNameInput.value || 'تطبيقي';

        phoneHeader.style.backgroundColor = themeColor;
        previewTitle.innerText = appName;

        previewFrame.srcdoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>${js}<\/script>
</body>
</html>`;
    }, 200);
}

document.querySelectorAll('textarea, input').forEach(el => {
    el.addEventListener('input', updatePreview);
});
updatePreview();

// ساعة حقيقية في شريط الهاتف
(function tick() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    phoneHeader.firstElementChild.textContent = `${hh}:${mm}`;
    setTimeout(tick, 30000);
})();

/* ------------------------------------------------------------
   2. توليد أيقونة PNG (Base64) على Canvas
   ------------------------------------------------------------ */
function generateIconBase64(size, text, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.floor(size * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letter = (text || 'A').trim().charAt(0).toUpperCase() || 'A';
    ctx.fillText(letter, size / 2, size / 2 + size * 0.03);

    return canvas.toDataURL('image/png').split(',')[1];
}

/* ------------------------------------------------------------
   3. توليد PWA كامل (ZIP)
   ------------------------------------------------------------ */
btnPwa.addEventListener('click', async () => {
    const originalText = btnPwa.textContent;
    btnPwa.disabled = true;
    btnPwa.textContent = '⏳ جاري التوليد...';

    try {
        const appName = appNameInput.value.trim() || 'تطبيقي';
        const themeColor = themeColorInput.value;
        const html = htmlCodeInput.value;
        const css = cssCodeInput.value;
        const js = jsCodeInput.value;

        const zip = new JSZip();
        const icon192 = generateIconBase64(192, appName, themeColor);
        const icon512 = generateIconBase64(512, appName, themeColor);

        /* --- manifest.json --- */
        const manifest = {
            name: appName,
            short_name: toShortName(appName),
            start_url: './index.html',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#ffffff',
            theme_color: themeColor,
            lang: 'ar',
            dir: 'rtl',
            icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
            ]
        };

        /* --- Service Worker (fallback آمن بدون undefined) --- */
        const swCode = `const CACHE_NAME = 'pwa-cache-v1';
const ASSETS = [
    './', './index.html', './style.css', './script.js',
    './manifest.json', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        try {
            const response = await fetch(event.request);
            if (response && response.status === 200 && response.type === 'basic') {
                const copy = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, copy))
                    .catch(() => {});
            }
            return response;
        } catch (err) {
            const fallback = await caches.match('./index.html');
            if (fallback) return fallback;

            return new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    })());
});
`;

        /* --- index.html النهائي (مع وسوم iOS) --- */
        const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${escapeHtml(appName)}</title>

<!-- PWA -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="${themeColor}">

<!-- iOS PWA -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(appName)}">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" type="image/png" href="icon-192.png">

<link rel="stylesheet" href="style.css">
</head>
<body>
${html}
<script src="script.js"><\/script>
<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch(err => console.warn('SW registration failed:', err));
    });
}
<\/script>
</body>
</html>`;

        /* --- إضافة الملفات --- */
        zip.file('index.html', fullHtml);
        zip.file('style.css', css);
        zip.file('script.js', js);
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('sw.js', swCode);
        zip.file('icon-192.png', icon192, { base64: true });
        zip.file('icon-512.png', icon512, { base64: true });

        /* --- README --- */
        zip.file('README.md', `# ${appName} — تطبيق PWA

## كيفية التشغيل

> ⚠️ ملفات PWA لا تعمل عند فتحها بـ \`file://\`. يجب نشرها على HTTPS.

### النشر (اختر أحد الخيارات)
1. **Netlify Drop** (الأسهل): افتح https://app.netlify.com/drop واسحب المجلد كاملاً.
2. **GitHub Pages**: ارفع الملفات على فرع \`gh-pages\`.
3. **Vercel**: نفّذ \`npx vercel\` داخل المجلد.

### التثبيت على الهاتف
- **Android (Chrome)**: ستظهر رسالة "إضافة إلى الشاشة الرئيسية".
- **iOS (Safari)**: زر المشاركة → "إضافة إلى الشاشة الرئيسية".

### الملفات
- \`index.html\` — الصفحة الرئيسية
- \`style.css\` — التنسيقات
- \`script.js\` — الأكواد
- \`manifest.json\` — بيانات التطبيق
- \`sw.js\` — Service Worker (وضع Offline)
- \`icon-192.png\` / \`icon-512.png\` — الأيقونات
`);

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        saveAs(blob, `${safeFilename(appName)}-PWA.zip`);
    } catch (err) {
        alert('فشل توليد ملف PWA:\n' + err.message);
    } finally {
        btnPwa.disabled = false;
        btnPwa.textContent = originalText;
    }
});

/* ------------------------------------------------------------
   4. طلب مشروع Android من السيرفر
   ------------------------------------------------------------ */
btnAndroid.addEventListener('click', async () => {
    // تحقق فعلي من إعداد الرابط
    if (!SERVER_URL || SERVER_URL.trim() === '') {
        alert('⚠️ لم يتم ضبط SERVER_URL في app.js\nافتح الملف وضع رابط السيرفر.');
        return;
    }

    const originalText = btnAndroid.textContent;
    btnAndroid.disabled = true;
    btnAndroid.textContent = '⏳ جاري التجهيز...';

    const appName = appNameInput.value.trim() || 'تطبيقي';

    const payload = {
        appName,
        themeColor: themeColorInput.value,
        html: htmlCodeInput.value,
        css: cssCodeInput.value,
        js: jsCodeInput.value
    };

    try {
        const response = await fetch(`${SERVER_URL}/generate-android`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const msg = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}${msg ? ' — ' + msg : ''}`);
        }

        const blob = await response.blob();

        if (blob.size < 500) {
            throw new Error('الملف المُستلم صغير جداً، تأكد من عمل السيرفر بشكل صحيح.');
        }

        saveAs(blob, `${safeFilename(appName)}-Android-Capacitor.zip`);
    } catch (err) {
        alert(
            'تعذر التواصل مع سيرفر Android:\n\n' + err.message +
            '\n\nتأكد من:\n' +
            '1) تشغيل السيرفر (npm start)\n' +
            '2) صحة SERVER_URL في app.js\n' +
            '3) عدم حجب الطلب من المتصفح (CORS)'
        );
    } finally {
        btnAndroid.disabled = false;
        btnAndroid.textContent = originalText;
    }
});
