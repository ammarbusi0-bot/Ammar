/* ═══════════════════════════════════════════════════════
   وصال — واجهة محاكاة أمامية
   ═══════════════════════════════════════════════════════ */

(() => {
'use strict';

/* ── الإعدادات ─────────────────────────────────── */
const TG_USER = 'Winda_13';
const TG_BASE = `https://t.me/${TG_USER}`;
const STORE_KEY = 'wisal_v2';

/* ── أكواد التفعيل ──────────────────────────────
   ضع هنا الأكواد التي يبيعها المشرف.
   كل كود يستخدم مرة واحدة (يُحفظ في localStorage).
   ─────────────────────────────────────────────── */
const VALID_CODES = [
  'VIP-2211','VIP-3300','VIP-4411','VIP-5500','VIP-6611',
  'VIP-7722','VIP-8833','VIP-9944','VIP-1155','VIP-2266'
];

/* ── الشخصيات ──────────────────────────────────── */
const PEOPLE = [
  { id:'#K4X-8412', name:'ليان',  g:'f', c:'ل' },
  { id:'#M2P-7719', name:'عمر',   g:'m', c:'ع' },
  { id:'#R8V-3306', name:'نور',   g:'f', c:'ن' },
  { id:'#B5N-2048', name:'زياد',  g:'m', c:'ز' },
  { id:'#Q7L-9921', name:'سارة',  g:'f', c:'س' },
  { id:'#T3D-6613', name:'كريم',  g:'m', c:'ك' },
  { id:'#X9C-4478', name:'هدى',   g:'f', c:'ه' },
  { id:'#A6J-1184', name:'آدم',   g:'m', c:'آ' },
  { id:'#W2E-8027', name:'ريم',   g:'f', c:'ر' },
  { id:'#F4Y-5521', name:'يوسف',  g:'m', c:'ي' },
  { id:'#H7K-3904', name:'لمى',   g:'f', c:'لـ' },
  { id:'#G1S-7782', name:'مروان', g:'m', c:'م' }
];

const IDLE_CHAT = [
  'أحد هنا من الرياض؟','الجو الليلة غريب','قهوة الصباح ولا شيء',
  'في أحد يحب السفر؟','أنا تعبانة بس ما أقدر أنام','سمعتوا الأغنية الجديدة؟',
  'من جدة هنا؟','وش تسوون؟','أحب الليل','في أحد يتكلم؟',
  'تعبت من الشغل','ودي أسافر مكان بعيد','حد عنده اقتراح فلم؟',
  'قهوة وكتب = سعادة','مين يحب المطر؟','منو صاحي؟',
  'أحب البحر بالليل','أبحث عن صديق يفهمني','الوحدة شيء غريب'
];

const PRIVATE_HINTS = [
  'الغرفة صارت مزدحمة','ما أحب أتكلم كثير هنا',
  'إذا تبي نكمل — الخاص أوضح','الخاص للأعضاء بس…',
  'أنا أرتاح أكثر بالخاص','لو تكلمنا على الخاص أقول لك أكثر'
];

const TICKER_ITEMS = [
  ['أحمد من الرياض اشترك الآن','قبل 3 دقائق'],
  ['نورة من جدة فعّلت عضويتها','قبل 7 دقائق'],
  ['خالد من الدمام اشترك','قبل 12 دقيقة'],
  ['سارة من مكة انضمت','قبل 18 دقيقة'],
  ['محمد من أبها فعّل','قبل 25 دقيقة'],
  ['هند من الكويت اشتركت','قبل 31 دقيقة'],
  ['عبدالله من دبي فعّل','قبل 40 دقيقة'],
  ['ريم من المنامة اشتركت','قبل 52 دقيقة']
];

/* ── الحالة ─────────────────────────────────────── */
const S = {
  user: null,
  vip: false,
  userCode: null,
  roomTimer: null,
  notifTimer: null,
  statsTimer: null,
  tickTimer: null,
  countTimer: null,
  activeView: 'room',
  stats: { views: 0, likes: 0, matches: 0 },
  countdownEnd: 0
};

/* ── أدوات ─────────────────────────────────────── */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const rint = (a,b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pad = n => String(n).padStart(2,'0');

/* ── عرض ───────────────────────────────────────── */
function showScreen(id){
  $$('.screen').forEach(el => el.classList.remove('active'));
  $(id).classList.add('active');
}
function showView(v){
  S.activeView = v;
  $$('.view').forEach(el => el.classList.remove('active'));
  $(`#view-${v}`).classList.add('active');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  if(v === 'notif') $('#notif-dot').classList.remove('on');
}
function openModal(id){ $(id).classList.add('on'); }
function closeModal(id){ $(id).classList.remove('on'); }

/* ── تخزين ─────────────────────────────────────── */
function save(){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify({
      user: S.user,
      vip: S.vip,
      userCode: S.userCode,
      countdownEnd: S.countdownEnd
    }));
  }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* ── العمر ────────────────────────────────────── */
function calcAge(dob){
  const d = new Date(dob);
  if(isNaN(d)) return 0;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

/* ── لون الصورة الرمزية ────────────────────────── */
function avatarColor(id){
  let h = 0;
  for(let i=0;i<id.length;i++) h = id.charCodeAt(i) + ((h<<5) - h);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue+40)%360},70%,45%))`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ── توليد كود المستخدم ────────────────────────── */
function genUserCode(){
  return 'wisal_' + rint(10000, 99999);
}

/* ── توليد ID دائم ────────────────────────────── */
function genPermanentID(){
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const D = '0123456789';
  let a = '';
  for(let i=0;i<3;i++) a += L[rint(0, L.length-1)];
  let b = '';
  for(let i=0;i<4;i++) b += D[rint(0, D.length-1)];
  return `#${a}-${b}`;
}

