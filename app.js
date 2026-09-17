/* ═══════════════════════════════════════════════════════
   وصال — واجهة محاكاة أمامية
   ═══════════════════════════════════════════════════════ */

(() => {
'use strict';

const TG_USER = 'Winda_13';
const TG_BASE = `https://t.me/${TG_USER}`;
const STORE_KEY = 'wisal_v3';

const VALID_CODES = [
  'VIP-2211','VIP-3300','VIP-4411','VIP-5500','VIP-6611',
  'VIP-7722','VIP-8833','VIP-9944','VIP-1155','VIP-2266'
];

/* ── الأعضاء ─────────────────────────────────── */
const PEOPLE = [
  { id:'#K4X-8412', name:'ليان',  g:'f', c:'ل', age:24, city:'الرياض',
    bio:'أحب القهوة والكتب. أبحث عن محادثة صادقة.' },
  { id:'#M2P-7719', name:'عمر',   g:'m', c:'ع', age:28, city:'جدة',
    bio:'مهندس نهاراً، عازف غيتار ليلاً.' },
  { id:'#R8V-3306', name:'نور',   g:'f', c:'ن', age:22, city:'الدمام',
    bio:'طالبة طب. وقتي ضيق لكن أعطي من يستحق.' },
  { id:'#B5N-2048', name:'زياد',  g:'m', c:'ز', age:31, city:'الرياض',
    bio:'رجل أعمال. أقدّر الصدق فوق كل شيء.' },
  { id:'#Q7L-9921', name:'سارة',  g:'f', c:'س', age:26, city:'مكة',
    bio:'مصممة جرافيك. أرى العالم بالألوان.' },
  { id:'#T3D-6613', name:'كريم',  g:'m', c:'ك', age:29, city:'المدينة',
    bio:'طبيب بيطري. أحب الحيوانات.' },
  { id:'#X9C-4478', name:'هدى',   g:'f', c:'ه', age:25, city:'الخبر',
    bio:'معلمة لغة عربية. الكلمة الصادقة تصل.' },
  { id:'#A6J-1184', name:'آدم',   g:'m', c:'آ', age:27, city:'أبها',
    bio:'مطوّر برمجيات. أحل المشكلات.' },
  { id:'#W2E-8027', name:'ريم',   g:'f', c:'ر', age:23, city:'تبوك',
    bio:'أكتب الشعر في وقت الفراغ.' },
  { id:'#F4Y-5521', name:'يوسف',  g:'m', c:'ي', age:30, city:'بريدة',
    bio:'قارئ نهم. أمشي كل صباح.' },
  { id:'#H7K-3904', name:'لمى',   g:'f', c:'لـ', age:21, city:'الرياض',
    bio:'أحب الرقص والأفلام القديمة.' },
  { id:'#G1S-7782', name:'مروان', g:'m', c:'م', age:33, city:'جدة',
    bio:'مغامر. أحب البحر والرياضة.' }
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

const NOTIF_MSGS = [
  'أهلاً، شفت ملفك وأعجبني…','ممكن نتكلم شوي؟','أنت جديد هنا؟',
  'شكلك شخص مثير للاهتمام…','عندي سؤال شخصي…','تحب نتكلم في الخاص؟',
  'قلت لي شيئاً في الغرفة، أذكر؟','ما عرفت كيف أراسلك، أرسلت هنا.',
  'هل تقرأ الرسائل؟','أنا معجبة بملفك…','لدي شيء لأقوله لك على الخاص.',
  'أهلاً، سمعت عنك من صديقة.'
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

const SERVICES = [
  { icon:'💬', title:'الدردشة الحية',     desc:'تحدّث في الغرفة العامة مع مئات الأعضاء في وقت واحد' },
  { icon:'💌', title:'الرسائل الخاصة',   desc:'راسل من تريد بشكل خاص وآمن بعيداً عن الغرفة' },
  { icon:'💜', title:'المطابقات الذكية', desc:'نظام يجد لك من يشبهك في الاهتمامات والعمر والمدينة' },
  { icon:'⭐', title:'الملف المُفعّل',    desc:'ID دائم + شارة التحقق + ظهور مميز في كل القوائم' },
  { icon:'🎯', title:'البحث المتقدم',     desc:'ابحث حسب المدينة، العمر، الاهتمامات، وحالة الاتصال' },
  { icon:'🔥', title:'الأولوية في الغرفة', desc:'رسائلك تظهر أولاً، وملفك في المقدمة' },
  { icon:'👁', title:'من شاهدك',          desc:'اعرف من زار ملفك ومن أعجب بك' },
  { icon:'🚀', title:'الدعوات الحصرية',   desc:'دعوة أصدقاء واكسب أيام مجانية' }
];

const S = {
  user: null,
  vip: false,
  userCode: null,
  booted: false,
  roomTimer: null,
  notifTimer: null,
  countTimer: null,
  onlineTimer: null,
  statsTimer: null,
  activeView: 'room',
  stats: { views: 0, likes: 0, matches: 0 },
  countdownEnd: 0,
  pendingVerifyOpen: false
};

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const rint = (a,b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pad = n => String(n).padStart(2,'0');

function showScreen(id){
  $$('.screen').forEach(el => el.classList.remove('active'));
  const t = $(id);
  if(t) t.classList.add('active');
}
function showView(v){
  S.activeView = v;
  $$('.view').forEach(el => el.classList.remove('active'));
  const t = $(`#view-${v}`);
  if(t) t.classList.add('active');
  $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.v === v));
  const dot = $('#notif-dot');
  if(v === 'notif' && dot) dot.classList.remove('on');
}
function openModal(id){ const el = $(id); if(el) el.classList.add('on'); }
function closeModal(id){ const el = $(id); if(el) el.classList.remove('on'); }

function save(){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify({
      user: S.user, vip: S.vip,
      userCode: S.userCode, countdownEnd: S.countdownEnd
    }));
  }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

function calcAge(dob){
  const d = new Date(dob);
  if(isNaN(d)) return 0;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

function avatarColor(id){
  let h = 0;
  for(let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue+40)%360},70%,45%))`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function genUserCode(){ return 'wisal_' + rint(10000, 99999); }

function genPermanentID(){
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '0123456789';
  let a = '', b = '';
  for(let i = 0; i < 3; i++) a += L[rint(0, L.length - 1)];
  for(let i = 0; i < 4; i++) b += D[rint(0, D.length - 1)];
  return `#${a}-${b}`;
}

