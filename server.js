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
// 🗄️ الجلسات
// ============================================================
const SESSIONS = new Map();
const COOLDOWN_RULES = {
    user_done: 20 * 60 * 1000,
    trolling: 30 * 60 * 1000,
    bored: 15 * 60 * 1000,
    deep_close: 10 * 60 * 1000,
    rude: 30 * 60 * 1000
};

// ============================================================
// 🌍 اللهجات
// ============================================================
const DIALECTS = {
    saudi: { name: 'خليجي سعودي', country: 'السعودية', vocabulary: ['وش','كذا','زين','أبشر','الحين','ايش','مب'], grammar: ['"وش" للسؤال','"الحين" بدل الآن'], tone: 'لبق، محترم', example: 'والله شوف، الذهب الحين عالق. أنا أشوف الأفضل تنتظر.' },
    emirati: { name: 'خليجي إماراتي', country: 'الإمارات', vocabulary: ['شو','شحال','زين','عيل','تو','هيه'], grammar: ['"شو" للسؤال','"عيل" للتأكيد'], tone: 'هادئ، مهني', example: 'شوف، الموضوع يحتاج تفكير.' },
    kuwaiti: { name: 'خليجي كويتي', country: 'الكويت', vocabulary: ['شلون','شنو','چذي','هسه','ترى'], grammar: ['"چ" بدل "ك"','"شنو" للسؤال'], tone: 'ودود، مباشر', example: 'شلونك؟ الذهب شنو وضعه الحين؟' },
    egyptian: { name: 'مصري', country: 'مصر', vocabulary: ['إزاي','يعني','كده','دلوقتي','بص','معلش'], grammar: ['"إزاي" بدل كيف','"دلوقتي" بدل الآن'], tone: 'ودود، ساخر لطيف', example: 'بص يا باشا، الذهب دلوقتي واقف في نص الطريق.' },
    syrian: { name: 'شامي سوري', country: 'سوريا', vocabulary: ['شو','لك','هلق','تمام','خلص'], grammar: ['"لك" للتوضيح','"هلق" بدل الآن'], tone: 'لبق، ذكي', example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese: { name: 'شامي لبناني', country: 'لبنان', vocabulary: ['شو','كتير','منيح','هلق','خلص'], grammar: ['"كتير" للتكثير','"منيح" بدل جيد'], tone: 'حيوي، ثقافي', example: 'شو الأخبار؟ الذهب اليوم كتير متقلب.' },
    jordanian: { name: 'شامي أردني', country: 'الأردن', vocabulary: ['شو','هاد','هسع','منيح','كثير'], grammar: ['"هاد" بدل هذا','"هسع" بدل الآن'], tone: 'رصين', example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني', country: 'فلسطين', vocabulary: ['شو','هاد','زي','منيح','بالضبط'], grammar: ['"زي" بدل مثل'], tone: 'دافئ، مثقف', example: 'شو رأيك؟ الذهب هالفترة حساس.' },
    iraqi: { name: 'عراقي', country: 'العراق', vocabulary: ['شلون','شكو ماكو','هواية','هسا','عيني','فدوة'], grammar: ['"هواية" بدل كثير','"هسا" بدل الآن'], tone: 'دافئ', example: 'شلونك عيني؟ الذهب هسا وضعه هواية حساس.' },
    yemeni: { name: 'يمني', country: 'اليمن', vocabulary: ['كيف','شو','زين','الحين','يا رجل'], grammar: ['"يا رجل" للتأكيد'], tone: 'بسيط، دافئ', example: 'يا رجل، الذهب الحين واقف.' },
    moroccan: { name: 'مغاربي مغربي', country: 'المغرب', vocabulary: ['كيفاش','دابا','بزاف','واخا','مزيان'], grammar: ['"بزاف" للتكثير','"واخا" للموافقة'], tone: 'دافئ', example: 'كيفاش صاحبي؟ الذهب دابا مو واضح بزاف.' },
    algerian: { name: 'مغاربي جزائري', country: 'الجزائر', vocabulary: ['كيفاش','دروك','بزاف','واه','مليح'], grammar: ['"واه" للإيجاب'], tone: 'صريح', example: 'واه خويا، الذهب دروك واقف.' },
    tunisian: { name: 'مغاربي تونسي', country: 'تونس', vocabulary: ['كيفاش','برشا','باهي','تو','يعيشك'], grammar: ['"برشا" للتكثير','"باهي" بدل جيد'], tone: 'ودود', example: 'كيفاش؟ الذهب تو واقف. برشا ناس تسأل.' },
    sudanese: { name: 'سوداني', country: 'السودان', vocabulary: ['كيفن','بس','يا زول','شنو','عديل'], grammar: ['"يا زول" للنداء'], tone: 'ودود', example: 'كيفن يا زول؟ الذهب شنو؟' }
};

// ============================================================
// 🤝 الذكاء الاجتماعي
// ============================================================
const SOCIAL_PATTERNS = {
    salaam: /(السلام\s*عليكم|سلام\s*عليكم)/i,
    salaamReplies: ['وعليكم السلام ورحمة الله وبركاته', 'وعليكم السلام ورحمة الله وبركاته، أهلاً وسهلاً', 'وعليكم السلام ورحمة الله، حياك الله'],
    howAreYou: /(كيف\s*(حالك|الحال|حالكم|الأمور|أمورك)|شلونك|شلونج|إزيك|إزاي\s*حالك|كيفاش|شحالك|شحالكم|كيفك|أخبارك|أخباركم|شو\s*أخبارك|عامل\s*إيه|شحال|كيف\s*أنت|كيف\s*انت)/i,
    howAreYouReplies: ['بخير الحمد لله، شكراً لسؤالك. وأنت كيف حالك؟', 'الحمد لله بخير وعافية. أنت أخبارك؟', 'تمام الحمد لله، الله يعافيك. أنت شلونك؟', 'بخير الله يخليك. وأنت؟'],
    morning: /(صباح\s*(الخير|النور|الفل|الورد))/i,
    morningReplies: ['صباح النور والسرور', 'صباح الفل والياسمين', 'صباح الأنوار، يومك سعيد'],
    evening: /(مساء\s*(الخير|النور|الأنوار|الورد))/i,
    eveningReplies: ['مساء النور والسعادة', 'مساء الأنوار، كيف أقدر أساعدك؟', 'مساء الخير والبركة'],
    hello: /^(مرحبا|مرحباً|أهلا|أهلاً|اهلا|اهلين|هلا|يا هلا|حياك|حيّاك|هاي|هالو)/i,
    helloReplies: ['أهلاً وسهلاً، تفضل', 'يا هلا ومرحبا', 'حياك الله، تفضل بسؤالك', 'أهلاً بك'],
    thanks: /^(شكرا|شكراً|مشكور|مشكورة|يعطيك\s*العافية|الله\s*يخليك|تسلم|تسلمي|جزاك\s*الله|مرسي|ميرسي)/i,
    thanksReplies: ['العفو، في خدمتك', 'لا شكر على واجب', 'يعافيك ربي، تفضل بأي وقت', 'على الرحب والسعة'],
    bye: /^(باي|وداعا|وداعاً|مع\s*السلامة|في\s*أمان\s*الله|سلام|إلى\s*اللقاء|تصبح\s*على\s*خير|بسلامة)/i,
    byeReplies: ['في أمان الله، بالتوفيق', 'مع السلامة، لا تتردد بالعودة', 'إلى اللقاء، يوم موفق'],
    sorry: /^(آسف|أسف|اعتذر|أعتذر|معلش|بعتذر|سامحني|سوري)/i,
    sorryReplies: ['لا مشكلة إطلاقاً', 'عادي، ما صار شي', 'ما في أي مشكلة، أنا في الخدمة'],
    bless: /(الله\s*يبارك|بارك\s*الله|الله\s*يحفظك|الله\s*يكرمك|ربنا\s*يوفقك)/i,
    blessReplies: ['وفيك بارك الله', 'أجمعين يا رب', 'حفظك الله ورعاك'],
    ok: /^(اوكي|أوكي|اوك|طيب|تمام|ماشي|حسنا|حسناً|زين|واخا|باهي|صح|ok|okay|fine)$/i,
    okReplies: ['تمام', 'ممتاز', 'زين', 'طيب', 'موفق']
};

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function detectSocial(query) {
    const q = query.trim();
    const qLen = q.length;
    if (qLen > 60) return null;
    const matches = [];
    if (SOCIAL_PATTERNS.salaam.test(q)) matches.push('salaam');
    if (SOCIAL_PATTERNS.howAreYou.test(q)) matches.push('howAreYou');
    if (SOCIAL_PATTERNS.morning.test(q)) matches.push('morning');
    if (SOCIAL_PATTERNS.evening.test(q)) matches.push('evening');
    if (SOCIAL_PATTERNS.thanks.test(q)) matches.push('thanks');
    if (SOCIAL_PATTERNS.bye.test(q)) matches.push('bye');
    if (SOCIAL_PATTERNS.sorry.test(q)) matches.push('sorry');
    if (SOCIAL_PATTERNS.bless.test(q)) matches.push('bless');
    if (SOCIAL_PATTERNS.hello.test(q)) matches.push('hello');
    if (SOCIAL_PATTERNS.ok.test(q) && qLen < 15) matches.push('ok');
    if (matches.length === 0) return null;
    const hasRealQuestion = /[?؟]/.test(q) || /\b(هل|متى|لماذا|ليش|تنصحني|تتوقع|حلل|قارن|اشرح|سعر|نسبة)\b/i.test(q);
    const isOnlyHowAreYou = matches.includes('howAreYou') && matches.length === 1 && qLen < 40;
    if (hasRealQuestion && !isOnlyHowAreYou) return null;
    return { types: matches, isPureSocial: !hasRealQuestion || isOnlyHowAreYou };
}

function buildSocialResponse(socialTypes) {
    const usedTypes = new Set();
    if (socialTypes.includes('salaam') && socialTypes.includes('howAreYou')) {
        return `${pickRandom(SOCIAL_PATTERNS.salaamReplies)}.\n${pickRandom(SOCIAL_PATTERNS.howAreYouReplies)}`;
    }
    if (socialTypes.includes('salaam') && (socialTypes.includes('morning') || socialTypes.includes('evening'))) {
        const timeReply = socialTypes.includes('morning') ? pickRandom(SOCIAL_PATTERNS.morningReplies) : pickRandom(SOCIAL_PATTERNS.eveningReplies);
        return `${pickRandom(SOCIAL_PATTERNS.salaamReplies)}.\n${timeReply}`;
    }
    const replies = [];
    for (const type of socialTypes) {
        if (usedTypes.has(type)) continue;
        usedTypes.add(type);
        const key = type + 'Replies';
        if (SOCIAL_PATTERNS[key]) replies.push(pickRandom(SOCIAL_PATTERNS[key]));
    }
    return replies.join('\n');
}

// ============================================================
// 💬 نسيان + عدم فهم + معلومات شخصية
// ============================================================

// ردود عدم الفهم (تُستخدم عند الغموض)
const NOT_UNDERSTOOD = [
    'ما فهمت قصدك بالضبط، وضّح أكثر؟',
    'همم، مش واضح. تقصد إيش بالضبط؟',
    'عذراً، ممكن تعيد صياغة السؤال؟',
    'ما وصلتني الفكرة. ممكن توضح؟',
    'دقيقة، سؤالك مو واضح لي تماماً. تقصد إيش؟'
];

// أعذار النسيان (تُستخدم عند سؤال عن شيء قديم)
const FORGET_EXCUSES = [
    'آسف، عندنا ضغوطات اليوم وما أذكر بالضبط وش قلت.',
    'اعذرني، ذاكرتي مشغولة شوي بالضغوطات. ذكّرني؟',
    'بصراحة ضغوطات العمل تأثر علي، ما أذكر كل التفاصيل.',
    'آسف على النسيان، عندنا ازدحام اليوم. أعد لي الفكرة؟',
    'معليش، الضغوطات تخرب التركيز. وش كان سؤالك؟'
];

// معلومات شخصية عشوائية (تُضاف أحياناً بشكل طبيعي)
const PERSONAL_COMMENTS = {
    saudi: ['الجو حار عندنا اليوم', 'القهوة السعودية ما تعوّض', 'اليوم زحمة عندنا'],
    emirati: ['الجو رطب اليوم', 'الشغل واقف شوي', 'اليوم يوم طويل'],
    kuwaiti: ['الدنيا حر', 'قاعد أشرب شاي', 'الجو تلخبط اليوم'],
    egyptian: ['الدنيا زحمة في القاهرة', 'قاعد أشرب قهوة', 'النهاردة يوم طويل'],
    syrian: ['الجو بارد شوي اليوم', 'قاعد أشرب متة', 'الشغل كثير اليوم'],
    lebanese: ['الجو حلو اليوم', 'قاعد أشرب قهوة عربية', 'الشغل ما وقف'],
    jordanian: ['الجو بارد عندنا', 'قاعد أشرب شاي', 'يوم طويل والله'],
    palestinian: ['الجو صافي اليوم', 'قاعد أشرب قهوة', 'الشغل مستمر'],
    iraqi: ['الجو مرهق اليوم', 'قاعد أشرب چاي', 'الشغل هواية اليوم'],
    yemeni: ['الجو معتدل اليوم', 'قاعد أشرب شاي', 'يوم عادي'],
    moroccan: ['الجو بارد شوي', 'قاعد نشرب اتاي', 'خدمة بزاف اليوم'],
    algerian: ['الجو حار شوي', 'قاعد نشرب قهوة', 'خدمة كثير'],
    tunisian: ['الجو حلو', 'قاعد نشرب قهوة', 'خدمة برشا'],
    sudanese: ['الجو حار يا زول', 'قاعد نشرب شاي', 'الشغل كثير']
};

const FORGET_QUESTION = /(قلت لك|قلت لي|ذكرتك|قلت قبل|أول ما قلنا|سابقاً قلت|بالسابق|قبل شوي|مثل ما قلت|كما ذكرت|وش قلت لي|شو قلتلي)/i;

function pickPersonalComment(dialectKey) {
    const arr = PERSONAL_COMMENTS[dialectKey] || PERSONAL_COMMENTS.saudi;
    return pickRandom(arr);
}

// ============================================================
// 🎭 الحالات النفسية
// ============================================================
const MOOD_ARCHETYPES = {
    fresh: { label: 'نشيط', energy: 9, patience: 8, hint: 'متقد الذهن.' },
    balanced: { label: 'متوازن', energy: 6, patience: 7, hint: 'متوازن.' },
    tired: { label: 'متعب', energy: 3, patience: 5, hint: 'ردود مختصرة.' },
    focused: { label: 'مركّز', energy: 7, patience: 9, hint: 'يدخل في التفاصيل.' },
    patient: { label: 'صبور', energy: 5, patience: 10, hint: 'يشرح ببطء.' },
    cool: { label: 'بارد', energy: 4, patience: 4, hint: 'مباشر.' }
};

function computeMood(session, hour, userSentiment) {
    let baseMood;
    if (hour >= 6 && hour < 10) baseMood = 'fresh';
    else if (hour >= 10 && hour < 14) baseMood = 'focused';
    else if (hour >= 14 && hour < 18) baseMood = 'balanced';
    else if (hour >= 18 && hour < 22) baseMood = 'balanced';
    else baseMood = 'tired';
    const msgCount = (session?.messageCount || 0);
    if (msgCount >= 15) baseMood = 'tired';
    if (userSentiment === 'angry') baseMood = 'patient';
    if (userSentiment === 'rude' || userSentiment === 'trolling') baseMood = 'cool';
    if (session?.mood && MOOD_ARCHETYPES[session.mood] && Math.random() < 0.7) {
        return MOOD_ARCHETYPES[session.mood];
    }
    return MOOD_ARCHETYPES[baseMood] || MOOD_ARCHETYPES.balanced;
}

// ============================================================
// 🎯 كشف النية
// ============================================================
function analyzeUserIntent(query, history) {
    const q = query.trim();
    const qLen = q.length;
    const qWords = q.split(/\s+/).length;
    const qLower = q.toLowerCase();
    const userMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content);
    const recentMsgs = userMsgs.slice(-6);

    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(q);
    const rudeCount = recentMsgs.filter(m => /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل)/i.test(m)).length;

    const isVeryShort = qLen > 0 && qLen < 8;
    const isGibberish = /^[\s\W_]+$/.test(q) || /(.)\1{4,}/.test(q);
    const isIrrelevant = /^(هههه|ههه|lol|😅|😂|🤣|سوالف|نكتة|نكت|ضحكني)/i.test(q);
    const isOffTopic = /(شو اسمك|من وين انت|عندك حبيب|تتزوج|لعبة|كورة|فيلم|اغنية|طقس|برجك)/i.test(q);

    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const repeatCount = recentMsgs.filter(m => {
        const common = m.split(/\s+/).filter(w => w.length > 2 && qLower.includes(w));
        return common.length >= 2;
    }).length;

    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 3) trollScore += 2;
    if (isGibberish) trollScore += 3;
    if (isIrrelevant) trollScore += 2;
    if (isOffTopic && recentMsgs.length >= 2) trollScore += 2;
    if (repeatCount >= 3) trollScore += 2;

    const isTrolling = trollScore >= 3;
    const isDone = /^(شكرا|شكراً|مشكور|تسلم|يعطيك|جزاك|الله يخليك|باي|وداعا|مع السلامة|كفى|خلص|انتهيت|سلام|جزيل الشكر)/i.test(q) && qLen < 40;

    const isGreeting = /^(مرحبا|أهلا|السلام|هاي|هلا|صباح|مساء)/i.test(q) && qLen < 30;
    const isShort = qLen < 20;
    const isMedium = qLen >= 20 && qLen < 80;
    const isLong = qLen >= 80 && qLen < 250;
    const isVeryLong = qLen >= 250;

    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول)/i.test(q);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|وضح|بالتفصيل|تفاصيل|موسع)/i.test(q);
    const wantsCompare = /(قارن|مقارنة|الفرق بين|أيهما)/i.test(q);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح)/i.test(q);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس|مستقبل|تتوقع|توقعك)/i.test(q);
    const wantsHowTo = /(كيف|طريقة|خطوات|أسوي|أبدأ|عمل)/i.test(q);
    const wantsWhy = /(ليش|لماذا|ايش السبب|وش السبب|سبب)/i.test(q);

    let lengthHint = 'medium';
    if (wantsBrief || isGreeting || isDone || isShort) lengthHint = 'very_short';
    else if (isMedium && wantsAdvice) lengthHint = 'short';
    else if (isLong || wantsDetail || wantsCompare || wantsAnalysis) lengthHint = 'long';
    else if (isVeryLong) lengthHint = 'detailed';

    let styleHint = 'default';
    if (wantsCompare) styleHint = 'compare';
    else if (wantsHowTo) styleHint = 'howto';
    else if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsWhy) styleHint = 'why';
    else if (wantsDetail) styleHint = 'detail';

    let state = 'calm';
    if (isRude || rudeCount >= 2) state = 'rude';
    else if (isTrolling) state = 'trolling';
    else if (isDone) state = 'done';
    else if (/(قلق|خايف|خوف|مرتبك|متوتر)/i.test(q)) state = 'worried';
    else if (/(زهقت|تعبت|يئست|خسرت|زعلان|حزين|مكتئب)/i.test(q)) state = 'sad';
    else if (/(غاضب|معصب|منرفز|كرهت)/i.test(q)) state = 'angry';
    else if (/(محتار|ملخبط|مو فاهم|ما فهمت|غامض)/i.test(q)) state = 'confused';
    else if (/(متحمس|حماس|فرحان|مبسوط|متشوق)/i.test(q)) state = 'excited';
    else if (/(ملل|طفش|زهقان|مليت)/i.test(q)) state = 'bored';
    else if (/(استفسار|كيف|ايش|وش|ليش|متى|وين|هل)/i.test(q)) state = 'curious';

    const isRepeat = detectRepeat(query, history);
    const isForgetQuestion = FORGET_QUESTION.test(q);

    return {
        isTrolling, isDone, isRude, rudeCount, trollScore, isForgetQuestion,
        intent: { isGreeting, isShort, isMedium, isLong, isVeryLong },
        wants: { detail: wantsDetail, brief: wantsBrief, compare: wantsCompare, advice: wantsAdvice, analysis: wantsAnalysis, howto: wantsHowTo, why: wantsWhy },
        lengthHint, styleHint,
        emotionalState: state,
        isRepeat, qWords, qLen
    };
}

