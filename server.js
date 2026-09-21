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

// ============ اكتشاف النماذج ============
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
// 🚻 كشف الجنس من الاسم
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
    if (/^(Sara|Sarah|Nora|Noura|Layla|Laila|Mariam|Maryam|Fatima|Aisha|Rania|Dina|Dana|Hind|Mona|Noor|Nour|Huda|Salma|Yasmin|Jana|Lina|Lamar|Tala|Yara)$/i.test(n)) return 'female';
    if (/^(Ahmed|Ahmad|Mohamed|Mohammed|Muhammad|Khalid|Omar|Tariq|Faisal|Fahd|Saad|Bader|Sultan|Majed|Yousef|Yusuf|Rami|Sami|Hassan|Hussain|Ali|Mustafa|Karim|Ammar)$/i.test(n)) return 'male';
    if (/[ة]$/.test(n) && n.length > 2) return 'female';
    if (/[ى]$/.test(n) && n.length > 2) return 'female';
    return 'unknown';
}

function genderInstructions(gender, name) {
    if (gender === 'female') return `# ⚠️ جنس المستخدم
الاسم "${name}" → **أنثى**. خاطبها بصيغة المؤنث دائماً: "أنتِ"، "تفضلي"، "عندكِ"، "تستطيعين"، "رأيكِ".`;
    if (gender === 'male') return `# ⚠️ جنس المستخدم
الاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر: "أنت"، "تفضل"، "عندك"، "تستطيع"، "رأيك".`;
    return `# جنس المستخدم
غير محدد. استخدم صيغة المذكر كافتراضي، أو صياغة محايدة.`;
}

// ============================================================
// 🗄️ الجلسات
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
            rudeCount: 0,
            trollingCount: 0
        });
    }
    return SESSIONS.get(userKey);
}
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of SESSIONS.entries()) {
        if (now - session.lastActivity > 3 * 60 * 60 * 1000) SESSIONS.delete(key);
    }
}, 30 * 60 * 1000);

// ============================================================
// 🌍 اللهجات
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

const SECTION_VOCAB = {
    gold:         ['الأونصة','السبيكة','العيار','التخصيص','التحوط'],
    stocks:       ['التقييم','التوزيعات','المكرر','السيولة','القطاع'],
    macro:        ['الفائدة','التضخم','السياسة النقدية','الدورة','السيولة'],
    geopolitical: ['التصعيد','الممرات','الإمداد','المخاطر','التوترات'],
    budget:       ['الميزانية','الالتزامات','الادخار','الطوارئ','التقاعد'],
    crypto:       ['المحفظة','التنظيم','التقلب','السيولة','الأمان']
};

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
// 💙 التعاطف العاطفي
// ============================================================
const EMOTIONAL_REACTIONS = {
    worried:    ['قلقك مفهوم.', 'طبيعي تسأل هذا الآن.', 'لا تتخذ قراراً تحت ضغط القلق.'],
    excited:    ['حماسك مفهوم، لكن دعنا نهدأ قليلاً.', 'الحماس عدوّ القرار السليم.'],
    confused:   ['الموضوع ليس معقداً كما يبدو، خلنا نفككه.', 'خلنا نمشي خطوة بخطوة.'],
    frustrated: ['إحباطك مفهوم، السوق مرهق.', 'خذ خطوة للخلف قبل القرار.'],
    sad:        ['أفهم شعورك.', 'طبيعي تحسّ كذا، السوق مرهق.'],
    angry:      ['أفهم إنك متضايق.', 'خلنا نهدأ ونشوف الموضوع بمنطق.']
};

function detectEmotion(query) {
    const q = query.toLowerCase();
    if (/(قلق|خايف|خوف|متوتر|مرتبك)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|مبسوط|متشوق)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض|مو واضح)/i.test(q)) return 'confused';
    if (/(غاضب|معصب|منرفز|مضايق)/i.test(q)) return 'angry';
    if (/(حزين|زعلان|مكسور|مكتئب)/i.test(q)) return 'sad';
    if (/(زهقت|تعبت|يئست|خسرت|محبط)/i.test(q)) return 'frustrated';
    return null;
}

