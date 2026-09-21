const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

const INITIAL_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
let availableModels = [...INITIAL_MODELS];
let modelsLastFetched = 0;
if (!API_KEY) console.error('❌ GEMINI_API_KEY غير موجود!');

// ============================================================
// ============ اكتشاف النماذج ============
// ============================================================
async function fetchAvailableModels() {
    if (!API_KEY) return [];
    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const d = await r.json();
        if (!d.models) return [];
        const models = d.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(n => !n.includes('embedding') && !n.includes('aqa') && !n.includes('imagen') && !n.includes('veo') && !n.includes('gemma'));
        models.sort((a, b) => {
            const s = m => { let x = 0;
                if (m.includes('2.5-flash')) x -= 100;
                if (m.includes('2.0-flash')) x -= 90;
                if (m.includes('2.5-pro')) x -= 80;
                if (m.includes('flash-latest')) x -= 70;
                if (m.includes('flash')) x -= 30;
                if (m.includes('pro')) x -= 20;
                if (m.includes('preview')) x += 50;
                if (m.includes('exp')) x += 50;
                return x; };
            return s(a) - s(b);
        });
        return models;
    } catch (e) { return []; }
}
async function refreshModels(force = false) {
    if (!force && Date.now() - modelsLastFetched < 3600000) return;
    const m = await fetchAvailableModels();
    if (m.length) { availableModels = m; modelsLastFetched = Date.now(); }
}
refreshModels(true);

// ============================================================
// 🚻 كشف الجنس من الاسم — نسخة شاملة
// ============================================================
const FEMALE_NAMES = new Set([
    'فاطمة','زينب','مريم','خديجة','عائشة','حفصة','رقية','سكينة','نفيسة',
    'سارة','نورة','نورا','ليلى','هند','منى','ريم','دانة','دانه','هيا','أمل','رنا','لينا','دينا',
    'إيمان','سامية','سلمى','سلمي','نادية','ماريا','ليال','روان','جواهر','شهد','لطيفة','نوف',
    'عبير','أسماء','أميرة','عهود','رغد','ريما','سمر','سهى','شذى','صفاء','ضحى','علا','غادة',
    'فرح','لمى','لمار','مروة','ملاك','منال','مي','ميّ','هدى','وفاء','يارا',
    'تالا','تولين','جوري','رتاج','ريفال','ليان','جنى','ديما','جمانة','دانا','كادي','ميلاف',
    'أروى','إسراء','آلاء','بشاير','بدور','تهاني','جميلة','حصة','حنان','خلود','دلال',
    'رزان','رولا','رهام','سجى','سديم','سهام','شروق','صيتة','غالية',
    'لجين','لولوة','مشاعل','منيرة','مها','مودة','ميسم','نجود','ندى','نوال','نهى',
    'هاجر','وجدان','وضحى','ياسمين','يمنى','أنوار','أفنان','بشرى','حور','حوراء',
    'رؤى','رفيف','رنيم','سلوى','سمية','سناء','شيماء','صابرين','عالية','عزيزة','عليا',
    'غيداء','فدوى','قمر','كفاح','ماجدة','ملك','ميساء','نجلاء','نور','هالة','هبة'
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
    'رائد','غيث','حارث','همام','مهند','وسام','بهاء','ضياء','صفوان','عدي','زيد',
    'معتز','أشرف','أكرم','أنور','باسم','بشير','توفيق','جهاد',
    'حازم','خليل','رشيد','سامر','سمير','صلاح','ظافر','عاطف','عبدالحكيم','عقيل',
    'فؤاد','كمال','لؤي','مأمون','متولي','مجدي','مراد','مصعب','منذر','منير',
    'نجيب','نذير','نعمان','هشام','يعمر'
]);

function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const n = firstName.trim().replace(/[أإآ]/g, 'ا').replace(/ـ/g, '');
    if (!n) return 'unknown';

    if (FEMALE_NAMES.has(firstName) || FEMALE_NAMES.has(n)) return 'female';
    if (MALE_NAMES.has(firstName) || MALE_NAMES.has(n)) return 'male';

    // أسماء لاتينية
    if (/^(Sara|Sarah|Nora|Noura|Layla|Laila|Mariam|Maryam|Fatima|Aisha|Rania|Dina|Dana|Hind|Mona|Noor|Nour|Huda|Salma|Yasmin|Jana|Lina|Lamar|Tala|Yara)$/i.test(n)) return 'female';
    if (/^(Ahmed|Ahmad|Mohamed|Mohammed|Muhammad|Khalid|Omar|Tariq|Faisal|Fahd|Saad|Bader|Sultan|Majed|Yousef|Yusuf|Rami|Sami|Hassan|Hussain|Ali|Mustafa|Karim|Ammar)$/i.test(n)) return 'male';

    // قواعد حروف
    if (/[ة]$/.test(n) && n.length > 2) return 'female';
    if (/[ى]$/.test(n) && n.length > 2) return 'female';

    return 'unknown';
}

