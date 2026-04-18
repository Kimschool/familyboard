// ---------- 아이콘 세트 (label 은 title 툴팁용) ----------
const ICONS = [
  { code: 'dad',        emoji: '👨',    label: '아빠' },
  { code: 'mom',        emoji: '👩',    label: '엄마' },
  { code: 'grandpa',    emoji: '👴',    label: '할아버지' },
  { code: 'grandma',    emoji: '👵',    label: '할머니' },
  { code: 'grandpaOut', emoji: '🧓',    label: '외할아버지' },
  { code: 'grandmaOut', emoji: '🧕',    label: '외할머니' },
  { code: 'son',        emoji: '👦',    label: '아들' },
  { code: 'daughter',   emoji: '👧',    label: '딸' },
  { code: 'boyTeen',    emoji: '🙋‍♂️', label: '남자아이' },
  { code: 'girlTeen',   emoji: '🙋‍♀️', label: '여자아이' },
  { code: 'baby',       emoji: '👶',    label: '아기' },
  { code: 'nephew',     emoji: '🧒',    label: '조카' },
  { code: 'uncle',      emoji: '🧔',    label: '삼촌' },
  { code: 'aunt',       emoji: '👱‍♀️', label: '이모' },
  { code: 'cousin',     emoji: '🧑',    label: '사촌' },
  { code: 'manElder',   emoji: '🧔‍♂️', label: '아저씨' },
  { code: 'womanElder', emoji: '💇‍♀️', label: '아주머니' },
  { code: 'manWhite',   emoji: '👨‍🦳', label: '백발 남' },
  { code: 'womanWhite', emoji: '👩‍🦳', label: '백발 여' },
  { code: 'manCurly',   emoji: '👨‍🦱', label: '곱슬 남' },
  { code: 'womanCurly', emoji: '👩‍🦱', label: '곱슬 여' },
  { code: 'manRed',     emoji: '👨‍🦰', label: '빨강머리 남' },
  { code: 'womanRed',   emoji: '👩‍🦰', label: '빨강머리 여' },
  { code: 'manBald',    emoji: '👨‍🦲', label: '민머리 남' },
  { code: 'womanBald',  emoji: '👩‍🦲', label: '민머리 여' },
  { code: 'mustache',   emoji: '🥸',    label: '콧수염' },
  { code: 'glasses',    emoji: '🤓',    label: '안경' },
  { code: 'cool',       emoji: '😎',    label: '멋쟁이' },
  { code: 'smile',      emoji: '😊',    label: '웃음' },
  { code: 'love',       emoji: '🥰',    label: '사랑' },
  { code: 'angel',      emoji: '😇',    label: '천사' },
  { code: 'princess',   emoji: '👸',    label: '공주' },
  { code: 'prince',     emoji: '🤴',    label: '왕자' },
  { code: 'chef',       emoji: '👨‍🍳', label: '요리사' },
  { code: 'teacher',    emoji: '👩‍🏫', label: '선생님' },
  { code: 'artist',     emoji: '👨‍🎨', label: '화가' },
  { code: 'doctor',     emoji: '👨‍⚕️', label: '의사' },
  { code: 'farmer',     emoji: '👩‍🌾', label: '농부' },
  { code: 'santa',      emoji: '🎅',    label: '산타' },
  { code: 'ninja',      emoji: '🥷',    label: '닌자' },
  { code: 'dog',        emoji: '🐶',    label: '강아지' },
  { code: 'cat',        emoji: '🐱',    label: '고양이' },
  { code: 'bunny',      emoji: '🐰',    label: '토끼' },
  { code: 'bear',       emoji: '🐻',    label: '곰' },
  { code: 'panda',      emoji: '🐼',    label: '판다' },
  { code: 'fox',        emoji: '🦊',    label: '여우' },
  { code: 'lion',       emoji: '🦁',    label: '사자' },
  { code: 'tiger',      emoji: '🐯',    label: '호랑이' },
  { code: 'horse',      emoji: '🐴',    label: '말' },
  { code: 'deer',       emoji: '🦌',    label: '사슴' },
  { code: 'monkey',     emoji: '🐵',    label: '원숭이' },
  { code: 'bird',       emoji: '🐦',    label: '새' },
  { code: 'chick',      emoji: '🐥',    label: '병아리' },
  { code: 'penguin',    emoji: '🐧',    label: '펭귄' },
  { code: 'star',       emoji: '⭐',    label: '스타' },
  { code: 'heart',      emoji: '❤️',    label: '하트' },
  { code: 'flower',     emoji: '🌸',    label: '꽃' },
  { code: 'sun',        emoji: '☀️',    label: '해' },
  { code: 'moon',       emoji: '🌙',    label: '달' },
  { code: 'rainbow',    emoji: '🌈',    label: '무지개' },
];
const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.code, i]));
const iconEmoji = (code) => (ICON_MAP[code] || ICON_MAP.star).emoji;
const iconLabel = (code) => (ICON_MAP[code] || ICON_MAP.star).label;

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