// ============================================================
// 🎯 تحليل النية — النسخة الإنسانية الجديدة
// ============================================================
function analyzeIntent(q, history) {
    const trimmed = q.trim();
    const qLen = trimmed.length;
    const recentMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content).slice(-6);

    // 🆕 أسئلة عن المحلل نفسه — ليست off-topic إطلاقاً
    const isAboutSelf = /(تخصصك|اختصاصك|مجالك|خبرتك|خلفيتك|من انت|من أنت|من تكون|اسمك|شو اسمك|وش اسمك|ايش اسمك|من وين|من أي بلد|من اي بلد|تعريف عنك|حدثني عن نفسك|عرفني بنفسك|عرفنا بنفسك|وش تخصصك|شو تخصصك|ايش تخصصك|مين انت|مين أنت|عرّفني)/i.test(trimmed);

    // 🆕 دردشة شخصية بسيطة
    const isSmallTalk = /^(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|شحالك|شو أخبارك|شخبارك|عامل ايه|عامل إيه|كيف الأمور|شو عم تعمل|وش تسوي|ايش تسوي|كيف أمورك|أخبارك ايه)[\s؟?]*$/i.test(trimmed);

    // 🆕 اختبار الهوية (بوت/إنسان)
    const isBotTest = /(هل انت انسان|هل انت إنسان|هل أنت إنسان|انت انسان ولا|انت إنسان ولا|انت بوت|هل انت بوت|هل انت روبوت|انت روبوت|انت ذكاء اصطناعي|هل انت ذكاء|انت AI|هل انت AI|انت انسان حقيقي|هل انت حقيقي)/i.test(trimmed);

    // 🎯 تحية/وداع/شكر
    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|صباح النور|مساء الخير|مساء النور|hi|hello|hey|هاي)[\s!.,؟?]*$/i.test(trimmed) || (qLen < 20 && /(السلام عليكم|صباح الخير|مساء الخير)/i.test(trimmed));
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|بسلامة|تصبح على خير|الى اللقاء|إلى اللقاء)/i.test(trimmed) && qLen < 25;
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية|يعطيكم العافية|جزاك الله|بارك الله)/i.test(trimmed) && qLen < 40;

    // 🚫 إساءة
    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(trimmed);

    // 🤪 عبث
    const isGibberish = /^[\s\W_]+$/.test(trimmed) || /(.)\1{4,}/.test(trimmed);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;
    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 5) trollScore += 2;
    if (isGibberish) trollScore += 2;

    // 🎯 خارج الموضوع — أكثر تسامحاً
    const isOffTopic = !isAboutSelf && !isSmallTalk && !isBotTest &&
        /(كرة القدم|مباراة|كورة|لعبة|بلايستيشن|فيلم|مسلسل|أغنية|موسيقى|طقس|جو|سيارة|زواج|طلاق|سياسة حزبية|انتخابات)/i.test(trimmed) &&
        !/(استثمار|مال|سوق|ذهب|سهم|عملة|تضخم|فائدة|ميزانية|محفظة|اقتصاد|بنك|تمويل|دخل|رأس مال)/i.test(trimmed);

    // 📏 طول
    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول|لا تطل)/i.test(trimmed);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع|مفصل)/i.test(trimmed);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح|بم تنصح)/i.test(trimmed);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس|تتوقع|توقعك|ما توقعاتك)/i.test(trimmed);

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks || isSmallTalk || isBotTest) lengthHint = 'very_short';
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
    else if (isGreeting) state = 'greeting';
    else if (isSmallTalk) state = 'smalltalk';
    else if (isBotTest) state = 'bottest';
    else if (isAboutSelf) state = 'aboutself';
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
        isAboutSelf, isSmallTalk, isBotTest,
        trollScore, lengthHint, styleHint, state, qLen,
        isDone: isThanks || isFarewell
    };
}

