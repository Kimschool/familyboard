// ---------- 가족별 액센트 컬러 (id 해시 기반) ----------
const ACCENT_PALETTE = [
  { hue: 210, name: 'blue' },   // 파랑
  { hue: 340, name: 'pink' },   // 분홍
  { hue: 150, name: 'green' },  // 초록
  { hue: 30,  name: 'orange' }, // 주황
  { hue: 280, name: 'purple' }, // 보라
  { hue: 50,  name: 'yellow' }, // 노랑
  { hue: 190, name: 'teal' },   // 청록
  { hue: 0,   name: 'red' },    // 빨강
];
function accentFor(userId) {
  const idx = ((userId || 0) * 7 + 13) % ACCENT_PALETTE.length;
  return ACCENT_PALETTE[idx];
}
function accentStyle(userId, kind = 'ring') {
  const p = accentFor(userId);
  if (kind === 'bg') return `background: hsla(${p.hue}, 70%, 92%, .7);`;
  if (kind === 'text') return `color: hsl(${p.hue}, 60%, 40%);`;
  return `box-shadow: 0 0 0 2px hsl(${p.hue}, 70%, 62%); background: hsla(${p.hue}, 70%, 94%, .6);`;
}

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
/** 전화번호 표시용 — 빈 값·문자열 "null" 제거 */
function displayPhone(p) {
  if (p == null) return '';
  const s = String(p).trim();
  if (!s || s.toLowerCase() === 'null' || s === 'undefined') return '';
  return s;
}

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
  ['invite','step1','step2','step3','app','settings'].forEach((x) => {
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
  // 마지막 로그인 멤버가 있으면 맨 앞 + 강조
  const lastId = Number(localStorage.getItem('fb_last_member_' + FAMILY_ALIAS) || 0);
  if (lastId) {
    members = [
      ...members.filter((m) => m.id === lastId),
      ...members.filter((m) => m.id !== lastId),
    ];
  }
  for (const m of members) {
    const isLast = m.id === lastId;
    const btn = document.createElement('button');
    btn.className = 'member-card' + (m.activated ? '' : ' pending') + (isLast ? ' recent' : '');
    btn.innerHTML = `
      <span class="member-emoji">${iconEmoji(m.icon)}</span>
      <span class="member-name"></span>
      ${isLast ? '<span class="member-recent-tag">최근 로그인</span>' : ''}
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
    // 빠른 로그인용 마지막 멤버 id 기억
    try { localStorage.setItem('fb_last_member_' + FAMILY_ALIAS, String(PICKED.id)); } catch {}
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
  setTimeout(renderHeroSummary, 500); // 데이터 로드 후 한 번 더
  try { renderAccount(); } catch {}

  // 가족 공통 데이터 — 하나 실패해도 다른 카드는 로드되게
  loadFamilyNotice();
  loadMoodCard();
  loadFamilySummary();
  loadBirthday();
  loadWeatherAndAir();
  loadFx();
  loadMemos();
  loadZodiac();
  loadTodayQuestion();
  loadYesterdayReveal();
  loadEmergencyContacts();
  loadStickers();
  loadMyStreak();
  loadMeds();
  loadWeeklyReport();
  loadAnniversaries();
  renderDailyQuote();
  setupTtsAuto();
  setupTtsRate();
  loadPoll();
  loadEvents();
  loadGallery();
  loadChatPeek();
  refreshChatUnread();

  // 관리자 UI — 설정 화면으로 이동 (계정 카드의 '가족 관리' 버튼으로 열림)
  try {
    if (ME.role === 'admin') {
      $('openSettingsBtn').classList.remove('hidden');
      migrateAdminToSettings();
      loadUsers();
      loadFamilyInfo();
      renderIconPicker();
      renderSosIconPicker();
      loadSosAdmin();
    }
  } catch (e) { console.warn('[admin ui]', e); }

  applyCardOrder();
}

// 관리자 DOM을 설정 화면 body 로 한 번만 이동
let adminMigrated = false;
function migrateAdminToSettings() {
  if (adminMigrated) return;
  const body = document.getElementById('adminBody');
  const target = document.getElementById('settingsBody');
  if (body && target) {
    body.classList.remove('hidden');
    target.appendChild(body);
    adminMigrated = true;
  }
}

// ---------- Hero ----------
function renderHeroSummary() {
  const el = $('heroSummary');
  if (!el) return;
  const chips = [];

  // 메모 active 개수
  const activeMemos = (MEMO_CACHE || []).filter((m) => !m.done).length;
  if (activeMemos > 0) {
    chips.push({ emoji: '📝', text: `메모 ${activeMemos}개`, target: 'memo' });
  }

  // 답변 상태
  const myAnswered = (QUESTION_ANSWERERS_CACHE || []).some((a) => a.user_id === ME.id);
  chips.push({
    emoji: myAnswered ? '✅' : '❓',
    text: myAnswered ? '답변 완료' : '답변 대기',
    target: 'question',
    tone: myAnswered ? 'good' : 'warn',
  });

  // 내 스트릭
  if (window._STREAK?.myStreak >= 3) {
    chips.push({ emoji: '🔥', text: `${window._STREAK.myStreak}일 연속`, target: 'question', tone: 'hot' });
  }

  // 받은 응원 개수
  const recvStickers = (STICKERS_CACHE || []).filter((s) => s.receiver_id === ME.id).length;
  if (recvStickers > 0) {
    chips.push({ emoji: '💖', text: `응원 ${recvStickers}개`, target: 'stickers', tone: 'good' });
  }

  // 다가오는 생일 (7일 이내)
  if (window._NEXT_BIRTHDAY) {
    const nb = window._NEXT_BIRTHDAY;
    if (nb.daysLeft === 0) {
      chips.push({ emoji: '🎂', text: `${nb.display_name}님 생일!`, target: 'birthday', tone: 'hot' });
    } else if (nb.daysLeft <= 7) {
      chips.push({ emoji: '🎂', text: `${nb.daysLeft}일 뒤 ${nb.display_name}님`, target: 'birthday' });
    }
  }

  // 공지 유무
  if (!$('noticeCard').classList.contains('hidden')) {
    const hasNew = !$('noticeNewBadge').classList.contains('hidden');
    chips.push({
      emoji: '📌',
      text: hasNew ? '새 공지' : '가족 공지',
      target: 'notice',
      tone: hasNew ? 'warn' : undefined,
    });
  }

  // 우선순위 기반 정렬: 긴급(warn) → 뜨거운 이벤트(hot) → 완료/좋음(good) → 기본
  // 같은 톤 내에선 chips 배열의 원래 순서 유지 (stable sort).
  const tonePriority = { warn: 0, hot: 1, good: 2 };
  chips.sort((a, b) => {
    const pa = a.tone != null && a.tone in tonePriority ? tonePriority[a.tone] : 9;
    const pb = b.tone != null && b.tone in tonePriority ? tonePriority[b.tone] : 9;
    return pa - pb;
  });

  el.innerHTML = '';
  if (!chips.length) { el.classList.add('hidden'); return; }
  for (const c of chips) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero-chip' + (c.tone ? ' tone-' + c.tone : '');
    b.innerHTML = `<span>${c.emoji}</span><span class="hero-chip-text"></span>`;
    b.querySelector('.hero-chip-text').textContent = c.text;
    b.onclick = () => {
      const card = document.querySelector(`[data-card-id="${c.target}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    el.appendChild(b);
  }
  el.classList.remove('hidden');
}

// 아이콘/사진 공용 렌더러 — photoUrl 있으면 사진, 없으면 이모지
function avatarHtml(member, sizeClass = '') {
  if (member?.photoUrl) {
    return `<img class="ava-img ${sizeClass}" src="${member.photoUrl.replace(/"/g, '')}" alt="" />`;
  }
  return `<span class="ava-emoji ${sizeClass}">${iconEmoji(member?.icon)}</span>`;
}

/** FAMILY_CACHE 에서 매칭되는 멤버의 photoUrl 리턴. 못 찾으면 null. */
function photoUrlFor({ id, name } = {}) {
  const m = (FAMILY_CACHE || []).find((x) =>
    (id != null && x.id === id) || (name && x.displayName === name)
  );
  return m?.photoUrl || null;
}

/** 인라인 아바타 HTML 문자열 — 사진 있으면 원형 <img>, 없으면 이모지 텍스트.
 *  photoUrl 을 직접 전달하면 FAMILY_CACHE 조회 없이 바로 사용 (FAMILY_CACHE 미로드 상태에도 작동).
 *  px: 이미지 지름(px). emoji fallback 은 부모의 font-size 를 그대로 따름. */
function inlineAvatarHtml({ id, name, icon, photoUrl } = {}, px = 22) {
  const url = (photoUrl && photoUrl.trim()) || photoUrlFor({ id, name });
  if (url) {
    const safe = url.replace(/"/g, '');
    return `<img src="${safe}" alt="" class="avatar-inline" style="width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle" />`;
  }
  return iconEmoji(icon);
}

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
  // hero avatar: 내 photoUrl 있으면 사진 (실패 시 이모지로 폴백)
  const meInCache = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
  setAvatarEl($('heroAvatar'), meInCache?.photoUrl, ME.icon);

  // 시간대별 배경 톤
  const tod = h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'noon' : h < 20 ? 'evening' : 'night';
  document.body.classList.remove('tod-morning','tod-noon','tod-evening','tod-night');
  document.body.classList.add('tod-' + tod);
}


function renderAccount() {
  const self = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
  setAvatarEl($('accountAvatar'), self?.photoUrl, ME.icon);
  $('accountName').textContent = `${ME.displayName}님으로 로그인 중`;
  $('accountMeta').textContent = `${ME.familyName || ''} (${ME.role === 'admin' ? '관리자' : '가족'})`;
}

/** photoUrl 있으면 <img> 삽입. 로드 실패 시 이모지로 폴백. */
function setAvatarEl(el, photoUrl, iconCode) {
  if (!el) return;
  const url = (photoUrl || '').trim();
  if (!url) {
    el.textContent = iconEmoji(iconCode);
    return;
  }
  el.textContent = '';
  const img = document.createElement('img');
  img.alt = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';
  img.onerror = () => {
    console.warn('[avatar] img load failed:', url);
    el.textContent = iconEmoji(iconCode);
  };
  img.src = url;
  el.appendChild(img);
}

$('logoutBtn').addEventListener('click', async () => {
  if (!confirm('로그아웃 하시겠어요?')) return;
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  // 가족별칭은 기억 (다음 로그인 편의)
  location.reload();
});

// ---------- 응원 스티커 ----------
async function loadStickers() {
  try {
    STICKERS_CACHE = await api('/api/stickers/today');
    renderStickerCard();
  } catch { STICKERS_CACHE = []; }
}

function renderStickerCard() {
  const card = $('stickersCard');
  if (!card || !ME) return;
  const received = STICKERS_CACHE.filter((s) => s.receiver_id === ME.id);
  const sent = STICKERS_CACHE.filter((s) => s.sender_id === ME.id);

  const recvBlock = $('stickersReceivedBlock');
  const recvRow = $('stickersReceivedRow');
  recvRow.innerHTML = '';
  if (received.length) {
    // 이모지 별 집계
    const byEmoji = new Map();
    for (const s of received) {
      const arr = byEmoji.get(s.emoji) || [];
      arr.push({ name: s.sender_name, icon: s.sender_icon });
      byEmoji.set(s.emoji, arr);
    }
    for (const [emoji, senders] of byEmoji) {
      const chip = document.createElement('div');
      chip.className = 'sticker-home-chip';
      chip.innerHTML = `
        <span class="sh-emoji">${emoji}</span>
        <span class="sh-from"></span>`;
      chip.querySelector('.sh-from').textContent = senders.map((x) => x.name).join(', ');
      recvRow.appendChild(chip);
    }
    recvBlock.classList.remove('hidden');
  } else {
    recvBlock.classList.add('hidden');
  }

  const sentBlock = $('stickersSentBlock');
  const sentRow = $('stickersSentRow');
  sentRow.innerHTML = '';
  if (sent.length) {
    for (const s of sent) {
      const chip = document.createElement('div');
      chip.className = 'sticker-home-chip sent';
      chip.innerHTML = `
        <span class="sh-to-icon">${iconEmoji(s.receiver_icon)}</span>
        <span class="sh-to-name"></span>
        <span class="sh-emoji">${s.emoji}</span>`;
      chip.querySelector('.sh-to-name').textContent = s.receiver_name;
      sentRow.appendChild(chip);
    }
    sentBlock.classList.remove('hidden');
  } else {
    sentBlock.classList.add('hidden');
  }

  card.classList.toggle('hidden', received.length === 0 && sent.length === 0);
}

function toggleSticker(receiverId, emoji, btn) {
  return api('/api/sticker', {
    method: 'POST',
    body: JSON.stringify({ receiverId, emoji }),
  }).then(async (r) => {
    // 캐시 갱신
    await loadStickers();
    if (btn) btn.classList.toggle('on', r.sent);
    // 프로필 시트에 받은 스티커 섹션 갱신
    if (CURRENT_PROFILE_USER) updateProfileStickerSections(CURRENT_PROFILE_USER);
    renderStickerCard();
    return r;
  });
}

function updateProfileStickerSections(m) {
  // 내가 이 사람에게 오늘 보낸 스티커들
  const myToThem = STICKERS_CACHE
    .filter((s) => s.sender_id === ME.id && s.receiver_id === m.id)
    .map((s) => s.emoji);
  // 이 사람이 받은 스티커들
  const received = STICKERS_CACHE.filter((s) => s.receiver_id === m.id);

  const pickerSection = $('profStickersSection');
  const recvWrap = $('profStickerReceived');
  const recvList = $('profStickerList');
  const picker = $('profStickerPicker');

  if (m.id === ME.id) {
    // 본인 프로필: 받은 스티커만 보여줌, 보내기 숨김
    picker.innerHTML = '';
    pickerSection.classList.remove('hidden');
  } else {
    pickerSection.classList.remove('hidden');
    picker.innerHTML = '';
    for (const emoji of STICKER_EMOJIS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sticker-btn' + (myToThem.includes(emoji) ? ' on' : '');
      b.textContent = emoji;
      b.onclick = async () => {
        await toggleSticker(m.id, emoji, b);
      };
      picker.appendChild(b);
    }
  }

  if (received.length) {
    recvWrap.classList.remove('hidden');
    recvList.innerHTML = '';
    // emoji 별 집계
    const byEmoji = new Map();
    for (const s of received) {
      const arr = byEmoji.get(s.emoji) || [];
      arr.push(s.sender_name);
      byEmoji.set(s.emoji, arr);
    }
    for (const [emoji, senders] of byEmoji) {
      const d = document.createElement('div');
      d.className = 'sticker-received-item';
      d.innerHTML = `<span class="sticker-received-emoji">${emoji}</span><span class="sticker-received-names"></span>`;
      d.querySelector('.sticker-received-names').textContent = senders.join(', ') + '님';
      recvList.appendChild(d);
    }
  } else {
    recvWrap.classList.add('hidden');
  }
}

// ---------- 약 복용 체크 ----------
const MED_SCHEDULE_LABEL = { morning: '🌅 아침', lunch: '🌤️ 점심', evening: '🌆 저녁', night: '🌙 취침 전' };
async function loadMeds() {
  try {
    const list = await api('/api/meds');
    const body = $('medsBody');
    body.innerHTML = '';
    if (!list.length) {
      $('medsCard').classList.add('hidden');
      return;
    }
    $('medsCard').classList.remove('hidden');

    // 주간 성취율 계산
    let totalCells = 0, doneCells = 0;
    for (const m of list) {
      if (m.last7) {
        totalCells += m.last7.length;
        doneCells += m.last7.filter((x) => x.done).length;
      }
    }
    const achieveEl = $('medsAchieve');
    if (achieveEl && totalCells > 0) {
      const pct = Math.round((doneCells / totalCells) * 100);
      const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '👍' : pct >= 40 ? '🙂' : '💪';
      achieveEl.textContent = `이번 주 ${emoji} ${doneCells}/${totalCells} (${pct}%)`;
      achieveEl.classList.remove('hidden');
    } else if (achieveEl) {
      achieveEl.classList.add('hidden');
    }

    // 스케줄별 그룹핑
    const groups = { morning: [], lunch: [], evening: [], night: [] };
    for (const m of list) (groups[m.schedule] || groups.morning).push(m);

    for (const sched of Object.keys(groups)) {
      const meds = groups[sched];
      if (!meds.length) continue;
      const section = document.createElement('div');
      section.className = 'med-section';
      section.innerHTML = `<div class="med-label">${MED_SCHEDULE_LABEL[sched]}</div>`;
      const ul = document.createElement('ul');
      ul.className = 'med-list';
      for (const m of meds) {
        const li = document.createElement('li');
        li.className = 'med-item' + (m.done_today ? ' done' : '');
        const last7 = m.last7 || [];
        const heatmapHtml = last7.length ? `
          <div class="med-heatmap" title="최근 7일">
            ${last7.map((d, i) => {
              const dObj = new Date(d.date);
              const isToday = i === last7.length - 1;
              const label = ['일','월','화','수','목','금','토'][dObj.getDay()];
              return `<div class="hm-col${d.done ? ' done' : ''}${isToday ? ' today' : ''}" title="${d.date}">
                        <div class="hm-dot"></div>
                        <div class="hm-d">${label}</div>
                      </div>`;
            }).join('')}
          </div>` : '';
        li.innerHTML = `
          <button class="med-check ${m.done_today ? 'done' : ''}" aria-label="복용 체크"></button>
          <div class="med-main">
            <span class="med-name"></span>
            ${heatmapHtml}
          </div>
          <button class="med-del" aria-label="삭제">✕</button>`;
        li.querySelector('.med-name').textContent = m.name;
        li.querySelector('.med-check').onclick = async () => {
          await api(`/api/meds/${m.id}/check`, { method: 'POST' });
          loadMeds();
        };
        li.querySelector('.med-del').onclick = async () => {
          if (!confirm(`${m.name} 약을 목록에서 지울까요?`)) return;
          await api(`/api/meds/${m.id}`, { method: 'DELETE' });
          loadMeds();
        };
        ul.appendChild(li);
      }
      section.appendChild(ul);
      body.appendChild(section);
    }
  } catch { $('medsCard').classList.add('hidden'); }
}

$('openMedMgr').addEventListener('click', () => {
  $('medMgr').classList.toggle('hidden');
});

$('openMedMonthBtn').addEventListener('click', async () => {
  try {
    const r = await api('/api/meds/month');
    const wrap = $('medMonthWrap');
    wrap.innerHTML = '';
    if (!r.meds?.length) {
      wrap.innerHTML = '<p class="empty-state-text" style="padding:20px 0;text-align:center">등록된 약이 없어요</p>';
      $('medMonthSummary').textContent = '';
    } else {
      // 전체 통계
      let totalCells = 0, doneCells = 0;
      r.meds.forEach((m) => {
        totalCells += m.checks.length;
        doneCells += m.checks.filter((x) => x === 1).length;
      });
      const pct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
      $('medMonthSummary').textContent = `최근 30일 · 전체 ${doneCells}/${totalCells} (${pct}%)`;

      // 각 약마다 30일 스트립
      for (const m of r.meds) {
        const doneDays = m.checks.filter((x) => x === 1).length;
        const mpct = Math.round((doneDays / m.checks.length) * 100);
        const section = document.createElement('div');
        section.className = 'mm-section';
        const scheduleLabel = { morning:'🌅 아침', lunch:'🌤️ 점심', evening:'🌆 저녁', night:'🌙 취침' }[m.schedule] || '';
        section.innerHTML = `
          <div class="mm-head">
            <span class="mm-name"></span>
            <span class="mm-sched">${scheduleLabel}</span>
            <span class="mm-pct">${doneDays}일 (${mpct}%)</span>
          </div>
          <div class="mm-strip"></div>`;
        section.querySelector('.mm-name').textContent = m.name;
        const strip = section.querySelector('.mm-strip');
        m.checks.forEach((v, i) => {
          const cell = document.createElement('span');
          cell.className = 'mm-cell' + (v ? ' on' : '');
          const d = new Date(r.days[i]);
          cell.title = `${r.days[i]} ${v ? '복용' : '미복용'}`;
          if (i === m.checks.length - 1) cell.classList.add('today');
          strip.appendChild(cell);
        });
        wrap.appendChild(section);
      }
    }
    $('medMonthSheet').classList.remove('hidden');
  } catch { alert('불러오기 실패'); }
});
$('medMonthClose').addEventListener('click', () => $('medMonthSheet').classList.add('hidden'));
$('medMonthSheet').addEventListener('click', (e) => {
  if (e.target.id === 'medMonthSheet') $('medMonthSheet').classList.add('hidden');
});
$('medAddBtn').addEventListener('click', async () => {
  const name = $('medName').value.trim();
  const schedule = $('medSchedule').value;
  if (!name) { alert('약 이름을 입력해 주세요'); return; }
  try {
    await api('/api/meds', { method: 'POST', body: JSON.stringify({ name, schedule }) });
    $('medName').value = '';
    loadMeds();
  } catch { alert('추가 실패'); }
});

// ---------- 질문 제안 ----------
$('qSuggestBtn').addEventListener('click', async () => {
  await openSuggestSheet();
});
async function openSuggestSheet() {
  const list = await api('/api/question/suggestions').catch(() => []);
  const ul = $('suggestList');
  ul.innerHTML = '';
  if (!list.length) {
    ul.innerHTML = '<li class="empty-state-text" style="padding:14px 0;text-align:center">아직 제안된 질문이 없어요</li>';
  }
  for (const s of list) {
    const li = document.createElement('li');
    li.className = 'suggest-item' + (s.used_date ? ' used' : '');
    li.innerHTML = `
      <div class="su-head">
        <span class="su-author">${iconEmoji(s.author_icon)} ${escapeHtml(s.author_name)}님</span>
        ${s.used_date ? `<span class="su-used">사용됨</span>` : '<span class="su-pending">대기</span>'}
      </div>
      <div class="su-text"></div>
      ${(s.author_id === ME.id || ME.role === 'admin') && !s.used_date
        ? `<button class="su-del" data-id="${s.id}" aria-label="삭제">✕</button>` : ''}`;
    li.querySelector('.su-text').textContent = s.text;
    const del = li.querySelector('.su-del');
    if (del) del.onclick = async () => {
      if (!confirm('이 제안을 삭제할까요?')) return;
      await api(`/api/question/suggestions/${s.id}`, { method: 'DELETE' });
      openSuggestSheet();
    };
    ul.appendChild(li);
  }
  $('suggestSheet').classList.remove('hidden');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
$('suggestSubmit').addEventListener('click', async () => {
  const text = $('suggestText').value.trim();
  if (!text) { alert('질문을 입력해 주세요'); return; }
  try {
    await api('/api/question/suggest', { method: 'POST', body: JSON.stringify({ text }) });
    $('suggestText').value = '';
    openSuggestSheet();
  } catch { alert('제안 실패'); }
});
$('suggestClose').addEventListener('click', () => $('suggestSheet').classList.add('hidden'));
$('suggestSheet').addEventListener('click', (e) => {
  if (e.target.id === 'suggestSheet') $('suggestSheet').classList.add('hidden');
});

// ---------- 개인 일기 (index에 카드가 있을 때만) ----------
async function loadDiary() {
  if (!$('diaryInput')) return;
  try {
    const r = await api('/api/diary/today');
    $('diaryInput').value = r.text || '';
    if (r.updatedAt) {
      $('diaryMeta').textContent = `마지막 저장: ${relativeTime(r.updatedAt)}`;
    } else {
      $('diaryMeta').textContent = '';
    }
    // 스트릭 뱃지
    try {
      const s = await api('/api/diary/streak');
      const badge = $('diaryStreak');
      if (s.current >= 2) {
        badge.textContent = `🔥 ${s.current}일 연속`;
        badge.classList.remove('hidden');
      } else if (s.current === 1) {
        badge.textContent = '🌱 오늘부터';
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch {}
  } catch {}
}
$('diarySave')?.addEventListener('click', async () => {
  const text = $('diaryInput').value.trim();
  try {
    await api('/api/diary/today', { method: 'POST', body: JSON.stringify({ text }) });
    $('diarySave').textContent = '저장됐어요';
    setTimeout(() => $('diarySave').textContent = '저장', 1500);
    loadDiary();
  } catch { alert('저장 실패'); }
});
$('diaryHistBtn')?.addEventListener('click', async () => {
  try {
    const list = await api('/api/diary/recent?limit=30');
    const ul = $('diaryHistList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty-state-text" style="padding:20px 0;text-align:center">아직 일기가 없어요</li>';
    }
    for (const d of list) {
      const date = new Date(d.date);
      const li = document.createElement('li');
      li.className = 'diary-hist-item';
      li.innerHTML = `
        <div class="dh-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
        <div class="dh-text"></div>`;
      li.querySelector('.dh-text').textContent = d.text;
      ul.appendChild(li);
    }
    $('diaryHistSheet').classList.remove('hidden');
  } catch { alert('불러오기 실패'); }
});
$('diaryHistClose')?.addEventListener('click', () => $('diaryHistSheet').classList.add('hidden'));
$('diaryHistSheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'diaryHistSheet') $('diaryHistSheet').classList.add('hidden');
});

// ---------- 시간별 상세 시트 ----------
let HOURLY_CACHE = [];
$('hourlyBlock')?.addEventListener('click', () => {
  if (!HOURLY_CACHE.length) return;
  const ul = $('hourlyDetailList');
  ul.innerHTML = '';
  for (const h of HOURLY_CACHE) {
    const d = new Date(h.time);
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`;
    const icon = WMO_ICON[h.code] || '🌤️';
    const desc = WMO[h.code] || '';
    const li = document.createElement('li');
    li.className = 'hd-item';
    li.innerHTML = `
      <span class="hd-time">${dateLabel}</span>
      <span class="hd-icon">${icon}</span>
      <span class="hd-desc"></span>
      <span class="hd-temp">${h.temp}°</span>
      <span class="hd-rain">${h.rainProb > 0 ? '💧 ' + h.rainProb + '%' : ''}</span>`;
    li.querySelector('.hd-desc').textContent = desc;
    ul.appendChild(li);
  }
  $('hourlySheet').classList.remove('hidden');
});
$('hourlyClose').addEventListener('click', () => $('hourlySheet').classList.add('hidden'));
$('hourlySheet').addEventListener('click', (e) => {
  if (e.target.id === 'hourlySheet') $('hourlySheet').classList.add('hidden');
});

// ---------- 가족 투표 ----------
async function loadPoll() {
  try {
    const p = await api('/api/poll/active');
    const card = $('pollCard');
    const body = $('pollBody');
    if (!p) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    body.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'poll-title';
    title.textContent = p.title;
    body.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'poll-sub';
    sub.innerHTML = `${iconEmoji(p.author.icon)} <b></b>님 · ${p.votes.length}명 참여`;
    sub.querySelector('b').textContent = p.author.name;
    body.appendChild(sub);

    const opts = document.createElement('ul');
    opts.className = 'poll-options';
    const total = p.votes.length || 1;
    p.options.forEach((opt, i) => {
      const count = p.votes.filter((v) => v.optionIndex === i).length;
      const pct = Math.round((count / total) * 100);
      const li = document.createElement('li');
      li.className = 'poll-option' + (p.myVote === i ? ' chosen' : '');
      li.innerHTML = `
        <div class="po-bar" style="width:${p.votes.length ? pct : 0}%"></div>
        <div class="po-content">
          <span class="po-text"></span>
          <span class="po-stats">${count}명 ${p.votes.length ? `(${pct}%)` : ''}</span>
        </div>`;
      li.querySelector('.po-text').textContent = opt;
      li.onclick = async () => {
        try {
          await api(`/api/poll/${p.id}/vote`, {
            method: 'POST', body: JSON.stringify({ optionIndex: i }),
          });
          loadPoll();
        } catch { alert('투표 실패'); }
      };
      opts.appendChild(li);
    });
    body.appendChild(opts);

    // 작성자 또는 관리자는 닫기 버튼
    if (p.author.id === ME.id || ME.role === 'admin') {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'poll-close-btn';
      close.textContent = '투표 종료';
      close.onclick = async () => {
        if (!confirm('이 투표를 종료할까요?')) return;
        await api(`/api/poll/${p.id}/close`, { method: 'POST' });
        loadPoll();
      };
      body.appendChild(close);
    }
  } catch {}
}

$('pollNewBtn').addEventListener('click', () => $('pollCreateSheet').classList.remove('hidden'));
$('pollCreateClose').addEventListener('click', () => $('pollCreateSheet').classList.add('hidden'));
$('pollCreateSheet').addEventListener('click', (e) => {
  if (e.target.id === 'pollCreateSheet') $('pollCreateSheet').classList.add('hidden');
});
$('pollAddOpt').addEventListener('click', () => {
  const wrap = $('pollOptionsWrap');
  if (wrap.querySelectorAll('.poll-opt-input').length >= 6) return;
  const input = document.createElement('input');
  input.className = 'auth-input poll-opt-input';
  input.type = 'text';
  input.maxLength = 60;
  input.style.textAlign = 'left';
  input.placeholder = `선택지 ${wrap.querySelectorAll('.poll-opt-input').length + 1}`;
  wrap.appendChild(input);
});
$('pollCreate').addEventListener('click', async () => {
  const title = $('pollTitle').value.trim();
  const options = Array.from($('pollOptionsWrap').querySelectorAll('.poll-opt-input'))
    .map((i) => i.value.trim()).filter(Boolean);
  if (!title) { alert('질문을 입력해 주세요'); return; }
  if (options.length < 2) { alert('선택지를 최소 2개 입력해 주세요'); return; }
  try {
    await api('/api/poll', { method: 'POST', body: JSON.stringify({ title, options }) });
    $('pollTitle').value = '';
    $('pollOptionsWrap').querySelectorAll('.poll-opt-input').forEach((i, idx) => {
      if (idx < 2) i.value = '';
      else i.remove();
    });
    $('pollCreateSheet').classList.add('hidden');
    loadPoll();
  } catch { alert('생성 실패'); }
});

// ---------- 오늘의 한 마디 ----------
const DAILY_QUOTES = [
  '오늘도 가족이 무사한 하루가 가장 큰 복이에요.',
  '느리게 가도 괜찮아요. 방향이 맞으면 돼요.',
  '작은 일에도 고마워할 수 있는 하루가 잘 살아낸 하루예요.',
  '오늘의 한 끼가 누군가에겐 큰 위로가 됩니다.',
  '걱정은 내일 걱정이에요, 오늘은 오늘에 집중하세요.',
  '가까운 사람에게 한 마디 따뜻하게 건네 보세요.',
  '산책 한 걸음이 마음을 가볍게 해요.',
  '잠시 멈춰 숨을 깊게 쉬어 보세요. 그 자체로 약이 돼요.',
  '부모님의 목소리를 들을 수 있는 오늘은 참 귀한 날입니다.',
  '서두르지 않아도 충분히 잘 해내고 계세요.',
  '어제의 나보다 한 뼘 더 따뜻해지면 충분해요.',
  '실수해도 괜찮아요. 다시 시작할 수 있어요.',
  '가족은 말하지 않아도 마음으로 전해져요.',
  '오늘 하루도 수고하셨어요.',
  '자기 자신에게도 다정하게 대해 주세요.',
  '좋아하는 음악 한 곡이 하루를 바꿔줄 때가 있어요.',
  '작은 시도가 큰 변화를 만들어요.',
  '웃을 일을 하나 만들어 보세요.',
  '오늘 본 하늘이 제일 예쁠지도 몰라요.',
  '사랑한다는 말은 아껴두지 마세요.',
  '쉬는 것도 중요한 일입니다.',
  '어려울 땐 가족에게 기대도 괜찮아요.',
  '즐거운 기억 하나씩 쌓는 하루가 좋은 하루예요.',
  '하고 싶은 일을 지금 시작해 보세요.',
  '오늘 먹은 맛있는 한 끼를 기억해 두세요.',
  '때로는 지는 해가 가장 아름답습니다.',
  '오늘의 마음을 기록해 두면 훗날의 보물이 돼요.',
  '서로의 다정함이 가족을 가족답게 만들어요.',
  '건강보다 소중한 건 없어요. 몸을 아껴 주세요.',
  '괜찮은 하루가 가장 좋은 하루일 때가 많아요.',
];
function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}
function renderDailyQuote() {
  const el = $('dailyQuote');
  if (!el) return;
  el.textContent = DAILY_QUOTES[dayOfYear() % DAILY_QUOTES.length];
}

// ---------- 자동 TTS 토글 ----------
function setupTtsAuto() {
  const cb = $('ttsAutoToggle');
  if (!cb) return;
  cb.checked = localStorage.getItem('fb_tts_auto') === '1';
  cb.addEventListener('change', () => {
    localStorage.setItem('fb_tts_auto', cb.checked ? '1' : '0');
  });
  // 자동 낭독: 로드 후 공지 + tips 읽기
  if (cb.checked && 'speechSynthesis' in window) {
    setTimeout(() => {
      const noticeText = $('noticeText')?.textContent;
      const parts = [];
      if (noticeText && !$('noticeCard').classList.contains('hidden')) {
        parts.push('가족 공지입니다. ' + noticeText);
      }
      const tips = [
        $('tipDress')?.textContent, $('tipHum')?.textContent,
        $('tipAir')?.textContent, $('tipPollen')?.textContent,
      ].filter((t) => t && t !== '—').join(' ');
      if (tips) parts.push(tips);
      if (parts.length) {
        try {
          const u = new SpeechSynthesisUtterance(parts.join(' '));
          u.lang = 'ko-KR'; u.rate = 0.95;
          speechSynthesis.speak(u);
        } catch {}
      }
    }, 2500);
  }
}

// ---------- 빠른 연락처 ----------
async function loadEmergencyContacts() {
  try {
    const list = await api('/api/emergency');
    const box = $('sosList');
    box.innerHTML = '';
    if (!list.length) { $('sosCard').classList.add('hidden'); return; }
    for (const c of list) {
      const tel = displayPhone(c.phone);
      if (!tel) continue;
      const a = document.createElement('a');
      a.className = 'sos-btn';
      a.href = `tel:${tel.replace(/[^0-9+*#]/g, '')}`;
      a.innerHTML = `
        <span class="sos-emoji">${iconEmoji(c.icon)}</span>
        <span class="sos-info">
          <span class="sos-name"></span>
          <span class="sos-phone"></span>
        </span>
        <span class="sos-arrow">📞</span>`;
      a.querySelector('.sos-name').textContent = c.name;
      a.querySelector('.sos-phone').textContent = tel;
      box.appendChild(a);
    }
    $('sosCard').classList.remove('hidden');
  } catch {}
}

async function loadSosAdmin() {
  if (ME?.role !== 'admin') return;
  try {
    const list = await api('/api/emergency');
    const ul = $('sosAdminList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li style="color:var(--sub);font-size:13px;padding:8px 0">등록된 연락처가 없어요</li>';
    }
    for (const c of list) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="user-emoji">${iconEmoji(c.icon)}</span>
        <div class="user-main">
          <div class="user-name"></div>
          <div class="user-sub"></div>
        </div>
        <div class="user-actions">
          <button class="user-del" aria-label="삭제"><span class="ua-icon">🗑</span><span class="ua-label">삭제</span></button>
        </div>`;
      li.querySelector('.user-name').textContent = c.name;
      li.querySelector('.user-sub').textContent = displayPhone(c.phone) || '—';
      li.querySelector('.user-del').onclick = async () => {
        if (!confirm(`"${c.name}" 연락처를 삭제할까요?`)) return;
        await api(`/api/emergency/${c.id}`, { method: 'DELETE' });
        loadSosAdmin();
        loadEmergencyContacts();
      };
      ul.appendChild(li);
    }
  } catch {}
}

let SOS_PICKED_ICON = 'heart';
function renderSosIconPicker() {
  const grid = $('sosIconPicker');
  if (!grid) return;
  grid.innerHTML = '';
  const picks = ['heart','mom','dad','grandma','grandpa','dog','cat','star','sun','flower','smile','love','angel','chef','doctor','teacher'];
  for (const code of picks) {
    const i = ICONS.find((x) => x.code === code) || ICONS[0];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-opt' + (code === SOS_PICKED_ICON ? ' selected' : '');
    b.title = i.label;
    b.innerHTML = `<span class="icon-emoji">${i.emoji}</span>`;
    b.onclick = () => { SOS_PICKED_ICON = code; renderSosIconPicker(); };
    grid.appendChild(b);
  }
}

// 관리자 설정 진입 시 1회 세팅
const _origMigrateAdmin = typeof migrateAdminToSettings === 'function' ? migrateAdminToSettings : null;

// ---------- 오늘 가족 타임라인 ----------
function renderTimeline() {
  try {
    const card = $('timelineCard');
    const ul = $('timelineList');
    if (!ul) return;
    const items = [];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

    // 오늘 메모 (작성자·시간)
    for (const m of (MEMO_CACHE || [])) {
      if (!m.created_at || !m.created_by_name) continue;
      const d = new Date(m.created_at);
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (ymd !== today) continue;
      items.push({
        ts: d.getTime(),
        icon: m.created_by_icon,
        text: `${m.created_by_name}님이 메모를 남겼어요`,
        detail: m.content,
      });
    }
    // 오늘 답변자
    for (const a of (QUESTION_ANSWERERS_CACHE || [])) {
      items.push({
        ts: Date.now() - 1000, // 실제 시간은 모름 → 최근으로
        icon: a.icon,
        text: `${a.display_name}님이 오늘 질문에 답했어요`,
      });
    }
    // 오늘 기분
    for (const m of (FAMILY_CACHE || [])) {
      if (!m.mood) continue;
      items.push({
        ts: Date.now() - 500,
        icon: m.icon,
        text: `${m.displayName}님이 오늘 기분을 남겼어요`,
        detail: m.mood,
      });
    }

    if (!items.length) { card.classList.add('hidden'); return; }
    items.sort((a, b) => b.ts - a.ts);

    ul.innerHTML = '';
    for (const it of items.slice(0, 10)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="tl-emoji">${iconEmoji(it.icon)}</span>
        <div class="tl-body">
          <div class="tl-text"></div>
          ${it.detail ? '<div class="tl-detail"></div>' : ''}
        </div>`;
      li.querySelector('.tl-text').textContent = it.text;
      if (it.detail) li.querySelector('.tl-detail').textContent = it.detail;
      ul.appendChild(li);
    }
    card.classList.remove('hidden');
  } catch {}
}

// ---------- 오늘 기분 ----------
const MOODS = [
  { code: '😊', label: '좋아요' },
  { code: '😌', label: '편안해요' },
  { code: '🥰', label: '사랑해요' },
  { code: '😄', label: '신나요' },
  { code: '😴', label: '피곤해요' },
  { code: '🤒', label: '아파요' },
  { code: '😢', label: '속상해요' },
  { code: '😮‍💨', label: '힘들어요' },
];
async function loadMoodCard() {
  try {
    const alias = ME?.familyAlias;
    if (!alias) return;
    const r = await fetch(`/api/family/${encodeURIComponent(alias)}`).then((r) => r.json());
    FAMILY_CACHE = r.members; // 타임라인용 최신 반영
    renderMoodPicker(r.members.find((m) => m.id === ME.id)?.mood);
    renderMoodFamily(r.members);
    renderTimeline();
  } catch {}
}
function renderMoodPicker(currentMood) {
  const pick = $('moodPicker');
  pick.innerHTML = '';
  for (const m of MOODS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mood-opt' + (m.code === currentMood ? ' selected' : '');
    b.title = m.label;
    b.innerHTML = `<span class="mood-e">${m.code}</span>`;
    b.onclick = async () => {
      const next = m.code === currentMood ? '' : m.code;
      try {
        await api('/api/me/mood', { method: 'POST', body: JSON.stringify({ mood: next }) });
        loadMoodCard();
        loadFamilySummary();
      } catch {}
    };
    pick.appendChild(b);
  }
}
function renderMoodFamily(members) {
  const row = $('moodFamily');
  row.innerHTML = '';
  const withMood = members.filter((m) => m.mood && m.id !== ME.id);
  if (!withMood.length) {
    row.innerHTML = '<p class="mood-empty">아직 다른 가족이 오늘 기분을 남기지 않았어요</p>';
    return;
  }
  for (const m of withMood) {
    const d = document.createElement('div');
    d.className = 'mood-chip';
    d.innerHTML = `
      <span class="mood-chip-emoji">${inlineAvatarHtml({ id: m.id, icon: m.icon, photoUrl: m.photoUrl }, 24)}</span>
      <span class="mood-chip-mood">${m.mood}</span>
      <span class="mood-chip-name"></span>`;
    d.querySelector('.mood-chip-name').textContent = m.displayName;
    row.appendChild(d);
  }
}

// ---------- 주간 가족 요약 ----------
async function loadWeeklyReport() {
  try {
    const r = await api('/api/activity/week');
    const total = (r.answers?.total || 0) + (r.memos?.total || 0) + (r.stickers?.total || 0) + (r.moodCheckins || 0);
    if (total === 0) { $('weeklyCard').classList.add('hidden'); return; }

    const grid = $('weeklyGrid');
    grid.innerHTML = '';
    const tiles = [
      { emoji: '💬', label: '답변', value: r.answers?.total || 0 },
      { emoji: '📝', label: '메모', value: r.memos?.total || 0 },
      { emoji: '💖', label: '응원', value: r.stickers?.total || 0 },
      { emoji: '😊', label: '기분', value: r.moodCheckins || 0 },
    ];
    for (const t of tiles) {
      const div = document.createElement('div');
      div.className = 'wk-tile';
      div.innerHTML = `
        <div class="wk-emoji">${t.emoji}</div>
        <div class="wk-value">${t.value}</div>
        <div class="wk-label"></div>`;
      div.querySelector('.wk-label').textContent = t.label;
      grid.appendChild(div);
    }

    // Top 응원 표시
    const tops = $('weeklyTops');
    const topAns = (r.answers?.byUser || [])[0];
    const parts = [];
    if (topAns) parts.push(`🏆 가장 많이 답한 가족은 ${iconEmoji(topAns.icon)} <b>${topAns.name}</b>님 (${topAns.count}일)`);
    if (r.stickers?.topSender) parts.push(`💌 가장 많이 응원한 가족은 ${iconEmoji(r.stickers.topSender.icon)} <b>${r.stickers.topSender.name}</b>님`);
    if (r.stickers?.topReceiver) parts.push(`💖 가장 많이 응원받은 가족은 ${iconEmoji(r.stickers.topReceiver.icon)} <b>${r.stickers.topReceiver.name}</b>님`);
    if (parts.length) {
      tops.innerHTML = parts.map((p) => `<p class="wk-top">${p}</p>`).join('');
      tops.classList.remove('hidden');
    } else {
      tops.classList.add('hidden');
    }

    $('weeklyCard').classList.remove('hidden');
  } catch {}
}

// 주간 MVP 산정 (답변 2점 + 응원 보낸 1점 가중치)
function computeWeeklyMvp(week) {
  const score = new Map();
  const info = new Map();
  for (const a of (week.answers?.byUser || [])) {
    score.set(a.userId, (score.get(a.userId) || 0) + a.count * 2);
    info.set(a.userId, { name: a.name, icon: a.icon });
  }
  if (week.stickers?.topSender) {
    // topSender only; for full fairness we'd need all senders, but API doesn't return it
    // Fall back: rely on receiver too
  }
  let best = null;
  for (const [uid, s] of score) {
    if (!best || s > best.score) best = { userId: uid, score: s, ...info.get(uid) };
  }
  return best;
}
function renderWeeklyMvp(mvp) {
  const ul = $('missionsList');
  if (!ul) return;
  // 기존 mvp 배너 제거
  ul.querySelectorAll('.mvp-banner').forEach((n) => n.remove());
  if (!mvp || !mvp.name) return;
  const li = document.createElement('li');
  li.className = 'mvp-banner';
  li.innerHTML = `
    <span class="mvp-crown">👑</span>
    <div class="mvp-body">
      <div class="mvp-label">이번 주 MVP</div>
      <div class="mvp-name"><span class="mvp-icon">${iconEmoji(mvp.icon)}</span> <b></b>님</div>
    </div>
    <span class="mvp-score">${mvp.score}점</span>`;
  li.querySelector('b').textContent = mvp.name;
  ul.insertBefore(li, ul.firstChild);
}

// ---------- 주간 미션 ----------
async function loadMissions() {
  try {
    const list = await api('/api/missions/week');
    // 주간 MVP 계산: 응원 보낸 수 + 답변 수 기준 상위 1명
    try {
      const w = await api('/api/activity/week');
      const mvp = computeWeeklyMvp(w);
      renderWeeklyMvp(mvp);
    } catch {}
    const ul = $('missionsList');
    ul.innerHTML = '';
    if (!list.length) { $('missionsCard').classList.add('hidden'); return; }
    let doneCount = 0;
    for (const m of list) {
      const pct = Math.round((m.progress / m.target) * 100);
      const done = m.progress >= m.target;
      if (done) doneCount++;
      const li = document.createElement('li');
      li.className = 'mission-item' + (done ? ' done' : '');
      li.innerHTML = `
        <span class="ms-emoji">${m.emoji}</span>
        <div class="ms-body">
          <div class="ms-title"></div>
          <div class="ms-bar-wrap"><div class="ms-bar" style="width:${Math.min(100, pct)}%"></div></div>
        </div>
        <span class="ms-count">${m.progress}/${m.target}</span>
        ${done ? '<span class="ms-check">✓</span>' : ''}`;
      li.querySelector('.ms-title').textContent = m.title;
      ul.appendChild(li);
    }
    $('missionsCard').classList.remove('hidden');
    if (doneCount === list.length) {
      const congrat = document.createElement('li');
      congrat.className = 'mission-congrat';
      congrat.textContent = '🎉 이번 주 미션 전부 완료! 멋져요';
      ul.appendChild(congrat);
    }
  } catch {}
}

// ---------- 내 정보 편집 ----------
let MY_PICKED_ICON = 'star';
$('myProfileBtn').addEventListener('click', () => openMyProfileSheet());
function openMyProfileSheet() {
  const self = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
  // 사진이 등록되어 있으면 아이콘 선택 해제 상태로 시작 (사진이 우선)
  MY_PICKED_ICON = self?.photoUrl ? null : (ME.icon || 'star');
  $('myDisplay').value = ME.displayName || '';
  $('myYear').value  = ME.birthYear  || '';
  $('myMonth').value = ME.birthMonth || '';
  $('myDay').value   = ME.birthDay   || '';
  $('myLunar').checked = !!ME.isLunar;
  $('myPhone').value = displayPhone(self?.phone);
  $('myCurrentPw').value = ''; $('myNewPw').value = '';
  renderMyIconPicker();
  renderMyPhotoPreview();
  $('myProfileSheet').classList.remove('hidden');
}

$('heroAvatar').addEventListener('click', () => {
  if (!ME) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  openMyProfileSheet();
});
$('heroAvatar').addEventListener('keydown', (e) => {
  if (!ME) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    openMyProfileSheet();
  }
});

function renderMyPhotoPreview() {
  const el = $('myPhotoPreview');
  const self = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
  const url = (self?.photoUrl || '').trim();
  const clearBtn = $('myPhotoClearBtn');
  if (url) {
    el.innerHTML = `<img src="${url.replace(/"/g, '')}" alt="" />`;
    clearBtn.classList.remove('hidden');
  } else {
    el.innerHTML = `<span class="my-photo-placeholder">${iconEmoji(ME.icon)}</span>`;
    clearBtn.classList.add('hidden');
  }
}

// ---------- 프로필 사진: 원형 크롭 + 업로드 ----------
const CROP_PREVIEW_SZ = 320;
const CROP_R = CROP_PREVIEW_SZ / 2;
const CROP_EXPORT_SZ = 640;
const profileCropState = { img: null, zoom: 1, panX: 0, panY: 0, objectUrl: null, dragging: false, last: null };

function drawProfileCropCanvas() {
  const canvas = $('profileCropCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const S = CROP_PREVIEW_SZ;
  const R = CROP_R;
  canvas.width = S * dpr;
  canvas.height = S * dpr;
  canvas.style.width = `${S}px`;
  canvas.style.height = `${S}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, S, S);
  const img = profileCropState.img;
  if (!img || !img.complete || !img.naturalWidth) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max((2 * R) / iw, (2 * R) / ih);
  const dw = iw * base * profileCropState.zoom;
  const dh = ih * base * profileCropState.zoom;
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    img,
    S / 2 - dw / 2 + profileCropState.panX,
    S / 2 - dh / 2 + profileCropState.panY,
    dw,
    dh
  );
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function exportProfileCropCanvas() {
  const img = profileCropState.img;
  if (!img || !img.naturalWidth) return null;
  const S = CROP_EXPORT_SZ;
  const R = S / 2;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  // base 는 이미 640 기준으로 계산되므로 그대로 쓰면 export 좌표계에 맞음.
  // 팬 오프셋만 preview(320) → export(640) 비율로 보정.
  const base = Math.max((2 * R) / iw, (2 * R) / ih);
  const ratio = S / CROP_PREVIEW_SZ;
  const dw = iw * base * profileCropState.zoom;
  const dh = ih * base * profileCropState.zoom;
  const panX = profileCropState.panX * ratio;
  const panY = profileCropState.panY * ratio;
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, S / 2 - dw / 2 + panX, S / 2 - dh / 2 + panY, dw, dh);
  ctx.restore();
  return canvas;
}

function canvasToJpegUnderMax(canvas, maxBytes = 1024 * 1024 - 1) {
  let q = 0.9;
  let c = canvas;
  return (async function loop() {
    for (let i = 0; i < 42; i++) {
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
      if (blob && blob.size <= maxBytes) return blob;
      if (q > 0.52) {
        q -= 0.06;
      } else {
        const w = Math.max(240, Math.floor(c.width * 0.87));
        const h = Math.max(240, Math.floor(c.height * 0.87));
        const c2 = document.createElement('canvas');
        c2.width = w;
        c2.height = h;
        c2.getContext('2d').drawImage(c, 0, 0, w, h);
        c = c2;
        q = 0.88;
      }
    }
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.45));
  })();
}

async function uploadProfilePhotoBlob(blob) {
  const fd = new FormData();
  fd.append('photo', blob, 'profile.jpg');
  const r = await fetch('/api/me/photo', { method: 'POST', body: fd, credentials: 'same-origin' });
  if (!r.ok) {
    let msg = '업로드 실패';
    try {
      const j = await r.json();
      if (j.message) msg = j.message;
    } catch {}
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json();
}

function openProfilePhotoCrop(objectUrl) {
  const img = new Image();
  img.onload = () => {
    profileCropState.objectUrl = objectUrl;
    profileCropState.img = img;
    profileCropState.zoom = 1;
    profileCropState.panX = 0;
    profileCropState.panY = 0;
    drawProfileCropCanvas();
    $('profilePhotoCropSheet').classList.remove('hidden');
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    alert('이미지를 열 수 없어요');
  };
  img.src = objectUrl;
}

function closeProfilePhotoCropSheet() {
  $('profilePhotoCropSheet').classList.add('hidden');
  if (profileCropState.objectUrl) {
    URL.revokeObjectURL(profileCropState.objectUrl);
    profileCropState.objectUrl = null;
  }
  profileCropState.img = null;
}

$('myPhotoPickBtn').addEventListener('click', () => $('myPhotoFile').click());
$('myPhotoFile').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f || !f.type.startsWith('image/')) {
    if (f) alert('이미지 파일을 선택해 주세요');
    return;
  }
  openProfilePhotoCrop(URL.createObjectURL(f));
});
$('myPhotoClearBtn').addEventListener('click', async () => {
  if (!confirm('프로필 사진을 지울까요?')) return;
  try {
    await api('/api/me', { method: 'PATCH', body: JSON.stringify({ photoUrl: null }) });
    const self = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
    if (self) self.photoUrl = null;
    // 사진을 지웠으니 기존 아이콘을 다시 선택 상태로
    MY_PICKED_ICON = ME.icon || 'star';
    renderMyIconPicker();
    renderMyPhotoPreview();
    renderHero();
    renderAccount();
    loadFamilySummary();
  } catch {
    alert('삭제 실패');
  }
});

const profileCropCanvas = $('profileCropCanvas');
if (profileCropCanvas) {
  profileCropCanvas.addEventListener('pointerdown', (e) => {
    if (!profileCropState.img) return;
    e.preventDefault();
    profileCropState.dragging = true;
    profileCropState.last = { x: e.clientX, y: e.clientY };
    try { profileCropCanvas.setPointerCapture(e.pointerId); } catch {}
  });
  profileCropCanvas.addEventListener('pointermove', (e) => {
    if (!profileCropState.dragging || !profileCropState.last) return;
    e.preventDefault();
    profileCropState.panX += e.clientX - profileCropState.last.x;
    profileCropState.panY += e.clientY - profileCropState.last.y;
    profileCropState.last = { x: e.clientX, y: e.clientY };
    drawProfileCropCanvas();
  });
  profileCropCanvas.addEventListener('pointerup', () => {
    profileCropState.dragging = false;
    profileCropState.last = null;
  });
  profileCropCanvas.addEventListener('pointercancel', () => {
    profileCropState.dragging = false;
    profileCropState.last = null;
  });
  profileCropCanvas.addEventListener(
    'wheel',
    (e) => {
      if (!profileCropState.img) return;
      e.preventDefault();
      const d = e.deltaY > 0 ? -0.08 : 0.08;
      profileCropState.zoom = Math.min(4, Math.max(1, profileCropState.zoom + d));
      drawProfileCropCanvas();
    },
    { passive: false }
  );
}
$('profileCropZoomIn').addEventListener('click', () => {
  if (!profileCropState.img) return;
  profileCropState.zoom = Math.min(4, profileCropState.zoom + 0.12);
  drawProfileCropCanvas();
});
$('profileCropZoomOut').addEventListener('click', () => {
  if (!profileCropState.img) return;
  profileCropState.zoom = Math.max(1, profileCropState.zoom - 0.12);
  drawProfileCropCanvas();
});
$('profileCropCancel').addEventListener('click', closeProfilePhotoCropSheet);
$('profilePhotoCropSheet').addEventListener('click', (e) => {
  if (e.target.id === 'profilePhotoCropSheet') closeProfilePhotoCropSheet();
});
$('profileCropApply').addEventListener('click', async () => {
  const src = exportProfileCropCanvas();
  if (!src) return;
  try {
    const blob = await canvasToJpegUnderMax(src);
    const data = await uploadProfilePhotoBlob(blob);
    const self = (FAMILY_CACHE || []).find((x) => x.id === ME.id);
    if (self) self.photoUrl = data.photoUrl;
    // 사진이 등록됐으니 아이콘 선택 해제
    MY_PICKED_ICON = null;
    renderMyIconPicker();
    renderMyPhotoPreview();
    closeProfilePhotoCropSheet();
    renderHero();
    renderAccount();
    loadFamilySummary();
  } catch (err) {
    alert(err.message || '업로드 실패');
  }
});
function renderMyIconPicker() {
  const grid = $('myIconPicker');
  grid.innerHTML = '';
  for (const i of ICONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-opt' + (i.code === MY_PICKED_ICON ? ' selected' : '');
    b.title = i.label;
    b.innerHTML = `<span class="icon-emoji">${i.emoji}</span>`;
    b.onclick = () => {
      MY_PICKED_ICON = i.code;
      grid.querySelectorAll('.icon-opt').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
    };
    grid.appendChild(b);
  }
}
$('myProfileClose').addEventListener('click', () => $('myProfileSheet').classList.add('hidden'));
$('myProfileSheet').addEventListener('click', (e) => {
  if (e.target.id === 'myProfileSheet') $('myProfileSheet').classList.add('hidden');
});
$('mySave').addEventListener('click', async () => {
  const body = {
    displayName: $('myDisplay').value.trim(),
    birthYear:  $('myYear').value  || null,
    birthMonth: $('myMonth').value || null,
    birthDay:   $('myDay').value   || null,
    isLunar: $('myLunar').checked,
    phone: $('myPhone').value.trim() || null,
  };
  // 아이콘 선택이 해제된 상태(사진이 우선)면 icon 필드는 PATCH 에서 제외해 기존 DB 값 유지
  if (MY_PICKED_ICON) body.icon = MY_PICKED_ICON;
  const newPw = $('myNewPw').value;
  const curPw = $('myCurrentPw').value;
  if (newPw) {
    if (newPw.length < 4) { alert('비밀번호는 4자 이상'); return; }
    if (!curPw) { alert('현재 비밀번호를 입력해 주세요'); return; }
    body.password = newPw;
    body.currentPassword = curPw;
  }
  try {
    await api('/api/me', { method: 'PATCH', body: JSON.stringify(body) });
    // ME 캐시 업데이트
    ME = { ...ME, ...body, displayName: body.displayName };
    if (body.icon) ME.icon = body.icon;
    $('myProfileSheet').classList.add('hidden');
    // 새로고침으로 모든 UI 반영
    location.reload();
  } catch (e) {
    if (e.status === 401) alert('현재 비밀번호가 맞지 않아요');
    else if (e.status === 409) alert('이름이 이미 사용중이에요');
    else alert('저장 실패');
  }
});

// ---------- 가족 공용 일정 ----------
let EVENTS_CACHE = [];
async function loadEvents() {
  try {
    EVENTS_CACHE = await api('/api/events');
    renderEventsCard();
    renderCalendar(); // 달력 셀에 이벤트 표시
  } catch {}
}
function renderEventsCard() {
  const card = $('eventsCard');
  const list = $('eventsList');
  const upcoming = (EVENTS_CACHE || []).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 30).slice(0, 8);
  if (!upcoming.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  list.innerHTML = '';
  for (const ev of upcoming) {
    const li = document.createElement('li');
    li.className = 'event-item' + (ev.daysLeft === 0 ? ' today' : '');
    const dateLabel = ev.daysLeft === 0 ? '오늘' : ev.daysLeft === 1 ? '내일' : `${ev.daysLeft}일 뒤`;
    const d = new Date(ev.event_date);
    li.innerHTML = `
      <span class="ev-emoji">${ev.emoji}</span>
      <div class="ev-body">
        <div class="ev-title"></div>
        <div class="ev-meta">${d.getMonth() + 1}월 ${d.getDate()}일${ev.event_time ? ' ' + ev.event_time : ''}${ev.location ? ' · ' + escapeHtml(ev.location) : ''}</div>
      </div>
      <span class="ev-days ${ev.daysLeft === 0 ? 'today' : ''}">${dateLabel}</span>
      ${ev.created_by === ME.id || ME.role === 'admin' ? `<button class="ev-del" data-id="${ev.id}" aria-label="삭제">✕</button>` : ''}`;
    li.querySelector('.ev-title').textContent = ev.title;
    const del = li.querySelector('.ev-del');
    if (del) del.onclick = async () => {
      if (!confirm(`"${ev.title}" 일정을 삭제할까요?`)) return;
      await api(`/api/events/${ev.id}`, { method: 'DELETE' });
      loadEvents();
    };
    list.appendChild(li);
  }
}

$('eventNewBtn').addEventListener('click', () => {
  $('evDate').value = new Date().toISOString().slice(0, 10);
  $('eventCreateSheet').classList.remove('hidden');
});
$('evCreateClose').addEventListener('click', () => $('eventCreateSheet').classList.add('hidden'));
$('eventCreateSheet').addEventListener('click', (e) => {
  if (e.target.id === 'eventCreateSheet') $('eventCreateSheet').classList.add('hidden');
});
$('evCreate').addEventListener('click', async () => {
  const body = {
    title: $('evTitle').value.trim(),
    emoji: $('evEmoji').value.trim() || '📅',
    eventDate: $('evDate').value,
    eventTime: $('evTime').value || null,
    location: $('evLocation').value.trim() || null,
    note: $('evNote').value.trim() || null,
  };
  if (!body.title || !body.eventDate) { alert('일정 이름과 날짜를 입력해 주세요'); return; }
  try {
    await api('/api/events', { method: 'POST', body: JSON.stringify(body) });
    ['evTitle','evEmoji','evTime','evLocation','evNote'].forEach((id) => $(id).value = '');
    $('eventCreateSheet').classList.add('hidden');
    loadEvents();
  } catch { alert('추가 실패'); }
});

// ---------- 월간 가족 달력 ----------
let CAL_VIEW = new Date();
CAL_VIEW.setDate(1);

function renderCalendar() {
  const grid = $('calGrid');
  const title = $('calTitle');
  if (!grid || !title) return;
  const y = CAL_VIEW.getFullYear();
  const m = CAL_VIEW.getMonth();
  title.textContent = `${y}년 ${m + 1}월`;

  // 이번 달 생일 맵: "m-d" -> [{name, icon}, ...]
  const birthdayMap = new Map();
  for (const mem of (FAMILY_CACHE || [])) {
    if (mem.birthMonth == null || mem.birthDay == null) continue;
    if (mem.birthMonth !== m + 1) continue;
    const key = mem.birthDay;
    const arr = birthdayMap.get(key) || [];
    arr.push(mem);
    birthdayMap.set(key, arr);
  }
  // 이번 달 이벤트 맵
  const eventMap = new Map();
  for (const ev of (EVENTS_CACHE || [])) {
    const d = new Date(ev.event_date);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const key = d.getDate();
    const arr = eventMap.get(key) || [];
    arr.push(ev);
    eventMap.set(key, arr);
  }

  const first = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0).getDate();
  const startWeekday = first.getDay(); // 0=일

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  grid.innerHTML = '';
  // 앞 빈칸
  for (let i = 0; i < startWeekday; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }
  for (let d = 1; d <= lastDay; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    const isToday = (y === todayY && m === todayM && d === todayD);
    const bdPeople = birthdayMap.get(d);
    const evs = eventMap.get(d);
    if (isToday) cell.classList.add('is-today');
    if (bdPeople) cell.classList.add('is-birthday');
    if (evs) cell.classList.add('has-event');
    const icons = [];
    if (bdPeople) icons.push(...bdPeople.slice(0, 2).map((p) => iconEmoji(p.icon)));
    if (evs) icons.push(...evs.slice(0, 2).map((e) => e.emoji));
    cell.innerHTML = `
      <span class="cal-day">${d}</span>
      ${icons.length ? `<span class="cal-bd">${icons.slice(0, 3).join('')}</span>` : ''}
    `;
    if (bdPeople || evs) {
      cell.onclick = () => {
        const parts = [];
        if (bdPeople) parts.push(...bdPeople.map((p) => `${iconEmoji(p.icon)} ${p.displayName}님 생일 (${m + 1}월 ${d}일)`));
        if (evs) parts.push(...evs.map((e) => `${e.emoji} ${e.title}${e.event_time ? ' ' + e.event_time : ''}${e.location ? ' @ ' + e.location : ''}`));
        alert(parts.join('\n'));
      };
    }
    grid.appendChild(cell);
  }
}
$('calPrev').addEventListener('click', () => { CAL_VIEW.setMonth(CAL_VIEW.getMonth() - 1); renderCalendar(); });
$('calNext').addEventListener('click', () => { CAL_VIEW.setMonth(CAL_VIEW.getMonth() + 1); renderCalendar(); });
$('calToday').addEventListener('click', () => {
  CAL_VIEW = new Date(); CAL_VIEW.setDate(1); renderCalendar();
});

// ---------- 우리 가족 요약 ----------
function koreanAge(birthYear, birthMonth, birthDay) {
  if (!birthYear) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(birthYear);
  // 생일 지났는지 판정 (월/일 있으면 반영, 없으면 그냥 해 차이)
  if (birthMonth && birthDay) {
    const thisYearBirthday = new Date(now.getFullYear(), birthMonth - 1, birthDay);
    if (now < thisYearBirthday) age -= 1;
  }
  return age;
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
let QUESTION_ANSWERERS_CACHE = [];
let STICKERS_CACHE = [];
const STICKER_EMOJIS = ['❤️','👍','🌸','☕','💪','🥰','✨','🎉'];

async function loadFamilySummary() {
  try {
    const alias = ME.familyAlias;
    if (!alias) return;
    const r = await fetch(`/api/family/${encodeURIComponent(alias)}`).then(r => r.json());
    FAMILY_CACHE = r.members;
    // FAMILY_CACHE 가 비어있을 때 먼저 렌더된 hero/account 를 내 photoUrl 로 갱신
    try { renderHero(); } catch {}
    try { renderAccount(); } catch {}
    renderCalendar(); // 가족 데이터 로드 후 달력 생일 표시
    $('familyCardTitle').textContent = r.family.displayName || '우리 가족';
    const row = $('familyRow');
    row.innerHTML = '';
    for (const m of r.members) {
      const age = koreanAge(m.birthYear, m.birthMonth, m.birthDay);
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'family-badge' + (m.id === ME.id ? ' me' : '') + (m.activated ? '' : ' dim');
      badge.style.cssText += accentStyle(m.id, 'bg');
      const avatarHtml = m.photoUrl
        ? `<img class="family-badge-photo" src="${m.photoUrl.replace(/"/g, '')}" alt="" />`
        : `<span class="family-badge-emoji">${iconEmoji(m.icon)}</span>`;
      badge.innerHTML = `
        ${avatarHtml}
        <span class="family-badge-name"></span>
        ${age ? `<span class="family-badge-age">${age}</span>` : ''}
      `;
      badge.querySelector('.family-badge-name').textContent = m.displayName;
      badge.onclick = () => openProfileSheet(m);
      row.appendChild(badge);
    }
    // FAMILY_CACHE 로드가 끝났으니 photoUrl 의존 카드들을 사진으로 새로 그림.
    // (초기 로드 순서상 이 카드들이 FAMILY_CACHE 가 빈 상태에서 이모지로 렌더됐을 수 있음)
    try { if (typeof MEMO_CACHE !== 'undefined' && MEMO_CACHE?.length) renderMemos(MEMO_CACHE); } catch {}
    try { loadZodiac(); } catch {}
    try { loadYesterdayReveal(); } catch {}
    try { loadTodayQuestion(); } catch {}
  } catch {}
}

let CURRENT_PROFILE_USER = null;
function openProfileSheet(m) {
  CURRENT_PROFILE_USER = m;
  const age = koreanAge(m.birthYear, m.birthMonth, m.birthDay);
  // 프로필 큰 아바타: 사진 있으면 이미지, 없거나 로드 실패면 이모지
  setAvatarEl($('profAvatar'), m.photoUrl, m.icon);
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

  // 오늘의 질문 답변 여부
  const answered = QUESTION_ANSWERERS_CACHE.some((a) => a.user_id === m.id);
  $('profTodayAnswer').textContent = answered ? '답변 완료 ✓' : '아직 답변 전';
  $('profTodayAnswer').style.color = answered ? 'var(--good)' : 'var(--sub)';
  $('profTodayAnswerRow').classList.remove('hidden');

  // 오늘 메모 개수 (가족 전체 중 이 사용자가 쓴 것)
  const todayYMD = new Date().toISOString().slice(0, 10);
  const memoCount = (MEMO_CACHE || []).filter((x) => {
    if (!x.created_at) return false;
    const d = new Date(x.created_at);
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return x.created_by_name === m.displayName && ymd === todayYMD;
  }).length;
  $('profMemoCount').textContent = memoCount > 0 ? `${memoCount}개 작성` : '없음';
  $('profMemoCountRow').classList.remove('hidden');

  // 오늘 메모 목록 (최대 5개)
  const profMemos = (MEMO_CACHE || []).filter((x) => {
    if (!x.created_at || x.created_by_name !== m.displayName) return false;
    const d = new Date(x.created_at);
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return ymd === todayYMD;
  }).slice(0, 5);
  const ul = $('profMemoList');
  ul.innerHTML = '';
  if (profMemos.length) {
    for (const pm of profMemos) {
      const li = document.createElement('li');
      li.className = 'prof-memo-item' + (pm.done ? ' done' : '');
      li.innerHTML = `<span class="pm-dot ${pm.done ? 'done' : ''}"></span><span class="pm-text"></span>`;
      li.querySelector('.pm-text').textContent = pm.content;
      ul.appendChild(li);
    }
    ul.classList.remove('hidden');
  } else {
    ul.classList.add('hidden');
  }

  // 전화걸기 버튼
  const callBtn = $('profCallBtn');
  const profTel = displayPhone(m.phone);
  if (profTel && m.id !== ME.id) {
    callBtn.href = `tel:${profTel.replace(/[^0-9+]/g, '')}`;
    callBtn.textContent = `📞 ${m.displayName}님에게 전화`;
    callBtn.classList.remove('hidden');
  } else {
    callBtn.classList.add('hidden');
  }

  // 응원 스티커 섹션
  updateProfileStickerSections(m);

  // 기분 7일 히스토리
  loadProfileMoodWeek(m.id);

  // 누적 기록
  loadProfileStats(m.id);

  $('profileSheet').classList.remove('hidden');
}

async function loadProfileStats(userId) {
  try {
    const s = await api(`/api/user/${userId}/stats`);
    const grid = $('profStatsGrid');
    grid.innerHTML = '';
    const tiles = [
      { emoji: '💬', label: '답변', value: s.answers },
      { emoji: '📝', label: '메모', value: s.memos },
      { emoji: '💖', label: '받은 응원', value: s.stickersReceived },
      { emoji: '💌', label: '보낸 응원', value: s.stickersSent },
    ];
    for (const t of tiles) {
      const d = document.createElement('div');
      d.className = 'ps-tile';
      d.innerHTML = `<div class="ps-emoji">${t.emoji}</div><div class="ps-value">${t.value}</div><div class="ps-label">${t.label}</div>`;
      grid.appendChild(d);
    }
    $('profStatsSection').classList.remove('hidden');
  } catch { $('profStatsSection').classList.add('hidden'); }
}

async function loadProfileMoodWeek(userId) {
  try {
    const days = await api(`/api/user/${userId}/moods/week`);
    const row = $('profMoodWeekRow');
    row.innerHTML = '';
    let hasAny = false;
    for (const d of days) {
      if (d.mood) hasAny = true;
      const cell = document.createElement('div');
      cell.className = 'mw-cell' + (d.mood ? '' : ' empty');
      cell.innerHTML = `
        <div class="mw-emoji">${d.mood || '·'}</div>
        <div class="mw-day">${d.weekday}</div>`;
      row.appendChild(cell);
    }
    $('profMoodWeek').classList.toggle('hidden', !hasAny);
  } catch { $('profMoodWeek').classList.add('hidden'); }
}

function closeProfileSheet() {
  $('profileSheet').classList.add('hidden');
  CURRENT_PROFILE_USER = null;
}

function spawnConfetti() {
  const emojis = ['🎉','🎊','🎂','🎈','✨','💖','🌸'];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    d.style.left = Math.random() * 100 + 'vw';
    d.style.animationDelay = (Math.random() * 1.2) + 's';
    d.style.animationDuration = (3 + Math.random() * 2) + 's';
    d.style.fontSize = (18 + Math.random() * 16) + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }
}

// ---------- 생일 + 이번 주 기념일 ----------
let TODAY_BIRTHDAY_USER = null;
async function loadBirthday() {
  try {
    const r = await api('/api/birthdays/soon');
    renderUpcomingCard(r);
    // Hero chip 에 쓸 다음 생일 기억
    if (r.today) {
      window._NEXT_BIRTHDAY = { ...r.today, daysLeft: 0 };
    } else if (r.upcoming?.length) {
      window._NEXT_BIRTHDAY = r.upcoming[0];
    } else {
      window._NEXT_BIRTHDAY = null;
    }
    renderHeroSummary();
    const el = $('birthdayBanner');
    el.classList.remove('today');
    TODAY_BIRTHDAY_USER = null;
    if (r.today) {
      const isMe = ME && r.today.id === ME.id;
      TODAY_BIRTHDAY_USER = r.today;
      // 세션 중 1회만 폭죽
      if (!sessionStorage.getItem('fb_confetti_' + (r.today.id || 'x'))) {
        spawnConfetti();
        sessionStorage.setItem('fb_confetti_' + (r.today.id || 'x'), '1');
      }
      $('bdEmoji').textContent = isMe ? '🎉' : iconEmoji(r.today.icon);
      $('bdTitle').textContent = isMe
        ? `${ME.displayName}님, 생일 축하드려요!`
        : `오늘은 ${r.today.display_name}님 생일이에요`;
      $('bdSub').textContent = isMe
        ? '가족들이 남긴 축하 메시지를 확인해 보세요 🎂'
        : '탭해서 축하 메시지를 남겨보세요 🌷';
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

// 배너 탭하면 축하 시트 열기
$('birthdayBanner').addEventListener('click', () => {
  if (TODAY_BIRTHDAY_USER) openBirthdaySheet(TODAY_BIRTHDAY_USER);
});

async function openBirthdaySheet(target) {
  try {
    const data = await api(`/api/birthday/${target.id}/messages`);
    const isMe = ME.id === target.id;
    $('bdayTargetEmoji').textContent = iconEmoji(target.icon);
    $('bdayTargetTitle').textContent = isMe
      ? `🎂 ${target.display_name}님 생일 축하드려요`
      : `🎂 오늘은 ${target.display_name}님 생일`;
    $('bdayTargetSub').textContent = isMe
      ? `가족들이 남긴 축하 메시지 ${data.messages.length}개`
      : `지금까지 ${data.messages.length}개의 축하 메시지`;

    const list = $('bdayMsgList');
    list.innerHTML = '';
    if (!data.messages.length) {
      list.innerHTML = `<li class="empty-state">
        <span class="empty-state-emoji">💌</span>
        <span class="empty-state-text">${isMe ? '아직 메시지가 없어요' : '첫 번째 메시지의 주인공이 되어주세요'}</span>
      </li>`;
    } else {
      for (const m of data.messages) {
        const li = document.createElement('li');
        li.className = 'bday-msg';
        li.innerHTML = `
          <span class="reveal-emoji">${inlineAvatarHtml({ name: m.author_name, icon: m.author_icon }, 36)}</span>
          <div class="reveal-body">
            <div class="reveal-name"></div>
            <div class="reveal-answer"></div>
          </div>
          ${m.author_user_id === ME.id ? '<button class="bday-msg-del" title="내 메시지 삭제">✕</button>' : ''}`;
        li.querySelector('.reveal-name').textContent = m.author_name + '님';
        li.querySelector('.reveal-answer').textContent = m.message;
        const del = li.querySelector('.bday-msg-del');
        if (del) del.onclick = async () => {
          if (!confirm('내 축하 메시지를 삭제할까요?')) return;
          await api(`/api/birthday/${target.id}/message`, { method: 'DELETE' });
          openBirthdaySheet(target);
        };
        list.appendChild(li);
      }
    }

    // 본인 생일이면 폼 숨김, 아니면 폼 표시 (내 메시지 있으면 prefill)
    const formWrap = $('bdayFormWrap');
    if (isMe) {
      formWrap.classList.add('hidden');
    } else {
      formWrap.classList.remove('hidden');
      const mine = data.messages.find((m) => m.author_user_id === ME.id);
      $('bdayMsgInput').value = mine?.message || '';
      $('bdayMsgSubmit').textContent = mine ? '메시지 수정' : '메시지 남기기';
      $('bdayMsgSubmit').onclick = async () => {
        const text = $('bdayMsgInput').value.trim();
        if (!text) { alert('한 마디 적어주세요'); return; }
        try {
          await api(`/api/birthday/${target.id}/message`, {
            method: 'POST', body: JSON.stringify({ text }),
          });
          openBirthdaySheet(target);
        } catch { alert('저장 실패'); }
      };
    }
    $('bdaySheet').classList.remove('hidden');
  } catch (e) { console.warn('[bday sheet]', e); }
}
$('bdayClose').addEventListener('click', () => $('bdaySheet').classList.add('hidden'));
$('bdaySheet').addEventListener('click', (e) => {
  if (e.target.id === 'bdaySheet') $('bdaySheet').classList.add('hidden');
});

let ANNIV_CACHE = [];
function renderUpcomingCard(r) {
  const list = [];
  // 생일
  if (r.today) list.push({ kind: 'birthday', ...r.today, daysLeft: 0 });
  if (r.upcoming) list.push(...r.upcoming.map((u) => ({ kind: 'birthday', ...u })));
  // 커스텀 기념일 (7일 이내만 여기서)
  for (const a of (ANNIV_CACHE || [])) {
    if (a.daysLeft <= 7) list.push({ kind: 'anniv', ...a });
  }
  list.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));

  const card = $('upcomingCard');
  const ul = $('upcomingList');
  if (!list.length) { card.classList.add('hidden'); return; }
  ul.innerHTML = '';
  for (const u of list) {
    const li = document.createElement('li');
    const dayLabel = u.daysLeft === 0 ? '오늘'
      : u.daysLeft === 1 ? '내일'
      : `${u.daysLeft}일 뒤`;
    const emoji = u.kind === 'birthday' ? iconEmoji(u.icon) : (u.emoji || '🎈');
    const name = u.kind === 'birthday' ? `${u.display_name}님` : u.title;
    const dateLine = u.kind === 'birthday'
      ? `${u.birth_month}월 ${u.birth_day}일${u.is_lunar ? ' (음력)' : ''} 생일`
      : `${u.month}월 ${u.day}일${u.is_lunar ? ' (음력)' : ''}${u.year ? ' (' + (new Date().getFullYear() - u.year) + '주년)' : ''}`;
    li.innerHTML = `
      <span class="up-emoji">${emoji}</span>
      <div class="up-body">
        <div class="up-name"></div>
        <div class="up-date"></div>
      </div>
      <span class="up-days ${u.daysLeft === 0 ? 'today' : ''}"></span>`;
    li.querySelector('.up-name').textContent = name;
    li.querySelector('.up-date').textContent = dateLine;
    li.querySelector('.up-days').textContent = dayLabel;
    ul.appendChild(li);
  }
  card.classList.remove('hidden');
}

async function loadAnniversaries() {
  try {
    ANNIV_CACHE = await api('/api/anniversaries');
    // 관리자 설정에도 반영
    const listEl = $('annivList');
    if (listEl) {
      listEl.innerHTML = '';
      if (!ANNIV_CACHE.length) {
        listEl.innerHTML = '<li style="color:var(--sub);font-size:13px;padding:6px 0">등록된 기념일이 없어요</li>';
      }
      for (const a of ANNIV_CACHE) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="user-emoji">${a.emoji || '🎈'}</span>
          <div class="user-main">
            <div class="user-name"></div>
            <div class="user-sub">${a.month}월 ${a.day}일${a.is_lunar ? ' 음력' : ''}${a.year ? ' · ' + a.year + '년' : ''}</div>
          </div>
          <button class="user-del" aria-label="삭제">✕</button>`;
        li.querySelector('.user-name').textContent = a.title;
        li.querySelector('.user-del').onclick = async () => {
          if (!confirm(`"${a.title}" 기념일을 삭제할까요?`)) return;
          await api(`/api/anniversaries/${a.id}`, { method: 'DELETE' });
          loadAnniversaries();
          loadBirthday();
        };
        listEl.appendChild(li);
      }
    }
    loadBirthday(); // upcoming 갱신
  } catch {}
}

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'annivAddBtn') {
    const body = {
      title: $('annivTitle').value.trim(),
      emoji: $('annivEmoji').value.trim() || '🎈',
      month: $('annivMonth').value,
      day: $('annivDay').value,
      year: $('annivYear').value || null,
      isLunar: $('annivLunar').checked,
    };
    if (!body.title || !body.month || !body.day) { alert('제목·월·일을 입력해 주세요'); return; }
    try {
      await api('/api/anniversaries', { method: 'POST', body: JSON.stringify(body) });
      ['annivTitle','annivEmoji','annivYear','annivMonth','annivDay'].forEach((id) => $(id).value = '');
      $('annivLunar').checked = false;
      loadAnniversaries();
    } catch { alert('추가 실패'); }
  }
});

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
    // 도시 옆에 시간대 힌트와 업데이트 시각 — '이게 진짜 <도시> 실시간 데이터구나' 바로 확인
    const tzShort = (w.tz || '').split('/').pop() || '';
    const updated = w.updatedAt ? new Date(w.updatedAt) : null;
    const updatedLabel = updated ? (() => {
      const hh = String(updated.getHours()).padStart(2, '0');
      const mm = String(updated.getMinutes()).padStart(2, '0');
      return `${hh}:${mm} 기준`;
    })() : '';
    $('wCity').textContent = `${w.city}${tzShort ? ' · ' + tzShort : ''} 오늘`;
    if (updatedLabel) $('wCity').title = `Open-Meteo · ${updatedLabel}`;
    $('wDesc').textContent = WMO[w.code] || '';
    $('wIcon').textContent = WMO_ICON[w.code] || '🌤️';
    $('wIcon').classList.remove('skel');
    $('wTemp').textContent = `${w.temp}°`;
    $('wTemp').classList.remove('skel');
    $('wMax').textContent  = `${w.max}°`;
    $('wMin').textContent  = `${w.min}°`;
    $('wFeel').textContent = `${w.feels}°`;
    $('wHum').textContent  = `${w.humidity}%`;
    if (w.tomorrow) {
      $('tmIcon').textContent = WMO_ICON[w.tomorrow.code] || '🌤️';
      $('tmMax').textContent = `${w.tomorrow.max}°`;
      $('tmMin').textContent = `${w.tomorrow.min}°`;
      $('tmRain').classList.toggle('hidden', (w.tomorrow.rainProb || 0) < 60);
      $('tomorrowBlock').classList.remove('hidden');
    }
    renderHourly(w.hourly);
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
  renderOutingScore(w, a);
}

function renderOutingScore(w, a) {
  const box = $('outingScore');
  if (!box || !w) { box?.classList.add('hidden'); return; }
  // 점수 계산: 기온 적정 30, 비 확률 20, 공기질 30, 꽃가루 10, 풍속 10
  let score = 0;
  // 기온
  if (w.temp >= 15 && w.temp <= 25) score += 30;
  else if (w.temp >= 10 && w.temp <= 28) score += 22;
  else if (w.temp >= 5 && w.temp <= 32) score += 12;
  else score += 4;
  // 비
  if ((w.rainProb || 0) < 20) score += 20;
  else if ((w.rainProb || 0) < 50) score += 12;
  else if ((w.rainProb || 0) < 75) score += 4;
  // 공기질
  if (a) {
    const p25 = a.pm25Level, p10 = a.pm10Level;
    if (p25 === 'good' && p10 === 'good') score += 30;
    else if (p25 === 'normal' || p10 === 'normal') score += 20;
    else if (p25 === 'bad' || p10 === 'bad') score += 8;
    else score += 0;
    // 꽃가루
    if (a.pollenLevel === 'good') score += 10;
    else if (a.pollenLevel === 'normal') score += 6;
    else score += 0;
  } else {
    score += 20; // 데이터 없으면 중간값
  }
  // 풍속
  if ((w.wind || 0) < 5) score += 10;
  else if ((w.wind || 0) < 10) score += 5;

  const grade = score >= 80 ? { emoji: '🌳', label: '외출하기 좋아요', tone: 'good' }
              : score >= 60 ? { emoji: '🚶', label: '산책 정도 괜찮아요', tone: 'ok' }
              : score >= 40 ? { emoji: '🧥', label: '짧게 다녀오세요', tone: 'warn' }
                            : { emoji: '🏠', label: '실내가 더 좋아요', tone: 'bad' };
  $('osEmoji').textContent = grade.emoji;
  $('osGrade').textContent = grade.label;
  const parts = [`기온 ${w.temp}°`];
  if ((w.rainProb || 0) >= 30) parts.push(`비 ${w.rainProb}%`);
  if (a?.pm25Level) parts.push(`공기 ${ {good:'좋음', normal:'보통', bad:'나쁨', worst:'매우 나쁨'}[a.pm25Level] || '' }`);
  $('osDetail').textContent = parts.join(' · ');
  box.className = 'outing-score tone-' + grade.tone;
  box.classList.remove('hidden');
}

function renderHourly(hourly) {
  HOURLY_CACHE = hourly || [];
  const block = $('hourlyBlock');
  if (!block) return;
  if (!hourly || !hourly.length) { block.classList.add('hidden'); return; }
  const temps = hourly.map((h) => h.temp);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const range = Math.max(1, tMax - tMin);
  block.innerHTML = hourly.map((h) => {
    const d = new Date(h.time);
    const hour = d.getHours();
    const label = `${hour}시`;
    const icon = WMO_ICON[h.code] || '🌤️';
    const barH = 14 + ((h.temp - tMin) / range) * 34;
    const rain = h.rainProb >= 50;
    return `
      <div class="hr-col ${rain ? 'rain' : ''}">
        <div class="hr-icon">${icon}</div>
        <div class="hr-temp">${h.temp}°</div>
        <div class="hr-bar-wrap"><div class="hr-bar" style="height:${barH}px"></div></div>
        <div class="hr-label">${label}</div>
      </div>`;
  }).join('');
  block.classList.remove('hidden');
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
    else                   dress = `${name}님, 오늘은 반팔이나 시원한 옷을 추천해요`;
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
function renderFxChange(elId, currentValue, savedValue, digits = 0) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chip = el.querySelector('.fx-change');
  if (chip) chip.remove();
  if (savedValue == null || Math.abs(currentValue - savedValue) < 0.005) return;
  const diff = currentValue - savedValue;
  const up = diff > 0;
  const span = document.createElement('span');
  span.className = 'fx-change ' + (up ? 'up' : 'down');
  span.textContent = (up ? '▲' : '▼') + Math.abs(diff).toFixed(digits > 0 ? digits : (Math.abs(diff) < 10 ? 2 : 0));
  el.appendChild(span);
}
async function loadFx() {
  try {
    const r = await fetch('/api/fx').then(r => r.json());
    fxCache = r;

    // 전일자 스냅샷 비교 (localStorage)
    const today = new Date().toISOString().slice(0, 10);
    let prev = null;
    try {
      const snap = JSON.parse(localStorage.getItem('fb_fx_snapshot') || 'null');
      if (snap && snap.date !== today) prev = snap; // 어제 이전 스냅샷만
      if (!snap || snap.date !== today) {
        localStorage.setItem('fb_fx_snapshot', JSON.stringify({
          date: today, jpyKrw: r.jpyKrw, usdJpy: r.usdJpy, usdKrw: r.usdKrw,
        }));
      }
    } catch {}

    $('fxJpyKrw').textContent = fmt.format(Math.round(r.jpyKrw)) + '원';
    $('fxUsdJpy').textContent = r.usdJpy.toFixed(2) + '엔';
    $('fxUsdKrw').textContent = fmt.format(r.usdKrw) + '원';
    if (r.rates?.EUR) $('fxEurKrw').textContent = fmt.format(Math.round(r.rates.KRW / r.rates.EUR)) + '원';
    if (r.rates?.CNY) $('fxCnyKrw').textContent = fmt.format(Math.round(r.rates.KRW / r.rates.CNY)) + '원';
    $('fxHeadline').textContent = `오늘 100엔은 약 ${fmt.format(Math.round(r.jpyKrw))}원이에요`;
    const ts = new Date(r.ts);
    $('fxTs').textContent = `기준: ${ts.getMonth() + 1}월 ${ts.getDate()}일 ${String(ts.getHours()).padStart(2,'0')}시`;

    if (prev) {
      renderFxChange('fxJpyKrw', r.jpyKrw, prev.jpyKrw);
      renderFxChange('fxUsdJpy', r.usdJpy, prev.usdJpy, 2);
      renderFxChange('fxUsdKrw', r.usdKrw, prev.usdKrw);
    }
    calcUpdate();
  } catch {
    $('fxJpyKrw').textContent = $('fxUsdJpy').textContent = $('fxUsdKrw').textContent = '—';
  }
}
// 메모 반복 주기 선택
let MEMO_RECUR = 'none';
document.querySelectorAll('.recur-btn').forEach((b) => {
  b.addEventListener('click', () => {
    MEMO_RECUR = b.dataset.recur;
    document.querySelectorAll('.recur-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  });
});

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
$('calcSwap').addEventListener('click', () => {
  const fromSel = $('calcFrom'), toSel = $('calcTo');
  const fv = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value = fv;
  const resultText = $('calcResult').textContent.replace(/[^\d.-]/g, '');
  const n = parseFloat(resultText);
  if (Number.isFinite(n)) $('calcAmt').value = Math.round(n);
  calcUpdate();
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
let MEMO_CACHE = [];
let MEMO_QUERY = '';
let MEMO_SORT = localStorage.getItem('fb_memo_sort') || 'default';
let MEMO_DUE_DAYS = 'none'; // 'none' | '0' | '1' | '7' | '30'
let MEMO_FILTER = 'all'; // 'all' | 'important' | '🛒' | '💊' | ...
document.querySelectorAll('.memo-filter').forEach((b) => {
  b.addEventListener('click', () => {
    MEMO_FILTER = b.dataset.filter;
    document.querySelectorAll('.memo-filter').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    renderMemos(MEMO_CACHE);
  });
});
async function loadMemos() {
  try {
    const list = await api('/api/memos');
    MEMO_CACHE = list;
    renderMemos(list);
    renderTimeline();
  } catch { renderMemos([]); }
}
$('memoSearch').addEventListener('input', (e) => {
  MEMO_QUERY = e.target.value.trim().toLowerCase();
  renderMemos(MEMO_CACHE);
});
if ($('memoSort')) {
  $('memoSort').value = MEMO_SORT;
  $('memoSort').addEventListener('change', (e) => {
    MEMO_SORT = e.target.value;
    localStorage.setItem('fb_memo_sort', MEMO_SORT);
    renderMemos(MEMO_CACHE);
  });
}

function sortMemos(list) {
  const copy = list.slice();
  const toTime = (m) => m.created_at ? new Date(m.created_at).getTime() : 0;
  switch (MEMO_SORT) {
    case 'recent': return copy.sort((a, b) => toTime(b) - toTime(a));
    case 'oldest': return copy.sort((a, b) => toTime(a) - toTime(b));
    case 'author': return copy.sort((a, b) => (a.created_by_name || '').localeCompare(b.created_by_name || '', 'ko'));
    default: return copy;
  }
}
function renderMemos(list) {
  const ul = $('memoList');
  const doneUl = $('memoDoneList');
  const toggleBtn = $('memoDoneToggle');
  const progress = $('memoProgress');
  const searchEl = $('memoSearch');
  ul.innerHTML = ''; doneUl.innerHTML = '';

  // 검색창 + 필터 행: 메모가 적으면(5개 미만) 자동으로 숨김 — UI 노이즈 감소
  const filterRow = $('memoFilterRow');
  if (list.length >= 5) {
    searchEl.classList.remove('hidden');
    filterRow?.classList.remove('hidden');
  } else {
    searchEl.classList.add('hidden');
    filterRow?.classList.add('hidden');
    // 자동 숨김 시 필터 상태도 리셋 — 나중에 다시 나타났을 때 원하는 결과가 안 나오는 혼란 방지
    if (MEMO_FILTER !== 'all') {
      MEMO_FILTER = 'all';
      document.querySelectorAll('.memo-filter').forEach((x) => x.classList.remove('active'));
      document.querySelector('.memo-filter[data-filter="all"]')?.classList.add('active');
    }
  }

  const q = MEMO_QUERY;
  let filtered = q ? list.filter((m) => (m.content || '').toLowerCase().includes(q)) : list;
  // 카테고리 필터
  if (MEMO_FILTER === 'important') {
    filtered = filtered.filter((m) => m.important);
  } else if (MEMO_FILTER !== 'all') {
    filtered = filtered.filter((m) => (m.content || '').trim().startsWith(MEMO_FILTER));
  }
  filtered = sortMemos(filtered);

  const active = filtered.filter((m) => !m.done);
  const done = filtered.filter((m) => m.done);

  // 진행률
  if (list.length) {
    progress.textContent = done.length
      ? `${done.length} / ${list.length} 완료`
      : `${list.length}개 남음`;
  } else {
    progress.textContent = '';
  }

  // 모든 메모 완료 축하 배너
  const celebrate = $('memoCelebrate');
  if (celebrate) celebrate.classList.toggle('hidden', !(list.length > 0 && active.length === 0));

  if (!list.length) {
    ul.innerHTML = `<li class="empty-state">
      <span class="empty-state-emoji">📝</span>
      <span class="empty-state-text">오늘은 깨끗해요. 아래에 새로 적어보세요</span>
    </li>`;
    toggleBtn.classList.add('hidden');
    doneUl.classList.add('hidden');
    return;
  }
  if (!active.length) {
    ul.innerHTML = `<li class="empty-state" style="padding:12px 0!important">
      <span class="empty-state-text" style="color:var(--good);font-weight:700">전부 완료! 가족에게 뿌듯한 하루예요</span>
    </li>`;
  }
  // 완료된 메모 토글
  if (done.length) {
    $('memoDoneLabel').textContent = `완료된 메모 ${done.length}개`;
    toggleBtn.classList.remove('hidden');
  } else {
    toggleBtn.classList.add('hidden');
    doneUl.classList.add('hidden');
  }

  const renderItem = (m, targetUl) => {
    const li = document.createElement('li');
    li.className = m.important ? 'memo-important' : '';
    if (MEMO_BULK) {
      li.classList.add('memo-bulk-item');
      if (MEMO_BULK_SELECTED.has(m.id)) li.classList.add('selected');
      li.addEventListener('click', (e) => {
        // 내부 버튼 탭은 무시, 다른 곳 탭하면 선택 토글
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        if (MEMO_BULK_SELECTED.has(m.id)) MEMO_BULK_SELECTED.delete(m.id);
        else MEMO_BULK_SELECTED.add(m.id);
        updateBulkUI();
        li.classList.toggle('selected');
      });
    }
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
      <button class="memo-star ${m.important ? 'on' : ''}" aria-label="중요">${m.important ? '⭐' : '☆'}</button>
      <button class="memo-share" aria-label="공유">↗</button>
      <button class="memo-del" aria-label="삭제">✕</button>`;
    const textEl = li.querySelector('.memo-text');
    textEl.textContent = m.content;
    textEl.title = '탭해서 수정';
    textEl.style.cursor = 'pointer';
    textEl.onclick = () => startMemoEdit(textEl, m);
    // 반복 배지
    if (m.recurring) {
      const r = document.createElement('span');
      r.className = 'memo-recur-badge';
      r.textContent = m.recurring === 'daily' ? '🔁 매일' : '🔁 매주';
      li.querySelector('.memo-author').prepend(r);
    }
    // 기한 뱃지
    if (m.due_date) {
      const due = new Date(m.due_date);
      const todayMid = new Date();
      todayMid.setHours(0, 0, 0, 0);
      const diff = Math.round((due - todayMid) / 86400000);
      const badge = document.createElement('span');
      badge.className = 'memo-due-badge';
      let label;
      if (diff < 0) { label = `${-diff}일 지남`; badge.classList.add('overdue'); }
      else if (diff === 0) { label = '오늘까지'; badge.classList.add('today'); }
      else if (diff === 1) { label = '내일까지'; badge.classList.add('soon'); }
      else if (diff <= 7) { label = `${diff}일 뒤`; badge.classList.add('soon'); }
      else { label = `${due.getMonth() + 1}/${due.getDate()}`; }
      badge.textContent = '📅 ' + label;
      li.querySelector('.memo-author').prepend(badge);
    }
    if (m.created_by_name) {
      li.querySelector('.memo-author-avatar').innerHTML = inlineAvatarHtml({ id: m.created_by, name: m.created_by_name, icon: m.created_by_icon }, 20);
      li.querySelector('.memo-author-name').textContent = m.created_by_name;
    } else {
      li.querySelector('.memo-author-avatar').style.display = 'none';
      li.querySelector('.memo-author-name').style.display = 'none';
    }
    if (m.created_at) li.querySelector('.memo-time').textContent = relativeTime(m.created_at);
    li.querySelector('.memo-check').onclick = async () => {
      await api(`/api/memos/${m.id}`, { method: 'PATCH', body: JSON.stringify({ done: !m.done }) });
      loadMemos();
    };
    li.querySelector('.memo-star').onclick = async () => {
      await api(`/api/memos/${m.id}`, { method: 'PATCH', body: JSON.stringify({ important: !m.important }) });
      loadMemos();
    };
    // 이모지 반응 행
    const reactRow = document.createElement('div');
    reactRow.className = 'memo-react-row';
    renderMemoReactions(reactRow, m.id, m.reactions || []);
    li.querySelector('.memo-body').appendChild(reactRow);

    li.querySelector('.memo-share').onclick = async () => {
      const text = m.content;
      try {
        if (navigator.share) {
          await navigator.share({ text });
        } else {
          await navigator.clipboard.writeText(text);
          showSimpleToast('메모가 복사됐어요');
        }
      } catch {}
    };
    li.querySelector('.memo-del').onclick = async () => {
      await api(`/api/memos/${m.id}`, { method: 'DELETE' });
      showUndoToast(m);
      loadMemos();
    };
    targetUl.appendChild(li);
  };

  for (const m of active) renderItem(m, ul);
  for (const m of done) renderItem(m, doneUl);
}
// ---------- 메모 음성 입력 ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let micRecognition = null;
if (SpeechRecognition) {
  $('memoMic').addEventListener('click', () => {
    if (micRecognition) { micRecognition.stop(); return; }
    micRecognition = new SpeechRecognition();
    micRecognition.lang = 'ko-KR';
    micRecognition.interimResults = true;
    micRecognition.continuous = false;
    $('memoMicHint').classList.remove('hidden');
    $('memoMic').classList.add('listening');
    micRecognition.onresult = (e) => {
      let text = '';
      for (const r of e.results) text += r[0].transcript;
      $('memoInput').value = text.trim();
    };
    micRecognition.onerror = () => {
      $('memoMicHint').classList.add('hidden');
      $('memoMic').classList.remove('listening');
      micRecognition = null;
    };
    micRecognition.onend = () => {
      $('memoMicHint').classList.add('hidden');
      $('memoMic').classList.remove('listening');
      micRecognition = null;
    };
    try { micRecognition.start(); } catch {}
  });
} else {
  $('memoMic').style.display = 'none';
}

function startMemoEdit(span, memo) {
  if (span.dataset.editing === '1') return;
  span.dataset.editing = '1';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = memo.content;
  input.maxLength = 500;
  input.className = 'memo-edit-input';
  span.replaceWith(input);
  input.focus();
  input.select();
  const finish = async (save) => {
    const newVal = input.value.trim();
    if (save && newVal && newVal !== memo.content) {
      try {
        await api(`/api/memos/${memo.id}`, {
          method: 'PATCH', body: JSON.stringify({ content: newVal }),
        });
      } catch {}
    }
    loadMemos();
  };
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = memo.content; finish(false); }
  });
}

