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
            const s = m => {
                let x = 0;
                if (m.includes('2.5-flash')) x -= 100;
                if (m.includes('2.0-flash')) x -= 90;
                if (m.includes('2.5-pro')) x -= 80;
                if (m.includes('flash-latest')) x -= 70;
                if (m.includes('flash')) x -= 30;
                if (m.includes('pro')) x -= 20;
                if (m.includes('preview')) x += 50;
                if (m.includes('exp')) x += 50;
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
    if (m.length) { availableModels = m; modelsLastFetched = Date.now(); }
}

refreshModels(true);

// ============================================================
// 🗺️ اللهجات العربية — إرشادات مفصّلة لكل لهجة
// ============================================================
const DIALECTS = {
    saudi: {
        name: 'خليجي سعودي', country: 'السعودية',
        vocabulary: ['وش', 'كذا', 'زين', 'أبشر', 'الحين', 'ايش', 'شلون', 'ما هو', 'يعني', 'على طول', 'تو', 'مب'],
        grammar: ['يستخدم "وش" للسؤال عن الشيء', 'يستخدم "أبشر" للقبول', '"الحين" بدل الآن'],
        tone: 'لبق، محترم، مباشر أحياناً، يستخدم "يا طويل العمر" رسمياً',
        example: 'والله شوف، الذهب الحين عالق بين مستويين. أنا أشوف الأفضل تنتظر.'
    },
    emirati: {
        name: 'خليجي إماراتي', country: 'الإمارات',
        vocabulary: ['شو', 'شحال', 'زين', 'عيل', 'تو', 'الحين', 'يا ريال', 'هيه'],
        grammar: ['يستخدم "شو" للسؤال', 'يستخدم "عيل" للتأكيد'],
        tone: 'هادئ، مهني، واثق',
        example: 'شوف، الموضوع يحتاج تفكير. شحال تقييمك للسوق الحالي؟'
    },
    kuwaiti: {
        name: 'خليجي كويتي', country: 'الكويت',
        vocabulary: ['شلون', 'شنو', 'اي', 'چذي', 'هسه', 'عيل', 'زين', 'ترى'],
        grammar: ['يستخدم "چ" بدل "ك" في بعض الكلمات', '"شنو" للسؤال'],
        tone: 'ودود، مباشر، يستخدم "حبيبي" مع اللطف',
        example: 'شلونك؟ شوف الوضع، الذهب شنو وضعه الحين؟ ترى السوق تلخبط.'
    },
    qatari: {
        name: 'خليجي قطري', country: 'قطر',
        vocabulary: ['شلون', 'شسوي', 'زين', 'الحين', 'عيل', 'وايد', 'هالكلام'],
        grammar: ['يستخدم "وايد" للتكثير', 'يستخدم "هالكلام"'],
        tone: 'هادئ، محترم',
        example: 'شوف، الوضع زين بس محتاج تفكير وايد. شلون تشوف الموضوع؟'
    },
    bahraini: {
        name: 'خليجي بحريني', country: 'البحرين',
        vocabulary: ['شلون', 'شنو', 'زين', 'هسه', 'ايه', 'چدي'],
        grammar: ['قريب من الكويتي'],
        tone: 'ودود، بسيط',
        example: 'شلونك؟ شوف الموضوع بسيط. الذهب شنو رأيك فيه؟'
    },
    omani: {
        name: 'خليجي عماني', country: 'عُمان',
        vocabulary: ['شو', 'كيف', 'زين', 'مو', 'عاد', 'تو', 'حياك'],
        grammar: ['يستخدم "مو" للنفي', '"حياك" للترحيب'],
        tone: 'هادئ، محترم، يستخدم "حياك الله"',
        example: 'حياك الله. شوف، الذهب الوضع مو واضح تو. كيف تشوفه أنت؟'
    },
    egyptian: {
        name: 'مصري', country: 'مصر',
        vocabulary: ['إزاي', 'يعني', 'أهو', 'كده', 'خالص', 'دلوقتي', 'بص', 'شوف', 'معلش', 'على فكرة', 'طبعاً'],
        grammar: ['يستخدم "إزاي" بدل كيف', '"دلوقتي" بدل الآن', '"كده" بدل هكذا', '"معلش" للاعتذار الخفيف'],
        tone: 'ودود، ساخر أحياناً بلطف، يستخدم "يا باشا" و"يا فندم"',
        example: 'بص يا باشا، الذهب دلوقتي واقف في نص الطريق. إزاي تشوف الموضوع؟ أنا شايف نستنى شوية.'
    },
    syrian: {
        name: 'شامي سوري', country: 'سوريا',
        vocabulary: ['شو', 'لك', 'هلق', 'تمام', 'بلا', 'خلص', 'شغل', 'يعني', 'بلا مزح'],
        grammar: ['يستخدم "لك" كأداة توضيح', '"هلق" بدل الآن', '"شو" بدل ماذا'],
        tone: 'لبق، ذكي، يستخدم "لك" و"يعني" كثيراً',
        example: 'لك شو عم تحكي؟ الذهب هلق واقف بين مستويين. يعني أنا ما بنصحك تدخل بكل رأس مالك.'
    },
    lebanese: {
        name: 'شامي لبناني', country: 'لبنان',
        vocabulary: ['شو', 'كتير', 'منيح', 'هلق', 'خلص', 'يعني', 'شو الأخبار', 'يا ريت'],
        grammar: ['يستخدم "كتير" للتكثير', '"منيح" بدل جيد', '"خلص" بدل انتهى'],
        tone: 'حيوي، ثقافي، يستخدم "كتير" و"منيح"',
        example: 'شو الأخبار؟ الذهب اليوم كتير متقلب. منيح إنك تسأل قبل ما تتحرك.'
    },
    jordanian: {
        name: 'شامي أردني', country: 'الأردن',
        vocabulary: ['شو', 'هاد', 'هسع', 'زلمة', 'منيح', 'عشان', 'يعني', 'كثير'],
        grammar: ['يستخدم "هاد" بدل هذا', '"هسع" بدل الآن'],
        tone: 'رصين، واضح، يستخدم "هاي" و"هاد"',
        example: 'هاي شو، الذهب هسع واقف. أنا بشوف الوضع منيح للاستثمار، بس مو للمضاربة.'
    },
    palestinian: {
        name: 'شامي فلسطيني', country: 'فلسطين',
        vocabulary: ['شو', 'هاد', 'زي', 'منيح', 'خلص', 'يعني', 'كثير', 'بالضبط'],
        grammar: ['يستخدم "زي" بدل مثل', '"هاد" بدل هذا'],
        tone: 'دافئ، مثقف',
        example: 'شو رأيك؟ أنا بشوف الموضوع زي ما حكيت، الذهب هالفترة حساس.'
    },
    iraqi: {
        name: 'عراقي', country: 'العراق',
        vocabulary: ['شلون', 'شكو ماكو', 'هواية', 'زين', 'هسا', 'چان', 'عيني', 'فدوة', 'هيچ'],
        grammar: ['يستخدم "شلون" بدل كيف', '"هواية" بدل كثير', '"هسا" بدل الآن', '"چان" بدل كان'],
        tone: 'دافئ، يستخدم "عيني" و"فدوة" للطف',
        example: 'شلونك عيني؟ شكو ماكو؟ الذهب هسا وضعه هواية حساس. آني أشوف الأفضل تنتظر.'
    },
    yemeni: {
        name: 'يمني', country: 'اليمن',
        vocabulary: ['كيف', 'شو', 'زين', 'الحين', 'عيل', 'صاحبي', 'يا رجل', 'أها'],
        grammar: ['يستخدم "يا رجل" للتأكيد', '"عيل" للربط'],
        tone: 'بسيط، دافئ',
        example: 'يا رجل، الذهب الحين واقف. أنا شايف الوضع زين للاستثمار، شو رأيك؟'
    },
    moroccan: {
        name: 'مغاربي مغربي', country: 'المغرب',
        vocabulary: ['كيفاش', 'دابا', 'بزاف', 'واخا', 'زعما', 'مزيان', 'شحال', 'زوين', 'ديك'],
        grammar: ['يستخدم "بزاف" للتكثير', '"واخا" للموافقة', '"دابا" بدل الآن', '"مزيان" بدل جيد'],
        tone: 'دافئ، يستخدم "صاحبي" و"أخويا"',
        example: 'كيفاش صاحبي؟ شوف، الذهب دابا مو واضح بزاف. واخا نتسناو، أحسن من نندمو.'
    },
    algerian: {
        name: 'مغاربي جزائري', country: 'الجزائر',
        vocabulary: ['كيفاش', 'دروك', 'بزاف', 'واه', 'مليح', 'كيما', 'شحال', 'صح'],
        grammar: ['يستخدم "واه" للإيجاب', '"دروك" بدل الآن', '"بزاف" بدل كثير'],
        tone: 'صريح، مباشر، يستخدم "خويا"',
        example: 'واه خويا، الذهب دروك واقف. أنا نشوف بزاف نستناو، أحسن.'
    },
    tunisian: {
        name: 'مغاربي تونسي', country: 'تونس',
        vocabulary: ['كيفاش', 'برشا', 'باهي', 'تو', 'يعيشك', 'شحال', 'علاش', 'ياسر'],
        grammar: ['يستخدم "برشا" للتكثير', '"باهي" بدل جيد', '"تو" بدل الآن'],
        tone: 'ودود، يستخدم "يعيشك" للطف',
        example: 'كيفاش؟ شوف، الذهب تو واقف. برشا ناس تسأل نفس السؤال. باهي تنتظر شوية.'
    },
    sudanese: {
        name: 'سوداني', country: 'السودان',
        vocabulary: ['كيفن', 'بس', 'يا زول', 'شنو', 'قايل', 'أها', 'والله', 'عديل'],
        grammar: ['يستخدم "يا زول" للنداء', '"شنو" بدل ماذا', '"عديل" بدل جيد'],
        tone: 'ودود، يستخدم "يا زول"',
        example: 'كيفن يا زول؟ الذهب شنو؟ والله شوف، أنا قايل تنتظر شوية أحسن.'
    }
};

