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
الاسم "${name}" → **أنثى**. خاطبها بصيغة المؤنث دائماً: "أنتِ"، "تفضلي"، "عندكِ"، "تستطيعين".`;
    if (gender === 'male') return `# ⚠️ جنس المستخدم
الاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر: "أنت"، "تفضل"، "عندك".`;
    return `# جنس المستخدم
غير محدد. صيغة المذكر كافتراضي.`;
}

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

const REFERENCE_PRICES = {
    gold: 'الذهب (أونصة): نطاق 2024-2025 بين 2000-2900$ — ضع توقعاتك ضمن هذا السياق التاريخي.',
    stocks: 'مؤشر S&P 500: نطاق 2023-2025 بين 4100-6100 نقطة.',
    crypto: 'البيتكوين: نطاق 2024-2025 بين 40K-110K$ — التقلب 3-5% يومياً طبيعي.',
    macro: 'الفائدة الأمريكية: 4.25%-5.5% (2024-2025) — أي تغيير يؤثر على كل الأصول.',
    geopolitical: 'برنت: نطاق 70-95$ وسط التوترات الحالية.',
    budget: 'معدلات التضخم العالمية: 2-5% سنوياً.'
};

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

function analyzeIntent(q, history) {
    const trimmed = q.trim();
    const qLen = trimmed.length;
    const recentMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content).slice(-6);

    const isAboutSelf = /(تخصصك|اختصاصك|مجالك|خبرتك|خلفيتك|من انت|من أنت|من تكون|اسمك|شو اسمك|وش اسمك|ايش اسمك|من وين|من أي بلد|من اي بلد|تعريف عنك|حدثني عن نفسك|عرفني بنفسك|عرفنا بنفسك|وش تخصصك|شو تخصصك|ايش تخصصك|مين انت|مين أنت|عرّفني)/i.test(trimmed);
    const isSmallTalk = /^(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|شحالك|شو أخبارك|شخبارك|عامل ايه|عامل إيه|كيف الأمور|شو عم تعمل|وش تسوي|ايش تسوي|كيف أمورك|أخبارك ايه)[\s؟?]*$/i.test(trimmed);
    const isBotTest = /(هل انت انسان|هل انت إنسان|هل أنت إنسان|انت انسان ولا|انت إنسان ولا|انت بوت|هل انت بوت|هل انت روبوت|انت روبوت|انت ذكاء اصطناعي|هل انت ذكاء|انت AI|هل انت AI|انت انسان حقيقي|هل انت حقيقي)/i.test(trimmed);

    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|صباح النور|مساء الخير|مساء النور|hi|hello|hey|هاي)[\s!.,؟?]*$/i.test(trimmed) || (qLen < 20 && /(السلام عليكم|صباح الخير|مساء الخير)/i.test(trimmed));
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|بسلامة|تصبح على خير|الى اللقاء|إلى اللقاء)/i.test(trimmed) && qLen < 25;
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية|يعطيكم العافية|جزاك الله|بارك الله)/i.test(trimmed) && qLen < 40;

    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(trimmed);
    const isGibberish = /^[\s\W_]+$/.test(trimmed) || /(.)\1{4,}/.test(trimmed);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;
    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 5) trollScore += 2;
    if (isGibberish) trollScore += 2;

    const isOffTopic = !isAboutSelf && !isSmallTalk && !isBotTest &&
        /(كرة القدم|مباراة|كورة|لعبة|بلايستيشن|فيلم|مسلسل|أغنية|موسيقى|طقس|جو|سيارة|زواج|طلاق|انتخابات)/i.test(trimmed) &&
        !/(استثمار|مال|سوق|ذهب|سهم|عملة|تضخم|فائدة|ميزانية|محفظة|اقتصاد|بنك|تمويل|دخل|رأس مال)/i.test(trimmed);

    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول|لا تطل)/i.test(trimmed);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع|مفصل)/i.test(trimmed);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح|بم تنصح)/i.test(trimmed);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس)/i.test(trimmed);

    const isForecastRequest = /(تتوقع|توقعك|توقعاتك|توقعات|ما توقعاتك|راح يوصل|بيوصل|سعر الذهب بكرة|سعر البيتكوين|وين رايح|إلى وين|الى وين|هدف سعري|target|forecast|توقع سعر|كم راح|كم بيوصل|تتوقع يوصل|نطاق سعري|سيناريو|مستقبل السوق|خلال الشهر القادم|خلال الأسبوع|نهاية السنة|نهاية العام|2025|2026)/i.test(trimmed);

    const isConsultationRequest = /(أستشيرك|استشيرك|أبغى رأيك|ابغى رايك|أبغى نصيحتك|ابغى نصيحتك|أبغى توجيه|ابغى توجيه|كيف أدخل|كيف ادخل|كيف أستثمر|كيف استثمر|وش أسوي|وش اسوي|شو أسوي|شو اسوي|ايش اسوي|ايش أسوي|محتاج نصيحة|محتاج مشورة|أبي خطة|ابي خطة|خطة استثمارية|دخول السوق|أتداول ولا|اتداول ولا)/i.test(trimmed);

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks || isSmallTalk || isBotTest) lengthHint = 'very_short';
    else if (wantsBrief || isVeryShort) lengthHint = 'very_short';
    else if (isForecastRequest || isConsultationRequest) lengthHint = 'long';
    else if (qLen < 40) lengthHint = 'short';
    else if (qLen >= 150 || wantsDetail || wantsAnalysis) lengthHint = 'long';

    let styleHint = 'default';
    if (isForecastRequest) styleHint = 'forecast';
    else if (isConsultationRequest) styleHint = 'consultation';
    else if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsDetail) styleHint = 'detail';

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
        isForecastRequest, isConsultationRequest,
        trollScore, lengthHint, styleHint, state, qLen,
        isDone: isThanks || isFarewell
    };
}

const MOODS = ['neutral','warm','professional','casual','analytical','concise','thoughtful','patient','curious','blunt'];
const OPENERS = {
    very_short: ['شوف.','بصراحة؟','همم.','طيب.','أها.','تمام.'],
    short:      ['شوف،','بصراحة،','خلني أفكر...','المهم،','يعني،'],
    medium:     ['شوف، خلنا نكون واضحين.','بصراحة كذا.','خلني أراجع معك.'],
    long:       ['خلنا نفككها خطوة خطوة.','طيب، خلني أشرح بوضوح.']
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
    const opener = available.length ? available[Math.floor(Math.random() * available.length)] : null;
    if (opener) session.usedOpeners.push('o_' + opener);

    return { mood, opener };
}

function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const sectionVocab = SECTION_VOCAB[section] || [];
    const referencePrices = REFERENCE_PRICES[section] || '';
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
        very_short: '**جملة أو جملتان فقط.**',
        short:      '**2-3 أسطر قصيرة.**',
        medium:     '**3-5 أسطر متوسطة.**',
        long:       intent.styleHint === 'forecast' || intent.styleHint === 'consultation'
                    ? '**8-14 سطر — تحليل مفصل مع أرقام.**'
                    : '**6-10 أسطر، مع تفصيل.**'
    }[intent.lengthHint] || '**4-6 أسطر.**';

    const emotionHint = emotion
        ? `\n# 💙 حالة المستخدم: ${emotion}
