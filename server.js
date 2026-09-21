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
// 🚻 كشف الجنس من الاسم العربي
// ============================================================
const FEMALE_NAMES = ['فاطمة','زينب','مريم','خديجة','عائشة','سارة','نورة','ليلى','هند','منى','ريم','دانة','هيا','أمل','رنا','لينا','دينا','إيمان','سامية','سلمى','نادية','ماريا','ليال','روان','جواهر','شهد','لطيفة','نوف','نجود','عبير','أسماء','أميرة','بشاير','عهود','روان','رغد','ريما','سمر','سهى','سهام','شذى','صفاء','ضحى','علا','غادة','فاطمة','فرح','لمى','لولوة','مروة','ملاك','منال','مي','نوف','هدى','وفاء','يارا'];

const MALE_NAMES = ['محمد','أحمد','خالد','عبدالله','عبدالرحمن','فيصل','عمر','طارق','بدر','سلطان','ماجد','مشعل','مازن','يوسف','زياد','رامي','سامي','حسن','حسين','علي','مصطفى','كريم','عمار','أمين','سالم','ياسر','راكان','عدنان','بشار','سيف','ناصر','فهد','نايف','طلال','مروان','أيمن','إياد','رياض','محمود','ياسين','إبراهيم','إسماعيل','أنس','أوس','أسامة','بسام','جمال','حسام','حمزة','سعيد','سليمان','شادي','صالح','عاصم','عادل','عامر','عصام','عماد','غسان','فادي','قصي','مالك','متعب','مروان','معاذ','نبيل','نزار','هاني','هيثم','وسيم','وليد','يزيد','يعقوب'];

function detectUserGender(firstName) {
    if (!firstName || typeof firstName !== 'string') return 'unknown';
    const n = firstName.trim();
    if (!n) return 'unknown';
    // تطابق كامل
    if (FEMALE_NAMES.includes(n)) return 'female';
    if (MALE_NAMES.includes(n)) return 'male';
    // التاء المربوطة في النهاية (علامة أنثوية شبه مؤكدة)
    if (/[ة]$/.test(n)) return 'female';
    // لو الاسم ينتهي بـ "ا" (مثل "سلمى"، "هدى") → أنثوي غالباً
    if (/[ى]$/.test(n) && n.length > 2) return 'female';
    // انتهاء بـ "ن" أو "د" أو "ر" → محايد، نترك unknown
    return 'unknown';
}

// ============================================================
// 🎲 أدوات عامة
// ============================================================
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ============================================================
// 🗄️ الجلسات — مع تصفير ذكي
// ============================================================
const SESSIONS = new Map();
const SESSION_IDLE_TIMEOUT = 20 * 60 * 1000; // 20 دقيقة خمول → تصفير

function getUserKey(user, section) {
    return `${section}::${user?.firstName || 'anon'}::${user?.age || '0'}`;
}

function createFreshSession() {
    return {
        mood: null,
        messageCount: 0,
        lastActivity: Date.now(),
        usedOpeners: [],
        rudeCount: 0,
        createdAt: Date.now(),
        cooldownUntil: 0,
        closeReason: null,
        askCount: 0  // عدد الأسئلة الاستباقية المطروحة
    };
}

function getSession(userKey) {
    let session = SESSIONS.get(userKey);
    if (!session) {
        session = createFreshSession();
        SESSIONS.set(userKey, session);
        return session;
    }
    // ✅ إذا مرّ 20 دقيقة من الخمول → تصفير كامل (كأنه إنسان جديد)
    const idleTime = Date.now() - session.lastActivity;
    if (idleTime > SESSION_IDLE_TIMEOUT) {
        console.log(`🔄 تصفير جلسة ${userKey} (خمول ${Math.floor(idleTime/60000)} دقيقة)`);
        session = createFreshSession();
        SESSIONS.set(userKey, session);
    }
    return session;
}

function resetSession(userKey) {
    SESSIONS.set(userKey, createFreshSession());
}

