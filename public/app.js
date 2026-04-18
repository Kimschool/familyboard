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
    if (r.status === 204) return null;
    return r.json();
  });
}

let ME = null;

// 테스트 중 임시: 로그인 화면 생략하고 admin 자동 로그인.
// 로그인 복구 시: AUTO_LOGIN=false + index.html 의 로그인 섹션 주석 해제.
const AUTO_LOGIN = true;
const AUTO_LOGIN_USER = 'admin';
const AUTO_LOGIN_PASS = 'admin1234';

// ---------- 화면 전환 ----------
async function boot() {
  try {
    const me = await api('/api/me');
    if (me.authed) { ME = me.user; enterApp(); return; }
  } catch {}
  if (AUTO_LOGIN) {
    try {
      const r = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: AUTO_LOGIN_USER, password: AUTO_LOGIN_PASS }),
      });
      ME = r.user;
      enterApp();
      return;
    } catch {
      document.body.innerHTML = '<pre style="padding:20px">자동 로그인 실패 — admin 비밀번호가 바뀐 듯합니다. app.js 의 AUTO_LOGIN_PASS 수정.</pre>';
      return;
    }
  }
  showLogin();
}

function showLogin() {
  const el = document.getElementById('login');
  if (el) { el.classList.remove('hidden'); $('app').classList.add('hidden'); setTimeout(() => $('un').focus(), 50); }
}

function enterApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  renderHero();
  $('tipsTitle').textContent = `${ME.displayName}님을 위한 오늘의 안내`;
  if (ME.role === 'admin') {
    $('adminCard').classList.remove('hidden');
    loadUsers();
  }
  loadBirthday();
  loadWeatherAndAir();
  loadFx();
  loadMemos();
  loadZodiac();
}

// ---------- 로그인 (AUTO_LOGIN=false 로 되돌리면 활성화) ----------
function bindLoginForm() {
  const btn = $('loginBtn'), un = $('un'), pw = $('pw');
  if (!btn || !un || !pw) return;
  btn.addEventListener('click', doLogin);
  un.addEventListener('keydown', (e) => { if (e.key === 'Enter') pw.focus(); });
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}
bindLoginForm();

async function doLogin() {
  const un = $('un'), pw = $('pw'), errEl = $('loginErr');
  if (!un || !pw) return;
  const username = un.value.trim();
  const password = pw.value;
  if (errEl) errEl.textContent = '';
  try {
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    ME = r.user;
    enterApp();
  } catch {
    if (errEl) errEl.textContent = '아이디 또는 비밀번호가 맞지 않아요.';
    pw.select();
  }
}

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

