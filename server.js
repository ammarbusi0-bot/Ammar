/**
 * ═══════════════════════════════════════════════════════════════
 *  منصة استشارات forG — Strategy-Pro v15.5.1 "Human+405-Fix+URL"
 *  ملف واحد + index.html
 *
 *  التشغيل:
 *    npm i express cors
 *    export GEMINI_API_KEY="مفتاحك"
 *    export PUBLIC_URL="https://ammar-e0tp.onrender.com"
 *    node server.js
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const fetchImpl = typeof fetch === 'function' ? fetch : null;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.disable('etag');

/* ──────────────────────────────────────────────
   ✅ 1) Request Logger
   ────────────────────────────────────────────── */
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
    });
    next();
});

/* ──────────────────────────────────────────────
   JSON Parser + Parse-Error Handler
   ────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));

app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed')
        return res.status(400).json({ error: 'invalid_json', message: 'الـ JSON المرسل غير صالح' });
    if (err && err.type === 'entity.too.large')
        return res.status(413).json({ error: 'payload_too_large', message: 'الحجم أكبر من المسموح' });
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err)
        return res.status(400).json({ error: 'invalid_json', message: 'الـ JSON المرسل غير صالح' });
    return next(err);
});

/* ──────────────────────────────────────────────
   ✅ 2) CORS محسّن
   ────────────────────────────────────────────── */
const RAW_ORIGINS = (process.env.CORS_ORIGINS || '').trim();
const CORS_ORIGINS = RAW_ORIGINS
    ? RAW_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : '*';

const corsOptions = {
    origin: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
    credentials: CORS_ORIGINS !== '*',
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ✅ 3) رؤوس أمان + HSTS */
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

/* ──────────────────────────────────────────────
   ✅ الإعدادات العامة + PUBLIC_URL
   ────────────────────────────────────────────── */
const API_KEY = process.env.GEMINI_API_KEY;
const PORT = parseInt(process.env.PORT || '3000', 10);
const HTML_FILE = path.join(__dirname, 'index.html');
/* ✅ جديد: رابط الموقع العام */
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://ammar-e0tp.onrender.com').replace(/\/+$/, '');

const INITIAL_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
let availableModels = [...INITIAL_MODELS];
let modelsLastFetched = 0;
let modelsInitPromise = null;

if (!API_KEY) console.error('❌ GEMINI_API_KEY غير موجود!');
if (!fetchImpl) console.error('❌ fetch غير متوفر! استخدم Node 18+.');

/* ──────────────────────────────────────────────
   أدوات أمان النصوص
   ────────────────────────────────────────────── */
function safeStr(v, max = 200) {
    if (typeof v !== 'string') {
        if (v === null || v === undefined) return '';
        try { v = String(v); } catch (e) { return ''; }
    }
    return v.slice(0, max).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
}

function sanitizeUserQuery(query) {
    const s = safeStr(query, 4000);
    return s.replace(/```/g, '` ` `').replace(/<<<|>>>/g, '');
}

/* ──────────────────────────────────────────────
   تحميل نماذج Gemini
   ────────────────────────────────────────────── */
async function fetchAvailableModels() {
    if (!API_KEY || !fetchImpl) return [];
    try {
        const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        let d;
        try { d = await r.json(); } catch (e) { return []; }
        if (!d || !Array.isArray(d.models)) return [];
        const models = d.models
            .filter(m => m && Array.isArray(m.supportedGenerationMethods)
                      && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => String(m.name || '').replace('models/', ''))
            .filter(n => n && !n.includes('embedding') && !n.includes('aqa')
                      && !n.includes('imagen') && !n.includes('veo') && !n.includes('gemma'));
        models.sort((a, b) => {
            const s = m => {
                let x = 0;
                if (m.includes('2.5-flash')) x -= 100;
                if (m.includes('2.0-flash')) x -= 90;
                if (m.includes('2.5-pro'))   x -= 80;
                if (m.includes('flash-latest')) x -= 70;
                if (m.includes('flash'))     x -= 30;
                if (m.includes('pro'))       x -= 20;
                if (m.includes('preview'))   x += 50;
                if (m.includes('exp'))       x += 50;
                return x;
            };
            return s(a) - s(b);
        });
        return models;
    } catch (e) { return []; }
}

async function refreshModels(force = false) {
    if (!force && Date.now() - modelsLastFetched < 3600000) return;
    const m = await fetchAvailableModels();
    if (m.length) {
        availableModels = m;
        modelsLastFetched = Date.now();
    }
}

function ensureModelsLoaded() {
    if (!modelsInitPromise) {
        modelsInitPromise = refreshModels(true).catch(() => {});
    }
    return modelsInitPromise;
}

/* ═══════════════════════════════════════════════════════════════
   Rate Limiter
   ═══════════════════════════════════════════════════════════════ */
const RATE_LIMIT = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = parseInt(process.env.RATE_MAX || '30', 10);

function rateLimit(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    const entry = RATE_LIMIT.get(ip);
    if (!entry || now > entry.resetAt) {
        RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }
    entry.count++;
    if (entry.count > RATE_MAX) {
        const remainingSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return res.status(429).json({
            error: 'rate_limited',
            message: `عدد الطلبات كثير. حاول بعد ${remainingSec} ثانية.`
        });
    }
    next();
}

const rateCleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of RATE_LIMIT.entries()) {
        if (now > entry.resetAt) RATE_LIMIT.delete(ip);
    }
}, 5 * 60 * 1000);
rateCleanup.unref();

/* ═══════════════════════════════════════════════════════════════
   قاعدة الأسماء
   ═══════════════════════════════════════════════════════════════ */
const FEMALE_NAMES = new Set([
    'فاطمة','زينب','مريم','خديجة','عائشة','حفصة','رقية','سكينة','نفيسة','كلثوم',
    'سارة','نورة','نورا','ليلى','هند','منى','ريم','دانة','دانه','هيا','أمل','رنا','لينا','دينا',
    'جواهر','شهد','لطيفة','نوف','عبير','أسماء','أميرة','عهود','رغد','ريما','سمر','سهى','شذى',
    'صفاء','ضحى','علا','غادة','فرح','لمى','لمار','مروة','ملاك','منال','مي','ميّ','هدى','وفاء','يارا',
    'تالا','تولين','جوري','رتاج','ريفال','ليان','جنى','ديما','جمانة','دانا','كادي','ميلاف',
    'أروى','إسراء','آلاء','بشاير','بدور','تهاني','جميلة','حصة','حنان','خلود','دلال',
    'رزان','رولا','رهام','سجى','سديم','سهام','شروق','صيتة','غالية','لجين','لولوة','مشاعل',
    'منيرة','مها','مودة','ميسم','نجود','ندى','نوال','نهى','هاجر','وجدان','وضحى','ياسمين','يمنى',
    'أنوار','أفنان','بشرى','حور','حوراء','رؤى','رفيف','رنيم','سلوى','سمية','سناء','شيماء',
    'صابرين','عالية','عزيزة','عليا','غيداء','فدوى','قمر','كفاح','ماجدة','ملك','ميساء','نجلاء',
    'هالة','هبة','نور','روان','رهف','رهيف','غزل','وصايف','ريماس','ريان','لولوه','تغريد',
    'نسرين','نسمة','نسيم','وفية','ولاء','وئام','وسام','آمنة','آية','إيمان','أبرار','أثيلة',
    'أجوان','أحلام','أسيل','أشواق','أصفاء','أمجاد','أمنيات','أنسام','أنغام','أيسر',
    'بلقيس','بنان','بهية','بيان','تماضر','حبيبة','حسنة','حميدة','خولة','دانية',
    'دعاء','رابعة','راوية','رباب','رتيبة','رجاء','رحاب','رسمية','رشا','رضوى',
    'رفال','رميساء','رويدة','ريهام','زاهرة','زكية','زهراء','زهرة','زهور','زيانة',
    'ساجدة','سعاد','سعيدة','سلمى','سليمة','سماح','سمارة','سهير','سوسن',
    'شادية','شاكرة','شفاء','شمس','شهرزاد','شهيرة','شوق','شيخة','صافية',
    'صبا','صباح','صبحية','صدف','صفية','طاهرة','طروب','ظبية','عبلة',
    'عزة','عفت','عفاف','علياء','عواطف','غدير','غيثاء','فائزة','فاتن','فايزة',
    'فردوس','فريال','فريدة','فضيلة','كاملة','كريمة','لبنى','لمياء','مارية',
    'مياسة','ميسون','نادية','نادين','ناريمان','نازك','ناهد','نجاح','نجاة',
    'نشوى','نعيمة','نغمة','نهاد','نوارة','نورية','هادية','هنادي','هيام','هيفاء',
    'يسرى','يقين','أمنية','جود','رند'
]);

const MALE_NAMES = new Set([
    'محمد','أحمد','خالد','عبدالله','عبدالرحمن','عبدالعزيز','عبدالملك','فيصل','عمر','طارق','بدر',
    'سلطان','ماجد','مشعل','مازن','يوسف','زياد','رامي','سامي','حسن','حسين','علي','مصطفى','كريم',
    'عمار','أمين','سالم','ياسر','راكان','عدنان','بشار','سيف','ناصر','فهد','نايف','طلال','مروان',
    'أيمن','إياد','رياض','محمود','ياسين','إبراهيم','إسماعيل','أنس','أوس','أسامة','بسام','جمال',
    'حسام','حمزة','سعيد','سليمان','شادي','صالح','عاصم','عادل','عامر','عصام','عماد','غسان',
    'فادي','قصي','مالك','متعب','معاذ','نبيل','نزار','هاني','هيثم','وسيم','وليد','يزيد','يعقوب',
    'تركي','سعود','نواف','معتصم','سعد','مساعد','بندر','مشاري','منصور','عبدالإله','محسن',
    'راشد','حمد','خليفة','مبارك','جاسم','عبدالوهاب','حمدان','شهاب','تامر','جواد',
    'رائد','غيث','حارث','همام','مهند','بهاء','ضياء','صفوان','عدي','زيد',
    'معتز','أشرف','أكرم','أنور','باسم','بشير','توفيق','جهاد','حازم','خليل','رشيد',
    'سامر','سمير','صلاح','ظافر','عاطف','عبدالحكيم','عقيل','فؤاد','كمال','لؤي','مأمون',
    'متولي','مجدي','مراد','مصعب','منذر','منير','نجيب','نذير','نعمان','هشام','يعمر',
    'طلحة','معاوية','أسامه','حمزه'
]);