// 메모 템플릿
// 자주 쓰는 메모 — 기본 + 사용자 커스텀 (localStorage)
const DEFAULT_MEMO_TEMPLATES = [
  '🛒 우유, 계란, 빵',
  '💊 아침 약 먹기',
  '💊 저녁 약 먹기',
  '💧 물 2리터 마시기',
  '🚶 30분 산책',
  '📞 가족에게 안부 전화',
  '🏥 병원 예약 확인',
  '🧺 빨래 돌리기',
];
let MT_EDIT_MODE = false;
function loadMemoTemplates() {
  try {
    const user = JSON.parse(localStorage.getItem('fb_memo_templates') || 'null');
    return Array.isArray(user) ? user : DEFAULT_MEMO_TEMPLATES.slice();
  } catch { return DEFAULT_MEMO_TEMPLATES.slice(); }
}
function saveMemoTemplates(arr) {
  localStorage.setItem('fb_memo_templates', JSON.stringify(arr));
}
function renderMemoTemplates() {
  const list = loadMemoTemplates();
  const el = $('memoTemplateList');
  if (!el) return;
  el.innerHTML = '';
  list.forEach((text, i) => {
    const short = text.length > 14 ? text.slice(0, 13) + '…' : text;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'memo-template';
    btn.textContent = short;
    btn.title = text;
    btn.onclick = () => {
      if (MT_EDIT_MODE) {
        if (!confirm(`"${text}" 을(를) 목록에서 지울까요?`)) return;
        const arr = loadMemoTemplates();
        arr.splice(i, 1);
        saveMemoTemplates(arr);
        renderMemoTemplates();
        return;
      }
      $('memoInput').value = text;
      $('memoInput').focus();
      const n = text.length;
      $('memoInput').setSelectionRange(n, n);
    };
    if (MT_EDIT_MODE) {
      const del = document.createElement('span');
      del.className = 'mt-del';
      del.textContent = ' ✕';
      btn.appendChild(del);
    }
    el.appendChild(btn);
  });
}
renderMemoTemplates();