// ---------- Hero ----------
function renderHero() {
  const now = new Date();
  const weekday = ['일','월','화','수','목','금','토'][now.getDay()];
  $('todayStr').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekday}요일`;
  const h = now.getHours();
  const phase = h < 5 ? '편안한 새벽이에요'
    : h < 11 ? '좋은 아침이에요'
    : h < 14 ? '점심시간이에요'
    : h < 18 ? '좋은 오후에요'
    : h < 22 ? '편안한 저녁이에요'
    : '푹 주무세요';
  $('greeting').textContent = `${ME.displayName}님, ${phase}`;
}

// ---------- 생일 배너 ----------
async function loadBirthday() {
  try {
    const r = await api('/api/birthdays/soon');
    const el = $('birthdayBanner');
    if (r.today) {
      $('bdTitle').textContent = `오늘은 ${r.today.display_name}님 생일이에요`;
      $('bdSub').textContent = '따뜻한 하루 보내세요 🌷';
      el.classList.remove('hidden');
    } else if (r.upcoming?.length) {
      const u = r.upcoming[0];
      $('bdTitle').textContent = `${u.daysLeft}일 뒤 ${u.display_name}님 생일`;
      $('bdSub').textContent = `${u.birth_month}월 ${u.birth_day}일${u.is_lunar ? ' (음력)' : ''}`;
      el.classList.remove('hidden');
    }
  } catch {}
}

// ---------- 날씨 + 대기질 + 4가지 조언 ----------
const WMO = {
  0:'맑음', 1:'대체로 맑음', 2:'구름 조금', 3:'흐림',
  45:'안개', 48:'안개',
  51:'이슬비', 53:'이슬비', 55:'이슬비',
  61:'비', 63:'비', 65:'강한 비',
  71:'눈', 73:'눈', 75:'많은 눈',
  80:'소나기', 81:'소나기', 82:'강한 소나기',
  95:'천둥번개', 96:'천둥번개', 99:'천둥번개',
};
const WMO_ICON = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌦️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

async function loadWeatherAndAir() {
  try {
    const [w, a] = await Promise.all([
      fetch('/api/weather').then(r => r.json()),
      fetch('/api/air').then(r => r.json()),
    ]);
    $('wCity').textContent = `${w.city} · 오늘`;
    $('wDesc').textContent = WMO[w.code] || '';
    $('wIcon').textContent = WMO_ICON[w.code] || '🌤️';
    $('wTemp').textContent = `${w.temp}°`;
    $('wMax').textContent  = `${w.max}°`;
    $('wMin').textContent  = `${w.min}°`;
    $('wFeel').textContent = `${w.feels}°`;
    $('wHum').textContent  = `${w.humidity}%`;

    if (a.pm10 != null) { $('aPm10').textContent = Math.round(a.pm10); $('aPm10L').className = 'lvl ' + a.pm10Level; }
    if (a.pm25 != null) { $('aPm25').textContent = Math.round(a.pm25); $('aPm25L').className = 'lvl ' + a.pm25Level; }
    $('aPol').textContent = a.pollen != null ? Math.round(a.pollen) : '-';
    $('aPolL').className = 'lvl ' + (a.pollenLevel || 'unknown');

    renderTips(w, a);
  } catch {
    renderTips(null, null);
  }
}

function renderTips(w, a) {
  const name = ME.displayName;

  // 1. 기온 → 복장
  let dress = '날씨 정보를 불러오지 못했어요';
  if (w) {
    if      (w.temp <=  0) dress = `${name}님, 오늘은 두꺼운 외투와 목도리를 꼭 챙기세요`;
    else if (w.temp <=  8) dress = `${name}님, 따뜻한 외투와 장갑을 챙기시면 좋아요`;
    else if (w.temp <= 15) dress = `${name}님, 얇은 니트에 겉옷 한 벌이 딱 좋아요`;
    else if (w.temp <= 21) dress = `${name}님, 가벼운 겉옷이면 적당해요`;
    else if (w.temp <= 26) dress = `${name}님, 얇은 긴소매나 반팔이 좋아요`;
    else                   dress = `${name}님, 오늘은 반팔 · 시원한 옷을 추천해요`;
    if (w.rainProb >= 60) dress += ' (우산 꼭 챙기세요)';
  }
  $('tipDress').textContent = dress;

  // 2. 습도 → 건강
  let hum = '습도 정보를 불러오지 못했어요';
  if (w) {
    if      (w.humidity <= 30) hum = `공기가 건조해요. 물을 자주 드시고 가습기를 켜 두세요`;
    else if (w.humidity <= 45) hum = `약간 건조해요. 수분 섭취에 신경 써 주세요`;
    else if (w.humidity <= 65) hum = `적당한 습도예요. 편안한 하루가 되실 거예요`;
    else if (w.humidity <= 80) hum = `살짝 눅눅해요. 환기를 자주 해주세요`;
    else                       hum = `많이 습해요. 제습이나 환기를 꼭 해주세요`;
  }
  $('tipHum').textContent = hum;

  // 3. 공기질 → 마스크
  let air = '대기 정보를 불러오지 못했어요';
  if (a) {
    const bad = (x) => x === 'bad' || x === 'worst';
    if      (bad(a.pm25Level) || bad(a.pm10Level)) air = '미세먼지가 많아요. 외출 시 마스크를 꼭 써주세요';
    else if (a.pm25Level === 'normal' || a.pm10Level === 'normal') air = '공기는 보통 수준이에요. 민감하시면 마스크를 추천드려요';
    else if (a.pm25Level === 'good' && a.pm10Level === 'good') air = '공기가 맑아요. 산책하기 좋은 날이에요';
    else air = '공기 정보를 확인 중이에요';
  }
  $('tipAir').textContent = air;

  // 4. 꽃가루
  let pol = '꽃가루 정보를 불러오지 못했어요';
  if (a) {
    if      (a.pollenLevel === 'good')   pol = '꽃가루는 적어요. 걱정하지 않으셔도 돼요';
    else if (a.pollenLevel === 'normal') pol = '꽃가루가 조금 있어요. 알레르기가 있으시면 조심하세요';
    else if (a.pollenLevel === 'bad' || a.pollenLevel === 'worst') pol = '꽃가루가 많은 날이에요. 창문을 닫고 외출 후엔 세수를 해주세요';
    else pol = '꽃가루 상태를 확인하는 중이에요';
  }
  $('tipPollen').textContent = pol;
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
  if (!fxCache || !Number.isFinite(amt)) { $('calcResult').textContent = '—'; return; }
  const r = fxCache.rates;
  const usd = from === 'USD' ? amt : amt / r[from];
  const out = to === 'USD' ? usd : usd * r[to];
  const sym = to === 'KRW' ? '원' : to === 'JPY' ? '엔' : '$';
  const digits = to === 'USD' ? 2 : 0;
  $('calcResult').textContent = fmt.format(Number(out.toFixed(digits))) + sym;
}

// ---------- 메모 ----------
async function loadMemos() {
  try { renderMemos(await api('/api/memos')); }
  catch { renderMemos([]); }
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
      <div class="memo-body">
        <span class="memo-text ${m.done ? 'done' : ''}"></span>
        <span class="memo-author"></span>
      </div>
      <button class="memo-del" aria-label="삭제">✕</button>
    `;
    li.querySelector('.memo-text').textContent = m.content;
    li.querySelector('.memo-author').textContent = m.created_by_name ? `· ${m.created_by_name}` : '';
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

