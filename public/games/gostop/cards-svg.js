// 화투 SVG 카드 — 전통 색감·월별 식물·타입별 디자인
// 실제 회화풍은 아니지만 실물 화투 느낌(검은 테두리·붉은 배경·금색 광·띠 색띠)을 재현.
(function (global) {
  'use strict';

  // 월별: 배경 베이스 / 식물(line paths) / 학·새 등 동물 / 광 서브(해·달 등)
  // 화투 실물에선 각 월이 고유 풍경을 가짐. 여기서도 월마다 다른 실루엣 사용.
  const MONTH = {
    1:  { base: '#FFF1D6', pine: true,     sun: '#D94A2C' }, // 송학 (붉은 해)
    2:  { base: '#FFE8C4', plum: true },                      // 매조
    3:  { base: '#FFE1EE', cherry: true,   curtain: '#B23346' }, // 벚꽃 + 만막
    4:  { base: '#F3EAD4', wisteria: true },                  // 흑싸리(등나무)
    5:  { base: '#D9EFD9', iris: true },                      // 난초(붓꽃)
    6:  { base: '#F0E3F7', peony: true },                     // 모란
    7:  { base: '#FDE4D6', bushclover: true },                // 홍싸리
    8:  { base: '#FFF4C2', mountain: true, moon: true },      // 공산
    9:  { base: '#FFF2A8', chrysanthemum: true },             // 국화
    10: { base: '#FFDCCE', maple: true },                     // 단풍
    11: { base: '#E9E3F5', paulownia: true },                 // 오동
    12: { base: '#D9E8F5', rain: true },                      // 비
  };

  const TYPE = {
    light:  { color: '#F5C842', text: '光',  fg: '#5A3D00', label: '광' },
    animal: { color: '#3B78D8', text: '열끗', fg: '#FFFFFF', label: '열끗' },
    ribbon: { color: '#D94A52', text: '',     fg: '#FFFFFF', label: '띠' },
    junk:   { color: '#6B7280', text: '피',  fg: '#FFFFFF', label: '피' },
  };

  // 띠 카드별 띠 색 (홍단·청단·초단)
  const RIBBON_COLOR = {
    '송학 홍단':  '#D94A52', '벚꽃 홍단': '#D94A52', '매조 홍단': '#D94A52',
    '모란 청단':  '#2C5BA0', '국화 청단': '#2C5BA0', '단풍 청단': '#2C5BA0',
    '흑싸리 초단':'#3F8C3F', '난초 초단':  '#3F8C3F', '홍싸리 초단':'#3F8C3F',
    '비 띠':      '#D94A52',
  };

  // ---- 월별 식물/풍경 SVG 조각 ----
  function pine() {
    return '<path d="M30 120 L30 60 M30 60 L22 70 M30 60 L38 70 M30 75 L24 82 M30 75 L36 82 M30 90 L25 98 M30 90 L35 98" stroke="#3D5A2E" stroke-width="2.5" stroke-linecap="round" fill="none"/>' +
           '<circle cx="30" cy="58" r="8" fill="#5C7F3F"/><circle cx="22" cy="66" r="5" fill="#5C7F3F"/><circle cx="38" cy="66" r="5" fill="#5C7F3F"/>';
  }
  function plum() {
    return '<path d="M50 105 Q55 80 50 55" stroke="#4A2E1A" stroke-width="2" fill="none"/>' +
           '<circle cx="50" cy="62" r="5" fill="#E85CA1"/><circle cx="58" cy="70" r="4" fill="#E85CA1"/><circle cx="42" cy="72" r="4" fill="#E85CA1"/><circle cx="52" cy="82" r="3" fill="#E85CA1"/>';
  }
  function cherry() {
    return '<g transform="translate(50 70)">' +
           '<circle r="6" fill="#FFB3CB"/><circle cx="-10" cy="-4" r="5" fill="#FFB3CB"/><circle cx="10" cy="-4" r="5" fill="#FFB3CB"/><circle cx="-6" cy="10" r="5" fill="#FFB3CB"/><circle cx="6" cy="10" r="5" fill="#FFB3CB"/><circle r="2.5" fill="#E74B89"/>' +
           '</g>';
  }
  function curtain(color) {
    return '<rect x="10" y="38" width="80" height="12" fill="' + color + '"/>' +
           '<path d="M20 50 L26 64 L32 50 M38 50 L44 64 L50 50 M56 50 L62 64 L68 50 M74 50 L80 64 L86 50" stroke="' + color + '" stroke-width="2.5" fill="none"/>';
  }
  function wisteria() {
    return '<path d="M50 40 Q48 70 50 100" stroke="#6B4F2A" stroke-width="2" fill="none"/>' +
           '<ellipse cx="50" cy="80" rx="10" ry="16" fill="#7C54A6" opacity=".85"/>' +
           '<circle cx="44" cy="74" r="2.5" fill="#9B74C4"/><circle cx="56" cy="74" r="2.5" fill="#9B74C4"/><circle cx="50" cy="88" r="2.5" fill="#9B74C4"/>';
  }
  function iris() {
    return '<path d="M50 112 L50 60" stroke="#3F6B3F" stroke-width="2.5"/>' +
           '<path d="M50 60 Q40 50 36 40 M50 60 Q60 50 64 40 M50 60 L50 48" stroke="#6B3FA0" stroke-width="3" fill="none" stroke-linecap="round"/>' +
           '<circle cx="50" cy="50" r="5" fill="#9B74C4"/>';
  }
  function peony() {
    return '<g transform="translate(50 68)">' +
           '<circle r="14" fill="#E34A7C"/><circle r="9" fill="#FFB3CB"/><circle r="4" fill="#E34A7C"/>' +
           '<path d="M-14 8 Q-20 2 -16 -6 M14 8 Q20 2 16 -6" stroke="#3F6B3F" stroke-width="3" fill="none"/>' +
           '</g>';
  }
  function bushclover() {
    return '<path d="M50 105 Q48 80 52 55" stroke="#4A2E1A" stroke-width="2" fill="none"/>' +
           '<g fill="#D13C5A">' +
           '<circle cx="44" cy="70" r="3"/><circle cx="56" cy="75" r="3"/><circle cx="42" cy="85" r="3"/><circle cx="58" cy="90" r="3"/><circle cx="48" cy="62" r="3"/>' +
           '</g>';
  }
  function mountain() {
    return '<path d="M8 100 L30 60 L50 90 L72 50 L92 100 Z" fill="#5D4E3A" opacity=".9"/>' +
           '<path d="M30 60 L40 75 L50 60 L60 75" fill="#3F352A" opacity=".7"/>';
  }
  function chrysanthemum() {
    return '<g transform="translate(50 68)">' +
           (function () {
             var s = '';
             for (var i = 0; i < 12; i++) {
               var a = (i * 30) * Math.PI / 180;
               var x = Math.cos(a) * 11, y = Math.sin(a) * 11;
               s += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="4" ry="7" transform="rotate(' + (i * 30) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="#F0B833"/>';
             }
             return s;
           })() +
           '<circle r="6" fill="#B8832A"/>' +
           '</g>';
  }
  function maple() {
    return '<g transform="translate(50 68)" fill="#C43B2C">' +
           '<path d="M0 -16 L4 -6 L14 -8 L8 0 L16 6 L6 8 L8 18 L0 12 L-8 18 L-6 8 L-16 6 L-8 0 L-14 -8 L-4 -6 Z"/>' +
           '</g>';
  }
  function paulownia() {
    return '<path d="M50 105 Q50 80 50 55" stroke="#6B4F2A" stroke-width="2" fill="none"/>' +
           '<g fill="#9B74C4">' +
           '<ellipse cx="44" cy="62" rx="4" ry="6"/><ellipse cx="56" cy="62" rx="4" ry="6"/>' +
           '<ellipse cx="40" cy="74" rx="4" ry="6"/><ellipse cx="60" cy="74" rx="4" ry="6"/>' +
           '<ellipse cx="50" cy="82" rx="4" ry="6"/>' +
           '</g>';
  }
  function rain() {
    return '<g stroke="#3A6DA0" stroke-width="2" fill="none" stroke-linecap="round">' +
           '<path d="M20 50 L15 90 M32 50 L27 90 M44 50 L39 90 M56 50 L51 90 M68 50 L63 90 M80 50 L75 90"/>' +
           '</g>';
  }
  function sun(color) {
    return '<circle cx="76" cy="28" r="11" fill="' + color + '"/>';
  }
  function moon() {
    return '<circle cx="72" cy="32" r="13" fill="#FFF5CC" stroke="#E6C15A" stroke-width="1.5"/>';
  }

  // ---- 동물/사람 (열끗 전용) ----
  const ANIMAL_EMOJI = {
    '매조 열끗': '🐦',    // 매조에 휘파람새
    '흑싸리 열끗': '🐦',  // 흑싸리에 두견
    '난초 열끗': '🦋',    // 난초에 나비
    '모란 열끗': '🦋',    // 모란에 나비
    '홍싸리 열끗': '🐗',  // 홍싸리에 멧돼지
    '공산 열끗': '🐦',    // 공산에 기러기
    '국화 열끗': '🍶',    // 국화에 술잔
    '단풍 열끗': '🦌',    // 단풍에 사슴
    '비 열끗': '🦅',       // 비에 제비
  };

  function plantOf(card) {
    const m = MONTH[card.month];
    let s = '';
    if (m.pine) s += pine();
    if (m.plum) s += plum();
    if (m.cherry) s += cherry();
    if (m.curtain) s += curtain(m.curtain);
    if (m.wisteria) s += wisteria();
    if (m.iris) s += iris();
    if (m.peony) s += peony();
    if (m.bushclover) s += bushclover();
    if (m.mountain) s += mountain();
    if (m.chrysanthemum) s += chrysanthemum();
    if (m.maple) s += maple();
    if (m.paulownia) s += paulownia();
    if (m.rain) s += rain();
    if (m.sun) s += sun(m.sun);
    if (m.moon) s += moon();
    return s;
  }

  function typeBadge(card) {
    const t = TYPE[card.type];
    // 광: 금색 원에 光 한자
    if (card.type === 'light') {
      return '<circle cx="82" cy="140" r="13" fill="' + t.color + '" stroke="#8A6B1C" stroke-width="1.5"/>' +
             '<text x="82" y="146" text-anchor="middle" font-size="16" font-weight="900" fill="' + t.fg + '" font-family="serif">' + t.text + '</text>';
    }
    // 띠: 카드 가로지르는 색띠 + 특이 문자 (홍단/청단/초단)
    if (card.type === 'ribbon') {
      const ribbonColor = RIBBON_COLOR[card.label] || '#D94A52';
      const danLabel = (card.label.indexOf('홍단') >= 0) ? '홍단'
                     : (card.label.indexOf('청단') >= 0) ? '청단'
                     : (card.label.indexOf('초단') >= 0) ? '초단' : '';
      const danText = danLabel
        ? '<text x="50" y="123" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">' + danLabel + '</text>'
        : '';
      return '<rect x="6" y="108" width="88" height="20" rx="3" fill="' + ribbonColor + '" />' + danText;
    }
    // 피: 우하단 작은 타원
    if (card.type === 'junk') {
      const mark = card.doubleJunk
        ? '<text x="80" y="148" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">쌍</text>'
        : '';
      return '<rect x="65" y="132" width="25" height="18" rx="4" fill="#6B7280" opacity=".9"/>' +
             '<text x="77.5" y="145" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">피</text>' + mark;
    }
    // 열끗
    return '<rect x="60" y="132" width="32" height="18" rx="4" fill="' + t.color + '" opacity=".95"/>' +
           '<text x="76" y="145" text-anchor="middle" font-size="9" font-weight="800" fill="' + t.fg + '">열끗</text>';
  }

  function animalOverlay(card) {
    if (card.type !== 'animal') return '';
    const emoji = ANIMAL_EMOJI[card.label] || '🦋';
    return '<text x="50" y="55" text-anchor="middle" font-size="28" dominant-baseline="middle">' + emoji + '</text>';
  }

  function cardSvg(card, opts) {
    opts = opts || {};
    if (opts.faceDown) return faceDownSvg();
    const m = MONTH[card.month];
    const hi  = opts.highlight ? '<rect x="0" y="0" width="100" height="160" rx="12" ry="12" fill="#FFF7A8" fill-opacity=".45"/>' : '';
    const sel = opts.selected ? '<rect x="2" y="2" width="96" height="156" rx="10" ry="10" fill="none" stroke="#0A84FF" stroke-width="3"/>' : '';
    return '' +
      '<svg viewBox="0 0 100 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="hwa-card" data-id="' + card.id + '">' +
        // 배경 — 크림/미색 베이스 + 내부 테두리
        '<rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="' + m.base + '" stroke="#3A2418" stroke-width="2"/>' +
        '<rect x="4" y="4" width="92" height="152" rx="7" ry="7" fill="none" stroke="#3A2418" stroke-width="1" stroke-opacity=".35"/>' +
        // 월 숫자 (좌상단)
        '<text x="10" y="19" font-size="11" font-weight="800" fill="#3A2418" opacity=".55">' + card.month + '月</text>' +
        // 중앙 식물/풍경
        plantOf(card) +
        // 열끗이면 동물 아이콘
        animalOverlay(card) +
        // 타입별 뱃지
        typeBadge(card) +
        hi + sel +
      '</svg>';
  }

  function faceDownSvg() {
    return '' +
      '<svg viewBox="0 0 100 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="hwa-card face-down">' +
        '<defs>' +
          '<pattern id="backPat" width="12" height="12" patternUnits="userSpaceOnUse">' +
            '<rect width="12" height="12" fill="#7D1F1F"/>' +
            '<path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#9B2A2A"/>' +
          '</pattern>' +
        '</defs>' +
        '<rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="url(#backPat)" stroke="#3A0808" stroke-width="2"/>' +
        '<rect x="8" y="12" width="84" height="136" rx="6" ry="6" fill="none" stroke="rgba(255,220,150,.5)" stroke-width="1" stroke-dasharray="3 3"/>' +
        '<text x="50" y="88" text-anchor="middle" font-size="36" fill="#FFD166" font-weight="900" font-family="serif">花</text>' +
      '</svg>';
  }

  function renderCard(card, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'hwa-card-wrap';
    if (card) wrap.dataset.id = String(card.id);
    if (opts.selected) wrap.classList.add('is-selected');
    if (opts.faceDown) wrap.classList.add('is-facedown');
    if (opts.highlight) wrap.classList.add('is-highlight');
    wrap.innerHTML = opts.faceDown ? faceDownSvg() : cardSvg(card, opts);
    return wrap;
  }

  global.GostopCards = { cardSvg: cardSvg, faceDownSvg: faceDownSvg, renderCard: renderCard };
})(typeof self !== 'undefined' ? self : this);