function genderInstructions(gender, name) {
    if (gender === 'female') return `# ⚠️ جنس المستخدم
الاسم "${name}" → **أنثى**. خاطبها بصيغة المؤنث دائماً:
"أنتِ"، "تفضلي"، "عندكِ"، "تستطيعين"، "رأيكِ"، "لكِ"، "قلتِ"، "شعرتِ".`;
    if (gender === 'male') return `# ⚠️ جنس المستخدم
الاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر:
"أنت"، "تفضل"، "عندك"، "تستطيع"، "رأيك"، "لك"، "قلت"، "شعرت".`;
    return `# جنس المستخدم
غير محدد من الاسم "${name}". استخدم صيغة المذكر كافتراضي، أو صياغة محايدة.`;
}

// ============================================================
// 🗄️ الجلسات (Sessions) — مع تتبع الوقاحة
// ============================================================
const SESSIONS = new Map();

const COOLDOWNS = {
    user_done: 20 * 60 * 1000,
    trolling: 30 * 60 * 1000,
    bored: 15 * 60 * 1000,
    deep_close: 10 * 60 * 1000,
    rude: 30 * 60 * 1000
};

function getUserKey(user, section) {
    return `${section}::${user?.firstName || 'anon'}::${user?.age || '0'}`;
}

function getSession(userKey) {
    if (!SESSIONS.has(userKey)) {
        SESSIONS.set(userKey, {
            mood: null,
            messageCount: 0,
            lastActivity: Date.now(),
            usedOpeners: [],
            cooldownUntil: 0,
            closeReason: null,
            rudeCount: 0,        // ✅ إضافة: تتبع الإساءات
            trollingCount: 0,    // ✅ إضافة: تتبع العبث
            emotionHistory: []   // ✅ إضافة: تاريخ الحالات العاطفية
        });
    }
    return SESSIONS.get(userKey);
}

// تنظيف الجلسات القديمة
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of SESSIONS.entries()) {
        if (now - session.lastActivity > 3 * 60 * 60 * 1000) SESSIONS.delete(key);
    }
}, 30 * 60 * 1000);