$('mtEditToggle').addEventListener('click', (e) => {
  e.preventDefault();
  MT_EDIT_MODE = !MT_EDIT_MODE;
  $('mtEditToggle').textContent = MT_EDIT_MODE ? '완료' : '관리';
  $('mtAddRow').classList.toggle('hidden', !MT_EDIT_MODE);
  document.querySelector('.memo-templates').open = true;
  renderMemoTemplates();
});
$('mtAddBtn').addEventListener('click', () => {
  const text = $('mtNewText').value.trim();
  if (!text) return;
  const arr = loadMemoTemplates();
  if (!arr.includes(text)) arr.push(text);
  saveMemoTemplates(arr);
  $('mtNewText').value = '';
  renderMemoTemplates();
});

// 메모 카테고리 빠른 입력
document.querySelectorAll('.memo-cat').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $('memoInput');
    const emoji = btn.dataset.emoji;
    const existing = input.value.trim();
    // 이미 이모지로 시작하면 교체
    const startsEmoji = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(existing);
    if (startsEmoji) {
      input.value = existing.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, emoji + ' ');
    } else if (existing) {
      input.value = emoji + ' ' + existing;
    } else {
      input.value = emoji + ' ';
    }
    input.focus();
    // 커서 끝으로
    const n = input.value.length;
    input.setSelectionRange(n, n);
  });
});