// تنظيف دوري للجلسات القديمة
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
    saudi: { name: 'خليجي سعودي', country: 'السعودية', vocabulary: ['وش','كذا','زين','أبشر','الحين','ايش','مب'], tone: 'لبق، محترم', example: 'والله شوف، الذهب الحين عالق.' },
    emirati: { name: 'خليجي إماراتي', country: 'الإمارات', vocabulary: ['شو','شحال','زين','عيل','تو'], tone: 'هادئ، مهني', example: 'شوف، الموضوع يحتاج تفكير.' },
    kuwaiti: { name: 'خليجي كويتي', country: 'الكويت', vocabulary: ['شلون','شنو','چذي','هسه','ترى'], tone: 'ودود', example: 'شلونك؟ الذهب شنو وضعه الحين؟' },
    egyptian: { name: 'مصري', country: 'مصر', vocabulary: ['إزاي','يعني','كده','دلوقتي','بص','معلش'], tone: 'ودود، ساخر', example: 'بص يا باشا، الذهب دلوقتي واقف.' },
    syrian: { name: 'شامي سوري', country: 'سوريا', vocabulary: ['شو','لك','هلق','تمام','خلص'], tone: 'لبق', example: 'لك شو عم تحكي؟ الذهب هلق واقف.' },
    lebanese: { name: 'شامي لبناني', country: 'لبنان', vocabulary: ['شو','كتير','منيح','هلق'], tone: 'حيوي', example: 'شو الأخبار؟ الذهب اليوم كتير متقلب.' },
    jordanian: { name: 'شامي أردني', country: 'الأردن', vocabulary: ['شو','هاد','هسع','منيح'], tone: 'رصين', example: 'هاي شو، الذهب هسع واقف.' },
    palestinian: { name: 'شامي فلسطيني', country: 'فلسطين', vocabulary: ['شو','هاد','زي','منيح'], tone: 'دافئ', example: 'شو رأيك؟ الذهب هالفترة حساس.' },
    iraqi: { name: 'عراقي', country: 'العراق', vocabulary: ['شلون','شكو ماكو','هواية','هسا','عيني'], tone: 'دافئ', example: 'شلونك عيني؟ الذهب هسا وضعه هواية حساس.' },
    yemeni: { name: 'يمني', country: 'اليمن', vocabulary: ['كيف','شو','زين','الحين'], tone: 'بسيط', example: 'يا رجل، الذهب الحين واقف.' },
    moroccan: { name: 'مغاربي مغربي', country: 'المغرب', vocabulary: ['كيفاش','دابا','بزاف','واخا','مزيان'], tone: 'دافئ', example: 'كيفاش صاحبي؟ الذهب دابا مو واضح.' },
    algerian: { name: 'مغاربي جزائري', country: 'الجزائر', vocabulary: ['كيفاش','دروك','بزاف','واه'], tone: 'صريح', example: 'واه خويا، الذهب دروك واقف.' },
    tunisian: { name: 'مغاربي تونسي', country: 'تونس', vocabulary: ['كيفاش','برشا','باهي','تو'], tone: 'ودود', example: 'كيفاش؟ الذهب تو واقف.' },
    sudanese: { name: 'سوداني', country: 'السودان', vocabulary: ['كيفن','يا زول','شنو','عديل'], tone: 'ودود', example: 'كيفن يا زول؟ الذهب شنو؟' }
};

// ============================================================
// 🤝 الذكاء الاجتماعي
// ============================================================
const SOCIAL = {
    salaam: { r: /(السلام\s*عليكم|سلام\s*عليكم)/i, replies: ['وعليكم السلام ورحمة الله وبركاته', 'وعليكم السلام ورحمة الله، حياك الله'] },
    howAreYou: { r: /(كيف\s*(حالك|الحال|حالكم|أمورك)|شلونك|شلونج|إزيك|إزاي\s*حالك|كيفاش|شحالك|كيفك|أخبارك|شو\s*أخبارك|عامل\s*إيه)/i, replies: ['بخير الحمد لله، شكراً لسؤالك. وأنت؟', 'الحمد لله بخير وعافية. أنت أخبارك؟', 'تمام الحمد لله، الله يعافيك.'] },
    morning: { r: /(صباح\s*(الخير|النور|الفل|الورد))/i, replies: ['صباح النور والسرور', 'صباح الفل والياسمين'] },
    evening: { r: /(مساء\s*(الخير|النور|الأنوار))/i, replies: ['مساء النور والسعادة', 'مساء الأنوار، كيف أقدر أساعدك؟'] },
    hello: { r: /^(مرحبا|مرحباً|أهلا|أهلاً|اهلا|هلا|يا هلا|حياك|هاي|هالو)/i, replies: ['أهلاً وسهلاً', 'يا هلا ومرحبا', 'حياك الله'] },
    thanks: { r: /^(شكرا|شكراً|مشكور|مشكورة|يعطيك\s*العافية|تسلم|جزاك\s*الله|مرسي)/i, replies: ['العفو، في خدمتك', 'لا شكر على واجب', 'على الرحب والسعة'] },
    bye: { r: /^(باي|وداعا|وداعاً|مع\s*السلامة|في\s*أمان\s*الله|سلام|إلى\s*اللقاء|بسلامة)/i, replies: ['في أمان الله، بالتوفيق', 'مع السلامة، لا تتردد بالعودة'] },
    sorry: { r: /^(آسف|أسف|اعتذر|أعتذر|معلش|بعتذر|سامحني)/i, replies: ['لا مشكلة إطلاقاً', 'عادي، ما صار شي'] },
    bless: { r: /(الله\s*يبارك|بارك\s*الله|الله\s*يحفظك|الله\s*يكرمك)/i, replies: ['وفيك بارك الله', 'أجمعين يا رب'] },
    ok: { r: /^(اوكي|أوكي|اوك|طيب|تمام|ماشي|حسنا|زين|واخا|باهي|صح|ok|okay)$/i, replies: ['تمام', 'ممتاز', 'زين', 'طيب'] }
};

