/* ==========================================
   مولّد التطبيقات — المنطق الكامل
   ========================================== */

// ===== المتغيرات العامة =====
let iconMode = 'upload';
let currentIconBlob = null;
let lastPreviewIconUrl = null;
let previewTimeout = null;

// ===== اختصار للعناصر =====
const el = (id) => document.getElementById(id);

// ===== عناصر الصفحة =====
const appNameInput   = el('appName');
const appShortInput  = el('appShortName');
const themeColorIn   = el('themeColor');
const bgColorIn      = el('bgColor');
const iconFileIn     = el('iconFile');
const iconTextIn     = el('iconText');
const iconColor2In   = el('iconColor2');
const iconPreview    = el('iconPreview');
const htmlCodeIn     = el('htmlCode');
const cssCodeIn      = el('cssCode');
const jsCodeIn       = el('jsCode');
const generateBtn    = el('generateBtn');
const statusEl       = el('status');

// عناصر المعاينة
const livePreview    = el('livePreview');
const phoneStatusbar = el('phoneStatusbar');
const infoName       = el('infoName');
const infoTheme      = el('infoTheme');
const infoThemeDot   = el('infoThemeDot');

// الميزات
const featSplash  = el('featSplash');
const featDark    = el('featDark');
const featStorage = el('featStorage');

/* ==========================================
   أدوات مساعدة عامة
   ========================================== */

/**
 * تهريب النصوص لمنع كسر HTML
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * تنظيف اسم الملف
 */
function sanitizeFileName(name) {
  return String(name)
    .replace(/[^\w\u0600-\u06FF-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'app';
}

/**
 * تحويل حجم البايت إلى نص مقروء
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* ==========================================
   1. التبويبات
   ========================================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    el('tab-' + tab.dataset.tab).classList.add('active');
    iconMode = tab.dataset.tab;
    updateIcon();
  });
});

/* ==========================================
   2. تغيير حجم الصورة (يدعم الشفافية)
   ========================================== */
function resizeImage(blobOrFile, size = 512, preserveAlpha = true) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // قصّ الصورة لمربع من المنتصف
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;

          if (!preserveAlpha) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
          }

          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('فشل توليد الصورة'));
            },
            'image/png',
            0.95
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(blobOrFile);
  });
}

/* ==========================================
   3. توليد أيقونة من نص
   ========================================== */
function generateIconFromText(text, color1, color2, size = 512) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // خلفية متدرجة
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // النص
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.floor(size * 0.55) + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(text || '؟').charAt(0), size / 2, size / 2 + size * 0.05);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('فشل توليد الأيقونة'));
        },
        'image/png',
        0.95
      );
    } catch (err) {
      reject(err);
    }
  });
}

/* ==========================================
   4. تحديث معاينة الأيقونة
   ========================================== */
async function updateIcon() {
  try {
    let blob;

    if (iconMode === 'upload') {
      const file = iconFileIn.files[0];
      if (!file) {
        blob = await generateIconFromText(
          appShortInput.value || 'ت',
          themeColorIn.value,
          iconColor2In.value,
          128
        );
      } else {
        blob = await resizeImage(file, 128, true);
      }
    } else {
      blob = await generateIconFromText(
        iconTextIn.value || 'ت',
        themeColorIn.value,
        iconColor2In.value,
        128
      );
    }

    // إلغاء الـ URL السابق لمنع تسريب الذاكرة
    if (lastPreviewIconUrl) {
      URL.revokeObjectURL(lastPreviewIconUrl);
    }
    lastPreviewIconUrl = URL.createObjectURL(blob);

    iconPreview.src = lastPreviewIconUrl;
    currentIconBlob = blob;
  } catch (err) {
    console.error('خطأ في معاينة الأيقونة:', err);
  }
}

/* ==========================================
   5. بناء الشاشة الافتتاحية
   ========================================== */
function buildSplashCss(themeColor) {
  return `
    #__splash {
      position: fixed; inset: 0;
      background: linear-gradient(135deg, ${themeColor}, #9333EA);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: white; z-index: 99999;
      font-family: Arial, sans-serif;
      transition: opacity 0.5s ease;
    }
    #__splash img {
      width: 100px; height: 100px; border-radius: 22px;
      margin-bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    #__splash h1 { font-size: 1.5rem; margin: 0; }
    #__splash.__hidden { opacity: 0; pointer-events: none; }
  `;
}