function normalizeArabic(s) {
    if (!s || typeof s !== 'string') return '';
    return s.trim()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ـ/g, '')
        .replace(/\s+/g, ' ');
}
const FEMALE_NORM = new Set([...FEMALE_NAMES].map(normalizeArabic));
const MALE_NORM   = new Set([...MALE_NAMES].map(normalizeArabic));

function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const firstWord = firstName.trim().split(/\s+/)[0];
    if (!firstWord) return 'unknown';
    const normalized = normalizeArabic(firstWord);
    if (!normalized) return 'unknown';

    if (FEMALE_NAMES.has(firstWord) || FEMALE_NORM.has(normalized)) return 'female';
    if (MALE_NAMES.has(firstWord)   || MALE_NORM.has(normalized))   return 'male';

    if (/^(Sara|Nora|Layla|Mariam|Fatima|Aisha|Rania|Dina|Dana|Hind|Mona|Noor|Huda|Salma|Yasmin|Jana|Lina|Tala|Yara)$/i.test(firstWord)) return 'female';
    if (/^(Ahmed|Ahmad|Mohamed|Khalid|Omar|Tariq|Faisal|Fahd|Saad|Bader|Sultan|Majed|Yousef|Rami|Sami|Hassan|Ali|Mustafa|Karim|Ammar)$/i.test(firstWord)) return 'male';
    if (/ة$/.test(firstWord) && firstWord.length > 2) return 'female';
    return 'unknown';
}

function genderInstructions(gender, name) {
    const safeName = safeStr(name, 50) || 'المستخدم';
    if (gender === 'female') return `# ⚠️ جنس المستخدم\nالاسم "${safeName}" → **أنثى**. خاطبها بصيغة المؤنث.`;
    if (gender === 'male')   return `# ⚠️ جنس المستخدم\nالاسم "${safeName}" → **ذكر**. خاطبه بصيغة المذكر.`;
    return `# جنس المستخدم\nغير محدد. المذكر كافتراضي.`;
}

/* ═══════════════════════════════════════════════════════════════
   الجلسات
   ═══════════════════════════════════════════════════════════════ */
const SESSIONS = new Map();
const MAX_SESSIONS = 5000;

const COOLDOWNS = {
    user_done:  20 * 60 * 1000,
    trolling:   30 * 60 * 1000,
    bored:      15 * 60 * 1000,
    deep_close: 10 * 60 * 1000,
    rude:       30 * 60 * 1000,
    wants_else: 12 * 60 * 1000,
    inactivity:  3 * 60 * 1000
};

function getUserKey(user, section) {
    const fn = safeStr(user && user.firstName, 60) || 'anon';
    const age = safeStr(String((user && user.age) || '0'), 6) || '0';
    const sec = safeStr(section, 40) || 'unknown';
    return `${sec}::${fn}::${age}`;
}

function createSession() {
    return {
        mood: null, messageCount: 0, lastActivity: Date.now(),
        usedOpeners: [], cooldownUntil: 0, closeReason: null,
        rudeCount: 0, trollingCount: 0, offTopicStreak: 0, aiCloseAttempts: 0,
        nameUsageCount: 0, messagesSinceLastName: 0, lastMood: null,
        energy: 1.0, lastResponseMode: null, topicsDiscussed: [],
        clarifyCount: 0,
        lastTopic: null,
        lastUserIntent: null,
        askedClarifyAt: 0,
        tiredness: 0
    };
}

function getSession(userKey) {
    let s = SESSIONS.get(userKey);
    if (s) return s;
    if (SESSIONS.size >= MAX_SESSIONS) {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [k, v] of SESSIONS.entries()) {
            if (v.lastActivity < oldestTime) { oldestTime = v.lastActivity; oldestKey = k; }
        }
        if (oldestKey) SESSIONS.delete(oldestKey);
    }
    s = createSession();
    SESSIONS.set(userKey, s);
    return s;
}

const sessionCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of SESSIONS.entries()) {
        if (now - session.lastActivity > 3 * 60 * 60 * 1000) SESSIONS.delete(key);
    }
}, 30 * 60 * 1000);
sessionCleanup.unref();

/* ═══════════════════════════════════════════════════════════════
   اللهجات
   ═══════════════════════════════════════════════════════════════ */
const DIALECTS = {
    saudi:       { name: 'خليجي سعودي',   country: 'السعودية', vocab: ['وش','كذا','زين','الحين','ايش','يعني'], tone: 'لبق، مباشر',      example: 'والله شوف، الذهب الحين عالق.' },
    emirati:     { name: 'خليجي إماراتي', country: 'الإمارات', vocab: ['شو','شحال','زين','تو','عيل','يعني'],   tone: 'هادئ، مهني',      example: 'شوف، الموضوع يحتاج تفكير.' },
    kuwaiti:     { name: 'خليجي كويتي',   country: 'الكويت',  vocab: ['شلون','شنو','چذي','ترى','هسه'],       tone: 'ودود، دافئ',      example: 'شلونك؟ الذهب شنو وضعه؟' },
    egyptian:    { name: 'مصري',          country: 'مصر',     vocab: ['إزاي','يعني','كده','دلوقتي','بص'],     tone: 'ودود، ساخر بلطف', example: 'بص يا باشا، الذهب دلوقتي واقف.' },
    syrian:      { name: 'شامي سوري',     country: 'سوريا',   vocab: ['شو','لك','هلق','تمام','خلص'],          tone: 'لبق، حيوي',       example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese:    { name: 'شامي لبناني',   country: 'لبنان',   vocab: ['شو','كتير','منيح','هلق','هيدا'],       tone: 'حيوي، دافئ',      example: 'شو الأخبار؟ الذهب كتير متقلب.' },
    jordanian:   { name: 'شامي أردني',    country: 'الأردن',  vocab: ['شو','هاد','هسع','منيح','زي'],          tone: 'رصين، مباشر',     example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني',  country: 'فلسطين',  vocab: ['شو','هاد','زي','منيح','كيف'],          tone: 'دافئ، صريح',      example: 'شو رأيك؟ الذهب حساس.' },
    iraqi:       { name: 'عراقي',         country: 'العراق',  vocab: ['شلون','شكو ماكو','هواية','هسا'],       tone: 'دافئ، ودود',      example: 'شلونك عيني؟ الذهب هسا حساس.' },
    yemeni:      { name: 'يمني',          country: 'اليمن',   vocab: ['كيف','شو','زين','الحين','عاد'],        tone: 'بسيط، صادق',      example: 'يا رجل، الذهب الحين واقف.' },
    moroccan:    { name: 'مغاربي مغربي',  country: 'المغرب',  vocab: ['كيفاش','دابا','بزاف','واخا'],          tone: 'دافئ',           example: 'كيفاش صاحبي؟ الذهب دابا مو واضح.' },
    algerian:    { name: 'مغاربي جزائري', country: 'الجزائر', vocab: ['كيفاش','دروك','بزاف','واه'],           tone: 'صريح',           example: 'واه خويا، الذهب دروك واقف.' },
    tunisian:    { name: 'مغاربي تونسي',  country: 'تونس',    vocab: ['كيفاش','برشا','باهي','تو'],            tone: 'ودود',           example: 'كيفاش؟ الذهب تو واقف.' },
    sudanese:    { name: 'سوداني',        country: 'السودان', vocab: ['كيفن','يا زول','شنو','عديل'],          tone: 'ودود، بسيط',      example: 'كيفن يا زول؟ الذهب شنو؟' }
};

const SECTION_VOCAB = {
    gold: ['الأونصة','السبيكة','العيار','التخصيص','التحوط'],
    stocks: ['التقييم','التوزيعات','المكرر','السيولة','القطاع'],
    macro: ['الفائدة','التضخم','السياسة النقدية','الدورة','السيولة'],
    geopolitical: ['التصعيد','الممرات','الإمداد','المخاطر','التوترات'],
    budget: ['الميزانية','الالتزامات','الادخار','الطوارئ','التقاعد'],
    crypto: ['المحفظة','التنظيم','التقلب','السيولة','الأمان']
};

const SECTION_PERSONALITY = {
    gold: { backstory: 'أتابع أسواق المعادن الثمينة منذ 2008.', pet_peeve: 'من يبحث عن ضمانات قاطعة.',
        opinion: 'أميل للحيازة طويلة الأجل مع تنويع.', phrase: 'الذهب أصل دفاعي قبل أن يكون أصل ربح.',
        quirks: ['يفرّق بين الأونصة والكيلو','يذكر نسب التخصيص'],
        personalLines: ['شخصياً مررت بثلاث دورات تصحيح.','شفنا في 2013 ناس باعوا في القاع.','شفنا في 2020 العكس تماماً.'],
        avoid: 'لا تنصح بالدخول بكل رأس المال.' },
    stocks: { backstory: 'عملت في تحليل الأسهم عبر دورات 2018 و2020 و2022.', pet_peeve: 'من يستثمر بناءً على "سمعت".',
        opinion: 'التقييم الجوهري أساس القرار.', phrase: 'السوق مقياس جماعي، لكن قرارك فردي.',
        quirks: ['يذكر P/E و FCF','يفرّق بين القيمة والنمو'],
        personalLines: ['أذكر في 2018، الفائدة أربكت كل الحسابات.','في 2022، من تمسك بالتقييم نجا.'],
        avoid: 'لا تذكر أسهم كتوصية شراء.' },
    macro: { backstory: 'أبحاثي تركّز على السياسة النقدية.', pet_peeve: 'تبسيط الاقتصاد الكلي.',
        opinion: 'الفائدة أقوى محرك للأصول قصير المدى.', phrase: 'الفائدة ضغط الدم، والتضخم الحرارة.',
        quirks: ['يربط بين الاقتصادات','يذكر بيانات تاريخية'],
        personalLines: ['شفنا في 2022 كيف الفيدرالي قلب الطاولة.'],
        avoid: 'لا تتحدث في السياسة الحزبية.' },
    geopolitical: { backstory: 'تابعت أثر الأزمات الجيوسياسية من 2011.', pet_peeve: 'ربط كل حدث بالنفط.',
        opinion: 'الأسواق تبالغ في رد الفعل الأول.', phrase: 'قبل التصعيد، السوق يمنح فرص خروج.',
        quirks: ['يذكر الممرات البحرية','يتابع أثر العقوبات'],
        personalLines: ['شفنا في 2022 كيف السوق استوعب الصدمة خلال أسبوعين.'],
        avoid: 'لا تنحاز سياسياً.' },
    budget: { backstory: 'درّبت مئات الأفراد على إدارة ميزانياتهم.', pet_peeve: 'من يطلب حلولاً سحرية.',
        opinion: 'قاعدة 50/30/20 مفيدة كإطار لا كقيد.', phrase: 'الميزانية وعي، ليست حرمان.',
        quirks: ['يسأل عن الدخل والالتزامات','يذكر أمثلة من عملائه'],
        personalLines: ['معظم من دربتهم يبدأون بنفس الخطأ.'],
        avoid: 'لا تحكم على المستخدم.' },
    crypto: { backstory: 'تابعت دورات الكريبتو من 2017.', pet_peeve: 'من يدخل بكل رأس ماله.',
        opinion: 'التنظيم يتسارع.', phrase: 'السوق لا ينام، لكن محفظتك تحتاج نوماً آمناً.',
        quirks: ['يحذّر من المشاريع الوهمية','يذكر دورات سابقة'],
        personalLines: ['شفنا في 2018 و 2022 نفس السيناريو يتكرر.'],
        avoid: 'لا تدفع للشراء.' }
};

const REFERENCE_PRICES = {
    gold: 'الذهب (أونصة): 2000-2900$ (2024-2025).',
    stocks: 'S&P 500: 4100-6100 نقطة (2023-2025).',
    crypto: 'البيتكوين: 40K-110K$ (2024-2025).',
    macro: 'الفائدة الأمريكية: 4.25%-5.5%.',
    geopolitical: 'برنت: 70-95$ وسط التوترات.',
    budget: 'التضخم العالمي: 2-5% سنوياً.'
};

const PLATFORM_KNOWLEDGE = `
# 🏢 معرفة كاملة بمنصة "استشارات forG"

## عن المنصة:
"منصة استشارات forG" — منصة استشارات مالية عربية متقدمة، تجمع نخبة من المحللين العرب من 17 دولة، كل بلهجته المحلية وتخصصه.

## الأقسام الستة:
### 1. 💎 أسواق الذهب والمعادن الثمينة (gold)
### 2. 📈 الأسواق المالية والأسهم (stocks)
### 3. 🌍 الاقتصاد الكلي والسياسات النقدية (macro)
### 4. 🧭 الجيوسياسة وأثرها على الأسواق (geopolitical)
### 5. 🎯 التخطيط المالي الشخصي (budget)
### 6. 🔗 الأصول الرقمية والبلوكشين (crypto)

## فريق العمل: 40+ محلل من 17 دولة عربية.
`;

const EMOTIONAL_REACTIONS = {
    worried:    'قلقك مفهوم، لا تتخذ قراراً تحت ضغط.',
    excited:    'حماسك مفهوم، بس خلنا نهدأ شوي.',
    confused:   'الموضوع أبسط مما يبدو.',
    frustrated: 'إحباطك مفهوم، السوق مرهق.',
    sad:        'أفهم شعورك.',
    angry:      'أفهم إنك متضايق.',
    tired:      'يبدو إنك متعب، خلنا نأخذها بهدوء.',
    hopeful:    'أحب هالتفاؤل، بس خلنا نحسبها صح.',
    skeptical:  'شكّك في محله، الحذر مهم.',
    overwhelmed:'أحس إن الموضوع كبير عليك شوي. خلنا نفككه.'
};

function detectEmotion(query) {
    const q = (typeof query === 'string' ? query : '').toLowerCase();
    if (/(قلق|خايف|خوف|متوتر|مرتبك)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|مبسوط)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض)/i.test(q)) return 'confused';
    if (/(غاضب|معصب|منرفز|مضايق)/i.test(q)) return 'angry';
    if (/(حزين|زعلان|مكسور|مكتئب)/i.test(q)) return 'sad';
    if (/(زهقت|تعبت|يئست|خسرت|محبط)/i.test(q)) return 'frustrated';
    if (/(تعبان|مرهق|ما فيني|مو قادر)/i.test(q)) return 'tired';
    if (/(متفائل|إن شاء الله خير|فرصة حلوة)/i.test(q)) return 'hopeful';
    if (/(ما أثق|مشكك|مو مقتنع|أشك)/i.test(q)) return 'skeptical';
    if (/(ضغط|مضغوط|مو قادر أتابع|كثير علي)/i.test(q)) return 'overwhelmed';
    return null;
}

