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
// 🗄️ الذاكرة الداخلية (تُصفّر عند إعادة تشغيل السيرفر)
// ============================================================
const SESSIONS = new Map();  // key: userKey → { cooldownUntil, closeReason, mood, messageCount, lastActivity }

// 🎭 أنواع الغلق ومدة الانتظار
const COOLDOWN_RULES = {
    user_done:  20 * 60 * 1000,  // 20 دقيقة - أنهى بنفسه
    trolling:   30 * 60 * 1000,  // 30 دقيقة - كان يتسلى
    bored:      15 * 60 * 1000,  // 15 دقيقة - ملل
    deep_close: 10 * 60 * 1000   // 10 دقائق - إغلاق طبيعي بعد محادثة طويلة
};

// ============================================================
// 🎭 الحالة النفسية للمحلل (Persistent Mood System)
// ============================================================
const MOOD_ARCHETYPES = {
    // حالات الطاقة
    fresh:    { label: 'نشيط',      energy: 9, patience: 8, focus: 8, hint: 'متقد الذهن، ردود واضحة ومباشرة.' },
    balanced: { label: 'متوازن',    energy: 6, patience: 7, focus: 7, hint: 'طبيعي، متوازن بين الحماس والحذر.' },
    tired:    { label: 'متعب',      energy: 3, patience: 5, focus: 5, hint: 'ردود مختصرة، أقل تفصيلاً، لكن دقيق.' },
    focused:  { label: 'مركّز جداً', energy: 7, patience: 9, focus: 10, hint: 'يدخل في التفاصيل، ردود عميقة.' },
    // حالات المزاج
    patient:  { label: 'صبور',      energy: 5, patience: 10, focus: 7, hint: 'يشرح ببطء، لا يستعجل.' },
    guarded:  { label: 'حذر',       energy: 5, patience: 6, focus: 8, hint: 'يتحفظ، يذكر المخاطر أكثر.' },
    warm:     { label: 'ودود',      energy: 7, patience: 9, focus: 6, hint: 'دافئ، يستخدم كلمات لطيفة.' },
    cool:     { label: 'بارد',      energy: 4, patience: 4, focus: 9, hint: 'مباشر جداً، بلا مجاملات.' }
};

/**
 * يحدد الحالة النفسية للمحلل بناءً على:
 * - وقت اليوم
 * - عدد الرسائل السابقة
 * - سلوك المستخدم
 */
function computeMood(session, hour, userSentiment) {
    // 1) الأساس حسب الوقت
    let baseMood;
    if (hour >= 6 && hour < 10) baseMood = 'fresh';       // صباح الباكر
    else if (hour >= 10 && hour < 14) baseMood = 'focused'; // ذروة النشاط
    else if (hour >= 14 && hour < 17) baseMood = 'balanced'; // بعد الظهر
    else if (hour >= 17 && hour < 21) baseMood = 'balanced'; // المساء
    else if (hour >= 21 && hour < 24) baseMood = 'tired';   // متأخر
    else baseMood = 'tired';                                 // منتصف الليل

    // 2) تعديل حسب عدد الرسائل
    const msgCount = (session?.messageCount || 0);
    if (msgCount >= 12 && baseMood === 'fresh') baseMood = 'balanced';
    if (msgCount >= 20) baseMood = 'tired';

    // 3) تعديل حسب سلوك المستخدم
    if (userSentiment === 'angry' || userSentiment === 'frustrated') baseMood = 'patient';
    if (userSentiment === 'trolling') baseMood = 'cool';
    if (userSentiment === 'worried' || userSentiment === 'sad') baseMood = 'warm';
    if (userSentiment === 'curious') baseMood = 'focused';

    // 4) إذا كان هناك مزاج محفوظ، احترمه (الثبات مهم)
    if (session?.mood && MOOD_ARCHETYPES[session.mood] && Math.random() < 0.7) {
        return MOOD_ARCHETYPES[session.mood];
    }

    return MOOD_ARCHETYPES[baseMood] || MOOD_ARCHETYPES.balanced;
}

