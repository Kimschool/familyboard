// 고스톱 로비 — 타로 운세 모듈 (v108)
// window.GostopTarot = { init } 를 노출
(function () {
  'use strict';

  // ===== 데이터 =====
  var CARDS = [
    { id: 'fool',          num: 0,  name: '0. 바보',          color: '#f5e642',
      up:  '새로운 시작의 에너지가 충만합니다. 두려움 없이 첫걸음을 내딛을 때입니다.',
      rev: '무모한 행동이 화를 부릅니다. 출발 전 충분한 준비가 필요합니다.' },
    { id: 'magician',      num: 1,  name: 'I. 마법사',         color: '#e74c3c',
      up:  '가진 능력을 충분히 발휘할 때입니다. 의지와 기술이 결합해 원하는 것을 이룹니다.',
      rev: '재능을 낭비하거나 잘못된 방향으로 쓰고 있습니다. 교만함을 경계하세요.' },
    { id: 'high-priestess',num: 2,  name: 'II. 여사제',        color: '#2c3e8c',
      up:  '직관을 믿으세요. 드러나지 않은 진실이 곧 밝혀집니다.',
      rev: '중요한 정보를 숨기거나 직관을 무시하고 있습니다.' },
    { id: 'empress',       num: 3,  name: 'III. 여황제',       color: '#27ae60',
      up:  '풍요와 번영의 기운입니다. 노력한 것들이 결실을 맺습니다.',
      rev: '과보호나 의존심이 성장을 막고 있습니다.' },
    { id: 'emperor',       num: 4,  name: 'IV. 황제',          color: '#8e1a1a',
      up:  '안정적인 기반 위에 서 있습니다. 규율과 의지로 목표를 달성하세요.',
      rev: '지나친 통제욕이나 경직된 사고가 문제입니다.' },
    { id: 'hierophant',    num: 5,  name: 'V. 교황',           color: '#8e44ad',
      up:  '전통과 기존의 방법을 따르는 것이 현명합니다. 멘토의 말에 귀를 기울이세요.',
      rev: '기존 규칙이 발목을 잡고 있습니다. 틀을 깨는 시도가 필요합니다.' },
    { id: 'lovers',        num: 6,  name: 'VI. 연인',          color: '#e84393',
      up:  '중요한 선택의 기로에 서 있습니다. 마음이 가는 방향이 정답입니다.',
      rev: '가치관의 충돌이나 잘못된 선택이 갈등을 만듭니다.' },
    { id: 'chariot',       num: 7,  name: 'VII. 전차',         color: '#2980b9',
      up:  '의지와 집중력으로 장애물을 돌파할 때입니다. 강한 추진력이 성공을 이끕니다.',
      rev: '방향을 잃고 통제력이 흔들리고 있습니다. 에너지를 하나로 모으세요.' },
    { id: 'strength',      num: 8,  name: 'VIII. 힘',          color: '#e67e22',
      up:  '내면의 용기와 인내가 빛을 발합니다. 부드러운 강인함으로 어려움을 극복합니다.',
      rev: '자신감 부족이나 내면의 두려움이 발목을 잡습니다.' },
    { id: 'hermit',        num: 9,  name: 'IX. 은둔자',        color: '#7f8c8d',
      up:  '혼자만의 시간이 필요합니다. 내면을 들여다보고 진정한 지혜를 찾는 시기입니다.',
      rev: '고립감이나 지나친 고독이 문제입니다. 세상과 다시 연결될 용기가 필요합니다.' },
    { id: 'wheel',         num: 10, name: 'X. 운명의 바퀴',    color: '#f39c12',
      up:  '변화의 흐름이 유리하게 작용합니다. 운이 따르는 시기이니 기회를 잡으세요.',
      rev: '운의 흐름이 반전됩니다. 변화에 저항하기보다 유연하게 대처해야 합니다.' },
    { id: 'justice',       num: 11, name: 'XI. 정의',          color: '#1abc9c',
      up:  '공정한 결과가 나타납니다. 올바른 판단과 균형 잡힌 행동이 좋은 결과를 만듭니다.',
      rev: '불공정하거나 편향된 판단이 문제입니다. 자신의 행동을 돌아볼 필요가 있습니다.' },
    { id: 'hanged-man',    num: 12, name: 'XII. 매달린 사람',  color: '#16a085',
      up:  '잠시 멈추고 다른 각도에서 바라볼 때입니다. 희생을 통해 더 큰 통찰을 얻습니다.',
      rev: '불필요한 희생이나 정체 상태가 지속되고 있습니다. 지금 당장 변화가 필요합니다.' },
    { id: 'death',         num: 13, name: 'XIII. 죽음',        color: '#2c2c2c',
      up:  '끝이 아니라 변화의 시작입니다. 오래된 것을 내려놓을수록 새로운 것이 찾아옵니다.',
      rev: '변화를 두려워하며 낡은 것을 붙잡고 있습니다. 저항이 더 큰 고통을 만듭니다.' },
    { id: 'temperance',    num: 14, name: 'XIV. 절제',         color: '#5dade2',
      up:  '균형과 조화가 핵심입니다. 인내와 절제로 상황이 서서히 좋아집니다.',
      rev: '극단적인 행동이나 불균형이 문제입니다. 중심을 찾아야 합니다.' },
    { id: 'devil',         num: 15, name: 'XV. 악마',          color: '#c0392b',
      up:  '무언가에 얽매이거나 집착하고 있습니다. 스스로 묶어둔 족쇄를 인식하는 것이 첫걸음입니다.',
      rev: '집착이나 속박에서 벗어나는 시기입니다. 해방의 기운이 찾아오고 있습니다.' },
    { id: 'tower',         num: 16, name: 'XVI. 탑',           color: '#e35d09',
      up:  '갑작스러운 변화나 충격이 찾아옵니다. 무너지는 것은 불필요한 것이었고, 재건이 시작됩니다.',
      rev: '위기를 피하고 있거나 변화가 더딥니다. 두려움이 필요한 전환을 막고 있습니다.' },
    { id: 'star',          num: 17, name: 'XVII. 별',          color: '#5b5ea6',
      up:  '희망과 치유의 기운이 가득합니다. 어둠 뒤에 반드시 빛이 찾아옵니다. 믿음을 갖으세요.',
      rev: '희망을 잃거나 불안함이 앞섭니다. 작은 것에서부터 감사함을 찾아보세요.' },
    { id: 'moon',          num: 18, name: 'XVIII. 달',         color: '#4a4a6e',
      up:  '모든 것이 불분명하고 혼란스럽습니다. 직관을 따르되 환상과 현실을 구분하세요.',
      rev: '혼란이 걷히고 진실이 드러나기 시작합니다. 두려움에서 벗어날 시간입니다.' },
    { id: 'sun',           num: 19, name: 'XIX. 태양',         color: '#f1c40f',
      up:  '긍정적인 기운이 넘칩니다. 성공·기쁨·활력이 가득한 시기입니다. 자신감을 발휘하세요.',
      rev: '에너지가 과하거나 지나친 낙관이 실망을 부릅니다. 현실적인 시각이 필요합니다.' },
    { id: 'judgement',     num: 20, name: 'XX. 심판',          color: '#bdc3c7',
      up:  '중요한 전환점입니다. 과거를 돌아보고 새로운 소명을 받아들일 때입니다.',
      rev: '자기 반성이 부족하거나 중요한 부름을 무시하고 있습니다.' },
    { id: 'world',         num: 21, name: 'XXI. 세계',         color: '#2ecc71',
      up:  '완성과 성취의 기운입니다. 노력이 결실을 맺고 새로운 사이클이 시작됩니다.',
      rev: '마무리가 되지 않거나 성취감이 부족합니다. 완성에 더 집중이 필요합니다.' },
  ];

  var SPREADS = [
    { id: 'day',    emoji: '☀️', name: '오늘의 운세',  count: 3, positions: ['아침', '오후', '저녁'] },
    { id: 'wealth', emoji: '💰', name: '오늘의 재물운', count: 2, positions: ['들어오는 기운', '나가는 기운'] },
    { id: 'health', emoji: '💚', name: '오늘의 건강',  count: 2, positions: ['몸 상태', '마음 상태'] },
    { id: 'love',   emoji: '❤️', name: '오늘의 연애운', count: 2, positions: ['나의 마음', '상대 기운'] },
    { id: 'worry',  emoji: '🌙', name: '고민 해결',    count: 3, positions: ['원인', '현재', '앞으로'] },
    { id: 'single', emoji: '🃏', name: '한 장 뽑기',   count: 1, positions: ['지금 이 순간'] },
  ];

  // ===== 상태 =====
  var state = {
    phase: 'pick',       // 'pick' | 'draw' | 'reveal'
    spread: null,        // 선택한 spread 객체
    drawn: [],           // 뽑은 카드 [{...card, rev, revealed}]
    container: null,
  };

  // ===== 유틸 =====
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function drawCards(n) {
    var deck = shuffle(CARDS);
    var result = [];
    for (var i = 0; i < n && i < deck.length; i++) {
      var c = Object.assign({}, deck[i]);
      c.rev = Math.random() < 0.35;
      c.revealed = false;
      result.push(c);
    }
    return result;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== 렌더링 =====
  function render() {
    var c = state.container;
    if (!c) return;
    c.innerHTML = '';
    if (state.phase === 'pick') renderPick(c);
    else if (state.phase === 'draw') renderDraw(c);
    else if (state.phase === 'reveal') renderReveal(c);
  }

  // --- pick 단계 ---
  function renderPick(c) {
    var html =
      '<p class="tarot-pick-title">타로 운세</p>' +
      '<p class="tarot-pick-sub">원하는 운세를 선택하세요</p>' +
      '<div class="tarot-spread-grid">';
    SPREADS.forEach(function (sp) {
      html +=
        '<button class="tarot-spread-btn" data-id="' + escHtml(sp.id) + '" type="button">' +
          '<span class="tarot-spread-emoji">' + sp.emoji + '</span>' +
          '<span class="tarot-spread-name">' + escHtml(sp.name) + '</span>' +
          '<span class="tarot-spread-count">' + sp.count + '장</span>' +
        '</button>';
    });
    html += '</div>';
    c.innerHTML = html;

    c.querySelectorAll('.tarot-spread-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.id;
        state.spread = SPREADS.filter(function (s) { return s.id === id; })[0] || null;
        if (!state.spread) return;
        state.phase = 'draw';
        render();
      });
    });
  }

  // --- draw 단계 ---
  function renderDraw(c) {
    var sp = state.spread;
    var fanCards = '';
    for (var i = 0; i < 10; i++) {
      fanCards += '<div class="tarot-fan-card" style="--i:' + i + '"></div>';
    }
    var html =
      '<div class="tarot-draw-header">' +
        '<span class="tarot-draw-title">' + escHtml(sp.emoji + ' ' + sp.name) + '</span>' +
        '<button class="tarot-back-btn g-primary g-secondary" type="button">← 뒤로</button>' +
      '</div>' +
      '<div class="tarot-fan-area">' + fanCards + '</div>' +
      '<button class="g-primary tarot-draw-btn" type="button" id="tarotDrawBtn">🔮 카드 뽑기</button>';
    c.innerHTML = html;

    c.querySelector('.tarot-back-btn').addEventListener('click', function () {
      state.phase = 'pick';
      render();
    });

    c.querySelector('#tarotDrawBtn').addEventListener('click', function () {
      var btn = c.querySelector('#tarotDrawBtn');
      btn.disabled = true;
      var fans = c.querySelectorAll('.tarot-fan-card');
      fans.forEach(function (f) { f.classList.add('shuffling'); });
      setTimeout(function () {
        state.drawn = drawCards(sp.count);
        state.phase = 'reveal';
        render();
      }, 800);
    });
  }

  // --- reveal 단계 ---
  function renderReveal(c) {
    var sp = state.spread;
    var revealedCount = state.drawn.filter(function (d) { return d.revealed; }).length;
    var allRevealed = revealedCount === state.drawn.length;

    var html =
      '<div class="tarot-draw-header">' +
        '<span class="tarot-draw-title">' + escHtml(sp.emoji + ' ' + sp.name) + '</span>' +
        '<button class="tarot-back-btn g-primary g-secondary" type="button" id="tarotRevealBack">← 다른 운세</button>' +
      '</div>';

    if (!allRevealed) {
      html += '<p class="tarot-reveal-hint">카드를 눌러 운세를 확인하세요</p>';
    }

    html += '<div class="tarot-cards-row">';
    state.drawn.forEach(function (card, idx) {
      var posLabel = sp.positions[idx] || '';
      var isRev = card.rev;
      var isRevealed = card.revealed;

      html +=
        '<div class="tarot-slot">' +
          '<span class="tarot-pos-label">' + escHtml(posLabel) + '</span>' +
          '<div class="tarot-card' + (isRevealed ? ' is-revealed' : '') + '" data-idx="' + idx + '" role="button" tabindex="0" aria-label="' + escHtml(posLabel) + ' 카드' + (isRevealed ? ' — ' + escHtml(card.name) : ' — 탭하여 확인') + '">' +
            '<div class="tarot-card-inner">' +
              '<div class="tarot-card-back"></div>' +
              '<div class="tarot-card-front">' +
                '<div class="tarot-card-img-wrap' + (isRev ? ' is-reversed' : '') + '">' +
                  '<img src="/assets/tarot/tarot-' + escHtml(card.id) + '.webp" alt="' + escHtml(card.name) + '" ' +
                    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
                  '<div class="tarot-card-fallback" style="display:none;background:' + escHtml(card.color) + '">' + card.num + '</div>' +
                '</div>' +
                '<div class="tarot-card-name">' +
                  escHtml(card.name) +
                  (isRev ? '<span class="tarot-rev-badge">역</span>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

      if (!isRevealed) {
        html += '<span class="tarot-card-hint">터치하여 확인</span>';
      } else {
        var reading = isRev ? card.rev : card.up;
        html += '<p class="tarot-card-reading">' + escHtml(reading) + '</p>';
      }

      html += '</div>';
    });
    html += '</div>';

    if (allRevealed) {
      var revCount = state.drawn.filter(function (d) { return d.rev; }).length;
      var summary;
      if (revCount === 0) {
        summary = '오늘의 흐름이 순조롭습니다. 나온 카드들의 에너지를 믿고 앞으로 나아가세요. ✨';
      } else if (revCount === state.drawn.length) {
        summary = '에너지의 저항이 느껴집니다. 서두르지 말고 내면을 점검할 시간입니다. 🌙';
      } else {
        summary = '복잡한 기운이 교차하고 있습니다. 긍정적인 면을 살리고 주의할 점을 함께 챙기세요. 🌟';
      }
      html += '<div class="tarot-summary">' + escHtml(summary) + '</div>';
      html +=
        '<div class="tarot-result-actions">' +
          '<button class="g-primary g-secondary" type="button" id="tarotRedraw">다시 뽑기</button>' +
          '<button class="g-primary" type="button" id="tarotOther">다른 운세 보기</button>' +
        '</div>';
    }

    c.innerHTML = html;

    // 뒤로 버튼
    var backBtn = c.querySelector('#tarotRevealBack');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        state.phase = 'pick';
        state.drawn = [];
        render();
      });
    }

    // 카드 뒤집기
    c.querySelectorAll('.tarot-card').forEach(function (cardEl) {
      function flipCard() {
        var idx = parseInt(cardEl.dataset.idx, 10);
        if (state.drawn[idx] && state.drawn[idx].revealed) return;
        state.drawn[idx].revealed = true;
        render();
      }
      cardEl.addEventListener('click', flipCard);
      cardEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flipCard();
        }
      });
    });

    // 다시 뽑기
    var redrawBtn = c.querySelector('#tarotRedraw');
    if (redrawBtn) {
      redrawBtn.addEventListener('click', function () {
        state.drawn = drawCards(sp.count);
        render();
      });
    }

    // 다른 운세 보기
    var otherBtn = c.querySelector('#tarotOther');
    if (otherBtn) {
      otherBtn.addEventListener('click', function () {
        state.phase = 'pick';
        state.drawn = [];
        render();
      });
    }
  }

  // ===== 공개 API =====
  function init(container) {
    if (!container) return;
    state.container = container;
    state.phase = 'pick';
    state.spread = null;
    state.drawn = [];
    render();
  }

  window.GostopTarot = { init: init };
})();