// ============================================================
// 🌍 اللهجات (14 لهجة)
// ============================================================
const DIALECTS = {
    saudi:       { name: 'خليجي سعودي',   country: 'السعودية', vocab: ['وش','كذا','زين','الحين','ايش','على طول'],   tone: 'لبق، محترم، مباشر',  example: 'والله شوف، الذهب الحين عالق.' },
    emirati:     { name: 'خليجي إماراتي', country: 'الإمارات', vocab: ['شو','شحال','زين','تو','عيل'],               tone: 'هادئ، مهني',         example: 'شوف، الموضوع يحتاج تفكير.' },
    kuwaiti:     { name: 'خليجي كويتي',   country: 'الكويت',  vocab: ['شلون','شنو','چذي','ترى','هسه'],              tone: 'ودود، دافئ',         example: 'شلونك؟ الذهب شنو وضعه الحين؟' },
    egyptian:    { name: 'مصري',          country: 'مصر',     vocab: ['إزاي','يعني','كده','دلوقتي','بص'],            tone: 'ودود، ساخر بلطف',   example: 'بص يا باشا، الذهب دلوقتي واقف.' },
    syrian:      { name: 'شامي سوري',     country: 'سوريا',   vocab: ['شو','لك','هلق','تمام','خلص'],                 tone: 'لبق، حيوي',          example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese:    { name: 'شامي لبناني',   country: 'لبنان',   vocab: ['شو','كتير','منيح','هلق','هيدا'],              tone: 'حيوي، دافئ',         example: 'شو الأخبار؟ الذهب اليوم كتير متقلب.' },
    jordanian:   { name: 'شامي أردني',    country: 'الأردن',   vocab: ['شو','هاد','هسع','منيح','زي'],                 tone: 'رصين، مباشر',        example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني',  country: 'فلسطين',  vocab: ['شو','هاد','زي','منيح','كيف'],                 tone: 'دافئ، صريح',         example: 'شو رأيك؟ الذهب هالفترة حساس.' },
    iraqi:       { name: 'عراقي',         country: 'العراق',  vocab: ['شلون','شكو ماكو','هواية','هسا','عيني'],       tone: 'دافئ، ودود',         example: 'شلونك عيني؟ الذهب هسا وضعه حساس.' },
    yemeni:      { name: 'يمني',          country: 'اليمن',   vocab: ['كيف','شو','زين','الحين','عاد'],               tone: 'بسيط، صادق',         example: 'يا رجل، الذهب الحين واقف.' },
    moroccan:    { name: 'مغاربي مغربي',  country: 'المغرب',  vocab: ['كيفاش','دابا','بزاف','واخا','مزيان'],          tone: 'دافئ',              example: 'كيفاش صاحبي؟ الذهب دابا مو واضح.' },
    algerian:    { name: 'مغاربي جزائري', country: 'الجزائر', vocab: ['كيفاش','دروك','بزاف','واه','صاحبي'],          tone: 'صريح',              example: 'واه خويا، الذهب دروك واقف.' },
    tunisian:    { name: 'مغاربي تونسي',  country: 'تونس',    vocab: ['كيفاش','برشا','باهي','تو','يعيشك'],           tone: 'ودود',              example: 'كيفاش؟ الذهب تو واقف.' },
    sudanese:    { name: 'سوداني',        country: 'السودان', vocab: ['كيفن','يا زول','شنو','عديل','سمح'],           tone: 'ودود، بسيط',         example: 'كيفن يا زول؟ الذهب شنو؟' }
};

// مفردات تخصصية لكل قسم
const SECTION_VOCAB = {
    gold:         ['الأونصة','السبيكة','العيار','التخصيص','التحوط'],
    stocks:       ['التقييم','التوزيعات','المكرر','السيولة','القطاع'],
    macro:        ['الفائدة','التضخم','السياسة النقدية','الدورة','السيولة'],
    geopolitical: ['التصعيد','الممرات','الإمداد','المخاطر','التوترات'],
    budget:       ['الميزانية','الالتزامات','الادخار','الطوارئ','التقاعد'],
    crypto:       ['المحفظة','التنظيم','التقلب','السيولة','الأمان']
};

// ============================================================
// 🧠 شخصية القسم — عمق مهني
// ============================================================
const SECTION_PERSONALITY = {
    gold: {
        backstory: 'أتابع أسواق المعادن الثمينة منذ 2008، مررت بدورات صعود وهبوط متعددة.',
        pet_peeve: 'من يبحث عن ضمانات قاطعة في أسواق متقلبة.',
        opinion: 'أميل للحيازة طويلة الأجل مع تنويع، لا للمضاربة اللحظية.',
        phrase: 'الذهب أصل دفاعي قبل أن يكون أصل ربح.',
        quirks: ['يفرّق بين الأونصة والكيلو', 'يذكر نسب التخصيص المقترحة'],
        avoid: 'لا تنصح بالدخول بكل رأس المال، نبّه دائماً.'
    },
    stocks: {
        backstory: 'عملت في تحليل الأسهم عبر دورات 2018 و2020 و2022.',
        pet_peeve: 'من يستثمر بناءً على "سمعت" أو "قال لي".',
        opinion: 'التقييم الجوهري أساس القرار، لا العاطفة أو الترند.',
        phrase: 'السوق مقياس جماعي، لكن قرارك فردي.',
        quirks: ['يذكر P/E و FCF', 'يفرّق بين القيمة والنمو'],
        avoid: 'لا تذكر أسهم بأسماء محددة كتوصية شراء.'
    },
    macro: {
        backstory: 'أبحاثي تركّز على السياسة النقدية وأثرها على الأصول.',
        pet_peeve: 'تبسيط الاقتصاد الكلي لدرجة الخطأ.',
        opinion: 'الفائدة أقوى محرك للأصول قصير المدى.',
        phrase: 'الفائدة ضغط الدم، والتضخم الحرارة.',
        quirks: ['يستخدم "سياسة نقدية" و"مالية"', 'يربط بين الاقتصادات'],
        avoid: 'لا تتحدث في السياسة الحزبية.'
    },
    geopolitical: {
        backstory: 'تابعت أثر الأزمات الجيوسياسية على الأسواق من 2011 حتى اليوم.',
        pet_peeve: 'ربط كل حدث بأسعار النفط بشكل سطحي.',
        opinion: 'الأسواق تبالغ في رد الفعل الأول ثم تصحح.',
        phrase: 'قبل التصعيد، السوق يمنح فرص خروج.',
        quirks: ['يذكر الممرات البحرية', 'يفرّق بين الحدث وأثره'],
        avoid: 'لا تنحاز سياسياً، حلّل فقط.'
    },
    budget: {
        backstory: 'درّبت مئات الأفراد على إدارة ميزانياتهم وخططهم المالية.',
        pet_peeve: 'من يطلب حلولاً سحرية دون تغيير السلوك.',
        opinion: 'قاعدة 50/30/20 مفيدة كإطار لا كقيد.',
        phrase: 'الميزانية وعي، ليست حرمان.',
        quirks: ['يسأل عن الدخل والالتزامات', 'يعطي أرقاماً عملية'],
        avoid: 'لا تحكم على المستخدم، كن داعماً.'
    },
    crypto: {
        backstory: 'تابعت دورات الكريبتو من 2017، مررت بانهيارات وارتفاعات.',
        pet_peeve: 'من يدخل بكل رأس ماله في عملة واحدة.',
        opinion: 'التنظيم يتسارع، والأصول الكبرى أكثر قدرة على البقاء.',
        phrase: 'السوق لا ينام، لكن محفظتك تحتاج نوماً آمناً.',
        quirks: ['يحذّر من المشاريع الوهمية', 'يذكر دورات الهبوط'],
        avoid: 'لا تدفع للشراء، نبّه على المخاطر دائماً.'
    }
};

// ============================================================
// 💙 التعاطف العاطفي — النسخة المُصلَحة
// ============================================================
const EMOTIONAL_REACTIONS = {
    worried:    ['قلقك مفهوم.', 'طبيعي تسأل هذا الآن.', 'لا تتخذ قراراً تحت ضغط القلق.'],
    excited:    ['حماسك مفهوم، لكن دعنا نهدأ قليلاً.', 'الحماس عدوّ القرار السليم.'],
    confused:   ['الموضوع ليس معقداً كما يبدو، خلنا نفككه.', 'خلنا نمشي خطوة بخطوة.'],
    frustrated: ['إحباطك مفهوم، السوق مرهق.', 'خذ خطوة للخلف قبل القرار.'],
    sad:        ['أفهم شعورك.', 'طبيعي تحسّ كذا، السوق مرهق.'],
    angry:      ['أفهم إنك متضايق.', 'خلنا نهدأ ونشوف الموضوع بمنطق.']
};

/**
 * ✅ الإصلاح: ترتيب الفحص مهم — الأكثر تحديداً أولاً
 * sad قبل frustrated لأن "زعلان/حزين" قد تُلتقط في frustrated
 */
function detectEmotion(query) {
    const q = query.toLowerCase();
    if (/(قلق|خايف|خوف|متوتر|مرتبك)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|مبسوط|متشوق)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض|مو واضح)/i.test(q)) return 'confused';
    if (/(غاضب|معصب|منرفز|مضايق)/i.test(q)) return 'angry';
    // ✅ sad قبل frustrated
    if (/(حزين|زعلان|مكسور|مكتئب)/i.test(q)) return 'sad';
    if (/(زهقت|تعبت|يئست|خسرت|محبط)/i.test(q)) return 'frustrated';
    return null;
}