// ============================================================
// 🗺️ اللهجات العربية
// ============================================================
const DIALECTS = {
    saudi: { name: 'خليجي سعودي', country: 'السعودية', vocabulary: ['وش','كذا','زين','أبشر','الحين','ايش','مب'], grammar: ['"وش" للسؤال','"الحين" بدل الآن'], tone: 'لبق، محترم', example: 'والله شوف، الذهب الحين عالق. أنا أشوف الأفضل تنتظر.' },
    emirati: { name: 'خليجي إماراتي', country: 'الإمارات', vocabulary: ['شو','شحال','زين','عيل','تو','هيه'], grammar: ['"شو" للسؤال','"عيل" للتأكيد'], tone: 'هادئ، مهني', example: 'شوف، الموضوع يحتاج تفكير. شحال تقييمك للسوق؟' },
    kuwaiti: { name: 'خليجي كويتي', country: 'الكويت', vocabulary: ['شلون','شنو','چذي','هسه','ترى'], grammar: ['"چ" بدل "ك"','"شنو" للسؤال'], tone: 'ودود، مباشر', example: 'شلونك؟ الذهب شنو وضعه الحين؟ ترى السوق تلخبط.' },
    egyptian: { name: 'مصري', country: 'مصر', vocabulary: ['إزاي','يعني','كده','دلوقتي','بص','معلش'], grammar: ['"إزاي" بدل كيف','"دلوقتي" بدل الآن'], tone: 'ودود، ساخر لطيف', example: 'بص يا باشا، الذهب دلوقتي واقف في نص الطريق.' },
    syrian: { name: 'شامي سوري', country: 'سوريا', vocabulary: ['شو','لك','هلق','تمام','خلص'], grammar: ['"لك" للتوضيح','"هلق" بدل الآن'], tone: 'لبق، ذكي', example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese: { name: 'شامي لبناني', country: 'لبنان', vocabulary: ['شو','كتير','منيح','هلق','خلص'], grammar: ['"كتير" للتكثير','"منيح" بدل جيد'], tone: 'حيوي، ثقافي', example: 'شو الأخبار؟ الذهب اليوم كتير متقلب.' },
    jordanian: { name: 'شامي أردني', country: 'الأردن', vocabulary: ['شو','هاد','هسع','منيح','كثير'], grammar: ['"هاد" بدل هذا','"هسع" بدل الآن'], tone: 'رصين', example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني', country: 'فلسطين', vocabulary: ['شو','هاد','زي','منيح','بالضبط'], grammar: ['"زي" بدل مثل','"هاد" بدل هذا'], tone: 'دافئ، مثقف', example: 'شو رأيك؟ الذهب هالفترة حساس.' },
    iraqi: { name: 'عراقي', country: 'العراق', vocabulary: ['شلون','شكو ماكو','هواية','هسا','عيني','فدوة'], grammar: ['"هواية" بدل كثير','"هسا" بدل الآن'], tone: 'دافئ، يستخدم "عيني"', example: 'شلونك عيني؟ الذهب هسا وضعه هواية حساس.' },
    yemeni: { name: 'يمني', country: 'اليمن', vocabulary: ['كيف','شو','زين','الحين','يا رجل'], grammar: ['"يا رجل" للتأكيد'], tone: 'بسيط، دافئ', example: 'يا رجل، الذهب الحين واقف. شو رأيك؟' },
    moroccan: { name: 'مغاربي مغربي', country: 'المغرب', vocabulary: ['كيفاش','دابا','بزاف','واخا','مزيان'], grammar: ['"بزاف" للتكثير','"واخا" للموافقة','"دابا" بدل الآن'], tone: 'دافئ، "صاحبي"', example: 'كيفاش صاحبي؟ الذهب دابا مو واضح بزاف.' },
    algerian: { name: 'مغاربي جزائري', country: 'الجزائر', vocabulary: ['كيفاش','دروك','بزاف','واه','مليح'], grammar: ['"واه" للإيجاب','"دروك" بدل الآن'], tone: 'صريح، "خويا"', example: 'واه خويا، الذهب دروك واقف. بزاف نستناو أحسن.' },
    tunisian: { name: 'مغاربي تونسي', country: 'تونس', vocabulary: ['كيفاش','برشا','باهي','تو','يعيشك'], grammar: ['"برشا" للتكثير','"باهي" بدل جيد'], tone: 'ودود، "يعيشك"', example: 'كيفاش؟ الذهب تو واقف. برشا ناس تسأل.' },
    sudanese: { name: 'سوداني', country: 'السودان', vocabulary: ['كيفن','بس','يا زول','شنو','عديل'], grammar: ['"يا زول" للنداء','"شنو" بدل ماذا'], tone: 'ودود، "يا زول"', example: 'كيفن يا زول؟ الذهب شنو؟ والله تنتظر أحسن.' }
};

// ============================================================
// 🧠 الحالات النفسية للمستخدم
// ============================================================
const USER_STATES = {
    calm:       { label: 'هادئ',    tone: 'neutral',   hint: 'طبيعي.' },
    curious:    { label: 'فضولي',   tone: 'neutral',   hint: 'يتعلم. اشرح بوضوح.' },
    worried:    { label: 'قلق',     tone: 'reassure',  hint: 'طمئنه أولاً.' },
    anxious:    { label: 'متوتر',   tone: 'reassure',  hint: 'توتر عالٍ. اهدئه.' },
    frustrated: { label: 'محبط',    tone: 'support',   hint: 'تعاطف قصير ثم جواب.' },
    angry:      { label: 'غاضب',    tone: 'deescalate', hint: 'لا تجادله.' },
    sad:        { label: 'حزين',    tone: 'support',   hint: 'دعم إنساني أولاً.' },
    confused:   { label: 'مرتبك',   tone: 'clarify',   hint: 'فكك خطوة خطوة.' },
    excited:    { label: 'متحمس',   tone: 'calm',      hint: 'اهدئه بلطف.' },
    bored:      { label: 'مال',     tone: 'reengage',  hint: 'اسأل سؤالاً محدداً.' },
    trolling:   { label: 'يتسلى',   tone: 'limit',     hint: 'لا تتجاوب مع المحتوى.' },
    done:       { label: 'منتهي',   tone: 'close',     hint: 'أغلق بلطف.' }
};

// ============================================================
// 🎯 كشف النية
// ============================================================
function analyzeUserIntent(query, history) {
    const q = query.trim();
    const qLen = q.length;
    const qWords = q.split(/\s+/).length;
    const qLower = q.toLowerCase();

    const userMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content);
    const recentMsgs = userMsgs.slice(-5);

    const isVeryShort = qLen > 0 && qLen < 8;
    const isGibberish = /^[\s\W_]+$/.test(q) || /(.)\1{4,}/.test(q);
    const isIrrelevant = /^(هههه|ههه|lol|😅|😂|🤣|سوالف|نكتة|نكت|ضحكني|ملل|طفش)/i.test(q);
    const isProvocative = /(غبي|ما تفهم|فاشل|كذاب|خرطي|هراء|سخيف|احمق)/i.test(q);
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
    if (isProvocative) trollScore += 3;
    if (isOffTopic && recentMsgs.length >= 2) trollScore += 2;
    if (repeatCount >= 3) trollScore += 2;
    if (userMsgs.length >= 5 && userMsgs.every(m => m.trim().length < 12)) trollScore += 2;

    const isTrolling = trollScore >= 3;
    const isDone = /^(شكرا|شكراً|مشكور|تسلم|يعطيك|جزاك|الله يخليك|باي|وداعا|مع السلامة|كفى|خلص|انتهيت|مشكورين|تمام كذا|سلام)/i.test(q) && qLen < 40;
    const isGreeting = /^(مرحبا|أهلا|السلام|هاي|هلا|يا هلا|صباح|مساء)/i.test(q) && qLen < 30;
    const isShort = qLen < 20;
    const isMedium = qLen >= 20 && qLen < 80;
    const isLong = qLen >= 80 && qLen < 250;
    const isVeryLong = qLen >= 250;

    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|وضح|بالتفصيل|تفاصيل|موسع)/i.test(q);
    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول)/i.test(q);
    const wantsCompare = /(قارن|مقارنة|الفرق بين|أيهما)/i.test(q);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح)/i.test(q);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس|مستقبل|تتوقع|توقعك)/i.test(q);
    const wantsHowTo = /(كيف|طريقة|خطوات|أسوي|أبدأ|عمل)/i.test(q);
    const wantsWhy = /(ليش|لماذا|ايش السبب|وش السبب|سبب|علاش|كيفاش)/i.test(q);

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

    let needsClarify = false;
    let clarifyHint = '';
    if (isShort && !isGreeting && !isDone && qWords <= 2) {
        needsClarify = true;
        clarifyHint = 'سؤال قصير جداً — اسأل سؤالاً توضيحياً واحداً.';
    }
    if (wantsAdvice && !hasEnoughContext(q, history)) {
        needsClarify = true;
        clarifyHint = 'يطلب نصيحة بدون سياق. اسأل سؤالاً استراتيجياً واحداً.';
    }

    let state = 'calm';
    if (isTrolling) state = 'trolling';
    else if (isDone) state = 'done';
    else if (/(قلق|خايف|خوف|مرتبك|متوتر|مو مرتاح)/i.test(q)) state = 'worried';
    else if (/(متوتر|عصبي|مشدود|ضغط)/i.test(q)) state = 'anxious';
    else if (/(زهقت|تعبت|يئست|خسرت|زعلان|حزين|مكتئب)/i.test(q)) state = 'sad';
    else if (/(غاضب|معصب|منرفز|كرهت)/i.test(q)) state = 'angry';
    else if (/(محتار|ملخبط|مو فاهم|ما فهمت|غامض)/i.test(q)) state = 'confused';
    else if (/(متحمس|حماس|فرحان|مبسوط|متشوق)/i.test(q)) state = 'excited';
    else if (/(ملل|طفش|زهقان|مليت|ما في شي)/i.test(q)) state = 'bored';
    else if (/(استفسار|كيف|ايش|وش|ليش|متى|وين|هل)/i.test(q)) state = 'curious';

    const isRepeat = detectRepeat(query, history);

    return {
        isTrolling, isDone, trollScore,
        intent: { isGreeting, isShort, isMedium, isLong, isVeryLong },
        wants: { detail: wantsDetail, brief: wantsBrief, compare: wantsCompare, advice: wantsAdvice, analysis: wantsAnalysis, howto: wantsHowTo, why: wantsWhy },
        lengthHint, styleHint, needsClarify, clarifyHint,
        emotionalState: state,
        emotionalConfig: USER_STATES[state] || USER_STATES.calm,
        isRepeat, qWords, qLen
    };
}

