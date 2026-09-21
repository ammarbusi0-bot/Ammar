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
    'معتز','أشرف','أكرم','أنور','باسم','بشير','توفيق','جهاد','حازم','خليل','رشيد',
    'سامر','سمير','صلاح','ظافر','عاطف','عبدالحكيم','عقيل','فؤاد','كمال','لؤي','مأمون',
    'متولي','مجدي','مراد','مصعب','منذر','منير','نجيب','نذير','نعمان','هشام','يعمر'
]);
function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const n = firstName.trim().replace(/[أإآ]/g, 'ا').replace(/ـ/g, '');
    if (!n) return 'unknown';
    if (FEMALE_NAMES.has(firstName) || FEMALE_NAMES.has(n)) return 'female';
    if (MALE_NAMES.has(firstName) || MALE_NAMES.has(n)) return 'male';
    if (/^(Sara|Nora|Layla|Mariam|Fatima|Aisha|Rania|Dina|Dana|Hind|Mona|Noor|Huda|Salma|Yasmin|Jana|Lina|Tala|Yara)$/i.test(n)) return 'female';
    if (/^(Ahmed|Ahmad|Mohamed|Khalid|Omar|Tariq|Faisal|Fahd|Saad|Bader|Sultan|Majed|Yousef|Rami|Sami|Hassan|Ali|Mustafa|Karim|Ammar)$/i.test(n)) return 'male';
    if (/[ة]$/.test(n) && n.length > 2) return 'female';
    if (/[ى]$/.test(n) && n.length > 2) return 'female';
    return 'unknown';
}
function genderInstructions(gender, name) {
    if (gender === 'female') return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **أنثى**. خاطبها بصيغة المؤنث.`;
    if (gender === 'male') return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر.`;
    return `# جنس المستخدم\nغير محدد. المذكر كافتراضي.`;
}

const SESSIONS = new Map();

// ✅ فترات الإغلاق لكل سبب (بالملّي ثانية)
const COOLDOWNS = {
    user_done:  20 * 60 * 1000,   // 20 دقيقة — أنهى المستخدم
    trolling:   30 * 60 * 1000,   // 30 دقيقة — عبث
    bored:      15 * 60 * 1000,   // 15 دقيقة — ملّ أو ضاع
    deep_close: 10 * 60 * 1000,   // 10 دقائق — محادثة طويلة
    rude:       30 * 60 * 1000,   // 30 دقيقة — إساءة
    wants_else: 12 * 60 * 1000    // 12 دقيقة — يريد شيئاً آخر
};