function buildSplashHtml(iconSrc, appName) {
  return '<div id="__splash">' +
    '<img src="' + escapeHtml(iconSrc) + '" alt="">' +
    '<h1>' + escapeHtml(appName) + '</h1>' +
    '</div>';
}

/* ==========================================
   6. بناء الوضع الداكن التلقائي
   ========================================== */
function buildDarkModeCss() {
  return `
    @media (prefers-color-scheme: dark) {
      html, body { background: #1a1a1a !important; color: #f0f0f0 !important; }
      a { color: #818cf8 !important; }
      button { background: #6366f1 !important; color: white !important; }
      input, textarea, select {
        background: #2a2a2a !important;
        color: white !important;
        border-color: #444 !important;
      }
      hr { border-color: #333 !important; }
    }
  `;
}

/* ==========================================
   7. بناء كود Storage Helper
   ========================================== */
function buildStorageJs() {
  return `
// 💾 Storage Helper — يوفر حفظاً سهلاً في localStorage
window.Storage = {
  save: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { console.error('Storage.save error:', e); return false; }
  },
  load: function (key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : (fallback !== undefined ? fallback : null);
    } catch (e) { console.error('Storage.load error:', e); return fallback; }
  },
  remove: function (key) { localStorage.removeItem(key); },
  clear: function () { localStorage.clear(); }
};
console.log('💾 Storage helper ready: use Storage.save / Storage.load');
`;
}

/* ==========================================
   8. المعاينة الحية
   ========================================== */
function updateLivePreview() {
  clearTimeout(previewTimeout);

  previewTimeout = setTimeout(() => {
    try {
      const appName    = appNameInput.value.trim() || 'تطبيقي';
      const themeColor = themeColorIn.value;
      const bgColor    = bgColorIn.value;

      // بناء الأجزاء الإضافية
      let extraHead = '';
      let extraBody = '';
      let extraScript = '';

      if (featDark.checked) {
        extraHead += '<style>' + buildDarkModeCss() + '</style>';
      }

      if (featSplash.checked) {
        extraHead += '<style>' + buildSplashCss(themeColor) + '</style>';
        // في المعاينة نستخدم صورة الأيقونة المؤقتة
        extraBody += buildSplashHtml(lastPreviewIconUrl || '', appName);
        extraScript += `
          setTimeout(function () {
            var s = document.getElementById('__splash');
            if (s) {
              s.classList.add('__hidden');
              setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 600);
            }
          }, 2000);
        `;
      }

      if (featStorage.checked) {
        extraScript += buildStorageJs();
      }

      const fullDoc =
        '<!DOCTYPE html>' +
        '<html lang="ar" dir="rtl">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<meta name="theme-color" content="' + themeColor + '">' +
        '<style>' +
        'html, body { margin: 0; padding: 0; background: ' + bgColor + '; }' +
        cssCodeIn.value +
        '</style>' +
        extraHead +
        '</head>' +
        '<body>' +
        extraBody +
        htmlCodeIn.value +
        '<script>' + extraScript + '<\/script>' +
        '<script>' + jsCodeIn.value + '<\/script>' +
        '</body>' +
        '</html>';

      livePreview.srcdoc = fullDoc;

      // تحديث شريط الحالة بلون الثيم
      phoneStatusbar.style.background = themeColor;

      // تحديث معلومات المعاينة
      infoName.textContent = appName;
      infoTheme.textContent = themeColor;
      infoThemeDot.style.background = themeColor;
    } catch (err) {
      console.error('خطأ في المعاينة:', err);
    }
  }, 300);
}

/* ==========================================
   9. بناء ملفات التطبيق النهائي
   ========================================== */

/**
 * بناء index.html للتطبيق النهائي
 */
