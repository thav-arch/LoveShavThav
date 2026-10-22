// Royal Match vs. gambling apps (case study): in-page section jumps and the small playable demo
// (a match-3 board and a slot machine that both end in the "offer" pop-up from the story).
// The page's HTML is projects/royal-match.html; every class on it starts with rm-.
import { editorialScroll } from "../page-effects.js";

export function mount(cs) {
  const undoScroll = editorialScroll(cs);
  const off = []; // listener removers
  const timers = []; // intervals to clear
  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };

  /* ------------------------------------------------------------ section jumps */
  on(cs, "click", (e) => {
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    const target = cs.querySelector('[data-sec="' + a.dataset.go + '"]');
    if (!target) return;
    if (cs.lenis) cs.lenis.scrollTo(target, { duration: 1.1 });
    else target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ------------------------------------------------------------ playable demo */

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function $(id) { return cs.querySelector('[data-rm="' + id + '"]'); }
  function show(el, on) { el.hidden = !on; }
  function rnd(n) { return Math.floor(Math.random() * n); }

  /* ---------- match-3 ---------- */
  var R = 5, C = 6, N = 4, GOAL = 20, START = 7;
  var NAMES = ['red', 'teal', 'yellow', 'purple'];
  var g = [], sel = null, busy = false, moves = START, got = 0, view = 'play';
  var board = $('board');
  var HINT = 'Swap two neighbouring tiles to line up three of a kind.';

  function matches(grid) {
    var s = {}, r, c, k, len, i;
    for (r = 0; r < R; r++) {
      c = 0;
      while (c < C) {
        k = grid[r][c]; len = 1;
        while (c + len < C && grid[r][c + len] === k) len++;
        if (len >= 3 && k !== null) for (i = 0; i < len; i++) s[r + ',' + (c + i)] = 1;
        c += len;
      }
    }
    for (c = 0; c < C; c++) {
      r = 0;
      while (r < R) {
        k = grid[r][c]; len = 1;
        while (r + len < R && grid[r + len][c] === k) len++;
        if (len >= 3 && k !== null) for (i = 0; i < len; i++) s[(r + i) + ',' + c] = 1;
        r += len;
      }
    }
    return s;
  }
  function count(o) { return Object.keys(o).length; }
  function hasMove(grid) {
    var dirs = [[0, 1], [1, 0]], r, c, d, r2, c2, t, ok;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) for (d = 0; d < 2; d++) {
      r2 = r + dirs[d][0]; c2 = c + dirs[d][1];
      if (r2 >= R || c2 >= C) continue;
      t = grid[r][c]; grid[r][c] = grid[r2][c2]; grid[r2][c2] = t;
      ok = count(matches(grid)) > 0;
      t = grid[r][c]; grid[r][c] = grid[r2][c2]; grid[r2][c2] = t;
      if (ok) return true;
    }
    return false;
  }
  function build() {
    do {
      g = [];
      for (var r = 0; r < R; r++) { var row = []; for (var c = 0; c < C; c++) row.push(rnd(N)); g.push(row); }
    } while (count(matches(g)) || !hasMove(g));
  }
  function render() {
    var f = document.activeElement, fr = -1, fc = -1;
    if (f && board.contains(f) && f.dataset) { fr = +f.dataset.r; fc = +f.dataset.c; }
    var h = '';
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var k = g[r][c];
      h += '<button type="button" class="rm-t-' + (k + 1) + (sel && sel.r === r && sel.c === c ? ' rm-sel' : '') +
        '" data-r="' + r + '" data-c="' + c + '" aria-label="Row ' + (r + 1) + ', column ' + (c + 1) + ', ' + NAMES[k] + ' tile"></button>';
    }
    board.innerHTML = h;
    board.classList.toggle('rm-locked', view !== 'play');
    if (fr >= 0 && board.children[fr * C + fc]) board.children[fr * C + fc].focus();
  }
  function stats() { $('pMoves').textContent = moves; $('pGoal').textContent = Math.min(got, GOAL) + '/' + GOAL; }
  function setView(v) {
    view = v;
    show($('pPlay'), v === 'play'); show($('pOffer'), v === 'offer'); show($('pWin'), v === 'win');
    board.classList.toggle('rm-locked', v !== 'play');
  }
  function swapCells(a, b) { var t = g[a.r][a.c]; g[a.r][a.c] = g[b.r][b.c]; g[b.r][b.c] = t; }

  async function resolve(m) {
    while (count(m)) {
      var keys = Object.keys(m), btns = board.children, c, r, col;
      keys.forEach(function (key) {
        var p = key.split(','), rr = +p[0], cc = +p[1];
        if (g[rr][cc] === 0) got++;
        if (btns[rr * C + cc]) btns[rr * C + cc].classList.add('rm-pop');
      });
      stats();
      await sleep(230);
      keys.forEach(function (key) { var p = key.split(','); g[+p[0]][+p[1]] = null; });
      for (c = 0; c < C; c++) {
        col = [];
        for (r = R - 1; r >= 0; r--) if (g[r][c] !== null) col.push(g[r][c]);
        while (col.length < R) col.push(rnd(N));
        for (r = R - 1; r >= 0; r--) g[r][c] = col[R - 1 - r];
      }
      render();
      await sleep(170);
      m = matches(g);
    }
  }
  async function trySwap(a, b) {
    busy = true;
    swapCells(a, b);
    var m = matches(g);
    if (!count(m)) {
      sel = null; render();
      await sleep(150);
      swapCells(a, b); render();
      board.classList.remove('rm-nudge'); void board.offsetWidth; board.classList.add('rm-nudge');
      $('pHint').textContent = 'That swap makes no match, so it costs nothing. Try another.';
      busy = false; return;
    }
    moves--; sel = null; $('pHint').textContent = HINT; render(); stats();
    await resolve(m);
    if (got >= GOAL) { setView('win'); busy = false; return; }
    if (!hasMove(g)) { build(); render(); }
    if (moves <= 0) setView('offer');
    busy = false;
  }
  on(board, 'click', function (e) {
    if (busy || view !== 'play') return;
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    var r = +b.dataset.r, c = +b.dataset.c;
    if (!sel) { sel = { r: r, c: c }; render(); return; }
    if (sel.r === r && sel.c === c) { sel = null; render(); return; }
    if (Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1) { trySwap(sel, { r: r, c: c }); return; }
    sel = { r: r, c: c }; render();
  });
  function startPuzzle() {
    build(); moves = START; got = 0; sel = null; busy = false;
    $('pHint').textContent = HINT; setView('play'); stats(); render();
  }
  on($('pAdd'), 'click', function () {
    moves += 5; setView('play'); stats(); $('pHint').textContent = 'Five more moves. That is how the offer works: free here, paid in a real app.';
  });
  on($('pReset'), 'click', startPuzzle);
  on($('pAgain'), 'click', startPuzzle);

  /* ---------- slot ---------- */
  var SYM = [
    { k: '7', w: 2, cls: 's7' },
    { k: 'BAR', w: 3, cls: 'sbar' },
    { k: '◆', w: 4, cls: 'sd' },
    { k: '●', w: 5, cls: 'sc' }
  ];
  var PAY = { '7': 60, 'BAR': 20, '◆': 8, '●': 4 }, PAIR7 = 3;
  var BET = 10, START_CHIPS = 60, BONUS = 60;
  var chips = START_CHIPS, spins = 0, won = 0, spinning = false;
  var reels = $('reels').children;
  var TOTAL = SYM.reduce(function (t, s) { return t + s.w; }, 0);

  function pick() {
    var x = Math.random() * TOTAL;
    for (var i = 0; i < SYM.length; i++) { x -= SYM[i].w; if (x < 0) return SYM[i]; }
    return SYM[SYM.length - 1];
  }
  function mult(a) {
    if (a[0].k === a[1].k && a[1].k === a[2].k) return PAY[a[0].k];
    var sevens = a.filter(function (s) { return s.k === '7'; }).length;
    return sevens === 2 ? PAIR7 : 0;
  }
  var rtp = 0;
  SYM.forEach(function (x) { SYM.forEach(function (y) { SYM.forEach(function (z) {
    rtp += (x.w / TOTAL) * (y.w / TOTAL) * (z.w / TOTAL) * mult([x, y, z]);
  }); }); });
  $('sPay').textContent = 'Pays: 7 7 7 ×60, BAR BAR BAR ×20, ◆◆◆ ×8, ●●● ×4, any two 7s ×3. Over the long run this demo returns about ' +
    Math.round(rtp * 100) + '% of what is bet. Real apps set their own number behind the scenes.';

  function setReel(i, s) { reels[i].textContent = s.k; reels[i].className = s.cls; }
  function slotStats() {
    $('sChips').textContent = chips;
    $('sStats').textContent = spins ? 'Spins ' + spins + '. Bet ' + (spins * BET) + ' chips, won back ' + won + '.' : '';
  }
  async function spin() {
    if (spinning || chips < BET) return;
    spinning = true; chips -= BET; spins++; slotStats();
    $('sSpin').disabled = true; $('sMsg').textContent = 'Spinning...';
    var fin = [pick(), pick(), pick()];
    if (reduce) { fin.forEach(function (s, i) { setReel(i, s); }); }
    else {
      $('reels').classList.add('rm-go');
      await Promise.all([0, 1, 2].map(function (i) {
        return new Promise(function (res) {
          var iv = setInterval(function () { setReel(i, pick()); }, 70); timers.push(iv);
          setTimeout(function () { clearInterval(iv); setReel(i, fin[i]); res(); }, 520 + i * 260);
        });
      }));
      $('reels').classList.remove('rm-go');
    }
    var win = mult(fin) * BET;
    chips += win; won += win; slotStats();
    var kinds = fin.map(function (s) { return s.k; });
    var pair = kinds[0] === kinds[1] || kinds[1] === kinds[2] || kinds[0] === kinds[2];
    var msg;
    if (win) msg = 'You won ' + win + ' chips.';
    else if (pair) msg = 'So close: two matching symbols, no payout. That near-miss changes nothing about the next spin.';
    else msg = 'No win. Spin again?';
    $('sMsg').textContent = msg;
    $('sSpin').disabled = false;
    spinning = false;
    if (chips < BET) { show($('sPlay'), false); show($('sOffer'), true); }
  }
  on($('sSpin'), 'click', spin);
  on($('sBonus'), 'click', function () {
    chips += BONUS; slotStats();
    show($('sOffer'), false); show($('sPlay'), true);
    $('sMsg').textContent = 'Bonus pack added. In a real app, this is where a purchase would be offered.';
  });

  startPuzzle();
  slotStats();

  return () => {
    off.forEach((f) => f());
    timers.forEach(clearInterval);
    undoScroll();
  };
}

// opened on its own (not loaded by the 3D home page)
if (document.body.hasAttribute("data-standalone")) {
  mount(document.querySelector(".cs"));
}