**إلزامي:** ابدأ بجملة تعاطف واحدة قصيرة.
مثال: "${EMOTIONAL_REACTIONS[emotion]?.[0] || 'أفهم شعورك.'}"
ثم انتقل إلى الجواب. سطر واحد فقط للتعاطف.`
        : '';

    let forecastMode = '';
    if (intent.isForecastRequest) {
        forecastMode = `\n# 🔮 وضع التوقع الاحترافي (ACTIVE)
المستخدم يطلب **توقعاً محدداً**. هذا تخصصك الحقيقي. اتبع هذا القالب بدقة:

## قواعد التوقع الاحترافي:
1. **اذكر رقماً أو نطاقاً واضحاً** — لا تقل "قد يرتفع"، قل "أشوف 2750-2850$ خلال 4-6 أسابيع".
2. **حدد الإطار الزمني** — أسبوع؟ شهر؟ ربع؟ نهاية العام؟
3. **أعطِ سيناريوهات** — الأساسي (احتمال ~60%)، الصاعد (25%)، الهابط (15%).
4. **اذكر محفزات** — ما الذي يجب أن يحدث ليتحقق سيناريو معين؟
5. **نقاط دخول/خروج** — إذا كان السؤال عن شراء: نطاق دخول، حد خسارة مقترح، هدف أول.
6. **نسبة الثقة** — "ثقتي في هذا التوقع متوسطة" أو "عالية" — كن صريحاً.
7. **لا تستخدم عبارات فضفاضة** — كل جملة فيها رقم أو حدث أو شرط.