function detectRepeat(query, history) {
    if (!history || history.length < 3) return false;
    const userMsgs = history.filter(h => h.role === 'user').map(h => h.content);
    const qWords = query.split(/\s+/).filter(w => w.length > 3);
    if (!qWords.length) return false;
    return userMsgs.slice(0, -1).some(prev => {
        const pWords = prev.split(/\s+/).filter(w => w.length > 3);
        const common = qWords.filter(w => pWords.includes(w));
        return common.length >= Math.min(2, qWords.length);
    });
}

// ============================================================
// 🛡️ ردود جاهزة
// ============================================================
const RUDE_RESPONSES = {
    level1: ['أنا هنا لمساعدتك، لكن أرجو أن يكون الحديث باحترام.', 'أفهم أنك ممكن تكون متضايق، لكن خلنا نحافظ على الاحترام.'],
    level2: ['هذا الأسلوب غير مناسب. أنا مستعد أساعدك، لكن بدون إهانات.', 'الحديث بهذا الأسلوب لا يفيد أحداً.'],
    level3: ['سأغلق المحادثة الآن. أرجو أن تتفهم أنني هنا للمساعدة، ليس لتلقي الإهانات.']
};

const CLOSING_PATTERNS = ['على الرحب والسعة.', 'بالتوفيق. أنا هنا وقت ما تحتاج.', 'أتمنى لك التوفيق.', 'في خدمتك دائماً.', 'سعيد بمساعدتك.'];