// ============================================================
// 🧠 محرك الاستشارة الفخم — Pro v3
// ============================================================

const MOODS = [
    { name: 'تحليلي', hint: 'منطق وأرقام بلا مجاملات.' },
    { name: 'مباشر', hint: 'تجاوب على الجوهر، بلا مقدمات.' },
    { name: 'حذر', hint: 'تؤكد على المخاطر.' },
    { name: 'متعمق', hint: 'تعطي سياقاً ثم الجواب.' },
    { name: 'عملي', hint: 'خطوات قابلة للتطبيق.' },
    { name: 'متحفظ', hint: 'تعترف بحدود المعرفة.' },
    { name: 'حاسم', hint: 'رأي واضح مع أسبابه.' },
    { name: 'استشاري', hint: 'سؤال توضيحي قبل الجواب.' }
];

function analyzeUserIntent(query, history) {
    const q = query.trim();
    const qLen = q.length;
    const qWords = q.split(/\s+/).length;

    const isGreeting = /^(مرحبا|أهلا|السلام|هاي|هلا|يا هلا|صباح|مساء)/i.test(q) && qLen < 30;
    const isThanks = /^(شكرا|مشكور|تسلم|يعطيك|جزاك|الله يخليك)/i.test(q) && qLen < 30;
    const isFarewell = /^(مع السلامة|وداعا|باي|بسلامة|في أمان|إلى اللقاء)/i.test(q);
    const isAck = /^(اوكي|أوكي|طيب|تمام|حسنا|ماشي|زين|ok|okay|واخا|باهي|صح)$/i.test(q);
    const isShort = qLen < 20;
    const isMedium = qLen >= 20 && qLen < 80;
    const isLong = qLen >= 80 && qLen < 250;
    const isVeryLong = qLen >= 250;

    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|وضح|وضّح|بالتفصيل|تفاصيل|شرح مفصل|بشكل مفصل|موسع|موسّع)/i.test(q);
    const wantsBrief = /(باختصار|اختصار|بسرعة|سريع|مختصر|مو طويل|لا تطول|جزاك)/i.test(q);
    const wantsCompare = /(قارن|مقارنة|الفرق بين|أفضل بين|افضل بين|أيهما)/i.test(q);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ايش رايك|وش رايك|ماذا تنصح)/i.test(q);
    const wantsAnalysis = /(حلل|تحليل|قيّم|قيم|درس|ادرس|مستقبل|تتوقع|توقعك)/i.test(q);
    const wantsHowTo = /(كيف|طريقة|خطوات|أسوي|اسوي|أبدأ|ابدأ|عمل)/i.test(q);
    const wantsWhy = /(ليش|لماذا|ايش السبب|وش السبب|سبب|علاش|كيفاش)/i.test(q);

    const isUrgent = /(بسرعة|ضروري|عاجل|الآن|حالا|حالاً|مستعجل)/i.test(q);
    const isConfused = /(محتار|ملخبط|مو فاهم|ما فهمت|مو واضح|غامض)/i.test(q);
    const isWorried = /(قلق|خايف|مرتبك|متوتر|مو مرتاح)/i.test(q);
    const isExcited = /(متحمس|حماس|فرحان|متشوق)/i.test(q);
    const isFrustrated = /(زهقت|تعبت|يئست|خسرت|زعلان|متضايق|حزين)/i.test(q);

    const isRepeat = detectRepeat(query, history);

    let lengthHint = 'medium';
    if (wantsBrief || isAck || isGreeting || isThanks || isFarewell || isShort) lengthHint = 'very_short';
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
    if (isShort && !isGreeting && !isThanks && !isAck && !isFarewell && qWords <= 2) {
        needsClarify = true;
        clarifyHint = 'سؤال قصير جداً — اسأل سؤالاً توضيحياً واحداً قبل الإجابة.';
    }
    if (wantsAdvice && !hasEnoughContext(q, history)) {
        needsClarify = true;
        clarifyHint = 'المستخدم يطلب نصيحة بدون معلومات كافية. اسأل سؤالاً استراتيجياً واحداً (الهدف، المدة، حجم رأس المال، تحمل المخاطر).';
    }

    let tone = 'neutral';
    if (isUrgent) tone = 'urgent';
    else if (isConfused) tone = 'clarify';
    else if (isWorried) tone = 'reassure';
    else if (isExcited) tone = 'calm';
    else if (isFrustrated) tone = 'support';

    return {
        intent: { isGreeting, isThanks, isFarewell, isAck, isShort, isMedium, isLong, isVeryLong },
        wants: { detail: wantsDetail, brief: wantsBrief, compare: wantsCompare, advice: wantsAdvice, analysis: wantsAnalysis, howto: wantsHowTo, why: wantsWhy },
        lengthHint, styleHint, needsClarify, clarifyHint, tone, isRepeat, qWords, qLen
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

const LENGTH_RULES = {
    very_short: '**جملة واحدة أو جملتان فقط**. لا مقدمات، لا تفاصيل.',
    short: '**2-4 أسطر**. إجابة مباشرة + سبب واحد.',
    medium: '**4-6 أسطر**. إجابة + سببين + تنبيه قصير.',
    long: '**6-10 أسطر**. سياق قصير ثم تحليل مركّز.',
    detailed: '**حتى 14 سطراً**. تحليل منظّم بلا حشو.'
};

const STYLE_RULES = {
    default: 'أجب على السؤال مباشرة بما يناسب نوعه.',
    compare: 'قارن بين البديلين: الميزة، العيب، الأفضل لمن.',
    howto: 'خطوات مرقّمة عملية، كل خطوة سطر.',
    analysis: 'حلل: الوضع → العوامل → السيناريو → التنبيه.',
    advice: 'قل رأيك بوضوح مع سببين.',
    why: 'اشرح السبب الجذري بجملة، ثم فرعين للأثر.',
    detail: 'افتح الموضوع بثلاث زوايا، كل زاوية 2-3 أسطر.'
};

const TONE_RULES = {
    neutral: '',
    urgent: '→ المستعجل يحتاج جواباً سريعاً أولاً.',
    clarify: '→ المستخدم مرتبك. ابدأ بتطمين ("الموضوع أبسط مما يبدو").',
    reassure: '→ المستخدم قلق. ابدأ بجملة طمأنة ثم الجواب.',
    calm: '→ المستخدم متحمس. اهدئه بلطف.',
    support: '→ المستخدم محبط. ابدأ بتعاطف قصير.'
};

function buildPrompt(section, query, user, expert, history, dialectKey) {
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
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

    const repeatHint = intent.isRepeat
        ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف.'
        : '';

    const clarifyHint = intent.needsClarify
        ? `\n❓ ${intent.clarifyHint}`
        : '';

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# أنت
${expert?.name || 'مستشار'}، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
أنت من ${dialect.country}.

# 🌍 لهجتك — مهم جداً
تحدث بـ**${dialect.name}** بشكل طبيعي وأصيل.
- مفردات لهجتك: ${dialect.vocabulary.join('، ')}
- قواعدها: ${dialect.grammar.join(' | ')}
- نبرتك المحلية: ${dialect.tone}
- **مثال على أسلوبك**: "${dialect.example}"

⚠️ قواعد اللهجة:
1. استخدم **2-4 مفردات** من لهجتك في كل رد (ليس كل كلمة).
2. حافظ على **الفصحى المبسطة** للعمق الفكري.
3. **لا تبالغ** — قد تكون لهجتك ثقيلة على القارئ.
4. **ممنوع** خلط لهجات أخرى (لا تستخدم "شلون" إذا كنت مصرياً).
5. **ممنوع** العامية المبتذلة أو السوقية.
6. **الفكرة المهمة تُقال بالفصحى**، والودّ يُقال باللهجة.

# المستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- البلد: ${user?.country || 'غير محدد'}
- الخبرة: ${user?.experience || 'غير محدد'}
${user?.reason ? `- سبب الاستشارة: ${user.reason}` : ''}

# حالتك
- المزاج: ${mood.name} — ${mood.hint}
- الوقت: ${dayPart}
${repeatHint}${clarifyHint}

# 🎯 النية المُكتشفة
- الطول المطلوب: **${intent.lengthHint}** → ${LENGTH_RULES[intent.lengthHint]}
- نمط الإجابة: **${intent.styleHint}** → ${STYLE_RULES[intent.styleHint]}
- النبرة: **${intent.tone}** → ${TONE_RULES[intent.tone]}
- طلبات خاصة: ${Object.entries(intent.wants).filter(([k,v])=>v).map(([k])=>k).join(', ') || 'لا شيء'}

${historyText}

# ⛔ محرّمات صارمة (تكشف الذكاء الاصطناعي)
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة"، "تجدر الإشارة"، "من الجدير بالذكر".
- القوالب الثابتة (ملخص → عوامل → سيناريوهات → توصية).
- الإيموجي في الردود الرسمية.
- البولد (**) أكثر من مرة.
- تكرار اسم المستخدم أكثر من مرة.
- التحية المتكررة إذا وُجد سجل حوار.
- القوائم النقطية إلا إذا طُلب.
- اللغة العامية السوقية المبتذلة.
- الوعود القاطعة: "أضمن لك".
- الاعتذار المفرط.

# ✅ قواعد المستشار الفخم
1. **طابق الطول**: سؤال قصير → رد قصير.
2. **طابق النبرة**: اقرأ شعور المستخدم.
3. **طابق اللهجة**: تكلّم بلهجتك بثقة.
4. **ابدأ بالجوهر**: لا مقدمات.
5. **اسأل قبل أن تخمن**: عند نقص المعلومات.
6. **كن واثقاً لكن غير متعجرف**.
7. **اعترف بحدود المعرفة**.
8. **اذكر المخاطر**.
9. **نوّع البدايات**.
10. **الاختصار علامة الثقة**.

# السؤال الآن
"${query}"

اكتب ردك بلهجتك الطبيعية. بذرة التنويع: ${seed}.
إذا احتجت فكرتين منفصلتين، ضع [SPLIT].`;
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
                const text = d.candidates[0].content.parts[0].text;
                return { text, model, truncated: d.candidates[0].finishReason === 'MAX_TOKENS' };
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

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        behavior: 'Pro-Consultant-v3-Dialect-Aware',
        dialectsCount: Object.keys(DIALECTS).length,
        modelsCount: availableModels.length
    });
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history, dialect } = req.body;
    if (!section || !query) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi');
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        res.json({ replies, model: result.model, dialect });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على البورت ${PORT}`);
    console.log(`🗺️ اللهجات المدعومة: ${Object.keys(DIALECTS).length}`);
});