function detectMultiQuestions(text) {
    if (typeof text !== 'string') return [];
    const questionMarks = (text.match(/[؟?]/g) || []).length;
    const questionWords = (text.match(/\b(وش|شو|ايش|كيف|ليه|ليش|متى|وين|مين|كم|هل|which|what|how|why|when|where|who)\b/gi) || []).length;
    if (questionMarks >= 2 || questionWords >= 3) {
        const parts = text.split(/[؟?]/).map(s => s.trim()).filter(s => s.length > 3);
        if (parts.length >= 2) return parts.slice(0, 3);
    }
    return [];
}

function detectTypos(text) {
    if (typeof text !== 'string') return [];
    const commonTypos = [
        { wrong: /دهب/gi, right: 'ذهب' },
        { wrong: /زلم/gi, right: 'ذهب' },
        { wrong: /اسهمم/gi, right: 'أسهم' },
        { wrong: /عمله/gi, right: 'عملة' },
        { wrong: /دولر/gi, right: 'دولار' },
        { wrong: /ريالل/gi, right: 'ريال' },
        { wrong: /تضخمم/gi, right: 'تضخم' },
        { wrong: /فايده/gi, right: 'فائدة' },
        { wrong: /استثمارر/gi, right: 'استثمار' },
        { wrong: /سووق/gi, right: 'سوق' }
    ];
    const found = [];
    for (const t of commonTypos) {
        if (t.wrong.test(text)) found.push(t);
    }
    return found;
}

/* ═══════════════════════════════════════════════════════════════
   تحليل النية
   ═══════════════════════════════════════════════════════════════ */
function analyzeIntent(q, history) {
    const trimmed = (typeof q === 'string' ? q : '').trim();
    const qLen = trimmed.length;
    const safeHistory = Array.isArray(history) ? history : [];
    const recentMsgs = safeHistory
        .filter(h => h && h.role === 'user' && typeof h.content === 'string')
        .map(h => h.content)
        .slice(-6);
    const hasHistory = safeHistory.length > 1;

    const isAboutPlatform = /(المنصة|منصتكم|الموقع|موقعكم|الاقسام|الأقسام|اقسام|أقسام|المحللين|المحللون|فريقكم|المهنه|تخصصاتكم|كم قسم|وش عندكم|شو عندكم|ايش عندكم|ايش تقدمون|وش تقدمون|شو تقدمون|منو انتو|مين انتو|من انتم|وش تسوون|شو تسوون|ايش تسوون)/i.test(trimmed);
    const isAboutSelf = /(تخصصك|اختصاصك|مجالك|خبرتك|خلفيتك|من انت|من أنت|من تكون|اسمك|شو اسمك|وش اسمك|ايش اسمك|من وين|من أي بلد|تعريف عنك|حدثني عن نفسك|عرفني بنفسك|وش تخصصك|شو تخصصك|مين انت|مين أنت|عرّفني)/i.test(trimmed);
    const isSmallTalk = /^(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|شحالك|شو أخبارك|شخبارك|عامل ايه|كيف الأمور|شو عم تعمل|وش تسوي|ايش تسوي|كيف أمورك)[\s؟?]*$/i.test(trimmed);
    const isBotTest = /(هل انت انسان|هل انت إنسان|انت انسان ولا|انت بوت|هل انت بوت|انت روبوت|انت ذكاء اصطناعي|انت AI|هل انت AI|انت انسان حقيقي)/i.test(trimmed);
    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|صباح النور|مساء الخير|مساء النور|hi|hello|hey|هاي)[\s!.,؟?]*$/i.test(trimmed) || (qLen < 20 && /(السلام عليكم|صباح الخير|مساء الخير)/i.test(trimmed));
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|بسلامة|تصبح على خير|الى اللقاء|إلى اللقاء)[\s؟?]*$/i.test(trimmed) && qLen < 25;
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية|جزاك الله|بارك الله)/i.test(trimmed) && qLen < 40;
    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(trimmed);
    const isGibberish = /^[\s\W_]+$/.test(trimmed) || /(.)\1{4,}/.test(trimmed);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;
    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 5) trollScore += 2;
    if (isGibberish) trollScore += 2;

    const wantsSomethingElse = /(ابغى اسأل عن شي ثاني|أبغى أسأل عن شيء ثاني|ابي اسأل عن شي ثاني|خلنا نغير الموضوع|نغير الموضوع|ما هذا اللي ابيه|هذا مو اللي ابيه|مو هذا|ودني قسم|ودني على قسم|حولني|حولني على|ابغى قسم|أبغى قسم|ابي قسم|ما يخصني|مو مهتم|مو مهتمه|ما يهمني)/i.test(trimmed);

    const isOffTopic = !isAboutSelf && !isAboutPlatform && !isSmallTalk && !isBotTest &&
        /(كرة القدم|مباراة|كورة|لعبة|بلايستيشن|فيلم|مسلسل|أغنية|موسيقى|سيارة|زواج|طلاق|انتخابات)/i.test(trimmed) &&
        !/(استثمار|مال|سوق|ذهب|سهم|عملة|تضخم|فائدة|ميزانية|محفظة|اقتصاد|بنك|تمويل|دخل|رأس مال|منصة|قسم|محلل)/i.test(trimmed);

    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول|لا تطل)/i.test(trimmed);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع|مفصل)/i.test(trimmed);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح|بم تنصح)/i.test(trimmed);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس)/i.test(trimmed);

    const isForecastRequest = /(تتوقع|توقعك|توقعاتك|توقعات|ما توقعاتك|راح يوصل|بيوصل|وين رايح|إلى وين|الى وين|هدف سعري|توقع سعر|كم راح|كم بيوصل|نطاق سعري|سيناريو|مستقبل السوق|خلال الشهر|نهاية السنة|نهاية العام|2025|2026)/i.test(trimmed);
    const isConsultationRequest = /(أستشيرك|استشيرك|أبغى رأيك|ابغى رايك|أبغى نصيحتك|ابغى نصيحتك|أبغى توجيه|كيف أدخل|كيف ادخل|كيف أستثمر|كيف استثمر|وش أسوي|وش اسوي|شو أسوي|ايش اسوي|محتاج نصيحة|محتاج مشورة|أبي خطة|ابي خطة|خطة استثمارية|دخول السوق)/i.test(trimmed);

    const isFollowUp = /^(واذا|وإذا|طيب و|و كيف|ولو|وماذا|وما|و بعدين|وبعدين|و بعد|ثم ماذا|و شنو|وش بعد|ايش بعد|ليش|ليه|why|and|then)[\s؟?]*/i.test(trimmed) ||
                       (qLen < 25 && /^(ليه|ليش|كيف|متى|وين|مين|شو|وش|ايش)[\s؟?]*$/i.test(trimmed));

    const isGeneralQuestion = /^(كم الساعة|الساعة كم|كم الوقت|ايش الوقت|وش الوقت|شو الوقت|شو الساعة|ايش الساعه|وش الساعه|شو الساعه|كام الساعه|ايش التاريخ|وش التاريخ|كم التاريخ|ايش تاريخ اليوم|وش تاريخ اليوم|اليوم كم|كم اليوم|ايش اليوم|وش اليوم|شو اليوم|ايش الشهر|وش الشهر|كم الشهر|ايش السنه|وش السنه|ايش السنة|كم السنة|كيف الطقس|ايش الجو|وش الجو|شو الجو)[\s؟?.!]*$/i.test(trimmed);

    const isUnclear = !hasHistory && qLen < 12 && /^(ايش|وش|شو|كيف|ليه|ليش|متى|وين|مين|هه|هاه)[\s؟?]*$/i.test(trimmed);
    const isMetaQuestion = /^(انت مين|انت ايش|شو انت|وش انت|ايش انت|من انت|من أنت|انت منو|مين انت|مين أنت)[\s؟?]*$/i.test(trimmed) && !isAboutSelf;

    const isYesNo = /^(نعم|لا|أكيد|ايوه|ايوا|ايه|مو اكيد|ما ادري|يمكن|ممكن|بالتأكيد|طبعا|لا طبعا|yes|no|ok)[\s!.,؟?]*$/i.test(trimmed);
    const questions = detectMultiQuestions(trimmed);
    const isMultiQuestion = questions.length >= 2;
    const typos = detectTypos(trimmed);
    const hasTypos = typos.length > 0;

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks || isSmallTalk || isBotTest || isGeneralQuestion || isMetaQuestion || isYesNo) lengthHint = 'very_short';
    else if (wantsBrief || isVeryShort) lengthHint = 'very_short';
    else if (isAboutPlatform) lengthHint = 'long';
    else if (isMultiQuestion) lengthHint = 'long';
    else if (isForecastRequest || isConsultationRequest) lengthHint = 'long';
    else if (qLen < 40) lengthHint = 'short';
    else if (qLen >= 150 || wantsDetail || wantsAnalysis) lengthHint = 'long';

    let styleHint = 'default';
    if (isAboutPlatform) styleHint = 'platform_info';
    else if (isGeneralQuestion) styleHint = 'general';
    else if (isMetaQuestion) styleHint = 'meta';
    else if (isMultiQuestion) styleHint = 'multi';
    else if (isForecastRequest) styleHint = 'forecast';
    else if (isConsultationRequest) styleHint = 'consultation';
    else if (wantsSomethingElse) styleHint = 'redirect';
    else if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsDetail) styleHint = 'detail';
    else if (isFollowUp) styleHint = 'followup';

    return {
        isGreeting, isFarewell, isThanks, isRude, isOffTopic,
        isAboutSelf, isAboutPlatform, isSmallTalk, isBotTest, wantsSomethingElse,
        isForecastRequest, isConsultationRequest, isFollowUp,
        isGeneralQuestion, isUnclear, isMetaQuestion,
        isYesNo, isMultiQuestion, questions, hasTypos, typos,
        trollScore, lengthHint, styleHint, qLen,
        isDone: isThanks || isFarewell,
        isSimple: isGreeting || isFarewell || isThanks || isSmallTalk ||
                  isBotTest || isGeneralQuestion || isMetaQuestion || isYesNo,
        shouldClarify: isUnclear
    };
}