function buildFullHtml(appName, themeColor, bgColor) {
  const safeName = escapeHtml(appName);

  let splashBody = '';
  if (featSplash.checked) {
    splashBody = buildSplashHtml('icon-192.png', appName) + '\n  ';
  }

  return '<!DOCTYPE html>\n' +
    '<html lang="ar" dir="rtl">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
    '  <meta name="theme-color" content="' + themeColor + '">\n' +
    '  <meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '  <meta name="apple-mobile-web-app-status-bar-style" content="default">\n' +
    '  <meta name="apple-mobile-web-app-title" content="' + safeName + '">\n' +
    '  <meta name="description" content="تطبيق ' + safeName + '">\n' +
    '  <link rel="manifest" href="manifest.json">\n' +
    '  <link rel="apple-touch-icon" href="icon-192.png">\n' +
    '  <link rel="icon" type="image/png" href="icon-192.png">\n' +
    '  <link rel="stylesheet" href="style.css">\n' +
    '  <title>' + safeName + '</title>\n' +
    '</head>\n' +
    '<body>\n' +
    '  ' + splashBody + htmlCodeIn.value + '\n' +
    '  <script src="script.js" defer><\/script>\n' +
    '  <script>\n' +
    '    if (\'serviceWorker\' in navigator) {\n' +
    '      window.addEventListener(\'load\', function () {\n' +
    '        navigator.serviceWorker.register(\'service-worker.js\')\n' +
    '          .then(function () { console.log(\'✅ Service Worker مسجّل\'); })\n' +
    '          .catch(function (err) { console.log(\'❌ SW error:\', err); });\n' +
    '      });\n' +
    '    }\n' +
    '  <\/script>\n' +
    '</body>\n' +
    '</html>';
}

/**
 * بناء style.css للتطبيق النهائي (كود المستخدم + الميزات)
 */
function buildFullCss(userCss) {
  let output = '/* ===== كود المستخدم ===== */\n';
  output += userCss + '\n\n';

  if (featDark.checked) {
    output += '/* ===== الوضع الداكن التلقائي ===== */\n';
    output += buildDarkModeCss() + '\n\n';
  }

  if (featSplash.checked) {
    output += '/* ===== الشاشة الافتتاحية ===== */\n';
    output += buildSplashCss(themeColorIn.value) + '\n';
  }

  return output;
}

/**
 * بناء script.js للتطبيق النهائي (كود المستخدم + الميزات)
 */
function buildFullJs(userJs, appName) {
  let output = '/* ===== مولّد التطبيقات: ' + appName + ' ===== */\n\n';

  if (featStorage.checked) {
    output += '/* ===== Storage Helper ===== */\n';
    output += buildStorageJs() + '\n';
  }

  if (featSplash.checked) {
    output += '/* ===== إخفاء الشاشة الافتتاحية تلقائياً ===== */\n';
    output += 'window.addEventListener(\'load\', function () {\n';
    output += '  setTimeout(function () {\n';
    output += '    var s = document.getElementById(\'__splash\');\n';
    output += '    if (s) {\n';
    output += '      s.classList.add(\'__hidden\');\n';
    output += '      setTimeout(function () {\n';
    output += '        if (s.parentNode) s.parentNode.removeChild(s);\n';
    output += '      }, 600);\n';
    output += '    }\n';
    output += '  }, 2000);\n';
    output += '});\n\n';
  }

  output += '/* ===== كود المستخدم ===== */\n';
  output += userJs;

  return output;
}

/**
 * بناء Service Worker
 */
function buildServiceWorker() {
  return 'const CACHE_NAME = \'app-cache-v1\';\n' +
    'const FILES_TO_CACHE = [\n' +
    '  \'./\',\n' +
    '  \'./index.html\',\n' +
    '  \'./style.css\',\n' +
    '  \'./script.js\',\n' +
    '  \'./manifest.json\',\n' +
    '  \'./icon-48.png\',\n' +
    '  \'./icon-72.png\',\n' +
    '  \'./icon-96.png\',\n' +
    '  \'./icon-144.png\',\n' +
    '  \'./icon-192.png\',\n' +
    '  \'./icon-512.png\'\n' +
    '];\n\n' +
    'self.addEventListener(\'install\', function (event) {\n' +
    '  event.waitUntil(\n' +
    '    caches.open(CACHE_NAME).then(function (cache) {\n' +
    '      return cache.addAll(FILES_TO_CACHE);\n' +
    '    })\n' +
    '  );\n' +
    '  self.skipWaiting();\n' +
    '});\n\n' +
    'self.addEventListener(\'activate\', function (event) {\n' +
    '  event.waitUntil(\n' +
    '    caches.keys().then(function (keys) {\n' +
    '      return Promise.all(\n' +
    '        keys.filter(function (k) { return k !== CACHE_NAME; })\n' +
    '            .map(function (k) { return caches.delete(k); })\n' +
    '      );\n' +
    '    })\n' +
    '  );\n' +
    '  self.clients.claim();\n' +
    '});\n\n' +
    'self.addEventListener(\'fetch\', function (event) {\n' +
    '  event.respondWith(\n' +
    '    caches.match(event.request).then(function (response) {\n' +
    '      return response || fetch(event.request).catch(function () {\n' +
    '        return caches.match(\'./index.html\');\n' +
    '      });\n' +
    '    })\n' +
    '  );\n' +
    '});';
}