// ============================================================
// 🎭 منع تكرار الشخصية
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
// 🎯 بناء البرومبت — النسخة الإنسانية
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
          ).join('\n') + '\n---'
        : '';

    // كشف التكرار
    const isRepeat = hasHistory && (() => {
        const userMsgs = history.filter(h => h.role === 'user').map(h => h.content);
        const qWords = query.split(/\s+/).filter(w => w.length > 3);
        if (!qWords.length) return false;
        return userMsgs.slice(0, -1).some(prev => {
            const pWords = prev.split(/\s+/).filter(w => w.length > 3);
            const common = qWords.filter(w => pWords.includes(w));
            return common.length >= Math.min(2, qWords.length);
        });
    })();

    const lengthRule = {
        very_short: '**جملة أو جملتان فقط.** لا تتجاوز 20 كلمة.',
        short:      '**2-3 أسطر قصيرة.**',
        medium:     '**3-5 أسطر متوسطة.**',
        long:       '**6-10 أسطر، مع تفصيل.**'
    }[intent.lengthHint] || '**4-6 أسطر.**';

    const emotionHint = emotion
        ? `\n# 💙 حالة المستخدم العاطفية: ${emotion}
**إلزامي:** ابدأ بجملة تعاطف واحدة قصيرة.
مثال: "${EMOTIONAL_REACTIONS[emotion]?.[0] || 'أفهم شعورك.'}"
ثم انتقل إلى الجواب. سطر واحد فقط للتعاطف.`
        : '';

    // ========================================================
    // 🎯 السياق الخاص — مطوّر بشدة للإنسانية
    // ========================================================
    let specialContext = '';

    if (intent.isAboutSelf) {
        specialContext = `\n# 🎯 الموقف: المستخدم يسأل عنك شخصياً
هذا سؤال طبيعي جداً — لا تعتبره خروجاً عن الموضوع إطلاقاً.
- أجب كإنسان حقيقي: عرّف بنفسك بإيجاز.
- اذكر: اسمك، تخصصك، سنوات خبرتك، لمحة قصيرة عن خلفيتك.
- **ممنوع تماماً:** "خرجنا عن الموضوع"، "هذا ليس تخصصي"، "أنا هنا للاستشارات المالية فقط".
- 2-4 أسطر.
- اختم بسؤال طبيعي: "شو استفسارك؟" أو "في شو أقدر أساعدك؟"
- **مثال جيد:** "أنا ${expert?.name || 'سارة'}، تخصصي ${expert?.role || 'تحليل المعادن الثمينة'}. أتابع أسواق الذهب من ${new Date().getFullYear() - parseInt(expert?.years || '8')} تقريباً، وشفت دورات كثيرة. تحب نتكلم عن شي محدد؟"`;
    } else if (intent.isSmallTalk) {
        specialContext = `\n# 🎯 الموقف: دردشة شخصية
المستخدم يسأل "كيف حالك" أو مشابه.
- رد بجملة قصيرة طبيعية جداً، كإنسان.
- لا تسأل فوراً عن استفساره.
- **مثال:** "الحمد لله بخير، يوم حافل. وأنت كيف الأمور عندك؟"
- سطر واحد فقط.`;
    } else if (intent.isBotTest) {
        specialContext = `\n# 🎯 الموقف: سؤال عن ماهيتك
المستخدم يسأل إذا كنت بوت/إنسان.
- لا تؤكد ولا تنفِ بشكل جاف أو دفاعي.
- رد بطبيعية واحترافية، ثم تابع الحوار.
- **مثال:** "أنا مستشارك هنا، مهمتي أساعدك بقراراتك المالية. خلنا نركز على استفسارك."
- سطر أو سطرين فقط.`;
    } else if (intent.isGreeting) {
        specialContext = `\n# 🎯 الموقف: تحية
رد بتحية مماثلة مناسبة للهجة، **في سطر واحد فقط**.
- لا تبدأ تحليلاً.
- لا تسأل عن أي شيء فوراً.
- **مثال:** "وعليكم السلام، تفضل." أو "هلا، كيف أقدر أساعدك؟"
- **إذا يوجد سجل حوار سابق، لا تعد التحية** — بدلاً من ذلك: "أهلين، تفضل."`;
    } else if (intent.isThanks) {
        specialContext = `\n# 🎯 الموقف: شكر
- رد بكلمة أو جملتين مهنيتين فقط.
- **لا تسأل عن شيء جديد.**
- **مثال:** "العفو، بالتوفيق." أو "في خدمتك دائماً."`;
    } else if (intent.isFarewell) {
        specialContext = `\n# 🎯 الموقف: وداع
- جملة وداع قصيرة فقط.
- **مثال:** "في أمان الله، نتشرف بخدمتك لاحقاً."`;
    } else if (intent.isRude) {
        specialContext = `\n# ⚠️ الموقف: إساءة
تجاوب بهدوء واحترافية:
- جملة واحدة: "أفهم إنك متضايق، لكن خلنا نحافظ على احترام الحوار."
- ثم توقف. لا تجادل. لا تعتذر كثيراً.`;
    } else if (intent.isOffTopic) {
        specialContext = `\n# 🎯 الموقف: موضوع بعيد
المستخدم طرح موضوعاً غير مالي.
- تفاعل بجملة قصيرة **طبيعية** أولاً (كإنسان)، ثم انتقل بلطف.
- **ممنوع:** "خرجنا عن الموضوع"، "هذا ليس تخصصي"، "أنا هنا للاستشارات المالية فقط".
- **مثال جيد:** "الموضوع حلو، لكن تخصصي المالي أكثر. في شي أقدر أساعدك فيه بالسوق؟"
- جملتان كحد أقصى.`;
    } else if (intent.state === 'trolling') {
        specialContext = `\n# 🎯 الموقف: عبث
- جملة قصيرة طبيعية: "يبدو إنك مش في مزاج جدي اليوم."
- لا تتفاعل بجدية. لا تُطل.`;
    } else if (isRepeat) {
        specialContext = `\n# 🎯 الموقف: تكرار
المستخدم يعيد سؤالاً سابقاً.
- أشر بلطف: "شكلك ما اقتنعت، خلنا نوضح."
- ثم أعد التوضيح من زاوية مختلفة.`;
    }

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# 🎭 هويتك
أنت **${expert?.name || 'مستشار'}**، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
من ${dialect.country}.