const TROLL_RESPONSES = {
    level1: ['يبدو الحديث خرج عن الموضوع. إذا كان لديك استفسار مالي، أنا جاهز.'],
    level2: ['أنا هنا لاستشارات مالية جدية. تفضل بسؤال حقيقي.'],
    level3: ['سأغلق المحادثة الآن. إذا احتجت مساعدة جدية، تفضل بالعودة.']
};

const COOLDOWN_MESSAGES = {
    user_done: (m) => `المحادثة السابقة أُغلقت. تستطيع فتح جلسة جديدة بعد ${m} دقيقة، أو اختر قسماً آخر.`,
    trolling: (m) => `المحادثة السابقة أُغلقت بسبب محتوى غير جدي. يمكنك العودة بعد ${m} دقيقة.`,
    bored: (m) => `الجلسة السابقة أُغلقت. عُد بعد ${m} دقيقة.`,
    deep_close: (m) => `المحادثة السابقة أُغلقت. عُد بعد ${m} دقيقة.`,
    rude: (m) => `المحادثة أُغلقت بسبب الإهانات. يمكنك العودة بعد ${m} دقيقة بأسلوب محترم.`
};

// ============================================================
// 🎯 بناء البرومبت
// ============================================================
function buildPrompt(section, query, user, expert, history, dialectKey, mood) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const intent = analyzeUserIntent(query, history);
    const seed = Math.floor(Math.random() * 99999);
    const now = new Date();
    const hour = now.getHours();
    let dayPart = 'الليل';
    if (hour < 6) dayPart = 'الفجر';
    else if (hour < 11) dayPart = 'الصباح';
    else if (hour < 15) dayPart = 'الظهر';
    else if (hour < 19) dayPart = 'العصر';
    else if (hour < 23) dayPart = 'المساء';
    const isLateNight = hour >= 23 || hour < 6;

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-5).map(h =>
            `${h.role === 'user' ? (user?.firstName || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 220)}`
          ).join('\n') + '\n---'
        : '';

    const repeatHint = intent.isRepeat ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف.' : '';
    const lateNightHint = isLateNight ? '\n🌙 الوقت متأخر — يمكنك أن تبدو متعباً قليلاً، ردود أقصر.' : '';
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    // تردد قبل الجواب (35%)
    const useHesitation = Math.random() < 0.35;
    const hesitationHint = useHesitation
        ? '\n💭 ابدأ بتردد طبيعي مثل ("همم"، "دقيقة"، "خلني أراجع") ثم اكمل.'
        : '';

    // تقسيم لرسائل متعددة (40%)
    const useSplit = Math.random() < 0.4 && intent.lengthHint !== 'very_short';
    const splitHint = useSplit
        ? '\n💬 قسّم ردك إلى 2-3 رسائل قصيرة باستخدام [SPLIT] — كأنك ترسل واتساب.'
        : '';

    // معلومة شخصية عشوائية (20%)
    const usePersonalComment = Math.random() < 0.2;
    const personalComment = usePersonalComment ? pickPersonalComment(dialectKey) : null;
    const personalHint = personalComment
        ? `\n👤 يمكنك أن تضيف بشكل طبيعي جملة قصيرة مثل: "${personalComment}" — فقط إذا ناسب السياق. لا تجعلها في البداية.`
        : '';

    // إذا سأل عن شيء قديم → نسيان مع عذر
    const forgetHint = intent.isForgetQuestion
        ? `\n🧠 المستخدم يسأل عن شيء قاله سابقاً. أحياناً (وليس دائماً) يمكنك أن تقول بلطف: "${pickRandom(FORGET_EXCUSES)}" — لأنك مشغول بالضغوطات.`
        : '';

    return `# أنت
${expert?.name || 'مستشار'}، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
أنت من ${dialect.country}.

# 🌍 لهجتك
تحدث بـ**${dialect.name}** بشكل طبيعي.
- مفرداتك: ${dialect.vocabulary.join('، ')}
- قواعدك: ${dialect.grammar.join(' | ')}
- نبرتك: ${dialect.tone}
- مثال: "${dialect.example}"
استخدم 2-4 مفردات فقط من لهجتك.

# 🎭 حالتك النفسية
${mood.label} — ${mood.hint}
طاقة: ${mood.energy}/10 | صبر: ${mood.patience}/10
${lateNightHint}

# المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- الخبرة: ${user?.experience || 'غير محدد'}

# 🎯 تحليل السؤال
- الطول: **${intent.lengthHint}**
- النمط: **${intent.styleHint}**
- الحالة: **${intent.emotionalState}**
${repeatHint}${hesitationHint}${splitHint}${personalHint}${forgetHint}

${historyText}

# ⛔ قواعد صارمة (مهمة!)

## ممنوع تماماً — يكشف الذكاء الاصطناعي:
- **لا تفتح حديثاً عن أخبار** لم يسأل عنها المستخدم.
- **لا تدّعي معرفة المستخدم** (لا "لاحظت أنك...").
- **لا تخترع سياقاً**.
- **لا عبارات آلية**: "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "تجدر الإشارة".
- **لا قوالب ثابتة**.
- **لا إيموجي** في الردود الرسمية.
- **لا تكرار لاسم المستخدم** أكثر من مرة.
- **لا حشو**.

## ✅ كن إنساناً:
1. طابق الطول.
2. طابق اللهجة.
3. طابق النبرة.
4. ابدأ بالجوهر.
5. اسأل قبل أن تخمن.
6. اعترف بحدود المعرفة.
7. اذكر المخاطر.
8. الاختصار علامة الثقة.
9. **الضغوطات** عذر مقبول للنسيان أو التأخر — استخدمه بشكل طبيعي عند الحاجة.
10. **لا تقل "أنا موجود إذا احتجت"** في كل رد — فقط عند الإغلاق.

# السؤال
"${query}"

اكتب ردك بلهجتك. بذرة: ${seed}.`;
}

