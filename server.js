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

// 🌸 قائمة ضخمة جداً للأسماء النسائية والجديدة
const FEMALE_NAMES = new Set([
    'فاطمة','زينب','مريم','خديجة','عائشة','حفصة','رقية','سكينة','نفيسة',
    'سارة','نورة','نورا','ليلى','هند','منى','ريم','دانة','دانه','هيا','أمل','رنا','لينا','دينا',
    'إيمان','سامية','سلمى','سلمي','نادية','ماريا','ليال','روان','جواهر','شهد','لطيفة','نوف',
    'عبير','أسماء','أميرة','عهود','رغد','ريما','سمر','سهى','شذى','صفاء','ضحى','علا','غادة',
    'فرح','لمى','لمار','مروة','ملاك','منال','مي','ميّ','هدى','وفاء','يارا',
    'تالا','تولين','جوري','رتاج','ريفال','ليان','جنى','ديما','جمانة','كادي','ميلاف',
    'أروى','إسراء','آلاء','بشاير','بدور','تهاني','جميلة','حصة','حنان','خلود','دلال',
    'رزان','رولا','رهام','سجى','سديم','سهام','شروق','صيتة','غالية',
    'لجين','لولوة','مشاعل','منيرة','مها','مودة','ميسم','نجود','ندى','نوال','نهى',
    'هاجر','وجدان','وضحى','ياسمين','يمنى','أنوار','أفنان','بشرى','حور','حوراء',
    'رؤى','رفيف','رنيم','سلوى','سمية','سناء','شيماء','صابرين','عالية','عزيزة','عليا',
    'غيداء','فدوى','قمر','كفاح','ماجدة','ملك','ميساء','نجلاء','نور','هالة','هبة',
    'سلسبيل','دواني','تيما','ليان','آسيا','مياس','رفيف','سوار','غيد','باسلة','بنان',
    'توليب','جوان','دارين','دجى','ريماس','زهور','سديم','سيرين','شادن','شمس','شموخ',
    'غيداء','فجر','كارمن','لورين','ميرال','نورسين','هتان','ياسمينة','يولا','يارا'
]);

const MALE_NAMES = new Set([
    'محمد','أحمد','خالد','عبدالله','عبدالرحمن','عبدالعزيز','عبدالملك','فيصل','عمر','طارق','بدر',
    'سلطان','ماجد','مشعل','مازن','يوسف','زياد','رامي','سامي','حسن','حسين','علي','مصطفى','كريم',
    'عمار','أمين','سالم','ياسر','راكان','عدنان','بشار','سيف','ناصر','فهد','نايف','طلال','مروان'
]);

function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const n = firstName.trim().replace(/[أإآ]/g, 'ا').replace(/ـ/g, '');
    if (!n) return 'unknown';
    if (FEMALE_NAMES.has(firstName) || FEMALE_NAMES.has(n)) return 'female';
    if (MALE_NAMES.has(firstName) || MALE_NAMES.has(n)) return 'male';
    if (/[ة]$/.test(n) && n.length > 2) return 'female';
    if (/[ى]$/.test(n) && n.length > 2) return 'female';
    return 'unknown';
}
function genderInstructions(gender, name) {
    if (gender === 'female') return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **أنثى**. خاطبيها بصيغة المؤنث واذكري اسمها بطلاقة ودفء.`;
    if (gender === 'male') return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر واذكر اسمه بطلاقة ودفء.`;
    return `# جنس المستخدم\nالاسم "${name}". اذكر الاسم بلطف وتفاعل حيوي.`;
}

