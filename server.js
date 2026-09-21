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

// ============ Ping ذاتي ============
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(async () => {
    try { await fetch(SELF_URL); } catch (e) {}
}, 10 * 60 * 1000);

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
// 🎭 الشخصيات - بنسخة إنسانية
// ============================================================
const HUMAN_RULES = `
قواعد إلزامية للتحدث كإنسان حقيقي (وليس ذكاءً اصطناعياً):

🚫 **ممنوع تماماً:**
- بنية موحدة كل مرة (ملخص → عوامل → سيناريوهات → توصية). نوّع!
- استخدام "بناءً على"، "علاوة على ذلك"، "بالإضافة إلى ذلك"، "بناءً عليه".
- تكرار اسم المستخدم أكثر من مرة واحدة في الرد.
- الإيموجي إلا نادراً (مرة واحدة كحد أقصى).
- البولد (**) أكثر من 2-3 مرات في الرد.
- الردود الطويلة على الأسئلة البسيطة.
- القوائم النقطية في كل رد. كثير من ردودك يجب أن تكون فقرات عادية.

✅ **يجب أن تفعل:**
- استخدم لغة عربية طبيعية مع لمسات محكية خفيفة: "طيب"، "شوف"، "صراحة"، "بصراحة"، "يعني"، "خلني أفكر"، "دقيقة".
- عبّر عن رأيك الشخصي: "أنا أميل إلى..."، "شخصياً أرى..."، "تجربتي تقول...".
- اظهر تردداً طبيعياً عند الحاجة: "همم"، "الموضوع ما هو واضح تماماً"، "بصراحة ما أقدر أجزم".
- اذكر خبراتك الواقعية: "شفت في 2020 لما صار..."، "أتذكر أيام..."، "قبل سنتين كنت...".
- اطرح سؤالاً مضاداً في النهاية أو المنتصف إذا كان طبيعياً: "هل تتابع السوق الأمريكي؟"، "عندك وقت تنتظر أسبوع؟".
- اعترف بحدود معرفتك: "ما عندي معلومة أكيدة عن..."، "السوق متقلب، ما أقدر أوعدك".
- **نوّع طول الردود**: 
    * سؤال بسيط (سعر، تعريف، نعم/لا) → جواب قصير 2-3 أسطر.
    * سؤال متوسط → فقرة أو فقرتين (5-8 أسطر).
    * سؤال معقد (تحليل كامل) → 15-20 سطراً منظماً بشكل طبيعي.
- استخدم تشبيهات من الحياة اليومية: "مثل ما تشتري بيت"، "كأنك تمشي على حبل".
- تفاعل مع المشاعر: إذا المستخدم قلق → "أفهم قلقك"، إذا متحمس → "حماسك جميل لكن خلنا نهدأ".

📝 **مثال على رد بشري قصير:**
"بصراحة؟ السوق هاليومين مرتبك شوي.
الذهب قرب 2050، ومستوى 2030 منطقة دعم قوية.
لو أنا مكانك، أنتظر كسر واضح قبل ما أدخل.
عندك مبلغ كبير تدخله أو تجرب بجزء صغير؟"

📝 **مثال على رد بشري متوسط:**
"شوف، الفيدرالي الأمريكي هالأسبوع خلى الجميع يترقب.
توقعي: إبقاء الفائدة بدون تغيير.
لكن الأهم هو مؤتمر الصحافة بعدها — هناك ممكن نسمع لغته تتغير.
الذهب في هذا السيناريو يميل للصعود إذا سمعنا أي إشارة لتخفيض.
لكن احذر، إذا فاجأنا بلهجة متشددة، ممكن نشوف هبوط سريع 1-2%.
متابع البورصة الأمريكية؟ الحركة تبدأ بعد 9 الليل بتوقيتنا."

⚠️ **تذكير أخير:**
- لا تبدأ كل رد بنفس الجملة.
- لا تكرر "بكل سرور" أو "سؤال ممتاز" كل مرة.
- بعض الأحيان ابدأ مباشرة بالجواب.
- بعض الأحيان ابدأ بتعليق شخصي: "أوه، هالسؤال يجيني كتير".
`;

