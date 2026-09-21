<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مركز التحليل المالي المتقدم</title>

<script>
(function prewarm() {
    const wake = () => fetch('https://ammar-e0tp.onrender.com/', { cache: 'no-store' })
        .then(r => r.json()).then(() => {
            window.SERVER_READY = true;
            document.dispatchEvent(new Event('serverReady'));
        }).catch(() => {});
    wake();
    setTimeout(wake, 3000);
    setTimeout(wake, 8000);
})();
</script>

<style>
    :root {
        --primary: #0f1729;
        --secondary: #1e3a5f;
        --accent: #d4af37;
        --accent-light: #f4d47a;
        --bg: #f0f2f7;
        --card: #ffffff;
        --text: #1a202c;
        --muted: #64748b;
        --user-bubble: linear-gradient(135deg, #dcf8c6, #c9ebaa);
        --expert-bubble: #ffffff;
        --online: #22c55e;
        --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
        --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
        --shadow-lg: 0 10px 40px rgba(0,0,0,0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
        font-family: 'Segoe UI', 'Tahoma', system-ui, -apple-system, sans-serif; 
        background: var(--bg); 
        color: var(--text); 
        min-height: 100vh;
        line-height: 1.6;
    }
    
    /* ============ Splash ============ */
    #splash { 
        position: fixed; inset: 0; 
        background: linear-gradient(135deg, #0f1729 0%, #1e3a5f 100%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white;
        transition: opacity 0.7s ease;
    }
    #splash.fade { opacity: 0; pointer-events: none; }
    
    .splash-logo {
        width: 100px; height: 100px; border-radius: 50%;
        background: linear-gradient(135deg, var(--accent), var(--accent-light));
        display: flex; align-items: center; justify-content: center;
        font-size: 46px; margin-bottom: 30px;
        animation: pulse 2s infinite;
        box-shadow: 0 0 60px rgba(212, 175, 55, 0.5);
    }
    @keyframes pulse { 
        0%, 100% { transform: scale(1); box-shadow: 0 0 60px rgba(212, 175, 55, 0.5); } 
        50% { transform: scale(1.08); box-shadow: 0 0 80px rgba(212, 175, 55, 0.8); } 
    }
    .splash-title { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
    .splash-sub { color: #94a3b8; font-size: 14px; margin-bottom: 40px; }
    .splash-progress { width: 300px; height: 5px; background: rgba(255,255,255,0.12); border-radius: 3px; overflow: hidden; margin-bottom: 20px; }
    .splash-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--accent), var(--accent-light)); border-radius: 3px; transition: width 0.5s ease; }
    .splash-msg { color: var(--accent-light); font-size: 14px; min-height: 22px; }
    
    /* ============ Header ============ */
    header { 
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white; padding: 18px 20px; text-align: center;
        border-bottom: 3px solid var(--accent);
        box-shadow: var(--shadow-md);
    }
    header h1 { font-size: 22px; margin: 0; }
    header p { font-size: 13px; color: #94a3b8; margin: 4px 0 0; }
    
    /* ============ User bar ============ */
    .user-bar { 
        background: rgba(15, 23, 41, 0.95); backdrop-filter: blur(10px);
        color: white; padding: 10px 20px; 
        display: none; justify-content: space-between; align-items: center;
        font-size: 14px; box-shadow: var(--shadow-sm);
    }
    .user-bar.show { display: flex; }
    .user-info { display: flex; align-items: center; gap: 10px; }
    .avatar-sm {
        width: 34px; height: 34px; border-radius: 50%;
        background: linear-gradient(135deg, var(--accent), var(--accent-light));
        color: var(--primary); display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 14px;
    }
    .user-bar button {
        background: transparent; color: #94a3b8;
        border: 1px solid #334155; padding: 5px 14px; border-radius: 6px;
        cursor: pointer; font-size: 12px; transition: all 0.2s;
    }
    .user-bar button:hover { color: white; border-color: var(--accent); }
    
    .container { max-width: 1050px; margin: 30px auto; padding: 0 20px; }
    
    /* ============ Welcome ============ */
    #welcome {
        background: var(--card); border-radius: 16px; padding: 45px;
        box-shadow: var(--shadow-lg); max-width: 520px; margin: 40px auto;
        text-align: center; display: none;
    }
    #welcome.show { display: block; animation: slideUp 0.5s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    #welcome h2 { color: var(--primary); font-size: 26px; margin-bottom: 8px; }
    #welcome .sub { color: var(--muted); font-size: 14px; margin-bottom: 28px; }
    
    .form-group { text-align: right; margin-bottom: 18px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: var(--primary); font-size: 14px; }
    .form-group input, .form-group select, .form-group textarea {
        width: 100%; padding: 12px 14px; border: 1.5px solid #e2e8f0;
        border-radius: 10px; font-size: 14px; font-family: inherit;
        transition: border 0.2s, box-shadow 0.2s;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
        outline: none; border-color: var(--secondary);
        box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1);
    }
    .form-group textarea { min-height: 80px; resize: vertical; }
    
    .btn-primary {
        width: 100%; padding: 14px; border: none; border-radius: 10px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white; font-size: 16px; font-weight: 700; cursor: pointer;
        transition: transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(15, 23, 41, 0.2);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15, 23, 41, 0.3); }
    
    /* ============ Sections ============ */
    #home { display: none; }
    #home.show { display: block; }
    #home h2 { text-align: center; margin-bottom: 30px; color: var(--primary); font-size: 22px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card {
        background: var(--card); border-radius: 14px; padding: 22px;
        box-shadow: var(--shadow-sm); cursor: pointer;
        border-top: 4px solid var(--secondary);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card:hover {
        transform: translateY(-6px);
        box-shadow: var(--shadow-lg);
        border-color: var(--accent);
    }
    .card h3 { color: var(--primary); margin-bottom: 8px; font-size: 17px; }
    .card p { color: var(--muted); font-size: 13.5px; line-height: 1.6; }
    
    /* ============ Chat ============ */
    #chat { 
        display: none; max-width: 800px; margin: 20px auto;
        background: #eae6df; border-radius: 16px;
        box-shadow: var(--shadow-lg); overflow: hidden;
    }
    #chat.show { display: block; }
    
    .chat-header {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white; padding: 14px 20px;
        display: flex; align-items: center; gap: 14px;
    }
    .expert-avatar {
        width: 48px; height: 48px; border-radius: 50%;
        background: linear-gradient(135deg, var(--accent), var(--accent-light));
        color: var(--primary); display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 20px; position: relative;
    }
    .expert-avatar::after {
        content: ''; position: absolute; bottom: 1px; right: 1px;
        width: 12px; height: 12px; background: var(--online);
        border: 2.5px solid var(--primary); border-radius: 50%;
        animation: onlinePulse 2s infinite;
    }
    @keyframes onlinePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
    
    .expert-info h3 { font-size: 16px; font-weight: 700; }
    .expert-info p { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    
    .btn-back {
        margin-left: auto; background: rgba(255,255,255,0.1);
        color: white; border: 1px solid rgba(255,255,255,0.2);
        padding: 7px 14px; border-radius: 8px; cursor: pointer;
        font-size: 12px; transition: background 0.2s;
    }
    .btn-back:hover { background: rgba(255,255,255,0.2); }
    
    .progress-bar { height: 3px; background: rgba(0,0,0,0.06); overflow: hidden; display: none; }
    .progress-bar.show { display: block; }
    .progress-fill {
        height: 100%; width: 0%; transition: width 0.5s ease;
        background: linear-gradient(90deg, var(--accent), var(--accent-light), var(--accent));
        background-size: 200% 100%; animation: shimmer 2s linear infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    
    #messages {
        padding: 24px 20px; min-height: 380px; max-height: 520px;
        overflow-y: auto; background: #efeae2;
        background-image: 
            radial-gradient(circle at 20% 30%, rgba(212,175,55,0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(30,58,95,0.03) 0%, transparent 50%);
        scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
    
    .bubble-wrap { display: flex; margin-bottom: 14px; animation: msgIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes msgIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    
    .bubble-wrap.user { justify-content: flex-start; }
    .bubble-wrap.expert { justify-content: flex-end; }
    
    .bubble {
        max-width: 80%; padding: 12px 16px; border-radius: 16px;
        font-size: 14.5px; line-height: 1.75; word-wrap: break-word;
        box-shadow: var(--shadow-sm); position: relative;
    }
    .bubble-wrap.user .bubble {
        background: var(--user-bubble);
        border-top-right-radius: 4px;
    }
    .bubble-wrap.expert .bubble {
        background: var(--expert-bubble);
        border-top-left-radius: 4px;
    }
    
    .sender { font-size: 11.5px; font-weight: 700; color: var(--secondary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .sender::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
    
    .bubble-content { white-space: pre-wrap; }
    .bubble-content strong { color: var(--primary); font-weight: 700; }
    
    .time { font-size: 10px; color: var(--muted); margin-top: 6px; text-align: left; direction: ltr; }
    
    /* ============ Typing ============ */
    .typing { display: inline-flex; gap: 5px; padding: 6px 4px; }
    .typing span {
        width: 8px; height: 8px; background: var(--muted);
        border-radius: 50%; animation: dotTyping 1.4s infinite;
    }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dotTyping { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
    
    /* ============ Waiting bubble ============ */
    .waiting-bubble {
        background: linear-gradient(135deg, #fffbeb, #fef3c7) !important;
        border-right: 4px solid var(--accent);
    }
    .waiting-steps { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
    .wstep {
        display: flex; align-items: center; gap: 8px;
        font-size: 12.5px; color: #78350f; opacity: 0.35;
        transition: opacity 0.4s, color 0.3s;
    }
    .wstep.active { opacity: 1; color: #92400e; font-weight: 700; }
    .wstep.done { opacity: 0.85; color: #166534; }
    
    /* ============ Suggestions ============ */
    .suggestions {
        display: flex; flex-wrap: wrap; gap: 8px;
        padding: 12px 20px; background: rgba(255,255,255,0.6);
        border-top: 1px solid rgba(0,0,0,0.05);
    }
    .chip {
        background: white; border: 1.5px solid var(--secondary);
        color: var(--secondary); padding: 7px 15px; border-radius: 20px;
        font-size: 12.5px; cursor: pointer; font-weight: 600;
        transition: all 0.2s;
    }
    .chip:hover { background: var(--secondary); color: white; transform: translateY(-1px); }
    
    /* ============ Input area ============ */
    .input-area {
        background: white; padding: 14px 16px;
        display: flex; gap: 12px; align-items: flex-end;
        border-top: 1px solid rgba(0,0,0,0.06);
        box-shadow: 0 -2px 10px rgba(0,0,0,0.03);
    }
    .input-area textarea {
        flex: 1; padding: 11px 16px; border: 1.5px solid #e2e8f0;
        border-radius: 22px; resize: none; min-height: 44px; max-height: 120px;
        font-family: inherit; font-size: 14px; outline: none;
        transition: border 0.2s, box-shadow 0.2s;
    }
    .input-area textarea:focus { border-color: var(--secondary); box-shadow: 0 0 0 3px rgba(30,58,95,0.08); }
    .send-btn {
        width: 46px; height: 46px; border-radius: 50%; border: none;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white; font-size: 18px; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(15,23,41,0.25);
    }
    .send-btn:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 6px 18px rgba(15,23,41,0.35); }
    .send-btn:disabled { background: #cbd5e1; cursor: not-allowed; box-shadow: none; }
    
    .error-bubble {
        background: linear-gradient(135deg, #fee2e2, #fecaca) !important;
        border-right: 4px solid #dc2626; color: #991b1b;
    }
    
    @media (max-width: 600px) {
        .container { padding: 0 12px; }
        #welcome { padding: 30px 24px; }
        .bubble { max-width: 88%; font-size: 14px; }
        header h1 { font-size: 18px; }
    }
</style>
</head>
<body>

<div id="splash">
    <div class="splash-logo">📊</div>
    <div class="splash-title">مركز التحليل المالي المتقدم</div>
    <div class="splash-sub">فريق من المحللين المتخصصين في خدمتك</div>
    <div class="splash-progress"><div class="splash-fill" id="splashFill"></div></div>
    <div class="splash-msg" id="splashMsg">جاري تجهيز بيئة العمل...</div>
</div>

<header>
    <h1>مركز التحليل المالي والاقتصادي المتقدم</h1>
    <p>فريق من المحللين المتخصصين في خدمتك</p>
</header>

<div class="user-bar" id="userBar">
    <div class="user-info">
        <div class="avatar-sm" id="userAvatar">؟</div>
        <span id="userGreeting">مرحباً</span>
    </div>
    <button onclick="resetUser()">🔄 تغيير البيانات</button>
</div>

<div class="container">

    <div id="welcome">
        <h2>👋 أهلاً بك</h2>
        <p class="sub">قبل أن نبدأ، نحتاج بعض المعلومات لنقدّم لك خدمة أفضل</p>
        
        <div class="form-group">
            <label>ما اسمك الكريم؟</label>
            <input type="text" id="inName" placeholder="مثال: عبدالله" maxlength="30">
        </div>
        <div class="form-group">
            <label>كم عمرك؟</label>
            <input type="number" id="inAge" placeholder="مثال: 32" min="15" max="100">
        </div>
        <div class="form-group">
            <label>ما خلفيتك المالية؟</label>
            <select id="inExp">
                <option value="مبتدئ تماماً">🌱 مبتدئ</option>
                <option value="متوسط الخبرة" selected>📘 متوسط</option>
                <option value="محترف في المجال المالي">🎓 محترف</option>
            </select>
        </div>
        <div class="form-group">
            <label>لماذا تزورنا؟ (اختياري)</label>
            <textarea id="inReason" placeholder="مثال: أريد استشارة حول شراء الذهب..."></textarea>
        </div>
        
        <button class="btn-primary" onclick="saveUser()">دخول المنصة</button>
    </div>

    <div id="home">
        <h2>اختر القسم التخصصي:</h2>
        <div class="grid">
            <div class="card" onclick="openSection('gold')">
                <h3>🟡 الذهب والمعادن الثمينة</h3>
                <p>تحليل حركة السبائك، الذهب، الفضة، وتأثير التضخم والسياسة النقدية.</p>
            </div>
            <div class="card" onclick="openSection('stocks')">
                <h3>📈 الأسهم والأسواق المالية</h3>
                <p>تقييم الشركات، قراءة القوائم المالية، واتجاهات الاستثمار.</p>
            </div>
            <div class="card" onclick="openSection('macro')">
                <h3>🌐 الاقتصاد الكلي</h3>
                <p>قرارات البنوك المركزية، أسعار الفائدة، التضخم، وسلاسل الإمداد.</p>
            </div>
            <div class="card" onclick="openSection('geopolitical')">
                <h3>🗺️ التحليل الجيوسياسي</h3>
                <p>تأثير الأزمات والتوترات السياسية على أسواق الطاقة والتجارة.</p>
            </div>
            <div class="card" onclick="openSection('budget')">
                <h3>💰 الميزانية والثروات</h3>
                <p>تخطيط المداخيل، استراتيجيات الادخار، وهيكلة الخروج من الديون.</p>
            </div>
            <div class="card" onclick="openSection('crypto')">
                <h3>🔗 الأصول الرقمية</h3>
                <p>اتجاهات البيتكوين، تقنيات البلوكشين، وتحليل المخاطر.</p>
            </div>
        </div>
    </div>

    <div id="chat">
        <div class="progress-bar" id="progressBar"><div class="progress-fill" id="progressFill"></div></div>
        <div class="chat-header">
            <div class="expert-avatar" id="expAvatar">؟</div>
            <div class="expert-info">
                <h3 id="expName">جاري الاتصال...</h3>
                <p id="expRole">متصل الآن 🟢</p>
            </div>
            <button class="btn-back" onclick="goBack()">← رجوع</button>
        </div>
        <div id="messages"></div>
        <div class="suggestions" id="suggestions"></div>
        <div class="input-area">
            <textarea id="input" placeholder="اكتب رسالتك..." rows="1"></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMsg()">➤</button>
        </div>
    </div>

</div>

<script>
const EXPERTS = {
    gold: [
        { name: 'سارة العتيبي', role: 'محللة معادن ثمينة', years: '8 سنوات خبرة' },
        { name: 'أحمد الراشد', role: 'خبير أسواق السلع', years: '15 سنة خبرة' },
        { name: 'ريم الفهد', role: 'محللة ذهب أولى', years: '10 سنوات خبرة' }
    ],
    stocks: [
        { name: 'خالد المنصور', role: 'مستشار أسواق مالية', years: '12 سنة خبرة' },
        { name: 'نورة السالم', role: 'محللة أسهم', years: '7 سنوات خبرة' }
    ],
    macro: [
        { name: 'د. فهد الحربي', role: 'محلل اقتصادي', years: '18 سنة خبرة' },
        { name: 'ليلى القحطاني', role: 'محللة سياسات نقدية', years: '9 سنوات خبرة' }
    ],
    geopolitical: [
        { name: 'عمر الدوسري', role: 'محلل جيوسياسي', years: '14 سنة خبرة' },
        { name: 'منال الشهري', role: 'خبيرة علاقات دولية', years: '11 سنة خبرة' }
    ],
    budget: [
        { name: 'منى الغامدي', role: 'مدرّبة مالية', years: '6 سنوات خبرة' },
        { name: 'عبدالرحمن الزهراني', role: 'مستشار ثروات', years: '13 سنة خبرة' }
    ],
    crypto: [
        { name: 'يوسف الشمري', role: 'محلل أصول رقمية', years: '5 سنوات خبرة' },
        { name: 'هند العمري', role: 'خبيرة بلوكشين', years: '8 سنوات خبرة' }
    ]
};

const SECTIONS = { gold: 'الذهب والمعادن', stocks: 'الأسهم', macro: 'الاقتصاد الكلي', geopolitical: 'الجيوسياسي', budget: 'الميزانية', crypto: 'الأصول الرقمية' };

const SUGGESTIONS = {
    gold: ['هل الوقت مناسب للشراء؟', 'توقعك لسعر الأونصة؟', 'كيف أتحوط ضد التضخم؟'],
    stocks: ['أفضل القطاعات حالياً؟', 'كيف أقيّم شركة؟', 'نصائح للمبتدئين'],
    macro: ['تأثير قرارات الفيدرالي؟', 'توقعك للتضخم؟', 'أفضل الأصول الآن؟'],
    geopolitical: ['تأثير التوترات على النفط؟', 'الحروب والأسواق؟'],
    budget: ['كيف أنظم راتبي؟', 'أفضل طريقة للادخار؟', 'الخروج من الديون؟'],
    crypto: ['توقعك للبيتكوين؟', 'هل هي آمنة؟', 'مشروع واعد؟']
};

let user = null, section = null, expert = null, history = [], busy = false;
let progressTimer = null, waitingTimer = null;

// ============ Splash ============
const SPLASH_MSGS = ['جاري تجهيز بيئة العمل...', 'الاتصال بالخادم...', 'تحميل بيانات المحللين...', 'مراجعة الأسواق...', 'تجهيز فريق الاستقبال...'];
let splashP = 0, splashMsgIdx = 0;

function startSplash() {
    const fill = document.getElementById('splashFill');
    const msg = document.getElementById('splashMsg');
    const interval = setInterval(() => {
        splashP = window.SERVER_READY ? Math.min(splashP + 10, 100) : Math.min(splashP + 1.5, 85);
        fill.style.width = splashP + '%';
        const idx = Math.min(Math.floor(splashP / 20), SPLASH_MSGS.length - 1);
        if (idx !== splashMsgIdx) { splashMsgIdx = idx; msg.textContent = SPLASH_MSGS[idx]; }
        
        if (splashP >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('splash').classList.add('fade');
                setTimeout(() => {
                    document.getElementById('splash').style.display = 'none';
                    initView();
                }, 700);
            }, 400);
        }
    }, 200);
}

function initView() {
    if (loadUser()) {
        document.getElementById('home').classList.add('show');
    } else {
        document.getElementById('welcome').classList.add('show');
    }
}

startSplash();
setTimeout(() => { window.SERVER_READY = true; }, 15000);

// ============ User ============
function loadUser() {
    const s = localStorage.getItem('ammar_user');
    if (s) {
        try {
            user = JSON.parse(s);
            showUserBar();
            return true;
        } catch (e) { localStorage.removeItem('ammar_user'); }
    }
    return false;
}

function saveUser() {
    const name = document.getElementById('inName').value.trim();
    const age = document.getElementById('inAge').value.trim();
    const exp = document.getElementById('inExp').value;
    const reason = document.getElementById('inReason').value.trim();
    
    if (!name || name.length < 2) { alert('أدخل اسماً صحيحاً'); return; }
    if (!age || age < 15 || age > 100) { alert('أدخل عمراً صحيحاً (15-100)'); return; }
    
    user = { name, age, experience: exp, reason };
    localStorage.setItem('ammar_user', JSON.stringify(user));
    showUserBar();
    document.getElementById('welcome').classList.remove('show');
    document.getElementById('home').classList.add('show');
}

function showUserBar() {
    document.getElementById('userBar').classList.add('show');
    document.getElementById('userAvatar').innerText = user.name.charAt(0);
    document.getElementById('userGreeting').innerText = `مرحباً ${user.name}`;
}

function resetUser() {
    if (confirm('مسح بياناتك والبدء من جديد؟')) {
        localStorage.removeItem('ammar_user');
        location.reload();
    }
}

// ============ Sections ============
function pickExpert(s) {
    const list = EXPERTS[s];
    return list[Math.floor(Math.random() * list.length)];
}

function openSection(s) {
    section = s;
    expert = pickExpert(s);
    history = [];
    
    document.getElementById('home').classList.remove('show');
    document.getElementById('chat').classList.add('show');
    
    document.getElementById('expAvatar').innerText = expert.name.charAt(0);
    document.getElementById('expName').innerText = expert.name;
    document.getElementById('expRole').innerText = `${expert.role} • ${expert.years} • متصل 🟢`;
    document.getElementById('messages').innerHTML = '';
    
    showSuggestions(s);
    
    setTimeout(() => {
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'صباح الخير' : (hour < 17 ? 'مساء الخير' : 'مساء النور');
        const welcome = `${greet} ${user.name} 🌟\nأنا ${expert.name}، ${expert.role}.\nخبرتي ${expert.years} في ${SECTIONS[s]}.\n\nكيف أقدر أساعدك اليوم؟`;
        addBubble('expert', welcome);
        history.push({ role: 'assistant', content: welcome });
    }, 700);
    
    setTimeout(() => document.getElementById('input').focus(), 600);
}

function showSuggestions(s) {
    const c = document.getElementById('suggestions');
    const list = SUGGESTIONS[s] || [];
    c.innerHTML = list.map(t => `<div class="chip" onclick="useSug('${t.replace(/'/g, "\\'")}')">${t}</div>`).join('');
    c.style.display = 'flex';
}

function useSug(t) {
    document.getElementById('input').value = t;
    document.getElementById('input').focus();
}

function goBack() {
    document.getElementById('chat').classList.remove('show');
    document.getElementById('home').classList.add('show');
    section = null; expert = null; history = [];
}

// ============ Utils ============
function timeNow() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function esc(t) {
    const d = document.createElement('div');
    d.innerText = t;
    return d.innerHTML;
}

// ✅ تنسيق Markdown بسيط (bold + سطور)
function formatText(text) {
    let html = esc(text);
    // **نص** → <strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return html;
}

function addBubble(who, text, isError = false) {
    const wrap = document.createElement('div');
    wrap.className = `bubble-wrap ${who}`;
    const name = who === 'user' ? user.name : (expert ? expert.name : 'النظام');
    wrap.innerHTML = `
        <div class="bubble ${isError ? 'error-bubble' : ''}">
            <div class="sender">${name}</div>
            <div class="bubble-content">${isError ? text : formatText(text)}</div>
            <div class="time">${timeNow()}</div>
        </div>
    `;
    const m = document.getElementById('messages');
    m.appendChild(wrap);
    m.scrollTop = m.scrollHeight;
}

// ============ Progress ============
function startProgress() {
    const bar = document.getElementById('progressBar');
    const fill = document.getElementById('progressFill');
    bar.classList.add('show');
    let p = 0;
    progressTimer = setInterval(() => {
        p = Math.min(p + Math.random() * 4, 88);
        fill.style.width = p + '%';
    }, 400);
}

function finishProgress() {
    clearInterval(progressTimer);
    const fill = document.getElementById('progressFill');
    fill.style.width = '100%';
    setTimeout(() => {
        document.getElementById('progressBar').classList.remove('show');
        fill.style.width = '0%';
    }, 500);
}

// ============ Waiting Bubble ============
const WSTEPS = [
    { icon: '📊', text: 'مراجعة آخر تحديثات الأسواق...' },
    { icon: '📈', text: 'تحليل المؤشرات الفنية...' },
    { icon: '🔍', text: 'تقييم المخاطر...' },
    { icon: '💭', text: 'صياغة التوصيات...' },
    { icon: '✍️', text: 'إعداد التقرير...' }
];

function showWaiting() {
    const m = document.getElementById('messages');
    const w = document.createElement('div');
    w.className = 'bubble-wrap expert';
    w.id = 'waiting';
    const stepsHtml = WSTEPS.map((s, i) => `<div class="wstep" data-i="${i}"><span>${s.icon}</span><span>${s.text}</span></div>`).join('');
    w.innerHTML = `
        <div class="bubble waiting-bubble">
            <div class="sender">${expert.name}</div>
            <div style="font-weight:700;color:#92400e;margin-bottom:6px;">🧠 جاري تحليل سؤالك...</div>
            <div class="waiting-steps">${stepsHtml}</div>
        </div>
    `;
    m.appendChild(w);
    m.scrollTop = m.scrollHeight;
    
    let i = 0;
    waitingTimer = setInterval(() => {
        const steps = document.querySelectorAll('#waiting .wstep');
        if (i > 0 && steps[i-1]) {
            steps[i-1].classList.remove('active');
            steps[i-1].classList.add('done');
            steps[i-1].firstElementChild.textContent = '✅';
        }
        if (i < steps.length) { steps[i].classList.add('active'); i++; }
        else { i = 0; steps.forEach(s => { s.classList.remove('active','done'); s.firstElementChild.textContent = WSTEPS[parseInt(s.dataset.i)].icon; }); }
    }, 2400);
}

function hideWaiting() {
    clearInterval(waitingTimer);
    const w = document.getElementById('waiting');
    if (w) w.remove();
}

function showTyping() {
    const m = document.getElementById('messages');
    const w = document.createElement('div');
    w.className = 'bubble-wrap expert';
    w.id = 'typing';
    w.innerHTML = `
        <div class="bubble">
            <div class="sender">${expert.name}</div>
            <div class="typing"><span></span><span></span><span></span></div>
        </div>
    `;
    m.appendChild(w);
    m.scrollTop = m.scrollHeight;
}

function hideTyping() {
    const t = document.getElementById('typing');
    if (t) t.remove();
}

// ============ Send ============
async function sendMsg() {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text || busy) return;
    
    input.value = '';
    addBubble('user', text);
    history.push({ role: 'user', content: text });
    document.getElementById('suggestions').style.display = 'none';
    
    busy = true;
    document.getElementById('sendBtn').disabled = true;
    showWaiting();
    startProgress();
    
    await new Promise(r => setTimeout(r, 400));
    
    try {
        const res = await fetch('https://ammar-e0tp.onrender.com/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section, query: text, user, expert,
                history: history.slice(-6)
            })
        });
        
        const raw = await res.text();
        let data = {};
        try { data = JSON.parse(raw); } catch (e) {
            hideWaiting(); finishProgress();
            addBubble('expert', `⚠️ خطأ (${res.status})`, true);
            return;
        }
        
        if (!res.ok) {
            hideWaiting(); finishProgress();
            addBubble('expert', `⚠️ خطأ: ${data.error || ''}\n${data.details || ''}`, true);
            return;
        }
        
        hideWaiting();
        finishProgress();
        
        const replies = data.replies || [data.answer].filter(Boolean);
        
        for (let i = 0; i < replies.length; i++) {
            if (i > 0) {
                showTyping();
                await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
                hideTyping();
            }
            addBubble('expert', replies[i]);
            history.push({ role: 'assistant', content: replies[i] });
            
            if (i < replies.length - 1) await new Promise(r => setTimeout(r, 400));
        }
        
    } catch (e) {
        hideWaiting(); finishProgress();
        addBubble('expert', `⚠️ تعذر الاتصال بالخادم.\n${e.message}\n\n💡 جرّب مرة أخرى.`, true);
    } finally {
        busy = false;
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('input').focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('input');
    if (inp) inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
});
</script>

</body>
</html>