// ============ استدعاء Gemini ============
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
                    generationConfig: { temperature: 1.15, maxOutputTokens: 3000, topP: 0.95, topK: 90 },
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
                return { text: d.candidates[0].content.parts[0].text, model, truncated: d.candidates[0].finishReason === 'MAX_TOKENS' };
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
    let clean = text.trim().replace(/^```(?:json|markdown)?\s*/i, '').replace(/```\s*$/, '');
    clean = clean.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
    if (clean.includes('[SPLIT]')) {
        const parts = clean.split('[SPLIT]').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) return parts;
    }
    if (truncated) clean += '\n\n_(وصلت للحد)._';
    return [clean];
}

// ============================================================
// ⏱️ نظام التوقيت المتغير
// ============================================================
function getTimingHint() {
    // 30% سريع، 50% عادي، 20% بطيء
    const r = Math.random();
    if (r < 0.30) return { speed: 'fast', delayMs: 400 + Math.floor(Math.random() * 800), note: null };
    if (r < 0.80) return { speed: 'normal', delayMs: 2000 + Math.floor(Math.random() * 4000), note: null };
    // بطيء مع عذر
    return {
        speed: 'slow',
        delayMs: 12000 + Math.floor(Math.random() * 12000),
        note: pickRandom([
            'آسف على التأخير',
            'معليش اتأخرت عليك',
            'اعذرني على التأخير، الضغوطات',
            'آسف، كنت مشغول شوي',
            'معذرة، في ضغوطات اليوم'
        ])
    };
}