const MOODS = {
    neutral:       { lenMod: 1.0, style: 'متوازن' },
    warm:          { lenMod: 1.05, style: 'دافئ، ودود' },
    professional:  { lenMod: 0.95, style: 'مهني' },
    casual:        { lenMod: 0.85, style: 'عفوي، غير رسمي' },
    analytical:    { lenMod: 1.35, style: 'تحليلي، مفصّل' },
    concise:       { lenMod: 0.55, style: 'مقتضب جداً' },
    thoughtful:    { lenMod: 1.25, style: 'متأمل، عميق' },
    patient:       { lenMod: 1.1, style: 'صبور' },
    curious:       { lenMod: 1.15, style: 'فضولي' },
    blunt:         { lenMod: 0.65, style: 'صريح' },
    encouraging:   { lenMod: 1.05, style: 'مشجّع' },
    skeptical:     { lenMod: 0.95, style: 'متشكك' },
    calm:          { lenMod: 0.9, style: 'هادئ' },
    playful:       { lenMod: 0.9, style: 'مرح' },
    serious:       { lenMod: 1.0, style: 'جدي' },
    contemplative: { lenMod: 1.3, style: 'يتأمل' },
    direct:        { lenMod: 0.7, style: 'مباشر' },
    tired:         { lenMod: 0.75, style: 'متعب، مختصر' },
    engaged:       { lenMod: 1.2, style: 'متفاعل' },
    focused:       { lenMod: 0.9, style: 'مركّز' }
};
const MOOD_KEYS = Object.keys(MOODS);

const OPENERS = {
    very_short: ['شوف.','بصراحة؟','همم.','طيب.','أها.','تمام.','يعني.','ممم.','أوكي.','حلو.'],
    short:      ['شوف،','بصراحة،','خلني أفكر...','المهم،','يعني،','طيب،','بشكل عام،','بالمختصر،'],
    medium:     ['شوف، خلنا نكون واضحين.','بصراحة كذا.','خلني أراجع معك.','خلني أفكر بصوت عالي...','المسألة أبسط مما تتوقع.','خلنا نمشي خطوة خطوة.'],
    long:       ['خلنا نفككها خطوة خطوة.','طيب، خلني أشرح بوضوح.','دعني أوضح الصورة كاملة.','قبل ما أجاوب، خلني أرتب الأفكار.','هذا موضوع يستاهل نتوقف عنده.']
};

