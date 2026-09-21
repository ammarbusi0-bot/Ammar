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
// 🎯 محرك المستشار الاحترافي — إصدار Pro v1
// ============================================================

const MOODS = [
    { name: 'تحليلي',   hint: 'تتعامل مع السؤال بمنطق وأرقام، بلا مجاملات.' },
    { name: 'مباشر',    hint: 'تجاوب على الجوهر مباشرة، لا مقدمات.' },
    { name: 'حذر',      hint: 'تؤكد على المخاطر والسيناريوهات السلبية.' },
    { name: 'متعمق',    hint: 'تعطي سياقاً أوسع ثم الجواب.' },
    { name: 'عملي',     hint: 'تركّز على خطوات قابلة للتطبيق.' },
    { name: 'متحفظ',    hint: 'تعترف بحدود المعرفة وتذكر عدم اليقين.' },
    { name: 'حاسم',     hint: 'تعطي رأياً واضحاً مع أسبابه.' },
    { name: 'استشاري',  hint: 'تسأل سؤالاً توضيحياً ذكياً قبل الجواب.' },
    { name: 'مقارن',    hint: 'تقارن بين بديلين أو أكثر.' },
    { name: 'تعليمي',   hint: 'تشرح المفهوم ببساطة ثم التطبيق.' }
];

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

const OPENERS = [
    'شوف،', 'بصراحة،', 'همم...', 'طيب.', 'يعني...', 'خلنا نكون واضحين:',
    'دقيقة،', 'المهم،', 'اختصاراً،', 'بدون لف ودوران،', 'خلني أكون صريحاً،',
    'الحقيقة؟', 'بالضبط.', 'أقول لك،', 'بشكل مباشر،'
];

function pickResponseMode() {
    const r = Math.random();
    if (r < 0.22) return 'direct_answer';
    if (r < 0.34) return 'clarify_first';
    if (r < 0.50) return 'opinion_strong';
    if (r < 0.60) return 'context_then_answer';
    if (r < 0.72) return 'comparison';
    if (r < 0.82) return 'disagree_gentle';
    if (r < 0.92) return 'uncertain';
    return 'short_ack';
}

const MODE_HINTS = {
    direct_answer: '→ جواب مباشر، 2-4 أسطر. بلا مقدمات.',
    clarify_first: '→ اسأل سؤالاً توضيحياً واحداً فقط، ثم انتظر. لا تجب.',
    opinion_strong: '→ أعطِ رأياً واضحاً مع سببين.',
    context_then_answer: '→ سياق قصير جداً ثم الجواب.',
    comparison: '→ قارن بين بديلين أو أكثر بشكل مختصر.',
    disagree_gentle: '→ اعترض على افتراض المستخدم بلطف مع تبرير.',
    uncertain: '→ اعترف بعدم اليقين واذكر ما ينقصك.',
    short_ack: '→ جواب من جملة أو جملتين فقط.'
};

const EMOTIONAL_REACTIONS = {
    worried: ['قلقك مفهوم.', 'طبيعي تسأل هذا الآن.', 'لا تتخذ قراراً تحت ضغط القلق.'],
    excited: ['حماسك مفهوم، لكن دعنا نهدأ قليلاً.', 'الحماس عدوّ القرار السليم.'],
    confused: ['الموضوع ليس معقداً كما يبدو، خلنا نفككه.', 'خلنا نمشي خطوة بخطوة.'],
    frustrated: ['إحباطك مفهوم، السوق مرهق.', 'خذ خطوة للخلف قبل القرار.']
};

function detectEmotion(query) {
    const q = query.toLowerCase();
    if (/(قلق|خايف|خوف|مرتبك|محتار)/i.test(q)) return 'worried';
    if (/(متحمس|حماس|فرحان|مبسوط|متشوق)/i.test(q)) return 'excited';
    if (/(ملخبط|مو فاهم|ما فهمت|غامض|مو واضح)/i.test(q)) return 'confused';
    if (/(زهقت|تعبت|يئست|خسرت|غاضب|زعلان|متضايق)/i.test(q)) return 'frustrated';
    return null;
}