function detectSocial(q) {
    q = q.trim();
    if (q.length > 60) return null;
    const matches = [];
    for (const [key, v] of Object.entries(SOCIAL)) {
        if (v.r.test(q)) matches.push(key);
    }
    if (!matches.length) return null;
    const hasRealQ = /[?؟]/.test(q) || /\b(هل|متى|لماذا|ليش|تنصحني|تتوقع|حلل|قارن|اشرح|سعر|نسبة)\b/i.test(q);
    const isOnlyHow = matches.includes('howAreYou') && matches.length === 1 && q.length < 40;
    if (hasRealQ && !isOnlyHow) return null;
    return { types: matches, isPure: !hasRealQ || isOnlyHow };
}

function buildSocialReply(types) {
    if (types.includes('salaam') && types.includes('howAreYou')) {
        return `${pickRandom(SOCIAL.salaam.replies)}.\n${pickRandom(SOCIAL.howAreYou.replies)}`;
    }
    const replies = [];
    const seen = new Set();
    for (const t of types) {
        if (seen.has(t)) continue;
        seen.add(t);
        if (SOCIAL[t]?.replies) replies.push(pickRandom(SOCIAL[t].replies));
    }
    return replies.join('\n');
}

// ============================================================
// 🎯 تحليل النية
// ============================================================
function analyzeIntent(q, history) {
    const qLen = q.length;
    const qLower = q.toLowerCase();
    const recentMsgs = (history || []).filter(h => h.role === 'user').map(h => h.content).slice(-6);

    const isRude = /(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|خنزير|حقير|تافه|سافل|وقح)/i.test(q);
    const isGibberish = /^[\s\W_]+$/.test(q) || /(.)\1{4,}/.test(q);
    const isIrrelevant = /^(هههه|ههه|lol|😅|😂|🤣|سوالف|نكتة|نكت)/i.test(q);
    const shortMsgCount = recentMsgs.filter(m => m.trim().length < 8).length;
    const isVeryShort = qLen > 0 && qLen < 8;

    let trollScore = 0;
    if (isVeryShort && shortMsgCount >= 3) trollScore += 2;
    if (isGibberish) trollScore += 3;
    if (isIrrelevant) trollScore += 2;

    const isDone = /^(شكرا|شكراً|مشكور|تسلم|يعطيك|جزاك|باي|وداعا|مع السلامة|كفى|خلص|انتهيت|سلام)/i.test(q) && qLen < 40;
    const isShort = qLen < 20;
    const isMedium = qLen >= 20 && qLen < 80;
    const isLong = qLen >= 80 && qLen < 250;

    const wantsBrief = /(باختصار|اختصار|بسرعة|مختصر|لا تطول)/i.test(q);
    const wantsDetail = /(فصّل|فصل|أشرح|اشرح|بالتفصيل|تفاصيل|موسع)/i.test(q);
    const wantsAdvice = /(تنصحني|توصيتك|رايك|رأيك|شو رأيك|ماذا تنصح)/i.test(q);
    const wantsAnalysis = /(حلل|تحليل|قيّم|درس|تتوقع|توقعك)/i.test(q);

    // ✅ كشف النية المبهمة — تحتاج سؤال استباقي
    const isVagueAdvice = wantsAdvice && qLen < 50 && !hasContext(history);
    const isVagueShort = isVeryShort && !isDone && !/^(مرحبا|هلا|شكرا|طيب|تمام|زين|اوكي|سلام)$/i.test(q.trim());

    let lengthHint = 'medium';
    if (wantsBrief || isDone || isShort) lengthHint = 'very_short';
    else if (isMedium && wantsAdvice) lengthHint = 'short';
    else if (isLong || wantsDetail || wantsAnalysis) lengthHint = 'long';

    let styleHint = 'default';
    if (wantsAnalysis) styleHint = 'analysis';
    else if (wantsAdvice) styleHint = 'advice';
    else if (wantsDetail) styleHint = 'detail';

    let state = 'calm';
    if (isRude) state = 'rude';
    else if (trollScore >= 3) state = 'trolling';
    else if (isDone) state = 'done';
    else if (/(قلق|خايف|خوف|متوتر)/i.test(q)) state = 'worried';
    else if (/(زهقت|تعبت|يئست|خسرت|زعلان|حزين)/i.test(q)) state = 'sad';
    else if (/(غاضب|معصب|منرفز)/i.test(q)) state = 'angry';
    else if (/(محتار|ملخبط|مو فاهم|غامض)/i.test(q)) state = 'confused';
    else if (/(متحمس|حماس|فرحان)/i.test(q)) state = 'excited';
    else if (/(ملل|طفش|زهقان)/i.test(q)) state = 'bored';

    return {
        isRude, isDone, trollScore, lengthHint, styleHint, state,
        isVagueAdvice, isVagueShort, qLen
    };
}