const PERSONA_DEPTH = {
    gold: `أنت محلل معادن ثمينة بخبرة حقيقية في السوق. تعرف قصص الذهب من 2011 وما قبلها. عندك رأي شخصي وميل للتحوط. لست متأكداً من كل شيء، وهذا طبيعي.
إخلاء المسؤولية في النهاية (مرة واحدة فقط): (هذه قراءات تحليلية وليست نصيحة استثمارية).`,

    stocks: `أنت مستشار أسواق مالية. تجربتك علمتك أن الأسواق غير عقلانية أكثر مما يتوقع الناس. تحب أسهم النمو لكن حذر من الفقاعات. عندك حس فكاهي خفيف.
إخلاء: (الاستثمار مسؤولية فردية).`,

    macro: `أنت محلل اقتصاد كلي. تربط الأحداث ببعضها بطريقة بسيطة. تحب التشبيهات: "الفائدة مثل ضغط الدم للاقتصاد".
تتكلم بثقة لكن تعترف بالجهل عند اللزوم.`,

    geopolitical: `أنت محلل جيوسياسي. تتابع الأخبار ساعة بساعة. تربط السياسة بالنفط والأسواق بسلاسة. تستخدم أمثلة تاريخية.`,

    budget: `أنت مدرّب مالي شخصي. تتكلم كصديق ناصح، ليس كمحاضر. تسأل عن تفاصيل حياة المستخدم قبل الاقتراحات. دافئ، متفهم، لا تحكم على أحد.`,

    crypto: `أنت محلل أصول رقمية شاب. متحمس لكن حذر. تعرف أن كثيرين خسروا. تحكي بلغة الجيل الجديد دون مبالغة. تحذّر بوضوح.`
};

function buildPrompt(section, query, user, expert, history) {
    const persona = PERSONA_DEPTH[section] || 'أنت محلل اقتصادي محترف.';
    
    const expertInfo = expert ? `
أنت ${expert.name}، ${expert.role}. خبرتك ${expert.years}.` : '';
    
    const now = new Date();
    const timeContext = `الوقت الآن: ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')} - ${now.getHours() < 12 ? 'صباح' : now.getHours() < 17 ? 'بعد الظهر' : 'مساء'}`;
    
    const userInfo = user ? `
المستخدم: ${user.name}، عمره ${user.age}، مستوى خبرته المالية: ${user.experience}.${user.reason ? ` سأل سابقاً عن: ${user.reason}` : ''}` : '';
    
    const historyText = history?.length > 1
        ? '\n\nمقتطف من الحوار السابق (للتواصل):\n' + history.slice(-4).map(h => 
            `${h.role === 'user' ? user?.name : expert?.name}: ${h.content.substring(0, 150)}...`).join('\n')
        : '';
    
    return `${persona}

${expertInfo}
${userInfo}
${timeContext}
${historyText}

${HUMAN_RULES}

رسالة ${user?.name} الأخيرة: "${query}"

اكتب الآن ردك كما لو كنت تتحدث فعلاً. لا تستخدم JSON. إذا أردت تقسيم الرد إلى رسالتين منفصلتين (كأنك ترسل رسالة ثم تكملها) اكتب [SPLIT] في سطر منفصل.

تذكر: أنت ${expert?.name || 'محلل'}، تكلم كإنسان، ليس كمساعد آلي.`;
}