function showOnly(id) {
  ['invite','step1','step2','step3','app'].forEach((x) => {
    const el = $(x); if (el) el.classList.toggle('hidden', x !== id);
  });
}

let ME = null;
let FAMILY_ALIAS = localStorage.getItem('fb_alias') || '';
let PICKED = null;

// ---------- 부팅 ----------
async function boot() {
  // 초대 링크?
  const params = new URLSearchParams(location.search);
  const inviteToken = params.get('token') || (location.pathname.startsWith('/invite/') ? location.pathname.slice('/invite/'.length) : null);
  if (location.pathname === '/invite' && inviteToken) {
    return showInvite(inviteToken);
  }

  try {
    const me = await api('/api/me');
    if (me.authed) { ME = me.user; enterApp(); return; }
  } catch {}
  startLogin();
}

function startLogin() {
  if (FAMILY_ALIAS) {
    $('aliasInput').value = FAMILY_ALIAS;
    goStep2(FAMILY_ALIAS).catch(() => showOnly('step1'));
  } else {
    showOnly('step1');
    setTimeout(() => $('aliasInput').focus(), 50);
  }
}

// ---------- Step 1: 가족별칭 ----------
$('aliasNext').addEventListener('click', submitAlias);
$('aliasInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAlias(); });

async function submitAlias() {
  const alias = $('aliasInput').value.trim();
  $('aliasErr').textContent = '';
  if (!alias) { $('aliasErr').textContent = '가족별칭을 입력해 주세요'; return; }
  try {
    await goStep2(alias);
    FAMILY_ALIAS = alias;
    localStorage.setItem('fb_alias', alias);
  } catch (e) {
    $('aliasErr').textContent = e.status === 404 ? '그런 가족별칭이 없어요' : '확인 중 오류';
  }
}

async function goStep2(alias) {
  const data = await api(`/api/family/${encodeURIComponent(alias)}`);
  $('familyTitle').textContent = data.family.displayName || alias;
  renderMemberGrid(data.members);
  showOnly('step2');
}

function renderMemberGrid(members) {
  const grid = $('memberGrid');
  grid.innerHTML = '';
  if (!members.length) {
    grid.innerHTML = '<p class="zodiac-empty">구성원이 아직 없어요</p>';
    return;
  }
  for (const m of members) {
    const btn = document.createElement('button');
    btn.className = 'member-card' + (m.activated ? '' : ' pending');
    btn.innerHTML = `
      <span class="member-emoji">${iconEmoji(m.icon)}</span>
      <span class="member-name"></span>
      ${m.activated ? '' : '<span class="member-pending">초대 대기</span>'}
    `;
    btn.querySelector('.member-name').textContent = m.displayName;
    btn.onclick = () => {
      if (!m.activated) {
        alert('아직 비밀번호를 설정하지 않은 계정이에요. 관리자가 보낸 초대 링크를 열어주세요.');
        return;
      }
      PICKED = m;
      $('pickedIcon').textContent = iconEmoji(m.icon);
      $('pickedName').textContent = m.displayName;
      $('pw').value = '';
      showOnly('step3');
      setTimeout(() => $('pw').focus(), 50);
    };
    grid.appendChild(btn);
  }
}

$('back1').addEventListener('click', () => showOnly('step1'));
$('back2').addEventListener('click', () => showOnly('step2'));

// ---------- Step 3: 비밀번호 ----------
$('loginBtn').addEventListener('click', doLogin);
$('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  $('loginErr').textContent = '';
  const pw = $('pw').value;
  if (!pw) return;
  try {
    const r = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ alias: FAMILY_ALIAS, userId: PICKED.id, password: pw }),
    });
    ME = r.user;
    enterApp();
  } catch (e) {
    $('loginErr').textContent = e.status === 401 ? '비밀번호가 맞지 않아요' : '오류가 발생했어요';
    $('pw').select();
  }
}

// ---------- 초대 수락 ----------
let INVITE_TOKEN = null;
async function showInvite(token) {
  INVITE_TOKEN = token;
  try {
    const r = await api(`/api/invite/${encodeURIComponent(token)}`);
    $('invIcon').textContent = iconEmoji(r.member.icon);
    $('invTitle').textContent = `${r.member.displayName}님, 환영해요`;
    $('invSub').textContent = `${r.family.displayName} 가족에 초대되셨어요. 비밀번호를 만들어 주세요.`;
    showOnly('invite');
    setTimeout(() => $('invPw').focus(), 50);
  } catch (e) {
    document.body.innerHTML = `<div style="padding:28px;font-family:-apple-system,sans-serif">
      <h2>초대 링크가 유효하지 않아요</h2>
      <p style="color:#6E6E73">만료되었거나 이미 사용된 링크일 수 있어요. 관리자에게 새 링크를 요청해 주세요.</p>
      <a href="/" style="color:#0A84FF">처음으로</a>
    </div>`;
  }
}