function tgLink(plan){
  const payload = `${S.userCode || 'guest'}_${plan || 'open'}`;
  return `${TG_BASE}?start=${encodeURIComponent(payload)}`;
}

/* ═══ التسجيل ═══ */
$$('#r-gender button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#r-gender button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
});

$('#r-dob').addEventListener('change', () => {
  const age = calcAge($('#r-dob').value);
  const h = $('#r-age-hint');
  if(!h) return;
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
  S.countdownEnd = Date.now() + 24 * 3600 * 1000;
  save();
  bootApp();
});

/* ═══ الإقلاع ═══ */
function bootApp(){
  if(S.booted) return;
  S.booted = true;

  const u = S.user;
  if(!u) return;

  $$('.me-name').forEach(el => el.textContent = `${u.name} · زائر`);
  const pname = $('#p-name');
  const pav = $('#p-avatar');
  if(pname) pname.textContent = `${u.name} ${u.nick}`;
  if(pav) pav.textContent = u.name.charAt(0).toUpperCase();

  renderMatches();
  renderMembers();
  renderNotifications();
  renderServices();
  updateStatsUI();
  updateVipUI();

  buildTicker();
  startCountdown();
  startRoomLoop();
  startStatsLoop();
  startNotifLoop();

  showScreen('#scr-app');
  showView('room');
}