const SESSIONS = new Map();
const COOLDOWNS = {
    user_done:  15 * 60 * 1000,
    trolling:   20 * 60 * 1000,
    bored:      10 * 60 * 1000,
    deep_close: 5 * 60 * 1000,
    rude:       20 * 60 * 1000,
    wants_else: 10 * 60 * 1000
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
    saudi:       { name: 'خليجي سعودي',   country: 'السعودية', vocab: ['وش','كذا','زين','الحين','ايش'],     tone: 'لبق، مباشر',      example: 'والله يا عمار، شوف الذهب الحين وين.' },
    emirati:     { name: 'خليجي إماراتي', country: 'الإمارات', vocab: ['شو','شحال','زين','تو','عيل'],       tone: 'هادئ، مهني',      example: 'شوف يا غالي، الموضوع يحتاج تفكير.' },
    kuwaiti:     { name: 'خليجي كويتي',   country: 'الكويت',  vocab: ['شلون','شنو','چذي','ترى','هسه'],     tone: 'ودود، دافئ',      example: 'شلونك؟ الذهب شنو وضعه يا عمار؟' },
    egyptian:    { name: 'مصري',          country: 'مصر',     vocab: ['إزاي','يعني','كده','دلوقتي','بص'], tone: 'ودود، ساخر بلطف', example: 'بص يا باشا، الذهب دلوقتي واقف.' },
    syrian:      { name: 'شامي سوري',     country: 'سوريا',   vocab: ['شو','لك','هلق','تمام','خلص'],      tone: 'لبق، حيوي',       example: 'لك شو عم تحكي يا عمار؟ الذهب هلق واقف.' },
    lebanese:    { name: 'شامي لبناني',   country: 'لبنان',   vocab: ['شو','كتير','منيح','هلق','هيدا'],   tone: 'حيوي، دافئ',      example: 'شو الأخبار؟ الذهب كتير متقلب.' },
    jordanian:   { name: 'شامي أردني',    country: 'الأردن',  vocab: ['شو','هاد','هسع','منيح','زي'],      tone: 'رصين، مباشر',     example: 'يا عمار، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني',  country: 'فلسطين',  vocab: ['شو','هاد','زي','منيح','كيف'],      tone: 'دافئ، صريح',      example: 'شو رأيك يا عمار؟ الذهب حساس.' },
    iraqi:       { name: 'عراقي',         country: 'العراق',  vocab: ['شلون','شكو ماكو','هواية','هسا'],   tone: 'دافئ، ودود',      example: 'شلونك عيني؟ الذهب هسا حساس.' },
    yemeni:      { name: 'يمني',          country: 'اليمن',   vocab: ['كيف','شو','زين','الحين','عاد'],    tone: 'بسيط، صادق',      example: 'يا عمار، الذهب الحين واقف.' },
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
# 🏢 معرفة كاملة بمنصة "استشارات forG"
منصة استشارات مالية عربية متقدمة، تجمع نخبة من المحللين العرب من 17 دولة بلهجاتهم وتخصصاتهم (الذهب، الأسهم، الاقتصاد الكلي، الجيوسياسة، الميزانية، الكريبتو).
`;

const EMOTIONAL_REACTIONS = {
    worried: 'قلقك مفهوم يا عمار، لا تتخذ قراراً تحت ضغط.',
    excited: 'حماسك ممتاز، لكن دعنا نهدأ قليلاً.',
    confused: 'الموضوع بسيط، خلنا نفككه سوا يا عمار.',
    frustrated: 'إحباطك مفهوم، السوق مرهق أحياناً.',
    sad: 'أفهم شعورك تماماً.',
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
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية)/i.test(trimmed) && qLen < 40;
    const isFarewell = /^(مع السلامة|وداعا|باي|في أمان الله|تصبح على خير|إلى اللقاء)/i.test(trimmed) && qLen < 25;
    const wantsSomethingElse = /(ابغى اسأل عن شي ثاني|نغير الموضوع|حولني|ابغى قسم)/i.test(trimmed);

    let lengthHint = 'medium';
    if (qLen < 20) lengthHint = 'short';
    else if (qLen > 150) lengthHint = 'long';

    let state = 'calm';
    if (isThanks || isFarewell) state = 'done';

    return { isThanks, isFarewell, wantsSomethingElse, lengthHint, state, qLen };
}

const MOODS = ['neutral','warm','professional','casual','analytical','concise','thoughtful','patient','curious','blunt'];
const OPENERS = {
    short:      ['شوف يا عمار،','بصراحة يا عمار،','همم يا عمار،','طيب،'],
    medium:     ['شوف يا عمار، خلنا نكون واضحين.','بصراحة كذا.','خلني أراجع معك يا عمار.'],
    long:       ['خلنا نفككها خطوة خطوة يا عمار.','طيب، خلني أشرح بوضوح.']
};

function buildPersona(history, session, intent) {
    const availableMoods = MOODS.filter(m => !session.usedOpeners.includes('m_' + m));
    let mood = availableMoods.length ? availableMoods[Math.floor(Math.random() * availableMoods.length)] : MOODS[Math.floor(Math.random() * MOODS.length)];
    session.usedOpeners.push('m_' + mood);
    if (session.usedOpeners.length > 20) session.usedOpeners.shift();

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const opener = openerList[Math.floor(Math.random() * openerList.length)];
    return { mood, opener };
}

function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender, session) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const sectionVocab = SECTION_VOCAB[section] || [];
    const intent = analyzeIntent(query, history);
    const emotion = detectEmotion(query);
    const userName = user?.firstName || 'عمار';

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-6).map(h => `${h.role === 'user' ? userName : 'أنت'}: ${h.content}`).join('\n') + '\n---'
        : '';

    return `${PLATFORM_KNOWLEDGE}

# 🎭 هويتك
أنت **${expert?.name || 'مستشار'}**، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}. من ${dialect.country}.