$('invSubmit').addEventListener('click', acceptInvite);
[$('invPw'), $('invPw2')].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') acceptInvite(); }));

async function acceptInvite() {
  $('invErr').textContent = '';
  const p1 = $('invPw').value, p2 = $('invPw2').value;
  if (p1.length < 4) { $('invErr').textContent = '비밀번호는 최소 4자 이상이어야 해요'; return; }
  if (p1 !== p2)     { $('invErr').textContent = '두 비밀번호가 달라요'; return; }
  try {
    const r = await api(`/api/invite/${encodeURIComponent(INVITE_TOKEN)}/accept`, {
      method: 'POST', body: JSON.stringify({ password: p1 }),
    });
    ME = r.user;
    FAMILY_ALIAS = r.user.familyAlias;
    localStorage.setItem('fb_alias', FAMILY_ALIAS);
    history.replaceState(null, '', '/');
    enterApp();
  } catch (e) {
    $('invErr').textContent = e.status === 410 ? '만료된 초대 링크예요'
      : e.status === 404 ? '유효하지 않은 초대 링크예요' : '오류가 발생했어요';
  }
}

// ---------- 메인 진입 ----------
function enterApp() {
  showOnly('app');
  try { renderHero(); } catch (e) { console.warn('[hero]', e); }
  try { $('tipsTitle').textContent = `${ME.displayName}님을 위한 오늘의 안내`; } catch {}
  try { renderAccount(); } catch {}

  // 가족 공통 데이터 — 하나 실패해도 다른 카드는 로드되게
  loadFamilySummary();
  loadBirthday();
  loadWeatherAndAir();
  loadFx();
  loadMemos();
  loadZodiac();
  loadTodayQuestion();
  loadYesterdayReveal();

  // 관리자 UI (에러 나도 위 카드에 영향 없게)
  try {
    if (ME.role === 'admin') {
      $('adminCard').classList.remove('hidden');
      loadUsers();
      loadFamilyInfo();
      renderIconPicker();
    } else {
      $('adminCard')?.classList.add('hidden');
    }
  } catch (e) { console.warn('[admin ui]', e); }
}

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
    : h < 22 ? '편안한 저녁이에요' : '푹 주무세요';
  $('greeting').textContent = `${ME.displayName}님, ${phase}`;
  $('heroAvatar').textContent = iconEmoji(ME.icon);

  // 시간대별 배경 톤
  const tod = h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'noon' : h < 20 ? 'evening' : 'night';
  document.body.classList.remove('tod-morning','tod-noon','tod-evening','tod-night');
  document.body.classList.add('tod-' + tod);
}

function updateHeroWeather(w) {
  const el = $('heroWeather');
  if (!el || !w) return;
  const tag = w.temp <= 5 ? '추운'
    : w.temp <= 12 ? '쌀쌀한'
    : w.temp <= 20 ? '선선한'
    : w.temp <= 26 ? '따뜻한' : '더운';
  const icon = WMO_ICON[w.code] || '🌤️';
  const rain = w.rainProb >= 60 ? ' · 비 확률 높음' : '';
  el.textContent = `${icon} ${tag} ${w.temp}°, ${WMO[w.code] || ''}${rain}`;
  el.classList.remove('hidden');
}

function renderAccount() {
  $('accountAvatar').textContent = iconEmoji(ME.icon);
  $('accountName').textContent = `${ME.displayName}님으로 로그인 중`;
  $('accountMeta').textContent = `${ME.familyName || ''} · ${ME.role === 'admin' ? '관리자' : '가족'}`;
}

$('logoutBtn').addEventListener('click', async () => {
  if (!confirm('로그아웃 하시겠어요?')) return;
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  // 가족별칭은 기억 (다음 로그인 편의)
  location.reload();
});

// ---------- 우리 가족 요약 ----------
function koreanAge(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - Number(birthYear) + 1;
}

function relativeTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60)      return '방금';
  if (diffSec < 3600)    return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400)   return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 604800)  return `${Math.floor(diffSec / 86400)}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

let FAMILY_CACHE = [];
let ZODIAC_CACHE = [];

async function loadFamilySummary() {
  try {
    const alias = ME.familyAlias;
    if (!alias) return;
    const r = await fetch(`/api/family/${encodeURIComponent(alias)}`).then(r => r.json());
    FAMILY_CACHE = r.members;
    $('familyCardTitle').textContent = r.family.displayName || '우리 가족';
    const row = $('familyRow');
    row.innerHTML = '';
    for (const m of r.members) {
      const age = koreanAge(m.birthYear);
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'family-badge' + (m.id === ME.id ? ' me' : '') + (m.activated ? '' : ' dim');
      badge.innerHTML = `
        <span class="family-badge-emoji">${iconEmoji(m.icon)}</span>
        <span class="family-badge-name"></span>
        ${age ? `<span class="family-badge-age">${age}</span>` : ''}
      `;
      badge.querySelector('.family-badge-name').textContent = m.displayName;
      badge.onclick = () => openProfileSheet(m);
      row.appendChild(badge);
    }
  } catch {}
}

function openProfileSheet(m) {
  const age = koreanAge(m.birthYear);
  $('profAvatar').textContent = iconEmoji(m.icon);
  $('profName').textContent = m.displayName + (m.id === ME.id ? ' (나)' : '');
  $('profMeta').textContent = m.role === 'admin' ? '관리자' : '가족';
  if (age) { $('profAge').textContent = `${age}세 (${m.birthYear}년생)`; $('profAgeRow').classList.remove('hidden'); }
  else $('profAgeRow').classList.add('hidden');

  const z = ZODIAC_CACHE.find((x) => x.name === m.displayName);
  if (z) {
    $('profZodiac').textContent  = `${z.zodiac}띠`;
    $('profFortune').textContent = z.fortune;
    $('profZodiacRow').classList.remove('hidden');
    $('profFortuneRow').classList.remove('hidden');
  } else {
    $('profZodiacRow').classList.add('hidden');
    $('profFortuneRow').classList.add('hidden');
  }

  $('profileSheet').classList.remove('hidden');
}

function closeProfileSheet() {
  $('profileSheet').classList.add('hidden');
}

// ---------- 생일 + 이번 주 기념일 ----------
async function loadBirthday() {
  try {
    const r = await api('/api/birthdays/soon');
    renderUpcomingCard(r);
    const el = $('birthdayBanner');
    el.classList.remove('today');
    if (r.today) {
      const isMe = ME && r.today.display_name === ME.displayName;
      $('bdEmoji').textContent = isMe ? '🎉' : iconEmoji(r.today.icon);
      $('bdTitle').textContent = isMe
        ? `${ME.displayName}님, 생일 축하드려요!`
        : `오늘은 ${r.today.display_name}님 생일이에요`;
      $('bdSub').textContent = isMe
        ? '가족 모두가 함께 축하하고 있어요 🎂'
        : '따뜻한 축하 한마디 전해보세요 🌷';
      el.classList.add('today');
      el.classList.remove('hidden');
    } else if (r.upcoming?.length) {
      const u = r.upcoming[0];
      $('bdEmoji').textContent = iconEmoji(u.icon);
      $('bdTitle').textContent = `${u.daysLeft}일 뒤 ${u.display_name}님 생일`;
      $('bdSub').textContent = `${u.birth_month}월 ${u.birth_day}일${u.is_lunar ? ' (음력)' : ''}`;
      el.classList.remove('hidden');
    }
  } catch {}
}

function renderUpcomingCard(r) {
  const list = [];
  if (r.today) list.push({ ...r.today, daysLeft: 0 });
  if (r.upcoming) list.push(...r.upcoming);
  const card = $('upcomingCard');
  const ul = $('upcomingList');
  if (!list.length) { card.classList.add('hidden'); return; }
  ul.innerHTML = '';
  for (const u of list) {
    const li = document.createElement('li');
    const dayLabel = u.daysLeft === 0 ? '오늘'
      : u.daysLeft === 1 ? '내일'
      : `${u.daysLeft}일 뒤`;
    li.innerHTML = `
      <span class="up-emoji">${iconEmoji(u.icon)}</span>
      <div class="up-body">
        <div class="up-name"></div>
        <div class="up-date">${u.birth_month}월 ${u.birth_day}일${u.is_lunar ? ' (음력)' : ''} 생일</div>
      </div>
      <span class="up-days ${u.daysLeft === 0 ? 'today' : ''}"></span>`;
    li.querySelector('.up-name').textContent = `${u.display_name}님`;
    li.querySelector('.up-days').textContent = dayLabel;
    ul.appendChild(li);
  }
  card.classList.remove('hidden');
}

// ---------- 날씨 + 대기질 + 4가지 조언 ----------
const WMO = {
  0:'맑음', 1:'대체로 맑음', 2:'구름 조금', 3:'흐림',
  45:'안개', 48:'안개', 51:'이슬비', 53:'이슬비', 55:'이슬비',
  61:'비', 63:'비', 65:'강한 비',
  71:'눈', 73:'눈', 75:'많은 눈',
  80:'소나기', 81:'소나기', 82:'강한 소나기',
  95:'천둥번개', 96:'천둥번개', 99:'천둥번개',
};
const WMO_ICON = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️', 45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌦️', 61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️', 80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

async function loadWeatherAndAir() {
  const wP = fetch('/api/weather').then(r => r.ok ? r.json() : null).catch(() => null);
  const aP = fetch('/api/air').then(r => r.ok ? r.json() : null).catch(() => null);
  const [w, a] = await Promise.all([wP, aP]);

  if (w) {
    $('wCity').textContent = `${w.city} · 오늘`;
    $('wDesc').textContent = WMO[w.code] || '';
    $('wIcon').textContent = WMO_ICON[w.code] || '🌤️';
    $('wTemp').textContent = `${w.temp}°`;
    $('wMax').textContent  = `${w.max}°`;
    $('wMin').textContent  = `${w.min}°`;
    $('wFeel').textContent = `${w.feels}°`;
    $('wHum').textContent  = `${w.humidity}%`;
    updateHeroWeather(w);
    if (w.tomorrow) {
      $('tmIcon').textContent = WMO_ICON[w.tomorrow.code] || '🌤️';
      $('tmMax').textContent = `${w.tomorrow.max}°`;
      $('tmMin').textContent = `${w.tomorrow.min}°`;
      $('tmRain').classList.toggle('hidden', (w.tomorrow.rainProb || 0) < 60);
      $('tomorrowBlock').classList.remove('hidden');
    }
  } else {
    $('wDesc').textContent = '날씨 정보를 잠시 후 다시 시도해요';
  }

  if (a) {
    if (a.pm10 != null) { $('aPm10').textContent = Math.round(a.pm10); $('aPm10L').className = 'lvl ' + a.pm10Level; }
    if (a.pm25 != null) { $('aPm25').textContent = Math.round(a.pm25); $('aPm25L').className = 'lvl ' + a.pm25Level; }
    $('aPol').textContent = a.pollen != null ? Math.round(a.pollen) : '-';
    $('aPolL').className = 'lvl ' + (a.pollenLevel || 'unknown');
  }

  renderTips(w, a);
}

function renderTips(w, a) {
  const name = ME.displayName;
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

  let hum = '습도 정보를 불러오지 못했어요';
  if (w) {
    if      (w.humidity <= 30) hum = '공기가 건조해요. 물을 자주 드시고 가습기를 켜 두세요';
    else if (w.humidity <= 45) hum = '약간 건조해요. 수분 섭취에 신경 써 주세요';
    else if (w.humidity <= 65) hum = '적당한 습도예요. 편안한 하루가 되실 거예요';
    else if (w.humidity <= 80) hum = '살짝 눅눅해요. 환기를 자주 해주세요';
    else                       hum = '많이 습해요. 제습이나 환기를 꼭 해주세요';
  }
  $('tipHum').textContent = hum;

  let air = '대기 정보를 불러오지 못했어요';
  if (a) {
    const bad = (x) => x === 'bad' || x === 'worst';
    if      (bad(a.pm25Level) || bad(a.pm10Level)) air = '미세먼지가 많아요. 외출 시 마스크를 꼭 써주세요';
    else if (a.pm25Level === 'normal' || a.pm10Level === 'normal') air = '공기는 보통 수준이에요. 민감하시면 마스크를 추천드려요';
    else if (a.pm25Level === 'good' && a.pm10Level === 'good') air = '공기가 맑아요. 산책하기 좋은 날이에요';
    else air = '공기 정보를 확인 중이에요';
  }
  $('tipAir').textContent = air;

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
    $('fxHeadline').textContent = `오늘 100엔은 약 ${fmt.format(Math.round(r.jpyKrw))}원이에요`;
    const ts = new Date(r.ts);
    $('fxTs').textContent = `기준: ${ts.getMonth() + 1}월 ${ts.getDate()}일 ${String(ts.getHours()).padStart(2,'0')}시`;
    calcUpdate();
  } catch {
    $('fxJpyKrw').textContent = $('fxUsdJpy').textContent = $('fxUsdKrw').textContent = '—';
  }
}
let CALC_FROM = 'JPY', CALC_TO = 'KRW';
function highlightPills() {
  document.querySelectorAll('#calcFromGroup .calc-pill').forEach((b) =>
    b.classList.toggle('active', b.dataset.c === CALC_FROM));
  document.querySelectorAll('#calcToGroup .calc-pill').forEach((b) =>
    b.classList.toggle('active', b.dataset.c === CALC_TO));
}
document.querySelectorAll('#calcFromGroup .calc-pill').forEach((b) => {
  b.addEventListener('click', () => { CALC_FROM = b.dataset.c; highlightPills(); calcUpdate(); });
});
document.querySelectorAll('#calcToGroup .calc-pill').forEach((b) => {
  b.addEventListener('click', () => { CALC_TO = b.dataset.c; highlightPills(); calcUpdate(); });
});
highlightPills();
$('calcAmt').addEventListener('input', calcUpdate);
document.querySelectorAll('.calc-preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('calcAmt').value = btn.dataset.amt;
    calcUpdate();
  });
});
$('calcSwap').addEventListener('click', () => {
  const t = CALC_FROM; CALC_FROM = CALC_TO; CALC_TO = t;
  const resultText = $('calcResult').textContent.replace(/[^\d.-]/g, '');
  const n = parseFloat(resultText);
  if (Number.isFinite(n)) $('calcAmt').value = Math.round(n);
  highlightPills();
  calcUpdate();
});
function calcUpdate() {
  const amt = parseFloat($('calcAmt').value);
  if (!fxCache || !Number.isFinite(amt)) { $('calcResult').textContent = '—'; return; }
  const r = fxCache.rates;
  const usd = CALC_FROM === 'USD' ? amt : amt / r[CALC_FROM];
  const out = CALC_TO === 'USD' ? usd : usd * r[CALC_TO];
  const sym = CALC_TO === 'KRW' ? '원' : CALC_TO === 'JPY' ? '엔' : '$';
  const digits = CALC_TO === 'USD' ? 2 : 0;
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
    ul.innerHTML = `<li class="empty-state">
      <span class="empty-state-emoji">📝</span>
      <span class="empty-state-text">오늘은 깨끗해요. 아래에 새로 적어보세요</span>
    </li>`;
    return;
  }
  for (const m of list) {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="memo-check ${m.done ? 'done' : ''}" aria-label="완료"></button>
      <div class="memo-body">
        <span class="memo-text ${m.done ? 'done' : ''}"></span>
        <span class="memo-author">
          <span class="memo-author-avatar"></span>
          <span class="memo-author-name"></span>
          <span class="memo-time"></span>
        </span>
      </div>
      <button class="memo-del" aria-label="삭제">✕</button>`;
    li.querySelector('.memo-text').textContent = m.content;
    if (m.created_by_name) {
      li.querySelector('.memo-author-avatar').textContent = iconEmoji(m.created_by_icon);
      li.querySelector('.memo-author-name').textContent = m.created_by_name;
    } else {
      li.querySelector('.memo-author-avatar').style.display = 'none';
      li.querySelector('.memo-author-name').style.display = 'none';
    }
    if (m.created_at) {
      li.querySelector('.memo-time').textContent = relativeTime(m.created_at);
    }
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
  const v = $('memoInput').value.trim(); if (!v) return;
  await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: v }) });
  $('memoInput').value = '';
  loadMemos();
});