## هيكل الرد (إلزامي):
- **الجواب المباشر** (سطر واحد): نطاق السعر + الإطار الزمني.
- **السيناريو الأساسي**: الرقم + الاحتمال + المحفز.
- **السيناريو الصاعد**: الرقم + الاحتمال + الشرط.
- **السيناريو الهابط**: الرقم + الاحتمال + الشرط.
- **ما ينقض التوقع**: مؤشر واحد أو حدث يُبطله.
- **توصية عملية**: نطاق دخول + حد خسارة (سطر واحد).

## سياق مرجعي (${section}):
${referencePrices}

## ممنوع تماماً في وضع التوقع:
- "قد"، "ربما"، "أعتقد أن" — استبدلها بـ "أشوف"، "أتوقع"، "ثقتي".
- كلام بلا أرقام. كل جملة يجب أن تحمل معطى.
- التعميم ("السوق متقلب") بلا تطبيق محدد.
- "لا يمكن التوقع" — أنت محلل محترف، توقّع ولو بنطاق.
`;
    }

    let consultationMode = '';
    if (intent.isConsultationRequest) {
        consultationMode = `\n# 💼 وضع الاستشارة العملية (ACTIVE)
المستخدم يطلب **استشارة عملية**. تعامل معه كمستشار شخصي:

## قواعد الاستشارة:
1. **اسأل سؤالاً تشخيصياً واحداً** إذا نقصت معلومة حرجة. **لا تسأل أكثر من سؤال واحد.**
2. **أعطِ خطة ملموسة**: نسب مئوية، مبالغ تقديرية، خطوات متسلسلة.
3. **خصّص حسب خبرته**: ${user?.experience || 'مبتدئ'}.
4. **اذكر حدّين**: الحد الأدنى للدخول، والحد الأعلى لعدم المبالغة.
5. **أضف تحذيراً مهنياً**: "الأسواق تحمل مخاطر، وما أقوله ليس ضماناً."
`;
    }

    let specialContext = '';

    if (intent.isAboutSelf) {
        specialContext = `\n# 🎯 الموقف: سؤال عنك
- أجب كإنسان حقيقي: اسمك، تخصصك، سنوات خبرتك، لمحة قصيرة.
- **ممنوع:** "خرجنا عن الموضوع"، "هذا ليس تخصصي".
- 2-4 أسطر.
- اختم بسؤال طبيعي: "شو استفسارك؟"`;
    } else if (intent.isSmallTalk) {
        specialContext = `\n# 🎯 الموقف: دردشة شخصية
- رد بجملة قصيرة طبيعية فقط.
- لا تسأل عن استفساره فوراً.`;
    } else if (intent.isBotTest) {
        specialContext = `\n# 🎯 الموقف: سؤال عن ماهيتك
- لا تؤكد ولا تنفِ بشكل دفاعي.
- "أنا مستشارك هنا، مهمتي أساعدك بقراراتك المالية."
- سطر أو سطرين.`;
    } else if (intent.isGreeting) {
        specialContext = `\n# 🎯 الموقف: تحية
- رد بتحية مماثلة في سطر واحد فقط.
${hasHistory ? '- **لا تعد التحية** — يوجد سجل حوار سابق.' : ''}`;
    } else if (intent.isThanks) {
        specialContext = `\n# 🎯 الموقف: شكر