// ============================================================
// 🎯 تحليل النية — نسخة محسّنة
// ============================================================
function analyzeIntent(q, history) {
    const trimmed = q.trim();
    const qLen = trimmed.length;
    const recentMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content).slice(-6);

    // 🎯 حالات خاصة
    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|صباح النور|مساء الخير|مساء النور|كيف حالك|كيفك|كيف الحال|شلونك|شو أخبارك|hi|hello|hey|هاي)/i.test(trimmed) && qLen < 35;
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|سلام|بسلامة|تصبح على خير|الى اللقاء|إلى اللقاء)/i.test(trimmed) && qLen < 25;
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية|يعطيكم العافية|جزاك الله|بارك الله)/i.test(trimmed) && qLen < 40;
    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(trimmed);
    const isGibberish = /^[\s\W_]+$/.test(trimmed) || /(.)\1{4,}/.test(trimmed);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;
    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 5) trollScore += 2;
    if (isGibberish) trollScore += 2;

    // 🎯 خارج الموضوع
    const isOffTopic = /(كرة القدم|مباراة|كورة|لعبة|بلايستيشن|فيلم|مسلسل|أغنية|موسيقى|طقس|سيارة|زواج|طلاق)/i.test(trimmed) && !/(استثمار|مال|سوق|ذهب|سهم|عملة|تضخم|فائدة|ميزانية|محفظة)/i.test(trimmed);

    // 📏 طول الرد
    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول|لا تطل)/i.test(trimmed);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع|مفصل)/i.test(trimmed);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح|بم تنصح)/i.test(trimmed);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس|تتوقع|توقعك|ما توقعاتك)/i.test(trimmed);

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks) lengthHint = 'very_short';
    else if (wantsBrief || isVeryShort) lengthHint = 'very_short';
    else if (qLen < 40) lengthHint = 'short';
    else if (qLen >= 150 || wantsDetail || wantsAnalysis) lengthHint = 'long';

    let styleHint = 'default';
    if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsDetail) styleHint = 'detail';

    // 🎭 الحالة
    let state = 'calm';
    if (isRude) state = 'rude';
    else if (trollScore >= 3) state = 'trolling';
    else if (isOffTopic) state = 'offtopic';
    else if (isThanks || isFarewell) state = 'done';
    else if (/(حزين|زعلان|مكسور|مكتئب)/i.test(trimmed)) state = 'sad';
    else if (/(زهقت|تعبت|يئست|خسرت|محبط)/i.test(trimmed)) state = 'frustrated';
    else if (/(قلق|خايف|خوف|متوتر)/i.test(trimmed)) state = 'worried';
    else if (/(غاضب|معصب|منرفز)/i.test(trimmed)) state = 'angry';
    else if (/(محتار|ملخبط|مو فاهم|غامض)/i.test(trimmed)) state = 'confused';
    else if (/(متحمس|حماس|فرحان)/i.test(trimmed)) state = 'excited';
    else if (/(ملل|طفش|زهقان)/i.test(trimmed)) state = 'bored';

    return {
        isGreeting, isFarewell, isThanks, isRude, isOffTopic,
        trollScore, lengthHint, styleHint, state, qLen,
        isDone: isThanks || isFarewell
    };
}

