// ---------- 유틸 ----------
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('ko-KR');

function api(path, opts = {}) {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(async (r) => {
    if (!r.ok) throw Object.assign(new Error('http'), { status: r.status });
    return r.json();
  });
}

// ---------- 화면 전환 ----------
async function boot() {
  try {
    const me = await api('/api/me');
    if (me.authed) enterApp();
    else showLogin();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('login').classList.remove('hidden');
  $('app').classList.add('hidden');
  setTimeout(() => $('pw').focus(), 50);
}

function enterApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  renderHero();
  loadBirthday();
  loadWeatherAndAir();
  loadFx();
  loadMemos();
  renderMusic();
}

// ---------- 로그인 ----------
$('loginBtn')?.addEventListener('click', doLogin);
$('pw')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const pw = $('pw').value;
  $('loginErr').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
    enterApp();
  } catch {
    $('loginErr').textContent = '비밀번호가 맞지 않아요.';
    $('pw').select();
  }
}

$('logoutBtn')?.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

// ---------- Hero (날짜/인사) ----------
function renderHero() {
  const now = new Date();
  const weekday = ['일','월','화','수','목','금','토'][now.getDay()];
  $('todayStr').textContent =
    `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekday}요일`;
  const h = now.getHours();
  const greet = h < 5 ? '편안한 새벽이에요'
    : h < 11 ? '좋은 아침이에요'
    : h < 14 ? '점심시간이에요'
    : h < 18 ? '좋은 오후에요'
    : h < 22 ? '편안한 저녁이에요'
    : '푹 주무세요';
  $('greeting').textContent = greet;
}

// ---------- 생일 배너 ----------
async function loadBirthday() {
  try {
    const r = await fetch('/api/birthdays/soon').then(r => r.json());
    const el = $('birthdayBanner');
    if (r.today) {
      $('bdTitle').textContent = `오늘은 ${r.today.name}님 생일이에요`;
      $('bdSub').textContent = r.today.note || '따뜻한 하루 보내세요 🌷';
      el.classList.remove('hidden');
    } else if (r.upcoming?.length) {
      const u = r.upcoming[0];
      $('bdTitle').textContent = `${u.daysLeft}일 뒤 ${u.name}님 생일`;
      $('bdSub').textContent = `${u.month}월 ${u.day}일 ${u.is_lunar ? '(음력)' : ''}`;
      el.classList.remove('hidden');
    }
  } catch { /* banner optional */ }
}

// ---------- 날씨 + 대기질 ----------
const WMO = {
  0:  { icon: '☀️', text: '맑음' },
  1:  { icon: '🌤️', text: '대체로 맑음' },
  2:  { icon: '⛅', text: '구름 조금' },
  3:  { icon: '☁️', text: '흐림' },
  45: { icon: '🌫️', text: '안개' },
  48: { icon: '🌫️', text: '안개' },
  51: { icon: '🌦️', text: '이슬비' },
  53: { icon: '🌦️', text: '이슬비' },
  55: { icon: '🌦️', text: '이슬비' },
  61: { icon: '🌧️', text: '비' },
  63: { icon: '🌧️', text: '비' },
  65: { icon: '🌧️', text: '강한 비' },
  71: { icon: '🌨️', text: '눈' },
  73: { icon: '🌨️', text: '눈' },
  75: { icon: '❄️', text: '많은 눈' },
  80: { icon: '🌦️', text: '소나기' },
  81: { icon: '🌧️', text: '소나기' },
  82: { icon: '⛈️', text: '강한 소나기' },
  95: { icon: '⛈️', text: '천둥번개' },
  96: { icon: '⛈️', text: '천둥번개' },
  99: { icon: '⛈️', text: '천둥번개' },
};

async function loadWeatherAndAir() {
  try {
    const [w, a] = await Promise.all([
      fetch('/api/weather').then(r => r.json()),
      fetch('/api/air').then(r => r.json()),
    ]);
    const wmo = WMO[w.code] || { icon: '🌤️', text: '' };
    $('wCity').textContent = `${w.city} · 오늘`;
    $('wDesc').textContent = wmo.text;
    $('wIcon').textContent = wmo.icon;
    $('wTemp').textContent = `${w.temp}°`;
    $('wMax').textContent = `${w.max}°`;
    $('wMin').textContent = `${w.min}°`;
    $('wFeel').textContent = `${w.feels}°`;
    $('wHum').textContent = `${w.humidity}%`;

    if (a.pm10 != null)  { $('aPm10').textContent = Math.round(a.pm10); $('aPm10L').className = 'lvl ' + a.pm10Level; }
    if (a.pm25 != null)  { $('aPm25').textContent = Math.round(a.pm25); $('aPm25L').className = 'lvl ' + a.pm25Level; }
    $('aPol').textContent = a.pollen != null ? Math.round(a.pollen) : '-';
    $('aPolL').className = 'lvl ' + (a.pollenLevel || 'unknown');

    $('wTip').textContent = buildTip(w, a);
  } catch {
    $('wTip').textContent = '날씨 정보를 불러오지 못했어요.';
  }
}