/**
 * بناء README
 */
function buildReadme(appName) {
  return '# 📱 ' + appName + '\n\n' +
    'تطبيق PWA تم توليده بواسطة **مولّد التطبيقات**\n\n' +
    '---\n\n' +
    '## 🚀 كيفية النشر على GitHub Pages\n\n' +
    '### الخطوة 1: أنشئ مستودعاً جديداً\n' +
    '- اذهب إلى https://github.com/new\n' +
    '- اختر اسماً (مثلاً: `my-app`)\n' +
    '- اجعله **Public**\n' +
    '- اضغط **Create repository**\n\n' +
    '### الخطوة 2: ارفع الملفات\n' +
    '- اضغط **uploading an existing file**\n' +
    '- اسحب **جميع الملفات** من هذا المجلد\n' +
    '- اضغط **Commit changes**\n\n' +
    '### الخطوة 3: فعّل GitHub Pages\n' +
    '- اذهب إلى **Settings** → **Pages**\n' +
    '- تحت **Source** اختر **Deploy from a branch**\n' +
    '- اختر **main** ثم **/ (root)**\n' +
    '- اضغط **Save**\n\n' +
    '### الخطوة 4: انتظر دقيقة\n' +
    'سيظهر رابط مثل:\n' +
    '```\nhttps://username.github.io/my-app/\n```\n\n' +
    '---\n\n' +
    '## 📲 كيفية التثبيت على الجوال\n\n' +
    '### على Android (Chrome):\n' +
    '1. افتح الرابط\n' +
    '2. اضغط القائمة (⋮)\n' +
    '3. اختر **إضافة إلى الشاشة الرئيسية**\n' +
    '4. اضغط **تثبيت**\n\n' +
    '### على iPhone (Safari):\n' +
    '1. افتح الرابط\n' +
    '2. اضغط زر المشاركة (□↑)\n' +
    '3. اختر **إضافة إلى الشاشة الرئيسية**\n' +
    '4. اضغط **إضافة**\n\n' +
    '---\n\n' +
    '## 📁 محتويات المجلد\n\n' +
    '- `index.html` — الصفحة الرئيسية\n' +
    '- `style.css` — التنسيقات\n' +
    '- `script.js` — الأكواد\n' +
    '- `manifest.json` — هوية التطبيق\n' +
    '- `service-worker.js` — للعمل بدون إنترنت\n' +
    '- `icon-*.png` — أيقونات بأحجام مختلفة\n' +
    '- `README.md` — هذا الملف\n\n' +
    '---\n\n' +
    'استمتع بتطبيقك! 🎉';
}

/* ==========================================
   10. توليد جميع أحجام الأيقونات
   ========================================== */
async function generateAllIconSizes(sourceBlob) {
  const sizes = [48, 72, 96, 144, 192, 512];
  const result = {};

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    result[size] = await resizeImage(sourceBlob, size, true);
  }
  return result;
}

/* ==========================================
   11. الدالة الرئيسية: توليد ZIP كامل
   ========================================== */