/* ── رابط تيليجرام مع الكود ────────────────────── */
function tgLink(plan){
  const params = new URLSearchParams({
    start: `${S.userCode || 'guest'}_${plan || 'open'}`
  });
  return `${TG_BASE}?${params.toString()}`;
}

/* ═══════════════════════════════════════════════
   التسجيل
   ═══════════════════════════════════════════════ */
$$('#r-gender button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#r-gender button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
});

$('#r-dob').addEventListener('change', () => {
  const age = calcAge($('#r-dob').value);
  const h = $('#r-age-hint');
  if(!age){ h.textContent = ''; h.className = 'hint'; return; }
  if(age < 18){
    h.textContent = `عمرك ${age} — يجب أن تكون 18+`;
    h.className = 'hint bad';
  } else {
    h.textContent = `عمرك ${age} ✓`;
    h.className = 'hint ok';
  }
});

$('#r-submit').addEventListener('click', () => {
  const name = $('#r-name').value.trim();
  const nick = $('#r-nick').value.trim();
  const dob  = $('#r-dob').value;
  const pass = $('#r-pass').value.trim();
  const g    = $('#r-gender .on').dataset.v;

  if(name.length < 2){ $('#r-name').focus(); return; }
  if(nick.length < 2){ $('#r-nick').focus(); return; }
  if(!dob){ $('#r-dob').focus(); return; }
  if(calcAge(dob) < 18){ $('#r-dob').focus(); return; }
  if(pass.length < 4){ $('#r-pass').focus(); return; }

  S.user = { name, nick, dob, g, age: calcAge(dob), createdAt: Date.now() };
  S.userCode = genUserCode();
  S.countdownEnd = Date.now() + 24 * 3600 * 1000; // 24 ساعة

  save();
  bootApp();
});

/* ═══════════════════════════════════════════════
   الإقلاع
   ═══════════════════════════════════════════════ */