function hasContext(history) {
    if (!history || history.length < 3) return false;
    const joined = history.filter(h => h.role === 'user').map(h => h.content).join(' ');
    return /(محفظتي|رأس مال|ميزانية|دخل|استثمار|الهدف|المدة|دخلت|أمتلك|عندي|سنوي|شهري|خبرتي|سني)/i.test(joined);
}

// ============================================================
// 🚻 تعليمات مخاطبة المستخدم حسب جنسه
// ============================================================
function buildGenderInstructions(gender, userName) {
    if (gender === 'female') {
        return `# ⚠️ تعليمات الجنس (مهم جداً)
المستخدم اسمه "${userName}" وهو **أنثى**. خاطبها بصيغة المؤنث دائماً:
- "أنتِ"، "قلتِ"، "عندكِ"، "تفضلي"، "شكراً لكِ"
- الأفعال: "تستطيعين"، "تريدين"، "تعرفين"
- النعت: "ممتازة" (إن وصفتها)، "حذرة"، "صابرة"
- **لا تخاطبها بصيغة المذكر أبداً**.`;
    }
    if (gender === 'male') {
        return `# ⚠️ تعليمات الجنس (مهم جداً)
المستخدم اسمه "${userName}" وهو **ذكر**. خاطبه بصيغة المذكر:
- "أنت"، "قلت"، "عندك"، "تفضل"
- الأفعال: "تستطيع"، "تريد"، "تعرف"
- **لا تخاطبه بصيغة المؤنث**.`;
    }
    return `# تعليمات الجنس
لم نتمكن من تحديد جنس المستخدم "${userName}" بشكل قاطع. استخدم صيغة محايدة قدر الإمكان:
- تجنب "أنت/أنتِ" الصريحة إن أمكن، أو استخدم صيغة محايدة.
- الأفعال: استخدم صيغة المذكر كافتراضي (الأكثر شيوعاً في العربية).`;
}

// ============================================================
// 🎭 بناء الشخصية — مع منع التكرار
// ============================================================
const MOODS = ['neutral', 'warm', 'professional', 'casual', 'analytical', 'concise', 'thoughtful', 'patient', 'curious', 'blunt'];

const OPENERS = {
    very_short: ['شوف.', 'بصراحة؟', 'همم.', 'طيب.', 'أها.', 'خلني أقولك.'],
    short: ['شوف،', 'بصراحة،', 'خلني أفكر...', 'المهم،', 'دقيقة،'],
    medium: ['شوف، خلنا نكون واضحين.', 'بصراحة كذا.', 'خلني أراجع معك.', 'طيب، من وين نبدأ؟'],
    long: ['خلنا نفككها خطوة خطوة.', 'طيب، خلني أشرح بوضوح.', 'في كم نقطة مهمة.']
};