// ---------- 띠별 운세 ----------
const LUCKY_COLORS = [
  { name: '파랑',   hex: '#0A84FF' },
  { name: '초록',   hex: '#34C759' },
  { name: '빨강',   hex: '#FF3B30' },
  { name: '노랑',   hex: '#FFCC00' },
  { name: '분홍',   hex: '#FF69B4' },
  { name: '보라',   hex: '#AF52DE' },
  { name: '주황',   hex: '#FF9500' },
  { name: '하늘색', hex: '#64D2FF' },
  { name: '남색',   hex: '#1D3557' },
  { name: '금색',   hex: '#D4AF37' },
];
const LUCKY_DIR = ['동쪽','동남쪽','남쪽','서남쪽','서쪽','서북쪽','북쪽','동북쪽'];
function dayOfYearClient(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

async function loadZodiac() {
  try {
    const list = await api('/api/zodiac');
    ZODIAC_CACHE = list;
    const ul = $('zodiacList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = `<li class="empty-state">
        <span class="empty-state-emoji">🔮</span>
        <span class="empty-state-text">가족 생년을 등록하면 띠별 운세를 보여드려요</span>
      </li>`;
      return;
    }
    const doy = dayOfYearClient();
    for (const z of list) {
      const seed = doy + (z.year || 0);
      const color = LUCKY_COLORS[seed % LUCKY_COLORS.length];
      const dir   = LUCKY_DIR[seed % LUCKY_DIR.length];
      const num   = (seed % 9) + 1;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="zodiac-emoji">${iconEmoji(z.icon)}</span>
        <div class="zodiac-body">
          <div class="zodiac-top">
            <span class="zodiac-name"></span>
            <span class="zodiac-tag"></span>
          </div>
          <div class="zodiac-fortune"></div>
          <div class="zodiac-lucky">
            <span class="lucky-chip"><span class="lucky-dot" style="background:${color.hex}"></span>${color.name}</span>
            <span class="lucky-chip">🧭 ${dir}</span>
            <span class="lucky-chip">🔢 ${num}</span>
          </div>
        </div>`;
      li.querySelector('.zodiac-name').textContent = z.name;
      li.querySelector('.zodiac-tag').textContent = `${z.zodiac}띠`;
      li.querySelector('.zodiac-fortune').textContent = z.fortune;
      ul.appendChild(li);
    }
  } catch {}
}

// ---------- 가족 관리 (관리자) ----------
$('adminToggle').addEventListener('click', () => {
  $('adminBody').classList.toggle('hidden');
  $('adminToggle').classList.toggle('open');
});

async function loadFamilyInfo() {
  try {
    const f = await api('/api/family');
    $('famAlias').value = f.alias || '';
    $('famName').value = f.displayName || '';
  } catch {}
}

$('famAliasSave').addEventListener('click', async () => {
  const alias = $('famAlias').value.trim();
  if (!alias) return;
  try {
    await api('/api/family', { method: 'PATCH', body: JSON.stringify({ alias }) });
    localStorage.setItem('fb_alias', alias);
    FAMILY_ALIAS = alias;
    alert('가족별칭이 변경되었어요');
  } catch (e) {
    alert(e.status === 409 ? '이미 쓰이는 별칭이에요' : '변경 실패');
  }
});
$('famNameSave').addEventListener('click', async () => {
  const displayName = $('famName').value.trim();
  if (!displayName) return;
  try {
    await api('/api/family', { method: 'PATCH', body: JSON.stringify({ displayName }) });
    alert('가족 이름이 변경되었어요');
  } catch { alert('변경 실패'); }
});

async function loadUsers() {
  try {
    const users = await api('/api/users');
    const ul = $('userList');
    ul.innerHTML = '';
    for (const u of users) {
      const li = document.createElement('li');
      const dob = u.birthYear ? `${u.birthYear}.${u.birthMonth || '-'}.${u.birthDay || '-'}${u.isLunar ? ' 음' : ''}` : '생일 미등록';
      const status = u.activated ? '' : ' · <span class="pending-dot">초대 대기</span>';
      li.innerHTML = `
        <span class="user-emoji">${iconEmoji(u.icon)}</span>
        <div class="user-main">
          <div class="user-name"></div>
          <div class="user-sub">${u.role === 'admin' ? '관리자' : '가족'} · ${dob}${status}</div>
        </div>
        <div class="user-actions">
          <button class="ufi-btn user-reinvite" title="초대 링크 재발급">🔗</button>
          <button class="user-del" title="삭제"${u.id === ME.id ? ' disabled' : ''}>✕</button>
        </div>`;
      li.querySelector('.user-name').textContent = `${u.displayName} (${u.username})`;
      li.querySelector('.user-reinvite').onclick = async () => {
        if (!confirm(`${u.displayName}님의 초대 링크를 새로 발급할까요?\n(기존 비밀번호는 초기화됩니다)`)) return;
        try {
          const r = await api(`/api/users/${u.id}/invite`, { method: 'POST' });
          showInviteUrl(u, r.inviteToken);
          loadUsers();
        } catch { alert('재발급 실패'); }
      };
      const del = li.querySelector('.user-del');
      if (u.id !== ME.id) {
        del.onclick = async () => {
          if (!confirm(`${u.displayName}님을 삭제할까요?`)) return;
          try {
            await api(`/api/users/${u.id}`, { method: 'DELETE' });
            loadUsers(); loadZodiac();
          } catch (e) {
            alert(e.status === 400 ? '마지막 관리자는 삭제할 수 없어요' : '삭제 실패');
          }
        };
      }
      ul.appendChild(li);
    }
  } catch {}
}

// ---------- 아이콘 픽커 ----------
let PICKED_ICON = 'star';
function renderIconPicker() {
  const grid = $('iconPicker');
  grid.innerHTML = '';
  for (const i of ICONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-opt' + (i.code === PICKED_ICON ? ' selected' : '');
    b.title = i.label;
    b.setAttribute('aria-label', i.label);
    b.innerHTML = `<span class="icon-emoji">${i.emoji}</span>`;
    b.onclick = () => {
      PICKED_ICON = i.code;
      renderIconPicker();
    };
    grid.appendChild(b);
  }
}

$('userAddBtn').addEventListener('click', async () => {
  const body = {
    username: $('uUsername').value.trim(),
    displayName: $('uDisplay').value.trim(),
    icon: PICKED_ICON,
    role: $('uAdmin').checked ? 'admin' : 'member',
    birthYear:  $('uYear').value  || null,
    birthMonth: $('uMonth').value || null,
    birthDay:   $('uDay').value   || null,
    isLunar: $('uLunar').checked,
  };
  if (!body.username || !body.displayName) {
    alert('아이디와 별칭을 입력해 주세요');
    return;
  }
  try {
    const r = await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
    showInviteUrl({ displayName: body.displayName, icon: body.icon }, r.inviteToken);
    // 초기화
    ['uUsername','uDisplay','uYear','uMonth','uDay'].forEach((id) => $(id).value = '');
    $('uLunar').checked = false; $('uAdmin').checked = false;
    PICKED_ICON = 'star'; renderIconPicker();
    loadUsers(); loadZodiac();
  } catch (e) {
    const msg = e.status === 409
      ? (e.message || '').includes('display') ? '이미 쓰이는 별칭이에요' : '이미 쓰이는 아이디예요'
      : '등록 실패';
    alert(msg);
  }
});

// ---------- 초대 링크 표시/공유/복사 ----------
let CURRENT_INVITE_URL = '';
function showInviteUrl(user, token) {
  CURRENT_INVITE_URL = `${location.origin}/invite?token=${encodeURIComponent(token)}`;
  $('inviteResultDesc').textContent = `${iconEmoji(user.icon)} ${user.displayName}님에게 아래 링크를 보내주세요. 14일 안에 비밀번호를 설정하면 됩니다.`;
  $('inviteUrl').value = CURRENT_INVITE_URL;
  $('inviteResult').classList.remove('hidden');
  $('inviteResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('inviteCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(CURRENT_INVITE_URL);
    $('inviteCopy').textContent = '복사됨';
    setTimeout(() => $('inviteCopy').textContent = '복사', 1500);
  } catch {
    $('inviteUrl').select(); document.execCommand('copy');
  }
});
$('inviteShare').addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: '가족보드 초대', url: CURRENT_INVITE_URL }); }
    catch {}
  } else {
    $('inviteUrl').select(); document.execCommand('copy');
    alert('링크가 복사됐어요. 원하시는 메신저에 붙여넣기 하세요.');
  }
});
$('inviteClose').addEventListener('click', () => $('inviteResult').classList.add('hidden'));