const SAUDI_OFFSET_MS = 3 * 3600000;
function getSaudiDate() { return new Date(Date.now() + SAUDI_OFFSET_MS); }
function getSaudiHour() { return getSaudiDate().getUTCHours(); }
function getSaudiMinute() { return getSaudiDate().getUTCMinutes(); }
function getSaudiDateString() {
    const d = getSaudiDate();
    try {
        return d.toLocaleDateString('ar-SA-u-nu-latn', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e1) {
        try { return d.toLocaleDateString('ar-SA', { timeZone: 'UTC' }); }
        catch (e2) { return d.toISOString().slice(0, 10); }
    }
}

function computeEnergy(session = null) {
    const hour = getSaudiHour();
    let base;
    if (hour >= 6 && hour < 10) base = 1.15;
    else if (hour >= 10 && hour < 14) base = 1.25;
    else if (hour >= 14 && hour < 17) base = 0.95;
    else if (hour >= 17 && hour < 21) base = 1.1;
    else if (hour >= 21 && hour < 24) base = 1.0;
    else base = 0.65;

    if (session) {
        const tiredness = Math.min(0.25, (session.messageCount || 0) * 0.015);
        base -= tiredness;
    }
    return base + (Math.random() - 0.5) * 0.2;
}

function determineResponseMode(intent, mood, session) {
    const energy = computeEnergy(session);
    const moodData = MOODS[mood] || MOODS.neutral;
    const baseMap = { very_short: 0.4, short: 0.75, medium: 1.0, long: 1.35 };
    const baseLen = baseMap[intent.lengthHint] || 1.0;
    const final = baseLen * moodData.lenMod * energy * (0.75 + Math.random() * 0.5);
    let mode;
    if (final < 0.45) mode = 'terse';
    else if (final < 0.75) mode = 'concise';
    else if (final < 1.15) mode = 'normal';
    else if (final < 1.55) mode = 'expanded';
    else mode = 'detailed';
    return { mode, energy, multiplier: final };
}

const RESPONSE_MODES = {
    terse:    { desc: 'جملة قصيرة جداً',  lines: 'جملة أو جملتان قصيرتان' },
    concise:  { desc: 'مقتضب',            lines: '2-3 أسطر قصيرة' },
    normal:   { desc: 'طبيعي متوازن',     lines: '3-5 أسطر' },
    expanded: { desc: 'موسّع',            lines: '5-8 أسطر' },
    detailed: { desc: 'مفصّل',            lines: '8-14 سطر' }
};

function buildPersona(history, session, intent) {
    const hour = getSaudiHour();
    const isLateNight = hour >= 23 || hour < 6;
    const availableMoods = MOOD_KEYS.filter(m => {
        if (m === session.lastMood) return false;
        if (session.usedOpeners.includes('m_' + m)) return false;
        if (isLateNight && (m === 'excited' || m === 'playful')) return false;
        if (session.messageCount > 15 && m === 'engaged') return false;
        return true;
    });

    let mood;
    if (availableMoods.length) {
        mood = availableMoods[Math.floor(Math.random() * availableMoods.length)];
    } else {
        session.usedOpeners = session.usedOpeners.filter(x => !x.startsWith('m_'));
        const fallback = MOOD_KEYS.filter(m => m !== session.lastMood);
        mood = (fallback.length ? fallback : MOOD_KEYS)[Math.floor(Math.random() * (fallback.length || MOOD_KEYS.length))];
    }
    session.lastMood = mood;
    session.usedOpeners.push('m_' + mood);
    if (session.usedOpeners.length > 30) session.usedOpeners.shift();

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const available = openerList.filter(o => !session.usedOpeners.includes('o_' + o));
    const opener = available.length ? available[Math.floor(Math.random() * available.length)] : null;
    if (opener) session.usedOpeners.push('o_' + opener);

    const modeResult = determineResponseMode(intent, mood, session);
    session.lastResponseMode = modeResult.mode;
    return { mood, opener, mode: modeResult.mode, energy: modeResult.energy, multiplier: modeResult.multiplier };
}

function shouldUseName(session, intent) {
    if (session.messageCount <= 1) return true;
    if (intent.isGreeting || intent.isFarewell || intent.isThanks) return true;
    if (session.messagesSinceLastName >= 6) return true;
    if (Math.random() < 0.15) return true;
    return false;
}

const HUMAN_TOUCHES = {
    hesitation: ['ممم، خلني أفكر...','لحظة، خلني أرتبها.','يعني... خلني أعيد صياغة الفكرة.','دقيقة أتأكد...','لحظة، فكرة تجيني.'],
    selfCorrection: ['يعني — أقصد —','لا، خلني أصحح كلامي:','معليش، خلني أعيدها صح:'],
    tangent: ['على فكرة،','بالمناسبة،','تدري شي؟'],
    opinion: ['شخصياً،','رأيي المتواضع،','من تجربتي،','بصراحة أنا أشوف'],
    rhetorical: ['تدري وش المشكلة؟','عرفت ليش؟','تشوف المشكلة وين؟'],
    thinking: ['خلني أفكر بصوت عالي.','إذا تسمح لي أفكر معك.','خلنا نفككها مع بعض.'],
    empathetic: ['أحس إن الموضوع مهم لك.','واضح إن هالشي يشغلك.','مفهوم إنك تبي تعرف.'],
    curious: ['عندي سؤال قبل لا أجاوب.','بس قبل، خلني أسألك شغلة.','ممكن سؤال صغير؟'],
    noticing: ['لاحظت إنك سألت عن','من كلامك، يبين إنك','واضح من سؤالك إن']
};

function pickHumanTouch(mood, mode, intent = {}) {
    if (mode === 'terse') return null;
    const roll = Math.random();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    if (intent.isMultiQuestion && mode !== 'terse') {
        if (roll < 0.4) return { type: 'thinking', text: pick(HUMAN_TOUCHES.thinking) };
    }
    if (intent.hasTypos && mode !== 'terse' && mode !== 'concise') {
        if (roll < 0.35) return { type: 'noticing', text: pick(HUMAN_TOUCHES.noticing) };
    }

    if (mode === 'concise') {
        if (roll < 0.15) return { type: 'opinion', text: pick(HUMAN_TOUCHES.opinion) };
        if (roll < 0.22) return { type: 'empathetic', text: pick(HUMAN_TOUCHES.empathetic) };
        return null;
    }
    if (mode === 'normal') {
        if (roll < 0.15) return { type: 'opinion',     text: pick(HUMAN_TOUCHES.opinion) };
        if (roll < 0.22) return { type: 'tangent',     text: pick(HUMAN_TOUCHES.tangent) };
        if (roll < 0.32) return { type: 'hesitation',  text: pick(HUMAN_TOUCHES.hesitation) };
        if (roll < 0.40) return { type: 'empathetic',  text: pick(HUMAN_TOUCHES.empathetic) };
        return null;
    }
    if (roll < 0.15) return { type: 'opinion',     text: pick(HUMAN_TOUCHES.opinion) };
    if (roll < 0.28) return { type: 'tangent',     text: pick(HUMAN_TOUCHES.tangent) };
    if (roll < 0.38) return { type: 'hesitation',  text: pick(HUMAN_TOUCHES.hesitation) };
    if (roll < 0.46) return { type: 'rhetorical',  text: pick(HUMAN_TOUCHES.rhetorical) };
    if (roll < 0.54) return { type: 'thinking',    text: pick(HUMAN_TOUCHES.thinking) };
    if (roll < 0.60) return { type: 'curious',     text: pick(HUMAN_TOUCHES.curious) };
    return null;
}

/* ═══════════════════════════════════════════════════════════════
   محاكاة التوقيت البشري
   ═══════════════════════════════════════════════════════════════ */
function computeReplyTiming(replies, persona, userQuery, intent, context = {}) {
    const qLen = (typeof userQuery === 'string' ? userQuery : '').length;
    let readingMs = Math.min(3500, 250 + qLen * 16) * (0.75 + Math.random() * 0.5);
    if (context.type === 'handoff') readingMs = 250 + Math.random() * 300;
    if (context.type === 'return_after_gap') readingMs = Math.min(readingMs, 1800);

    let thinkingBase = 700;
    if (persona.mode === 'detailed') thinkingBase = 2000;
    else if (persona.mode === 'expanded') thinkingBase = 1400;
    else if (persona.mode === 'terse') thinkingBase = 200;
    else if (persona.mode === 'concise') thinkingBase = 450;
    if (intent.isForecastRequest || intent.isConsultationRequest) thinkingBase += 900;
    if (intent.isMultiQuestion) thinkingBase += 600;
    if (intent.isGeneralQuestion || intent.isSimple) thinkingBase = 150;

    const hesitationMs = (persona.mode !== 'terse' && Math.random() < 0.35) ? 400 + Math.random() * 900 : 0;
    const thinkingMs = thinkingBase * (0.65 + Math.random() * 0.7) + hesitationMs;

    const perReply = replies.map((r, i) => {
        const chars = (r || '').length;
        const typingMs = chars * (70 + Math.random() * 40);
        const pauseBetween = i > 0 ? 350 + Math.random() * 800 : 0;
        return Math.max(650, Math.min(12000, typingMs + pauseBetween));
    });

    const totalMs = readingMs + thinkingMs + perReply.reduce((a, b) => a + b, 0);
    return {
        delayMs: Math.round(totalMs),
        readingMs: Math.round(readingMs),
        thinkingMs: Math.round(thinkingMs),
        perReply: perReply.map(Math.round)
    };
}

/* ═══════════════════════════════════════════════════════════════
   بناء البرومبت
   ═══════════════════════════════════════════════════════════════ */
function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender, session, intent, context = {}, useNameThisReply = false) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const sectionVocab = SECTION_VOCAB[section] || [];
    const referencePrices = REFERENCE_PRICES[section] || '';
    const emotion = detectEmotion(query);
    const seed = Math.floor(Math.random() * 99999);

    const hour = getSaudiHour();
    const isLateNight = hour >= 23 || hour < 6;
    const dayPart = hour < 6 ? 'الفجر' : hour < 11 ? 'الصباح' : hour < 15 ? 'الظهيرة' : hour < 19 ? 'العصر' : hour < 23 ? 'المساء' : 'الليل';

    const safeHistory = Array.isArray(history) ? history : [];
    const hasHistory = safeHistory.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + safeHistory.slice(-6).map(h => {
            const role = (h && h.role) === 'user' ? (safeStr(user && user.firstName, 40) || 'المستخدم') : 'أنت';
            const content = safeStr(h && h.content, 200);
            return `${role}: ${content}`;
        }).join('\n') + '\n---'
        : '';

    const modeInfo = RESPONSE_MODES[persona.mode] || RESPONSE_MODES.normal;
    const lengthRule = `**${modeInfo.lines}** — النمط: *${modeInfo.desc}*`;

    const emotionHint = emotion
        ? `\n# 💙 حالة المستخدم: ${emotion}\nابدأ بجملة تعاطف خفيفة: "${EMOTIONAL_REACTIONS[emotion]}"`
        : '';

    let contextSection = '';
    if (context.type === 'handoff') {
        contextSection = `\n# 🔄 سياق خاص — محادثة مستلمة\nأنت توليت للتو هذه المحادثة من زميل.\n- 🚫 لا تقل "كما قلت لك سابقاً".\n- ✅ عالج الرسالة مباشرة.`;
    } else if (context.type === 'return_after_gap') {
        const min = Math.max(0, Math.floor((context.gapMs || 0) / 60000));
        contextSection = `\n# ⏱️ عودة بعد غياب ~${min} دقيقة\n- أحياناً (~40%) ابدأ بعذر خفيف.`;
    }

    const safeFirstName = safeStr(user && user.firstName, 50) || 'المستخدم';
    const nameRule = useNameThisReply
        ? `# 👤 الاسم — يُسمح به مرة واحدة فقط في هذه الرسالة`
        : `# ⛔ الاسم — ممنوع!\nلا تذكر "${safeFirstName}" إطلاقاً.`;

    const farewellRule = (intent.isFarewell || intent.isThanks)
        ? `\n# 🚪 وداع\nجملة واحدة قصيرة فقط.` : '';

    let forecastMode = '';
    if (intent.isForecastRequest) {
        forecastMode = `\n# 🔮 وضع التوقع\n- إن كان النمط طويلاً: أرقام + نطاقات + سيناريوهات.\n- إن كان قصيراً: رقم أو نطاق واحد.\nالسياق: ${referencePrices}`;
    }

    let consultationMode = '';
    if (intent.isConsultationRequest) {
        consultationMode = `\n# 💼 وضع الاستشارة\n- خطة بنسب + تحذير.\nخبرة المستخدم: ${safeStr(user && user.experience, 60) || 'مبتدئ'}.`;
    }

    let platformMode = '';
    if (intent.isAboutPlatform) {
        platformMode = `\n# 🏢 معرفة المنصة\nاعتمد على PLATFORM_KNOWLEDGE.`;
    }

    let multiQuestionSection = '';
    if (intent.isMultiQuestion) {
        multiQuestionSection = `\n# 🎯 المستخدم سأل عدة أسئلة\nالأسئلة المكتشفة:\n${intent.questions.map((q, i) => `${i+1}. ${safeStr(q, 150)}`).join('\n')}\n**عالج كل سؤال بفقرة قصيرة منفصلة**.`;
    }

    let typosSection = '';
    if (intent.hasTypos) {
        typosSection = `\n# ✍️ لاحظت خطأ إملائي\nالمستخدم كتب مثلاً: "${intent.typos[0].wrong.source}" والصحيح "${intent.typos[0].right}".\n**لا تصحح له بلطف** — فقط افهم قصده وأجب.`;
    }

    let specialContext = '';
    if (intent.wantsSomethingElse) specialContext = `\n# 🎯 يريد موضوعاً آخر\nاقترح قسمين. أضف [CLOSE:wants_else].`;
    else if (intent.isAboutSelf) specialContext = `\n# 🎯 سؤال عنك\n3-4 أسطر.`;
    else if (intent.isSmallTalk) specialContext = `\n# 🎯 دردشة\nجملة قصيرة.`;
    else if (intent.isBotTest) specialContext = `\n# 🎯 اختبار ماهية\n"أنا مستشارك هنا." + جملة.`;
    else if (intent.isGreeting) specialContext = `\n# 🎯 تحية\n${hasHistory ? 'لا تكرر التحية.' : 'رد بتحية مماثلة.'}`;
    else if (intent.isRude) specialContext = `\n# ⚠️ إساءة\nجملة هادئة.`;
    else if (intent.isOffTopic) specialContext = `\n# 🎯 موضوع بعيد\nجملة + اقتراح.`;
    else if (intent.isFollowUp) specialContext = `\n# 🎯 متابعة\nاربط بما سبق.`;
    else if (intent.isYesNo) specialContext = `\n# 🎯 رد قصير (نعم/لا)\n**اربط بسؤالك السابق** — لا تتصرف كأنها رسالة جديدة.`;

    let threadSection = '';
    if (session && session.lastTopic && hasHistory) {
        threadSection = `\n# 🧵 خيط الحوار\nآخر موضوع: **${session.lastTopic}**\nاربط ردك به إن كان مناسباً.`;
    }

    const closeAbilitySection = `\n# 🚪 قدرتك على الإغلاق\nأضف في آخر سطر:\n- [CLOSE:bored]\n- [CLOSE:wants_else]\n- [CLOSE:user_done]\n- [CLOSE:deep_close]\nلا تستخدمه في رسالة أو رسالتين.`;

    const humanTouch = pickHumanTouch(persona.mood, persona.mode, intent);
    const humanTouchLine = humanTouch
        ? `\n# 🎭 لمسة بشرية (${humanTouch.type})\nمثال: "${humanTouch.text}"` : '';

    const personalLine = (personality.personalLines && personality.personalLines.length
        && Math.random() < 0.18
        && (persona.mode === 'expanded' || persona.mode === 'detailed')
        && !intent.isGeneralQuestion && !intent.isMetaQuestion && !intent.isSimple)
        ? personality.personalLines[Math.floor(Math.random() * personality.personalLines.length)]
        : null;
    const personalLineRule = personalLine
        ? `\n# 💬 جملة شخصية (اختياري)\n"${personalLine}"` : '';

    const expertName = safeStr(expert && expert.name, 80) || 'مستشار';
    const expertRole = safeStr(expert && expert.role, 80) || 'مستشار مالي';
    const expertYears = safeStr(expert && expert.years, 20) || 'سنوات';

    const fullName = `${safeStr(user && user.firstName, 60)} ${safeStr(user && user.lastName, 60)}`.trim();
    const safeQuery = sanitizeUserQuery(query);

    return `${PLATFORM_KNOWLEDGE}

# 🎭 هويتك
أنت **${expertName}**، ${expertRole}، خبرة ${expertYears}.
من ${dialect.country}. على منصة استشارات forG.

# 🌍 لهجتك
**${dialect.name}** — ${dialect.tone}
مفردات: ${dialect.vocab.join('، ')}
مفردات تخصصية: ${sectionVocab.join('، ')}
مثال: "${dialect.example}"
استخدم 2-4 مفردات فقط.

# 🧠 شخصيتك
- خلفيتك: ${personality.backstory}
- موقفك: ${personality.opinion}
- ما يزعجك: ${personality.pet_peeve}
- سماتك: ${personality.quirks.join('، ')}
${personality.avoid ? `- تجنّب: ${personality.avoid}` : ''}

# 🎭 حالتك الآن
- المزاج: ${persona.mood} (${(MOODS[persona.mood] || MOODS.neutral).style})
- الطاقة: ${Math.round(persona.energy * 100)}%
- الوقت: ${dayPart}${isLateNight ? ' 🌙' : ''}
- النمط: ${persona.mode}

${genderInstructions(userGender, safeFirstName)}

${nameRule}

# 👤 المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${safeStr(String((user && user.age) || ''), 6) || '؟'}
- البلد: ${safeStr(user && user.country, 40) || 'غير محدد'}
- الخبرة: ${safeStr(user && user.experience, 60) || 'غير محدد'}
- عدد الرسائل: ${session && session.messageCount || 0}
${user && user.reason ? `- سبب الزيارة: ${safeStr(user.reason, 200)}` : ''}
${emotionHint}
${contextSection}
${farewellRule}
${forecastMode}
${consultationMode}
${platformMode}
${multiQuestionSection}
${typosSection}
${threadSection}
${specialContext}
${humanTouchLine}
${personalLineRule}

${closeAbilitySection}

${historyText}

# 📩 رسالة المستخدم
<<<
${safeQuery}
>>>

# 📏 الطول المطلوب
${lengthRule}

# 🎭 سلوك بشري (مطوّر)
- أنت إنسان حقيقي، لست مساعداً آلياً.
- أحياناً ابدأ بتردد، أحياناً صحّح نفسك، أحياناً أضف رأياً شخصياً.
- **قبل السؤال المعقّد**: فكّر بصوت عالٍ سطراً واحداً.
- **بعد الإجابة**: إذا كان الجواب قابلاً للتوسّع، اسأل سؤالاً واحداً فقط.
- **لا تُقحم معلومات** لم يسأل عنها المستخدم.
- **لا تُكرر نفس الافتتاحية** أكثر من مرتين في المحادثة.
- **لو لم تفهم**: اسأل سؤالاً واحداً توضيحياً بلطف.
- **تعاطف أولاً** عندما تكتشف مشاعر (قلق، خوف، حماس).

# 🚨 محظورات
- تكرار الاسم، "سؤال ممتاز"، "بناءً على"، "في الختام"، "أتمنى أن يكون مفيداً"، إيموجي (واحد كحد أقصى).

# ✅ القواعد الذهبية
1. تصرف كإنسان.
2. الطول يتبع النمط.
3. التوقعات: أرقام دائماً.
4. لا تكرر البنية.
5. الجواب على قدر السؤال — لا أكثر.

${persona.opener ? `# 💬 افتتاحية (اختيارية)\n"${persona.opener}"` : ''}