function bootApp(){
  const u = S.user;
  $$('.me-name').forEach(el => el.textContent = `${u.name} · زائر`);

  renderMatches();
  renderMembers();
  renderNotifications();
  updateStatsUI();
  updateProgress();
  updateVipUI();

  buildTicker();
  startCountdown();
  startRoomLoop();
  startStatsLoop();
  startNotifLoop();
  startTickerLoop();

  showScreen('#scr-app');
  showView('room');
}

/* ═══════════════════════════════════════════════
   الغرفة
   ═══════════════════════════════════════════════ */
function startRoomLoop(){
  if(S.roomTimer) clearTimeout(S.roomTimer);
  scheduleNext();
}
function scheduleNext(){
  const delay = rint(1800, 4200);
  S.roomTimer = setTimeout(() => {
    pushRoomMessage();
    if(Math.random() < 0.35) setTimeout(pushRoomMessage, rint(400, 1000));
    scheduleNext();
  }, delay);
}
function pushRoomMessage(){
  const p = rnd(PEOPLE);
  const isHint = Math.random() < 0.18;
  let text = isHint ? rnd(PRIVATE_HINTS) : rnd(IDLE_CHAT);

  // شخصنة أحياناً
  if(Math.random() < 0.10 && S.user){
    text = `يا ${S.user.name}، ${text}`;
  }

  addRoomMsg(p, text);
}
function addRoomMsg(p, text){
  const stream = $('#chat-stream');
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `
    <div class="avatar-sm" style="background:${avatarColor(p.id)}">${p.c}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <b>${p.name}</b>
        <span class="msg-id">${p.id}</span>
        <span class="msg-vip">عضو</span>
      </div>
      <div class="msg-text">${escapeHtml(text)}</div>
    </div>
  `;
  stream.appendChild(row);
  while(stream.children.length > 60) stream.removeChild(stream.firstChild);
  stream.scrollTop = stream.scrollHeight;
}

/* ═══════════════════════════════════════════════
   الاستكشاف
   ═══════════════════════════════════════════════ */