// ---------- 오늘의 가족 질문 ----------
async function loadTodayQuestion() {
  try {
    const q = await api('/api/question/today');
    $('questionText').textContent = q.question;
    $('questionAnswer').value = q.myAnswer || '';
    $('questionMeta').textContent =
      `${q.answeredCount} / ${q.memberCount}명이 답했어요 · 모든 답변은 내일 공개돼요`;
  } catch {
    $('questionText').textContent = '잠시 후 다시 시도해 주세요';
  }
}

$('questionSubmit').addEventListener('click', async () => {
  const a = $('questionAnswer').value.trim();
  if (!a) { alert('답변을 적어 주세요'); return; }
  try {
    await api('/api/question/today/answer', {
      method: 'POST', body: JSON.stringify({ answer: a }),
    });
    $('questionSubmit').textContent = '저장됐어요';
    setTimeout(() => $('questionSubmit').textContent = '답변 저장', 1500);
    loadTodayQuestion();
  } catch { alert('저장 실패'); }
});

async function loadYesterdayReveal() {
  try {
    const r = await api('/api/question/yesterday');
    if (!r.question || !r.answers?.length) { $('revealCard').classList.add('hidden'); return; }
    $('revealQuestion').textContent = r.question;
    const ul = $('revealList');
    ul.innerHTML = '';
    for (const a of r.answers) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="reveal-emoji">${iconEmoji(a.icon)}</span>
        <div class="reveal-body">
          <div class="reveal-name"></div>
          <div class="reveal-answer"></div>
        </div>`;
      li.querySelector('.reveal-name').textContent = a.display_name + '님';
      li.querySelector('.reveal-answer').textContent = a.answer_text;
      ul.appendChild(li);
    }
    $('revealCard').classList.remove('hidden');
  } catch {}
}

$('qHistoryBtn').addEventListener('click', async () => {
  try {
    const list = await api('/api/question/history?limit=30');
    const el = $('historyList');
    el.innerHTML = '';
    if (!list.length) {
      el.innerHTML = '<p class="empty-state-text" style="text-align:center;padding:30px 0">아직 지난 기록이 없어요</p>';
    } else {
      for (const item of list) {
        const d = new Date(item.date);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <div class="history-date">${d.getMonth() + 1}월 ${d.getDate()}일</div>
          <div class="history-q"></div>
          <ul class="reveal-list history-answers"></ul>`;
        div.querySelector('.history-q').textContent = item.question;
        const ul = div.querySelector('.history-answers');
        if (item.answers.length) {
          for (const a of item.answers) {
            const li = document.createElement('li');
            li.innerHTML = `
              <span class="reveal-emoji">${iconEmoji(a.icon)}</span>
              <div class="reveal-body">
                <div class="reveal-name"></div>
                <div class="reveal-answer"></div>
              </div>`;
            li.querySelector('.reveal-name').textContent = a.display_name + '님';
            li.querySelector('.reveal-answer').textContent = a.answer_text;
            ul.appendChild(li);
          }
        } else {
          const li = document.createElement('li');
          li.innerHTML = '<div class="reveal-body"><div class="reveal-answer" style="color:var(--sub)">답변 기록 없음</div></div>';
          ul.appendChild(li);
        }
        el.appendChild(div);
      }
    }
    $('historySheet').classList.remove('hidden');
  } catch { alert('기록 불러오기 실패'); }
});

$('historyClose').addEventListener('click', () => $('historySheet').classList.add('hidden'));
$('historySheet').addEventListener('click', (e) => {
  if (e.target.id === 'historySheet') $('historySheet').classList.add('hidden');
});

// 프로필 시트 닫기
document.getElementById('sheetClose').addEventListener('click', closeProfileSheet);
document.getElementById('profileSheet').addEventListener('click', (e) => {
  if (e.target.id === 'profileSheet') closeProfileSheet();
});

// 글자 크기 조절
function applyFontScale(scale) {
  const el = $('app');
  if (!el) return;
  el.classList.remove('scale-sm','scale-md','scale-lg');
  el.classList.add('scale-' + scale);
  document.querySelectorAll('.fs-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.scale === scale);
  });
  localStorage.setItem('fb_font_scale', scale);
}
document.querySelectorAll('.fs-btn').forEach((b) => {
  b.addEventListener('click', () => applyFontScale(b.dataset.scale));
});
// 초기값 로드 (enterApp 후 적용되도록 setTimeout)
setTimeout(() => applyFontScale(localStorage.getItem('fb_font_scale') || 'md'), 0);

boot();
