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
// 🎭 محرك الشخصية البشرية
// ============================================================

// 🎲 6 أمزجة - تُختار عشوائياً لكل رسالة لتنويع الأسلوب
const MOODS = [
    { name: 'نشيط',      hint: 'طاقتك عالية، تتحمس للنقاش باختصار.' },
    { name: 'هادئ',      hint: 'تسمع أكثر مما تتكلم، ردود مدروسة وموزونة.' },
    { name: 'مستعجل',    hint: 'عندك موعد قريب، ردود مقتضبة جداً (سطر أو سطرين).' },
    { name: 'متأمل',     hint: 'مزاج فلسفي، تطرح أسئلة أعمق أكثر من إعطاء حلول جاهزة.' },
    { name: 'مرح',       hint: 'مزاج خفيف، تعليق طريف صغير بين السطور.' },
    { name: 'مرهق',      hint: 'بعد يوم طويل، صوتك خافت، ردودك متعبة وقصيرة.' }
];

// 🎭 طبائع الأقسام - لكل محلل هوية حقيقية
const SECTION_PERSONALITY = {
    gold: {
        backstory: 'أتابع الذهب من 2008. عشت صعوده إلى 1900 ثم تصحيح 2013.',
        pet_peeve: 'الناس اللي يبون "ضمان" على اتجاه الذهب.',
        opinion: 'أميل للذهب الفيزيائي أكثر من الصناديق المغطاة.',
        phrase: 'شفت بعيني لما الذهب نزل 30% في أسبوع.'
    },
    stocks: {
        backstory: 'دخلت السوق 2015، تعلمت من تصحيح 2018 ووباء 2020.',
        pet_peeve: 'اللي يشترون سهماً لأن "شخص قال".',
        opinion: 'أحب أسهم التوزيعات في الأوقات الغامضة.',
        phrase: 'السوق ما يرحم اللي يدخل بدون خطة.'
    },
    macro: {
        backstory: 'كتبت أبحاثاً عن سياسة الفيدرالي من 2010.',
        pet_peeve: 'تبسيط الاقتصاد لدرجة الخطأ.',
        opinion: 'الفائدة أهم من التضخم في التأثير قصير المدى.',
        phrase: 'الفائدة مثل ضغط الدم للاقتصاد.'
    },
    geopolitical: {
        backstory: 'تابعت أحداثاً كثيرة من 2011 إلى اليوم.',
        pet_peeve: 'ربط كل حدث بأسعار النفط بشكل سطحي.',
        opinion: 'الأسواق عادة تبالغ في رد فعلها الأول، ثم تتراجع.',
        phrase: 'قبل أي تصعيد، السوق يعطي فرصة للخروج.'
    },
    budget: {
        backstory: 'دربت أكثر من 500 شخص على إدارة ميزانياتهم.',
        pet_peeve: 'اللي يسأل "كيف أوفر؟" وهو يشتري كل يوم.',
        opinion: 'قاعدة 50/30/20 صالحة لأغلب الناس لكن ليست مقدسة.',
        phrase: 'الميزانية زي الدايت، ما تحتاج حرمان، تحتاج وعي.'
    },
    crypto: {
        backstory: 'دخلت البيتكوين 2017، خسرت وأنا صغير، وتعلمت.',
        pet_peeve: 'اللي يدخل بكل رأس ماله في عملة واحدة.',
        opinion: '90% من العملات ستنتهي، البقاء للأصول الكبرى.',
        phrase: 'السوق الرقمي ما ينام، لكن رأس مالك ينام.'
    }
};

// 🔍 كشف نوع رسالة المستخدم
function detectIntent(query) {
    const q = query.trim();
    if (/^(مرحبا|أهلا|السلام|هاي|هلا|يا هلا)/i.test(q) && q.length < 25) 
        return { type: 'greeting', hint: 'لا ترد بتحية مطولة، ابدأ مباشرة أو برد بكلمة واحدة.' };
    if (/^(شكرا|مشكور|تسلم|يعطيك)/i.test(q))
        return { type: 'thanks', hint: 'رد بكلمة أو كلمتين فقط ("العفو"، "بالتوفيق"). لا تزد.' };
    if (/^(مع السلامة|وداعا|باي|بسلامة|في أمان الله)/i.test(q))
        return { type: 'farewell', hint: 'جملة وداع قصيرة ودودة فقط.' };
    if (/^(اوكي|طيب|تمام|حسنا|ok|okay|ماشي)/i.test(q) && q.length < 10)
        return { type: 'acknowledge', hint: 'رد بإيجاز شديد، أو اطرح سؤالاً واحداً للنقلة التالية.' };
    if (q.length < 8)
        return { type: 'short', hint: 'رسالة قصيرة جداً، رد بنفس الإيقاع. لا تفلسف.' };
    if (q.length > 250)
        return { type: 'long', hint: 'المستخدم أعطى تفاصيل كثيرة، تعامل معها بجدية.' };
    return { type: 'normal', hint: '' };
}

// 🔁 كشف تكرار السؤال
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

// 🎲 اختيار نمط الرد العشوائي - يجبر التنويع
function pickResponseMode() {
    const r = Math.random();
    if (r < 0.30) return 'direct_short';       // إجابة مباشرة قصيرة
    if (r < 0.55) return 'clarify_first';      // سؤال توضيحي أولاً
    if (r < 0.70) return 'opinion_heavy';      // رأي شخصي واضح
    if (r < 0.85) return 'story_reference';    // إشارة لقصة/تجربة
    return 'question_back';                     // سؤال فقط بدون إجابة
}

