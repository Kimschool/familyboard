// 화투 카드 렌더러 — Wikimedia 퍼블릭 도메인 PNG 를 우선 사용,
// 파일 없을 때는 코드로 그린 SVG 로 폴백.
(function (global) {
  'use strict';

  // id → Wikimedia 에서 받은 파일명 (01_Hikari.png 식)
  const FILE_OF = [
    null,
    '01_Hikari','01_Tanzaku','01_Kasu_1','01_Kasu_2',
    '02_Tane','02_Tanzaku','02_Kasu_1','02_Kasu_2',
    '03_Hikari','03_Tanzaku','03_Kasu_1','03_Kasu_2',
    '04_Tane','04_Tanzaku','04_Kasu_1','04_Kasu_2',
    '05_Tane','05_Tanzaku','05_Kasu_1','05_Kasu_2',
    '06_Tane','06_Tanzaku','06_Kasu_1','06_Kasu_2',
    '07_Tane','07_Tanzaku','07_Kasu_1','07_Kasu_2',
    '08_Hikari','08_Tane','08_Kasu_1','08_Kasu_2',
    '09_Tane','09_Tanzaku','09_Kasu_1','09_Kasu_2',
    '10_Tane','10_Tanzaku','10_Kasu_1','10_Kasu_2',
    '11_Hikari','11_Kasu_1','11_Kasu_2','11_Kasu_3',
    '12_Hikari','12_Tane','12_Tanzaku','12_Kasu',
  ];

  // 폴백 SVG 를 위한 월별 테마 (간략화)
  const THEME = {
    1:'#FFF1D6',2:'#FFE8C4',3:'#FFE1EE',4:'#F3EAD4',5:'#D9EFD9',6:'#F0E3F7',
    7:'#FDE4D6',8:'#FFF4C2',9:'#FFF2A8',10:'#FFDCCE',11:'#E9E3F5',12:'#D9E8F5',
  };
  const TYPE_LABEL = { light:'광', animal:'열끗', ribbon:'띠', junk:'피' };

  function fallbackSvg(card) {
    card = card || {};
    const m = Number(card.month);
    const validMonth = Number.isFinite(m) && m >= 1 && m <= 12;
    const bg = (validMonth && THEME[m]) || '#FAF3E3';
    const label = TYPE_LABEL[card.type] || '';
    const dbl = card.doubleJunk ? '쌍' : '';
    // ★ month 가 0/null/undefined/범위 밖일 때 "0月" 같은 깨진 표기 보이던 버그 수정.
    //    유효 월일 때만 라벨 표시, 아니면 빈 문자열.
    const monthText = validMonth ? (m + '月') : '';
    return (
      '<svg viewBox="0 0 100 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="0" width="100" height="160" rx="10" fill="' + bg + '" stroke="#3A2418" stroke-width="2"/>' +
        (monthText ? '<text x="10" y="22" font-size="13" font-weight="800" fill="#3A2418" opacity=".6">' + monthText + '</text>' : '') +
        '<text x="50" y="90" text-anchor="middle" font-size="40" fill="#3A2418" font-weight="800">' + label + '</text>' +
        (dbl ? '<text x="50" y="130" text-anchor="middle" font-size="18" fill="#C0392B" font-weight="900">' + dbl + '</text>' : '') +
      '</svg>'
    );
  }

  function cardSvg(card, opts) {
    // 라이브러리에 남겨 둔 이전 코드 호환용 — 문자열 반환
    opts = opts || {};
    if (opts.faceDown) return faceDownSvg();
    return fallbackSvg(card);
  }

  function faceDownSvg() {
    return (
      '<svg viewBox="0 0 100 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="hwa-card face-down">' +
        '<defs>' +
          '<pattern id="backPat" width="12" height="12" patternUnits="userSpaceOnUse">' +
            '<rect width="12" height="12" fill="#7D1F1F"/>' +
            '<path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#9B2A2A"/>' +
          '</pattern>' +
        '</defs>' +
        '<rect x="0" y="0" width="100" height="160" rx="10" fill="url(#backPat)" stroke="#3A0808" stroke-width="2"/>' +
        '<text x="50" y="88" text-anchor="middle" font-size="36" fill="#FFD166" font-weight="900" font-family="serif">花</text>' +
      '</svg>'
    );
  }

  // HTMLElement 래퍼 — <img> 우선, 실패 시 SVG 폴백
  function renderCard(card, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'hwa-card-wrap';
    if (opts.selected) wrap.classList.add('is-selected');
    if (opts.faceDown) wrap.classList.add('is-facedown');
    if (opts.highlight) wrap.classList.add('is-highlight');

    if (opts.faceDown) {
      wrap.innerHTML = faceDownSvg();
      return wrap;
    }
    wrap.dataset.id = String(card.id);

    const file = FILE_OF[card.id];
    const dbl = card.doubleJunk ? '<span class="hwa-double-mark">쌍</span>' : '';
    if (file) {
      // PNG 우선
      const img = document.createElement('img');
      img.className = 'hwa-img';
      img.src = './cards/' + file + '.png';
      img.alt = card.label;
      img.draggable = false;
      img.onerror = function () {
        // 파일 없으면 SVG 폴백
        img.remove();
        const svgHolder = document.createElement('div');
        svgHolder.className = 'hwa-img hwa-fallback';
        svgHolder.innerHTML = fallbackSvg(card);
        wrap.insertBefore(svgHolder, wrap.firstChild);
      };
      wrap.appendChild(img);
      if (dbl) wrap.insertAdjacentHTML('beforeend', dbl);
    } else {
      wrap.innerHTML = fallbackSvg(card) + dbl;
    }
    return wrap;
  }

  global.GostopCards = { cardSvg: cardSvg, faceDownSvg: faceDownSvg, renderCard: renderCard };
})(typeof self !== 'undefined' ? self : this);