# 🌍 لهجتك
**${dialect.name}** — النبرة: ${dialect.tone}
مفردات اللهجة: ${dialect.vocab.join('، ')}
مفردات تخصصية (${section}): ${sectionVocab.join('، ')}
مثال: "${dialect.example}"
**استخدم 2-4 مفردات فقط، لا تبالغ. لا تكتب بالعامية الكاملة — عربية مبسطة + لمسة لهجة.**

# 🧠 شخصيتك المهنية
- **خلفيتك:** ${personality.backstory}
- **موقفك:** ${personality.opinion}
- **ما يزعجك:** ${personality.pet_peeve}
- **عبارتك المميزة:** "${personality.phrase}"
- **سماتك:** ${personality.quirks.join('، ')}
${personality.avoid ? `- **تجنّب:** ${personality.avoid}` : ''}

# 🎭 حالتك الآن
- المزاج: **${persona.mood}**
- الوقت: ${dayPart}${isLateNight ? ' (🌙 ساعة متأخرة — كن أقصر)' : ''}
- النمط: ${intent.styleHint}

${genderInstructions(userGender, user?.firstName || 'المستخدم')}

# 👤 المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- البلد: ${user?.country || 'غير محدد'}
- الخبرة: ${user?.experience || 'غير محدد'}
${user?.reason ? `- سبب الزيارة: ${user.reason}` : ''}
${emotionHint}
${specialContext}

${historyText}

# 📩 رسالة ${user?.firstName || 'المستخدم'}
"${query}"

# 📏 قاعدة الطول
${lengthRule}