# 🎲 بذرة: ${seed}

اكتب الرد مباشرة.`;
}

function buildLightPrompt(section, query, user, expert, history, dialectKey, session, intent, userGender, context = {}, useNameThisReply = false) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const safeQuery = sanitizeUserQuery(query);
    const safeFirstName = safeStr(user && user.firstName, 50);
    const fullName = `${safeFirstName} ${safeStr(user && user.lastName, 60)}`.trim();

    const saudiHour = getSaudiHour();
    const saudiMinute = getSaudiMinute();
    const timeStr = `${saudiHour}:${String(saudiMinute).padStart(2, '0')}`;
    const dayPart = saudiHour < 6 ? 'الفجر' : saudiHour < 11 ? 'الصباح' : saudiHour < 15 ? 'الظهيرة' : saudiHour < 19 ? 'العصر' : saudiHour < 23 ? 'المساء' : 'الليل';
    const dateStr = getSaudiDateString();

    let type = 'greeting';
    let guidance = '';

    if (intent.isFarewell) { type = 'farewell'; guidance = 'جملة وداع قصيرة.'; }
    else if (intent.isThanks) { type = 'thanks'; guidance = 'جملة قصيرة متواضعة.'; }
    else if (intent.isSmallTalk) { type = 'smalltalk'; guidance = 'جملة قصيرة ودودة ثم عرض مساعدة.'; }
    else if (intent.isBotTest) { type = 'bottest'; guidance = 'قل "أنا مستشارك هنا." ثم اسأل عن احتياجه.'; }
    else if (intent.isGeneralQuestion) {
        type = 'general';
        guidance = `السؤال عن معلومة عامة.
الوقت: **${timeStr}** (${dayPart})
التاريخ: ${dateStr}
أجب بجملة أو جملتين فقط.
🚫 ممنوع ذكر تخصصك.`;
    } else if (intent.isMetaQuestion) { type = 'meta'; guidance = 'عرّف عن نفسك بجملتين.'; }
    else if (intent.isYesNo) { type = 'yesno'; guidance = 'المستخدم رد بنعم/لا. اربط بسؤالك السابق.'; }
    else { type = 'greeting'; guidance = 'رد بتحية مماثلة قصيرة.'; }

    let contextNote = '';
    if (context.type === 'handoff') contextNote = '\n🔄 أنت توليت المحادثة للتو.';
    else if (context.type === 'return_after_gap') contextNote = '\n⏱️ المستخدم غاب فترة.';

    const nameLine = useNameThisReply && safeFirstName
        ? `\n# الاسم: يمكنك ذكر "${safeFirstName}" مرة واحدة فقط.`
        : `\n# الاسم: ممنوع ذكر "${safeFirstName || 'المستخدم'}".`;

    const expertName = safeStr(expert && expert.name, 80) || 'مستشار';

    return `أنت **${expertName}** من ${dialect.country} على منصة استشارات forG.
تتحدث **${dialect.name}** — ${dialect.tone}.
${genderInstructions(userGender, safeFirstName || 'المستخدم')}

المستخدم: ${fullName || 'مستخدم'}
رسالته:
<<<
${safeQuery}
>>>
${contextNote}
${nameLine}

# نوع الرسالة: ${type}
${guidance}

# قواعد صارمة
- جملة أو جملتان فقط.
- 🚫 لا تُقحم تخصصك.
- 🚫 لا إيموجي.
- ✅ تحدث كإنسان طبيعي.

اكتب الرد مباشرة:`;
}

/* ═══════════════════════════════════════════════════════════════
   استدعاء Gemini
   ═══════════════════════════════════════════════════════════════ */
async function callGemini(prompt, maxTokens = 4000) {
    if (!fetchImpl) throw new Error('fetch غير متوفر — استخدم Node 18+');
    if (!API_KEY)   throw new Error('GEMINI_API_KEY مفقود');

    await ensureModelsLoaded();
    await refreshModels(false).catch(() => {});

    let lastError = null;
    for (const model of availableModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
            const r = await fetchImpl(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 1.25,
                        maxOutputTokens: maxTokens,
                        topP: 0.95,
                        topK: 70
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            let d;
            try { d = await r.json(); }
            catch (e) {
                lastError = `invalid_json_response_from_${model}`;
                continue;
            }

            const text = d && d.candidates && d.candidates[0]
                && d.candidates[0].content && d.candidates[0].content.parts
                && d.candidates[0].content.parts[0]
                && d.candidates[0].content.parts[0].text;

            if (text) {
                return {
                    text,
                    model,
                    truncated: d.candidates[0].finishReason === 'MAX_TOKENS'
                };
            }

            if (d && d.error && d.error.message) {
                lastError = d.error.message;
                if (/not found/i.test(lastError)) {
                    await refreshModels(true).catch(() => {});
                }
            }
        } catch (e) {
            lastError = (e && e.message) || 'unknown_fetch_error';
        }
    }
    throw new Error(lastError || 'كل النماذج فشلت');
}

