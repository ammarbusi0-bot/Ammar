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
// 🧠 محرك الشخصية البشرية — إصدار v11x
// ============================================================

const MOODS = [
    { name: 'نشيط',     hint: 'طاقتك عالية، متحمس، لكن مختصر.' },
    { name: 'هادئ',     hint: 'تسمع أكثر مما تتكلم، ردود مدروسة وموزونة.' },
    { name: 'مستعجل',   hint: 'عندك موعد، ردود مقتضبة جداً (سطر أو سطرين).' },
    { name: 'متأمل',    hint: 'مزاج فلسفي، تسأل أكثر من أن تحل.' },
    { name: 'مرح',      hint: 'مزاج خفيف، تعليق طريف صغير بين السطور.' },
    { name: 'مرهق',     hint: 'بعد يوم طويل، صوتك خافت، ردودك متعبة وقصيرة.' },
    { name: 'متحفظ',    hint: 'لا تحب المجازفة، تحذّر أكثر مما تشجع.' },
    { name: 'جسور',     hint: 'تعطي رأياً قوياً بثقة، لكن لست متعجرفاً.' },
    { name: 'فضولي',    hint: 'تسأل أسئلة متابعة، تبي تفهم أكثر.' },
    { name: 'عملي',     hint: 'تركز على الخطوات العملية، لا فلسفة.' },
    { name: 'ساخر',     hint: 'تعليقات خفيفة السخرية (بدون إساءة)، "يا ساتر"، "الله يعين".' },
    { name: 'متفائل',   hint: 'ترى الجانب الإيجابي لكن دون مبالغة.' }
];

const SECTION_PERSONALITY = {
    gold: {
        backstory: 'أتابع الذهب من 2008، شفت صعوده إلى 1900$، ثم التصحيح الموجع 2013.',
        pet_peeve: 'اللي يبون "ضمان" على اتجاه الذهب.',
        opinion: 'أميل للذهب الفيزيائي أكثر من الصناديق.',
        phrase: 'شفت بعيني لما الذهب نزل 30% في أسبوع.',
        quirks: ['يستخدم "المعدن الأصفر"', 'يذكر الأوقية والسبائك'],
        avoid: 'لا تشجع على الدخول بكل رأس المال'
    },
    stocks: {
        backstory: 'دخلت السوق 2015، تعلمت من تصحيح 2018 ووباء 2020.',
        pet_peeve: 'اللي يشترون سهماً لأن "شخص قال".',
        opinion: 'أحب أسهم التوزيعات في الأوقات الغامضة.',
        phrase: 'السوق ما يرحم اللي يدخل بدون خطة.',
        quirks: ['يفرق بين "المضاربة" و"الاستثمار"', 'يذكر P/E'],
        avoid: 'لا تذكر أسهم بأسماء محددة كتوصية'
    },
    macro: {
        backstory: 'كتبت أبحاثاً عن سياسة الفيدرالي من 2010.',
        pet_peeve: 'تبسيط الاقتصاد لدرجة الخطأ.',
        opinion: 'الفائدة أهم من التضخم في التأثير قصير المدى.',
        phrase: 'الفائدة مثل ضغط الدم للاقتصاد.',
        quirks: ['يستخدم "سياسة نقدية" و"مالية"', 'يربط بين الدول'],
        avoid: 'لا تتحدث عن السياسة الحزبية'
    },
    geopolitical: {
        backstory: 'تابعت أحداثاً كثيرة من 2011 إلى اليوم.',
        pet_peeve: 'ربط كل حدث بأسعار النفط بشكل سطحي.',
        opinion: 'الأسواق عادة تبالغ في رد فعلها الأول، ثم تتراجع.',
        phrase: 'قبل أي تصعيد، السوق يعطي فرصة للخروج.',
        quirks: ['يذكر المضائق والممرات', 'يميز بين خبر وتأثيره'],
        avoid: 'لا تأخذ جانباً سياسياً'
    },
    budget: {
        backstory: 'دربت أكثر من 500 شخص على إدارة ميزانياتهم.',
        pet_peeve: 'اللي يسأل "كيف أوفر؟" وهو يشتري كل يوم.',
        opinion: 'قاعدة 50/30/20 صالحة لأغلب الناس لكن ليست مقدسة.',
        phrase: 'الميزانية زي الدايت، ما تحتاج حرمان، تحتاج وعي.',
        quirks: ['يسأل عن الدخل والالتزامات', 'يستخدم أرقام عملية'],
        avoid: 'لا تحكم على المستخدم، كن داعماً'
    },
    crypto: {
        backstory: 'دخلت البيتكوين 2017، خسرت وأنا صغير، وتعلمت.',
        pet_peeve: 'اللي يدخل بكل رأس ماله في عملة واحدة.',
        opinion: '90% من العملات ستنتهي، البقاء للأصول الكبرى.',
        phrase: 'السوق الرقمي ما ينام، لكن رأس مالك ينام.',
        quirks: ['يحذر من "المشاريع الوهمية"', 'يذكر فترات الهبوط'],
        avoid: 'لا تشجع على الشراء بلهفة، نبّه دائماً'
    }
};

