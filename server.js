/* ============================================================
   سيرفر توليد مشاريع Android (Capacitor) — نسخة نهائية نظيفة
   ============================================================ */
const express = require('express');
const cors = require('cors');
const JSZip = require('jszip');

const app = express();
const PORT = process.env.PORT || 3000;

// حد أقصى معقول لحجم المدخلات
const MAX_BODY = '10mb';

app.use(cors());
app.use(express.json({ limit: MAX_BODY }));

/* ------------------------------------------------------------
   أداة: توليد أيقونة SVG
   ------------------------------------------------------------ */
function generateSvgIcon(size, bgColor, letter) {
    const safeBg = /^#[0-9a-fA-F]{3,8}$/.test(bgColor) ? bgColor : '#6366f1';
    const safeLetter = String(letter || 'A')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .charAt(0);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${safeBg}" rx="${size * 0.15}"/>
<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.floor(size * 0.55)}"
      font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${safeLetter}</text>
</svg>`;
}

/* ------------------------------------------------------------
   أداة: تحويل اسم التطبيق إلى معرّف حزمة صالح
   القواعد:
   - أحرف إنجليزية صغيرة وأرقام فقط
   - يبدأ بحرف دائماً
   - لا يزيد عن 30 حرفاً
   ------------------------------------------------------------ */
function toSafePackageName(appName) {
    let name = (appName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!name) name = 'app';
    if (!/^[a-z]/.test(name)) name = 'app' + name;
    if (name.length > 30) name = name.substring(0, 30);
    return name;
}

/* ------------------------------------------------------------
   أداة: تهريب النصوص داخل HTML المولَّد
   ------------------------------------------------------------ */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------
   صفحة الجذر — للتأكد من عمل السيرفر
   ------------------------------------------------------------ */
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'PWA → Android Project Generator',
        endpoint: 'POST /generate-android',
        version: '1.0.0'
    });
});

/* ------------------------------------------------------------
   POST /generate-android
   يُرجع ZIP يحتوي مشروع Capacitor كامل
   ------------------------------------------------------------ */
app.post('/generate-android', async (req, res) => {
    try {
        const body = req.body || {};
        const appName    = String(body.appName || 'MyApp').substring(0, 60);
        const themeColor = /^#[0-9a-fA-F]{3,8}$/.test(body.themeColor) ? body.themeColor : '#6366f1';
        const html       = String(body.html || '');
        const css        = String(body.css || '');
        const js         = String(body.js || '');

        const safeName = toSafePackageName(appName);
        const appId = `com.app.${safeName}`;
        const initial = (appName.trim().charAt(0) || 'A').toUpperCase();
        const safeAppName = escapeHtml(appName);

        const zip = new JSZip();
        const root = zip.folder(safeName);

        /* --- www/index.html --- */
        root.file('www/index.html', `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="${themeColor}">
<title>${safeAppName}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
${html}
<script src="script.js"><\/script>
</body>
</html>`);

        root.file('www/style.css', css);
        root.file('www/script.js', js);
        root.file('www/icon.svg', generateSvgIcon(512, themeColor, initial));

        /* --- package.json --- */
        root.file('package.json', JSON.stringify({
            name: safeName,
            version: '1.0.0',
            private: true,
            description: `تطبيق ${appName} — مولَّد بواسطة محوّل الويب`,
            scripts: {
                sync: 'cap sync android',
                open: 'cap open android',
                build: 'cap sync android && cd android && ./gradlew assembleDebug'
            },
            dependencies: {
                '@capacitor/android': '^6.0.0',
                '@capacitor/core': '^6.0.0'
            },
            devDependencies: {
                '@capacitor/cli': '^6.0.0'
            }
        }, null, 2));

        /* --- capacitor.config.json --- */
        root.file('capacitor.config.json', JSON.stringify({
            appId: appId,
            appName: appName,
            webDir: 'www',
            backgroundColor: themeColor,
            android: {
                allowMixedContent: false
            },
            server: {
                androidScheme: 'https'
            }
        }, null, 2));

        /* --- .gitignore --- */
        root.file('.gitignore', `node_modules/
android/
.gradle/
build/
*.apk
*.aab
.DS_Store
.idea/
.vscode/
`);

        /* --- README --- */
        root.file('README.md', `# ${appName} — مشروع Android

مشروع **Capacitor 6** جاهز للتحويل إلى APK حقيقي.

## المتطلبات الأساسية
| الأداة | الإصدار |
|---|---|
| Node.js | 18+ |
| JDK | 17 |
| Android Studio | Hedgehog أو أحدث |
| Android SDK | 34 |

## خطوات البناء

### 1. تثبيت الحزم
\`\`\`bash
npm install
\`\`\`

### 2. إضافة منصة Android
\`\`\`bash
npx cap add android
\`\`\`

### 3. مزامنة ملفات الويب
\`\`\`bash
npx cap sync android
\`\`\`

### 4. بناء APK

**الخيار A — Android Studio:**
\`\`\`bash
npx cap open android
\`\`\`
ثم: \`Build → Build Bundle(s) / APK(s) → Build APK(s)\`

**الخيار B — مباشرة من الطرفية:**
\`\`\`bash
cd android
./gradlew assembleDebug
\`\`\`

## موقع APK
\`android/app/build/outputs/apk/debug/app-debug.apk\`

## تعديل الأكواد
- بعد تعديل أي ملف في \`www/\` شغّل: \`npx cap sync android\`
- لتغيير الاسم/الأيقونة: افتح \`android/app/src/main/\` في Android Studio.
`);

        /* --- توليد ZIP وإرساله --- */
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const filename = `${safeName}-Android-Capacitor.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        return res.send(zipBuffer);

    } catch (err) {
        console.error('خطأ في التوليد:', err);
        return res.status(500).json({
            error: 'فشل إنشاء مشروع Android',
            details: err.message
        });
    }
});

/* ------------------------------------------------------------
   معالج أخطاء عام
   ------------------------------------------------------------ */
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'حجم الطلب كبير جداً (الحد 10MB)' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'خطأ داخلي في السيرفر' });
});

/* ------------------------------------------------------------
   تشغيل السيرفر
   ------------------------------------------------------------ */
app.listen(PORT, () => {
    console.log(`✅ سيرفر التحويل يعمل على المنفذ ${PORT}`);
    console.log(`   اختبار: http://localhost:${PORT}/`);
});