// 메모 다중 선택 모드
let MEMO_BULK = false;
const MEMO_BULK_SELECTED = new Set();

function updateBulkUI() {
  const bar = $('memoBulkBar');
  const btn = $('memoBulkBtn');
  if (!bar) return;
  bar.classList.toggle('hidden', !MEMO_BULK);
  document.body.classList.toggle('memo-bulk-mode', MEMO_BULK);
  btn.textContent = MEMO_BULK ? '완료' : '☐☐';
  btn.classList.toggle('active', MEMO_BULK);
  $('memoBulkCount').textContent = `${MEMO_BULK_SELECTED.size}개 선택`;
}
$('memoBulkBtn').addEventListener('click', () => {
  MEMO_BULK = !MEMO_BULK;
  if (!MEMO_BULK) MEMO_BULK_SELECTED.clear();
  updateBulkUI();
  renderMemos(MEMO_CACHE);
});
$('memoBulkCancel').addEventListener('click', () => {
  MEMO_BULK = false;
  MEMO_BULK_SELECTED.clear();
  updateBulkUI();
  renderMemos(MEMO_CACHE);
});
$('memoBulkDone').addEventListener('click', async () => {
  const ids = [...MEMO_BULK_SELECTED];
  if (!ids.length) return;
  for (const id of ids) {
    await api(`/api/memos/${id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) }).catch(() => {});
  }
  MEMO_BULK_SELECTED.clear();
  MEMO_BULK = false;
  updateBulkUI();
  loadMemos();
});
$('memoBulkDel').addEventListener('click', async () => {
  const ids = [...MEMO_BULK_SELECTED];
  if (!ids.length) return;
  if (!confirm(`선택한 ${ids.length}개 메모를 삭제할까요?`)) return;
  for (const id of ids) {
    await api(`/api/memos/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  MEMO_BULK_SELECTED.clear();
  MEMO_BULK = false;
  updateBulkUI();
  loadMemos();
});

$('memoDoneToggle').addEventListener('click', () => {
  const list = $('memoDoneList');
  list.classList.toggle('hidden');
  $('memoDoneToggle').classList.toggle('open');
});

document.querySelectorAll('.due-btn').forEach((b) => {
  b.addEventListener('click', () => {
    MEMO_DUE_DAYS = b.dataset.days;
    document.querySelectorAll('.due-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  });
});
// 기본값 세팅
document.querySelector('.due-btn[data-days="none"]')?.classList.add('active');

function computeDueDate(days) {
  if (days === 'none') return null;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

$('memoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('memoInput').value.trim(); if (!v) return;
  const dueDate = computeDueDate(MEMO_DUE_DAYS);
  const recurring = MEMO_RECUR === 'none' ? null : MEMO_RECUR;
  await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: v, dueDate, recurring }) });
  $('memoInput').value = '';
  MEMO_DUE_DAYS = 'none';
  MEMO_RECUR = 'none';
  document.querySelectorAll('.due-btn').forEach((x) => x.classList.remove('active'));
  document.querySelector('.due-btn[data-days="none"]')?.classList.add('active');
  document.querySelectorAll('.recur-btn').forEach((x) => x.classList.remove('active'));
  document.querySelector('.recur-btn[data-recur="none"]')?.classList.add('active');
  loadMemos();
});

// ---------- 띠별 운세 ----------
const TODAY_ACTIVITIES = [
  '가벼운 산책이 좋아요',
  '따뜻한 차 한 잔 어떠세요',
  '오랜 친구에게 연락해 보세요',
  '가족과 통화 한 번',
  '천천히 식사하기',
  '좋아하는 노래 듣기',
  '옛 사진첩 꺼내 보기',
  '창밖 풍경 감상',
  '책 한 장 넘기기',
  '좋아하는 영화 한 편',
  '가벼운 스트레칭',
  '따뜻한 목욕',
  '산책길에 꽃 구경',
  '시장 한 바퀴',
  '맛있는 간식 준비',
];
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
      const activity = TODAY_ACTIVITIES[seed % TODAY_ACTIVITIES.length];
      li.innerHTML = `
        <span class="zodiac-emoji">${inlineAvatarHtml({ name: z.name, icon: z.icon }, 44)}</span>
        <div class="zodiac-body">
          <div class="zodiac-top">
            <span class="zodiac-name"></span>
            <span class="zodiac-tag"></span>
          </div>
          <div class="zodiac-fortune"></div>
          <div class="zodiac-activity">🌿 오늘 추천 <span class="activity-txt"></span></div>
          <div class="zodiac-lucky">
            <span class="lucky-chip"><span class="lucky-dot" style="background:${color.hex}"></span>${color.name}</span>
            <span class="lucky-chip">🧭 ${dir}</span>
            <span class="lucky-chip">🔢 ${num}</span>
          </div>
        </div>`;
      li.querySelector('.zodiac-name').textContent = z.name;
      li.querySelector('.zodiac-tag').textContent = `${z.zodiac}띠`;
      li.querySelector('.zodiac-fortune').textContent = z.fortune;
      li.querySelector('.activity-txt').textContent = activity;
      ul.appendChild(li);
    }
  } catch {}
}

