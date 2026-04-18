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


function renderAccount() {
  $('accountAvatar').textContent = iconEmoji(ME.icon);
  $('accountName').textContent = `${ME.displayName}님으로 로그인 중`;
  $('accountMeta').textContent = `${ME.familyName || ''} (${ME.role === 'admin' ? '관리자' : '가족'})`;
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

// ---------- 빠른 연락처 ----------
async function loadEmergencyContacts() {
  try {
    const list = await api('/api/emergency');
    const box = $('sosList');
    box.innerHTML = '';
    if (!list.length) { $('sosCard').classList.add('hidden'); return; }
    for (const c of list) {
      const a = document.createElement('a');
      a.className = 'sos-btn';
      a.href = `tel:${c.phone.replace(/[^0-9+*#]/g, '')}`;
      a.innerHTML = `
        <span class="sos-emoji">${iconEmoji(c.icon)}</span>
        <span class="sos-info">
          <span class="sos-name"></span>
          <span class="sos-phone"></span>
        </span>
        <span class="sos-arrow">📞</span>`;
      a.querySelector('.sos-name').textContent = c.name;
      a.querySelector('.sos-phone').textContent = c.phone;
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
          <button class="user-del" title="삭제">✕</button>
        </div>`;
      li.querySelector('.user-name').textContent = c.name;
      li.querySelector('.user-sub').textContent = c.phone;
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
      <span class="mood-chip-emoji">${iconEmoji(m.icon)}</span>
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
    if (isToday) cell.classList.add('is-today');
    if (bdPeople) cell.classList.add('is-birthday');
    cell.innerHTML = `
      <span class="cal-day">${d}</span>
      ${bdPeople ? `<span class="cal-bd">${bdPeople.slice(0,3).map((p) => iconEmoji(p.icon)).join('')}</span>` : ''}
    `;
    if (bdPeople) {
      cell.title = bdPeople.map((p) => p.displayName + '님 생일').join(', ');
      cell.onclick = () => alert(bdPeople.map((p) => `${iconEmoji(p.icon)} ${p.displayName}님 생일 (${m + 1}월 ${d}일)`).join('\n'));
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
    renderCalendar(); // 가족 데이터 로드 후 달력 생일 표시
    $('familyCardTitle').textContent = r.family.displayName || '우리 가족';
    const row = $('familyRow');
    row.innerHTML = '';
    for (const m of r.members) {
      const age = koreanAge(m.birthYear, m.birthMonth, m.birthDay);
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

let CURRENT_PROFILE_USER = null;
function openProfileSheet(m) {
  CURRENT_PROFILE_USER = m;
  const age = koreanAge(m.birthYear, m.birthMonth, m.birthDay);
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

  // 전화걸기 버튼
  const callBtn = $('profCallBtn');
  if (m.phone && m.id !== ME.id) {
    callBtn.href = `tel:${m.phone.replace(/[^0-9+]/g, '')}`;
    callBtn.textContent = `📞 ${m.displayName}님에게 전화`;
    callBtn.classList.remove('hidden');
  } else {
    callBtn.classList.add('hidden');
  }

  // 응원 스티커 섹션
  updateProfileStickerSections(m);

  // 기분 7일 히스토리
  loadProfileMoodWeek(m.id);

  $('profileSheet').classList.remove('hidden');
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
          <span class="reveal-emoji">${iconEmoji(m.author_icon)}</span>
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
    $('wCity').textContent = `${w.city} 오늘`;
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
}

function renderHourly(hourly) {
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

  // 검색창은 메모 5개 이상일 때만 표시
  if (list.length >= 5) searchEl.classList.remove('hidden');
  else searchEl.classList.add('hidden');

  const q = MEMO_QUERY;
  let filtered = q ? list.filter((m) => (m.content || '').toLowerCase().includes(q)) : list;
  // 정렬 (완료/미완료 분리는 기존대로 유지하지만 각 섹션 내부에서 정렬 적용)
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
      li.querySelector('.memo-author-avatar').textContent = iconEmoji(m.created_by_icon);
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
document.querySelectorAll('.memo-template').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.text;
    $('memoInput').value = text;
    $('memoInput').focus();
    const n = text.length;
    $('memoInput').setSelectionRange(n, n);
  });
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
  await api('/api/memos', { method: 'POST', body: JSON.stringify({ content: v, dueDate }) });
  $('memoInput').value = '';
  // 기한 리셋
  MEMO_DUE_DAYS = 'none';
  document.querySelectorAll('.due-btn').forEach((x) => x.classList.remove('active'));
  document.querySelector('.due-btn[data-days="none"]')?.classList.add('active');
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
        <span class="zodiac-emoji">${iconEmoji(z.icon)}</span>
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
  'notice','upcoming','family','birthday','weather','tips',
  'reveal','question','zodiac','fx','calc','memo','account'
];
function loadCardOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem('fb_card_order') || 'null');
    if (!Array.isArray(saved)) return DEFAULT_CARD_ORDER.slice();
    // 누락된 카드 뒤에 추가
    for (const k of DEFAULT_CARD_ORDER) if (!saved.includes(k)) saved.push(k);
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

// 도움말 시트
$('helpBtn').addEventListener('click', () => $('helpSheet').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpSheet').classList.add('hidden'));
$('helpSheet').addEventListener('click', (e) => {
  if (e.target.id === 'helpSheet') $('helpSheet').classList.add('hidden');
});

// 초회 자동 노출 (1회)
setTimeout(() => {
  if (!localStorage.getItem('fb_help_seen') && ME) {
    $('helpSheet').classList.remove('hidden');
    localStorage.setItem('fb_help_seen', '1');
  }
}, 1500);

async function loadFamilyInfo() {
  try {
    const f = await api('/api/family');
    $('famAlias').value = f.alias || '';
    $('famName').value = f.displayName || '';
    $('famNotice').value = f.notice || '';
  } catch {}
}

async function loadFamilyNotice() {
  try {
    const f = await api('/api/family');
    if (f.notice) {
      $('noticeText').textContent = f.notice;
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
        <span class="user-emoji">${iconEmoji(u.icon)}</span>
        <div class="user-main">
          <div class="user-name"></div>
          <div class="user-sub">${u.role === 'admin' ? '관리자' : '가족'} · ${dob}${status}</div>
        </div>
        <div class="user-actions">
          <button class="ufi-btn user-edit" title="편집">✏️</button>
          <button class="ufi-btn user-reinvite" title="초대 링크 재발급">🔗</button>
          <button class="user-del" title="삭제"${u.id === ME.id ? ' disabled' : ''}>✕</button>
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
function speakText(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch {}
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

// ---------- 오늘의 가족 질문 ----------
async function loadTodayQuestion() {
  try {
    const q = await api('/api/question/today');
    $('questionText').textContent = q.question;
    $('questionAnswer').value = q.myAnswer || '';
    $('questionMeta').textContent =
      `${q.answeredCount} / ${q.memberCount}명이 답했어요. 모든 답변은 내일 공개돼요`;
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
        div.innerHTML = `<span class="q-chip-emoji">${iconEmoji(m.icon)}</span><span class="q-chip-name"></span>`;
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
      li.innerHTML = `
        <span class="reveal-emoji">${iconEmoji(a.icon)}</span>
        <div class="reveal-body">
          <div class="reveal-head">
            <span class="reveal-name"></span>
            ${timeLabel ? `<span class="reveal-time">${timeLabel}</span>` : ''}
          </div>
          <div class="reveal-answer ${skipped ? 'skipped' : ''}"></div>
          <div class="reaction-row"></div>
        </div>`;
      li.querySelector('.reveal-name').textContent = a.display_name + '님';
      li.querySelector('.reveal-answer').textContent = skipped ? '🌙 건너뛰었어요' : a.answer_text;
      if (!skipped) renderReactionRow(li.querySelector('.reaction-row'), a.answer_id, a.reactions || []);
      ul.appendChild(li);
    }
    $('revealCard').classList.remove('hidden');
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
    const answers = HISTORY_FILTER === 'mine'
      ? item.answers.filter((a) => a.display_name === ME.displayName)
      : item.answers;
    if (HISTORY_FILTER === 'mine' && !answers.length) continue;
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

$('qHistoryBtn').addEventListener('click', async () => {
  try {
    const list = await api('/api/question/history?limit=30');
    HISTORY_CACHE = list;
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
  $('edPhone').value = u.phone || '';
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
  if (!banner || !btn) return;

  let deferredPrompt = null;
  const DISMISS_KEY = 'fb_install_dismissed';
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed) return;

  closeBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem(DISMISS_KEY, '1');
  });

  // 이미 홈화면에 추가된 경우 감지
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    return;
  }

  // Chrome / Edge / Android
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
      localStorage.setItem(DISMISS_KEY, '1');
    } else {
      // iOS 안내
      alert('사파리 하단의 "공유" → "홈 화면에 추가" 를 눌러 주세요.');
      localStorage.setItem(DISMISS_KEY, '1');
      banner.classList.add('hidden');
    }
  });

  // iOS Safari (no beforeinstallprompt)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone;
  if (isIos && !isStandalone) {
    btn.textContent = '안내 보기';
    sub.textContent = 'iPhone은 공유 버튼에서 추가할 수 있어요';
    setTimeout(() => banner.classList.remove('hidden'), 4000);
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

boot();