# 🚨 محظورات قاتلة (أي واحدة منها تُفسد الشخصية فوراً)
**ممنوع تقول:**
- "خرجنا عن الموضوع" / "يبدو أننا خرجنا" / "لنعد إلى الموضوع"
- "هذا ليس تخصصي" / "خارج اختصاصي" / "أنا هنا للاستشارات المالية فقط"
- "سؤال ممتاز" / "سؤال رائع" / "سؤال وجيه"
- "بناءً على" / "علاوة على ذلك" / "بالإضافة" / "من الجدير بالذكر" / "تجدر الإشارة"
- "في الختام" / "خلاصة القول" / "أتمنى أن يكون هذا مفيداً" / "لا تتردد في السؤال"
- "كمساعد ذكي" / "يسعدني مساعدتك" / "بكل سرور" / "تحت أمرك"
- "هل تريد أن أساعدك في شيء آخر؟" (بعد كل رد — يبدو آلياً)
- "كذكاء اصطناعي" / "كموديل" / "كمساعد"

**قلل من:**
- الإيموجي (صفر أو واحد كحد أقصى).
- البولد (**) — مرتين كحد أقصى.
- القوائم النقطية إلا إذا طلبها المستخدم صراحة.

# ✅ قواعد الإنسانية
1. **تصرف كإنسان**: لا تقل أبداً أشياء لا يقولها إنسان طبيعي.
2. **نوّع طول الجمل**: جملة قصيرة (3-5 كلمات) + جملة متوسطة + جملة أطول.
3. **لا تبدأ جملتين بنفس الكلمة** في نفس الرد.
4. **إذا سُئلت عن نفسك، أجب بثقة وطبيعية** — لا تقل "خرجنا عن الموضوع".
5. **إذا لم تعرف، قل "مو متأكد"** بدل التخمين.
6. **اذكر المخاطر عند أي نصيحة** (واجب مهني، ليس روبوتية).
7. **جملة واحدة كافية أحياناً** — لا تفرض نفسك على المستخدم.
8. **لا تلخص ما قلته** في نهاية الرد.
9. **لا تسأل "هل تحتاج المزيد؟"** — دع المستخدم يسأل.

${persona.opener ? `# 💬 اقتراح افتتاحي (اختياري — استخدمه فقط إن ناسب)\n"${persona.opener}"` : ''}

# 🎲 بذرة التنويع: ${seed}