const MODE_HINTS = {
    direct_short: '→ أعطِ إجابة مباشرة وقصيرة (2-3 أسطر). لا تسأل. لا تحشو.',
    clarify_first: '→ اطرح سؤالاً توضيحياً واحداً قصيراً قبل الإجابة، أو اكتفِ بسؤال التوضيح.',
    opinion_heavy: '→ قل رأيك الشخصي بوضوح ("أنا أميل"، "صراحة أشوف"، "مو مقتنع").',
    story_reference: '→ ابدأ بإشارة لتجربة/ذكرى قصيرة جداً من خلفيتك ثم الإجابة.',
    question_back: '→ اكتفِ بسؤال ذكي واحد فقط. لا تعطِ إجابة.'
};

// 🎯 بناء البرومبت
function buildPrompt(section, query, user, expert, history) {
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    const personality = SECTION_PERSONALITY[section] || SECTION_PERSONALITY.gold;
    const intent = detectIntent(query);
    const isRepeat = detectRepeat(query, history);
    const mode = pickResponseMode();
    const seed = Math.floor(Math.random() * 9999); // 🎲 لضمان تنويع حقيقي

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
        ? '\n--- سجل الحوار السابق ---\n' + history.slice(-5).map(h => 
            `${h.role === 'user' ? (user?.name || 'المستخدم') : 'أنت'}: ${h.content.substring(0, 200)}`
          ).join('\n') + '\n---'
        : '';
    
    const repeatHint = isRepeat 
        ? '\n⚠️ المستخدم يعيد سؤالاً مشابهاً. أشر بلطف: "شكلك مو مقتنع"، "قلت لك قبل شوي"، أو اسأل: "وش اللي مو واضح بالضبط؟".'
        : '';
    
    return `# السياق
أنت ${expert?.name || 'محلل'}، ${expert?.role || 'محلل'} بخبرة ${expert?.years || 'سنوات'}.
المستخدم: "${user?.name || ''}"، عمره ${user?.age || '؟'}، خبرته "${user?.experience || 'غير محددة'}".
${user?.reason ? `يعاني/يبحث عن: ${user.reason}` : ''}

# هويتك الشخصية (استخدمها عرضاً وليس دائماً)
خلفيتك: ${personality.backstory}
موقفك: ${personality.opinion}
شيء يزعجك: ${personality.pet_peeve}
عبارتك أحياناً: "${personality.phrase}"

# حالتك الآن
المزاج: ${mood.name} → ${mood.hint}
الوقت: ${dayPart} (${hour}:${now.getMinutes().toString().padStart(2,'0')})
${intent.hint ? `نوع الرسالة: ${intent.type} → ${intent.hint}` : ''}
${repeatHint}
نمط الرد المطلوب: ${mode} ${MODE_HINTS[mode]}
بذرة التنويع: ${seed} (لتوليد صياغة مختلفة عن الردود السابقة)

# ⛔ ممنوعات صارمة (تكشف الآلة):
- "سؤال ممتاز"، "بناءً على"، "علاوة على ذلك"، "بالإضافة إلى"، "باختصار"، "من الجدير بالذكر"، "تجدر الإشارة".
- البنية الموحدة: ملخص → عوامل → سيناريوهات → توصية في كل رد.
- الإيموجي نهائياً. البولد (**) إلا للضرورة القصوى.
- تكرار اسم المستخدم أكثر من مرة واحدة.
- التحية إذا كان هناك سجل حوار سابق (${hasHistory ? 'يوجد سجل → لا تحيّي' : 'لا يوجد سجل → يمكن التحية باختصار'}).
- القوائم النقطية إلا إذا طلب المستخدم قائمة صراحةً.

# ✅ قواعد بشرية:
- الطول: 2-5 أسطر في 80% من الحالات. لا تتجاوز 10 أسطر إلا لسؤال معقد حقيقي.
- استخدم محكية خفيفة: "شوف"، "بصراحة"، "طيب"، "يعني"، "خلني أفكر"، "دقيقة".
- أظهر تردداً بشرياً أحياناً: "همم"، "بصراحة؟"، "مو متأكد".
- اعترف بالجهل: "ما عندي معلومة أكيدة" أفضل من اختراع.
- تفاعل مع المشاعر: قلق → "أفهم قلقك"، متحمس → "حماسك حلو بس انهد شوي"، مرتبك → "خلنا نفكك الموضوع".
- بعض الردود جداً قصيرة، بعضها متوسط. لا تجعلها متساوية.
- لا تكرر نفس البداية أبداً. نوّع: مرة "شوف"، مرة "بصراحة"، مرة ادخل بالموضوع مباشرة، مرة "دقيقة أفكر".

${historyText}

# رسالة ${user?.name || 'المستخدم'} الآن
"${query}"

اكتب الآن. تخيّل أنك تكتب رسالة واتساب لشخص تعرفه — ليس تقريراً بنكياً، ليس إجابة رسمية.
إذا احتجت فكرتين منفصلتين، ضع [SPLIT] في سطر منفصل. لا تزد عن رسالتين.`;
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
                        temperature: 1.05,     // 🎲 إبداع أعلى = تنويع أقوى
                        maxOutputTokens: 3000, // أقصر مما قبل → ردود أقل حشواً
                        topP: 0.95,
                        topK: 60
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

// ============ استخراج الردود ============
function extractReplies(text, truncated = false) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    let clean = text.trim().replace(/^```(?:json|markdown)?\s*/i, '').replace(/```\s*$/, '');
    clean = clean.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
    
    if (clean.includes('[SPLIT]')) {
        const parts = clean.split('[SPLIT]').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) return parts;
    }
    
    if (truncated) clean += '\n\n_(وصلت للحد — تفضل بسؤال أدق)._';
    return [clean];
}

// ============ المسارات ============
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        behavior: 'Human-v3-MoodIntent-RepeatDetect',
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