// ---------- 설정 화면 열기/닫기 ----------
$('openSettingsBtn').addEventListener('click', () => { showOnly('settings'); window.scrollTo(0, 0); });
$('settingsBack').addEventListener('click', () => { showOnly('app'); });

// ---------- 카드 순서 편집 ----------
const DEFAULT_CARD_ORDER = [
  // 1) 긴급·실시간: 가족 공지
  'notice',
  // 2) 오늘의 핵심 CTA: 질문/답변
  'question',
  // 3) 매일 새로움: 어제 답변 공개
  'reveal',
  // 4) 소통·일정 묶음 + 빠른 연락처(긴급 상황 빠른 접근)
  'upcoming','family','mood','sos','chat','birthday',
  // 5) 보조 정보
  'weather','tips','gallery',
  // 6) 엔터·유틸·메모 (아래로)
  'zodiac','fx','calc','memo','account'
];
function loadCardOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem('fb_card_order') || 'null');
    if (!Array.isArray(saved)) return DEFAULT_CARD_ORDER.slice();
    // 누락된 신규 카드는 기본 순서상 앞 이웃 뒤에 끼워 넣음 (뒤에 뭉쳐 붙지 않게)
    for (let i = 0; i < DEFAULT_CARD_ORDER.length; i++) {
      const k = DEFAULT_CARD_ORDER[i];
      if (saved.includes(k)) continue;
      let insertAt = saved.length;
      for (let j = i - 1; j >= 0; j--) {
        const prevIdx = saved.indexOf(DEFAULT_CARD_ORDER[j]);
        if (prevIdx >= 0) { insertAt = prevIdx + 1; break; }
      }
      saved.splice(insertAt, 0, k);
    }
    return saved;
  } catch { return DEFAULT_CARD_ORDER.slice(); }
}
function saveCardOrder(order) { localStorage.setItem('fb_card_order', JSON.stringify(order)); }

function applyCardOrder() {
  const app = $('app');
  const order = loadCardOrder();
  const cards = new Map();
  app.querySelectorAll('[data-card-id]').forEach((el) => cards.set(el.dataset.cardId, el));
  // hero 바로 뒤부터 순서대로 이동
  const hero = app.querySelector('.hero');
  let anchor = hero;
  for (const id of order) {
    const el = cards.get(id);
    if (!el) continue;
    anchor.after(el);
    anchor = el;
  }
}

// 카드 숨김 목록
function loadHiddenCards() {
  try { return new Set(JSON.parse(localStorage.getItem('fb_hidden_cards') || '[]')); }
  catch { return new Set(); }
}
function saveHiddenCards(s) { localStorage.setItem('fb_hidden_cards', JSON.stringify([...s])); }
function applyHiddenCards() {
  const hidden = loadHiddenCards();
  document.querySelectorAll('#app [data-card-id]').forEach((el) => {
    if (el.dataset.cardId === 'account') return;
    if (hidden.has(el.dataset.cardId)) el.classList.add('user-hidden');
    else el.classList.remove('user-hidden');
  });
}
applyHiddenCards();

let REORDER_MODE = false;
function setReorderMode(on) {
  REORDER_MODE = on;
  document.body.classList.toggle('reorder-mode', on);
  $('reorderToggleBtn').textContent = on ? '✅ 저장하고 끝내기' : '🧩 카드 순서·표시 편집';

  // 편집 모드: 숨긴 카드를 다시 보여서 선택할 수 있게
  document.querySelectorAll('#app [data-card-id]').forEach((el) => {
    el.querySelector('.reorder-actions')?.remove();
    if (!on) {
      applyHiddenCards();
      return;
    }
    el.classList.remove('user-hidden'); // 편집 중엔 모두 보이게
    el.classList.add('reorder-target');
    if (el.dataset.cardId === 'account') return;
    const hidden = loadHiddenCards();
    const isHidden = hidden.has(el.dataset.cardId);
    const box = document.createElement('div');
    box.className = 'reorder-actions';
    box.innerHTML = `
      <button class="reo-btn" data-dir="up" title="위로">↑</button>
      <button class="reo-btn" data-dir="down" title="아래로">↓</button>
      <button class="reo-btn reo-toggle${isHidden ? ' off' : ''}" data-dir="toggle" title="${isHidden ? '보이기' : '숨기기'}">${isHidden ? '🙈' : '👁'}</button>`;
    el.appendChild(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.reo-btn'); if (!b) return;
      if (b.dataset.dir === 'toggle') toggleCardHidden(el);
      else moveCard(el, b.dataset.dir);
    });
  });
  if (!on) {
    // 편집 끝, reorder 클래스 정리
    document.querySelectorAll('#app .reorder-target').forEach((el) => el.classList.remove('reorder-target'));
  }
}

function toggleCardHidden(el) {
  const hidden = loadHiddenCards();
  const id = el.dataset.cardId;
  if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
  saveHiddenCards(hidden);
  // 편집 모드에선 계속 보이되 버튼 상태만 업데이트
  const btn = el.querySelector('.reo-toggle');
  if (btn) {
    const isHidden = hidden.has(id);
    btn.classList.toggle('off', isHidden);
    btn.textContent = isHidden ? '🙈' : '👁';
    btn.title = isHidden ? '보이기' : '숨기기';
    el.classList.toggle('dim-hidden', isHidden);
  }
}
function moveCard(el, dir) {
  const parent = el.parentElement;
  // 스크롤 보존
  const y = el.getBoundingClientRect().top;
  if (dir === 'up') {
    let prev = el.previousElementSibling;
    while (prev && !prev.dataset.cardId) prev = prev.previousElementSibling;
    if (prev && prev.dataset.cardId !== 'account') parent.insertBefore(el, prev);
  } else {
    let next = el.nextElementSibling;
    while (next && !next.dataset.cardId) next = next.nextElementSibling;
    if (next && next.dataset.cardId !== 'account') parent.insertBefore(next, el);
  }
  // 저장
  const ids = Array.from(parent.querySelectorAll('[data-card-id]')).map((n) => n.dataset.cardId);
  saveCardOrder(ids);
  // 스크롤 따라가기
  const y2 = el.getBoundingClientRect().top;
  window.scrollBy(0, y2 - y);
}
$('reorderToggleBtn').addEventListener('click', () => setReorderMode(!REORDER_MODE));

// 즐겨찾은 답변 시트
$('favoritesBtn').addEventListener('click', async () => {
  try {
    const list = await api('/api/favorites/answers');
    const ul = $('favoritesList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty-state-text" style="padding:24px 0;text-align:center">아직 즐겨찾은 답변이 없어요.<br>어제 답변에 ⭐ 탭하면 여기에 쌓여요</li>';
    } else {
      for (const a of list) {
        const d = new Date(a.question_date);
        const li = document.createElement('li');
        li.className = 'fav-item';
        li.innerHTML = `
          <div class="fav-head">
            <span class="fav-date">${d.getMonth() + 1}월 ${d.getDate()}일</span>
            <span class="fav-author">${iconEmoji(a.icon)} ${escapeHtml(a.display_name)}님</span>
          </div>
          <div class="fav-question"></div>
          <div class="fav-answer"></div>
          <button class="fav-remove" data-aid="${a.answer_id}">★ 해제</button>`;
        li.querySelector('.fav-question').textContent = a.question_text;
        li.querySelector('.fav-answer').textContent = a.answer_text;
        li.querySelector('.fav-remove').onclick = async () => {
          try {
            await api(`/api/answer/${a.answer_id}/favorite`, { method: 'POST' });
            li.remove();
            if (!ul.children.length) ul.innerHTML = '<li class="empty-state-text" style="padding:24px 0;text-align:center">모두 해제됐어요</li>';
          } catch {}
        };
        ul.appendChild(li);
      }
    }
    $('favoritesSheet').classList.remove('hidden');
  } catch { alert('불러오기 실패'); }
});
$('favoritesClose').addEventListener('click', () => $('favoritesSheet').classList.add('hidden'));
$('favoritesSheet').addEventListener('click', (e) => {
  if (e.target.id === 'favoritesSheet') $('favoritesSheet').classList.add('hidden');
});

// 퀵 메모 FAB
$('quickMemoFab').addEventListener('click', () => {
  $('quickMemoInput').value = '';
  $('quickMemoSheet').classList.remove('hidden');
  setTimeout(() => $('quickMemoInput').focus(), 100);
});
$('quickMemoClose').addEventListener('click', () => $('quickMemoSheet').classList.add('hidden'));
$('quickMemoSheet').addEventListener('click', (e) => {
  if (e.target.id === 'quickMemoSheet') $('quickMemoSheet').classList.add('hidden');
});
document.querySelectorAll('.quick-memo-cats button').forEach((b) => {
  b.addEventListener('click', () => {
    const emoji = b.dataset.emoji;
    const input = $('quickMemoInput');
    const existing = input.value.trim();
    const startsEmoji = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(existing);
    if (startsEmoji) input.value = existing.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, emoji + ' ');
    else if (existing) input.value = emoji + ' ' + existing;
    else input.value = emoji + ' ';
    input.focus();
  });
});
async function quickAddMemo() {
  const v = $('quickMemoInput').value.trim();
  if (!v) return;
  try {
    await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: v }) });
    $('quickMemoInput').value = '';
    $('quickMemoSheet').classList.add('hidden');
    loadMemos();
    showSimpleToast('메모가 추가됐어요');
  } catch { alert('추가 실패'); }
}
$('quickMemoAdd').addEventListener('click', quickAddMemo);
$('quickMemoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') quickAddMemo();
});

// 도움말 시트
$('helpBtn').addEventListener('click', () => $('helpSheet').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpSheet').classList.add('hidden'));
$('helpSheet').addEventListener('click', (e) => {
  if (e.target.id === 'helpSheet') $('helpSheet').classList.add('hidden');
});

// ---------- 온보딩 투어 (첫 로그인 1회) ----------
const TOUR_STEPS = [
  { emoji: '🌿', title: '환영해요', body: '가족보드는 가족이 서로의 하루를 나누는 작은 공간이에요. 주요 기능을 5분 안에 소개해드릴게요.' },
  { emoji: '💬', title: '오늘의 가족 질문', body: '매일 새 질문이 하나 떠요. 내 답변을 적어두면 내일 가족 모두의 답이 같이 공개돼요. 연속 답변 기록도 쌓여요.' },
  { emoji: '😊', title: '오늘 기분 · 응원 스티커', body: '이모지 하나로 오늘 기분을 남기고, 프로필에서 가족에게 응원 스티커도 보낼 수 있어요.' },
  { emoji: '📝', title: '메모와 약 체크', body: '메모는 글자 탭해서 수정, 별 탭으로 중요 표시, 마이크로 음성 입력도 됩니다. 약은 아침·저녁으로 체크하면 7일 히트맵이 쌓여요.' },
  { emoji: '🧩', title: '나만의 배치', body: '계정 카드의 🧩 버튼으로 카드 순서를 바꾸거나 필요 없는 카드를 숨길 수 있어요. 글자 크기도 조절 가능.' },
];
let TOUR_IDX = 0;
function showTour() {
  TOUR_IDX = 0;
  renderTourStep();
  $('tourOverlay').classList.remove('hidden');
}
function renderTourStep() {
  const s = TOUR_STEPS[TOUR_IDX];
  $('tourEmoji').textContent = s.emoji;
  $('tourTitle').textContent = s.title;
  $('tourBody').textContent = s.body;
  $('tourNext').textContent = TOUR_IDX < TOUR_STEPS.length - 1 ? '다음 →' : '시작하기';
  const prog = $('tourProgress');
  prog.innerHTML = '';
  for (let i = 0; i < TOUR_STEPS.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'tour-dot' + (i === TOUR_IDX ? ' active' : '') + (i < TOUR_IDX ? ' done' : '');
    prog.appendChild(dot);
  }
}
function endTour() {
  $('tourOverlay').classList.add('hidden');
  localStorage.setItem('fb_onboarding_v1', '1');
}
$('tourNext').addEventListener('click', () => {
  if (TOUR_IDX < TOUR_STEPS.length - 1) { TOUR_IDX++; renderTourStep(); }
  else endTour();
});
$('tourSkip').addEventListener('click', endTour);

// 첫 로그인 1회 노출 (help 대신 tour 를 우선)
setTimeout(() => {
  if (!localStorage.getItem('fb_onboarding_v1') && ME) {
    showTour();
  }
}, 1500);

async function loadFamilyInfo() {
  try {
    const f = await api('/api/family');
    $('famAlias').value = f.alias || '';
    $('famName').value = f.displayName || '';
    $('famNotice').value = f.notice || '';
    renderFamPhotoPreview(f.photoUrl || '');
  } catch {}
}

function renderFamPhotoPreview(photoUrl) {
  const box = $('famPhotoPreview');
  const clearBtn = $('famPhotoClearBtn');
  if (!box) return;
  const url = (photoUrl || '').trim();
  box.innerHTML = '';
  if (url) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    img.onerror = () => {
      console.warn('[fam-photo] img load failed:', url);
      box.innerHTML = '<span class="fam-photo-empty">(불러오기 실패)</span>';
    };
    box.appendChild(img);
    clearBtn?.classList.remove('hidden');
  } else {
    box.innerHTML = '<span class="fam-photo-empty">사진 없음</span>';
    clearBtn?.classList.add('hidden');
  }
}

/** 가족 사진: 원본 이미지를 긴 변 기준 maxSide 로 축소 + JPEG 품질 조절해서 targetBytes 이하로. */
async function resizeImageToJpegBlob(file, { maxSide = 1600, targetBytes = 2 * 1024 * 1024 - 1 } = {}) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('read-failed'));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('decode-failed'));
    i.src = dataUrl;
  });
  const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  let w = Math.round(img.naturalWidth * ratio);
  let h = Math.round(img.naturalHeight * ratio);
  let canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  let q = 0.9;
  for (let i = 0; i < 12; i++) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= targetBytes) return blob;
    if (q > 0.55) { q -= 0.08; continue; }
    w = Math.max(480, Math.floor(w * 0.85));
    h = Math.max(320, Math.floor(h * 0.85));
    const c2 = document.createElement('canvas');
    c2.width = w; c2.height = h;
    c2.getContext('2d').drawImage(canvas, 0, 0, w, h);
    canvas = c2;
    q = 0.82;
  }
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.5));
}

const NOTICE_REACTION_EMOJIS = ['👍','❤️','🙏','😊'];
function renderNoticeReactions(noticeId, reactions) {
  const row = $('noticeReactRow');
  if (!row || !noticeId) return;
  row.innerHTML = '';
  const map = new Map(reactions.map((r) => [r.emoji, r]));
  for (const emoji of NOTICE_REACTION_EMOJIS) {
    const info = map.get(emoji);
    const count = info?.count || 0;
    const mine = !!info?.mine;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rx-btn' + (mine ? ' on' : '') + (count === 0 ? ' empty' : '');
    btn.innerHTML = `<span class="rx-emoji">${emoji}</span>${count ? `<span class="rx-cnt">${count}</span>` : ''}`;
    btn.onclick = async () => {
      try {
        const res = await api(`/api/notice/${noticeId}/react`, {
          method: 'POST', body: JSON.stringify({ emoji }),
        });
        renderNoticeReactions(noticeId, res.reactions || []);
        btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      } catch {}
    };
    row.appendChild(btn);
  }
}

function renderNoticeReads(noticeId, reads) {
  const el = $('noticeReads');
  if (!el || !noticeId) return;
  const readIds = new Set(reads.map((r) => r.userId));
  const members = (FAMILY_CACHE || []).filter((m) => m.activated);
  if (!members.length) { el.classList.add('hidden'); return; }
  el.innerHTML = '<span class="nr-label">읽음</span>' + members.map((m) => {
    const read = readIds.has(m.id);
    return `<span class="nr-dot ${read ? 'read' : 'unread'}" title="${m.displayName}${read ? ' 읽음' : ' 아직'}">
      ${inlineAvatarHtml({ id: m.id, icon: m.icon }, 22)}
    </span>`;
  }).join('');
  el.classList.remove('hidden');
  // 내가 아직 안 읽었으면 읽음 처리
  if (!readIds.has(ME.id)) {
    setTimeout(() => {
      api(`/api/notice/${noticeId}/read`, { method: 'POST' })
        .then(() => loadFamilyNotice()).catch(() => {});
    }, 3000);
  }
}

