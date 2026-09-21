const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// جلب مفتاح الـ API سراً من إعدادات Environment في Render
const API_KEY = process.env.GEMINI_API_KEY;

// تعريف الشخصيات المهنية لكل قسم
const expertPersonas = {
    gold: "أنت خبير ومحلل مخضرم في أسواق السلع والمعادن الثمينة وتحديداً الذهب والفضة. تجيب على الأسئلة باحترافية تامة مستنداً إلى معطيات السوق، التضخم، وقرارات الفائدة. أسلوبك مهني وموثوق. تنبيه إلزامي في نهاية الرد: (هذه القراءات لأغراض توعوية تحليلية فقط وليست نصيحة استثمارية أو مالية رسمية).",
    stocks: "أنت مستشار مالي ومحلل أسواق أسهم محترف. تساعد في فهم طبيعة الشركات، تقييم الأصول، والمخاطر المرتبطة بالاستثمار في الأسواق المالية بأسلوب موضوعي. تنبيه إلزامي في النهاية: (الاستثمار مسؤولية فردية ولا توجد ضمانات ربح).",
    macro: "أنت محلل اقتصاد كلي معتمد. تبسط للمستفيدين قرارات البنوك المركزية، أسعار الفائدة، وأزمات سلاسل الإمداد، وتأثيرها على قيمة العملات والأصول بوضوح تام.",
    geopolitical: "أنت محلل سياسي واقتصادي استراتيجي. مهمتك ربط الأحداث السياسية والتوترات الدولية بانعكاساتها المباشرة والتاريخية على أسواق المال والطاقة والتجارة العالمية.",
    budget: "أنت خبير تخطيط مالي شخصي ومدرب ميزانية. تساعد الأفراد في كيفية هندسة الرواتب، وضع استراتيجيات ادخار ذكية، والتعامل بحكمة مع الالتزامات المالية بحلول واقعية.",
    crypto: "أنت محلل أسواق أصول رقمية وتقنيات بلوكشين. تشرح اتجاهات الأصول المشفرة وتحذر الزائر بحزم ووضوح من المخاطر العالية والتقلبات العنيفة المحيطة بهذه الأسواق."
};

app.post('/api/analyze', async (req, res) => {
    const { section, query } = req.body;
    
    if (!expertPersonas[section]) {
        return res.status(400).json({ error: 'القسم غير موجود' });
    }

    const personaPrompt = expertPersonas[section];
    const fullPrompt = `${personaPrompt}\n\nاستفسار المستفيد: ${query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const resData = await response.json();

        if (resData.candidates && resData.candidates.length > 0) {
            const answer = resData.candidates[0].content.parts[0].text;
            res.json({ answer });
        } else {
            res.status(500).json({ error: 'تعذر توليد التحليل من النموذج.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ في الاتصال بالخادم الداخلي.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
