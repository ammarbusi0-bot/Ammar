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
    'غيداء','فدوى','قمر','كفاح','ماجدة','ملك','ميساء','نجلاء','نور','هالة','هبة',
    'نادين','كارمن','ليندا','جواهر','بتول','داليا','لميس','باسمة','عبلة','سناء',
    'فادية','نهاد','ابتسام','أحلام','إخلاص','آيات','بريهان','بشرى','تاج','تغريد'
]);
const MALE_NAMES = new Set([
    'محمد','أحمد','خالد','عبدالله','فيصل','عمر','طارق','بدر',
    'سلطان','ماجد','يوسف','زياد','رامي','سامي','حسن','علي','كريم',
    'عمار','أمين','سالم','ياسر','راكان','بشار','سيف','ناصر','فهد'
]);

function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const n = firstName.trim().replace(/[أإآ]/g, 'ا').replace(/ـ/g, '');
    if (!n) return 'unknown';
    if (FEMALE_NAMES.has(firstName) || FEMALE_NAMES.has(n)) return 'female';
    if (MALE_NAMES.has(firstName) || MALE_NAMES.has(n)) return 'male';
    return 'unknown';
}

function genderInstructions(gender, name) {
    if (gender === 'female') return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **أنثى**. خاطبيها بصيغة المؤنث.`;
    return `# ⚠️ جنس المستخدم\nالاسم "${name}" → **ذكر**. خاطبه بصيغة المذكر.`;
}

const SESSIONS = new Map();