async function loadFamilyNotice() {
  try {
    const f = await api('/api/family');
    // 가족 사진 헤더 배경
    const banner = $('heroPhotoBanner');
    const bannerImg = $('heroPhotoImg');
    if (banner && bannerImg) {
      if (f.photoUrl) {
        bannerImg.src = f.photoUrl;
        banner.classList.remove('hidden');
      } else {
        bannerImg.removeAttribute('src');
        banner.classList.add('hidden');
      }
    }
    if (f.notice) {
      $('noticeText').textContent = f.notice;
      // 읽음 상태 + 이모지 반응 렌더
      renderNoticeReads(f.noticeId, f.noticeReads || []);
      renderNoticeReactions(f.noticeId, f.noticeReactions || []);
      if (f.noticeBy) {
        const date = f.noticeUpdatedAt ? new Date(f.noticeUpdatedAt) : null;
        const when = date ? relativeTime(date) : '';
        $('noticeMeta').textContent = `${iconEmoji(f.noticeBy.icon)} ${f.noticeBy.name}${when ? ' ' + when : ''}`;
      } else { $('noticeMeta').textContent = ''; }
      // NEW 배지: 마지막으로 본 시각보다 최신이면 표시
      const updatedAt = f.noticeUpdatedAt ? new Date(f.noticeUpdatedAt).getTime() : 0;
      const lastSeen = Number(localStorage.getItem('fb_notice_seen') || 0);
      if (updatedAt && updatedAt > lastSeen) {
        $('noticeNewBadge').classList.remove('hidden');
        // 3초 후 읽음 처리
        setTimeout(() => {
          localStorage.setItem('fb_notice_seen', String(updatedAt));
          $('noticeNewBadge').classList.add('hidden');
        }, 3500);
      } else {
        $('noticeNewBadge').classList.add('hidden');
      }
      $('noticeCard').classList.remove('hidden');
    } else {
      $('noticeCard').classList.add('hidden');
    }
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
// ---------- 가족 사진 영역 크롭 ----------
// 배너 비율과 동일하게 2.5:1. 프리뷰 400x160, 내보내기 1200x480.
const FAM_CROP_W = 400;
const FAM_CROP_H = 160;
const FAM_EXPORT_W = 1200;
const FAM_EXPORT_H = 480;
const famCropState = { img: null, zoom: 1, panX: 0, panY: 0, objectUrl: null, dragging: false, last: null };

function drawFamCropCanvas() {
  const canvas = $('famCropCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = FAM_CROP_W, H = FAM_CROP_H;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const img = famCropState.img;
  if (!img || !img.complete || !img.naturalWidth) return;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // cover: 이미지가 W×H 프레임을 꽉 채우도록
  const base = Math.max(W / iw, H / ih);
  const dw = iw * base * famCropState.zoom;
  const dh = ih * base * famCropState.zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.drawImage(img, W / 2 - dw / 2 + famCropState.panX, H / 2 - dh / 2 + famCropState.panY, dw, dh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
}

function exportFamCropCanvas() {
  const img = famCropState.img;
  if (!img || !img.naturalWidth) return null;
  const W = FAM_EXPORT_W, H = FAM_EXPORT_H;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(W / iw, H / ih);
  const ratio = W / FAM_CROP_W; // = 1200/400 = 3
  const dw = iw * base * famCropState.zoom;
  const dh = ih * base * famCropState.zoom;
  const panX = famCropState.panX * ratio;
  const panY = famCropState.panY * ratio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.drawImage(img, W / 2 - dw / 2 + panX, H / 2 - dh / 2 + panY, dw, dh);
  ctx.restore();
  return canvas;
}

function openFamPhotoCrop(objectUrl) {
  const img = new Image();
  img.onload = () => {
    famCropState.objectUrl = objectUrl;
    famCropState.img = img;
    famCropState.zoom = 1;
    famCropState.panX = 0;
    famCropState.panY = 0;
    drawFamCropCanvas();
    $('famPhotoCropSheet').classList.remove('hidden');
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    alert('이미지를 열 수 없어요');
  };
  img.src = objectUrl;
}
function closeFamPhotoCrop() {
  $('famPhotoCropSheet').classList.add('hidden');
  if (famCropState.objectUrl) {
    URL.revokeObjectURL(famCropState.objectUrl);
    famCropState.objectUrl = null;
  }
  famCropState.img = null;
}

$('famPhotoPickBtn')?.addEventListener('click', () => $('famPhotoFile')?.click());
$('famPhotoFile')?.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) { alert('이미지 파일을 선택해 주세요'); return; }
  openFamPhotoCrop(URL.createObjectURL(f));
});
$('famPhotoClearBtn')?.addEventListener('click', async () => {
  if (!confirm('가족 사진을 제거할까요?')) return;
  try {
    await api('/api/family', { method: 'PATCH', body: JSON.stringify({ photoUrl: null }) });
    renderFamPhotoPreview('');
    loadFamilyNotice();
  } catch { alert('삭제 실패'); }
});

const famCropCanvasEl = $('famCropCanvas');
if (famCropCanvasEl) {
  famCropCanvasEl.addEventListener('pointerdown', (e) => {
    if (!famCropState.img) return;
    e.preventDefault();
    famCropState.dragging = true;
    famCropState.last = { x: e.clientX, y: e.clientY };
    try { famCropCanvasEl.setPointerCapture(e.pointerId); } catch {}
  });
  famCropCanvasEl.addEventListener('pointermove', (e) => {
    if (!famCropState.dragging || !famCropState.last) return;
    e.preventDefault();
    famCropState.panX += e.clientX - famCropState.last.x;
    famCropState.panY += e.clientY - famCropState.last.y;
    famCropState.last = { x: e.clientX, y: e.clientY };
    drawFamCropCanvas();
  });
  famCropCanvasEl.addEventListener('pointerup', () => { famCropState.dragging = false; famCropState.last = null; });
  famCropCanvasEl.addEventListener('pointercancel', () => { famCropState.dragging = false; famCropState.last = null; });
  famCropCanvasEl.addEventListener('wheel', (e) => {
    if (!famCropState.img) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? -0.08 : 0.08;
    famCropState.zoom = Math.min(4, Math.max(1, famCropState.zoom + d));
    drawFamCropCanvas();
  }, { passive: false });
}
$('famCropZoomIn')?.addEventListener('click', () => {
  if (!famCropState.img) return;
  famCropState.zoom = Math.min(4, famCropState.zoom + 0.12);
  drawFamCropCanvas();
});
$('famCropZoomOut')?.addEventListener('click', () => {
  if (!famCropState.img) return;
  famCropState.zoom = Math.max(1, famCropState.zoom - 0.12);
  drawFamCropCanvas();
});
$('famCropCancel')?.addEventListener('click', closeFamPhotoCrop);
$('famPhotoCropSheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'famPhotoCropSheet') closeFamPhotoCrop();
});
$('famCropApply')?.addEventListener('click', async () => {
  const canvas = exportFamCropCanvas();
  if (!canvas) return;
  const applyBtn = $('famCropApply');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '올리는 중...'; }
  try {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    if (!blob) throw new Error('이미지 변환 실패');
    const fd = new FormData();
    fd.append('photo', blob, 'family.jpg');
    const r = await fetch('/api/family/photo', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) {
      let msg = '업로드 실패';
      try { const j = await r.json(); if (j.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    const data = await r.json();
    renderFamPhotoPreview(data.photoUrl);
    loadFamilyNotice();
    closeFamPhotoCrop();
  } catch (err) {
    alert(err.message || '저장 실패');
  } finally {
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = '이 사진으로 저장'; }
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

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'sosAddBtn') {
    const name = $('sosName').value.trim();
    const phone = $('sosPhone').value.trim();
    if (!name || !phone) { alert('이름과 번호를 입력해 주세요'); return; }
    try {
      await api('/api/emergency', {
        method: 'POST',
        body: JSON.stringify({ name, phone, icon: SOS_PICKED_ICON }),
      });
      $('sosName').value = ''; $('sosPhone').value = '';
      SOS_PICKED_ICON = 'heart';
      renderSosIconPicker();
      loadSosAdmin();
      loadEmergencyContacts();
    } catch { alert('추가 실패'); }
  }
});

$('famNoticeSave').addEventListener('click', async () => {
  const notice = $('famNotice').value.trim();
  try {
    await api('/api/family', { method: 'PATCH', body: JSON.stringify({ notice }) });
    $('famNoticeSave').textContent = '저장됐어요';
    setTimeout(() => $('famNoticeSave').textContent = '공지 저장', 1500);
    loadFamilyNotice();
  } catch { alert('공지 저장 실패'); }
});

async function loadUsers() {
  try {
    const users = await api('/api/users');
    const ul = $('userList');
    ul.innerHTML = '';
    for (const u of users) {
      const li = document.createElement('li');
      const dob = u.birthYear ? `${u.birthYear}.${u.birthMonth || '-'}.${u.birthDay || '-'}${u.isLunar ? ' 음' : ''}` : '생일 미등록';
      const status = u.activated ? '' : ' <span class="pending-dot">· 초대 대기</span>';
      li.innerHTML = `
        <span class="user-emoji">${inlineAvatarHtml({ id: u.id, name: u.displayName, icon: u.icon }, 36)}</span>
        <div class="user-main">
          <div class="user-name"></div>
          <div class="user-sub">${u.role === 'admin' ? '관리자' : '가족'} · ${dob}${status}</div>
        </div>
        <div class="user-actions">
          <button class="ufi-btn user-edit" aria-label="편집"><span class="ua-icon">✏️</span><span class="ua-label">편집</span></button>
          <button class="ufi-btn user-reinvite" aria-label="초대 링크 재발급"><span class="ua-icon">🔗</span><span class="ua-label">초대</span></button>
          <button class="user-del" aria-label="삭제"${u.id === ME.id ? ' disabled' : ''}><span class="ua-icon">🗑</span><span class="ua-label">삭제</span></button>
        </div>`;
      li.querySelector('.user-name').textContent = `${u.displayName} (${u.username})`;
      li.querySelector('.user-edit').onclick = () => openEditSheet(u);
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

// ---------- TTS (읽어주기) ----------
function getTtsRate() {
  const v = parseFloat(localStorage.getItem('fb_tts_rate'));
  return Number.isFinite(v) && v > 0.3 && v < 2 ? v : 0.95;
}
function speakText(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = getTtsRate();
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch {}
}
// TTS 속도 토글 UI
function setupTtsRate() {
  const cur = getTtsRate();
  document.querySelectorAll('.tr-btn').forEach((b) => {
    b.classList.toggle('active', Math.abs(parseFloat(b.dataset.rate) - cur) < 0.01);
    b.addEventListener('click', () => {
      localStorage.setItem('fb_tts_rate', b.dataset.rate);
      document.querySelectorAll('.tr-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
  });
}
function buildTtsText(kind) {
  if (kind === 'tips') {
    const lines = ['오늘의 안내입니다.'];
    [$('tipDress'), $('tipHum'), $('tipAir'), $('tipPollen')].forEach((el) => {
      if (el?.textContent && el.textContent !== '—') lines.push(el.textContent);
    });
    return lines.join(' ');
  }
  if (kind === 'reveal') {
    const q = $('revealQuestion').textContent;
    const answers = Array.from(document.querySelectorAll('#revealList li')).map((li) => {
      const name = li.querySelector('.reveal-name')?.textContent || '';
      const ans = li.querySelector('.reveal-answer')?.textContent || '';
      return `${name} ${ans}`;
    }).join(' ');
    return `어제의 질문: ${q}. ${answers}`;
  }
  if (kind === 'notice') {
    return `가족 공지입니다. ${$('noticeText').textContent}`;
  }
  if (kind === 'weather') {
    const city = $('wCity').textContent;
    const desc = $('wDesc').textContent;
    const t = $('wTemp').textContent;
    const mx = $('wMax').textContent, mn = $('wMin').textContent;
    const feel = $('wFeel').textContent, hum = $('wHum').textContent;
    return `${city} ${desc}. 현재 기온 ${t}, 최고 ${mx}, 최저 ${mn}, 체감 ${feel}, 습도 ${hum}.`;
  }
  if (kind === 'zodiac') {
    const items = Array.from(document.querySelectorAll('#zodiacList li')).map((li) => {
      const name = li.querySelector('.zodiac-name')?.textContent || '';
      const tag = li.querySelector('.zodiac-tag')?.textContent || '';
      const fortune = li.querySelector('.zodiac-fortune')?.textContent || '';
      return name ? `${name} ${tag}. ${fortune}` : '';
    }).filter(Boolean).join(' ');
    return `오늘의 띠별 운세입니다. ${items}`;
  }
  return '';
}
document.querySelectorAll('.tts-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const kind = btn.dataset.tts;
    const t = buildTtsText(kind);
    if (!t) return;
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      btn.classList.remove('speaking');
    } else {
      speakText(t);
      btn.classList.add('speaking');
      const u = speechSynthesis.getVoices;
      // clear speaking class when done (poll briefly)
      const poll = setInterval(() => {
        if (!speechSynthesis.speaking) { btn.classList.remove('speaking'); clearInterval(poll); }
      }, 300);
    }
  });
});
if (!('speechSynthesis' in window)) {
  document.querySelectorAll('.tts-btn').forEach((b) => b.style.display = 'none');
}

function cleanupOldDrafts() {
  try {
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString().slice(0, 10);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('fb_answer_draft_')) {
        const date = key.slice('fb_answer_draft_'.length);
        if (date < cutoff) localStorage.removeItem(key);
      }
    }
  } catch {}
}

// 답변 input 이 변경될 때마다 임시저장
const qAnswerEl = document.getElementById('questionAnswer');
if (qAnswerEl) {
  let draftTimer = null;
  qAnswerEl.addEventListener('input', () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const tz = 'Asia/Tokyo';
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
        const val = qAnswerEl.value.trim();
        if (val) localStorage.setItem('fb_answer_draft_' + today, val);
        else localStorage.removeItem('fb_answer_draft_' + today);
      } catch {}
    }, 500);
  });
}

function renderCountdownToReveal() {
  const el = $('questionCountdown');
  if (!el) return;
  const now = new Date();
  // Asia/Tokyo 기준 내일 0시 — 사용자 timezone 에 관계없이 서버 TZ 따름
  const jstOffsetMin = 9 * 60;
  const nowJst = new Date(now.getTime() + (now.getTimezoneOffset() + jstOffsetMin) * 60000);
  const tomorrow = new Date(nowJst.getFullYear(), nowJst.getMonth(), nowJst.getDate() + 1);
  const diffMs = tomorrow - nowJst;
  if (diffMs <= 0) { el.classList.add('hidden'); return; }
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const text = hours > 0
    ? `⏳ 내일 공개까지 ${hours}시간 ${mins}분 남았어요`
    : `⏳ 내일 공개까지 ${mins}분 남았어요`;
  el.textContent = text;
  el.classList.remove('hidden');
}
// 매 분 업데이트
setInterval(() => {
  if (!$('questionCountdown')?.classList.contains('hidden')) renderCountdownToReveal();
}, 60000);

// ---------- 오늘의 가족 질문 ----------
async function loadTodayQuestion() {
  try {
    const q = await api('/api/question/today');
    $('questionText').textContent = q.question;
    // 서버 답변 > 로컬 임시저장 (서버 값이 있으면 임시저장 삭제)
    const draftKey = 'fb_answer_draft_' + q.date;
    const draft = localStorage.getItem(draftKey);
    if (q.myAnswer) {
      $('questionAnswer').value = q.myAnswer;
      localStorage.removeItem(draftKey);
    } else if (draft) {
      $('questionAnswer').value = draft;
    } else {
      $('questionAnswer').value = '';
    }
    // 오래된 draft 정리 (7일 이상 된 것)
    cleanupOldDrafts();
    $('questionMeta').textContent =
      `${q.answeredCount} / ${q.memberCount}명이 답했어요. 모든 답변은 내일 공개돼요`;
    renderCountdownToReveal();
    const hasAnswer = !!q.myAnswer;
    const isSkip = !!q.mySkipped;
    $('qPendingBadge').classList.toggle('hidden', hasAnswer || isSkip);
    $('qDoneBadge').classList.toggle('hidden', !hasAnswer);
    $('qHint').classList.toggle('hidden', !hasAnswer);
    $('questionSubmit').textContent = hasAnswer ? '답변 수정' : '답변 저장';
    // 건너뛴 경우 표시
    if (isSkip) {
      $('qDoneBadge').textContent = '🌙 건너뛰었어요';
      $('qDoneBadge').classList.remove('hidden');
    } else {
      $('qDoneBadge').textContent = '✓ 저장됨';
    }

    // 참여 아바타 — 답한 사람만 컬러, 아직 안 한 사람은 회색
    QUESTION_ANSWERERS_CACHE = q.answerers || [];
    const ids = new Set((q.answerers || []).map(a => a.user_id));
    const pEl = $('questionParticipants');
    pEl.innerHTML = '';
    if (FAMILY_CACHE?.length) {
      for (const m of FAMILY_CACHE) {
        if (!m.activated) continue;
        const div = document.createElement('div');
        div.className = 'q-chip' + (ids.has(m.id) ? ' done' : '');
        div.innerHTML = `<span class="q-chip-emoji">${inlineAvatarHtml({ id: m.id, icon: m.icon }, 18)}</span><span class="q-chip-name"></span>`;
        div.querySelector('.q-chip-name').textContent = m.displayName;
        div.title = ids.has(m.id) ? `${m.displayName}님 답변 완료` : `${m.displayName}님 아직`;
        pEl.appendChild(div);
      }
    }
  } catch {
    $('questionText').textContent = '잠시 후 다시 시도해 주세요';
  }
}

$('questionSkip').addEventListener('click', async () => {
  if (!confirm('오늘 질문을 건너뛸까요? 답변 없이 넘어가요.')) return;
  try {
    await api('/api/question/today/skip', { method: 'POST' });
    loadTodayQuestion();
    loadMyStreak();
  } catch { alert('처리 실패'); }
});

async function loadMyStreak() {
  try {
    const r = await api('/api/question/streak');
    window._STREAK = r;
    renderHeroSummary();
    if (r.myStreak > 0) {
      $('myStreakBadge').textContent = `🔥 ${r.myStreak}일 연속 답변 중!`;
      $('streakRow').classList.remove('hidden');
    } else {
      $('myStreakBadge').textContent = '';
      $('streakRow').classList.toggle('hidden', !(r.familyStreaks || []).some((f) => f.streak > 0));
      if (!(r.familyStreaks || []).some((f) => f.streak > 0)) {
        $('streakRow').classList.add('hidden');
      } else {
        // 가족 누구라도 연속이면 버튼만 보여줌
        $('myStreakBadge').textContent = '🔥 오늘도 답변하면 기록 시작!';
      }
    }
  } catch {}
}

// 스트릭 복구 시트
$('openRecoverSheet').addEventListener('click', async () => {
  try {
    const r = await api('/api/question/recovery-status');
    const sub = $('recoverSub');
    const ul = $('recoverList');
    ul.innerHTML = '';
    if (r.usedThisWeek) {
      sub.textContent = '이번 주 복구는 이미 사용했어요. 다음 주 월요일에 다시 가능해요.';
    } else if (!r.recoverable?.length) {
      sub.textContent = '복구할 날이 없어요 🎉 (지난 7일 모두 답변하셨네요)';
    } else {
      sub.textContent = '지난 7일 중 놓친 하루 하나를 만회할 수 있어요. 이번 주 1회만 가능.';
      for (const item of r.recoverable) {
        const d = new Date(item.date);
        const li = document.createElement('li');
        li.className = 'recover-item';
        li.innerHTML = `
          <div class="recover-date">${d.getMonth() + 1}월 ${d.getDate()}일</div>
          <div class="recover-q"></div>
          <textarea class="recover-input" placeholder="지금이라도 남기는 한 마디" maxlength="1000"></textarea>
          <button type="button" class="recover-btn">이 날 복구하기</button>`;
        li.querySelector('.recover-q').textContent = item.question_text;
        const input = li.querySelector('.recover-input');
        li.querySelector('.recover-btn').onclick = async () => {
          const text = input.value.trim();
          if (!text) { alert('답변을 적어 주세요'); return; }
          try {
            await api('/api/question/recover', {
              method: 'POST',
              body: JSON.stringify({ questionId: item.question_id, answer: text }),
            });
            $('recoverSheet').classList.add('hidden');
            loadMyStreak();
            showSimpleToast('복구 완료! 연속 기록이 이어졌어요');
          } catch (e) {
            alert(e.status === 429 ? '이번 주 복구를 이미 사용했어요' : '복구 실패');
          }
        };
        ul.appendChild(li);
      }
    }
    $('recoverSheet').classList.remove('hidden');
  } catch { alert('상태 조회 실패'); }
});
$('recoverClose').addEventListener('click', () => $('recoverSheet').classList.add('hidden'));
$('recoverSheet').addEventListener('click', (e) => {
  if (e.target.id === 'recoverSheet') $('recoverSheet').classList.add('hidden');
});

// 주간 응원 랭킹
$('openRankingBtn').addEventListener('click', async () => {
  try {
    const r = await api('/api/stickers/week-ranking');
    const renderList = (el, list) => {
      el.innerHTML = '';
      if (!list.length) {
        el.innerHTML = '<li class="rank-empty">아직 기록이 없어요</li>';
        return;
      }
      list.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = 'rank-item' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '');
        li.innerHTML = `
          <span class="rank-num">${i + 1}</span>
          <span class="rank-emoji">${iconEmoji(item.icon)}</span>
          <span class="rank-name"></span>
          <span class="rank-count">${item.count}</span>`;
        li.querySelector('.rank-name').textContent = item.name;
        el.appendChild(li);
      });
    };
    renderList($('rankSent'), r.sent || []);
    renderList($('rankReceived'), r.received || []);
    $('rankingSheet').classList.remove('hidden');
  } catch { alert('랭킹 불러오기 실패'); }
});
$('rankingClose').addEventListener('click', () => $('rankingSheet').classList.add('hidden'));
$('rankingSheet').addEventListener('click', (e) => {
  if (e.target.id === 'rankingSheet') $('rankingSheet').classList.add('hidden');
});

$('openStreakSheet').addEventListener('click', () => {
  const r = window._STREAK;
  if (!r) return;
  const ul = $('streakList');
  ul.innerHTML = '';
  for (const m of r.familyStreaks) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="streak-emoji">${iconEmoji(m.icon)}</span>
      <span class="streak-name"></span>
      <span class="streak-days">${m.streak > 0 ? '🔥 ' + m.streak + '일' : '—'}</span>`;
    li.querySelector('.streak-name').textContent = m.name + '님';
    ul.appendChild(li);
  }
  $('streakSheet').classList.remove('hidden');
});
$('streakClose').addEventListener('click', () => $('streakSheet').classList.add('hidden'));
$('streakSheet').addEventListener('click', (e) => {
  if (e.target.id === 'streakSheet') $('streakSheet').classList.add('hidden');
});

$('questionSubmit').addEventListener('click', async () => {
  const a = $('questionAnswer').value.trim();
  if (!a) { alert('답변을 적어 주세요'); return; }
  try {
    await api('/api/question/today/answer', {
      method: 'POST', body: JSON.stringify({ answer: a }),
    });
    $('questionSubmit').textContent = '저장됐어요';
    setTimeout(() => $('questionSubmit').textContent = '답변 수정', 1500);
    loadTodayQuestion();
    loadMyStreak();
    showStickerNudge();
  } catch { alert('저장 실패'); }
});

// 답변 저장 후 응원 스티커 유도 토스트 (1회)
function showStickerNudge() {
  if (sessionStorage.getItem('fb_nudge_shown')) return;
  sessionStorage.setItem('fb_nudge_shown', '1');
  const el = $('undoToast');
  if (!el) return;
  el.querySelector('.undo-msg').textContent = '답변 저장됨! 가족에게 응원 스티커도 어때요?';
  const btn = $('undoBtn');
  btn.textContent = '스티커 💖';
  btn.onclick = () => {
    el.classList.add('hidden');
    const card = document.querySelector('[data-card-id="family"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

const REACTION_EMOJIS = ['❤️', '😂', '🥹', '👏', '🙏'];
async function loadYesterdayReveal() {
  try {
    const r = await api('/api/question/yesterday');
    if (!r.question || !r.answers?.length) { $('revealCard').classList.add('hidden'); return; }
    $('revealQuestion').textContent = r.question;
    const ul = $('revealList');
    ul.innerHTML = '';
    for (const a of r.answers) {
      const li = document.createElement('li');
      const skipped = !!a.is_skip;
      const created = a.created_at ? new Date(a.created_at) : null;
      const updated = a.updated_at ? new Date(a.updated_at) : null;
      let timeLabel = '';
      if (created) {
        const h = created.getHours();
        const m = String(created.getMinutes()).padStart(2, '0');
        const ampm = h < 12 ? '오전' : '오후';
        const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        timeLabel = `${ampm} ${h12}:${m}`;
        if (updated && (updated - created) > 60000) timeLabel += ' 수정됨';
      }
      const imgHtml = (!skipped && a.image_url) ? `<img class="reveal-image" src="${a.image_url.replace(/"/g, '')}" alt="답변 이미지" loading="lazy" />` : '';
      li.innerHTML = `
        <span class="reveal-emoji">${inlineAvatarHtml({ id: a.user_id, name: a.display_name, icon: a.icon }, 36)}</span>
        <div class="reveal-body">
          <div class="reveal-head">
            <span class="reveal-name"></span>
            ${timeLabel ? `<span class="reveal-time">${timeLabel}</span>` : ''}
            ${skipped ? '' : `<button class="fav-btn ${a.my_favorite ? 'on' : ''}" title="즐겨찾기" aria-label="즐겨찾기">${a.my_favorite ? '⭐' : '☆'}</button>`}
          </div>
          <div class="reveal-answer ${skipped ? 'skipped' : ''}"></div>
          ${imgHtml}
          <div class="reaction-row"></div>
          ${skipped ? '' : `<button class="comment-toggle" data-aid="${a.answer_id}">💬 한 마디 남기기</button>
            <div class="comment-section hidden" data-aid="${a.answer_id}"></div>`}
        </div>`;
      li.querySelector('.reveal-name').textContent = a.display_name + '님';
      li.querySelector('.reveal-answer').textContent = skipped ? '🌙 건너뛰었어요' : a.answer_text;
      if (!skipped) {
        renderReactionRow(li.querySelector('.reaction-row'), a.answer_id, a.reactions || []);
        const tbtn = li.querySelector('.comment-toggle');
        tbtn.onclick = () => toggleCommentSection(a.answer_id, li.querySelector('.comment-section'), tbtn);
        const favBtn = li.querySelector('.fav-btn');
        favBtn.onclick = async () => {
          try {
            const res = await api(`/api/answer/${a.answer_id}/favorite`, { method: 'POST' });
            favBtn.classList.toggle('on', !!res.favorited);
            favBtn.textContent = res.favorited ? '⭐' : '☆';
          } catch {}
        };
      }
      ul.appendChild(li);
    }
    $('revealCard').classList.remove('hidden');
  } catch {}
}