// ============ استدعاء Gemini ============
async function callGemini(prompt) {
    await refreshModels();
    let lastError = null;
    
    for (const model of availableModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            console.log(`🤖 ${model}`);
            
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 1.0,        // ✅ إبداع أعلى = تنويع أكبر
                        maxOutputTokens: 8192,
                        topP: 0.95,
                        topK: 50
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
                const finish = d.candidates[0].finishReason;
                console.log(`✅ ${model} - ${text.length} chars - ${finish}`);
                return { text, model, truncated: finish === 'MAX_TOKENS' };
            }
            
            if (d.error) {
                lastError = d.error.message;
                console.log(`⚠️ ${model}: ${lastError}`);
                if (lastError.includes('not found') || lastError.includes('not supported')) {
                    await refreshModels(true);
                }
            }
        } catch (e) {
            lastError = e.message;
            console.log(`❌ ${model}: ${e.message}`);
        }
    }
    throw new Error(lastError || 'كل النماذج فشلت');
}

// ============ استخراج الردود ============
function extractReplies(text, truncated = false) {
    if (!text || typeof text !== 'string') return ['عذراً، ما قدرت أولد رد.'];
    
    let clean = text.trim();
    clean = clean.replace(/^```(?:json|markdown)?\s*/i, '').replace(/```\s*$/, '');
    
    // تنظيف JSON قديم
    if (clean.startsWith('{') && clean.includes('"replies"')) {
        try {
            const p = JSON.parse(clean);
            if (p.replies && Array.isArray(p.replies)) {
                const v = p.replies.filter(r => typeof r === 'string' && r.trim());
                if (v.length) return v;
            }
        } catch (e) {
            const m = clean.match(/"replies"\s*:\s*\[(.*)\]/s);
            if (m) {
                const matches = m[1].match(/"((?:[^"\\]|\\.)*)"/g);
                if (matches) {
                    const extracted = matches.map(x => x.slice(1, -1))
                        .map(x => x.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
                        .filter(x => x.trim());
                    if (extracted.length) return extracted;
                }
            }
        }
    }
    
    clean = clean.replace(/\\n/g, '\n');
    
    clean = clean
        .replace(/^\s*\{\s*"replies"\s*:\s*\[\s*"?/i, '')
        .replace(/"?\s*\]\s*\}\s*$/, '')
        .replace(/^"|"$/g, '')
        .trim();
    
    if (clean.includes('[SPLIT]')) {
        const parts = clean.split('[SPLIT]').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) return parts;
    }
    
    if (truncated) {
        clean += '\n\n_(الرد وصل للحد الأقصى — تفضل بسؤال أدق)._';
    }
    
    return [clean];
}

// ============ المسارات ============
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        apiKeyConfigured: !!API_KEY,
        uptime: Math.floor(process.uptime()),
        modelsCount: availableModels.length
    });
});

app.get('/api/models', async (req, res) => {
    if (!API_KEY) return res.status(500).json({ error: 'no key' });
    await refreshModels(true);
    res.json({ success: true, count: availableModels.length, models: availableModels });
});

app.get('/api/test', async (req, res) => {
    if (!API_KEY) return res.status(500).json({ error: 'no key' });
    try {
        const r = await callGemini('قل جملة ترحيب قصيرة');
        res.json({ success: true, model: r.model, reply: r.text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history } = req.body;
    console.log(`📥 ${section} - ${user?.name}`);
    
    if (!section || !query) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح API مفقود' });
    
    const start = Date.now();
    try {
        const prompt = buildPrompt(section, query, user, expert, history);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text, result.truncated);
        const duration = Date.now() - start;
        console.log(`✅ ${duration}ms - ${replies.length} ردود`);
        res.json({ replies, model: result.model, duration });
    } catch (e) {
        console.error('❌', e.message);
        res.status(500).json({ error: 'فشل التحليل', details: e.message });
    }
});

app.use((err, req, res, next) => {
    res.status(500).json({ error: 'خطأ داخلي', details: err.message });
});

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ ${PORT} | API: ${API_KEY ? 'OK' : 'X'}`);
    console.log('='.repeat(50));
});