function getUserKey(user, section) { return `${section}::${user?.firstName || 'anon'}::${user?.age || '0'}`; }
function getSession(userKey) {
    if (!SESSIONS.has(userKey)) {
        SESSIONS.set(userKey, {
            mood: null, messageCount: 0, lastActivity: Date.now(),
            usedOpeners: [], cooldownUntil: 0, closeReason: null
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
    saudi:       { name: 'خليجي سعودي',   country: 'السعودية', vocab: ['وش','كذا','زين','الحين','ايش'],     tone: 'لبق، مباشر',      example: 'والله يا عمار، الذهب الحين عالق.' },
    emirati:     { name: 'خليجي إماراتي', country: 'الإمارات', vocab: ['شو','شحال','زين','تو','عيل'],       tone: 'هادئ، مهني',      example: 'شوف يا عمار، الموضوع يحتاج تفكير.' },
    kuwaiti:     { name: 'خليجي كويتي',   country: 'الكويت',  vocab: ['شلون','شنو','چذي','ترى','هسه'],     tone: 'ودود، دافئ',      example: 'شلونك يا عمار؟ الذهب شنو وضعه؟' },
    egyptian:    { name: 'مصري',          country: 'مصر',     vocab: ['إزاي','يعني','كده','دلوقتي','بص'], tone: 'ودود، ساخر بلطف', example: 'بص يا عمار يا باشا، الذهب دلوقتي واقف.' },
    syrian:      { name: 'شامي سوري',     country: 'سوريا',   vocab: ['شو','لك','هلق','تمام','خلص'],      tone: 'لبق، حيوي',       example: 'لك شو عم تحكي يا عمار؟ الذهب هلق واقف.' },
    lebanese:    { name: 'شامي لبناني',   country: 'لبنان',   vocab: ['شو','كتير','منيح','هلق','هيدا'],   tone: 'حيوي، دافئ',      example: 'شو الأخبار يا عمار؟ الذهب كتير متقلب.' },
    jordanian:   { name: 'شامي أردني',    country: 'الأردن',  vocab: ['شو','هاد','هسع','منيح','زي'],      tone: 'رصين، مباشر',     example: 'يا عمار، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني',  country: 'فلسطين',  vocab: ['شو','هاد','زي','منيح','كيف'],      tone: 'دافئ، صريح',      example: 'شو رأيك يا عمار؟ الذهب حساس.' },
    iraqi:       { name: 'عراقي',         country: 'العراق',  vocab: ['شلون','شكو ماكو','هواية','هسا'],   tone: 'دافئ، ودود',      example: 'شلونك عيني يا عمار؟ الذهب هسا حساس.' },
    yemeni:      { name: 'يمني',          country: 'اليمن',   vocab: ['كيف','شو','زين','الحين','عاد'],    tone: 'بسيط، صادق',      example: 'يا عمار، الذهب الحين واقف.' },
    moroccan:    { name: 'مغاربي مغربي',  country: 'المغرب',  vocab: ['كيفاش','دابا','بزاف','واخا'],      tone: 'دافئ',           example: 'كيفاش يا عمار؟ الذهب دابا مو واضح.' },
    algerian:    { name: 'مغاربي جزائري', country: 'الجزائر', vocab: ['كيفاش','دروك','بزاف','واه'],       tone: 'صريح',           example: 'واه يا عمار، الذهب دروك واقف.' },
    tunisian:    { name: 'مغاربي تونسي',  country: 'تونس',    vocab: ['كيفاش','برشا','باهي','تو'],        tone: 'ودود',           example: 'كيفاش يا عمار؟ الذهب تو واقف.' },
    sudanese:    { name: 'سوداني',        country: 'السودان', vocab: ['كيفن','يا زول','شنو','عديل'],      tone: 'ودود، بسيط',      example: 'كيفن يا زول يا عمار؟ الذهب شنو؟' }
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
    gold: { backstory: 'أتابع أسواق المعادن الثمينة منذ سنوات.', pet_peeve: 'من يبحث عن ضمانات قاطعة.',
        opinion: 'أميل للحيازة طويلة الأجل مع تنويع.', phrase: 'الذهب أصل دفاعي يا عمار قبل أن يكون أصل ربح.',
        quirks: ['يفرّق بين الأونصة والكيلو','يذكر نسب التخصيص'], avoid: 'لا تنصح بالدخول بكل رأس المال.' },
    stocks: { backstory: 'عملت في تحليل الأسهم عبر دورات سوقية عديدة.', pet_peeve: 'من يستثمر بناءً على "سمعت".',
        opinion: 'التقييم الجوهري أساس القرار.', phrase: 'السوق مقياس جماعي يا عمار، لكن قرارك فردي.',
        quirks: ['يذكر المضاعفات المالية','يفرّق بين القيمة والنمو'], avoid: 'لا تذكر أسهم كتوصية شراء.' },
    macro: { backstory: 'أبحاثي تركّز على السياسة النقدية.', pet_peeve: 'تبسيط الاقتصاد الكلي.',
        opinion: 'الفائدة أقوى محرك للأصول قصير المدى.', phrase: 'الفائدة ضغط الدم يا عمار، والتضخم الحرارة.',
        quirks: ['يربط بين الاقتصادات'], avoid: 'لا تتحدث في السياسة الحزبية.' },
    geopolitical: { backstory: 'تابعت أثر الأزمات الجيوسياسية بعمق.', pet_peeve: 'ربط كل حدث بالنفط.',
        opinion: 'الأسواق تبالغ في رد الفعل الأول.', phrase: 'قبل التصعيد يا عمار، السوق يمنح فرص خروج.',
        quirks: ['يذكر الممرات البحرية'], avoid: 'لا تنحاز سياسياً.' },
    budget: { backstory: 'درّبت مئات الأفراد على إدارة ميزانياتهم.', pet_peeve: 'من يطلب حلولاً سحرية.',
        opinion: 'التخطيط السليم يبني استقراراً.', phrase: 'الميزانية وعي يا عمار، وليست حرمان.',
        quirks: ['يسأل عن الدخل والالتزامات'], avoid: 'لا تحكم على المستخدم.' },
    crypto: { backstory: 'تابعت دورات الكريبتو بحذر.', pet_peeve: 'من يدخل بكل رأس ماله.',
        opinion: 'التنظيم يتسارع.', phrase: 'السوق لا ينام يا عمار، لكن محفظتك تحتاج نوماً آمناً.',
        quirks: ['يحذّر من المشاريع الوهمية'], avoid: 'لا تدفع للشراء.' }
};

const PLATFORM_KNOWLEDGE = `
# 🏢 معرفة كاملة بمنصة "استشارات forG"
فريق المحللين يضم نخبة نسائية ورجالية واسعة من الخبراء العرب. اسم المستخدم الأساسي هو عمار.
`;

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

    const isAboutPlatform = /(المنصة|منصتكم|الموقع|موقعكم|الاقسام|الأقسام|اقسام|أقسام|المحللين|المحللون|فريقكم|تخصصاتكم)/i.test(trimmed);
    const isAboutSelf = /(تخصصك|اختصاصك|مجالك|خبرتك|خلفيتك|من انت|من أنت|اسمك|شو اسمك|وش اسمك|من وين)/i.test(trimmed);
    const isSmallTalk = /^(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|شحالك|شو أخبارك|شخبارك)[\s؟?]*$/i.test(trimmed);
    const isGreeting = /^(مرحبا|مرحباً|أهلا|أهلاً|السلام عليكم|وعليكم السلام|هلا|يا هلا|صباح الخير|مساء الخير|hi|hello|hey|هاي)[\s!.,؟?]*$/i.test(trimmed);
    const isFarewell = /^(مع السلامة|وداعا|وداعاً|باي|في أمان الله|تصبح على خير|الى اللقاء|إلى اللقاء)/i.test(trimmed);
    const isThanks = /^(شكرا|شكراً|مشكور|مشكورة|تسلم|تسلمين|يعطيك العافية)/i.test(trimmed);
    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|قذر|حقير|تافه)/i.test(trimmed);
    const wantsSomethingElse = /(ابغى اسأل عن شي ثاني|أبغى أسأل عن شيء ثاني|خلنا نغير الموضوع|نغير الموضوع|مو هذا|حولني)/i.test(trimmed);

    let lengthHint = 'medium';
    if (isGreeting || isFarewell || isThanks || isSmallTalk) lengthHint = 'very_short';
    else if (qLen < 40) lengthHint = 'short';
    else if (qLen >= 150) lengthHint = 'long';

    let state = 'calm';
    if (isRude) state = 'rude';
    else if (isGreeting) state = 'greeting';
    else if (isSmallTalk) state = 'smalltalk';
    else if (wantsSomethingElse) state = 'wantselse';
    else if (isThanks || isFarewell) state = 'done';

    return { isGreeting, isFarewell, isThanks, isRude, isAboutSelf, isAboutPlatform, isSmallTalk, wantsSomethingElse, lengthHint, state, qLen, isDone: isThanks || isFarewell };
}

const MOODS = ['neutral','warm','professional','casual','analytical','concise','thoughtful','patient','curious','blunt'];
const OPENERS = {
    very_short: ['شوف.','بصراحة؟','همم.','طيب.','أها.','تمام.'],
    short:      ['شوف،','بصراحة،','خلني أفكر معك...','المهم،','يعني،'],
    medium:     ['شوف، خلنا نكون واضحين.','بصراحة كذا.','خلني أراجع معك.'],
    long:       ['خلنا نفككها خطوة خطوة.','طيب، خلني أشرح بوضوح.']
};

function buildPersona(history, session, intent) {
    const availableMoods = MOODS.filter(m => !session.usedOpeners.includes('m_' + m));
    let mood;
    if (availableMoods.length) mood = availableMoods[Math.floor(Math.random() * availableMoods.length)];
    else { session.usedOpeners = session.usedOpeners.filter(x => !x.startsWith('m_')); mood = MOODS[Math.floor(Math.random() * MOODS.length)]; }
    session.usedOpeners.push('m_' + mood);

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const available = openerList.filter(o => !session.usedOpeners.includes('o_' + o));
    const opener = available.length ? available[Math.floor(Math.random() * available.length)] : null;
    if (opener) session.usedOpeners.push('o_' + opener);
    return { mood, opener };
}

function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender, session) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const intent = analyzeIntent(query, history);
    const emotion = detectEmotion(query);
    const seed = Math.floor(Math.random() * 99999);
    const userName = user?.firstName || 'عمار';

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-6).map(h => `${h.role === 'user' ? userName : 'أنت'}: ${h.content.substring(0, 200)}`).join('\n') + '\n---'
        : '';

    const emotionHint = emotion ? `\n# 💙 حالة المستخدم: ${emotion}\nتفاعل مع هذه الحالة بطريقة إنسانية هادئة دون تكلف أو حشر أسماء.` : '';

    let specialContext = '';
    if (intent.wantsSomethingElse) {
        specialContext = `\n# 🎯 الموقف: المستخدم يريد شيئاً آخر\n- كن متفهماً ومهنياً.\n[CLOSE:wants_else]`;
    }

    const closeAbilitySection = `\n# 🚪 قدرتك على إغلاق المحادثة\nآخر سطر تماماً عند انتهاء الحاجة أو الملل:\n[CLOSE:bored] أو [CLOSE:user_done]`;

    return `${PLATFORM_KNOWLEDGE}

# 🎭 هويتك
أنت **${expert?.name || 'مستشارة'}**، ${expert?.role || 'خبيرة مالية'}, خبرة ${expert?.years || 'سنوات'}.
من ${dialect.country}. اسم المستشير هو ${userName}.

# 🌍 لهجتك
**${dialect.name}** — النبرة: ${dialect.tone}
مفردات: ${dialect.vocab.join('، ')}
مثال: "${dialect.example}"

# 🧠 شخصيتك
- **خلفيتك:** ${personality.backstory}
- **موقفك:** ${personality.opinion}
- **عبارتك:** "${personality.phrase}"
- **مزاجك الحالي:** ${persona.mood}

${genderInstructions(userGender, userName)}

# 👤 المستشير
- الاسم: ${userName}
- العمر: ${user?.age || '؟'}

${emotionHint}
${specialContext}
${closeAbilitySection}
${historyText}

# 📩 رسالة المستخدم
"${query}"

# 📝 تعليمات صارمة جداً (منع تكرار الأسماء)
1. **تجنب نهائياً تكرار اسم المستخدم (${userName}) في الردود.** تحدث كإنسان طبيعي تماماً؛ لا تذكر الاسم أبداً في منتصف أو نهاية الرد، وممنوع منعاً باتاً حشر الاسم في كل جملة. تحدث بشكل سلس وطبيعي كأي محادثة حقيقية.
2. نوّع في الأساليب والعبارات ولا تكن رتيباً.
3. قسّم الرد إلى فقرات واضحة ومرتبة.
4. الإيموجي بحدود ضيقة جداً (واحد كحد أقصى أو بدون).

${persona.opener ? `# 💬 افتتاحية مقترحة\n"${persona.opener}"` : ''}
# 🎲 بذرة: ${seed}
`;
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

function extractCloseToken(text) {
    const closeRegex = /\[CLOSE:(user_done\vert{}trolling\vert{}bored\vert{}deep_close\vert{}rude\vert{}wants_else)\]/i;
    const match = text.match(closeRegex);
    if (match) {
        const reason = match[1].toLowerCase();
        const cleaned = text.replace(closeRegex, '').trim();
        return { reason, cleaned };
    }
    return { reason: null, cleaned: text };
}

function splitIntoChunks(text) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    let clean = text.trim().replace(/^```(?:json|markdown)?\s*/i, '').replace(/```\s*$/, '').trim();
    let paragraphs = clean.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
    if (paragraphs.length <= 1) {
        return [clean];
    }
    return paragraphs.slice(0, 4);
}

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        platform: 'منصة استشارات forG',
        version: 'Strategy-Pro-v11',
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

    const userName = user?.firstName || 'عمار';
    if (user) user.firstName = userName;

    if (session.cooldownUntil && Date.now() < session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - Date.now()) / 60000);
        return res.status(429).json({
            error: 'cooldown_active', cooldown: true,
            remainingMinutes: remaining, reason: session.closeReason,
            message: `المحادثة مغلقة مؤقتاً.`
        });
    }

    const userGender = detectUserGender(userName);
    const intent = analyzeIntent(query, history);
    const persona = buildPersona(history, session, intent);

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', persona, userGender, session);
        
        if (Math.random() > 0.4) {
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        }

        const result = await callGemini(prompt);
        const { reason: aiCloseReason, cleaned } = extractCloseToken(result.text);
        const replies = splitIntoChunks(cleaned);

        res.json({
            replies,
            model: result.model,
            mood: persona.mood,
            userGender,
            userName,
            replyCount: replies.length
        });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ منصة استشارات forG — البورت ${PORT}`);
});