async function toggleCommentSection(answerId, section, btn) {
  if (!section.classList.contains('hidden')) {
    section.classList.add('hidden');
    btn.textContent = '💬 한 마디 남기기';
    return;
  }
  btn.textContent = '💬 닫기';
  section.classList.remove('hidden');
  try {
    const list = await api(`/api/answer/${answerId}/comments`);
    section.innerHTML = `
      <ul class="comment-list"></ul>
      <div class="comment-form">
        <input class="comment-input" type="text" maxlength="300" placeholder="따뜻한 한 마디를 남겨 보세요" />
        <button type="button" class="comment-send">보내기</button>
      </div>`;
    const ul = section.querySelector('.comment-list');
    for (const c of list) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="cm-icon">${inlineAvatarHtml({ id: c.author_id, name: c.author_name, icon: c.author_icon }, 22)}</span>
        <div class="cm-body">
          <div class="cm-head"><span class="cm-name"></span></div>
          <div class="cm-text"></div>
        </div>
        ${c.author_id === ME.id ? `<button class="cm-del" data-cid="${c.id}" aria-label="삭제">✕</button>` : ''}`;
      li.querySelector('.cm-name').textContent = c.author_name + '님';
      li.querySelector('.cm-text').textContent = c.text;
      const del = li.querySelector('.cm-del');
      if (del) del.onclick = async () => {
        await api(`/api/answer/${answerId}/comments/${c.id}`, { method: 'DELETE' });
        toggleCommentSection(answerId, section, btn); // 재로드
        toggleCommentSection(answerId, section, btn);
      };
      ul.appendChild(li);
    }
    const input = section.querySelector('.comment-input');
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      try {
        await api(`/api/answer/${answerId}/comments`, {
          method: 'POST', body: JSON.stringify({ text }),
        });
        input.value = '';
        section.classList.add('hidden');
        toggleCommentSection(answerId, section, btn); // 재열기로 목록 갱신
      } catch { alert('저장 실패'); }
    };
    section.querySelector('.comment-send').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  } catch {}
}

function renderReactionRow(row, answerId, reactions) {
  row.innerHTML = '';
  const map = new Map(reactions.map((r) => [r.emoji, r]));
  for (const emoji of REACTION_EMOJIS) {
    const info = map.get(emoji);
    const count = info?.count || 0;
    const mine = !!info?.mine;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rx-btn' + (mine ? ' on' : '') + (count === 0 ? ' empty' : '');
    btn.innerHTML = `<span class="rx-emoji">${emoji}</span>${count ? `<span class="rx-cnt">${count}</span>` : ''}`;
    btn.onclick = async () => {
      try {
        const res = await api(`/api/answer/${answerId}/react`, {
          method: 'POST', body: JSON.stringify({ emoji }),
        });
        renderReactionRow(row, answerId, res.reactions || []);
        btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      } catch {}
    };
    row.appendChild(btn);
  }
}

let HISTORY_CACHE = [];
let HISTORY_FILTER = 'all';

document.querySelectorAll('.hf-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.hf-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    HISTORY_FILTER = b.dataset.filter;
    renderHistory();
  });
});

function renderHistory() {
  const el = $('historyList');
  el.innerHTML = '';
  const list = HISTORY_CACHE;
  if (!list.length) {
    el.innerHTML = '<p class="empty-state-text" style="text-align:center;padding:30px 0">아직 지난 기록이 없어요</p>';
    return;
  }
  for (const item of list) {
    let answers;
    if (HISTORY_FILTER === 'mine') {
      answers = item.answers.filter((a) => a.display_name === ME.displayName);
    } else if (HISTORY_FILTER && HISTORY_FILTER.startsWith('member:')) {
      const target = HISTORY_FILTER.slice('member:'.length);
      answers = item.answers.filter((a) => a.display_name === target);
    } else {
      answers = item.answers;
    }
    if (HISTORY_FILTER !== 'all' && !answers.length) continue;
    renderHistoryItem(el, item, answers);
  }
  if (el.children.length === 0) {
    el.innerHTML = '<p class="empty-state-text" style="text-align:center;padding:30px 0">해당되는 기록이 없어요</p>';
  }
}

function renderHistoryItem(el, item, answers) {
  const d = new Date(item.date);
  const div = document.createElement('div');
  div.className = 'history-item';
  div.innerHTML = `
    <div class="history-date">${d.getMonth() + 1}월 ${d.getDate()}일</div>
    <div class="history-q"></div>
    <ul class="reveal-list history-answers"></ul>`;
  div.querySelector('.history-q').textContent = item.question;
  const ul = div.querySelector('.history-answers');
  if (answers.length) {
    for (const a of answers) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="reveal-emoji">${inlineAvatarHtml({ id: a.user_id, name: a.display_name, icon: a.icon }, 36)}</span>
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

$('qHistoryBtn').addEventListener('click', async () => {
  try {
    const list = await api('/api/question/history?limit=30');
    HISTORY_CACHE = list;
    // 가족별 필터 버튼 동적 생성
    buildHistoryFamilyFilters(list);
    const el = $('historyList');
    el.innerHTML = '';
    if (!list.length) {
      el.innerHTML = '<p class="empty-state-text" style="text-align:center;padding:30px 0">아직 지난 기록이 없어요</p>';
    } else {
      renderHistory();
    }
    $('historySheet').classList.remove('hidden');
    return;
  } catch { alert('기록 불러오기 실패'); return; }
});

function buildHistoryFamilyFilters(list) {
  // 기존 전체/내 답변 버튼 외에 가족별 필터 추가
  const row = $('historyFilterRow');
  if (!row) return;
  // 기존 추가된 멤버 필터만 제거
  row.querySelectorAll('.hf-btn[data-member]').forEach((b) => b.remove());
  // 고유 멤버 수집
  const seen = new Map();
  for (const item of list) {
    for (const a of item.answers) {
      if (!seen.has(a.display_name)) seen.set(a.display_name, a.icon);
    }
  }
  for (const [name, icon] of seen) {
    if (name === ME.displayName) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hf-btn';
    b.dataset.filter = 'member:' + name;
    b.dataset.member = name;
    b.innerHTML = `${iconEmoji(icon)} ${escapeHtml(name)}`;
    b.addEventListener('click', () => {
      row.querySelectorAll('.hf-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      HISTORY_FILTER = b.dataset.filter;
      renderHistory();
    });
    row.appendChild(b);
  }
}

$('historyClose').addEventListener('click', () => $('historySheet').classList.add('hidden'));
$('historySheet').addEventListener('click', (e) => {
  if (e.target.id === 'historySheet') $('historySheet').classList.add('hidden');
});

// ---------- 구성원 편집 시트 ----------
let EDITING_USER = null;
let ED_PICKED_ICON = 'star';
function openEditSheet(u) {
  EDITING_USER = u;
  ED_PICKED_ICON = u.icon || 'star';
  $('edDisplay').value = u.displayName || '';
  $('edYear').value  = u.birthYear || '';
  $('edMonth').value = u.birthMonth || '';
  $('edDay').value   = u.birthDay || '';
  $('edLunar').checked = !!u.isLunar;
  $('edPhone').value = displayPhone(u.phone);
  $('edAdmin').checked = u.role === 'admin';
  $('edPassword').value = '';
  // 아이콘 픽커 (미니)
  const grid = $('edIconPicker');
  grid.innerHTML = '';
  for (const i of ICONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-opt' + (i.code === ED_PICKED_ICON ? ' selected' : '');
    b.title = i.label;
    b.innerHTML = `<span class="icon-emoji">${i.emoji}</span>`;
    b.onclick = () => {
      ED_PICKED_ICON = i.code;
      grid.querySelectorAll('.icon-opt').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
    };
    grid.appendChild(b);
  }
  $('editSheet').classList.remove('hidden');
}
$('edClose').addEventListener('click', () => $('editSheet').classList.add('hidden'));
$('editSheet').addEventListener('click', (e) => {
  if (e.target.id === 'editSheet') $('editSheet').classList.add('hidden');
});
$('edSave').addEventListener('click', async () => {
  if (!EDITING_USER) return;
  const body = {
    displayName: $('edDisplay').value.trim(),
    icon: ED_PICKED_ICON,
    birthYear:  $('edYear').value  || null,
    birthMonth: $('edMonth').value || null,
    birthDay:   $('edDay').value   || null,
    isLunar: $('edLunar').checked,
    phone: $('edPhone').value.trim(),
    role: $('edAdmin').checked ? 'admin' : 'member',
  };
  const pw = $('edPassword').value;
  if (pw) {
    if (pw.length < 4) { alert('비밀번호는 최소 4자 이상이어야 해요'); return; }
    body.password = pw;
  }
  try {
    await api(`/api/users/${EDITING_USER.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    $('editSheet').classList.add('hidden');
    loadUsers(); loadZodiac(); loadFamilySummary();
  } catch (e) {
    alert(e.status === 409 ? '같은 이름이 이미 있어요' : '저장 실패');
  }
});

// 프로필 시트 닫기
document.getElementById('sheetClose').addEventListener('click', closeProfileSheet);
document.getElementById('profileSheet').addEventListener('click', (e) => {
  if (e.target.id === 'profileSheet') closeProfileSheet();
});

// 화면 톤 (색 테마) — 모바일에서 prefers-color-scheme 이 덮어쓰지 않도록 루트에 변수를 직접 심음
const THEME_SEMANTIC_DEFAULT = {
  '--primary': '#0A84FF',
  '--good': '#34C759',
  '--normal': '#FF9F0A',
  '--bad': '#FF3B30',
  '--worst': '#AF52DE',
};
const SCHEME_INLINE = {
  light: {
    ...THEME_SEMANTIC_DEFAULT,
    '--bg': '#F2F2F7',
    '--card': '#FFFFFF',
    '--text': '#1C1C1E',
    '--sub': '#6E6E73',
    '--line': '#E5E5EA',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,.03), 0 2px 8px rgba(0,0,0,.04)',
    '--shadow-md': '0 2px 4px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)',
    'color-scheme': 'light',
  },
  dark: {
    ...THEME_SEMANTIC_DEFAULT,
    '--bg': '#000000',
    '--card': '#1C1C1E',
    '--text': '#F2F2F7',
    '--sub': '#8E8E93',
    '--line': '#2C2C2E',
    '--shadow-sm': '0 0 0 1px rgba(255,255,255,.04)',
    '--shadow-md': '0 0 0 1px rgba(255,255,255,.05)',
    'color-scheme': 'dark',
  },
  darkgray: {
    ...THEME_SEMANTIC_DEFAULT,
    '--bg': '#1A1A1D',
    '--card': '#2C2C2E',
    '--text': '#E5E5EA',
    '--sub': '#98989A',
    '--line': '#3A3A3C',
    '--shadow-sm': '0 0 0 1px rgba(255,255,255,.05)',
    '--shadow-md': '0 0 0 1px rgba(255,255,255,.06)',
    'color-scheme': 'dark',
  },
  sepia: {
    ...THEME_SEMANTIC_DEFAULT,
    '--bg': '#F4EFE3',
    '--card': '#FBF6EA',
    '--text': '#3A2E22',
    '--sub': '#7A6B56',
    '--line': '#E3D9C3',
    '--shadow-sm': '0 1px 2px rgba(60, 40, 20, .04), 0 2px 8px rgba(60, 40, 20, .05)',
    '--shadow-md': '0 2px 4px rgba(60, 40, 20, .05), 0 8px 24px rgba(60, 40, 20, .06)',
    'color-scheme': 'light',
  },
  kid: {
    '--bg': '#FFFEF5',
    '--card': '#FFFFFF',
    '--text': '#2A2A2A',
    '--sub': '#7A7A7A',
    '--line': '#FFE4B5',
    '--primary': '#FF6B9D',
    '--good': '#00C896',
    '--normal': '#FFB84D',
    '--bad': '#FF4D6D',
    '--worst': '#B94DFF',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,.03), 0 2px 8px rgba(0,0,0,.04)',
    '--shadow-md': '0 2px 4px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)',
    'color-scheme': 'light',
  },
  hc: {
    '--bg': '#000000',
    '--card': '#111111',
    '--text': '#FFF200',
    '--sub': '#FFD000',
    '--line': '#FFF200',
    '--primary': '#00E5FF',
    '--good': '#00FF88',
    '--bad': '#FF3333',
    '--shadow-sm': '0 0 0 2px rgba(255,242,0,.2)',
    '--shadow-md': '0 0 0 2px rgba(255,242,0,.3)',
    'color-scheme': 'dark',
  },
};
const THEME_VAR_KEYS = [...new Set(Object.values(SCHEME_INLINE).flatMap((o) => Object.keys(o)))];
function clearInlineTheme(root) {
  for (const k of THEME_VAR_KEYS) root.style.removeProperty(k);
}
function applyScheme(scheme) {
  const s = ['light','dark','darkgray','sepia','hc','kid'].includes(scheme) ? scheme : 'auto';
  const root = document.documentElement;
  clearInlineTheme(root);
  if (s === 'auto') {
    root.removeAttribute('data-scheme');
  } else {
    root.setAttribute('data-scheme', s);
    const vars = SCHEME_INLINE[s];
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, String(val));
    }
  }
  document.querySelectorAll('.th-btn').forEach((b) => {
    b.classList.toggle('active', (b.dataset.scheme || 'auto') === s);
  });
  try {
    localStorage.setItem('fb_scheme', s);
  } catch (_) { /* 사파리 비공개 탭 등 */ }
}
document.querySelectorAll('.th-btn').forEach((b) => {
  b.addEventListener('click', () => applyScheme(b.dataset.scheme));
});
// 부팅 시 적용
(function initScheme() {
  let saved = 'auto';
  try { saved = localStorage.getItem('fb_scheme') || 'auto'; } catch (_) {}
  applyScheme(saved);
})();
window.addEventListener('pageshow', (ev) => {
  if (!ev.persisted) return;
  let saved = 'auto';
  try { saved = localStorage.getItem('fb_scheme') || 'auto'; } catch (_) {}
  applyScheme(saved);
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

// ---------- 공지 히스토리 ----------
$('noticeHistoryBtn').addEventListener('click', async () => {
  try {
    const list = await api('/api/notice/history');
    const ul = $('noticeHistList');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty-state" style="padding:20px 0!important;text-align:center"><span class="empty-state-text">지난 공지가 아직 없어요</span></li>';
    } else {
      for (const n of list) {
        const li = document.createElement('li');
        li.className = 'notice-hist-item';
        const d = new Date(n.created_at);
        const when = `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        li.innerHTML = `
          <div class="nh-head">
            <span class="nh-author">${n.author_name ? iconEmoji(n.author_icon) + ' ' + n.author_name : '—'}</span>
            <span class="nh-time">${when}</span>
          </div>
          <div class="nh-text"></div>`;
        li.querySelector('.nh-text').textContent = n.text;
        ul.appendChild(li);
      }
    }
    $('noticeHistSheet').classList.remove('hidden');
  } catch { alert('공지 기록 불러오기 실패'); }
});
$('noticeHistClose').addEventListener('click', () => $('noticeHistSheet').classList.add('hidden'));
$('noticeHistSheet').addEventListener('click', (e) => {
  if (e.target.id === 'noticeHistSheet') $('noticeHistSheet').classList.add('hidden');
});

// ---------- 메모 삭제 실행 취소 토스트 ----------
const MEMO_REACTION_EMOJIS = ['👍','❤️','🎉','👏'];
function renderMemoReactions(row, memoId, reactions) {
  row.innerHTML = '';
  const map = new Map(reactions.map((r) => [r.emoji, r]));
  for (const emoji of MEMO_REACTION_EMOJIS) {
    const info = map.get(emoji);
    const count = info?.count || 0;
    const mine = !!info?.mine;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mr-btn' + (mine ? ' on' : '') + (count === 0 ? ' empty' : '');
    btn.innerHTML = `<span>${emoji}</span>${count ? `<span class="mr-cnt">${count}</span>` : ''}`;
    btn.onclick = async (e) => {
      e.stopPropagation();
      try {
        const res = await api(`/api/memo/${memoId}/react`, {
          method: 'POST', body: JSON.stringify({ emoji }),
        });
        renderMemoReactions(row, memoId, res.reactions || []);
      } catch {}
    };
    row.appendChild(btn);
  }
}

function showSimpleToast(msg) {
  const el = $('undoToast');
  if (!el) return;
  el.querySelector('.undo-msg').textContent = msg;
  const btn = $('undoBtn');
  btn.textContent = '확인';
  btn.onclick = () => el.classList.add('hidden');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

/** 공용 인앱 확인 다이얼로그 — native confirm() 대체. Promise<boolean> 반환. */
function showConfirm({ title = '확인', message = '', confirmLabel = '확인', cancelLabel = '취소', danger = false } = {}) {
  return new Promise((resolve) => {
    const sheet = $('confirmSheet');
    const titleEl = $('confirmTitle');
    const msgEl = $('confirmMessage');
    const okBtn = $('confirmOk');
    const cancelBtn = $('confirmCancel');
    if (!sheet || !okBtn || !cancelBtn) {
      // 폴백: 시트 없으면 네이티브 confirm
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    okBtn.classList.toggle('danger', !!danger);
    sheet.classList.remove('hidden');
    let done = false;
    function cleanup(result) {
      if (done) return;
      done = true;
      sheet.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      sheet.removeEventListener('click', onBg);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBg(e) { if (e.target.id === 'confirmSheet') cleanup(false); }
    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
      else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); cleanup(true); }
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    sheet.addEventListener('click', onBg);
    document.addEventListener('keydown', onKey);
    // 확인 버튼에 포커스 (키보드 Enter 로 즉시 확정 가능)
    setTimeout(() => okBtn.focus(), 50);
  });
}

let UNDO_TIMER = null;
function showUndoToast(memo) {
  const el = $('undoToast');
  const btn = $('undoBtn');
  if (!el || !btn) return;
  el.classList.remove('hidden');
  clearTimeout(UNDO_TIMER);
  UNDO_TIMER = setTimeout(() => el.classList.add('hidden'), 5000);
  btn.onclick = async () => {
    clearTimeout(UNDO_TIMER);
    el.classList.add('hidden');
    try {
      // 같은 내용으로 재추가
      await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: memo.content }) });
      // 원래 중요/완료 상태 복원
      if (memo.important || memo.done) {
        const list = await api('/api/memos');
        const fresh = list.find((x) => x.content === memo.content);
        if (fresh) {
          await api(`/api/memos/${fresh.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ important: !!memo.important, done: !!memo.done }),
          });
        }
      }
      loadMemos();
    } catch {}
  };
}

// ---------- PWA 설치 배너 ----------
(function () {
  const banner = document.getElementById('installBanner');
  const btn = document.getElementById('installBtn');
  const closeBtn = document.getElementById('installClose');
  const sub = document.getElementById('installSub');
  if (!banner || !btn || !sub) return;

  function isLikelyIOS() {
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  let deferredPrompt = null;
  const DISMISS_KEY = 'fb_install_dismissed';
  try {
    if (localStorage.getItem(DISMISS_KEY)) return;
  } catch (_) { /* 비공개 모드 등: 배너는 계속 시도 */ }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
    });
  }

  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.textContent = '설치';
    sub.textContent = '앱처럼 바로 열 수 있어요';
    setTimeout(() => banner.classList.remove('hidden'), 3000);
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const res = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (res.outcome === 'accepted') banner.classList.add('hidden');
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
    } else {
      const chromeIos = /CriOS/i.test(navigator.userAgent);
      alert(
        chromeIos
          ? '아이폰의 크롬에서는 「홈 화면에 추가」가 제공되지 않습니다. 사파리로 같은 주소를 연 뒤, 하단 공유(□↑) → 「홈 화면에 추가」를 눌러 주세요.'
          : '「공유」→「홈 화면에 추가」를 눌러 주세요. (아이폰은 사파리가 가장 확실합니다.)'
      );
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
      banner.classList.add('hidden');
    }
  });

  const isIos = isLikelyIOS();
  const isStandaloneSafari = !!window.navigator.standalone;
  if (isIos && !isStandaloneSafari) {
    btn.textContent = '안내 보기';
    const chromeIos = /CriOS/i.test(navigator.userAgent);
    sub.textContent = chromeIos
      ? '크롬 제한 → 사파리에서 열면 홈 화면 추가 가능'
      : '공유(□↑) → 홈 화면에 추가';
    setTimeout(() => banner.classList.remove('hidden'), 2500);
  }
})();

// ---------- 맨 위로 FAB ----------
const toTop = document.getElementById('toTopFab');
if (toTop) {
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('hidden', window.scrollY < 400);
  }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ---------- 이미지 라이트박스 ----------
function openLightbox(src) {
  const lb = $('lightbox');
  $('lightboxImg').src = src;
  lb.classList.remove('hidden');
}
$('lightboxClose').addEventListener('click', () => $('lightbox').classList.add('hidden'));
$('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox' || e.target.tagName === 'IMG') {
    $('lightbox').classList.add('hidden');
  }
});
// 답변 이미지 / hero photo 클릭 시 라이트박스
document.addEventListener('click', (e) => {
  const img = e.target;
  if (img?.classList?.contains('reveal-image')) {
    e.preventDefault(); e.stopPropagation();
    openLightbox(img.src);
  }
});
const heroBanner = $('heroPhotoBanner');
if (heroBanner) {
  heroBanner.addEventListener('click', () => {
    const src = $('heroPhotoImg')?.getAttribute('src');
    if (src) openLightbox(src);
  });
}