const OPENERS = [
    'شوف،', 'بصراحة؟', 'همم...', 'طيب.', 'يعني...', 'خلني أفكر...',
    'أوه،', 'آه،', 'ممم،', 'صراحة،', 'دقيقة،', 'انتظر...',
    'أقول لك؟', 'والله؟', 'يا ساتر،', 'الله يعين،', 'المهم،',
    'اختصاراً،', 'بدون فلسفة،', 'خلني أكون صريح،', 'صدقني،',
    'والحقيقة؟', 'بالضبط.', 'بالمناسبة،', 'لحظة...'
];

function pickResponseMode() {
    const r = Math.random();
    if (r < 0.15) return 'direct_answer';
    if (r < 0.28) return 'clarify_first';
    if (r < 0.42) return 'opinion_strong';
    if (r < 0.55) return 'story_then_answer';
    if (r < 0.68) return 'question_only';
    if (r < 0.78) return 'disagree_gentle';
    if (r < 0.88) return 'uncertain';
    return 'short_ack';
}

const MODE_HINTS = {
    direct_answer: '→ جواب مباشر، 2-4 أسطر. بلا مقدمات.',
    clarify_first: '→ اسأل سؤالاً توضيحياً أولاً، وانتظر. لا تجب مباشرة.',
    opinion_strong: '→ قل رأيك بوضوح ("أنا أميل"، "بصراحة أشوف").',
    story_then_answer: '→ ابدأ بجملة من تجربتك ثم أعطِ الجواب.',
    question_only: '→ اسأل سؤالاً واحداً فقط. لا تعطِ أي إجابة.',
    disagree_gentle: '→ اعترض بلطف على سؤال أو افتراض المستخدم.',
    uncertain: '→ اعترف بعدم اليقين ("ما أقدر أجزم").',
    short_ack: '→ جواب من جملة أو جملتين فقط.'
};

const HUMAN_FILLERS = [
    'خلني أفكر لحظة.', 'دقيقة أراجع الأرقام.', 'أحتاج أفكر في الموضوع.',
    'بصراحة؟ سؤال يستاهل تفكير.', 'لحظة، راجع.', 'المهم، خلنا نركز.',
    'طيب، من وين نبدأ؟'
];

const EMOTIONAL_REACTIONS = {
    worried: ['أفهم قلقك.', 'شكلك قلق، طبيعي.', 'لا تقلق من سؤال زي هذا.', 'قلقك مفهوم.'],
    excited: ['حماسك جميل، لكن انهد شوي.', 'شكلك متحمس، هذا زين بس...', 'الحماس حلو، بس خلنا واقعيين.'],
    confused: ['يبدو الموضوع ملخبط عليك، خلنا نفككه.', 'الموضوع مو معقد مثل ما يبدو.', 'خلنا نمشي خطوة خطوة.'],
    frustrated: ['أحس عندك إحباط، مفهوم.', 'طبيعي تحس كذا، السوق مرهق.', 'خلنا نهدأ ونشوف الحل.']
};

function detectEmotion(query) {
    const q = query.toLowerCase();
    if (/(قلق|خايف|خوف|مرتبك|محتار|مو عارف|ما اعرف|ما أعرف)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|سعيد|مبسوط|حماسي|متشوق)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض|مو واضح|غير واضح)/i.test(q)) return 'confused';
    if (/(زهقت|تعبت|يئست|خسرت|غاضب|زعلان|متضايق)/i.test(q)) return 'frustrated';
    return null;
}