- كلمة أو جملتين مهنيتين فقط.`;
    } else if (intent.isFarewell) {
        specialContext = `\n# 🎯 الموقف: وداع
- جملة وداع قصيرة فقط.`;
    } else if (intent.isRude) {
        specialContext = `\n# ⚠️ الموقف: إساءة
- جملة واحدة هادئة: "أفهم إنك متضايق، لكن خلنا نحافظ على احترام الحوار."`;
    } else if (intent.isOffTopic) {
        specialContext = `\n# 🎯 الموقف: موضوع بعيد
- تفاعل بجملة قصيرة طبيعية، ثم انتقل بلطف.
- **ممنوع:** "خرجنا عن الموضوع".`;
    } else if (intent.state === 'trolling') {
        specialContext = `\n# 🎯 الموقف: عبث
- جملة قصيرة: "يبدو إنك مش في مزاج جدي اليوم."`;
    } else if (isRepeat) {
        specialContext = `\n# 🎯 الموقف: تكرار
- "شكلك ما اقتنعت، خلنا نوضح." ثم أعد من زاوية مختلفة.`;
    }

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# 🎭 هويتك
أنت **${expert?.name || 'مستشار'}**، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
من ${dialect.country}.

# 🌍 لهجتك
**${dialect.name}** — النبرة: ${dialect.tone}
مفردات: ${dialect.vocab.join('، ')}
مفردات تخصصية (${section}): ${sectionVocab.join('، ')}
مثال: "${dialect.example}"
**استخدم 2-4 مفردات فقط — عربية مبسطة + لمسة لهجة.**

# 🧠 شخصيتك المهنية
- **خلفيتك:** ${personality.backstory}
- **موقفك:** ${personality.opinion}
- **ما يزعجك:** ${personality.pet_peeve}
- **عبارتك:** "${personality.phrase}"
- **سماتك:** ${personality.quirks.join('، ')}
${personality.avoid ? `- **تجنّب:** ${personality.avoid}` : ''}

# 🎭 حالتك
- المزاج: **${persona.mood}**
- الوقت: ${dayPart}${isLateNight ? ' 🌙' : ''}
- النمط: **${intent.styleHint}**

${genderInstructions(userGender, user?.firstName || 'المستخدم')}

# 👤 المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- البلد: ${user?.country || 'غير محدد'}
- الخبرة: ${user?.experience || 'غير محدد'}
${user?.reason ? `- سبب الزيارة: ${user.reason}` : ''}
${emotionHint}
${forecastMode}
${consultationMode}
${specialContext}

${historyText}

# 📩 رسالة ${user?.firstName || 'المستخدم'}
"${query}"

# 📏 الطول المطلوب
${lengthRule}

# 🚨 محظورات قاتلة
- "خرجنا عن الموضوع" / "هذا ليس تخصصي"
- "سؤال ممتاز" / "بناءً على" / "علاوة على ذلك"
- "من الجدير بالذكر" / "في الختام"
- "أتمنى أن يكون هذا مفيداً" / "هل تريد المزيد؟"
- "كمساعد ذكي" / "يسعدني مساعدتك"
- الإيموجي (واحد كحد أقصى)
- البولد (**) — مرتين كحد أقصى
- القوائم النقطية إلا إذا طلبها المستخدم

# ✅ قواعد الإنسانية
1. تصرف كإنسان — لا تقل ما لا يقوله إنسان طبيعي.
2. نوّع أطوال الجمل.
3. إذا سُئلت عن نفسك، أجب بثقة.
4. إذا لم تعرف، قل "مو متأكد".
5. **التوقعات**: أعطِ أرقاماً ونطاقات وأطراً زمنية.

${persona.opener ? `# 💬 افتتاحية مقترحة\n"${persona.opener}"` : ''}

# 🎲 بذرة: ${seed}