// ---------- 띠별 운세 ----------
const ZODIAC_EMOJI = { '쥐':'🐭','소':'🐮','호랑이':'🐯','토끼':'🐰','용':'🐲','뱀':'🐍','말':'🐴','양':'🐑','원숭이':'🐵','닭':'🐔','개':'🐶','돼지':'🐷' };

async function loadZodiac() {
  try {
    const list = await api('/api/zodiac');
    const ul = $('zodiacList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="zodiac-empty">가족 정보가 등록되면 운세가 보여요</li>';
      return;
    }
    for (const z of list) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="zodiac-emoji">${ZODIAC_EMOJI[z.zodiac] || '✨'}</span>
        <div class="zodiac-body">
          <div class="zodiac-top">
            <span class="zodiac-name"></span>
            <span class="zodiac-tag"></span>
          </div>
          <div class="zodiac-fortune"></div>
        </div>
      `;
      li.querySelector('.zodiac-name').textContent = z.name;
      li.querySelector('.zodiac-tag').textContent = `${z.zodiac}띠`;
      li.querySelector('.zodiac-fortune').textContent = z.fortune;
      ul.appendChild(li);
    }
  } catch {}
}

// ---------- 가족 관리 (관리자만) ----------
$('adminToggle').addEventListener('click', () => {
  $('adminBody').classList.toggle('hidden');
  $('adminToggle').classList.toggle('open');
});

async function loadUsers() {
  try {
    const users = await api('/api/users');
    const ul = $('userList');
    ul.innerHTML = '';
    for (const u of users) {
      const li = document.createElement('li');
      const dob = u.birthYear ? `${u.birthYear}.${u.birthMonth || '-'}.${u.birthDay || '-'}${u.isLunar ? ' 음' : ''}` : '생일 미등록';
      li.innerHTML = `
        <div>
          <div class="user-name"></div>
          <div class="user-sub"></div>
        </div>
        <button class="user-del" aria-label="삭제"${u.id === ME.id ? ' disabled' : ''}>✕</button>
      `;
      li.querySelector('.user-name').textContent = `${u.displayName} (${u.username})`;
      li.querySelector('.user-sub').textContent = `${u.role === 'admin' ? '관리자' : '가족'} · ${dob}`;
      const del = li.querySelector('.user-del');
      if (u.id !== ME.id) {
        del.onclick = async () => {
          if (!confirm(`${u.displayName}님을 삭제할까요?`)) return;
          await api(`/api/users/${u.id}`, { method: 'DELETE' });
          loadUsers();
          loadZodiac();
        };
      }
      ul.appendChild(li);
    }
  } catch {}
}

$('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    username: $('uUsername').value.trim(),
    displayName: $('uDisplay').value.trim(),
    password: $('uPassword').value,
    birthYear: $('uYear').value || null,
    birthMonth: $('uMonth').value || null,
    birthDay: $('uDay').value || null,
    isLunar: $('uLunar').checked,
  };
  if (!body.username || !body.displayName || !body.password || body.password.length < 4) {
    alert('아이디, 이름, 비밀번호(최소 4자)를 채워 주세요');
    return;
  }
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
    ['uUsername','uDisplay','uPassword','uYear','uMonth','uDay'].forEach((id) => $(id).value = '');
    $('uLunar').checked = false;
    loadUsers();
    loadZodiac();
    loadBirthday();
  } catch (e) {
    alert(e.status === 409 ? '이미 쓰이는 아이디예요' : '등록 실패');
  }
});

// ---------- SW (테스트 중: 언레지스터 + 캐시 삭제) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  if (window.caches) {
    caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

boot();
