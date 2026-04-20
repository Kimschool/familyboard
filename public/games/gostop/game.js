// 고스톱 게임 플레이 UI — 서버에서 받은 view 를 렌더하고 액션 전송
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };

  let VIEW = null;            // 서버가 보내준 내 시점 뷰
  let PENDING_HAND_CARD = null; // 선택해 둔 손패 카드 id (멀티매칭 선택 중)
  let _autoFlipPending = false; // 자동 뒤집기 중복 호출 방지 플래그

  function socket() { return window.GostopSocket; }

  function start(payload) {
    // 게임이 막 시작됨. 서버가 곧 game:view 를 보내줄 것
    const board = $('gameBoard');
    if (board) board.innerHTML = '';
    const hand = $('gameHand');
    if (hand) hand.innerHTML = '';
    const log = $('gameLog');
    if (log) log.innerHTML = '';
    const status = $('gameStatus');
    if (status) status.textContent = '게임이 시작됐어요. 덱을 나누는 중…';
    PENDING_HAND_CARD = null;
  }

  function onView(view) {
    VIEW = view;
    render();
  }

  function render() {
    if (!VIEW) return;
    const me = VIEW.myIndex;
    const isMyTurn = VIEW.turn === me && !VIEW.finished;
    // 상태 표시
    const turnName = VIEW.players[VIEW.turn] ? VIEW.players[VIEW.turn].name : '?';
    const phaseLabel = {
      'play-hand': '패 내기',
      'choose-hand-match': '같은 달 선택',
      'flip-stock': '덱 뒤집기',
      'choose-flip-match': '같은 달 선택',
      'choose-go-stop': '고 · 스톱',
    }[VIEW.phase] || VIEW.phase;
    const statusEl = $('gameStatus');
    if (VIEW.finished) {
      const winName = VIEW.winner != null && VIEW.players[VIEW.winner] ? VIEW.players[VIEW.winner].name : '';
      statusEl.innerHTML = '<span class="g-status-end">' + (winName ? (winName + '님 승리!') : '무승부') + ' · 최종 ' + VIEW.scores.join(' : ') + '점</span>';
    } else {
      statusEl.innerHTML =
        '<span class="g-status-turn' + (isMyTurn ? ' is-me' : '') + '">' +
          (isMyTurn ? '내 차례' : (turnName + '님 차례')) +
        '</span>' +
        '<span class="g-status-phase">' + phaseLabel + '</span>' +
        '<span class="g-status-stock">덱 ' + VIEW.stockCount + '장</span>';
    }

    // 선택이 필요한 단계에선 도움말 배너를 상단에 추가
    const helpBanner = $('gameHelp');
    if (isMyTurn && (VIEW.phase === 'choose-hand-match' || VIEW.phase === 'choose-flip-match')) {
      helpBanner.innerHTML = '👉 바닥에서 <b>같은 달 카드(노랗게 빛나는)</b> 한 장을 탭해 주세요';
      helpBanner.classList.remove('hidden');
      helpBanner.style.display = 'block';
    } else {
      helpBanner.classList.add('hidden');
      helpBanner.style.display = 'none';
    }

    // 상대 정보 (단 2인 맞고 기준 — 상대 1명)
    const oppEl = $('gameOpponents');
    oppEl.innerHTML = '';
    VIEW.players.forEach(function (p, i) {
      if (i === me) return;
      const box = document.createElement('div');
      box.className = 'g-opp' + (VIEW.turn === i ? ' is-turn' : '');
      const handCount = VIEW.opponentHandCounts[i] || 0;
      const score = VIEW.scores[i] || 0;
      box.innerHTML =
        '<div class="g-opp-head">' + escapeHtml(p.name) + ' · ' + score + '점</div>' +
        '<div class="g-opp-hand">' + new Array(handCount).fill('').map(function () {
          return '<span class="g-opp-card">' + GostopCards.faceDownSvg() + '</span>';
        }).join('') + '</div>' +
        '<div class="g-opp-captured">' + renderCapturedSummary(VIEW.captured[i]) + '</div>';
      oppEl.appendChild(box);
    });

    // 바닥
    const boardEl = $('gameBoard');
    boardEl.innerHTML = '';
    const highlightIds = VIEW.pending && VIEW.pending.choices ? new Set(VIEW.pending.choices) : new Set();
    VIEW.board.forEach(function (c) {
      const wrap = GostopCards.renderCard(c, { highlight: highlightIds.has(c.id) });
      if ((VIEW.phase === 'choose-hand-match' || VIEW.phase === 'choose-flip-match') && highlightIds.has(c.id) && isMyTurn) {
        wrap.onclick = function () { chooseMatch(c.id); };
      }
      boardEl.appendChild(wrap);
    });

    // 내 손패
    const handEl = $('gameHand');
    handEl.innerHTML = '';
    VIEW.myHand.forEach(function (c) {
      const opts = { selected: PENDING_HAND_CARD === c.id };
      const wrap = GostopCards.renderCard(c, opts);
      if (isMyTurn && VIEW.phase === 'play-hand') {
        wrap.onclick = function () { playCard(c.id); };
      }
      handEl.appendChild(wrap);
    });

    // 내 획득 카드 요약
    const capEl = $('gameMyCaptured');
    capEl.innerHTML = renderCapturedSummary(VIEW.captured[me]);
    $('gameMyScore').textContent = (VIEW.scores[me] || 0) + '점';

    // 덱 뒤집기는 자동 실행 — 손패 낸 뒤 900ms 지연 후 서버에 game:flip 전송
    // (사용자가 방금 낸 카드 결과를 볼 시간 확보 + 연속 호출 방지)
    const btnFlip = $('btnFlip');
    btnFlip.classList.add('hidden'); // 버튼은 숨김 (필요 시 수동 백업용)
    if (isMyTurn && VIEW.phase === 'flip-stock' && !_autoFlipPending) {
      _autoFlipPending = true;
      setTimeout(function () {
        _autoFlipPending = false;
        socket().emit('game:flip', null, function () {});
      }, 900);
    }

    // 고/스톱 다이얼로그 — 인라인 style 도 함께 토글 (CSS 캐시 내성)
    const gsDlg = $('goStopDialog');
    if (VIEW.phase === 'choose-go-stop' && isMyTurn) {
      gsDlg.classList.remove('hidden');
      gsDlg.style.display = 'flex';
      $('gsScore').textContent = VIEW.scores[me] + '점';
    } else {
      gsDlg.classList.add('hidden');
      gsDlg.style.display = 'none';
    }

    // 로그
    const logEl = $('gameLog');
    logEl.innerHTML = VIEW.log.map(function (l) {
      return '<li>' + escapeHtml(l.msg) + '</li>';
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;

    // 턴 종료 / 게임 종료 시 pending 초기화
    if (VIEW.phase !== 'choose-hand-match') PENDING_HAND_CARD = null;
  }

  function renderCapturedSummary(cap) {
    if (!cap) return '';
    const counts = {
      light: cap.light.length,
      animal: cap.animal.length,
      ribbon: cap.ribbon.length,
      junk: cap.junk.reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0),
    };
    return '' +
      '<span class="g-cap-chip cap-light">광 ' + counts.light + '</span>' +
      '<span class="g-cap-chip cap-animal">열끗 ' + counts.animal + '</span>' +
      '<span class="g-cap-chip cap-ribbon">띠 ' + counts.ribbon + '</span>' +
      '<span class="g-cap-chip cap-junk">피 ' + counts.junk + '</span>';
  }

  function playCard(cardId) {
    if (!VIEW) return;
    PENDING_HAND_CARD = cardId;
    socket().emit('game:play', { cardId: cardId }, function (res) {
      if (!res || !res.ok) alert(res && res.error || '못 냈어요');
    });
  }

  function chooseMatch(matchCardId) {
    socket().emit('game:match', { matchCardId: matchCardId }, function (res) {
      if (!res || !res.ok) alert(res && res.error || '선택 실패');
    });
  }

  $('btnFlip').addEventListener('click', function () {
    socket().emit('game:flip', null, function (res) {
      if (!res || !res.ok) alert(res && res.error || '뒤집기 실패');
    });
  });
  $('btnGo').addEventListener('click', function () {
    socket().emit('game:gostop', { choice: 'go' }, function () {});
  });
  $('btnStop').addEventListener('click', function () {
    socket().emit('game:gostop', { choice: 'stop' }, function () {});
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  window.GostopGame = { start: start, onView: onView };
})();
