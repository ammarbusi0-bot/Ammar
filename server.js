const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// جلب مفتاح الـ API سراً من إعدادات Environment في Render
const API_KEY = process.env.GEMINI_API_KEY;

// اسم النموذج - محدّث
const GEMINI_MODEL = 'gemini-2.0-flash';

// التحقق من المفتاح عند بدء التشغيل
if (!API_KEY) {
    console.error('❌ خطأ حرج: متغير البيئة GEMINI_API_KEY غير موجود!');
    console.error('👉 أضفه من: Render Dashboard → Environment → Add Environment Variable');
} else {
    console.log('✅ تم العثور على مفتاح API بنجاح');
}

// تعريف الشخصيات المهنية لكل قسم
const expertPersonas = {
    gold: "أنت خبير ومحلل مخضرم في أسواق السلع والمعادن الثمينة وتحديداً الذهب والفضة. تجيب على الأسئلة باحترافية تامة مستنداً إلى معطيات السوق، التضخم، وقرارات الفائدة. أسلوبك مهني وموثوق. تنبيه إلزامي في نهاية الرد: (هذه القراءات لأغراض توعوية تحليلية فقط وليست نصيحة استثمارية أو مالية رسمية).",
    stocks: "أنت مستشار مالي ومحلل أسواق أسهم محترف. تساعد في فهم طبيعة الشركات، تقييم الأصول، والمخاطر المرتبطة بالاستثمار في الأسواق المالية بأسلوب موضوعي. تنبيه إلزامي في النهاية: (الاستثمار مسؤولية فردية ولا توجد ضمانات ربح).",
    macro: "أنت محلل اقتصاد كلي معتمد. تبسط للمستفيدين قرارات البنوك المركزية، أسعار الفائدة، وأزمات سلاسل الإمداد، وتأثيرها على قيمة العملات والأصول بوضوح تام.",
    geopolitical: "أنت محلل سياسي واقتصادي استراتيجي. مهمتك ربط الأحداث السياسية والتوترات الدولية بانعكاساتها المباشرة والتاريخية على أسواق المال والطاقة والتجارة العالمية.",
    budget: "أنت خبير تخطيط مالي شخصي ومدرب ميزانية. تساعد الأفراد في كيفية هندسة الرواتب، وضع استراتيجيات ادخار ذكية، والتعامل بحكمة مع الالتزامات المالية بحلول واقعية.",
    crypto: "أنت محلل أسواق أصول رقمية وتقنيات بلوكشين. تشرح اتجاهات الأصول المشفرة وتحذر الزائر بحزم ووضوح من المخاطر العالية والتقلبات العنيفة المحيطة بهذه الأسواق."
};

// ✅ مسار اختبار سريع للتأكد أن السيرفر يعمل والمفتاح مضبوط
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'السيرفر يعمل بنجاح',
        apiKeyConfigured: !!API_KEY,
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString()
    });
});

// ✅ مسار اختبار API مباشر (يتجاوز الواجهة)
app.get('/api/test', async (req, res) => {
    if (!API_KEY) {
        return res.status(500).json({
            error: 'مفتاح API غير مضبوط',
            solution: 'أضف GEMINI_API_KEY في Render Environment'
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'قل مرحبا فقط' }] }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            res.json({
                success: true,
                message: 'الاتصال بـ Gemini ناجح ✅',
                reply: data.candidates[0].content.parts[0].text
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'فشل الاتصال بـ Gemini',
                details: data.error || data
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'خطأ في الاتصال',
            details: error.message
        });
    }
});

app.post('/api/analyze', async (req, res) => {
    const { section, query } = req.body;

    console.log(`📥 طلب جديد - القسم: ${section}`);
    console.log(`📝 الاستفسار: ${query?.substring(0, 100)}...`);

    // التحقق من المدخلات
    if (!section || !query) {
        return res.status(400).json({
            error: 'بيانات ناقصة',
            details: 'يجب إرسال section و query'
        });
    }

    if (!expertPersonas[section]) {
        return res.status(400).json({
            error: 'القسم غير موجود',
            details: `القسم المطلوب: ${section}`
        });
    }

    // التحقق من المفتاح
    if (!API_KEY) {
        return res.status(500).json({
            error: 'مفتاح API غير مضبوط على السيرفر',
            details: 'أضف GEMINI_API_KEY في Render Environment ثم أعد النشر'
        });
    }

    const personaPrompt = expertPersonas[section];
    const fullPrompt = `${personaPrompt}\n\nاستفسار المستفيد: ${query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const resData = await response.json();

        // ✅ طباعة الرد الكامل في Logs
        console.log('📤 حالة HTTP من Google:', response.status);
        console.log('📤 رد Google الكامل:', JSON.stringify(resData, null, 2));

        // ✅ نجاح
        if (resData.candidates && resData.candidates.length > 0) {
            const answer = resData.candidates[0].content.parts[0].text;
            return res.json({ answer });
        }

        // ✅ استخراج الخطأ الحقيقي من Google
        let errorMessage = 'فشل توليد التحليل';
        let errorDetails = 'لم يُرجع النموذج أي رد';

        if (resData.error) {
            errorMessage = resData.error.message || errorMessage;
            errorDetails = `كود: ${resData.error.code || 'N/A'} | حالة: ${resData.error.status || 'N/A'}`;
        } else if (resData.promptFeedback) {
            errorDetails = JSON.stringify(resData.promptFeedback);
        }

        console.error('❌ خطأ من Gemini:', errorMessage);

        return res.status(500).json({
            error: errorMessage,
            details: errorDetails,
            fullResponse: resData
        });

    } catch (error) {
        console.error('❌ خطأ في الاتصال بـ Gemini:', error.message);

        return res.status(500).json({
            error: 'فشل الاتصال بخدمة Gemini',
            details: error.message
        });
    }
});

// معالج للأخطاء غير المتوقعة
app.use((err, req, res, next) => {
    console.error('❌ خطأ غير متوقع:', err);
    res.status(500).json({
        error: 'خطأ داخلي في السيرفر',
        details: err.message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ السيرفر يعمل على المنفذ: ${PORT}`);
    console.log(`🔑 مفتاح API مضبوط: ${API_KEY ? 'نعم ✅' : 'لا ❌'}`);
    console.log(`🤖 النموذج المستخدم: ${GEMINI_MODEL}`);
    console.log('='.repeat(50));
});