function buildTip(w, a) {
  const parts = [];
  if (w.temp <= 5) parts.push('따뜻한 외투를 꼭 챙기세요');
  else if (w.temp <= 12) parts.push('얇은 니트에 외투 한 벌이 좋아요');
  else if (w.temp <= 20) parts.push('가벼운 겉옷이면 적당해요');
  else if (w.temp <= 26) parts.push('얇은 옷이 좋아요');
  else parts.push('시원한 옷으로 입으세요');

  if (w.rainProb >= 60) parts.push('우산을 챙기시는 게 좋아요');
  if (a.pm25Level === 'bad' || a.pm25Level === 'worst' || a.pm10Level === 'bad' || a.pm10Level === 'worst') {
    parts.push('마스크를 쓰시는 걸 추천드려요');
  }
  if (a.pollenLevel === 'bad' || a.pollenLevel === 'worst') parts.push('꽃가루가 많으니 창문을 닫아 두세요');
  if (w.humidity <= 30) parts.push('건조해요, 물 자주 드세요');

  return parts.slice(0, 3).join(' · ') + '.';
}

// ---------- 환율 ----------
let fxCache = null;
async function loadFx() {
  try {
    const r = await fetch('/api/fx').then(r => r.json());
    fxCache = r;
    $('fxJpyKrw').textContent = fmt.format(Math.round(r.jpyKrw)) + '원';
    $('fxUsdJpy').textContent = r.usdJpy.toFixed(2) + '엔';
    $('fxUsdKrw').textContent = fmt.format(r.usdKrw) + '원';
    const ts = new Date(r.ts);
    $('fxTs').textContent = `기준: ${ts.getMonth() + 1}월 ${ts.getDate()}일 ${String(ts.getHours()).padStart(2,'0')}시`;
    calcUpdate();
  } catch {
    $('fxJpyKrw').textContent = $('fxUsdJpy').textContent = $('fxUsdKrw').textContent = '—';
  }
}

// ---------- 계산기 ----------
['calcAmt','calcFrom','calcTo'].forEach((id) => {
  $(id).addEventListener('input', calcUpdate);
  $(id).addEventListener('change', calcUpdate);
});

function calcUpdate() {
  const amt = parseFloat($('calcAmt').value);
  const from = $('calcFrom').value;
  const to = $('calcTo').value;
  if (!fxCache || !Number.isFinite(amt)) {
    $('calcResult').textContent = '—';
    return;
  }
  // rates are vs USD
  const r = fxCache.rates;
  const usd = from === 'USD' ? amt : amt / r[from];
  const out = to === 'USD' ? usd : usd * r[to];
  const sym = to === 'KRW' ? '원' : to === 'JPY' ? '엔' : '$';
  const digits = to === 'USD' ? 2 : 0;
  $('calcResult').textContent = fmt.format(Number(out.toFixed(digits))) + sym;
}

// ---------- 메모 ----------
async function loadMemos() {
  try {
    const list = await api('/api/memos');
    renderMemos(list);
  } catch { renderMemos([]); }
}

function renderMemos(list) {
  const ul = $('memoList');
  ul.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="memo-text" style="color:var(--sub)">적혀 있는 메모가 없어요</span>';
    ul.appendChild(li);
    return;
  }
  for (const m of list) {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="memo-check ${m.done ? 'done' : ''}" aria-label="완료"></button>
      <span class="memo-text ${m.done ? 'done' : ''}"></span>
      <button class="memo-del" aria-label="삭제">✕</button>
    `;
    li.querySelector('.memo-text').textContent = m.content;
    li.querySelector('.memo-check').onclick = async () => {
      await api(`/api/memos/${m.id}`, { method: 'PATCH', body: JSON.stringify({ done: !m.done }) });
      loadMemos();
    };
    li.querySelector('.memo-del').onclick = async () => {
      await api(`/api/memos/${m.id}`, { method: 'DELETE' });
      loadMemos();
    };
    ul.appendChild(li);
  }
}

$('memoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('memoInput').value.trim();
  if (!v) return;
  await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: v }) });
  $('memoInput').value = '';
  loadMemos();
});

// ---------- 음악 (정적 추천 리스트) ----------
const MUSIC = [
  { title: '잔잔한 피아노',    sub: '집중이 필요할 때',       url: 'https://www.youtube.com/results?search_query=calm+piano' },
  { title: '비 오는 날 재즈',  sub: '창밖을 보며',           url: 'https://www.youtube.com/results?search_query=rainy+day+jazz' },
  { title: '7080 가요',        sub: '추억의 노래',           url: 'https://www.youtube.com/results?search_query=7080+%EA%B0%80%EC%9A%94' },
  { title: '자연의 소리',       sub: '편안한 휴식',           url: 'https://www.youtube.com/results?search_query=nature+sound+8+hours' },
  { title: '클래식 명곡',       sub: '마음이 차분해지는',     url: 'https://www.youtube.com/results?search_query=classical+music+playlist' },
];

function renderMusic() {
  const ul = $('musicList');
  ul.innerHTML = '';
  for (const m of MUSIC) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="music-play">▶</div>
      <div>
        <div class="music-title"></div>
        <div class="music-sub"></div>
      </div>
    `;
    li.querySelector('.music-title').textContent = m.title;
    li.querySelector('.music-sub').textContent = m.sub;
    li.onclick = () => window.open(m.url, '_blank', 'noopener');
    ul.appendChild(li);
  }
}

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

boot();