// ---------- 시트를 document.body 직하로 재배치 (설정화면·다른 screen 에서도 열리도록) ----------
// .sheet-backdrop / .lightbox 가 <main id="app"> 안에 있으면 #app.hidden 일 때 display:none 상속받아 안 보임
for (const el of document.querySelectorAll('.sheet-backdrop, .lightbox')) {
  if (el.parentElement && el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
}

// ---------- 모달 열릴 때 배경 스크롤 고정 (iOS Safari 대응: position fixed + top) ----------
let _scrollLockY = 0;
function updateScrollLock() {
  const open = document.querySelector('.sheet-backdrop:not(.hidden), .lightbox:not(.hidden)');
  const locked = document.body.classList.contains('scroll-locked');
  if (open && !locked) {
    _scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${_scrollLockY}px`;
    document.body.classList.add('scroll-locked');
  } else if (!open && locked) {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, _scrollLockY);
  }
}
const _scrollLockObs = new MutationObserver(updateScrollLock);
document.querySelectorAll('.sheet-backdrop, .lightbox').forEach((el) => {
  _scrollLockObs.observe(el, { attributes: true, attributeFilter: ['class'] });
});

// ==========================================================================
// 가족 갤러리
// ==========================================================================
let GALLERY_CACHE = [];
let GALLERY_LOADING = false;
let GALLERY_DETAIL_ID = null;

async function loadGallery() {
  try {
    const list = await api('/api/gallery?limit=12');
    GALLERY_CACHE = list || [];
    renderGalleryCard();
  } catch {}
}

function renderGalleryCard() {
  const grid = $('galleryGrid');
  const empty = $('galleryEmpty');
  const openAllBtn = $('galleryOpenAllBtn');
  if (!grid) return;
  grid.innerHTML = '';
  // '전체보기' 는 카드 밖에 더 있는 경우(>9장) 에만 표시 — 빈 상태·9장 이하엔 의미 없어서 숨김
  if (openAllBtn) openAllBtn.classList.toggle('hidden', GALLERY_CACHE.length <= 9);
  if (!GALLERY_CACHE.length) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  // 최근 9장만 카드에
  const shown = GALLERY_CACHE.slice(0, 9);
  for (const p of shown) {
    const div = document.createElement('div');
    div.className = 'gallery-thumb';
    div.innerHTML = `<img src="${p.url.replace(/"/g, '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" />`;
    div.onclick = () => openGalleryDetail(p);
    grid.appendChild(div);
  }
}

function renderGallerySheet(append = false) {
  const grid = $('gallerySheetGrid');
  if (!grid) return;
  if (!append) grid.innerHTML = '';
  for (const p of GALLERY_CACHE) {
    if (append && grid.querySelector(`[data-gid="${p.id}"]`)) continue;
    const div = document.createElement('div');
    div.className = 'gallery-thumb';
    div.dataset.gid = String(p.id);
    div.innerHTML = `<img src="${p.url.replace(/"/g, '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" />`;
    div.onclick = () => openGalleryDetail(p);
    grid.appendChild(div);
  }
  const more = $('galleryLoadMoreBtn');
  if (more) more.classList.toggle('hidden', GALLERY_CACHE.length < 12);
}

async function openGallerySheet() {
  $('gallerySheet').classList.remove('hidden');
  if (!GALLERY_CACHE.length) await loadGallery();
  renderGallerySheet(false);
}

async function loadMoreGallery() {
  if (GALLERY_LOADING || !GALLERY_CACHE.length) return;
  GALLERY_LOADING = true;
  const btn = $('galleryLoadMoreBtn');
  if (btn) { btn.disabled = true; btn.textContent = '불러오는 중...'; }
  try {
    const last = GALLERY_CACHE[GALLERY_CACHE.length - 1];
    const more = await api(`/api/gallery?before=${last.id}&limit=24`);
    if (more && more.length) {
      GALLERY_CACHE = GALLERY_CACHE.concat(more);
      renderGallerySheet(true);
    }
    if (!more || more.length < 24) {
      if (btn) btn.classList.add('hidden');
    }
  } catch {} finally {
    GALLERY_LOADING = false;
    if (btn) { btn.disabled = false; btn.textContent = '더 보기'; }
  }
}

function openGalleryDetail(p) {
  GALLERY_DETAIL_ID = p.id;
  renderGalleryDetail(p);
  $('galleryDetailSheet').classList.remove('hidden');
}

/** 현재 상세 사진 렌더 + 앞/뒤 네비 버튼 상태 업데이트 */
function renderGalleryDetail(p) {
  $('galleryDetailImg').src = p.url;
  const author = `${iconEmoji(p.uploaderIcon)} ${p.uploaderName || '알 수 없음'}`;
  $('galleryDetailAuthor').textContent = author;
  $('galleryDetailCaption').textContent = p.caption || '';
  $('galleryDetailTime').textContent = p.createdAt ? relativeTime(p.createdAt) : '';
  $('galleryDetailDeleteBtn').classList.toggle('hidden', !p.canDelete);
  // 앞/뒤 네비 + 카운터
  const idx = GALLERY_CACHE.findIndex((x) => x.id === p.id);
  const total = GALLERY_CACHE.length;
  const prevBtn = $('galleryDetailPrev');
  const nextBtn = $('galleryDetailNext');
  const counter = $('galleryDetailCounter');
  if (idx < 0 || total <= 1) {
    prevBtn?.classList.add('hidden');
    nextBtn?.classList.add('hidden');
    if (counter) counter.textContent = '';
  } else {
    // GALLERY_CACHE 는 최신→오래된 순이므로 '다음 사진' = 더 오래된 것 (idx+1)
    prevBtn?.classList.toggle('hidden', idx === 0);
    nextBtn?.classList.toggle('hidden', idx >= total - 1);
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
  }
}

function navigateGalleryDetail(delta) {
  if (GALLERY_DETAIL_ID == null) return;
  const idx = GALLERY_CACHE.findIndex((x) => x.id === GALLERY_DETAIL_ID);
  if (idx < 0) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= GALLERY_CACHE.length) return;
  const p = GALLERY_CACHE[newIdx];
  GALLERY_DETAIL_ID = p.id;
  renderGalleryDetail(p);
}

async function deleteGalleryPhoto(id) {
  const ok = await showConfirm({
    title: '사진 삭제',
    message: '이 사진을 삭제할까요?\n한 번 지우면 되돌릴 수 없어요.',
    confirmLabel: '삭제',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/gallery/${id}`, { method: 'DELETE' });
    GALLERY_CACHE = GALLERY_CACHE.filter((p) => p.id !== id);
    renderGalleryCard();
    renderGallerySheet(false);
    $('galleryDetailSheet').classList.add('hidden');
  } catch (e) {
    alert(e.status === 403 ? '삭제 권한이 없어요' : '삭제 실패');
  }
}

// 업로드 시트 상태 — 파일 선택 후 미리보기 + 캡션 입력용
let _pendingGalleryFile = null;
let _pendingGalleryObjectUrl = null;

function openGalleryUploadSheet(file) {
  _pendingGalleryFile = file;
  if (_pendingGalleryObjectUrl) URL.revokeObjectURL(_pendingGalleryObjectUrl);
  _pendingGalleryObjectUrl = URL.createObjectURL(file);
  $('galleryUploadPreview').src = _pendingGalleryObjectUrl;
  $('galleryUploadCaption').value = '';
  $('galleryUploadSheet').classList.remove('hidden');
  setTimeout(() => {
    if (!/Mobi|Android/i.test(navigator.userAgent)) $('galleryUploadCaption')?.focus();
  }, 150);
}

function closeGalleryUploadSheet() {
  $('galleryUploadSheet').classList.add('hidden');
  if (_pendingGalleryObjectUrl) {
    URL.revokeObjectURL(_pendingGalleryObjectUrl);
    _pendingGalleryObjectUrl = null;
  }
  _pendingGalleryFile = null;
}

async function confirmGalleryUpload() {
  const file = _pendingGalleryFile;
  if (!file) return;
  const caption = ($('galleryUploadCaption').value || '').trim();
  const confirmBtn = $('galleryUploadConfirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '올리는 중...'; }
  try {
    const blob = await resizeImageToJpegBlob(file, { maxSide: 2000, targetBytes: 3 * 1024 * 1024 - 1 });
    const fd = new FormData();
    fd.append('photo', blob, 'photo.jpg');
    if (caption) fd.append('caption', caption);
    const r = await fetch('/api/gallery', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) {
      let msg = '업로드 실패';
      try { const j = await r.json(); if (j.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    await loadGallery();
    if (!$('gallerySheet').classList.contains('hidden')) renderGallerySheet(false);
    closeGalleryUploadSheet();
  } catch (err) {
    alert(err.message || '업로드 실패');
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '올리기'; }
  }
}

$('galleryAddBtn')?.addEventListener('click', () => $('galleryFile')?.click());
$('galleryFile')?.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) { alert('이미지 파일을 선택해 주세요'); return; }
  openGalleryUploadSheet(f);
});
$('galleryUploadConfirm')?.addEventListener('click', confirmGalleryUpload);
$('galleryUploadCancel')?.addEventListener('click', closeGalleryUploadSheet);
$('galleryUploadSheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'galleryUploadSheet') closeGalleryUploadSheet();
});
$('galleryUploadCaption')?.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter 로 업로드 확정
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    confirmGalleryUpload();
  }
});
$('galleryOpenAllBtn')?.addEventListener('click', openGallerySheet);
$('gallerySheetClose')?.addEventListener('click', () => $('gallerySheet').classList.add('hidden'));
$('gallerySheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'gallerySheet') $('gallerySheet').classList.add('hidden');
});
$('galleryLoadMoreBtn')?.addEventListener('click', loadMoreGallery);
$('galleryDetailClose')?.addEventListener('click', () => $('galleryDetailSheet').classList.add('hidden'));
$('galleryDetailSheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'galleryDetailSheet') $('galleryDetailSheet').classList.add('hidden');
});
$('galleryDetailDeleteBtn')?.addEventListener('click', () => {
  if (GALLERY_DETAIL_ID != null) deleteGalleryPhoto(GALLERY_DETAIL_ID);
});
$('galleryDetailImg')?.addEventListener('click', () => {
  const src = $('galleryDetailImg').getAttribute('src');
  if (src) openLightbox(src);
});

// 네비게이션: 이전/다음 버튼
$('galleryDetailPrev')?.addEventListener('click', (e) => { e.stopPropagation(); navigateGalleryDetail(-1); });
$('galleryDetailNext')?.addEventListener('click', (e) => { e.stopPropagation(); navigateGalleryDetail(1); });

// 키보드 ← / → 로 이동 (시트 열려 있을 때만)
document.addEventListener('keydown', (e) => {
  if ($('galleryDetailSheet')?.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigateGalleryDetail(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); navigateGalleryDetail(1); }
  else if (e.key === 'Escape') $('galleryDetailSheet').classList.add('hidden');
});

// 모바일 스와이프 — 이미지 영역에서 가로 스와이프 감지
(function setupGallerySwipe() {
  const wrap = document.querySelector('.gallery-detail-img-wrap');
  if (!wrap) return;
  let startX = 0, startY = 0, startT = 0, tracking = false;
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
    tracking = true;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startT;
    // 가로 이동이 세로보다 크고, 50px 이상, 600ms 이내면 스와이프
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      if (dx > 0) navigateGalleryDetail(-1);  // 오른쪽으로 밀면 이전
      else navigateGalleryDetail(1);           // 왼쪽으로 밀면 다음
    }
  }, { passive: true });
})();

// ==========================================================================
// 가족 채팅
// ==========================================================================
let CHAT_MESSAGES = [];      // 오래된 것 → 최신 순
let CHAT_LAST_ID = 0;        // 가장 최신 받은 메시지 id
let CHAT_OLDEST_ID = 0;      // 가장 오래된 받은 메시지 id (페이지네이션 용)
let CHAT_POLL_TIMER = null;
let CHAT_SHEET_OPEN = false;

async function loadChatPeek() {
  try {
    const list = await api('/api/chat?limit=5');
    const peek = $('chatPeek');
    if (!peek) return;
    peek.innerHTML = '';
    if (!list.length) {
      peek.innerHTML = '<li class="chat-peek-empty">아직 대화가 없어요. 가족에게 첫 메시지를 보내 보세요.</li>';
      return;
    }
    // 최근 3개만 미리보기 (오래된 → 최신 정렬 유지)
    const recent = list.slice(-3);
    for (const m of recent) {
      const li = document.createElement('li');
      // 인라인 스타일로 img 크기 강제 (전역 img { max-width: 100% } 이 30px 부모와 충돌하는 경우 방지)
      const avatar = m.userPhoto
        ? `<img src="${m.userPhoto.replace(/"/g, '')}" alt="" style="width:30px;height:30px;object-fit:cover;display:block;border-radius:50%" />`
        : iconEmoji(m.userIcon);
      const timeStr = m.createdAt ? relativeTime(m.createdAt) : '';
      li.innerHTML = `
        <span class="cp-avatar">${avatar}</span>
        <span class="cp-main">
          <span class="cp-name"></span>
          <span class="cp-text"></span>
        </span>
        <span class="cp-time">${timeStr}</span>`;
      li.querySelector('.cp-name').textContent = m.userName || '가족';
      li.querySelector('.cp-text').textContent = m.text;
      peek.appendChild(li);
    }
  } catch {}
}

async function refreshChatUnread() {
  try {
    const r = await api('/api/chat/unread');
    const badge = $('chatUnreadBadge');
    if (!badge) return;
    if (r.unread > 0) {
      badge.textContent = r.unread > 99 ? '99+' : String(r.unread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

function renderChatMessages() {
  const ul = $('chatMessages');
  const emptyEl = $('chatEmpty');
  if (!ul) return;
  ul.innerHTML = '';
  if (!CHAT_MESSAGES.length) {
    emptyEl?.classList.remove('hidden');
    ul.style.display = 'none';
    return;
  }
  emptyEl?.classList.add('hidden');
  ul.style.display = '';

  // 그룹핑 기준: 같은 userId + 5분 이내 + 같은 날짜 → 연속 메시지
  const GROUP_GAP_MS = 5 * 60 * 1000;
  let prev = null;
  let lastDateKey = '';
  const items = [];

  for (let i = 0; i < CHAT_MESSAGES.length; i++) {
    const m = CHAT_MESSAGES[i];
    const next = CHAT_MESSAGES[i + 1];
    const d = m.createdAt ? new Date(m.createdAt) : new Date();
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    // 날짜 구분선
    if (dateKey !== lastDateKey) {
      const sep = document.createElement('li');
      sep.className = 'chat-divider';
      sep.textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      ul.appendChild(sep);
      lastDateKey = dateKey;
      prev = null; // 날짜 바뀌면 그룹 리셋
    }

    // 이 메시지가 앞 메시지와 연속인지 판단
    const sameAuthor = prev && prev.userId === m.userId;
    const withinGap = prev && m.createdAt && prev.createdAt &&
      (new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS);
    const isCont = sameAuthor && withinGap;
    const groupClass = isCont ? 'group-cont' : 'group-start';

    // 다음 메시지가 같은 그룹인지 (시간 숨김 조건용)
    const nextSameAuthor = next && next.userId === m.userId &&
      next.createdAt && m.createdAt &&
      (new Date(next.createdAt) - new Date(m.createdAt) < GROUP_GAP_MS);

    const li = document.createElement('li');
    li.className = 'chat-msg ' + groupClass +
      (m.userId === ME.id ? ' mine' : '') +
      (nextSameAuthor ? ' has-next-same-author' : '') +
      (m.pending ? ' sending' : '') +
      (m.failed ? ' failed' : '');
    li.dataset.mid = String(m.id);
    if (m.tempKey) li.dataset.temp = m.tempKey;

    const avatarInner = m.userPhoto
      ? `<img src="${m.userPhoto.replace(/"/g, '')}" alt="" style="width:36px;height:36px;object-fit:cover;display:block;border-radius:50%" />`
      : iconEmoji(m.userIcon);
    const hour = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    const timeStr = `${ampm} ${h12}:${mm}`;

    li.innerHTML = `
      <div class="chat-msg-avatar">${avatarInner}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name"></div>
        <div class="chat-bubble"></div>
        <div class="chat-msg-time">${timeStr}</div>
      </div>
      <button class="chat-msg-del hidden" aria-label="삭제" title="삭제">✕</button>`;
    li.querySelector('.chat-msg-name').textContent = m.userName || '';
    li.querySelector('.chat-bubble').textContent = m.text;

    // 실패한 메시지는 탭해서 재시도
    if (m.failed && m.tempKey) {
      li.onclick = () => retryChatMessage(m.tempKey);
      li.style.cursor = 'pointer';
    } else if ((m.userId === ME.id || ME.role === 'admin') && !m.pending) {
      const del = li.querySelector('.chat-msg-del');
      del.classList.remove('hidden');
      del.onclick = (e) => { e.stopPropagation(); deleteChatMessage(m.id); };
    }
    items.push(li);
    ul.appendChild(li);
    prev = m;
  }
}

function scrollChatToBottom(smooth = false) {
  const ul = $('chatMessages');
  if (!ul) return;
  ul.scrollTo({ top: ul.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

async function openChatSheet() {
  CHAT_SHEET_OPEN = true;
  $('chatSheet').classList.remove('hidden');
  // 활성 가족 수 subtitle
  const activeCount = (FAMILY_CACHE || []).filter((m) => m.activated).length;
  const sub = $('chatSubtitle');
  if (sub) sub.textContent = activeCount ? `${activeCount}명 참여 중` : '실시간으로 가족과 대화해요';
  // 초기 로드
  try {
    const list = await api('/api/chat?limit=50');
    CHAT_MESSAGES = list || [];
    if (CHAT_MESSAGES.length) {
      CHAT_OLDEST_ID = CHAT_MESSAGES[0].id;
      CHAT_LAST_ID = CHAT_MESSAGES[CHAT_MESSAGES.length - 1].id;
    }
    renderChatMessages();
    $('chatLoadOlderBtn').classList.toggle('hidden', CHAT_MESSAGES.length < 50);
    setTimeout(() => scrollChatToBottom(false), 50);
    markChatRead();
  } catch {}
  startChatPolling(4000);
  // 입력창 자동 포커스 (모바일 키보드는 사용자 탭 때문에 열려야 자연스러움 — focus 만 예약)
  setTimeout(() => {
    const input = $('chatInput');
    if (input && !/Mobi|Android/i.test(navigator.userAgent)) input.focus();
  }, 200);
  // 스크롤 감지 → 새 메시지 pill 관리
  setupChatScrollListener();
}

// 스크롤 위치에 따라 '새 메시지' pill 노출 판단용
let _chatNearBottom = true;
function setupChatScrollListener() {
  const ul = $('chatMessages');
  if (!ul || ul._chatScrollBound) return;
  ul._chatScrollBound = true;
  ul.addEventListener('scroll', () => {
    const nearBottom = (ul.scrollHeight - ul.scrollTop - ul.clientHeight) < 80;
    _chatNearBottom = nearBottom;
    if (nearBottom) $('chatNewMsgPill')?.classList.add('hidden');
  }, { passive: true });
}

function closeChatSheet() {
  CHAT_SHEET_OPEN = false;
  $('chatSheet').classList.add('hidden');
  stopChatPolling();
  loadChatPeek();       // 홈 미리보기 갱신
  refreshChatUnread();
}

function startChatPolling(intervalMs) {
  stopChatPolling();
  CHAT_POLL_TIMER = setInterval(pollChatNew, intervalMs);
}
function stopChatPolling() {
  if (CHAT_POLL_TIMER) { clearInterval(CHAT_POLL_TIMER); CHAT_POLL_TIMER = null; }
}

async function pollChatNew() {
  if (!CHAT_SHEET_OPEN) return;
  try {
    const after = CHAT_LAST_ID || 0;
    const list = await api(`/api/chat?after=${after}&limit=50`);
    if (list && list.length) {
      const ul = $('chatMessages');
      const nearBottom = ul && (ul.scrollHeight - ul.scrollTop - ul.clientHeight < 80);
      // 내 낙관적 메시지가 이미 큐에 있으면 서버 응답과 매칭해 id/createdAt 로 교체
      const serverIds = new Set(list.map(m => m.id));
      const newMsgs = list.filter((m) => !CHAT_MESSAGES.some((x) => x.id === m.id));
      if (newMsgs.length) {
        // 내 pending 메시지 중 텍스트가 일치하면 서버 응답으로 교체
        for (const sm of newMsgs) {
          if (sm.userId === ME.id) {
            const pendingIdx = CHAT_MESSAGES.findIndex((x) => x.pending && !x.failed && x.text === sm.text);
            if (pendingIdx >= 0) {
              CHAT_MESSAGES[pendingIdx] = sm;
              continue;
            }
          }
          CHAT_MESSAGES.push(sm);
        }
        CHAT_LAST_ID = list[list.length - 1].id;
        renderChatMessages();
        // 상대방이 보낸 새 메시지? (내 메시지는 자동 스크롤, 다른 사람건 near-bottom 일때만)
        const othersNew = newMsgs.some((m) => m.userId !== ME.id);
        if (nearBottom) {
          setTimeout(() => scrollChatToBottom(true), 20);
          $('chatNewMsgPill')?.classList.add('hidden');
        } else if (othersNew) {
          $('chatNewMsgPill')?.classList.remove('hidden');
        }
        markChatRead();
      }
    }
  } catch {}
}

async function loadOlderChat() {
  if (!CHAT_OLDEST_ID) return;
  const btn = $('chatLoadOlderBtn');
  if (btn) { btn.disabled = true; btn.textContent = '불러오는 중...'; }
  try {
    const list = await api(`/api/chat?before=${CHAT_OLDEST_ID}&limit=50`);
    if (list && list.length) {
      const ul = $('chatMessages');
      const prevHeight = ul.scrollHeight;
      CHAT_MESSAGES = list.concat(CHAT_MESSAGES);
      CHAT_OLDEST_ID = CHAT_MESSAGES[0].id;
      renderChatMessages();
      // 스크롤 위치 유지
      ul.scrollTop = ul.scrollHeight - prevHeight;
      if (list.length < 50) btn?.classList.add('hidden');
    } else {
      btn?.classList.add('hidden');
    }
  } catch {} finally {
    if (btn) { btn.disabled = false; btn.textContent = '이전 메시지 보기'; }
  }
}

async function sendChatMessage() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const sendBtn = $('chatSendBtn');
  // 낙관적 표시 — 서버 응답 기다리지 않고 즉시 말풍선 띄움
  const tempKey = 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const myPhotoUrl = (FAMILY_CACHE || []).find((m) => m.id === ME.id)?.photoUrl || null;
  const optimistic = {
    id: tempKey,                     // 임시 id (서버 응답 받으면 교체)
    tempKey,
    userId: ME.id,
    userName: ME.displayName,
    userIcon: ME.icon,
    userPhoto: myPhotoUrl,
    text,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  CHAT_MESSAGES.push(optimistic);
  renderChatMessages();
  // 입력창 리셋 + 포커스 유지
  input.value = '';
  input.style.height = '';
  if (sendBtn) sendBtn.disabled = true;
  setTimeout(() => scrollChatToBottom(true), 10);

  try {
    const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ text }) });
    // 서버 응답으로 pending 메시지 확정 (pollChatNew 가 잠시 후 더 풍부한 정보로 교체)
    const idx = CHAT_MESSAGES.findIndex((x) => x.tempKey === tempKey);
    if (idx >= 0) {
      CHAT_MESSAGES[idx] = {
        ...CHAT_MESSAGES[idx],
        id: res.id || CHAT_MESSAGES[idx].id,
        pending: false,
      };
      renderChatMessages();
    }
    // 즉시 폴링으로 서버 상태 동기화 (마지막 id 업데이트 등)
    if (res.id && res.id > CHAT_LAST_ID) CHAT_LAST_ID = res.id;
    pollChatNew();
  } catch (e) {
    // 실패한 메시지는 실패 표시 — 탭해서 재시도
    const idx = CHAT_MESSAGES.findIndex((x) => x.tempKey === tempKey);
    if (idx >= 0) {
      CHAT_MESSAGES[idx] = { ...CHAT_MESSAGES[idx], pending: false, failed: true };
      renderChatMessages();
    }
  }
}

async function retryChatMessage(tempKey) {
  const msg = CHAT_MESSAGES.find((x) => x.tempKey === tempKey);
  if (!msg || !msg.failed) return;
  msg.failed = false;
  msg.pending = true;
  renderChatMessages();
  try {
    const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ text: msg.text }) });
    const idx = CHAT_MESSAGES.findIndex((x) => x.tempKey === tempKey);
    if (idx >= 0) {
      CHAT_MESSAGES[idx] = { ...CHAT_MESSAGES[idx], id: res.id || CHAT_MESSAGES[idx].id, pending: false };
      renderChatMessages();
    }
    if (res.id && res.id > CHAT_LAST_ID) CHAT_LAST_ID = res.id;
    pollChatNew();
  } catch {
    const idx = CHAT_MESSAGES.findIndex((x) => x.tempKey === tempKey);
    if (idx >= 0) {
      CHAT_MESSAGES[idx] = { ...CHAT_MESSAGES[idx], pending: false, failed: true };
      renderChatMessages();
    }
  }
}

async function deleteChatMessage(id) {
  const ok = await showConfirm({
    title: '메시지 삭제',
    message: '이 메시지를 삭제할까요?',
    confirmLabel: '삭제',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/chat/${id}`, { method: 'DELETE' });
    CHAT_MESSAGES = CHAT_MESSAGES.filter((m) => m.id !== id);
    renderChatMessages();
  } catch (e) {
    alert(e.status === 403 ? '삭제 권한이 없어요' : '삭제 실패');
  }
}

async function markChatRead() {
  if (!CHAT_LAST_ID) return;
  try {
    await api('/api/chat/read', { method: 'POST', body: JSON.stringify({ lastId: CHAT_LAST_ID }) });
    refreshChatUnread();
  } catch {}
}

$('chatOpenBtn')?.addEventListener('click', openChatSheet);
$('chatCard')?.addEventListener('click', (e) => {
  // 카드 본문 클릭도 열림 (헤더 버튼 제외)
  if (e.target.closest('.ufi-btn')) return;
  if (e.target === $('chatCard') || e.target.closest('.chat-peek')) openChatSheet();
});
$('chatSheetClose')?.addEventListener('click', closeChatSheet);
$('chatSheet')?.addEventListener('click', (e) => {
  if (e.target.id === 'chatSheet') closeChatSheet();
});
$('chatLoadOlderBtn')?.addEventListener('click', loadOlderChat);
$('chatForm')?.addEventListener('submit', (e) => { e.preventDefault(); sendChatMessage(); });
$('chatInput')?.addEventListener('input', (e) => {
  // 자동 높이
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px';
  // 전송 버튼 enable/disable (내용 있을 때만)
  const sendBtn = $('chatSendBtn');
  if (sendBtn) sendBtn.disabled = !e.target.value.trim();
});
// 새 메시지 pill 탭 → 바닥으로 스크롤
$('chatNewMsgPill')?.addEventListener('click', () => {
  scrollChatToBottom(true);
  $('chatNewMsgPill')?.classList.add('hidden');
});
$('chatInput')?.addEventListener('keydown', (e) => {
  // Enter 로 전송 (Shift+Enter 는 줄바꿈). 모바일에선 키보드의 엔터라 신중히.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !/Mobi|Android/i.test(navigator.userAgent)) {
    e.preventDefault();
    sendChatMessage();
  }
});

// 홈 화면용 백그라운드 폴링 (30초)
setInterval(() => {
  if (!ME) return;
  if (CHAT_SHEET_OPEN) return;  // 시트 열렸을 땐 전용 폴링이 이미 빠르게 돌고 있음
  refreshChatUnread();
  loadChatPeek();
}, 30000);

boot();