/* ═══ الغرفة ═══ */
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
  if(Math.random() < 0.10 && S.user && S.user.name){
    text = `يا ${S.user.name}، ${text}`;
  }
  addRoomMsg(p, text);
}
function addRoomMsg(p, text){
  const stream = $('#chat-stream');
  if(!stream) return;
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `
    <div class="avatar-sm" style="background:${avatarColor(p.id)}">${escapeHtml(p.c)}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <b>${escapeHtml(p.name)}</b>
        <span class="msg-id">${escapeHtml(p.id)}</span>
        <span class="msg-vip">عضو</span>
      </div>
      <div class="msg-text">${escapeHtml(text)}</div>
    </div>
  `;
  stream.appendChild(row);
  while(stream.children.length > 60) stream.removeChild(stream.firstChild);
  stream.scrollTop = stream.scrollHeight;
}

/* ═══ المطابقات ═══ */
function renderMatches(){
  const grid = $('#matches-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const picks = [...PEOPLE].sort(() => Math.random() - 0.5).slice(0, 6);
  const count = $('#match-count');
  if(count) count.textContent = picks.length;

  picks.forEach(p => {
    const pct = rint(78, 97);
    const el = document.createElement('div');
    el.className = 'match-card' + (S.vip ? ' unlocked' : '');
    el.innerHTML = `
      <div class="mc-pct">${pct}%</div>
      <div class="mc-av" style="background:${avatarColor(p.id)}">${escapeHtml(p.c)}</div>
      <div class="mc-name">${escapeHtml(p.name)}</div>
      <div class="mc-meta">${p.age} · ${escapeHtml(p.city)}</div>
      <div class="mc-bio">${escapeHtml(p.bio)}</div>
      <div class="mc-lock">${S.vip ? '✓ يمكن المراسلة' : '🔒 فتح المحادثة'}</div>
    `;
    el.addEventListener('click', () => { if(!S.vip) openModal('#wall'); });
    grid.appendChild(el);
  });
}

/* ═══ الأعضاء ═══ */
function renderMembers(){
  const list = $('#members-list');
  if(!list) return;
  list.innerHTML = '';
  [...PEOPLE].sort(() => Math.random() - 0.5).slice(0, 8).forEach(p => {
    const el = document.createElement('div');
    el.className = 'member-row';
    el.innerHTML = `
      <div class="avatar-sm" style="background:${avatarColor(p.id)}">${escapeHtml(p.c)}</div>
      <div class="member-info">
        <b>${escapeHtml(p.name)} <span style="color:var(--dim);font-weight:400;font-size:11px">· ${p.age} · ${escapeHtml(p.city)}</span></b>
        <span>${escapeHtml(p.bio)}</span>
      </div>
      <div class="member-right">
        <div class="member-id">${escapeHtml(p.id)}</div>
        <div class="online-tag">نشط</div>
      </div>
    `;
    el.addEventListener('click', () => { if(!S.vip) openModal('#wall'); });
    list.appendChild(el);
  });
}

/* ═══ الخدمات ═══ */
function renderServices(){
  const grid = $('#services-grid');
  if(!grid) return;
  grid.innerHTML = '';
  SERVICES.forEach(s => {
    const el = document.createElement('div');
    el.className = 'service-card';
    el.innerHTML = `
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-body">
        <div class="sc-title">${escapeHtml(s.title)}</div>
        <div class="sc-desc">${escapeHtml(s.desc)}</div>
      </div>
      <div class="sc-lock${S.vip ? ' on' : ''}">${S.vip ? '✓' : '🔒'}</div>
    `;
    el.addEventListener('click', () => { if(!S.vip) openModal('#wall'); });
    grid.appendChild(el);
  });
}

/* ═══ الإشعارات ═══ */
function renderNotifications(){
  const list = $('#notif-list');
  if(!list) return;
  list.innerHTML = '';
  for(let i = 0; i < rint(8, 12); i++){
    addNotifItem(rnd(PEOPLE), rnd(NOTIF_MSGS), rint(1,59) + ' دقيقة');
  }
}
function addNotifItem(p, msg, when){
  const list = $('#notif-list');
  if(!list) return;
  const el = document.createElement('div');
  el.className = 'notif-item';
  el.innerHTML = `
    <div class="avatar-sm" style="background:${avatarColor(p.id)}">${escapeHtml(p.c)}</div>
    <div class="notif-text">
      <b>${escapeHtml(p.name)}<span>${escapeHtml(p.id)}</span></b>
      <div class="notif-preview">${escapeHtml(msg)}</div>
    </div>
    <div class="notif-lock${S.vip ? ' on' : ''}">${S.vip ? '✓' : '🔒'}</div>
  `;
  el.addEventListener('click', () => { if(!S.vip) openModal('#wall'); });
  list.insertBefore(el, list.firstChild);
  while(list.children.length > 30) list.removeChild(list.lastChild);
}
function startNotifLoop(){
  if(S.notifTimer) clearInterval(S.notifTimer);
  S.notifTimer = setInterval(() => {
    addNotifItem(rnd(PEOPLE), rnd(NOTIF_MSGS), 'الآن');
    if(S.activeView !== 'notif'){
      const dot = $('#notif-dot');
      if(dot) dot.classList.add('on');
    }
  }, rint(24000, 45000));
}

/* ═══ الإحصائيات ═══ */
function updateStatsUI(){
  const v = $('#st-views'), l = $('#st-likes'), m = $('#st-match');
  if(v) v.textContent = S.stats.views;
  if(l) l.textContent = S.stats.likes;
  if(m) m.textContent = S.stats.matches;
}
function startStatsLoop(){
  if(S.onlineTimer) clearInterval(S.onlineTimer);
  if(S.statsTimer) clearInterval(S.statsTimer);

  S.onlineTimer = setInterval(() => {
    const n = rint(1100, 1480);
    const el = $('#online-count');
    if(el) el.textContent = n.toLocaleString('en');
  }, 4000);

  S.statsTimer = setInterval(() => {
    S.stats.views += rint(1, 4);
    if(Math.random() < 0.4) S.stats.likes += rint(0, 2);
    if(Math.random() < 0.2) S.stats.matches += 1;
    updateStatsUI();
  }, 6000);
}

/* ═══ الشريط المتحرك ═══ */
function buildTicker(){
  const track = $('#tick-track');
  if(!track) return;
  const oneSet = TICKER_ITEMS.map(([a,b]) =>
    `<span>⭐ <b>${escapeHtml(a)}</b> · ${escapeHtml(b)}</span>`
  ).join('');
  track.innerHTML =
    `<div class="tick-set">${oneSet}</div>` +
    `<div class="tick-set">${oneSet}</div>`;
}

/* ═══ العدّاد ═══ */
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
  if(S.countdownEnd < Date.now()){
    S.countdownEnd = Date.now() + 24 * 3600 * 1000;
    save();
  }
  const total = Math.max(0, Math.floor((S.countdownEnd - Date.now()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const str = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const el1 = $('#vip-count'), el2 = $('#wall-count');
  if(el1) el1.textContent = `ينتهي العرض: ${str}`;
  if(el2) el2.textContent = `ينتهي العرض خلال ${str}`;
}

/* ═══ VIP ═══ */
function updateVipUI(){
  const u = S.user;
  if(!u) return;
  const badge = $('#me-badge');
  const pBadge = $('#p-badge');
  const pId = $('#p-id');
  const roomLock = $('#room-lock');
  const vipbar = $('#vipbar');

  if(S.vip){
    if(!u.permanentID) u.permanentID = genPermanentID();
    $$('.me-name').forEach(el => el.textContent = `${u.name} · عضو`);
    if(badge){ badge.textContent = 'عضو ✓'; badge.classList.add('vip'); }
    if(pBadge){ pBadge.textContent = 'عضو مُفعّل'; pBadge.classList.add('vip'); }
    if(pId) pId.textContent = u.permanentID;
    if(roomLock){
      roomLock.innerHTML = '<div class="lock-inner vip">✓ العضوية مُفعّلة — يمكنك الكتابة الآن</div>';
    }
    if(vipbar) vipbar.style.display = 'none';
    $$('.match-card').forEach(c => {
      c.classList.add('unlocked');
      const lock = c.querySelector('.mc-lock');
      if(lock) lock.textContent = '✓ يمكن المراسلة';
    });
    $$('.notif-lock').forEach(l => { l.textContent = '✓'; l.classList.add('on'); });
    $$('.sc-lock').forEach(l => { l.textContent = '✓'; l.classList.add('on'); });
  } else {
    $$('.me-name').forEach(el => el.textContent = `${u.name} · زائر`);
    if(badge){ badge.textContent = 'حساب مجاني'; badge.classList.remove('vip'); }
    if(pBadge){ pBadge.textContent = 'حساب مجاني'; pBadge.classList.remove('vip'); }
    if(pId) pId.textContent = 'لا يوجد ID دائم';
    if(vipbar) vipbar.style.display = 'flex';
  }
}

/* ═══ أزرار الترقية ═══ */
['#btn-upgrade-top','#btn-upgrade-room','#btn-vip-bar',
 '#btn-upgrade-profile','#btn-upgrade-services']
  .forEach(sel => {
    const el = $(sel);
    if(el) el.addEventListener('click', () => {
      if(S.vip) return;
      openModal('#wall');
    });
  });

/* ═══ الجدار والباقات ═══ */
$('#wall-close').addEventListener('click', () => closeModal('#wall'));
$('#wall-go').addEventListener('click', () => {
  closeModal('#wall');
  openModal('#plans');
});
$('#plans-close').addEventListener('click', () => {
  S.pendingVerifyOpen = false;
  closeModal('#plans');
});

['#plans','#wall','#verify'].forEach(id => {
  const el = $(id);
  if(el) el.addEventListener('click', e => {
    if(e.target.id === id.slice(1)){
      if(id === '#plans') S.pendingVerifyOpen = false;
      closeModal(id);
    }
  });
});

$$('.plan').forEach(el => {
  el.addEventListener('click', () => {
    const plan = el.dataset.plan;
    window.open(tgLink(plan), '_blank', 'noopener');
    closeModal('#plans');
    if(!S.vip){
      S.pendingVerifyOpen = true;
      setTimeout(() => {
        if(S.pendingVerifyOpen && !S.vip) openModal('#verify');
        S.pendingVerifyOpen = false;
      }, 2500);
    }
  });
});

/* ═══ الكود ═══ */
$('#btn-verify-open').addEventListener('click', () => openModal('#verify'));
$('#verify-close').addEventListener('click', () => closeModal('#verify'));

$('#code-submit').addEventListener('click', () => {
  const input = $('#code-input').value.trim().toUpperCase();
  const hint = $('#code-hint');
  if(!hint) return;
  if(!input){
    hint.textContent = 'أدخل الكود'; hint.className = 'code-hint bad'; return;
  }
  if(!VALID_CODES.includes(input)){
    hint.textContent = 'الكود غير صحيح'; hint.className = 'code-hint bad'; return;
  }
  S.vip = true;
  S.user.permanentID = genPermanentID();
  save();
  hint.textContent = 'تم التفعيل ✓'; hint.className = 'code-hint ok';

  setTimeout(() => {
    closeModal('#verify');
    updateVipUI();
    renderMatches();
    renderMembers();
    renderServices();
    renderNotifications();
    $('#code-input').value = '';
    hint.textContent = '';
    hint.className = 'code-hint';
  }, 1200);
});

/* ═══ التنقل ═══ */
$$('.tab').forEach(t => {
  t.addEventListener('click', () => showView(t.dataset.v));
});

/* ═══ الإقلاع الأول ═══ */
const saved = load();
if(saved && saved.user && saved.user.name){
  S.user = saved.user;
  S.vip = saved.vip || false;
  S.countdownEnd = saved.countdownEnd || (Date.now() + 24 * 3600 * 1000);
  if(saved.userCode){
    S.userCode = saved.userCode;
  } else {
    S.userCode = genUserCode();
    save();
  }
  if(S.vip && !S.user.permanentID){
    S.user.permanentID = genPermanentID();
    save();
  }
  bootApp();
} else {
  showScreen('#scr-register');
}

})();