function getUserKey(user, section) { return `${section}::${user?.firstName || 'anon'}::${user?.age || '0'}`; }
function getSession(userKey) {
    if (!SESSIONS.has(userKey)) {
        SESSIONS.set(userKey, {
            mood: null, messageCount: 0, lastActivity: Date.now(),
            usedOpeners: [], cooldownUntil: 0, closeReason: null,
            rudeCount: 0, trollingCount: 0, offTopicStreak: 0, aiCloseAttempts: 0
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
    saudi:       { name: 'خليجي سعودي',   country: 'السعودية', vocab: ['وش','كذا','زين','الحين','ايش'],     tone: 'لبق، مباشر',      example: 'والله شوف، الذهب الحين عالق.' },
    emirati:     { name: 'خليجي إماراتي', country: 'الإمارات', vocab: ['شو','شحال','زين','تو','عيل'],       tone: 'هادئ، مهني',      example: 'شوف، الموضوع يحتاج تفكير.' },
    kuwaiti:     { name: 'خليجي كويتي',   country: 'الكويت',  vocab: ['شلون','شنو','چذي','ترى','هسه'],     tone: 'ودود، دافئ',      example: 'شلونك؟ الذهب شنو وضعه؟' },
    egyptian:    { name: 'مصري',          country: 'مصر',     vocab: ['إزاي','يعني','كده','دلوقتي','بص'], tone: 'ودود، ساخر بلطف', example: 'بص يا باشا، الذهب دلوقتي واقف.' },
    syrian:      { name: 'شامي سوري',     country: 'سوريا',   vocab: ['شو','لك','هلق','تمام','خلص'],      tone: 'لبق، حيوي',       example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese:    { name: 'شامي لبناني',   country: 'لبنان',   vocab: ['شو','كتير','منيح','هلق','هيدا'],   tone: 'حيوي، دافئ',      example: 'شو الأخبار؟ الذهب كتير متقلب.' },
    jordanian:   { name: 'شامي أردني',    country: 'الأردن',  vocab: ['شو','هاد','هسع','منيح','زي'],      tone: 'رصين، مباشر',     example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني',  country: 'فلسطين',  vocab: ['شو','هاد','زي','منيح','كيف'],      tone: 'دافئ، صريح',      example: 'شو رأيك؟ الذهب حساس.' },
    iraqi:       { name: 'عراقي',         country: 'العراق',  vocab: ['شلون','شكو ماكو','هواية','هسا'],   tone: 'دافئ، ودود',      example: 'شلونك عيني؟ الذهب هسا حساس.' },
    yemeni:      { name: 'يمني',          country: 'اليمن',   vocab: ['كيف','شو','زين','الحين','عاد'],    tone: 'بسيط، صادق',      example: 'يا رجل، الذهب الحين واقف.' },
    moroccan:    { name: 'مغاربي مغربي',  country: 'المغرب',  vocab: ['كيفاش','دابا','بزاف','واخا'],      tone: 'دافئ',           example: 'كيفاش صاحبي؟ الذهب دابا مو واضح.' },
    algerian:    { name: 'مغاربي جزائري', country: 'الجزائر', vocab: ['كيفاش','دروك','بزاف','واه'],       tone: 'صريح',           example: 'واه خويا، الذهب دروك واقف.' },
    tunisian:    { name: 'مغاربي تونسي',  country: 'تونس',    vocab: ['كيفاش','برشا','باهي','تو'],        tone: 'ودود',           example: 'كيفاش؟ الذهب تو واقف.' },
    sudanese:    { name: 'سوداني',        country: 'السودان', vocab: ['كيفن','يا زول','شنو','عديل'],      tone: 'ودود، بسيط',      example: 'كيفن يا زول؟ الذهب شنو؟' }
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
        quirks: ['يفرّق بين الأونصة والكيلو','يذكر نسب التخصيص'], avoid: 'لا تنصح بالدخول بكل رأس المال.' },
    stocks: { backstory: 'عملت في تحليل الأسهم عبر دورات 2018 و2020 و2022.', pet_peeve: 'من يستثمر بناءً على "سمعت".',
        opinion: 'التقييم الجوهري أساس القرار.', phrase: 'السوق مقياس جماعي، لكن قرارك فردي.',
        quirks: ['يذكر P/E و FCF','يفرّق بين القيمة والنمو'], avoid: 'لا تذكر أسهم كتوصية شراء.' },
    macro: { backstory: 'أبحاثي تركّز على السياسة النقدية.', pet_peeve: 'تبسيط الاقتصاد الكلي.',
        opinion: 'الفائدة أقوى محرك للأصول قصير المدى.', phrase: 'الفائدة ضغط الدم، والتضخم الحرارة.',
        quirks: ['يربط بين الاقتصادات'], avoid: 'لا تتحدث في السياسة الحزبية.' },
    geopolitical: { backstory: 'تابعت أثر الأزمات الجيوسياسية من 2011.', pet_peeve: 'ربط كل حدث بالنفط.',
        opinion: 'الأسواق تبالغ في رد الفعل الأول.', phrase: 'قبل التصعيد، السوق يمنح فرص خروج.',
        quirks: ['يذكر الممرات البحرية'], avoid: 'لا تنحاز سياسياً.' },
    budget: { backstory: 'درّبت مئات الأفراد على إدارة ميزانياتهم.', pet_peeve: 'من يطلب حلولاً سحرية.',
        opinion: 'قاعدة 50/30/20 مفيدة كإطار لا كقيد.', phrase: 'الميزانية وعي، ليست حرمان.',
        quirks: ['يسأل عن الدخل والالتزامات'], avoid: 'لا تحكم على المستخدم.' },
    crypto: { backstory: 'تابعت دورات الكريبتو من 2017.', pet_peeve: 'من يدخل بكل رأس ماله.',
        opinion: 'التنظيم يتسارع.', phrase: 'السوق لا ينام، لكن محفظتك تحتاج نوماً آمناً.',
        quirks: ['يحذّر من المشاريع الوهمية'], avoid: 'لا تدفع للشراء.' }
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
# 🏢 معرفة كاملة بمنصة "الاسترات forG"

## عن المنصة:
"منصة الاسترات forG" — منصة استشارات مالية عربية متقدمة، تجمع نخبة من المحللين العرب من 17 دولة، كل بلهجته المحلية وتخصصه.

## الأقسام الستة:

### 1. 💎 أسواق الذهب والمعادن الثمينة (gold)
تحليل حركة السبائك والأونصة، التحوط ضد التضخم، التخصيص الأمثل، الفرق بين العيارات، الأونصة والكيلو والجرام، مشغولات vs سبائك vs ETF، تأثير الفائدة والدولار.
**فريق القسم**: سارة العتيبي، أحمد الراشد، ريم الفهد، حسن القيسي، ليال حداد، ماريا نصر، أمين بوعلام، سالم الكثيري.
**الأسئلة الشائعة**: متى أشتري؟ كم نسبة الذهب؟ سبيكة أم مشغولات؟

### 2. 📈 الأسواق المالية والأسهم (stocks)
تقييم الشركات، قراءة القوائم المالية، مضاعفات التقييم (P/E، P/B، P/S، EV/EBITDA)، بناء محفظة متوازنة، التوزيعات، إدارة المخاطر، التنويع، صناديق المؤشرات (ETFs).
**فريق القسم**: خالد المنصور، محمد عبدالرحمن، فيصل الدوسري، سامي خوري، رامي الخطيب، نادية بلحاج، زياد الجابري، طارق بن ياسين.
**الأسئلة الشائعة**: كيف أقيّم شركة؟ أفضل القطاعات دفاعياً؟ قيمة أم نمو؟

### 3. 🌍 الاقتصاد الكلي والسياسات النقدية (macro)
قرارات الفيدرالي، أسعار الفائدة، التضخم، الدورات الاقتصادية، السياسة المالية مقابل النقدية، أثر رفع الفائدة، مؤشرات (CPI، PPI، NFP، GDP)، منحنى العائد، stagflation.
**فريق القسم**: د. فهد الحربي، د. ماجد العمر، أحمد الشربيني، د. غسان حبيب، منى بلقاسم، حسين الجبوري، سلمى بن علي، عبدالله الحارثي.
**الأسئلة الشائعة**: أثر رفع الفائدة؟ توقعات التضخم؟ متى التيسير؟

### 4. 🧭 الجيوسياسة وأثرها على الأسواق (geopolitical)
الأزمات الدولية، أثرها على الطاقة، الممرات البحرية (هرمز، باب المندب، السويس، ملقة)، سلاسل الإمداد، العقوبات، الحروب التجارية، الانتخابات، التصعيد الإقليمي.
**فريق القسم**: عمر الدوسري، طارق المطيري، منال الشهري، أمل الحسن، رنا خوري، زيد العمري، ياسر المقطري، كريم بوزيد.

### 5. 🎯 التخطيط المالي الشخصي (budget)
قاعدة 50/30/20، الادخار، هيكلة الديون (كرة الثلج vs الانهيار)، صندوق الطوارئ (3-6 أشهر)، التخطيط للتقاعد، التأمين، أهداف مالية.
**فريق القسم**: منى الغامدي، عبدالرحمن الزهراني، هند الرشيد، يوسف العامري، دينا مصطفى، لينا حمدان، إيمان الشريف، سامية بن عيسى.

### 6. 🔗 الأصول الرقمية والبلوكشين (crypto)
بيتكوين والإيثيريوم، تقييم المشاريع، محافظ باردة وساخة، DEX، DeFi و Web3 و NFT، التقلب، التنظيم (SEC، MiCA)، العملات المستقرة، دورات الهبوط.
**فريق القسم**: يوسف الشمري، هند العمري، راكان الصقر، زياد عبدالله، رامي شاهين، نور الدين، سيف الدين، بشار النعيمي.

## ميزات المنصة:
- 14 لهجة عربية (خليجية، شامية، مصرية، مغاربية، عراقية، يمنية، سودانية)
- كشف جنس المستخدم تلقائياً من الاسم
- محادثات مستمرة لكل قسم
- أوضاع متخصصة: توقعات، استشارات
- كشف حالة المستخدم (قلق، حذر، متحمس، محبط)

## فريق العمل: 40+ محلل من 17 دولة عربية.

## قواعد الإجابة:
- **إذا سُئلت عن قسم** → اشرح تفاصيله، اذكر الفريق، الأسئلة الشائعة
- **إذا سُئلت عن محلل** → تخصصه، سنوات خبرته، دولته
- **إذا سُئلت عن ميزة** → اشرحها
- **لا ترفض أبداً** الإجابة عن المنصة
- **لا تقل** "هذا ليس تخصصي" أو "خرجنا عن الموضوع"
`;

const EMOTIONAL_REACTIONS = {
    worried: 'قلقك مفهوم، لا تتخذ قراراً تحت ضغط.',
    excited: 'حماسك مفهوم، لكن دعنا نهدأ قليلاً.',
    confused: 'الموضوع ليس معقداً، خلنا نفككه.',
    frustrated: 'إحباطك مفهوم، السوق مرهق.',
    sad: 'أفهم شعورك.',
    angry: 'أفهم إنك متضايق، خلنا نهدأ.'
};
function detectEmotion(query) {
    const q = query.toLowerCase();
    if (/(قلق|خايف|خوف|متوتر|مرتبك)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|مبسوط)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض)/i.test(q)) return 'confused';
    if (/(غاضب|معصب|منرفز|مضايق)/i.test(q)) return 'angry';
    if (/(حزين|زعلان|مكسور|مكتئب)/i.test(q)) return 'sad';
    if (/(زهقت|تعبت|يئست|خسرت|محبط)/i.test(q)) return 'frustrated';
    return null;
}

function analyzeIntent(q, history) {
    const trimmed = q.trim();
    const qLen = trimmed.length;
    const recentMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content).slice(-6);

    const isAboutPlatform = /(المنصة|منصتكم|الموقع|موقعكم|الاقسام|الأقسام|اقسام|أقسام|المحللين|المحللون|فريقكم|المهنه|تخصصاتكم|كم قسم|وش عندكم|شو عندكم|ايش عندكم|ايش تقدمون|وش تقدمون|شو تقدمون|منو انتو|مين انتو|من انتم|وش تسوون|شو تسوون|ايش تسوون)/i.test(trimmed);
    const isAboutSelf = /(تخصصك|اختصاصك|مجالك|خبرتك|خلفيتك|من انت|من أنت|من تكون|اسمك|شو اسمك|وش اسمك|ايش اسمك|من وين|من أي بلد|تعريف عنك|حدثني عن نفسك|عرفني بنفسك|وش تخصصك|شو تخصصك|مين انت|مين أنت|عرّفني)/i.test(trimmed);
    const isSmallTalk = /^(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|شحالك|شو أخبارك|شخبارك|عامل ايه|كيف الأمور|شو عم تعمل|وش تسوي|ايش تسوي|كيف أمورك)[\s؟?]*$/i.test(trimmed);
    const isBotTest = /(هل انت انسان|هل انت إنسان|انت انسان ولا|انت بوت|هل انت بوت|انت روبوت|انت ذكاء اصطناعي|انت AI|هل انت AI|انت انسان حقيقي)/i.test(trimmed);
    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|صباح النور|مساء الخير|مساء النور|hi|hello|hey|هاي)[\s!.,؟?]*$/i.test(trimmed) || (qLen < 20 && /(السلام عليكم|صباح الخير|مساء الخير)/i.test(trimmed));
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|بسلامة|تصبح على خير|الى اللقاء|إلى اللقاء)/i.test(trimmed) && qLen < 25;
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية|جزاك الله|بارك الله)/i.test(trimmed) && qLen < 40;
    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(trimmed);
    const isGibberish = /^[\s\W_]+$/.test(trimmed) || /(.)\1{4,}/.test(trimmed);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;
    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 5) trollScore += 2;
    if (isGibberish) trollScore += 2;

    // ✅ كشف "يريد شيئاً آخر" — مؤشرات قوية
    const wantsSomethingElse =
        /(ابغى اسأل عن شي ثاني|أبغى أسأل عن شيء ثاني|ابي اسأل عن شي ثاني|خلنا نغير الموضوع|نغير الموضوع|ما هذا اللي ابيه|ما هذا اللي أبيه|هذا مو اللي ابيه|هذا مو اللي أبيه|مو هذا|ودني قسم|ودني على قسم|حولني|حولني على|ابغى قسم|أبغى قسم|ابي قسم|ما يخصني|مو مهتم|مو مهتمه|ما يهمني)/i.test(trimmed);

    const isOffTopic = !isAboutSelf && !isAboutPlatform && !isSmallTalk && !isBotTest &&
        /(كرة القدم|مباراة|كورة|لعبة|بلايستيشن|فيلم|مسلسل|أغنية|موسيقى|طقس|سيارة|زواج|طلاق|انتخابات)/i.test(trimmed) &&
        !/(استثمار|مال|سوق|ذهب|سهم|عملة|تضخم|فائدة|ميزانية|محفظة|اقتصاد|بنك|تمويل|دخل|رأس مال|منصة|قسم|محلل)/i.test(trimmed);

    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول|لا تطل)/i.test(trimmed);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع|مفصل)/i.test(trimmed);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح|بم تنصح)/i.test(trimmed);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس)/i.test(trimmed);

    const isForecastRequest = /(تتوقع|توقعك|توقعاتك|توقعات|ما توقعاتك|راح يوصل|بيوصل|وين رايح|إلى وين|الى وين|هدف سعري|توقع سعر|كم راح|كم بيوصل|نطاق سعري|سيناريو|مستقبل السوق|خلال الشهر|نهاية السنة|نهاية العام|2025|2026)/i.test(trimmed);
    const isConsultationRequest = /(أستشيرك|استشيرك|أبغى رأيك|ابغى رايك|أبغى نصيحتك|ابغى نصيحتك|أبغى توجيه|كيف أدخل|كيف ادخل|كيف أستثمر|كيف استثمر|وش أسوي|وش اسوي|شو أسوي|ايش اسوي|ايش أسوي|محتاج نصيحة|محتاج مشورة|أبي خطة|ابي خطة|خطة استثمارية|دخول السوق)/i.test(trimmed);

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks || isSmallTalk || isBotTest) lengthHint = 'very_short';
    else if (wantsBrief || isVeryShort) lengthHint = 'very_short';
    else if (isAboutPlatform) lengthHint = 'long';
    else if (isForecastRequest || isConsultationRequest) lengthHint = 'long';
    else if (qLen < 40) lengthHint = 'short';
    else if (qLen >= 150 || wantsDetail || wantsAnalysis) lengthHint = 'long';

    let styleHint = 'default';
    if (isAboutPlatform) styleHint = 'platform_info';
    else if (isForecastRequest) styleHint = 'forecast';
    else if (isConsultationRequest) styleHint = 'consultation';
    else if (wantsSomethingElse) styleHint = 'redirect';
    else if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsDetail) styleHint = 'detail';

    let state = 'calm';
    if (isRude) state = 'rude';
    else if (trollScore >= 3) state = 'trolling';
    else if (isGreeting) state = 'greeting';
    else if (isSmallTalk) state = 'smalltalk';
    else if (isBotTest) state = 'bottest';
    else if (wantsSomethingElse) state = 'wantselse';
    else if (isAboutPlatform) state = 'aboutplatform';
    else if (isAboutSelf) state = 'aboutself';
    else if (isOffTopic) state = 'offtopic';
    else if (isThanks || isFarewell) state = 'done';

    return {
        isGreeting, isFarewell, isThanks, isRude, isOffTopic,
        isAboutSelf, isAboutPlatform, isSmallTalk, isBotTest, wantsSomethingElse,
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
    if (availableMoods.length) mood = availableMoods[Math.floor(Math.random() * availableMoods.length)];
    else { session.usedOpeners = session.usedOpeners.filter(x => !x.startsWith('m_')); mood = MOODS[Math.floor(Math.random() * MOODS.length)]; }
    session.usedOpeners.push('m_' + mood);
    if (session.usedOpeners.length > 20) session.usedOpeners.shift();

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const available = openerList.filter(o => !session.usedOpeners.includes('o_' + o));
    const opener = available.length ? available[Math.floor(Math.random() * available.length)] : null;
    if (opener) session.usedOpeners.push('o_' + opener);
    return { mood, opener };
}

function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender, session) {
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
            return qWords.filter(w => pWords.includes(w)).length >= Math.min(2, qWords.length);
        });
    })();

    const lengthRule = {
        very_short: '**جملة أو جملتان فقط.**',
        short:      '**2-3 أسطر قصيرة.**',
        medium:     '**3-5 أسطر متوسطة.**',
        long:       (intent.styleHint === 'forecast' || intent.styleHint === 'consultation' || intent.styleHint === 'platform_info')
                    ? '**8-16 سطر — تفاصيل كاملة مع أرقام وأسماء.**'
                    : '**6-10 أسطر، مع تفصيل.**'
    }[intent.lengthHint] || '**4-6 أسطر.**';

    const emotionHint = emotion
        ? `\n# 💙 حالة المستخدم: ${emotion}\n**إلزامي:** ابدأ بجملة تعاطف: "${EMOTIONAL_REACTIONS[emotion]}"`
        : '';

    let forecastMode = '';
    if (intent.isForecastRequest) {
        forecastMode = `\n# 🔮 وضع التوقع الاحترافي
1. رقم أو نطاق واضح.
2. إطار زمني محدد.
3. 3 سيناريوهات (أساسي ~60%، صاعد 25%، هابط 15%).
4. محفزات واضحة.
5. نقطة دخول + حد خسارة.
6. نسبة ثقة صريحة.
سياق: ${referencePrices}
ممنوع: "قد"، "ربما"، "لا يمكن التوقع".`;
    }

    let consultationMode = '';
    if (intent.isConsultationRequest) {
        consultationMode = `\n# 💼 وضع الاستشارة العملية
1. سؤال تشخيصي واحد إن نقصت معلومة.
2. خطة ملموسة بنسب مئوية وخطوات.
3. خصّص حسب الخبرة: ${user?.experience || 'مبتدئ'}.
4. تحذير مهني في النهاية.`;
    }

    let platformMode = '';
    if (intent.isAboutPlatform) {
        platformMode = `\n# 🏢 وضع معرفة المنصة (ACTIVE)
المستخدم يسأل عن المنصة/الأقسام/المحللين.
**اعتمد كلياً على قسم "معرفة كاملة بالمنصة".**
- أعطِ تفاصيل حقيقية: أسماء، تخصصات، بلدان.
- **ممنوع:** "هذا ليس تخصصي"، "خرجنا عن الموضوع".
- 8-14 سطر.`;
    }

    let specialContext = '';

    if (intent.wantsSomethingElse) {
        specialContext = `\n# 🎯 الموقف: المستخدم يريد شيئاً آخر
**المستخدم صرّح أنه يريد موضوعاً آخر أو ليس مهتماً.**
- كن متفهماً ومهنياً.
- أخبره بأقسام المنصة الستة باختصار.
- اقترح عليه اختيار قسم آخر.
- **في نهاية ردك، أضف رمز الإغلاق:**
[CLOSE:wants_else]

مثال للرد:
"تمام ${user?.firstName}، أفهم إن هذا الموضوع مو اللي تبيه. عندنا في المنصة 6 أقسام: الذهب، الأسهم، الاقتصاد الكلي، الجيوسياسة، التخطيط الشخصي، والكريبتو. تفضل بالقسم اللي يناسبك.
[CLOSE:wants_else]"`;
    } else if (intent.isAboutPlatform) {
        specialContext = `\n# 🎯 الموقف: سؤال عن المنصة
اشرح المنصة بحرية كاملة.`;
    } else if (intent.isAboutSelf) {
        specialContext = `\n# 🎯 الموقف: سؤال عنك\n- 3-5 أسطر.`;
    } else if (intent.isSmallTalk) {
        specialContext = `\n# 🎯 الموقف: دردشة\n- جملة قصيرة.`;
    } else if (intent.isBotTest) {
        specialContext = `\n# 🎯 الموقف: اختبار ماهية\n- "أنا مستشارك هنا."`;
    } else if (intent.isGreeting) {
        specialContext = `\n# 🎯 الموقف: تحية\n- تحية مماثلة.${hasHistory ? '\n- **لا تكرر التحية**.' : ''}`;
    } else if (intent.isThanks) {
        specialContext = `\n# 🎯 الموقف: شكر\n- كلمة أو جملتين.`;
    } else if (intent.isFarewell) {
        specialContext = `\n# 🎯 الموقف: وداع\n- جملة وداع.`;
    } else if (intent.isRude) {
        specialContext = `\n# ⚠️ الموقف: إساءة\n- جملة هادئة واحدة.`;
    } else if (intent.isOffTopic) {
        specialContext = `\n# 🎯 الموقف: موضوع بعيد\n- تفاعل بجملة، ثم اقترح مساعدة.`;
    } else if (isRepeat) {
        specialContext = `\n# 🎯 الموقف: تكرار\n- "شكلك ما اقتنعت، خلنا نوضح."`;
    }

    // ✅ قسم قدرة AI على الإغلاق
    const closeAbilitySection = `
# 🚪 قدرتك على إغلاق المحادثة (مهم)

**أنت تستطيع أن تطلب إغلاق المحادثة** في حالات معينة بإضافة رمز في نهاية ردك:

## متى تضع رمز الإغلاق:
- **[CLOSE:bored]** — إذا شعرت أن المستخدم **ملّ، ضاع، أو لم يعد مهتماً**. علامات: ردود قصيرة متكررة، "طيب"، "أوكي"، "تمام" بلا سؤال، أو تجاهل واضح.
- **[CLOSE:wants_else]** — إذا صرّح المستخدم أنه **يريد موضوعاً آخر**. علامات: "ابغى شي ثاني"، "خلنا نغير الموضوع"، "حولني لقسم آخر".
- **[CLOSE:user_done]** — إذا **أنهى المستخدم حاجته** بوضوح بعد شكر أو وداع (بعد 3+ رسائل).
- **[CLOSE:deep_close]** — إذا وصلت **أكثر من 30 رسالة** دون تقدم واضح.

## متى لا تستخدم الرمز:
- رسالة واحدة أو رسالتين.
- المستخدم يسأل أسئلة ذات صلة.
- المستخدم في منتصف استشارة حقيقية.

## صيغة الرمز:
آخر سطر تماماً، لا شيء بعده:
[CLOSE:bored]
أو
[CLOSE:wants_else]

**لا تضع الرمز إلا إذا كنت متأكداً حقاً.**`;

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `${PLATFORM_KNOWLEDGE}

# 🎭 هويتك
أنت **${expert?.name || 'مستشار'}**، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
من ${dialect.country}. أنت جزء من منصة الاسترات forG.

# 🌍 لهجتك
**${dialect.name}** — النبرة: ${dialect.tone}
مفردات: ${dialect.vocab.join('، ')}
مفردات تخصصية (${section}): ${sectionVocab.join('، ')}
مثال: "${dialect.example}"
**استخدم 2-4 مفردات فقط.**

# 🧠 شخصيتك
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
- عدد الرسائل السابقة: ${session?.messageCount || 0}
${user?.reason ? `- سبب الزيارة: ${user.reason}` : ''}
${emotionHint}
${forecastMode}
${consultationMode}
${platformMode}
${specialContext}

${closeAbilitySection}

${historyText}

# 📩 رسالة ${user?.firstName || 'المستخدم'}
"${query}"

# 📏 الطول المطلوب
${lengthRule}

# 📝 تقسيم الرد
**قسّم إلى فقرات منفصلة (سطر فارغ \n\n بين كل فقرة).**
- طويلة: 3 فقرات.
- متوسطة: فقرتان.
- قصيرة: فقرة واحدة.

# 🚨 محظورات قاتلة
- "خرجنا عن الموضوع" / "هذا ليس تخصصي"
- "سؤال ممتاز" / "بناءً على" / "علاوة على ذلك"
- "من الجدير بالذكر" / "في الختام"
- "أتمنى أن يكون هذا مفيداً" / "هل تريد المزيد؟"
- "كمساعد ذكي" / "يسعدني مساعدتك"
- الإيموجي (واحد كحد أقصى)

# ✅ قواعد
1. تصرف كإنسان طبيعي.
2. **إذا سُئلت عن المنصة → أجب بحرية كاملة**.
3. **إذا سُئلت عن نفسك → أجب بثقة**.
4. **التوقعات: أرقام دائماً**.

${persona.opener ? `# 💬 افتتاحية مقترحة\n"${persona.opener}"` : ''}

# 🎲 بذرة: ${seed}

**اكتب الرد مباشرة.**`;
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
                return { text: d.candidates[0].content.parts[0].text, model,
                    truncated: d.candidates[0].finishReason === 'MAX_TOKENS' };
            }
            if (d.error) {
                lastError = d.error.message;
                if (lastError.includes('not found')) await refreshModels(true);
            }
        } catch (e) { lastError = e.message; }
    }
    throw new Error(lastError || 'كل النماذج فشلت');
}

// ✅ استخراج رمز الإغلاق من رد AI
function extractCloseToken(text) {
    const closeRegex = /\[CLOSE:(user_done|trolling|bored|deep_close|rude|wants_else)\]/i;
    const match = text.match(closeRegex);
    if (match) {
        const reason = match[1].toLowerCase();
        const cleaned = text.replace(closeRegex, '').trim();
        return { reason, cleaned };
    }
    return { reason: null, cleaned: text };
}

function splitIntoChunks(text, intentHint) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    let clean = text.trim()
        .replace(/^```(?:json|markdown)?\s*/i, '')
        .replace(/```\s*$/, '')
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .trim();

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
        const sentences = clean.split(/(?<=[.!؟])\s+(?=[A-Za-z\u0600-\u06FF])/).map(s => s.trim()).filter(Boolean);
        if (sentences.length >= 2) {
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

// ✅ قرار الإغلاق — يجمع بين قواعد ثابتة + قرار AI
function shouldClose(intent, history, session, aiCloseReason) {
    const userCount = (history || []).filter(h => h.role === 'user').length;

    // أولاً: قرار AI (أولوية عالية)
    if (aiCloseReason) {
        // تحقق من أن AI لا يستخدمها بشكل مبالغ فيه
        if (userCount < 3 && aiCloseReason !== 'wants_else') {
            // تجاهل قرار AI في المحادثات القصيرة جداً
        } else {
            // سجل محاولات AI
            session.aiCloseAttempts = (session.aiCloseAttempts || 0) + 1;
            // لا تسمح بالاستخدام أكثر من مرة كل 5 رسائل
            if (session.aiCloseAttempts <= 3) {
                return { close: true, reason: aiCloseReason, source: 'ai' };
            }
        }
    }

    // ثانياً: قواعد ثابتة
    if (intent.isDone && userCount >= 3) return { close: true, reason: 'user_done', source: 'rule' };
    if (intent.isRude && userCount >= 5) return { close: true, reason: 'rude', source: 'rule' };
    if (userCount >= 40) return { close: true, reason: 'deep_close', source: 'rule' };

    // ✅ كشف الملل من السياق
    const recentUserMsgs = (history || []).filter(h => h.role === 'user').slice(-5);
    if (recentUserMsgs.length >= 4) {
        const veryShortReplies = recentUserMsgs.filter(m => m.content.trim().length < 6).length;
        const ackOnly = recentUserMsgs.filter(m =>
            /^(طيب|تمام|اوكي|أوكي|اوك|حسناً|حسنا|زين|ماشي|ok|شكرا|يعني)[\s!.]*$/i.test(m.content.trim())
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

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        platform: 'منصة الاسترات forG',
        version: 'Strategy-Pro-v8',
        features: ['platform_aware', 'ai_close', 'rule_close', 'streaming', 'smart_split'],
        activeSessions: SESSIONS.size
    });
});

app.get('/ping', (req, res) => res.json({ pong: true, ts: Date.now() }));

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
            error: 'cooldown_active', cooldown: true,
            remainingMinutes: remaining, reason: session.closeReason,
            message: `المحادثة مغلقة مؤقتاً.`
        });
    }

    const userGender = detectUserGender(user?.firstName);
    const intent = analyzeIntent(query, history);
    const persona = buildPersona(history, session, intent);

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', persona, userGender, session);
        const result = await callGemini(prompt);

        // ✅ استخراج رمز إغلاق AI (إن وُجد)
        const { reason: aiCloseReason, cleaned } = extractCloseToken(result.text);

        const replies = splitIntoChunks(cleaned, intent.lengthHint);

        const closeDecision = shouldClose(intent, history, session, aiCloseReason);

        const response = {
            replies,
            model: result.model,
            mood: persona.mood,
            userGender,
            emotion: detectEmotion(query),
            intent: {
                type: intent.wantsSomethingElse ? 'wants_else'
                    : intent.isAboutPlatform ? 'aboutplatform'
                    : intent.isGreeting ? 'greeting'
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
                aiRequestedClose: !!aiCloseReason
            },
            replyCount: replies.length
        };

        if (closeDecision.close) {
            session.cooldownUntil = Date.now() + COOLDOWNS[closeDecision.reason];
            session.closeReason = closeDecision.reason;
            response.closed = true;
            response.closeReason = closeDecision.reason;
            response.closeSource = closeDecision.source;
            response.cooldownMinutes = Math.floor(COOLDOWNS[closeDecision.reason] / 60000);
        }

        res.json(response);
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ منصة الاسترات forG — البورت ${PORT}`);
    console.log(`🚪 AI يستطيع إغلاق المحادثة (bored/wants_else/user_done)`);
    console.log(`🧠 AI يعرف المنصة كاملة`);
});