async function generateApp() {
  try {
    const appName    = appNameInput.value.trim() || 'تطبيقي';
    const shortName  = appShortInput.value.trim() || appName.slice(0, 12);
    const themeColor = themeColorIn.value;
    const bgColor    = bgColorIn.value;

    statusEl.className = 'loading';
    statusEl.textContent = '⏳ جارٍ التوليد...';
    generateBtn.disabled = true;

    // ===== 1. تجهيز الأيقونة الأصلية بحجم 512 =====
    let originalIcon;
    if (iconMode === 'upload' && iconFileIn.files[0]) {
      originalIcon = await resizeImage(iconFileIn.files[0], 512, true);
    } else {
      originalIcon = await generateIconFromText(
        iconTextIn.value || shortName.charAt(0) || 'ت',
        themeColor,
        iconColor2In.value,
        512
      );
    }

    // ===== 2. توليد كل أحجام الأيقونات =====
    statusEl.textContent = '⏳ جارٍ توليد الأيقونات...';
    const icons = await generateAllIconSizes(originalIcon);

    // ===== 3. تجميع ملفات ZIP =====
    statusEl.textContent = '⏳ جارٍ تجميع الملفات...';
    const zip = new JSZip();

    // --- index.html ---
    zip.file('index.html', buildFullHtml(appName, themeColor, bgColor));

    // --- style.css ---
    zip.file('style.css', buildFullCss(cssCodeIn.value));

    // --- script.js ---
    zip.file('script.js', buildFullJs(jsCodeIn.value, appName));

    // --- manifest.json ---
    const manifest = {
      name: appName,
      short_name: shortName,
      description: 'تطبيق ' + appName,
      start_url: './index.html',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: bgColor,
      theme_color: themeColor,
      lang: 'ar',
      dir: 'rtl',
      icons: [
        { src: 'icon-48.png',  sizes: '48x48',   type: 'image/png' },
        { src: 'icon-72.png',  sizes: '72x72',   type: 'image/png' },
        { src: 'icon-96.png',  sizes: '96x96',   type: 'image/png' },
        { src: 'icon-144.png', sizes: '144x144', type: 'image/png' },
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // --- service-worker.js ---
    zip.file('service-worker.js', buildServiceWorker());

    // --- أيقونات PNG ---
    const sizeKeys = Object.keys(icons);
    for (let i = 0; i < sizeKeys.length; i++) {
      const size = sizeKeys[i];
      zip.file('icon-' + size + '.png', icons[size]);
    }

    // --- README.md ---
    zip.file('README.md', buildReadme(appName));

    // ===== 4. إنشاء ملف ZIP النهائي =====
    statusEl.textContent = '⏳ جارٍ ضغط الملفات...';
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // ===== 5. تحميل الملف =====
    const fileName = 'app-' + sanitizeFileName(appName) + '.zip';
    saveAs(blob, fileName);

    statusEl.className = 'success';
    statusEl.innerHTML =
      '✅ تم التوليد بنجاح! (' + formatBytes(blob.size) + ')<br>' +
      '<small style="font-weight:normal;color:#6b7280">' +
      'افتح الملف المضغوط واقرأ README.md لمعرفة كيفية النشر' +
      '</small>';

  } catch (err) {
    console.error('خطأ في التوليد:', err);
    statusEl.className = 'error';
    statusEl.textContent = '❌ حدث خطأ: ' + err.message;
  } finally {
    generateBtn.disabled = false;
  }
}

/* ==========================================
   12. مستمعو الأحداث
   ========================================== */

// الأيقونة
iconFileIn.addEventListener('change', updateIcon);
iconTextIn.addEventListener('input', updateIcon);
iconColor2In.addEventListener('input', updateIcon);

// الاسم القصير مع الأيقونة المولّدة
appShortInput.addEventListener('input', () => {
  if (iconMode === 'generate') updateIcon();
});

// الألوان
themeColorIn.addEventListener('input', () => {
  updateIcon();
  updateLivePreview();
});
bgColorIn.addEventListener('input', updateLivePreview);

// اسم التطبيق
appNameInput.addEventListener('input', () => {
  if (!appShortInput.value.trim()) {
    appShortInput.value = appNameInput.value.slice(0, 12);
  }
  updateLivePreview();
});

// الأكواد
htmlCodeIn.addEventListener('input', updateLivePreview);
cssCodeIn.addEventListener('input', updateLivePreview);
jsCodeIn.addEventListener('input', updateLivePreview);

// الميزات
featSplash.addEventListener('change', updateLivePreview);
featDark.addEventListener('change', updateLivePreview);
featStorage.addEventListener('change', updateLivePreview);

// زر التوليد
generateBtn.addEventListener('click', generateApp);

/* ==========================================
   13. دعم زر Tab في خانات الأكواد
   ========================================== */
[htmlCodeIn, cssCodeIn, jsCodeIn].forEach(function (textarea) {
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();

      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const value = textarea.value;

      textarea.value = value.substring(0, start) + '  ' + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;

      updateLivePreview();
    }
  });
});

/* ==========================================
   14. التهيئة الأولية
   ========================================== */
updateIcon();
updateLivePreview();
