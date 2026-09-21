const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

// ✅ قائمة أولية (تُستخدم قبل الاكتشاف الديناميكي)
const INITIAL_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest'
];

// ✅ مخزون النماذج المكتشفة ديناميكياً
let availableModels = [...INITIAL_MODELS];
let modelsLastFetched = 0;

if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY غير موجود!');
}

// ============ Ping ذاتي ============
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

setInterval(async () => {
    try {
        await fetch(SELF_URL);
        console.log(`💓 Ping ذاتي`);
    } catch (e) {}
}, 10 * 60 * 1000);

// ============ 🎯 اكتشاف النماذج ديناميكياً ============
async function fetchAvailableModels() {
    if (!API_KEY) return [];
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.models) {
            console.log('⚠️ لم تُرجع Google أي نماذج');
            return [];
        }
        
        // فلترة النماذج التي تدعم generateContent
        const models = data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(name => 
                // نستبعد الإصدارات المتخصصة
                !name.includes('embedding') &&
                !name.includes('aqa') &&
                !name.includes('imagen') &&
                !name.includes('veo') &&
                !name.includes('gemma')
            );
        
        // ترتيب ذكي: flash أولاً ثم pro ثم الباقي
        models.sort((a, b) => {
            const score = (m) => {
                let s = 0;
                if (m.includes('2.5-flash')) s -= 100;
                if (m.includes('2.0-flash')) s -= 90;
                if (m.includes('2.5-pro')) s -= 80;
                if (m.includes('flash-latest')) s -= 70;
                if (m.includes('pro-latest')) s -= 60;
                if (m.includes('flash')) s -= 30;
                if (m.includes('pro')) s -= 20;
                if (m.includes('preview')) s += 50; // تجريبية = أقل أولوية
                if (m.includes('exp')) s += 50;
                return s;
            };
            return score(a) - score(b);
        });
        
        console.log(`🔍 تم اكتشاف ${models.length} نموذج:`);
        models.slice(0, 5).forEach(m => console.log(`   • ${m}`));
        
        return models;
    } catch (e) {
        console.log('❌ فشل اكتشاف النماذج:', e.message);
        return [];
    }
}

// تحديث النماذج كل ساعة
async function refreshModels(force = false) {
    const now = Date.now();
    if (!force && now - modelsLastFetched < 60 * 60 * 1000) return; // كل ساعة
    
    const models = await fetchAvailableModels();
    if (models.length > 0) {
        availableModels = models;
        modelsLastFetched = now;
        console.log(`✅ النماذج المحدثة: ${availableModels.length} نموذج`);
    }
}

// اكتشاف عند بدء التشغيل
refreshModels(true);

// ============ الشخصيات ============
const PERSONA_DEPTH = {
    gold: `أنت محلل معادن ثمينة. منهجيتك:
- ابدأ بجملة إنسانية قصيرة
- ملخص تنفيذي
- 3 عوامل مؤثرة
- سيناريوهات (صعودي/محايد/هبوطي) مع نِسب
- مخاطر خفية
- توصية عملية
- إخلاء المسؤولية: (هذه قراءات تحليلية لأغراض توعوية وليست نصيحة استثمارية رسمية).`,
    
    stocks: `أنت مستشار أسواق مالية. افتح بجملة إنسانية، قيّم القطاع/الشركة، اذكر المخاطر، 3 سيناريوهات، توصية. إخلاء: (الاستثمار مسؤولية فردية).`,
    macro: `أنت محلل اقتصاد كلي. اشرح القرارات وتأثيرها على 3 أصول مع توقعات.`,
    geopolitical: `أنت محلل جيوسياسي. اربط الأحداث بأسواق الطاقة والتجارة.`,
    budget: `أنت مدرّب مالي شخصي. اقترح 3 خطوات عملية دافئة ومشجعة.`,
    crypto: `أنت محلل أصول رقمية. اذكر المخاطر العالية بوضوح مع سيناريوهات.`
};

function buildPrompt(section, query, user, expert, history) {
    const persona = PERSONA_DEPTH[section] || 'أنت محلل اقتصادي محترف.';
    
    const expertInfo = expert ? `\nشخصيتك: ${expert.name} - ${expert.role} - ${expert.years}` : '';
    const userInfo = user ? `\nالمستخدم: ${user.name} - ${user.age} سنة - ${user.experience}` : '';
    
    const historyText = history?.length 
        ? '\nسياق سابق:\n' + history.map(h => 
            `${h.role === 'user' ? user?.name : expert?.name}: ${h.content}`).join('\n')
        : '';
    
    return `${persona}
${expertInfo}
${userInfo}

قواعد مهمة:
1. تحدث كإنسان حقيقي بعبارات طبيعية.
2. نادي المستخدم باسمه "${user?.name || ''}" مرة أو مرتين فقط.
3. راعِ عمره ومستوى خبرته.

${historyText}

رسالة ${user?.name}:
${query}

⚠️ أرجع ردك بصيغة JSON فقط:
{"replies": ["النص الكامل للرد هنا"]}

لا تكتب أي شيء خارج JSON. إذا أردت التقسيم لرسالتين، ضع نصين في المصفوفة.`;
}