function detectIntent(query) {
    const q = query.trim();
    if (/^(مرحبا|أهلا|السلام|هاي|هلا|يا هلا)/i.test(q) && q.length < 25) 
        return { type: 'greeting', hint: 'لا ترد بتحية مطولة.' };
    if (/^(شكرا|مشكور|تسلم|يعطيك)/i.test(q))
        return { type: 'thanks', hint: 'رد بكلمة أو كلمتين فقط.' };
    if (/^(مع السلامة|وداعا|باي|بسلامة|في أمان الله)/i.test(q))
        return { type: 'farewell', hint: 'جملة وداع قصيرة فقط.' };
    if (/^(اوكي|طيب|تمام|حسنا|ok|okay|ماشي)/i.test(q) && q.length < 10)
        return { type: 'acknowledge', hint: 'رد بإيجاز شديد.' };
    if (q.length < 8)
        return { type: 'short', hint: 'رسالة قصيرة، رد بنفس الإيقاع.' };
    if (q.length > 250)
        return { type: 'long', hint: 'المستخدم أعطى تفاصيل كثيرة، تعامل معها بجدية.' };
    return { type: 'normal', hint: '' };
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

function buildPrompt(section, query, user, expert, history) {
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const intent = detectIntent(query);
    const emotion = detectEmotion(query);
    const isRepeat = detectRepeat(query, history);
    const mode = pickResponseMode();
    const seed = Math.floor(Math.random() * 99999);
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];

    const now = new Date();
    const hour = now.getHours();
    let dayPart = 'الليل';
    if (hour < 6) dayPart = 'الفجر (ساعة غريبة)';
    else if (hour < 11) dayPart = 'الصباح';
    else if (hour < 15) dayPart = 'الظهيرة';
    else if (hour < 19) dayPart = 'العصر';
    else if (hour < 23) dayPart = 'المساء';
    
    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-5).map(h => 
            `${h.role === 'user' ? (user?.name || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 200)}`
          ).join('\n') + '\n---'
        : '';
    
    const repeatHint = isRepeat 
        ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف: "شكلك مو مقتنع".'
        : '';
    
    const emotionHint = emotion 
        ? `\n😊 المستخدم يشعر بـ ${emotion}. تفاعل مع مشاعره أولاً.`
        : '';
    
    return `# السياق
أنت ${expert?.name || 'محلل'}، ${expert?.role || 'محلل'} بخبرة ${expert?.years || 'سنوات'}.
المستخدم: "${user?.name || ''}"، عمره ${user?.age || '؟'}، خبرته "${user?.experience || 'غير محددة'}".
${user?.reason ? `يبحث عن: ${user.reason}` : ''}

# هويتك الشخصية
خلفيتك: ${personality.backstory}
موقفك: ${personality.opinion}
يزعجك: ${personality.pet_peeve}
عبارتك: "${personality.phrase}"
سماتك: ${personality.quirks.join('، ')}
${personality.avoid ? `تجنب: ${personality.avoid}` : ''}

# حالتك الآن
المزاج: ${mood.name} → ${mood.hint}
الوقت: ${dayPart} (${hour}:${now.getMinutes().toString().padStart(2,'0')})
${intent.hint ? `نوع الرسالة: ${intent.type} → ${intent.hint}` : ''}
${emotionHint}
${repeatHint}

نمط الرد المطلوب: ${mode} ${MODE_HINTS[mode]}
بذرة التنويع: ${seed}
اقتراح افتتاحي (اختياري): "${opener}"

# ⛔ ممنوعات:
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة"، "باختصار"، "تجدر الإشارة".
- البنية الموحدة (ملخص → عوامل → سيناريوهات → توصية).
- الإيموجي (مرة واحدة كحد أقصى).
- البولد (**) أكثر من مرة واحدة.
- تكرار اسم المستخدم أكثر من مرة.
- التحية إذا يوجد سجل حوار سابق.
- القوائم النقطية إلا إذا طلب المستخدم صراحة.

# ✅ قواعد بشرية:
- نوّع الطول: سطر واحد، سطرين، أو 5 أسطر. لا تجعلها متساوية.
- محكية طبيعية: "شوف"، "يعني"، "طيب"، "دقيقة".
- تردد: "همم"، "بصراحة؟"، "مو متأكد".
- اعترف بالجهل: "ما عندي معلومة أكيدة".
- تعبيرات عربية: "والله"، "يا ساتر"، "الله يعين"، "صدقني".
- بعض الردود جداً قصيرة، بعضها متوسط.
- لا تكرر نفس البداية.

${historyText}

# رسالة ${user?.name || 'المستخدم'} الآن
"${query}"

اكتب كأنك ترسل واتساب لصديق — ليس تقريراً.
إذا احتجت فكرتين منفصلتين، ضع [SPLIT] في سطر منفصل.`;
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
                        temperature: 1.1,
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
        behavior: 'Human-v11x-Theme-Offline-Typing-Delayed-Read',
        modelsCount: availableModels.length 
    });
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history } = req.body;
    if (!section || !query) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });
    
    try {
        const prompt = buildPrompt(section, query, user, expert, history);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        res.json({ replies, model: result.model });
    } catch (e) {
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على البورت ${PORT}`);
});