# 🚨 تعليمات إلزامية صارمة جداً:
1. **اذكر اسم المستخدم ("${userName}") بشكل طبيعي ومستمر في ردك** (أكثر من مرة وبطريقة ودودة تماماً مثل: "بتلاقينا موجودين هون يا ${userName} أي وقت بدك تكفي حديثنا عن الذهب...").
2. **غيّر المزاج والأسلوب تماماً** في كل رد (مزاجك الحالي: ${persona.mood}).
3. استخدم لهجتك ببراعة (${dialect.name}).
4. قسّم الرد إلى فقرات واضحة.

${genderInstructions(userGender, userName)}
${emotion ? `\n# 💙 حالة المستخدم: ${emotion}\nابدأ بالتعاطف: "${EMOTIONAL_REACTIONS[emotion]}"` : ''}

${historyText}

# 📩 رسالة ${userName}:
"${query}"

# 📝 الرد المباشر:`;
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
                    generationConfig: { temperature: 1.2, maxOutputTokens: 2000 }
                })
            });
            const d = await r.json();
            if (d.candidates?.[0]?.content?.parts?.[0]?.text) {
                return { text: d.candidates[0].content.parts[0].text, model };
            }
        } catch (e) { lastError = e.message; }
    }
    throw new Error(lastError || 'كل النماذج فشلت');
}

function splitIntoChunks(text) {
    if (!text) return ['عذراً، ما قدرت أولد رد.'];
    const clean = text.trim().replace(/^```.*?\n/i, '').replace(/```$/, '').trim();
    const paragraphs = clean.split(/\n\s*\n+/).filter(Boolean);
    return paragraphs.length ? paragraphs : [clean];
}

app.get('/', (req, res) => {
    res.json({ status: 'OK', platform: 'منصة استشارات forG', version: 'Strategy-Pro-Final' });
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history, dialect } = req.body;
    if (!section || !query) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });

    const userKey = getUserKey(user, section);
    const session = getSession(userKey);
    session.lastActivity = Date.now();
    session.messageCount++;

    const userGender = detectUserGender(user?.firstName);
    const intent = analyzeIntent(query, history);
    const persona = buildPersona(history, session, intent);

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', persona, userGender, session);
        const result = await callGemini(prompt);
        const replies = splitIntoChunks(result.text);

        res.json({
            replies,
            model: result.model,
            mood: persona.mood,
            userGender,
            emotion: detectEmotion(query),
            replyCount: replies.length
        });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ منصة استشارات forG تعمل على البورت ${PORT}`);
});