// ============ استدعاء Gemini مع Fallback ديناميكي ============
async function callGemini(prompt) {
    // 🎯 تحديث النماذج إن مرت ساعة
    await refreshModels();
    
    let lastError = null;
    const tried = [];
    
    for (const model of availableModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            
            console.log(`🤖 محاولة: ${model}`);
            tried.push(model);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.85,
                        maxOutputTokens: 2048
                    }
                })
            });
            
            const resData = await response.json();
            
            if (resData.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.log(`✅ نجح: ${model}`);
                return {
                    text: resData.candidates[0].content.parts[0].text,
                    model
                };
            }
            
            if (resData.error) {
                lastError = resData.error.message;
                console.log(`⚠️ ${model}: ${lastError}`);
                
                // إذا كان الخطأ "نموذج غير موجود" → حدّث القائمة
                if (lastError.includes('not found') || lastError.includes('not supported')) {
                    console.log('🔄 تحديث النماذج بسبب خطأ...');
                    await refreshModels(true);
                }
            }
        } catch (e) {
            lastError = e.message;
            console.log(`❌ ${model}: ${e.message}`);
        }
    }
    
    throw new Error(`جربنا ${tried.length} نموذج، كلها فشلت. آخر خطأ: ${lastError}`);
}

// ============ استخراج نصوص نظيفة ============
function extractReplies(text) {
    if (!text || typeof text !== 'string') return ['عذراً، لم أستطع توليد رد.'];
    
    let clean = text.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    
    try {
        const parsed = JSON.parse(clean);
        
        if (parsed.replies && Array.isArray(parsed.replies)) {
            const valid = parsed.replies
                .filter(r => typeof r === 'string' && r.trim())
                .map(r => r.trim());
            if (valid.length) return valid;
        }
        
        if (parsed.answer && typeof parsed.answer === 'string') {
            return [parsed.answer.trim()];
        }
        
        if (Array.isArray(parsed)) {
            const valid = parsed.filter(r => typeof r === 'string' && r.trim());
            if (valid.length) return valid;
        }
    } catch (e) {}
    
    // استخراج يدوي
    const repliesMatch = clean.match(/"replies"\s*:\s*\[(.*)\]/s);
    if (repliesMatch) {
        const matches = repliesMatch[1].match(/"((?:[^"\\]|\\.)*)"/g);
        if (matches && matches.length) {
            const extracted = matches
                .map(m => m.slice(1, -1))
                .map(m => m.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
                .filter(m => m.trim());
            if (extracted.length) return extracted;
        }
    }
    
    // تنظيف أخير
    clean = clean
        .replace(/^\s*\{\s*"replies"\s*:\s*\[\s*"?/i, '')
        .replace(/"?\s*\]\s*\}\s*$/, '')
        .replace(/^"|"$/g, '')
        .trim();
    
    return [clean];
}

// ============ المسارات ============
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        apiKeyConfigured: !!API_KEY,
        uptime: Math.floor(process.uptime()),
        modelsCount: availableModels.length,
        topModels: availableModels.slice(0, 5)
    });
});

// ✅ مسار يعرض النماذج المتاحة فعلاً
app.get('/api/models', async (req, res) => {
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });
    
    await refreshModels(true);
    
    res.json({
        success: true,
        count: availableModels.length,
        models: availableModels,
        lastFetched: new Date(modelsLastFetched).toISOString()
    });
});

// ✅ مسار اختبار يعرض أي نموذج نجح
app.get('/api/test', async (req, res) => {
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });
    
    try {
        const result = await callGemini('قل "مرحبا" فقط');
        res.json({
            success: true,
            model: result.model,
            reply: result.text.substring(0, 200)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/analyze', async (req, res) => {
    const { section, query, user, expert, history } = req.body;
    
    console.log(`📥 ${section} - ${user?.name}`);
    
    if (!section || !query) {
        return res.status(400).json({ error: 'بيانات ناقصة' });
    }
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'مفتاح API غير مضبوط' });
    }
    
    const start = Date.now();
    
    try {
        const prompt = buildPrompt(section, query, user, expert, history);
        const result = await callGemini(prompt);
        const replies = extractReplies(result.text);
        const duration = Date.now() - start;
        
        console.log(`✅ ${duration}ms - ${replies.length} ردود - ${result.model}`);
        
        res.json({
            replies,
            model: result.model,
            duration
        });
    } catch (error) {
        console.error('❌', error.message);
        res.status(500).json({
            error: 'فشل التحليل',
            details: error.message
        });
    }
});

app.use((err, req, res, next) => {
    console.error('❌', err);
    res.status(500).json({ error: 'خطأ داخلي', details: err.message });
});

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ المنفذ: ${PORT}`);
    console.log(`🔑 API: ${API_KEY ? 'مضبوط ✅' : 'مفقود ❌'}`);
    console.log('='.repeat(50));
});