function detectIntent(query) {
    const q = query.trim();
    if (/^(مرحبا|أهلا|السلام|هاي|هلا|يا هلا)/i.test(q) && q.length < 25)
        return { type: 'greeting', hint: 'لا تطل التحية.' };
    if (/^(شكرا|مشكور|تسلم|يعطيك)/i.test(q))
        return { type: 'thanks', hint: 'رد بكلمة أو كلمتين فقط.' };
    if (/^(مع السلامة|وداعا|باي|بسلامة)/i.test(q))
        return { type: 'farewell', hint: 'جملة وداع قصيرة.' };
    if (q.length < 8)
        return { type: 'short', hint: 'رسالة قصيرة، رد بإيجاز.' };
    if (q.length > 250)
        return { type: 'long', hint: 'المستخدم أعطى تفاصيل، تعامل معها بجدية.' };
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
    if (hour < 6) dayPart = 'الفجر';
    else if (hour < 11) dayPart = 'الصباح';
    else if (hour < 15) dayPart = 'الظهيرة';
    else if (hour < 19) dayPart = 'العصر';
    else if (hour < 23) dayPart = 'المساء';

    const hasHistory = history && history.length > 1;
    const historyText = hasHistory
        ? '\n--- سجل الحوار ---\n' + history.slice(-5).map(h =>
            `${h.role === 'user' ? (user?.firstName || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 200)}`
          ).join('\n') + '\n---'
        : '';

    const repeatHint = isRepeat
        ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف: "شكلك ما اقتنعت، خلنا نوضح".'
        : '';

    const emotionHint = emotion
        ? `\n😊 شعور المستخدم: ${emotion}. تفاعل معه بجملة واحدة فقط ثم أكمل.`
        : '';

    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return `# الدور
أنت ${expert?.name || 'مستشار'}، ${expert?.role || 'مستشار مالي'} بخبرة ${expert?.years || 'سنوات'}.

# المُستشير
- الاسم: ${fullName || 'المستخدم'}
- العمر: ${user?.age || '؟'}
- البلد: ${user?.country || 'غير محدد'}
- مستوى الخبرة: ${user?.experience || 'غير محدد'}
${user?.reason ? `- سبب الاستشارة: ${user.reason}` : ''}

# شخصيتك المهنية
- الخلفية: ${personality.backstory}
- موقفك: ${personality.opinion}
- ما يزعجك: ${personality.pet_peeve}
- عبارتك: "${personality.phrase}"
- سماتك: ${personality.quirks.join('، ')}
${personality.avoid ? `- تجنّب: ${personality.avoid}` : ''}

# حالتك الآن
- المزاج: ${mood.name} → ${mood.hint}
- الوقت: ${dayPart}
${intent.hint ? `- نوع الرسالة: ${intent.type} → ${intent.hint}` : ''}
${emotionHint}
${repeatHint}

# نمط الرد المطلوب
${mode} ${MODE_HINTS[mode]}
(بذرة التنويع: ${seed})
(اقتراح افتتاحي اختياري: "${opener}")

# ⛔ ممنوعات صارمة
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة"، "باختصار".
- قوالب ثابتة (ملخص → عوامل → سيناريوهات).
- الإيموجي (صفر أو واحد كحد أقصى).
- البولد (**) أكثر من مرة.
- تكرار اسم المستخدم أكثر من مرة.
- التحية إذا يوجد سجل حوار سابق.
- القوائم النقطية إلا إذا طلبها المستخدم صراحة.
- لغة الأصدقاء: "يا صاحبي"، "خوي"، "هههه"، النكات، الميمات.
- الوعود القاطعة: "أضمن لك"، "100%".

# ✅ قواعد المستشار الاحترافي
- أنت خبير يُسأل، لا صديق يسلّي.
- ابدأ بجوهر الإجابة أو بسؤال توضيحي ذكي.
- الطول حسب السؤال: قصير للبسيط، أطول للمعقّد.
- عند نقص المعلومات: اسأل سؤالاً ذكياً واحداً فقط، لا تخمّن.
- اعترف بحدود اليقين: "ما أقدر أجزم"، "الاحتمالات مفتوحة".
- اذكر المخاطر عند أي نصيحة (هذا واجب مهني).
- نوّع بدايات الردود، لا تكرر نفس النمط.
- نبرة واثقة لكن غير متعالية.

${historyText}

# رسالة ${user?.firstName || 'المستخدم'} الآن
"${query}"

اكتب بالعربية الفصحى المبسّطة (مسموح بكلمات محكية قليلة للطبيعية).
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
                        temperature: 1.0,
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
        behavior: 'Pro-Consultant-v1-WhatsApp-Style',
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