function hasEnoughContext(query, history) {
    if (!history || history.length < 3) return false;
    const userMessages = history.filter(h => h.role === 'user').map(h => h.content).join(' ');
    return /(محفظتي|رأس مال|ميزانية|دخل|استثمار|الهدف|المدة|دخلت|أمتلك|عندي|سنوي|شهري)/i.test(userMessages);
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
// 📏 القواعد
// ============================================================
const LENGTH_RULES = {
    very_short: '**جملة أو جملتان فقط**. لا مقدمات.',
    short: '**2-4 أسطر**. إجابة + سبب.',
    medium: '**4-6 أسطر**. إجابة + سببين + تنبيه.',
    long: '**6-10 أسطر**. سياق ثم تحليل مركّز.',
    detailed: '**حتى 14 سطراً**. تحليل منظّم.'
};

const STYLE_RULES = {
    default: 'أجب على السؤال مباشرة.',
    compare: 'قارن: الميزة، العيب، الأفضل لمن.',
    howto: 'خطوات مرقّمة عملية.',
    analysis: 'الوضع → العوامل → السيناريو → تنبيه.',
    advice: 'رأيك بوضوح مع سببين.',
    why: 'السبب الجذري + فرعان للأثر.',
    detail: 'ثلاث زوايا، كل زاوية 2-3 أسطر.'
};

const TONE_RULES = {
    neutral: '',
    reassure: '→ قلق. ابدأ بطمأنة، ثم الجواب بثقة.',
    support: '→ محبط. تعاطف قصير ثم جواب.',
    deescalate: '→ غاضب. اعترف بمشاعره أولاً، ثم جواب هادئ.',
    clarify: '→ مرتبك. "الموضوع أبسط مما يبدو"، ثم فكك.',
    calm: '→ متحمس. "حماسك مفهوم، لكن خلنا نهدأ".',
    reengage: '→ مالّ. اسأل سؤالاً محدداً يوقظ اهتمامه.',
    limit: '→ يتسلى. لا تتجاوب مع المحتوى.',
    close: '→ انتهى. أغلق بلطف.'
};

// ============================================================
// 🚪 ردود الإغلاق المحلي
// ============================================================
const CLOSING_PATTERNS = [
    'على الرحب والسعة. إذا احتجت شي، أنا موجود.',
    'بالتوفيق. أنا هنا وقت ما تحتاج.',
    'أتمنى لك التوفيق، لا تتردد بالعودة.',
    'في خدمتك دائماً. يوم موفق.',
    'سعيد بمساعدتك. إذا جد جديد، أنا هنا.'
];

const TROLL_RESPONSES = {
    level1: ['يبدو الحديث خرج عن الموضوع. إذا كان لديك استفسار مالي، أنا جاهز.', 'لنركز على ما ينفعك — هل لديك سؤال استثماري محدد؟'],
    level2: ['أنا هنا لاستشارات مالية جدية. إذا كان لديك سؤال حقيقي، تفضل. وإلا سأضطر لإغلاق الجلسة.', 'يبدو أنك لا تبحث عن استشارة مالية. إذا احتجت مساعدة جدية، أعد فتح المحادثة.'],
    level3: ['سأغلق المحادثة الآن. إذا كان لديك استفسار مالي حقيقي، تفضل بالعودة لاحقاً. يوم موفق.']
};

const COOLDOWN_MESSAGES = {
    user_done:  (min) => `أهلاً بك مجدداً. المحادثة السابقة أُغلقت. تستطيع فتح جلسة جديدة بعد ${min} دقيقة، أو اختر قسماً آخر.`,
    trolling:   (min) => `المحادثة السابقة أُغلقت بسبب محتوى غير جدي. يمكنك العودة بعد ${min} دقيقة.`,
    bored:      (min) => `أهلاً. الجلسة السابقة أُغلقت لأن الموضوع لم يعد يشدّك. عُد بعد ${min} دقيقة لمحاولة جديدة.`,
    deep_close: (min) => `المحادثة السابقة أُغلقت بشكل طبيعي. عُد بعد ${min} دقيقة، أو اختر قسماً آخر الآن.`
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

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-5).map(h =>
            `${h.role === 'user' ? (user?.firstName || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 220)}`
          ).join('\n') + '\n---'
        : '';

    const repeatHint = intent.isRepeat ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف.' : '';
    const clarifyHint = intent.needsClarify ? `\n❓ ${intent.clarifyHint}` : '';
    const trollingHint = intent.isTrolling ? `\n🚨 المستخدم يتسلى (${intent.trollScore}). لا تتجاوب مع محتواه.` : '';
    const doneHint = intent.isDone ? `\n✅ المستخدم أنهى. أغلق بلطف.` : '';

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# أنت
${expert?.name || 'مستشار'}، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
أنت من ${dialect.country}.

# 🌍 لهجتك
تحدث بـ**${dialect.name}**.
- مفرداتك: ${dialect.vocabulary.join('، ')}
- قواعدك: ${dialect.grammar.join(' | ')}
- نبرتك: ${dialect.tone}
- مثال: "${dialect.example}"

⚠️ استخدم 2-4 مفردات من لهجتك فقط. الفكرة المهمة بالفصحى، الود باللهجة.

# 🎭 حالتك النفسية الآن
${mood.label} — ${mood.hint}
مستوى طاقتك: ${mood.energy}/10 | صبرك: ${mood.patience}/10 | تركيزك: ${mood.focus}/10
${mood.energy <= 4 ? '⚠️ أنت متعب اليوم — ردودك ستكون أقصر، أقل تفصيلاً.' : ''}
${mood.patience <= 4 ? '⚠️ صبرك منخفض — لا تتحمل الأسئلة غير الجدية.' : ''}
${mood.focus >= 9 ? '✨ تركيزك عالٍ — يمكنك الدخول في التفاصيل.' : ''}

# المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- البلد: ${user?.country || 'غير محدد'}
- الخبرة: ${user?.experience || 'غير محدد'}
${user?.reason ? `- السبب: ${user.reason}` : ''}

# الوقت والمزاج العام
- الوقت: ${dayPart}
${repeatHint}${clarifyHint}${trollingHint}${doneHint}

# 🎯 تحليل السؤال
- الطول: **${intent.lengthHint}** → ${LENGTH_RULES[intent.lengthHint]}
- النمط: **${intent.styleHint}** → ${STYLE_RULES[intent.styleHint]}
- حالة المستخدم: **${intent.emotionalState}** (${intent.emotionalConfig.label}) → ${TONE_RULES[intent.emotionalConfig.tone]}

${historyText}

# ⛔ محرّمات
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة"، "تجدر الإشارة".
- القوالب الثابتة (ملخص → عوامل → سيناريوهات).
- الإيموجي في الردود الرسمية.
- البولد (**) أكثر من مرة.
- تكرار اسم المستخدم أكثر من مرة.
- التحية المتكررة إذا وُجد سجل.
- القوائم النقطية إلا إذا طُلب.
- العامية المبتذلة.
- "أضمن لك"، "100%".
- الاعتذار المفرط.

# ✅ قواعد
1. طابق الطول: قصير → قصير.
2. طابق النبرة: اقرأ الشعور.
3. طابق اللهجة: بثقة.
4. ابدأ بالجوهر.
5. اسأل قبل أن تخمن.
6. واثق لكن غير متعجرف.
7. اعترف بحدود المعرفة.
8. اذكر المخاطر.
9. نوّع البدايات.
10. الاختصار = الثقة.

# 🚪 الإغلاق
- شكر/إنهاء → أغلق بلطف: "${CLOSING_PATTERNS[Math.floor(Math.random() * CLOSING_PATTERNS.length)]}"
- خارج التخصص → وجّه للأقسام المناسبة.
- تسلٍّ → ذكّر بالمهمة. إذا استمر، أغلق.

# السؤال الآن
"${query}"

اكتب ردك بلهجتك. بذرة: ${seed}.
إذا احتجت فكرتين، ضع [SPLIT].`;
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
                    generationConfig: {
                        temperature: 1.05,
                        maxOutputTokens: 3000,
                        topP: 0.95,
                        topK: 80
                    },
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
        } catch (e) {
            lastError = e.message;
        }
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
// 🗄️ إدارة الجلسات والـ Cooldown
// ============================================================
function getUserKey(user, section) {
    // مفتاح فريد لكل مستخدم + قسم
    const name = user?.firstName || 'anon';
    const age = user?.age || '0';
    return `${section}::${name}::${age}`;
}

function getSession(userKey) {
    if (!SESSIONS.has(userKey)) {
        SESSIONS.set(userKey, {
            cooldownUntil: 0,
            closeReason: null,
            mood: null,
            messageCount: 0,
            lastActivity: Date.now(),
            createdAt: Date.now()
        });
    }
    return SESSIONS.get(userKey);
}

function checkCooldown(session) {
    const now = Date.now();
    if (session.cooldownUntil && now < session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - now) / 60000); // بالدقائق
        return { active: true, remaining };
    }
    return { active: false };
}

function closeSession(session, reason) {
    const cooldown = COOLDOWN_RULES[reason] || COOLDOWN_RULES.user_done;
    session.cooldownUntil = Date.now() + cooldown;
    session.closeReason = reason;
    session.messageCount = 0;  // reset للجلسة الجديدة
    session.mood = null;       // reset المزاج
}

// تنظيف دوري للجلسات القديمة (كل ساعة)
setInterval(() => {
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    for (const [key, session] of SESSIONS.entries()) {
        if (now - session.lastActivity > sixHours) {
            SESSIONS.delete(key);
        }
    }
}, 60 * 60 * 1000);

// ============================================================
// 🎯 تقرير الإغلاق
// ============================================================
function shouldCloseConversation(intent, history) {
    if (intent.isDone) return { close: true, reason: 'user_done' };
    if (intent.isTrolling && intent.trollScore >= 6) return { close: true, reason: 'trolling' };
    if (intent.emotionalState === 'bored' && history && history.filter(h => h.role === 'user').length >= 4) {
        return { close: true, reason: 'bored' };
    }
    // إغلاق طبيعي بعد محادثة طويلة جداً
    if (history && history.filter(h => h.role === 'user').length >= 20) {
        return { close: true, reason: 'deep_close' };
    }
    return { close: false };
}

// ============================================================
// 🛡️ المسارات
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        behavior: 'Pro-Support-v5-Cooldown-PersistentMood',
        dialectsCount: Object.keys(DIALECTS).length,
        moodsCount: Object.keys(MOOD_ARCHETYPES).length,
        activeSessions: SESSIONS.size,
        modelsCount: availableModels.length
    });
});

// مسار إضافي: حالة الجلسة
app.post('/api/session-status', (req, res) => {
    const { user, section } = req.body;
    const userKey = getUserKey(user, section);
    const session = getSession(userKey);
    const cooldown = checkCooldown(session);
    res.json({
        cooldownActive: cooldown.active,
        remainingMinutes: cooldown.remaining || 0,
        closeReason: session.closeReason,
        messageCount: session.messageCount
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

    // 🚫 فحص الكولداون
    const cooldown = checkCooldown(session);
    if (cooldown.active) {
        return res.status(429).json({
            error: 'المحادثة في فترة انتظار',
            cooldown: true,
            remainingMinutes: cooldown.remaining,
            reason: session.closeReason,
            message: COOLDOWN_MESSAGES[session.closeReason]?.(cooldown.remaining) || 
                     `عذراً، الجلسة السابقة أُغلقت. يمكنك العودة بعد ${cooldown.remaining} دقيقة.`
        });
    }

    // تحليل النية
    const intent = analyzeUserIntent(query, history);

    // 🚪 هل نغلق فوراً؟
    const closeDecision = shouldCloseConversation(intent, history);

    if (closeDecision.close) {
        let replies = [];
        if (closeDecision.reason === 'user_done') {
            replies = [CLOSING_PATTERNS[Math.floor(Math.random() * CLOSING_PATTERNS.length)]];
        } else if (closeDecision.reason === 'trolling') {
            replies = [TROLL_RESPONSES.level3[0]];
        } else if (closeDecision.reason === 'bored') {
            replies = ['يبدو أن الموضوع ما شدّك. إذا احتجت استشارة محددة، أنا موجود. يوم موفق.'];
        } else if (closeDecision.reason === 'deep_close') {
            replies = ['محادثة طويلة ومفيدة. خذ وقتك في تطبيق ما تحدثنا عنه، وأنا هنا وقت ما تحتاج. يوم موفق.'];
        }
        closeSession(session, closeDecision.reason);
        return res.json({
            replies,
            model: 'local',
            closed: true,
            closeReason: closeDecision.reason,
            cooldownMinutes: Math.floor(COOLDOWN_RULES[closeDecision.reason] / 60000)
        });
    }

    // 🛡️ تحكم في التسلية
    if (intent.isTrolling && intent.trollScore >= 3 && intent.trollScore < 6) {
        const level = intent.trollScore >= 5 ? 'level2' : 'level1';
        const replies = [TROLL_RESPONSES[level][Math.floor(Math.random() * TROLL_RESPONSES[level].length)]];
        return res.json({ replies, model: 'local', intent: { isTrolling: true } });
    }

    // 🎭 تحديد الحالة النفسية (persistent)
    const mood = computeMood(session, new Date().getHours(), intent.emotionalState);
    session.mood = Object.keys(MOOD_ARCHETYPES).find(k => MOOD_ARCHETYPES[k].label === mood.label) || 'balanced';

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', mood);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        res.json({
            replies,
            model: result.model,
            dialect,
            mood: { label: mood.label, energy: mood.energy, patience: mood.patience, focus: mood.focus },
            intent: {
                emotionalState: intent.emotionalState,
                lengthHint: intent.lengthHint,
                styleHint: intent.styleHint
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على البورت ${PORT}`);
    console.log(`🗺️ اللهجات: ${Object.keys(DIALECTS).length}`);
    console.log(`🎭 الحالات النفسية للمحلل: ${Object.keys(MOOD_ARCHETYPES).length}`);
    console.log(`⏱️ نظام الكولداون: نشط`);
});
