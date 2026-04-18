// ---------- 아이콘 세트 ----------
const ICONS = [
  { code: 'dad',        emoji: '👨',   label: '아빠' },
  { code: 'mom',        emoji: '👩',   label: '엄마' },
  { code: 'grandpa',    emoji: '👴',   label: '할아버지' },
  { code: 'grandma',    emoji: '👵',   label: '할머니' },
  { code: 'grandpaOut', emoji: '🧓',   label: '외할아버지' },
  { code: 'grandmaOut', emoji: '🧕',   label: '외할머니' },
  { code: 'son',        emoji: '👦',   label: '아들' },
  { code: 'daughter',   emoji: '👧',   label: '딸' },
  { code: 'uncle',      emoji: '🧔',   label: '삼촌/외삼촌' },
  { code: 'aunt',       emoji: '👱‍♀️', label: '이모/고모' },
  { code: 'cousin',     emoji: '🧑',   label: '사촌' },
  { code: 'nephew',     emoji: '🧒',   label: '조카' },
  { code: 'baby',       emoji: '👶',   label: '손주/아기' },
  { code: 'boyTeen',    emoji: '🙋‍♂️', label: '남자아이' },
  { code: 'girlTeen',   emoji: '🙋‍♀️', label: '여자아이' },
  { code: 'manElder',   emoji: '🧔‍♂️', label: '아저씨' },
  { code: 'womanElder', emoji: '💇‍♀️', label: '아주머니' },
  { code: 'chef',       emoji: '👨‍🍳', label: '요리사' },
  { code: 'teacher',    emoji: '👩‍🏫', label: '선생님' },
  { code: 'dog',        emoji: '🐶',   label: '강아지' },
  { code: 'cat',        emoji: '🐱',   label: '고양이' },
  { code: 'star',       emoji: '⭐',   label: '스타' },
  { code: 'heart',      emoji: '❤️',   label: '사랑' },
  { code: 'flower',     emoji: '🌸',   label: '꽃' },
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

  // 가족 공통 데이터 — 하나 실패해도 다른 카드는 로드되게
  loadFamilySummary();
  loadBirthday();
  loadWeatherAndAir();
  loadFx();
  loadMemos();
  loadZodiac();

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

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  // 가족별칭은 기억 (다음 로그인 편의)
  location.reload();
});

// ---------- 우리 가족 요약 ----------
async function loadFamilySummary() {
  try {
    const alias = ME.familyAlias;
    if (!alias) return;
    const r = await fetch(`/api/family/${encodeURIComponent(alias)}`).then(r => r.json());
    $('familyCardTitle').textContent = r.family.displayName || '우리 가족';
    const row = $('familyRow');
    row.innerHTML = '';
    for (const m of r.members) {
      const div = document.createElement('div');
      div.className = 'family-chip' + (m.id === ME.id ? ' me' : '') + (m.activated ? '' : ' dim');
      div.innerHTML = `
        <span class="family-chip-emoji">${iconEmoji(m.icon)}</span>
        <span class="family-chip-name"></span>
      `;
      div.querySelector('.family-chip-name').textContent = m.displayName;
      row.appendChild(div);
    }
  } catch {}
}

// ---------- 생일 ----------
async function loadBirthday() {
  try {
    const r = await api('/api/birthdays/soon');
    const el = $('birthdayBanner');
    el.classList.remove('today');
    if (r.today) {
      const isMe = ME && r.today.display_name === ME.displayName;
      $('bdEmoji').textContent = isMe ? '🎉' : iconEmoji(r.today.icon);
      $('bdTitle').textContent = isMe
        ? `${ME.displayName}님, 생신 축하드려요!`
        : `오늘은 ${r.today.display_name}님 생신이에요`;
      $('bdSub').textContent = isMe
        ? '가족 모두가 함께 축하하고 있어요 🎂'
        : '따뜻한 축하 한마디 전해보세요 🌷';
      el.classList.add('today');
      el.classList.remove('hidden');
    } else if (r.upcoming?.length) {
      const u = r.upcoming[0];
      $('bdEmoji').textContent = iconEmoji(u.icon);
      $('bdTitle').textContent = `${u.daysLeft}일 뒤 ${u.display_name}님 생신`;
      $('bdSub').textContent = `${u.birth_month}월 ${u.birth_day}일${u.is_lunar ? ' (음력)' : ''}`;
      el.classList.remove('hidden');
    }
  } catch {}
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
    const ts = new Date(r.ts);
    $('fxTs').textContent = `기준: ${ts.getMonth() + 1}월 ${ts.getDate()}일 ${String(ts.getHours()).padStart(2,'0')}시`;
    calcUpdate();
  } catch {
    $('fxJpyKrw').textContent = $('fxUsdJpy').textContent = $('fxUsdKrw').textContent = '—';
  }
}
['calcAmt','calcFrom','calcTo'].forEach((id) => {
  $(id).addEventListener('input', calcUpdate);
  $(id).addEventListener('change', calcUpdate);
});
document.querySelectorAll('.calc-preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('calcAmt').value = btn.dataset.amt;
    calcUpdate();
  });
});
function calcUpdate() {
  const amt = parseFloat($('calcAmt').value);
  const from = $('calcFrom').value, to = $('calcTo').value;
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
    ul.innerHTML = '<li><span class="memo-text" style="color:var(--sub)">적혀 있는 메모가 없어요</span></li>';
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
        </span>
      </div>
      <button class="memo-del" aria-label="삭제">✕</button>`;
    li.querySelector('.memo-text').textContent = m.content;
    if (m.created_by_name) {
      li.querySelector('.memo-author-avatar').textContent = iconEmoji(m.created_by_icon);
      li.querySelector('.memo-author-name').textContent = m.created_by_name;
    } else {
      li.querySelector('.memo-author').style.display = 'none';
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
        <span class="zodiac-emoji">${iconEmoji(z.icon)}</span>
        <div class="zodiac-body">
          <div class="zodiac-top">
            <span class="zodiac-name"></span>
            <span class="zodiac-tag"></span>
          </div>
          <div class="zodiac-fortune"></div>
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
    b.innerHTML = `<span class="icon-emoji">${i.emoji}</span><span class="icon-label"></span>`;
    b.querySelector('.icon-label').textContent = i.label;
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

boot();