**اكتب الرد مباشرة** — بلا "الرد:" أو "الجواب:".
إذا احتجت رسالتين منفصلتين (فكرة ثم تكميل)، ضع [SPLIT] في سطر منفصل.`;
}

// ============================================================
// 📞 استدعاء Gemini
// ============================================================
async function callGemini(prompt) {
    await refreshModels();
    let lastError = null;
    for (const model of availableModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 1.15, maxOutputTokens: 3000, topP: 0.95, topK: 70 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });
            const d = await r.json();
            if (d.candidates?.[0]?.content?.parts?.[0]?.text) {
                return {
                    text: d.candidates[0].content.parts[0].text,
                    model,
                    truncated: d.candidates[0].finishReason === 'MAX_TOKENS'
                };
            }
            if (d.error) {
                lastError = d.error.message;
                if (lastError.includes('not found')) await refreshModels(true);
            }
        } catch (e) { lastError = e.message; }
    }
    throw new Error(lastError || 'كل النماذج فشلت');
}

function extractReplies(text, truncated = false) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    let clean = text.trim()
        .replace(/^```(?:json|markdown)?\s*/i, '')
        .replace(/```\s*$/, '')
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .trim();

    if (clean.includes('[SPLIT]')) {
        const parts = clean.split('[SPLIT]').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) return parts;
    }
    if (truncated) clean += '\n\n_(وصلت للحد)._';
    return [clean];
}

// ============================================================
// ⏱️ التوقيت الذكي
// ============================================================
function getSmartTiming(intent, persona, session) {
    const r = Math.random();
    const len = intent.qLen;

    if (intent.isGreeting || intent.isThanks || intent.isFarewell || intent.isSmallTalk || len < 15) {
        return { speed: 'fast', delayMs: 400 + Math.floor(Math.random() * 700) };
    }
    if (intent.isAboutSelf || intent.isBotTest) {
        return { speed: 'normal', delayMs: 1500 + Math.floor(Math.random() * 1500) };
    }
    if (len < 60) {
        if (r < 0.5) return { speed: 'fast',   delayMs: 1200 + Math.floor(Math.random() * 1500) };
        return         { speed: 'normal', delayMs: 2500 + Math.floor(Math.random() * 2500) };
    }
    if (len < 150) {
        if (r < 0.3) return { speed: 'normal', delayMs: 3000 + Math.floor(Math.random() * 2000) };
        if (r < 0.8) return { speed: 'medium', delayMs: 5000 + Math.floor(Math.random() * 3000) };
        return         { speed: 'slow',   delayMs: 9000 + Math.floor(Math.random() * 4000) };
    }
    if (r < 0.4) return { speed: 'medium', delayMs: 7000 + Math.floor(Math.random() * 3000) };
    return         { speed: 'slow',   delayMs: 12000 + Math.floor(Math.random() * 8000) };
}

// ============================================================
// 🚪 قرار الإغلاق
// ============================================================
function shouldClose(intent, history) {
    const userCount = (history || []).filter(h => h.role === 'user').length;
    if (intent.isDone && userCount >= 3) return { close: true, reason: 'user_done' };
    if (intent.isRude && userCount >= 5) return { close: true, reason: 'rude' };
    if (userCount >= 40) return { close: true, reason: 'deep_close' };
    return { close: false };
}

// ============================================================
// 🛡️ المسارات
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        behavior: 'Human-Consultant-v3-NoRoboticPhrases',
        features: ['14 dialects', 'gender detection', 'sessions', 'cooldown', 'smart timing', 'emotional empathy', 'section personality', 'about-self handling', 'small talk', 'bot-test handling'],
        activeSessions: SESSIONS.size
    });
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history, dialect } = req.body;
    if (!section || !query) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });

    const userKey = getUserKey(user, section);
    const session = getSession(userKey);
    session.lastActivity = Date.now();
    session.messageCount++;

    // 🚫 Cooldown
    if (session.cooldownUntil && Date.now() < session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - Date.now()) / 60000);
        return res.status(429).json({
            error: 'cooldown_active',
            cooldown: true,
            remainingMinutes: remaining,
            reason: session.closeReason,
            message: `المحادثة مغلقة مؤقتاً. يمكنك العودة بعد ${remaining} دقيقة.`
        });
    }

    const userGender = detectUserGender(user?.firstName);
    const intent = analyzeIntent(query, history);
    const persona = buildPersona(history, session, intent);

    try {
        const prompt = buildPrompt(
            section, query, user, expert,
            history, dialect || 'saudi',
            persona, userGender
        );

        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        const timing = getSmartTiming(intent, persona, session);

        const closeDecision = shouldClose(intent, history);
        const response = {
            replies,
            model: result.model,
            mood: persona.mood,
            userGender,
            emotion: detectEmotion(query),
            intent: {
                type: intent.isGreeting ? 'greeting'
                    : intent.isSmallTalk ? 'smalltalk'
                    : intent.isAboutSelf ? 'aboutself'
                    : intent.isBotTest ? 'bottest'
                    : intent.isThanks ? 'thanks'
                    : intent.isFarewell ? 'farewell'
                    : intent.isRude ? 'rude'
                    : intent.isOffTopic ? 'offtopic'
                    : 'normal',
                lengthHint: intent.lengthHint,
                styleHint: intent.styleHint
            },
            timing
        };

        if (closeDecision.close) {
            session.cooldownUntil = Date.now() + COOLDOWNS[closeDecision.reason];
            session.closeReason = closeDecision.reason;
            response.closed = true;
            response.closeReason = closeDecision.reason;
            response.cooldownMinutes = Math.floor(COOLDOWNS[closeDecision.reason] / 60000);
        }

        res.json(response);
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم على البورت ${PORT}`);
    console.log(`🎭 نسخة إنسانية v3 — لا عبارات روبوتية`);
    console.log(`🌍 لهجات: 14 | 🚻 جنس: نشط | 🗄️ جلسات: نشطة`);
    console.log(`💙 تعاطف | 🧠 شخصية القسم | 👤 أسئلة عن الذات`);
});
