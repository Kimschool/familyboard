// 화투 48장 SVG 카드 — 프로그래밍 방식 생성 (MVP: 심플·상징적 디자인)
// 실제 회화풍 아트는 후속 작업. 지금은 월별 색 + 식물 심볼 + 타입 뱃지로 판독성 확보.

// 월별 테마 (배경 그라데이션 · 대표 식물·상징 · 이모지)
const MONTH_THEME = {
  1:  { name: '1월 송학',   bg1: '#FDE8E8', bg2: '#FCC5C5', icon: '🌸',  accent: '#C0392B' }, // 소나무/학
  2:  { name: '2월 매조',   bg1: '#FDF1E8', bg2: '#F7D9B5', icon: '🌺',  accent: '#D35400' },
  3:  { name: '3월 벚꽃',   bg1: '#FCE7F3', bg2: '#F8BBD9', icon: '🌸',  accent: '#E91E63' },
  4:  { name: '4월 흑싸리', bg1: '#E8E3D3', bg2: '#CBC0A2', icon: '🌿',  accent: '#57534E' },
  5:  { name: '5월 난초',   bg1: '#E3F2E9', bg2: '#BEE0C6', icon: '🌱',  accent: '#2D7D46' },
  6:  { name: '6월 모란',   bg1: '#F9E8FD', bg2: '#E4BCF3', icon: '🌷',  accent: '#8E44AD' },
  7:  { name: '7월 홍싸리', bg1: '#FCE8E3', bg2: '#F2B9A8', icon: '🍀',  accent: '#C0392B' },
  8:  { name: '8월 공산',   bg1: '#FFF7D6', bg2: '#FFE58A', icon: '🌕',  accent: '#B7851E' },
  9:  { name: '9월 국화',   bg1: '#FDF5C4', bg2: '#F9E07A', icon: '🌻',  accent: '#A87000' },
  10: { name: '10월 단풍',  bg1: '#FDE2D8', bg2: '#F9B59E', icon: '🍁',  accent: '#BF360C' },
  11: { name: '11월 오동',  bg1: '#EDE7F6', bg2: '#C5B8E0', icon: '🌸',  accent: '#5E3A9A' },
  12: { name: '12월 비',    bg1: '#E3F2FD', bg2: '#AFCFE8', icon: '☔',  accent: '#1565C0' },
};

// 타입별 배지 라벨/컬러 (광·열끗·띠·피)
const TYPE_BADGE = {
  light:  { label: '광',   color: '#FFD84D', fg: '#7A5D00' },
  animal: { label: '열끗', color: '#60A5FA', fg: '#082F5A' },
  ribbon: { label: '띠',   color: '#F87171', fg: '#5A0808' },
  junk:   { label: '피',   color: '#E5E7EB', fg: '#111827' },
};

/**
 * 카드 한 장을 SVG 문자열로 생성.
 * 표준 세로 카드 비율(5 : 8). viewBox 100×160.
 * @param {object} card  { id, month, type, doubleJunk, label }
 * @param {object} opts  { selected, highlight, faceDown }
 */
export function cardSvg(card, opts = {}) {
  const t = MONTH_THEME[card.month];
  const b = TYPE_BADGE[card.type];
  if (opts.faceDown) return faceDownSvg();
  const sel = opts.selected ? `<rect x="2" y="2" width="96" height="156" rx="10" ry="10" fill="none" stroke="#0A84FF" stroke-width="3" />` : '';
  const hi  = opts.highlight ? `<rect x="0" y="0" width="100" height="160" rx="12" ry="12" fill="#FFF7A8" fill-opacity=".4" />` : '';
  const doubleMark = card.doubleJunk ? `<text x="50" y="138" text-anchor="middle" font-size="11" font-weight="700" fill="${b.fg}">쌍</text>` : '';
  return `
  <svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" class="hwa-card" data-id="${card.id}">
    <defs>
      <linearGradient id="gM${card.month}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${t.bg1}"/>
        <stop offset="1" stop-color="${t.bg2}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="url(#gM${card.month})" stroke="${t.accent}" stroke-width="1.5"/>
    ${hi}
    <text x="8" y="20" font-size="14" font-weight="800" fill="${t.accent}" font-family="system-ui, sans-serif">${card.month}</text>
    <text x="92" y="20" font-size="14" text-anchor="end">${t.icon}</text>
    <text x="50" y="88" text-anchor="middle" font-size="44" dominant-baseline="middle">${t.icon}</text>
    <rect x="8" y="132" width="30" height="18" rx="9" ry="9" fill="${b.color}" />
    <text x="23" y="146" text-anchor="middle" font-size="12" font-weight="800" fill="${b.fg}">${b.label}</text>
    ${doubleMark}
    ${sel}
  </svg>`;
}

function faceDownSvg() {
  return `
  <svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" class="hwa-card face-down">
    <defs>
      <pattern id="backPat" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#7D1F1F"/>
        <path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#9B2A2A" />
      </pattern>
    </defs>
    <rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="url(#backPat)" stroke="#3A0808" stroke-width="1.5"/>
    <rect x="8" y="12" width="84" height="136" rx="6" ry="6" fill="none" stroke="rgba(255,220,150,.55)" stroke-width="1" stroke-dasharray="4 3" />
    <text x="50" y="88" text-anchor="middle" font-size="36" fill="#FFD166" font-weight="900" font-family="serif">花</text>
  </svg>`;
}

// HTMLElement 래퍼 (카드 클릭 핸들러 붙이기 쉽게)
export function renderCard(card, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hwa-card-wrap';
  wrap.dataset.id = String(card.id);
  if (opts.selected) wrap.classList.add('is-selected');
  if (opts.faceDown) wrap.classList.add('is-facedown');
  wrap.innerHTML = cardSvg(card, opts);
  return wrap;
}