// ============================================================
// 🎭 منع تكرار الشخصية (mood + opener)
// ============================================================
const MOODS = ['neutral','warm','professional','casual','analytical','concise','thoughtful','patient','curious','blunt'];

const OPENERS = {
    very_short: ['شوف.','بصراحة؟','همم.','طيب.','أها.','تمام.'],
    short:      ['شوف،','بصراحة،','خلني أفكر...','المهم،','يعني،'],
    medium:     ['شوف، خلنا نكون واضحين.','بصراحة كذا.','خلني أراجع معك.','خلني أكون صريح،'],
    long:       ['خلنا نفككها خطوة خطوة.','طيب، خلني أشرح بوضوح.','الأمر يحتاج تفصيل.']
};

function buildPersona(history, session, intent) {
    const availableMoods = MOODS.filter(m => !session.usedOpeners.includes('m_' + m));
    let mood;
    if (availableMoods.length) {
        mood = availableMoods[Math.floor(Math.random() * availableMoods.length)];
    } else {
        session.usedOpeners = session.usedOpeners.filter(x => !x.startsWith('m_'));
        mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    }
    session.usedOpeners.push('m_' + mood);
    if (session.usedOpeners.length > 20) session.usedOpeners.shift();

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const available = openerList.filter(o => !session.usedOpeners.includes('o_' + o));
    const opener = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : null;
    if (opener) session.usedOpeners.push('o_' + opener);

    return { mood, opener };
}

// ============================================================
// 🎯 بناء البرومبت — النسخة الموحّدة
// ============================================================
function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const sectionVocab = SECTION_VOCAB[section] || [];
    const intent = analyzeIntent(query, history);
    const emotion = detectEmotion(query);
    const seed = Math.floor(Math.random() * 99999);

    const now = new Date();
    const hour = now.getHours();
    const isLateNight = hour >= 23 || hour < 6;
    const dayPart = hour < 6 ? 'الفجر' : hour < 11 ? 'الصباح' : hour < 15 ? 'الظهيرة' : hour < 19 ? 'العصر' : hour < 23 ? 'المساء' : 'الليل';

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-6).map(h =>
            `${h.role === 'user' ? (user?.firstName || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 200)}`
          ).join('\n') + '\n---