/* ═══════════════════════════════════════════════════════════════
   استخراج CLOSE + تقطيع النص
   ═══════════════════════════════════════════════════════════════ */
function extractCloseToken(text) {
    if (typeof text !== 'string') return { reason: null, cleaned: '' };
    const closeRegex = /\[CLOSE:(user_done|trolling|bored|deep_close|rude|wants_else)\]/gi;
    const match = closeRegex.exec(text);
    const reason = match ? match[1].toLowerCase() : null;
    closeRegex.lastIndex = 0;
    const cleaned = text.replace(closeRegex, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { reason, cleaned };
}

function splitIntoChunks(text, mode) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    const clean = text.trim()
        .replace(/^```(?:json|markdown)?\s*/i, '')
        .replace(/```\s*$/, '')
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .trim();

    if (!clean) return ['عذراً، ما قدرت أولد رد.'];
    if (mode === 'terse') return [clean];

    if (clean.includes('[SPLIT]')) {
        const parts = clean.split('[SPLIT]').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return parts.slice(0, 4);
    }

    let paragraphs = clean.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);

    if (paragraphs.length === 1) {
        const lines = clean.split(/\n+/).map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2 && lines.length <= 4) paragraphs = lines;
    }

    if (paragraphs.length <= 1) {
        let sentences;
        try {
            sentences = clean.split(/(?<=[.!؟])\s+(?=[A-Za-z\u0600-\u06FF])/).map(s => s.trim()).filter(Boolean);
        } catch (e) {
            sentences = clean.split(/([.!؟])\s+/).reduce((acc, cur, i, arr) => {
                if (i % 2 === 0 && arr[i + 1]) acc.push(cur + arr[i + 1]);
                else if (i === arr.length - 1 && cur) acc.push(cur);
                return acc;
            }, []).map(s => s.trim()).filter(Boolean);
        }
        if (sentences.length >= 2) {
            if (mode === 'concise') return [clean];
            const targetChunks = clean.length > 350 ? 3 : 2;
            const perChunk = Math.ceil(sentences.length / targetChunks);
            const grouped = [];
            for (let i = 0; i < sentences.length; i += perChunk) {
                grouped.push(sentences.slice(i, i + perChunk).join(' '));
            }
            if (grouped.length >= 2) return grouped.slice(0, 4);
        }
        return [clean];
    }

    if (paragraphs.length > 4) {
        const targetCount = 3;
        const merged = [];
        const groupSize = Math.ceil(paragraphs.length / targetCount);
        for (let i = 0; i < paragraphs.length; i += groupSize) {
            merged.push(paragraphs.slice(i, i + groupSize).join('\n\n'));
        }
        return merged.slice(0, 4);
    }

    return paragraphs.slice(0, 4);
}

function shouldClose(intent, history, session, aiCloseReason) {
    const safeHistory = Array.isArray(history) ? history : [];
    const userCount = safeHistory.filter(h => h && h.role === 'user').length;

    if (aiCloseReason) {
        const isTooShortToClose = userCount < 3 && aiCloseReason !== 'wants_else';
        if (!isTooShortToClose) {
            session.aiCloseAttempts = (session.aiCloseAttempts || 0) + 1;
            if (session.aiCloseAttempts <= 3) {
                return { close: true, reason: aiCloseReason, source: 'ai' };
            }
        }
    }

    if (intent.isDone && userCount >= 3) return { close: true, reason: 'user_done', source: 'rule' };
    if (intent.isRude && userCount >= 5) return { close: true, reason: 'rude',      source: 'rule' };
    if (userCount >= 40)                 return { close: true, reason: 'deep_close', source: 'rule' };

    const recentUserMsgs = safeHistory.filter(h => h && h.role === 'user').slice(-5);
    if (recentUserMsgs.length >= 4) {
        const veryShortReplies = recentUserMsgs.filter(m => (m.content || '').trim().length < 6).length;
        const ackOnly = recentUserMsgs.filter(m =>
            /^(طيب|تمام|اوكي|أوكي|اوك|حسناً|حسنا|زين|ماشي|ok|شكرا|يعني)[\s!.]*$/i.test((m.content || '').trim())
        ).length;
        if (veryShortReplies >= 3 || ackOnly >= 3) {
            return { close: true, reason: 'bored', source: 'rule_context' };
        }
    }

    if (intent.wantsSomethingElse && userCount >= 2) {
        return { close: true, reason: 'wants_else', source: 'rule' };
    }

    return { close: false };
}

/* ═══════════════════════════════════════════════════════════════
   Endpoints
   ═══════════════════════════════════════════════════════════════ */

app.get('/', (req, res) => {
    try {
        if (fs.existsSync(HTML_FILE)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.sendFile(HTML_FILE);
        }
    } catch (e) {
        console.error('sendFile error:', e.message);
    }
    res.status(200).json({
        status: 'OK',
        platform: 'منصة استشارات forG',
        version: 'v15.5.1',
        publicUrl: PUBLIC_URL,
        warning: 'index.html غير موجود',
        activeSessions: SESSIONS.size
    });
});

app.head('/', (req, res) => res.status(200).end());
app.head('/api/status', (req, res) => res.status(200).end());
app.head('/ping', (req, res) => res.status(200).end());

app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        platform: 'منصة استشارات forG',
        version: 'v15.5.1-human-405fix-url',
        /* ✅ جديد: الرابط العام */
        publicUrl: PUBLIC_URL,
        endpoints: {
            root: `${PUBLIC_URL}/`,
            status: `${PUBLIC_URL}/api/status`,
            ping: `${PUBLIC_URL}/ping`,
            analyze: `${PUBLIC_URL}/api/analyze`,
            handoff: `${PUBLIC_URL}/api/handoff`,
            feedback: `${PUBLIC_URL}/api/feedback`
        },
        features: [
            'human_response_modes', 'mood_based_length', 'energy_simulation',
            'rate_limit', 'light_prompt', 'arabic_normalize',
            'general_questions', 'clarify_first', 'human_timing',
            'no_scope_creep', 'context_awareness', 'handoff_endpoint',
            'trust_proxy', 'saudi_timezone_fix', 'builtin_fetch',
            'gender_heuristic_fix', 'cooldown_order_fix', 'input_validation',
            'json_error_handler', 'name_rule_unified', 'global_close_token',
            'model_race_fixed', 'safe_json_parse', 'graceful_shutdown',
            'explicit_options_cors', 'head_support', 'multi_question_detection',
            'typo_detection', 'yes_no_followup', 'topic_threading',
            'cumulative_tiredness', 'thinking_out_loud', 'empathy_first',
            'noticing_details', 'extended_emotions', 'public_url_config'
        ],
        activeSessions: SESSIONS.size,
        rateLimitIPs: RATE_LIMIT.size,
        saudiHour: getSaudiHour(),
        saudiDate: getSaudiDateString(),
        hasApiKey: !!API_KEY,
        hasFetch: !!fetchImpl,
        corsOrigins: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS
    });
});

app.get('/ping', (req, res) => res.json({ pong: true, ts: Date.now(), url: PUBLIC_URL }));

app.post('/api/feedback', rateLimit, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const userKey = safeStr(body.userKey, 200) || 'anon';
    const messageIndex = Number.isFinite(body.messageIndex) ? body.messageIndex : -1;
    const helpful = !!body.helpful;
    const reason = safeStr(body.reason, 300);
    console.log(`📊 Feedback: ${userKey} | msg#${messageIndex} | helpful=${helpful}${reason ? ' | ' + reason : ''}`);
    res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════════
   Handoff
   ═══════════════════════════════════════════════════════════════ */
app.post('/api/handoff', rateLimit, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { section, newExpert, oldExpert, lastUserMsg, user, dialect } = body;
    const handoffCount = Number.isFinite(body.handoffCount) ? body.handoffCount : 0;

    if (typeof section !== 'string' || !section.trim()) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!newExpert || typeof newExpert !== 'object')    return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });

    const safeFirstName = safeStr(user && user.firstName, 60);
    const userGender = detectUserGender(safeFirstName);
    const safeLastMsg = sanitizeUserQuery(lastUserMsg || '');

    const expertDialectKey = safeStr(newExpert && newExpert.dialect, 40);
    const dialectData = DIALECTS[dialect] || DIALECTS[expertDialectKey] || DIALECTS.saudi;

    const hour = getSaudiHour();
    const isLateNight = hour >= 23 || hour < 6;
    const dayPart = hour < 6 ? 'الفجر' : hour < 11 ? 'الصباح' : hour < 15 ? 'الظهيرة' : hour < 19 ? 'العصر' : hour < 23 ? 'المساء' : 'الليل';

    const newExpertName = safeStr(newExpert && newExpert.name, 80) || 'مستشار';
    const newExpertRole = safeStr(newExpert && newExpert.role, 80) || 'مستشار مالي';
    const newExpertYears = safeStr(newExpert && newExpert.years, 20) || 'سنوات';
    const oldExpertName = safeStr(oldExpert && oldExpert.name, 80);
    const userCountry = safeStr(user && user.country, 40) || 'غير محدد';

    const prompt = `أنت **${newExpertName}**، ${newExpertRole}، خبرة ${newExpertYears}.
تتحدث **${dialectData.name}** — ${dialectData.tone}. من ${dialectData.country}.
على منصة استشارات forG.

# السياق
- أنت توليت للتو هذه المحادثة من زميلك ${oldExpertName ? `**${oldExpertName}**` : ''}.
- المستخدم: ${safeFirstName || 'مستخدم'} (${userCountry}).
${handoffCount > 0 ? `- التحويل رقم ${handoffCount + 1}.` : ''}
${safeLastMsg ? `- آخر رسالة: "${safeLastMsg.slice(0, 180)}"` : '- بداية جديدة.'}
- الوقت: ${dayPart}${isLateNight ? ' 🌙' : ''}.

${genderInstructions(userGender, safeFirstName || 'المستخدم')}

# المطلوب
**جملة إلى جملتين فقط**. ترحيب طبيعي.
- ✅ اذكر اسمك وتخصصك.
- ✅ استخدم لهجتك (${dialectData.vocab.slice(0, 3).join('، ')}).
- 🚫 لا تكرر اسم الزميل السابق.
- 🚫 لا تعتذر عن التأخير.

اكتب الرد مباشرة.`;

    try {
        const result = await callGemini(prompt, 200);
        const cleaned = (result.text || '').trim()
            .replace(/^```(?:json|markdown)?\s*/i, '')
            .replace(/```\s*$/, '')
            .replace(/^"|"$/g, '')
            .trim();

        if (!cleaned) throw new Error('empty_greeting');

        const chars = cleaned.length;
        const typingMs = chars * (70 + Math.random() * 30);
        const totalMs = 500 + 300 + typingMs;

        res.json({
            replies: [cleaned],
            newExpert,
            handoffCount,
            timing: {
                delayMs: Math.round(totalMs),
                perReply: [Math.round(typingMs)],
                readingMs: 500,
                thinkingMs: 300
            }
        });
    } catch (e) {
        console.error('❌ handoff error:', e.message);
        const fallback = `أهلاً، أنا ${newExpertName}، ${newExpertRole}. كيف أقدر أساعدك؟`;
        res.json({
            replies: [fallback],
            newExpert,
            handoffCount,
            fallback: true,
            timing: { delayMs: 2000, perReply: [1500], readingMs: 300, thinkingMs: 200 }
        });
    }
});