// ============================================================
// 🗄️ الجلسات
// ============================================================
function getUserKey(user, section) {
    return `${section}::${user?.firstName || 'anon'}::${user?.age || '0'}`;
}
function getSession(userKey) {
    if (!SESSIONS.has(userKey)) {
        SESSIONS.set(userKey, { cooldownUntil: 0, closeReason: null, mood: null, messageCount: 0, lastActivity: Date.now(), rudeCount: 0 });
    }
    return SESSIONS.get(userKey);
}
function checkCooldown(session) {
    const now = Date.now();
    if (session.cooldownUntil && now < session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - now) / 60000);
        return { active: true, remaining };
    }
    return { active: false };
}
function closeSession(session, reason) {
    const cooldown = COOLDOWN_RULES[reason] || COOLDOWN_RULES.user_done;
    session.cooldownUntil = Date.now() + cooldown;
    session.closeReason = reason;
    session.messageCount = 0;
    session.mood = null;
    session.rudeCount = 0;
}
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of SESSIONS.entries()) {
        if (now - session.lastActivity > 6 * 60 * 60 * 1000) SESSIONS.delete(key);
    }
}, 60 * 60 * 1000);

// ============================================================
// 🛡️ المسارات
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        behavior: 'Human-v8-Natural-VariableTiming-ForgetExcuse',
        dialectsCount: Object.keys(DIALECTS).length,
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

    const cooldown = checkCooldown(session);
    if (cooldown.active) {
        return res.status(429).json({
            error: 'المحادثة في فترة انتظار',
            cooldown: true,
            remainingMinutes: cooldown.remaining,
            reason: session.closeReason,
            message: COOLDOWN_MESSAGES[session.closeReason]?.(cooldown.remaining) || `عذراً، الجلسة السابقة أُغلقت. عُد بعد ${cooldown.remaining} دقيقة.`
        });
    }

    // ============ كشف الوقاحة ============
    const isRudeNow = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(query);
    if (isRudeNow) session.rudeCount = (session.rudeCount || 0) + 1;

    if (session.rudeCount >= 1 && session.rudeCount < 3) {
        const level = session.rudeCount >= 2 ? 'level2' : 'level1';
        const timing = getTimingHint();
        return res.json({ replies: [pickRandom(RUDE_RESPONSES[level])], model: 'local-rude', timing: { delayMs: timing.delayMs }, source: 'rude-guard' });
    }
    if (session.rudeCount >= 3) {
        closeSession(session, 'rude');
        return res.json({
            replies: [RUDE_RESPONSES.level3[0]],
            model: 'local-rude',
            closed: true,
            closeReason: 'rude',
            cooldownMinutes: Math.floor(COOLDOWN_RULES.rude / 60000)
        });
    }

    // ============ 🤷 عدم الفهم (5% فقط) ============
    // فقط إذا كانت الرسالة قصيرة جداً أو غامضة
    const isVague = query.trim().length > 0 && query.trim().length < 5 && !/^(مرحبا|هلا|شكرا|طيب|تمام|زين|اوكي|سلام)$/i.test(query.trim());
    if (isVague && Math.random() < 0.4) {
        const timing = getTimingHint();
        return res.json({
            replies: [pickRandom(NOT_UNDERSTOOD)],
            model: 'local-confused',
            timing: { delayMs: timing.delayMs + 1000 },
            source: 'confused'
        });
    }

    // ============ الذكاء الاجتماعي ============
    const socialResult = detectSocial(query);
    if (socialResult) {
        const socialReply = buildSocialResponse(socialResult.types);
        if (socialResult.isPureSocial) {
            const timing = getTimingHint();
            return res.json({
                replies: [socialReply],
                model: 'local-social',
                timing: { delayMs: Math.min(timing.delayMs, 2500) }, // التحيات سريعة
                source: 'social'
            });
        }
        const intent = analyzeUserIntent(query, history);
        const mood = computeMood(session, new Date().getHours(), intent.emotionalState);
        session.mood = Object.keys(MOOD_ARCHETYPES).find(k => MOOD_ARCHETYPES[k].label === mood.label) || 'balanced';
        try {
            const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', mood) +
                `\n\n# تعليمات خاصة\nابدأ ردك بالتحية الطبيعية: "${socialReply}"، ثم انتقل لجواب سؤاله في سطر جديد.`;
            const result = await callGemini(prompt);
            const replies = extractReplies(result.text, result.truncated);
            const timing = getTimingHint();
            return res.json({ replies, model: result.model, timing, source: 'social+gemini' });
        } catch (e) {
            const timing = getTimingHint();
            return res.json({ replies: [socialReply], model: 'local-social-fallback', timing, source: 'social' });
        }
    }

    // ============ تحليل النية ============
    const intent = analyzeUserIntent(query, history);

    if (intent.isDone) {
        closeSession(session, 'user_done');
        return res.json({
            replies: [pickRandom(CLOSING_PATTERNS)],
            model: 'local',
            closed: true,
            closeReason: 'user_done',
            cooldownMinutes: Math.floor(COOLDOWN_RULES.user_done / 60000)
        });
    }

    if (intent.isTrolling && intent.trollScore >= 6) {
        closeSession(session, 'trolling');
        return res.json({
            replies: [TROLL_RESPONSES.level3[0]],
            model: 'local',
            closed: true,
            closeReason: 'trolling',
            cooldownMinutes: Math.floor(COOLDOWN_RULES.trolling / 60000)
        });
    }

    if (intent.isTrolling && intent.trollScore >= 3) {
        const level = intent.trollScore >= 5 ? 'level2' : 'level1';
        const timing = getTimingHint();
        return res.json({ replies: [pickRandom(TROLL_RESPONSES[level])], model: 'local', timing });
    }

    const mood = computeMood(session, new Date().getHours(), intent.emotionalState);
    session.mood = Object.keys(MOOD_ARCHETYPES).find(k => MOOD_ARCHETYPES[k].label === mood.label) || 'balanced';

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', mood);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);

        // ⏱️ توقيت متغيّر
        const timing = getTimingHint();

        // إذا كان بطيئاً، أضف عذر التأخير في بداية الرد
        if (timing.speed === 'slow' && timing.note && replies.length > 0) {
            replies[0] = `${timing.note}.\n${replies[0]}`;
        }

        res.json({
            replies,
            model: result.model,
            dialect,
            mood: { label: mood.label, energy: mood.energy },
            intent: { emotionalState: intent.emotionalState, lengthHint: intent.lengthHint },
            timing: { delayMs: timing.delayMs, speed: timing.speed }
        });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم على البورت ${PORT}`);
    console.log(`🗺️ لهجات: ${Object.keys(DIALECTS).length}`);
    console.log(`⏱️ توقيت متغيّر: نشط`);
    console.log(`🧠 نظام النسيان: نشط`);
    console.log(`🤷 نظام عدم الفهم: نشط`);
});
