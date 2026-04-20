// 화투 SVG 카드 — 브라우저 전역 GostopCards 로 노출
(function (global) {
  'use strict';

  const MONTH_THEME = {
    1:  { bg1: '#FDE8E8', bg2: '#FCC5C5', icon: '🌸', accent: '#C0392B' },
    2:  { bg1: '#FDF1E8', bg2: '#F7D9B5', icon: '🌺', accent: '#D35400' },
    3:  { bg1: '#FCE7F3', bg2: '#F8BBD9', icon: '🌸', accent: '#E91E63' },
    4:  { bg1: '#E8E3D3', bg2: '#CBC0A2', icon: '🌿', accent: '#57534E' },
    5:  { bg1: '#E3F2E9', bg2: '#BEE0C6', icon: '🌱', accent: '#2D7D46' },
    6:  { bg1: '#F9E8FD', bg2: '#E4BCF3', icon: '🌷', accent: '#8E44AD' },
    7:  { bg1: '#FCE8E3', bg2: '#F2B9A8', icon: '🍀', accent: '#C0392B' },
    8:  { bg1: '#FFF7D6', bg2: '#FFE58A', icon: '🌕', accent: '#B7851E' },
    9:  { bg1: '#FDF5C4', bg2: '#F9E07A', icon: '🌻', accent: '#A87000' },
    10: { bg1: '#FDE2D8', bg2: '#F9B59E', icon: '🍁', accent: '#BF360C' },
    11: { bg1: '#EDE7F6', bg2: '#C5B8E0', icon: '🌸', accent: '#5E3A9A' },
    12: { bg1: '#E3F2FD', bg2: '#AFCFE8', icon: '☔', accent: '#1565C0' },
  };

  const TYPE_BADGE = {
    light:  { label: '광',   color: '#FFD84D', fg: '#7A5D00' },
    animal: { label: '열끗', color: '#60A5FA', fg: '#082F5A' },
    ribbon: { label: '띠',   color: '#F87171', fg: '#5A0808' },
    junk:   { label: '피',   color: '#E5E7EB', fg: '#111827' },
  };

  function cardSvg(card, opts) {
    opts = opts || {};
    if (opts.faceDown) return faceDownSvg();
    const t = MONTH_THEME[card.month];
    const b = TYPE_BADGE[card.type];
    const sel = opts.selected ? '<rect x="2" y="2" width="96" height="156" rx="10" ry="10" fill="none" stroke="#0A84FF" stroke-width="3" />' : '';
    const hi  = opts.highlight ? '<rect x="0" y="0" width="100" height="160" rx="12" ry="12" fill="#FFF7A8" fill-opacity=".5" />' : '';
    const doubleMark = card.doubleJunk ? '<text x="50" y="138" text-anchor="middle" font-size="11" font-weight="700" fill="' + b.fg + '">쌍</text>' : '';
    return '' +
      '<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" class="hwa-card" data-id="' + card.id + '">' +
        '<defs>' +
          '<linearGradient id="gM' + card.id + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + t.bg1 + '"/>' +
            '<stop offset="1" stop-color="' + t.bg2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="url(#gM' + card.id + ')" stroke="' + t.accent + '" stroke-width="1.5"/>' +
        hi +
        '<text x="8" y="20" font-size="14" font-weight="800" fill="' + t.accent + '" font-family="system-ui, sans-serif">' + card.month + '</text>' +
        '<text x="92" y="20" font-size="14" text-anchor="end">' + t.icon + '</text>' +
        '<text x="50" y="88" text-anchor="middle" font-size="44" dominant-baseline="middle">' + t.icon + '</text>' +
        '<rect x="8" y="132" width="30" height="18" rx="9" ry="9" fill="' + b.color + '" />' +
        '<text x="23" y="146" text-anchor="middle" font-size="12" font-weight="800" fill="' + b.fg + '">' + b.label + '</text>' +
        doubleMark +
        sel +
      '</svg>';
  }

  function faceDownSvg() {
    return '' +
      '<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" class="hwa-card face-down">' +
        '<defs>' +
          '<pattern id="backPat" width="12" height="12" patternUnits="userSpaceOnUse">' +
            '<rect width="12" height="12" fill="#7D1F1F"/>' +
            '<path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#9B2A2A" />' +
          '</pattern>' +
        '</defs>' +
        '<rect x="0" y="0" width="100" height="160" rx="10" ry="10" fill="url(#backPat)" stroke="#3A0808" stroke-width="1.5"/>' +
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