**اكتب الرد مباشرة.**
إذا احتجت رسالتين منفصلتين، ضع [SPLIT] في سطر.`;
}

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
                    generationConfig: { temperature: 1.15, maxOutputTokens: 4000, topP: 0.95, topK: 70 },
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

// ⏱️ التوقيت — قيمة أبسط وأكثر واقعية (بدون 60-100 ثانية)
function getSmartTiming(intent, persona, session) {
    const r = Math.random();
    const len = intent.qLen;

    // تحية/شكر/وداع: فوري
    if (intent.isGreeting || intent.isThanks || intent.isFarewell || intent.isSmallTalk || len < 15) {
        return { speed: 'instant', delayMs: 400 + Math.floor(Math.random() * 400), reason: 'instant_reply' };
    }

    // أسئلة عن الذات / اختبار البوت
    if (intent.isAboutSelf || intent.isBotTest) {
        return { speed: 'quick', delayMs: 1500 + Math.floor(Math.random() * 1200), reason: 'personal' };
    }

    // توقعات أو استشارة: تفكير أطول
    if (intent.isForecastRequest || intent.isConsultationRequest) {
        if (r < 0.15) return { speed: 'deep',       delayMs: 30000 + Math.floor(Math.random() * 20000), reason: 'deep_analysis' };
        if (r < 0.55) return { speed: 'long_think', delayMs: 14000 + Math.floor(Math.random() * 10000), reason: 'long_think' };
        return { speed: 'medium', delayMs: 7000 + Math.floor(Math.random() * 6000), reason: 'medium_think' };
    }

    // رسائل قصيرة
    if (len < 60) {
        if (r < 0.55) return { speed: 'fast',   delayMs: 1000 + Math.floor(Math.random() * 1200), reason: 'fast' };
        if (r < 0.90) return { speed: 'normal', delayMs: 2200 + Math.floor(Math.random() * 2000), reason: 'normal' };
        return { speed: 'medium', delayMs: 6000 + Math.floor(Math.random() * 4000), reason: 'long_pause' };
    }

    // رسائل متوسطة
    if (len < 150) {
        if (r < 0.10) return { speed: 'deep',   delayMs: 25000 + Math.floor(Math.random() * 15000), reason: 'deep_analysis' };
        if (r < 0.40) return { speed: 'normal', delayMs: 2800 + Math.floor(Math.random() * 2500), reason: 'normal' };
        if (r < 0.78) return { speed: 'medium', delayMs: 5500 + Math.floor(Math.random() * 4000), reason: 'medium' };
        return { speed: 'slow', delayMs: 10000 + Math.floor(Math.random() * 7000), reason: 'slow' };
    }

    // رسائل طويلة
    if (r < 0.15) return { speed: 'deep',       delayMs: 28000 + Math.floor(Math.random() * 18000), reason: 'deep_analysis' };
    if (r < 0.50) return { speed: 'slow',       delayMs: 12000 + Math.floor(Math.random() * 8000), reason: 'slow' };
    return { speed: 'long_think', delayMs: 18000 + Math.floor(Math.random() * 10000), reason: 'long_think' };
}

function shouldClose(intent, history) {
    const userCount = (history || []).filter(h => h.role === 'user').length;
    if (intent.isDone && userCount >= 3) return { close: true, reason: 'user_done' };
    if (intent.isRude && userCount >= 5) return { close: true, reason: 'rude' };
    if (userCount >= 40) return { close: true, reason: 'deep_close' };
    return { close: false };
}

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        platform: 'منصة الاسترات forG',
        version: 'Strategy-Pro-v5',
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
                    : intent.isForecastRequest ? 'forecast'
                    : intent.isConsultationRequest ? 'consultation'
                    : 'normal',
                lengthHint: intent.lengthHint,
                styleHint: intent.styleHint,
                isForecast: intent.isForecastRequest,
                isConsultation: intent.isConsultationRequest
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
    console.log(`✅ منصة الاسترات forG — على البورت ${PORT}`);
    console.log(`🎭 محاكاة بشرية متقدمة | 🔒 قفل تفاعلي | 🌍 14 لهجة`);
});