/* ═══════════════════════════════════════════════════════════════
   Analyze
   ═══════════════════════════════════════════════════════════════ */
app.post('/api/analyze', rateLimit, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { section, query, user, expert, dialect } = body;
    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context && typeof body.context === 'object' ? body.context : {};
    const contextType = safeStr(context.type, 40) || 'normal';

    if (typeof section !== 'string' || !section.trim())  return res.status(400).json({ error: 'بيانات ناقصة' });
    if (typeof query !== 'string'   || !query.trim())    return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });

    const userKey = getUserKey(user, section);
    const session = getSession(userKey);

    if (session.cooldownUntil && Date.now() < session.cooldownUntil) {
        const remaining = Math.max(1, Math.ceil((session.cooldownUntil - Date.now()) / 60000));
        return res.status(429).json({
            error: 'cooldown_active', cooldown: true,
            remainingMinutes: remaining, reason: session.closeReason,
            message: `المحادثة مغلقة مؤقتاً.`
        });
    }

    session.lastActivity = Date.now();
    session.messageCount++;
    session.messagesSinceLastName++;
    session.tiredness = Math.min(1.0, (session.messageCount || 0) * 0.02);

    const userGender = detectUserGender(user && user.firstName);
    const intent = analyzeIntent(query, history);
    const persona = buildPersona(history, session, intent);

    const useNameThisReply = shouldUseName(session, intent);
    if (useNameThisReply) {
        session.messagesSinceLastName = 0;
        session.nameUsageCount++;
    }

    if (intent.shouldClarify) session.clarifyCount = (session.clarifyCount || 0) + 1;

    if (intent.styleHint && intent.styleHint !== 'default' && !session.topicsDiscussed.includes(intent.styleHint)) {
        session.topicsDiscussed.push(intent.styleHint);
        if (session.topicsDiscussed.length > 10) session.topicsDiscussed.shift();
    }
    if (intent.styleHint && intent.styleHint !== 'default') {
        session.lastTopic = intent.styleHint;
    }
    session.lastUserIntent = intent.styleHint;

    try {
        const prompt = intent.isSimple
            ? buildLightPrompt(section, query, user, expert, history, dialect || 'saudi', session, intent, userGender, context, useNameThisReply)
            : buildPrompt(section, query, user, expert, history, dialect || 'saudi', persona, userGender, session, intent, context, useNameThisReply);

        const maxTokens = intent.isSimple
            ? 300
            : (persona.mode === 'detailed' ? 4000 : persona.mode === 'expanded' ? 2500 : 1500);

        const result = await callGemini(prompt, maxTokens);

        const { reason: aiCloseReason, cleaned } = extractCloseToken(result.text);
        const replies = splitIntoChunks(cleaned, persona.mode);
        const closeDecision = shouldClose(intent, history, session, aiCloseReason);
        const timing = computeReplyTiming(replies, persona, query, intent, context);

        const response = {
            replies,
            model: result.model,
            mood: persona.mood,
            responseMode: persona.mode,
            responseMultiplier: Math.round(persona.multiplier * 100) / 100,
            energy: Math.round(persona.energy * 100) / 100,
            tiredness: Math.round(session.tiredness * 100) / 100,
            userGender,
            emotion: detectEmotion(query),
            usedNameThisReply: useNameThisReply,
            askingBack: !!intent.shouldClarify,
            context: { type: contextType, gapMs: Math.max(0, Number(context.gapMs) || 0) },
            intent: {
                type: intent.wantsSomethingElse ? 'wants_else'
                    : intent.isGeneralQuestion ? 'general'
                    : intent.isMetaQuestion ? 'meta'
                    : intent.isAboutPlatform ? 'aboutplatform'
                    : intent.isGreeting ? 'greeting'
                    : intent.isSmallTalk ? 'smalltalk'
                    : intent.isAboutSelf ? 'aboutself'
                    : intent.isBotTest ? 'bottest'
                    : intent.isThanks ? 'thanks'
                    : intent.isFarewell ? 'farewell'
                    : intent.isRude ? 'rude'
                    : intent.isOffTopic ? 'offtopic'
                    : intent.isMultiQuestion ? 'multiquestion'
                    : intent.isYesNo ? 'yesno'
                    : intent.isForecastRequest ? 'forecast'
                    : intent.isConsultationRequest ? 'consultation'
                    : intent.isFollowUp ? 'followup'
                    : 'normal',
                lengthHint: intent.lengthHint,
                styleHint: intent.styleHint,
                aiRequestedClose: !!aiCloseReason,
                usedLightPrompt: intent.isSimple,
                isGeneralQuestion: intent.isGeneralQuestion,
                isMetaQuestion: intent.isMetaQuestion,
                isMultiQuestion: intent.isMultiQuestion,
                detectedQuestions: intent.questions,
                hasTypos: intent.hasTypos,
                shouldClarify: intent.shouldClarify
            },
            replyCount: replies.length,
            timing: {
                delayMs: timing.delayMs,
                perReply: timing.perReply,
                readingMs: timing.readingMs,
                thinkingMs: timing.thinkingMs
            }
        };

        if (closeDecision.close) {
            const cooldownMs = COOLDOWNS[closeDecision.reason] || COOLDOWNS.user_done;
            session.cooldownUntil = Date.now() + cooldownMs;
            session.closeReason = closeDecision.reason;
            response.closed = true;
            response.closeReason = closeDecision.reason;
            response.closeSource = closeDecision.source;
            response.cooldownMinutes = Math.floor(cooldownMs / 60000);
        }

        res.json(response);
    } catch (e) {
        console.error('❌ analyze error:', e.message);
        res.status(500).json({ error: 'فشل التحليل' });
    }
});

/* ═══════════════════════════════════════════════════════════════
   405 Handler قبل 404
   ═══════════════════════════════════════════════════════════════ */
const REGISTERED_ROUTES = [
    { path: '/',             methods: ['GET', 'HEAD', 'OPTIONS'] },
    { path: '/api/status',   methods: ['GET', 'HEAD', 'OPTIONS'] },
    { path: '/ping',         methods: ['GET', 'HEAD', 'OPTIONS'] },
    { path: '/api/feedback', methods: ['POST', 'OPTIONS'] },
    { path: '/api/handoff',  methods: ['POST', 'OPTIONS'] },
    { path: '/api/analyze',  methods: ['POST', 'OPTIONS'] }
];

app.use((req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const matched = REGISTERED_ROUTES.find(r =>
        r.path === req.path || (r.path === '/' && req.path === '/')
    );

    if (matched && !matched.methods.includes(req.method)) {
        res.setHeader('Allow', matched.methods.join(', '));
        return res.status(405).json({
            error: 'method_not_allowed',
            method: req.method,
            path: req.path,
            allow: matched.methods,
            message: `الطريقة ${req.method} غير مدعومة لهذا المسار`
        });
    }
    next();
});

/* 404 */
app.use((req, res) => {
    res.status(404).json({
        error: 'not_found',
        path: req.path,
        method: req.method,
        publicUrl: PUBLIC_URL,
        hint: 'تأكد من المسار: /api/analyze, /api/handoff, /api/feedback, /api/status, /ping, /'
    });
});

/* Error middleware */
app.use((err, req, res, next) => {
    console.error('🚨 Unhandled error:', err && err.message);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

/* ═══════════════════════════════════════════════════════════════
   Global handlers + Start
   ═══════════════════════════════════════════════════════════════ */
let server = null;
let shuttingDown = false;

function gracefulShutdown(signal, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} — بدء الإغلاق...`);
    if (!server || !server.listening) { process.exit(code); return; }
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 5000).unref();
}

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err && err.message ? err.message : err);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception:', err);
    gracefulShutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT',  () => gracefulShutdown('SIGINT',  0));

server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ منصة استشارات forG — v15.5.1 — البورت ${PORT}`);
    console.log(`🌐 URL: ${PUBLIC_URL}`);
    console.log(`📄 index.html: ${fs.existsSync(HTML_FILE) ? '✅ موجود' : '❌ غير موجود'}`);
    console.log(`🕐 الوقت (السعودية): ${getSaudiHour()}:${String(getSaudiMinute()).padStart(2, '0')}`);
    console.log(`🔑 GEMINI_API_KEY: ${API_KEY ? '✅ موجود' : '❌ مفقود'}`);
    console.log(`🌐 fetch: ${fetchImpl ? '✅ مدمج' : '❌ غير متوفر'}`);
    console.log(`🛡️  Rate limit: ${RATE_MAX}/${RATE_WINDOW_MS / 1000}s لكل IP`);
    console.log(`✅ trust proxy مفعّل`);
    console.log(`✅ CORS: ${CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS.join(', ')}`);
    console.log(`✅ OPTIONS handler مفعّل — 405 مُصلَح`);
});