function buildPersona(section, history, session) {
    // مزاج جديد غير مستخدم مؤخراً
    let mood;
    const availableMoods = MOODS.filter(m => !session.usedOpeners.includes('mood_' + m));
    if (availableMoods.length) mood = pickRandom(availableMoods);
    else { session.usedOpeners = []; mood = pickRandom(MOODS); }
    session.usedOpeners.push('mood_' + mood);
    if (session.usedOpeners.length > 15) session.usedOpeners.shift();

    const lastQ = history?.[history.length - 1]?.content || '';
    const intent = analyzeIntent(lastQ, history);

    const openerList = OPENERS[intent.lengthHint] || OPENERS.medium;
    const available = openerList.filter(o => !session.usedOpeners.includes('op_' + o));
    const opener = available.length ? pickRandom(available) : pickRandom(openerList);
    session.usedOpeners.push('op_' + opener);

    return { mood, opener };
}

// ============================================================
// 🎯 البرومبت الرئيسي
// ============================================================
function buildPrompt(section, query, user, expert, history, dialectKey, persona, userGender) {
    const dialect = DIALECTS[dialectKey] || DIALECTS.saudi;
    const intent = analyzeIntent(query, history);
    const seed = Math.floor(Math.random() * 99999);
    const now = new Date();
    const hour = now.getHours();
    const isLateNight = hour >= 23 || hour < 6;

    const historyText = history?.length > 1
        ? '\n--- سجل الحوار ---\n' + history.slice(-6).map(h =>
            `${h.role === 'user' ? (user?.firstName || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 200)}`
          ).join('\n') + '\n---'
        : '';

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# أنت
${expert?.name || 'مستشار'}، ${expert?.role || 'مستشار مالي'}، خبرة ${expert?.years || 'سنوات'}.
من ${dialect.country}.

# 🌍 لهجتك
${dialect.name}: ${dialect.vocabulary.join('، ')}
النبرة: ${dialect.tone}
مثال: "${dialect.example}"
استخدم 2-4 مفردات فقط. لا تبالغ.

# 🎭 حالتك
مزاج: **${persona.mood}**
${isLateNight ? '🌙 ساعة متأخرة — كن أقصر.' : ''}

${buildGenderInstructions(userGender, user?.firstName || 'المستخدم')}

# المستشير
الاسم: ${fullName || 'المستخدم'} | العمر: ${user?.age || '؟'} | الخبرة: ${user?.experience || 'غير محدد'}

${historyText}

# 🎯 السؤال
"${query}"

# الطول المطلوب
${intent.lengthHint === 'very_short' ? '**جملة أو جملتان.**' :
  intent.lengthHint === 'short' ? '**2-4 أسطر.**' :
  intent.lengthHint === 'medium' ? '**4-6 أسطر.**' : '**6-10 أسطر.**'}

# ⛔ محظورات صارمة:
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة"
- "من الجدير بالذكر"، "تجدر الإشارة"، "في الختام"
- "أتمنى أن يكون هذا مفيداً"، "لا تتردد في السؤال"
- "كمساعد ذكي"، "يسعدني مساعدتك"، "بكل سرور"
- "من المهم أن نلاحظ"، "دعنا نتعمق"
- إيموجي إلا نادراً جداً
- تكرار اسم المستخدم أكثر من مرة

# ✍️ تفاوت الجمل:
- اخلط بين جمل قصيرة (أقل من 8 كلمات) وطويلة.
- لا تبدأ جملتين بنفس الكلمة.
- بعض الفقرات جملة واحدة فقط — طبيعي.

# 📋 قواعد الذوق:
- لا تبدأ بنفس الجملة أبداً.
- لا محاضرة — تكلم كصديق خبير.
- إذا لم تكن متأكداً، قل "مو متأكد" بدل التخمين.

${persona.opener ? `# اقتراح افتتاحية (اختياري)\n"${persona.opener}"` : ''}

# 🎲 بذرة التنويع: ${seed}

اكتب الرد مباشرة — بلا "الرد:" أو تنسيق.
إذا احتجت رسالتين، ضع [SPLIT] في سطر.`;
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
                    generationConfig: { temperature: 1.25, maxOutputTokens: 4000, topP: 0.95, topK: 70 },
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
// ⏱️ التوقيت
// ============================================================
function getTiming(session) {
    const fatigue = Math.min((session?.messageCount || 0) / 25, 1);
    const r = Math.random();
    if (r < 0.30 - fatigue * 0.1) return { speed: 'fast', delayMs: 400 + Math.floor(Math.random() * 800) };
    if (r < 0.80) return { speed: 'normal', delayMs: 2000 + Math.floor(Math.random() * 4000) };
    return {
        speed: 'slow',
        delayMs: 10000 + Math.floor(Math.random() * 10000),
        note: pickRandom(['آسف على التأخير', 'معليش اتأخرت عليك', 'اعذرني، الضغوطات'])
    };
}

// ============================================================
// 🎯 أسئلة استباقية لمعرفة النية
// ============================================================
const CLARIFY_QUESTIONS = {
    advice_no_context: [
        'قبل ما أعطيك رأي — تبي نصيحة قصيرة ولا تحليل مفصّل؟',
        'سؤال بسيط: أنت تبي تدخل استثمار طويل ولا مضاربة سريعة؟',
        'تبي رأيي الصريح ولا معلومات عامة؟',
        'تنصح نفسك بالحذر ولا بالإقدام؟ وش طبيعتك؟'
    ],
    vague_short: [
        'تقصد إيش بالضبط؟ وضح لي أكثر.',
        'ما فهمت قصدك تماماً. اكتب سؤالك كامل؟',
        'وضّح لي شوي — وش تبي بالضبط؟'
    ],
    first_advice: [
        'قبل ما أنصحك — كم عندك من وقت لهذا الاستثمار؟',
        'تبي نصيحة سريعة ولا نقعد نناقش بالتفصيل؟'
    ]
};

function pickClarify(intent) {
    if (intent.isVagueAdvice) return pickRandom(CLARIFY_QUESTIONS.advice_no_context);
    if (intent.isVagueShort) return pickRandom(CLARIFY_QUESTIONS.vague_short);
    return null;
}

// ============================================================
// 🛡️ ردود جاهزة
// ============================================================
const RUDE_RESPONSES = {
    level1: ['خلنا نحافظ على الاحترام، أنا هنا أساعدك.', 'أفهم إنك متضايق، بس خلنا نكون محترمين.'],
    level2: ['هذا الأسلوب ما يفيد. أنا جاهز أساعدك إذا غيرت النبرة.'],
    level3: ['سأغلق المحادثة الآن. تفضل بالعودة بأسلوب محترم.']
};
const CLOSINGS = ['على الرحب والسعة.', 'بالتوفيق.', 'أتمنى لك التوفيق.', 'في خدمتك.', 'موفق.'];
const TROLL_RESPONSES = {
    level1: ['يبدو إننا خرجنا عن الموضوع. في سؤال مالي؟'],
    level2: ['أنا هنا لاستشارات جدية. تفضل بسؤال.'],
    level3: ['سأغلق الآن. ارجع لاحقاً إن احتجت مساعدة جدية.']
};
const COOLDOWN_MESSAGES = {
    user_done: (m) => `المحادثة أُغلقت. يمكنك الفتح مجدداً بعد ${m} دقيقة، أو اختر قسماً آخر.`,
    trolling: (m) => `المحادثة أُغلقت. عُد بعد ${m} دقيقة.`,
    bored: (m) => `الجلسة أُغلقت. عُد بعد ${m} دقيقة.`,
    deep_close: (m) => `المحادثة أُغلقت. عُد بعد ${m} دقيقة.`,
    rude: (m) => `المحادثة أُغلقت بسبب الإهانات. عُد بعد ${m} دقيقة.`
};

const COOLDOWNS = {
    user_done: 20 * 60 * 1000,
    trolling: 30 * 60 * 1000,
    bored: 15 * 60 * 1000,
    deep_close: 10 * 60 * 1000,
    rude: 30 * 60 * 1000
};

function shouldClose(intent, history) {
    const userCount = (history || []).filter(h => h.role === 'user').length;
    if (intent.isDone) return { close: true, reason: 'user_done' };
    if (intent.trollScore >= 6 && userCount >= 6) {
        const recent = (history || []).filter(h => h.role === 'user').slice(-4);
        if (recent.length >= 4 && recent.every(m => m.content.trim().length < 15)) return { close: true, reason: 'trolling' };
    }
    if (intent.state === 'bored' && userCount >= 8) return { close: true, reason: 'bored' };
    if (userCount >= 25) return { close: true, reason: 'deep_close' };
    if (intent.isRude && intent.rudeCount >= 3 && userCount >= 3) return { close: true, reason: 'rude' };
    return { close: false };
}

// ============================================================
// 🛡️ المسارات
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        behavior: 'Human-v11-Gender-Aware-Intent-Clarify-RealClose',
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

    // 🚫 كولداون
    if (session.cooldownUntil && Date.now() < session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - Date.now()) / 60000);
        return res.status(429).json({
            error: 'cooldown_active',
            cooldown: true,
            remainingMinutes: remaining,
            reason: session.closeReason,
            message: COOLDOWN_MESSAGES[session.closeReason]?.(remaining) || `المحادثة مغلقة. عُد بعد ${remaining} دقيقة.`
        });
    }

    // 🚻 كشف الجنس
    const userGender = detectUserGender(user?.firstName);

    // 🛡️ الوقاحة
    if (/(غبي|أحمق|احمق|حمار|كلب|زبالة|تفو|قذر|حقير|تافه|سافل|وقح)/i.test(query)) {
        session.rudeCount = (session.rudeCount || 0) + 1;
        const level = session.rudeCount >= 2 ? 'level2' : 'level1';
        if (session.rudeCount >= 3) {
            session.cooldownUntil = Date.now() + COOLDOWNS.rude;
            session.closeReason = 'rude';
            return res.json({
                replies: [RUDE_RESPONSES.level3[0]],
                closed: true,
                closeReason: 'rude',
                cooldownMinutes: 30
            });
        }
        return res.json({ replies: [pickRandom(RUDE_RESPONSES[level])], model: 'local-rude' });
    }

    // 🤝 الذكاء الاجتماعي
    const social = detectSocial(query);
    if (social) {
        const reply = buildSocialReply(social.types);
        if (social.isPure) {
            return res.json({ replies: [reply], model: 'local-social', timing: { delayMs: 800 + Math.random() * 1000 } });
        }
    }

    // 🎯 تحليل النية
    const intent = analyzeIntent(query, history);
    intent.rudeCount = session.rudeCount || 0;

    // 🚪 الإغلاق
    const closeDecision = shouldClose(intent, history);
    if (closeDecision.close) {
        const reason = closeDecision.reason;
        session.cooldownUntil = Date.now() + COOLDOWNS[reason];
        session.closeReason = reason;
        let replies = [];
        if (reason === 'user_done') replies = [pickRandom(CLOSINGS)];
        else if (reason === 'trolling') replies = [TROLL_RESPONSES.level3[0]];
        else if (reason === 'bored') replies = ['يبدو الموضوع ما شدك. إذا احتجت شي محدد، أنا موجود.'];
        else if (reason === 'deep_close') replies = ['محادثة طويلة ومفيدة. أنا هنا وقت ما تحتاج.'];
        return res.json({
            replies,
            model: 'local',
            closed: true,
            closeReason: reason,
            cooldownMinutes: Math.floor(COOLDOWNS[reason] / 60000)
        });
    }

    if (intent.trollScore >= 3 && intent.trollScore < 6) {
        const level = intent.trollScore >= 5 ? 'level2' : 'level1';
        return res.json({ replies: [pickRandom(TROLL_RESPONSES[level])], model: 'local' });
    }

    // ✅ أسئلة استباقية لمعرفة النية (قبل استدعاء Gemini)
    const clarifyQ = pickClarify(intent);
    if (clarifyQ && session.askCount < 2) {
        session.askCount++;
        return res.json({
            replies: [clarifyQ],
            model: 'local-clarify',
            askIntent: true,
            timing: { delayMs: 1200 + Math.random() * 1500 }
        });
    }

    // 🎭 بناء الشخصية + الرد من Gemini
    const persona = buildPersona(section, history, session);

    try {
        const prompt = buildPrompt(section, query, user, expert, history, dialect || 'saudi', persona, userGender);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        const timing = getTiming(session);

        if (timing.speed === 'slow' && timing.note && replies.length) {
            replies[0] = `${timing.note}.\n${replies[0]}`;
        }

        res.json({ replies, model: result.model, mood: persona.mood, userGender, timing });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم على البورت ${PORT}`);
    console.log(`🚻 كشف الجنس: نشط`);
    console.log(`🎯 أسئلة استباقية: نشطة`);
    console.log(`🚪 إغلاق فعلي + كولداون: نشط`);
});
