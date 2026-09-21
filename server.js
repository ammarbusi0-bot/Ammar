const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

// ✅ قائمة نماذج احتياطية
const MODELS_FALLBACK = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY غير موجود!');
}

// ============ Ping ذاتي ============
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

setInterval(async () => {
    try {
        await fetch(SELF_URL);
        console.log(`💓 Ping ذاتي - ${new Date().toISOString()}`);
    } catch (e) {
        console.log('⚠️ فشل Ping:', e.message);
    }
}, 10 * 60 * 1000);

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
    
    stocks: `أنت مستشار أسواق مالية. منهجيتك:
- افتح بجملة إنسانية
- قيّم القطاع/الشركة
- اذكر المخاطر
- 3 سيناريوهات
- توصية
- إخلاء: (الاستثمار مسؤولية فردية).`,
    
    macro: `أنت محلل اقتصاد كلي. اشرح القرارات وتأثيرها على 3 أصول، مع توقعات.`,
    geopolitical: `أنت محلل جيوسياسي. اربط الأحداث بأسواق الطاقة والتجارة.`,
    budget: `أنت مدرّب مالي شخصي. اقترح 3 خطوات عملية دافئة ومشجعة.`,
    crypto: `أنت محلل أصول رقمية. اذكر المخاطر العالية بوضوح مع سيناريوهات.`
};

function buildPrompt(section, query, user, expert, history) {
    const persona = PERSONA_DEPTH[section] || 'أنت محلل اقتصادي محترف.';
    
    const expertInfo = expert ? `
شخصيتك: ${expert.name} - ${expert.role} - ${expert.years} - ${expert.style}` : '';
    
    const userInfo = user ? `
المستخدم: ${user.name} - ${user.age} سنة - ${user.experience}` : '';
    
    const historyText = history?.length 
        ? '\nسياق سابق:\n' + history.map(h => 
            `${h.role === 'user' ? user?.name : expert?.name}: ${h.content}`).join('\n')
        : '';
    
    return `${persona}
${expertInfo}
${userInfo}

قواعد:
1. تحدث كإنسان حقيقي بعبارات طبيعية.
2. نادي المستخدم باسمه "${user?.name || ''}" مرة أو مرتين.
3. راعِ عمره ومستوى خبرته.
${historyText}

رسالة ${user?.name}:
${query}

أجب بـ JSON فقط:
{"replies": ["الرد"]}

إذا أردت التقسيم لرسالتين، ضع نصين في المصفوفة. لا تزد عن 2-3.`;
}

// ============ استدعاء Gemini مع Fallback ============
async function callGemini(prompt) {
    let lastError = null;
    
    for (const model of MODELS_FALLBACK) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            
            console.log(`🤖 محاولة: ${model}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.85,
                        maxOutputTokens: 2048,
                        responseMimeType: 'application/json'
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
            }
        } catch (e) {
            lastError = e.message;
            console.log(`❌ ${model}: ${e.message}`);
        }
    }
    
    throw new Error(lastError || 'كل النماذج فشلت');
}

function parseReplies(text) {
    try {
        let clean = text.trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/```\s*$/, '');
        
        const parsed = JSON.parse(clean);
        
        if (parsed.replies && Array.isArray(parsed.replies)) {
            const valid = parsed.replies.filter(r => typeof r === 'string' && r.trim());
            if (valid.length) return valid;
        }
    } catch (e) {
        console.log('⚠️ فشل parse JSON');
    }
    return [text];
}

// ============ المسارات ============
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'السيرفر يعمل',
        apiKeyConfigured: !!API_KEY,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', async (req, res) => {
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });
    
    try {
        const result = await callGemini('قل مرحبا بكلمة واحدة');
        res.json({ success: true, model: result.model, reply: result.text.substring(0, 100) });
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
        const replies = parseReplies(result.text);
        const duration = Date.now() - start;
        
        console.log(`✅ ${duration}ms - ${replies.length} ردود`);
        
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
    console.log(`💓 Ping ذاتي: نشط`);
    console.log('='.repeat(50));
});