function renderMatches(){
  const grid = $('#matches-grid');
  grid.innerHTML = '';
  const picks = [...PEOPLE].sort(() => Math.random() - 0.5).slice(0, 6);
  picks.forEach(p => {
    const pct = rint(78, 97);
    const el = document.createElement('div');
    el.className = 'match-card';
    el.innerHTML = `
      <div class="mc-av" style="background:${avatarColor(p.id)}">${p.c}</div>
      <div class="mc-name">${p.name}</div>
      <div class="mc-meta">${p.id} · ${pct}%</div>
      <div class="mc-blur">🔒</div>
    `;
    el.addEventListener('click', () => {
      if(S.vip) return;
      openModal('#wall');
    });
    grid.appendChild(el);
  });
}
function renderMembers(){
  const list = $('#members-list');
  list.innerHTML = '';
  [...PEOPLE].sort(() => Math.random() - 0.5).slice(0, 8).forEach(p => {
    const el = document.createElement('div');
    el.className = 'member-row';
    el.innerHTML = `
      <div class="avatar-sm" style="background:${avatarColor(p.id)}">${p.c}</div>
      <div class="member-info"><b>${p.name}</b><span>نشط الآن</span></div>
      <div class="member-id">${p.id}</div>
    `;
    el.addEventListener('click', () => {
      if(S.vip) return;
      openModal('#wall');
    });
    list.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════
   الإشعارات
   ═══════════════════════════════════════════════ */
function renderNotifications(){
  const list = $('#notif-list');
  list.innerHTML = '';
  const count = rint(8, 14);
  for(let i=0;i<count;i++){
    addNotifItem(rnd(PEOPLE), rint(1,59) + ' دقيقة');
  }
}
function addNotifItem(p, when){
  const list = $('#notif-list');
  const el = document.createElement('div');
  el.className = 'notif-item';
  el.innerHTML = `
    <div class="avatar-sm" style="background:${avatarColor(p.id)}">${p.c}</div>
    <div class="notif-text">
      <b>${p.name} <span style="color:var(--accent);font-size:10px">${p.id}</span></b>
      <span>أرسل لك رسالة قبل ${when}</span>
    </div>
    <div class="notif-lock">🔒</div>
  `;
  el.addEventListener('click', () => {
    if(S.vip) return;
    openModal('#wall');
  });
  list.insertBefore(el, list.firstChild);
  while(list.children.length > 30) list.removeChild(list.lastChild);
}
function startNotifLoop(){
  S.notifTimer = setInterval(() => {
    addNotifItem(rnd(PEOPLE), 'الآن');
    if(S.activeView !== 'notif') $('#notif-dot').classList.add('on');
  }, rint(24000, 45000));
}

/* ═══════════════════════════════════════════════
   الإحصائيات
   ═══════════════════════════════════════════════ */
function updateStatsUI(){
  $('#st-views').textContent = S.stats.views;
  $('#st-likes').textContent = S.stats.likes;
  $('#st-match').textContent = S.stats.matches;
}
function startStatsLoop(){
  setInterval(() => {
    const n = rint(1100, 1480);
    $('#online-count').textContent = `${n.toLocaleString('en')} متصل الآن`;
  }, 4000);

  S.statsTimer = setInterval(() => {
    S.stats.views += rint(1, 4);
    if(Math.random() < 0.4) S.stats.likes += rint(0, 2);
    if(Math.random() < 0.2) S.stats.matches += 1;
    updateStatsUI();
    updateProgress();
  }, 6000);
}

/* ═══════════════════════════════════════════════
   شريط الإثبات الاجتماعي
   ═══════════════════════════════════════════════ */
function buildTicker(){
  const track = $('#tick-track');
  if(!track) return;
  // نكرر العناصر مرتين للحركة المستمرة
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  track.innerHTML = items.map(([a,b]) =>
    `<span>⭐ <b>${a}</b> · ${b}</span>`
  ).join('');
}
function startTickerLoop(){
  // لا شيء — الحركة بـ CSS
}

/* ═══════════════════════════════════════════════
   العدّاد التنازلي
   ═══════════════════════════════════════════════ */
function startCountdown(){
  if(!S.countdownEnd || S.countdownEnd < Date.now()){
    S.countdownEnd = Date.now() + 24 * 3600 * 1000;
    save();
  }
  updateCountdown();
  if(S.countTimer) clearInterval(S.countTimer);
  S.countTimer = setInterval(updateCountdown, 1000);
}
function updateCountdown(){
  const diff = S.countdownEnd - Date.now();
  if(diff <= 0){
    // إعادة العرض بصيغة جديدة
    S.countdownEnd = Date.now() + 24 * 3600 * 1000;
    save();
  }
  const total = Math.max(0, Math.floor((S.countdownEnd - Date.now()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const str = `${pad(h)}:${pad(m)}:${pad(s)}`;

  const el1 = $('#vip-count');
  const el2 = $('#wall-count');
  if(el1) el1.textContent = `ينتهي العرض: ${str}`;
  if(el2) el2.textContent = `ينتهي العرض خلال ${str}`;
}

/* ═══════════════════════════════════════════════
   شريط التقدم
   ═══════════════════════════════════════════════ */
function updateProgress(){
  let pct = 40;
  const note = $('#progress-note');
  if(!S.vip){
    pct = 40;
    note.textContent = 'تبقّى: تفعيل الاشتراك';
  } else {
    pct = 100;
    note.textContent = 'حسابك مُفعّل ✓';
  }
  $('#progress-pct').textContent = pct + '%';
  $('#progress-fill').style.width = pct + '%';
}

/* ═══════════════════════════════════════════════
   حالة VIP
   ═══════════════════════════════════════════════ */
function updateVipUI(){
  const u = S.user;
  if(!u) return;

  if(S.vip){
    // مفعّل
    $$('.me-name').forEach(el => el.textContent = `${u.name} · عضو`);
    $('#me-badge').textContent = 'عضو ✓';
    $('#me-badge').classList.add('vip');
    $('#p-badge').textContent = 'عضو مُفعّل';
    $('#p-badge').classList.add('vip');
    if(u.permanentID){
      $('#p-id').textContent = u.permanentID;
    }
    $('#room-lock').innerHTML =
      '<div class="lock-inner" style="color:var(--ok);border-color:rgba(0,224,138,.3)">✓ العضوية مُفعّلة — يمكنك الكتابة الآن</div>';
    $('#vipbar').style.display = 'none';
  } else {
    $$('.me-name').forEach(el => el.textContent = `${u.name} · زائر`);
    $('#me-badge').textContent = 'حساب مؤقت';
    $('#me-badge').classList.remove('vip');
    $('#p-badge').textContent = 'حساب مؤقت';
    $('#p-badge').classList.remove('vip');
    $('#p-id').textContent = 'لا يوجد ID دائم';
    $('#vipbar').style.display = 'flex';
  }
  updateProgress();
}

/* ═══════════════════════════════════════════════
   الجدار + الباقات
   ═══════════════════════════════════════════════ */
['#btn-upgrade-top','#btn-upgrade-room','#btn-vip-bar','#btn-upgrade-profile']
  .forEach(sel => $(sel)?.addEventListener('click', () => {
    if(S.vip) return;
    openModal('#wall');
  }));

$('#wall-close').addEventListener('click', () => closeModal('#wall'));
$('#wall-go').addEventListener('click', () => {
  closeModal('#wall');
  openModal('#plans');
});
$('#plans-close').addEventListener('click', () => closeModal('#plans'));

$$('.plan').forEach(el => {
  el.addEventListener('click', () => {
    const plan = el.dataset.plan;
    window.open(tgLink(plan), '_blank', 'noopener');
    closeModal('#plans');
    // أظهر خيار إدخال الكود بعد لحظة
    setTimeout(() => {
      if(!S.vip) openModal('#verify');
    }, 2500);
  });
});

/* ═══════════════════════════════════════════════
   التحقق من الكود
   ═══════════════════════════════════════════════ */
$('#btn-verify-open').addEventListener('click', () => openModal('#verify'));
$('#verify-close').addEventListener('click', () => closeModal('#verify'));

$('#code-submit').addEventListener('click', () => {
  const input = $('#code-input').value.trim().toUpperCase();
  const hint = $('#code-hint');

  if(!input){
    hint.textContent = 'أدخل الكود';
    hint.className = 'code-hint bad';
    return;
  }
  if(!VALID_CODES.includes(input)){
    hint.textContent = 'الكود غير صحيح';
    hint.className = 'code-hint bad';
    return;
  }

  // فعّل
  S.vip = true;
  S.user.permanentID = genPermanentID();
  save();

  hint.textContent = 'تم التفعيل ✓';
  hint.className = 'code-hint ok';

  setTimeout(() => {
    closeModal('#verify');
    updateVipUI();
    renderMatches();
    renderMembers();
    $('#code-input').value = '';
    hint.textContent = '';
  }, 1200);
});

/* ═══════════════════════════════════════════════
   التنقل
   ═══════════════════════════════════════════════ */
$$('.tab').forEach(t => {
  t.addEventListener('click', () => showView(t.dataset.v));
});

/* ═══════════════════════════════════════════════
   الإقلاع الأول
   ═══════════════════════════════════════════════ */
const saved = load();
if(saved && saved.user && saved.user.name){
  S.user = saved.user;
  S.vip = saved.vip || false;
  S.userCode = saved.userCode || genUserCode();
  S.countdownEnd = saved.countdownEnd || (Date.now() + 24 * 3600 * 1000);
  bootApp();
} else {
  showScreen('#scr-register');
}

})();
