/* ARCADE GAME — two versions of the same portfolio.
   READ : the normal scrolling page (arcade skin, no game layer).
   PLAY : a top-down adventure. You walk a small town, every building is a section of the portfolio, NPCs
          tell the story, coins are hidden around, bugs attack and a boss guards the inn.
   The in-game panels re-use the real page sections, so there is a single source of content. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var touchUI = !finePointer;
  var htmlEl = document.documentElement;
  var bodyEl = document.body;
  var rootStyle = getComputedStyle(htmlEl);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function store(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      sessionStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function cssVar(n, fallback) { return rootStyle.getPropertyValue(n).trim() || fallback; }
  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  function palette() { return [cssVar('--accent', '#6fd3c9'), cssVar('--accent2', '#f0a35e'), '#ecebf3', '#f0b94f']; }

  /* ═══════════ AUDIO ═══════════ */
  var audioCtx = null, soundOn = false, musicOn = true;
  function ac() {
    if (!audioCtx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) audioCtx = new C();
    }
    return audioCtx;
  }
  function beep(freqs, dur, vol, type) {
    if (!soundOn) return;
    var a = ac(); if (!a) return;
    var t = a.currentTime;
    freqs.forEach(function (f, i) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.04, t + i * dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i + 1) * dur);
      o.connect(g); g.connect(a.destination);
      o.start(t + i * dur); o.stop(t + (i + 1) * dur + 0.02);
    });
  }
  var SFX = {
    coin: function () { beep([988, 1319], 0.07); },
    enter: function () { beep([392, 523, 659], 0.07); },
    select: function () { beep([440], 0.05); },
    ach: function () { beep([784, 988, 1175], 0.08); },
    boot: function () { beep([262, 392, 523], 0.1); },
    cheat: function () { beep([392, 330, 262, 196, 262, 330, 392, 523], 0.07); },
    shoot: function () { beep([880, 660], 0.03, 0.025); },
    kill: function () { beep([330, 220, 165], 0.05, 0.04, 'sawtooth'); },
    hurt: function () { beep([196, 147, 98], 0.08, 0.05, 'sawtooth'); },
    over: function () { beep([392, 330, 262, 196, 147], 0.14, 0.05); },
    boss: function () { beep([98, 98, 123, 98], 0.14, 0.05, 'sawtooth'); },
    win: function () { beep([523, 659, 784, 1047, 784, 1047, 1319], 0.09, 0.05); },
    power: function () { beep([659, 784, 988, 1319], 0.06); },
    talk: function () { beep([520, 620], 0.04, 0.02); }
  };
  var ROOTS = [57, 55, 53, 52, 57, 55, 50];
  var LEAD = [0, 2, 4, 2, 3, 1, 2, 0, 4, 3, 2, 1, 2, 4, 5, 3];
  var SCALE = [0, 3, 5, 7, 10, 12];
  var musicTimer = 0, nextNote = 0, mstep = 0, musicZone = 0;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function note(t, freq, dur, type, vol) {
    var a = audioCtx, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function musicTick() {
    var a = audioCtx;
    if (!a || !soundOn || !musicOn) return;
    var stepLen = 0.17;
    while (nextNote < a.currentTime + 0.35) {
      var root = ROOTS[musicZone % ROOTS.length];
      var lead = root + 12 + SCALE[LEAD[mstep % LEAD.length] % SCALE.length];
      if (mstep % 2 === 0 || mstep % 8 === 7) note(nextNote, mtof(lead), stepLen * 1.6, 'square', 0.011);
      if (mstep % 4 === 0) note(nextNote, mtof(root - 12), stepLen * 3.2, 'triangle', 0.028);
      mstep++; nextNote += stepLen;
    }
  }
  function musicSync() {
    clearInterval(musicTimer);
    if (soundOn && musicOn && audioCtx) {
      nextNote = audioCtx.currentTime + 0.05;
      musicTimer = setInterval(musicTick, 100);
    }
  }

  /* ═══════════ PIXEL ART ═══════════ */
  var colorMap = { '1': '#f0a35e', '2': '#f2c9a0', '3': '#13141f', '4': '#6fd3c9', '5': '#8be0d7', '6': '#434a6b' };
  var FRAMES = [
    ['..1111..', '.111111.', '..3223..', '..2222..', '.445544.', '24455442', '..6..6..', '.66..66.'],
    ['..1111..', '.111111.', '..3223..', '..2222..', '.445544.', '24455442', '...66...', '...66...']
  ];
  var BUG = [
    ['.7....7.', '..7..7..', '..7777..', '.777777.', '77977977', '.777777.', '7.7777.7', '.7....7.'],
    ['.7....7.', '..7..7..', '..7777..', '.777777.', '77977977', '.777777.', '.7.77.7.', '7......7']
  ];
  var FLY = [
    ['........', '7.7..7.7', '.777777.', '..7997..', '.777777.', '7.7..7.7', '........', '........'],
    ['........', '.7....7.', '7.7777.7', '..7997..', '.777777.', '..7..7..', '........', '........']
  ];
  var SHOOT = [
    ['..7777..', '.777777.', '77799777', '77799777', '.777777.', '..7777..', '.7.77.7.', '7......7'],
    ['..7777..', '.777777.', '77799777', '77799777', '.777777.', '..7777..', '7.7..7.7', '.7....7.']
  ];
  function mk(rows, map, u) {
    var c = document.createElement('canvas');
    c.width = rows[0].length * u; c.height = rows.length * u;
    var x = c.getContext('2d');
    rows.forEach(function (row, y) {
      for (var i = 0; i < row.length; i++) {
        var col = map[row.charAt(i)];
        if (col) { x.fillStyle = col; x.fillRect(i * u, y * u, u, u); }
      }
    });
    return c;
  }
  var PLAYER_FR = [mk(FRAMES[0], colorMap, 4), mk(FRAMES[1], colorMap, 4)];
  var TYPES = {
    bug:     { hp: 1, sp: [0.9, 1.5], r: 18, half: 16, pts: 100, kami: true,
               fr: [mk(BUG[0], { '7': '#e0607e', '9': '#ecebf3' }, 4), mk(BUG[1], { '7': '#e0607e', '9': '#ecebf3' }, 4)] },
    fly:     { hp: 1, sp: [1.9, 2.5], r: 15, half: 12, pts: 150, kami: true,
               fr: [mk(FLY[0], { '7': '#f0b94f', '9': '#13141f' }, 3), mk(FLY[1], { '7': '#f0b94f', '9': '#13141f' }, 3)] },
    tank:    { hp: 4, sp: [0.5, 0.7], r: 30, half: 24, pts: 400, kami: false,
               fr: [mk(BUG[0], { '7': '#9b6bd9', '9': '#ecebf3' }, 6), mk(BUG[1], { '7': '#9b6bd9', '9': '#ecebf3' }, 6)] },
    shooter: { hp: 2, sp: [0.7, 0.9], r: 20, half: 16, pts: 300, kami: false,
               fr: [mk(SHOOT[0], { '7': '#7aa2ff', '9': '#ecebf3' }, 4), mk(SHOOT[1], { '7': '#7aa2ff', '9': '#ecebf3' }, 4)] }
  };
  var BOSS_FR = [mk(BUG[0], { '7': '#e0607e', '9': '#ecebf3' }, 10), mk(BUG[1], { '7': '#e0607e', '9': '#ecebf3' }, 10)];
  var POWERS = {
    triple: { c: '#6fd3c9', l: 'T', name: 'TRIPLE SHOT' },
    shield: { c: '#7aa2ff', l: 'S', name: 'SHIELD' },
    rapid:  { c: '#f0b94f', l: 'R', name: 'RAPID FIRE' },
    heart:  { c: '#e0607e', l: 'H', name: 'EXTRA HEART' }
  };

  /* ═══════════ UI SHELL (toasts, banner, hit flash, dialogue, panel, prompt) ═══════════ */
  var toasts = el('div', 'gm-toasts');
  toasts.setAttribute('aria-live', 'polite');
  bodyEl.appendChild(toasts);
  function toast(title, body, kind) {
    var t = el('div', 'gm-toast ' + (kind || ''), '<b></b><span></span>');
    t.firstChild.textContent = title;
    t.lastChild.textContent = body;
    toasts.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 400); }, 3600);
    while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
  }
  var banner = el('div', 'gm-banner');
  banner.setAttribute('aria-hidden', 'true');
  bodyEl.appendChild(banner);
  var bannerTimer = 0;
  function showBanner(top, bottom) {
    banner.innerHTML = '<b></b><span></span>';
    banner.firstChild.textContent = top;
    banner.lastChild.textContent = bottom || '';
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { banner.classList.remove('show'); }, 2000);
  }
  var hurtFx = el('div', 'gm-hurt');
  hurtFx.setAttribute('aria-hidden', 'true');
  bodyEl.appendChild(hurtFx);

  var ach = {};
  try { ach = JSON.parse(store('arcade-ach') || '{}'); } catch (e) { ach = {}; }
  function unlock(id, name, desc) {
    if (ach[id]) return;
    ach[id] = 1;
    store('arcade-ach', JSON.stringify(ach));
    SFX.ach();
    toast('ACHIEVEMENT UNLOCKED', name + ' — ' + desc, 'ach');
  }

  /* ── difficulty ── */
  var DIFFS = {
    easy:   { label: 'EASY',   spd: 0.75, spawn: 1.5, max: -1, bossHp: 10, drop: 0.3,  inv: 1.3,  score: 0.5, shoot: 1.4 },
    normal: { label: 'NORMAL', spd: 1,    spawn: 1,   max: 0,  bossHp: 16, drop: 0.2,  inv: 1,    score: 1,   shoot: 1 },
    hard:   { label: 'HARD',   spd: 1.25, spawn: 0.7, max: 2,  bossHp: 24, drop: 0.12, inv: 0.75, score: 1.5, shoot: 0.7 }
  };
  var DIFF_ORDER = ['easy', 'normal', 'hard'];
  var diffKey = 'normal';
  try { diffKey = localStorage.getItem('arcade-diff') || 'normal'; } catch (e) {}
  if (!DIFFS[diffKey]) diffKey = 'normal';
  function D() { return DIFFS[diffKey]; }
  function setDiff(k) {
    diffKey = k;
    try { localStorage.setItem('arcade-diff', k); } catch (e) {}
    toast('DIFFICULTY', D().label + ' — score x' + D().score, 'lvl');
  }

  /* ── scores ── */
  var score = 0, kills = 0, runId = Date.now();
  function loadScores() {
    try { return JSON.parse(localStorage.getItem('arcade-scores') || '[]'); } catch (e) { return []; }
  }
  function saveScore() {
    if (score <= 0) return;
    var s = loadScores().filter(function (r) { return r.id !== runId; });
    s.push({ id: runId, s: score, k: kills, d: D().label });
    s.sort(function (a, b) { return b.s - a.s; });
    try { localStorage.setItem('arcade-scores', JSON.stringify(s.slice(0, 5))); } catch (e) {}
  }
  window.addEventListener('pagehide', saveScore);

  /* ── HUD ── */
  var hud = el('div', 'gm-hud');
  var hpEl = el('span', 'gm-chip gm-hp', '♥♥♥');
  var powEl = el('span', 'gm-chip gm-pow', '');
  var scoreEl = el('span', 'gm-chip gm-score', 'SCORE 000000');
  var coinEl = el('span', 'gm-chip gm-coins', '● 0/7');
  var placesEl = el('span', 'gm-chip gm-places', 'PLACES 0/6');
  [hpEl, powEl, scoreEl, coinEl, placesEl].forEach(function (n) { hud.appendChild(n); });
  var topBox = el('div', 'gm-top');
  var btnRow = el('div', 'gm-btns');
  var sndBtn = el('button', 'gm-btn', 'SND OFF');
  var menuBtn = el('button', 'gm-btn', 'MENU');
  sndBtn.type = 'button'; menuBtn.type = 'button';
  sndBtn.setAttribute('aria-pressed', 'false');
  btnRow.appendChild(sndBtn); btnRow.appendChild(menuBtn);
  var mini = el('canvas', 'gm-mini');
  mini.width = 132; mini.height = 92;
  topBox.appendChild(btnRow); topBox.appendChild(mini);
  bodyEl.appendChild(hud);
  bodyEl.appendChild(topBox);
  var promptEl = el('div', 'gm-prompt');
  bodyEl.appendChild(promptEl);

  /* ── dialogue ── */
  var dlg = el('div', 'gm-dialog');
  dlg.setAttribute('role', 'dialog');
  dlg.innerHTML = '<canvas width="48" height="48"></canvas><div class="gm-dialog-body"><b></b><p></p><i>▼</i></div>';
  bodyEl.appendChild(dlg);
  var dState = null;
  function dialogOpen() { return !!dState; }
  function typePage() {
    var txt = dState.pages[dState.i], p = $('p', dlg);
    p.textContent = ''; dState.pos = 0; dState.full = false;
    clearInterval(dState.timer);
    if (reduce) { p.textContent = txt; dState.full = true; return; }
    dState.timer = setInterval(function () {
      dState.pos++;
      p.textContent = txt.slice(0, dState.pos);
      if (dState.pos % 3 === 0) SFX.talk();
      if (dState.pos >= txt.length) { clearInterval(dState.timer); dState.full = true; }
    }, 20);
  }
  function openDialog(name, pages, map) {
    clearInput();
    var pc = $('canvas', dlg).getContext('2d');
    pc.imageSmoothingEnabled = false;
    pc.clearRect(0, 0, 48, 48);
    pc.drawImage(mk(FRAMES[0], map, 6), 0, 0);
    $('b', dlg).textContent = name;
    dState = { pages: pages, i: 0, pos: 0, timer: 0, full: false };
    dlg.classList.add('open');
    typePage();
  }
  function closeDialog() {
    if (!dState) return;
    clearInterval(dState.timer);
    dState = null;
    dlg.classList.remove('open');
  }
  function advanceDialog() {
    if (!dState) return;
    if (!dState.full) {
      clearInterval(dState.timer);
      $('p', dlg).textContent = dState.pages[dState.i];
      dState.full = true;
      return;
    }
    dState.i++;
    SFX.select();
    if (dState.i >= dState.pages.length) closeDialog(); else typePage();
  }
  dlg.addEventListener('click', advanceDialog);

  /* ── content panel (clones the real page sections) ── */
  var panel = el('div', 'gm-panel');
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = '<div class="gm-panel-box"><div class="gm-panel-head"><b></b><button type="button" class="gm-btn">CLOSE [ESC]</button></div><div class="gm-panel-body"></div></div>';
  bodyEl.appendChild(panel);
  var panelBody = $('.gm-panel-body', panel);
  var panelTitle = $('.gm-panel-head b', panel);
  function panelOpen() { return panel.classList.contains('open'); }
  function openPanel(place) {
    clearInput();
    var ids = place.id === 'about' ? ['hero', 'about'] : [place.id];
    panelBody.innerHTML = '';
    ids.forEach(function (id) {
      var src = document.getElementById(id);
      if (!src) return;
      var c = src.cloneNode(true);
      c.removeAttribute('id');
      $$('.reveal', c).forEach(function (n) { n.classList.remove('reveal'); });
      $$('[id]', c).forEach(function (n) { n.removeAttribute('id'); });
      panelBody.appendChild(c);
    });
    panelTitle.textContent = place.name + ' — ' + place.label;
    panel.classList.add('open');
    panelBody.scrollTop = 0;
    SFX.enter();
    if (!visited[place.id]) {
      visited[place.id] = 1;
      store('arcade-visited', JSON.stringify(visited));
      showHud();
      var n = Object.keys(visited).length;
      toast('NEW PLACE', place.name + ' discovered (' + n + '/' + PLACES.length + ')', 'lvl');
      if (n === PLACES.length) {
        unlock('explorer', 'EXPLORER', 'Visited every place in town.');
        showBanner('QUEST COMPLETE', 'YOU SAW IT ALL');
      }
    }
  }
  function closePanel() { panel.classList.remove('open'); }
  $('.gm-panel-head button', panel).addEventListener('click', closePanel);
  panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });

  /* ═══════════ WORLD ═══════════ */
  var TS = 32, WT = 64, HT = 44, WW = WT * TS, WH = HT * TS;
  var PLACES = [
    { id: 'about', name: 'PLAYER HOUSE', label: 'ABOUT', x: 5, y: 5, w: 8, h: 5, roof: '#6fd3c9' },
    { id: 'experience', name: 'QUEST HALL', label: 'EXPERIENCE', x: 28, y: 3, w: 8, h: 5, roof: '#f0a35e' },
    { id: 'skills', name: 'THE FORGE', label: 'SKILLS', x: 52, y: 5, w: 8, h: 5, roof: '#7aa2ff' },
    { id: 'projects', name: 'THE ARCADE', label: 'PROJECTS', x: 5, y: 30, w: 8, h: 5, roof: '#e0607e' },
    { id: 'credentials', name: 'LIBRARY', label: 'CREDENTIALS', x: 52, y: 30, w: 8, h: 5, roof: '#b38cf0' },
    { id: 'contact', name: 'THE INN', label: 'CONTACT', x: 28, y: 30, w: 8, h: 5, roof: '#f0b94f' }
  ];
  var PATHS = [
    [8, 10, 9, 22], [8, 21, 26, 22],             // about
    [31, 8, 32, 19],                              // experience
    [55, 10, 56, 22], [37, 21, 56, 22],           // skills
    [3, 22, 4, 36], [3, 21, 26, 22], [3, 35, 10, 36], // projects
    [59, 22, 60, 36], [37, 21, 60, 22], [55, 35, 60, 36], // credentials
    [24, 26, 25, 36], [24, 35, 33, 36],           // inn
    [26, 19, 37, 25]                              // plaza
  ];
  var PONDS = [[14, 14, 19, 18], [44, 13, 49, 17]];
  var COIN_TILES = [[13, 13], [23, 12], [41, 12], [57, 17], [12, 26], [50, 26], [40, 28]];
  var NPCS = [
    { place: 'about', name: 'QUEST GIVER', dx: -70, dy: 36,
      map: { '1': '#c98a2b', '2': '#f2c9a0', '3': '#13141f', '4': '#b38cf0', '5': '#d1b8ff', '6': '#434a6b' },
      pages: ['Greetings, traveller! I am Uriel, a Technical Designer working in Unreal Engine 5.',
              'My tools: C++, Blueprints and the Gameplay Ability System.',
              'I take features from concept to a shipping-ready build: prototype, TDD, production.',
              'Step into the house to read more.'] },
    { place: 'experience', name: 'ARCHIVIST', dx: -76, dy: 36,
      map: { '1': '#7aa2ff', '2': '#f2c9a0', '3': '#13141f', '4': '#e0607e', '5': '#f09bb0', '6': '#434a6b' },
      pages: ['Welcome to the Quest Hall. Most recently: GRIP Studios, on Tomb Raider: Legacy of Atlantis and unannounced AAA titles.',
              'Before that: DALOAR Studios (Motion Matching, parkour and GAS), Orengi Games and HechicerIA.',
              'Right now he is building his own games at Visual Dynamics Studio.'] },
    { place: 'skills', name: 'SMITH', dx: -76, dy: 36,
      map: { '1': '#6fd3c9', '2': '#f2c9a0', '3': '#13141f', '4': '#f0a35e', '5': '#f7c999', '6': '#434a6b' },
      pages: ['The forge turns tools into shipped features: Unreal Engine 4/5, C++, Blueprints, plus Unity and C# when needed.',
              'Key tech: GAS, Motion Matching, AI Behavior Trees, networking and replication.',
              'Pipeline: Perforce, Git, Jira and profiling tools.'] },
    { place: 'projects', name: 'MERCHANT', dx: 78, dy: 36,
      map: { '1': '#f0b94f', '2': '#f2c9a0', '3': '#13141f', '4': '#8be0d7', '5': '#c4f1ec', '6': '#434a6b' },
      pages: ['Care to browse? The plugin inside is KD: Traversal Sense, live on Fab: pure environment detection for character traversal.',
              'You will also find playable mini games on itch.io, and a book he technically reviewed.'] },
    { place: 'credentials', name: 'SCHOLAR', dx: -76, dy: 36,
      map: { '1': '#8c7cc6', '2': '#f2c9a0', '3': '#13141f', '4': '#ecebf3', '5': '#ffffff', '6': '#434a6b' },
      pages: ['Courses, a Master in Video Game Programming with Unreal, and a CyberOlympics 2017 top five.',
              'A background in software and web development before games: Java, SQL, full stack.'] },
    { place: 'contact', name: 'INNKEEPER', dx: 78, dy: 36,
      map: { '1': '#e0607e', '2': '#f2c9a0', '3': '#13141f', '4': '#f0a35e', '5': '#f7c999', '6': '#434a6b' },
      pages: ['Welcome! He is open to collaborations, contract work and offers.',
              'Step inside to find the email and the links. Oh, and there are rumours of something lurking once you have seen the whole town…'] }
  ];
  var GUIDE = { name: 'GUIDE', map: { '1': '#ecebf3', '2': '#f2c9a0', '3': '#13141f', '4': '#f0a35e', '5': '#f7c999', '6': '#434a6b' },
    pages: ['Welcome to Uriel Cruz\'s town! Each building is a part of his portfolio.',
            'Walk with WASD or the arrows, press E at doors and people. SPACE shoots the bugs.',
            'Collect the 7 coins and visit all 6 places. Something might show up when you have seen everything. Good luck!'] };

  var world = null; // built lazily
  var visited = {};
  try { visited = JSON.parse(store('arcade-visited') || '{}'); } catch (e) { visited = {}; }

  function initWorld() {
    var pathMap = new Uint8Array(WT * HT);
    PATHS.forEach(function (r) {
      for (var ty = r[1]; ty <= r[3]; ty++) for (var tx = r[0]; tx <= r[2]; tx++) pathMap[ty * WT + tx] = 1;
    });
    var pondMap = new Uint8Array(WT * HT);
    PONDS.forEach(function (r) {
      for (var ty = r[1]; ty <= r[3]; ty++) for (var tx = r[0]; tx <= r[2]; tx++) pondMap[ty * WT + tx] = 1;
    });
    var solids = [];
    PLACES.forEach(function (p) {
      p.px = p.x * TS; p.py = p.y * TS; p.pw = p.w * TS; p.ph = p.h * TS;
      p.doorX = (p.x + p.w / 2) * TS;
      p.doorY = (p.y + p.h) * TS;
      solids.push({ x: p.px, y: p.py, w: p.pw, h: p.ph - 6 });
    });
    PONDS.forEach(function (r) {
      solids.push({ x: r[0] * TS, y: r[1] * TS, w: (r[2] - r[0] + 1) * TS, h: (r[3] - r[1] + 1) * TS });
    });

    /* trees: seeded scatter that avoids paths, buildings, ponds, coins and the spawn */
    var trees = [];
    function nearRect(tx, ty, x0, y0, x1, y1, m) { return tx >= x0 - m && tx <= x1 + m && ty >= y0 - m && ty <= y1 + m; }
    for (var ty = 1; ty < HT - 1; ty++) {
      for (var tx = 1; tx < WT - 1; tx++) {
        if (hash(tx, ty) > 0.085) continue;
        var bad = false, i;
        for (i = 0; i < PATHS.length && !bad; i++) bad = nearRect(tx, ty, PATHS[i][0], PATHS[i][1], PATHS[i][2], PATHS[i][3], 1);
        for (i = 0; i < PLACES.length && !bad; i++) bad = nearRect(tx, ty, PLACES[i].x, PLACES[i].y, PLACES[i].x + PLACES[i].w - 1, PLACES[i].y + PLACES[i].h - 1, 2);
        for (i = 0; i < PONDS.length && !bad; i++) bad = nearRect(tx, ty, PONDS[i][0], PONDS[i][1], PONDS[i][2], PONDS[i][3], 1);
        for (i = 0; i < COIN_TILES.length && !bad; i++) bad = Math.abs(tx - COIN_TILES[i][0]) < 2 && Math.abs(ty - COIN_TILES[i][1]) < 2;
        if (bad) continue;
        var t = { x: tx * TS + 16, y: ty * TS + 30, v: Math.floor(hash(ty, tx) * 3) };
        trees.push(t);
        solids.push({ x: t.x - 7, y: t.y - 14, w: 14, h: 14 });
      }
    }

    var npcs = NPCS.map(function (n) {
      var pl = PLACES.filter(function (p) { return p.id === n.place; })[0];
      return { def: n, x: pl.doorX + n.dx, y: pl.doorY + n.dy, sprite: mk(FRAMES[0], n.map, 4), place: pl, told: false };
    });
    var guide = { def: GUIDE, x: 32 * TS + 70, y: 22 * TS + 20, sprite: mk(FRAMES[0], GUIDE.map, 4), place: null, told: false };
    npcs.push(guide);

    var gotIds = {};
    try { gotIds = JSON.parse(store('arcade-coins') || '{}'); } catch (e) { gotIds = {}; }
    var coins = COIN_TILES.map(function (c, idx) { return { id: idx, x: c[0] * TS + 16, y: c[1] * TS + 16, got: !!gotIds[idx] }; });

    /* static minimap background */
    var mm = document.createElement('canvas');
    mm.width = 132; mm.height = 92;
    var m = mm.getContext('2d'), sx = 132 / WW, sy = 92 / WH;
    m.fillStyle = '#1e3a33'; m.fillRect(0, 0, 132, 92);
    m.fillStyle = '#5a5472';
    PATHS.forEach(function (r) { m.fillRect(r[0] * TS * sx, r[1] * TS * sy, (r[2] - r[0] + 1) * TS * sx, (r[3] - r[1] + 1) * TS * sy); });
    m.fillStyle = '#2d4a78';
    PONDS.forEach(function (r) { m.fillRect(r[0] * TS * sx, r[1] * TS * sy, (r[2] - r[0] + 1) * TS * sx, (r[3] - r[1] + 1) * TS * sy); });
    PLACES.forEach(function (p) { m.fillStyle = p.roof; m.fillRect(p.px * sx, p.py * sy, p.pw * sx, p.ph * sy); });

    world = { pathMap: pathMap, pondMap: pondMap, solids: solids, trees: trees, npcs: npcs, guide: guide, coins: coins, mm: mm, sx: sx, sy: sy };
  }

  /* ═══════════ GAME STATE ═══════════ */
  var gc = null, g = null;
  var running = false, raf = 0, lastTs = 0;
  var keys = {}, joy = { x: 0, y: 0 };
  var P = { x: 0, y: 0, hp: 3, inv: 0, fx: 0, fy: 1, flip: false, frame: 0, ft: 0, cd: 0, tri: 0, rap: 0, sh: 0 };
  var cam = { x: 0, y: 0 };
  var enemies = [], shots = [], eshots = [], powers = [], boss = null;
  var bossDown = store('arcade-boss') === '1';
  var spawnT = 240, godMode = false, nearTarget = null, zoneT = 0, mmT = 0;
  var innPlace = null;

  function clearInput() { keys = {}; joy.x = 0; joy.y = 0; }
  function visitedCount() { return Object.keys(visited).length; }
  function coinsGot() { return world ? world.coins.filter(function (c) { return c.got; }).length : 0; }

  function showHud() {
    var s = '';
    for (var i = 0; i < 3; i++) s += i < P.hp ? '♥' : '♡';
    hpEl.textContent = s;
    var pw = [];
    if (P.tri > 0) pw.push('TRIPLE ' + Math.ceil(P.tri / 60));
    if (P.rap > 0) pw.push('RAPID ' + Math.ceil(P.rap / 60));
    if (P.sh > 0) pw.push('SHIELD');
    powEl.textContent = pw.join('  ');
    scoreEl.textContent = 'SCORE ' + pad(score, 6);
    coinEl.textContent = '● ' + coinsGot() + '/' + (world ? world.coins.length : 7);
    placesEl.textContent = 'PLACES ' + visitedCount() + '/' + PLACES.length;
  }
  function addScore(n) { score += Math.round(n * D().score); scoreEl.textContent = 'SCORE ' + pad(score, 6); }

  function solidAt(x, y) {
    var l = x - 8, r = x + 8, t = y - 10, b = y;
    if (l < 0 || t < 0 || r > WW || b > WH) return true;
    var S = world.solids;
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (r > s.x && l < s.x + s.w && b > s.y && t < s.y + s.h) return true;
    }
    return false;
  }
  function resetPlayer() {
    P.x = 32 * TS; P.y = 23 * TS;
    P.hp = 3; P.inv = 90; P.cd = 0; P.tri = 0; P.rap = 0; P.sh = 0;
    showHud();
  }

  /* ── enemies / powers / boss ── */
  function spawnEnemy(type, at) {
    var t = TYPES[type];
    var p = at;
    if (!p) {
      var a = Math.random() * Math.PI * 2, d = rnd(520, 720);
      p = { x: Math.max(20, Math.min(WW - 20, P.x + Math.cos(a) * d)), y: Math.max(20, Math.min(WH - 20, P.y + Math.sin(a) * d)) };
    }
    enemies.push({ type: type, x: p.x, y: p.y, hp: t.hp, sp: rnd(t.sp[0], t.sp[1]) * D().spd, ph: rnd(0, 6), cd: rnd(60, 140), flash: 0, wa: rnd(0, 6) });
  }
  function pickType() {
    var n = visitedCount(), pool = ['bug', 'bug'];
    if (n >= 1) pool.push('fly');
    if (n >= 2) pool.push('shooter');
    if (n >= 3) pool.push('tank');
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function dropPower(x, y, force) {
    if (!force && Math.random() > D().drop) return;
    var kinds = ['triple', 'shield', 'rapid'];
    if (P.hp < 3) kinds.push('heart', 'heart');
    powers.push({ x: x, y: y, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 700 });
  }
  function grantPower(kind) {
    SFX.power();
    if (kind === 'triple') P.tri = 600;
    if (kind === 'rapid') P.rap = 600;
    if (kind === 'shield') P.sh = 1;
    if (kind === 'heart') P.hp = Math.min(3, P.hp + 1);
    toast('POWER-UP', POWERS[kind].name, 'lvl');
    unlock('power', 'POWERED UP', 'Grabbed a power-up.');
    showHud();
  }
  function hurt() {
    if (P.inv > 0 || godMode) return false;
    if (P.sh > 0) {
      P.sh = 0; P.inv = 50;
      burst(P.x, P.y - 16, ['#7aa2ff', '#ecebf3'], 12, 4);
      SFX.select();
      showHud();
      return false;
    }
    P.hp--; P.inv = 80 * D().inv;
    SFX.hurt();
    burst(P.x, P.y - 16, ['#e0607e', '#ecebf3'], 12, 4);
    hurtFx.classList.remove('on'); void hurtFx.offsetWidth; hurtFx.classList.add('on');
    showHud();
    if (P.hp <= 0) {
      SFX.over();
      saveScore();
      toast('GAME OVER', 'Final score ' + pad(score, 6) + '. Back to the plaza…', 'ach');
      unlock('respawn', 'RESPAWN', 'Lost all hearts. It happens.');
      score = 0; kills = 0; runId = Date.now();
      enemies = []; shots = []; eshots = []; powers = []; boss = null;
      resetPlayer();
    }
    return true;
  }
  function killEnemy(i) {
    var e = enemies[i], t = TYPES[e.type];
    burst(e.x, e.y - 8, ['#e0607e', '#ecebf3', '#f0a35e'], 12, 4);
    enemies.splice(i, 1);
    kills++; addScore(t.pts); SFX.kill();
    if (e.type === 'tank') {
      spawnEnemy('bug', { x: e.x - 14, y: e.y });
      spawnEnemy('bug', { x: e.x + 14, y: e.y });
      dropPower(e.x, e.y, true);
    } else dropPower(e.x, e.y, false);
    if (kills === 1) unlock('debug', 'DEBUGGER', 'Squashed your first bug.');
    if (kills === 10) unlock('exterminator', 'EXTERMINATOR', '10 bugs squashed.');
    if (kills === 25) unlock('pestcontrol', 'PEST CONTROL', '25 bugs squashed in one run.');
  }
  function spawnBoss() {
    boss = { x: innPlace.doorX, y: innPlace.py - 90, hp: D().bossHp, max: D().bossHp, t: 0, flash: 0, sp: 0.85 * D().spd, cd: 240 * D().shoot };
    SFX.boss();
    showBanner('BOSS', 'THE BACKLOG');
  }
  function bossDefeated() {
    burst(boss.x, boss.y, palette(), 90, 9, 6);
    boss = null; bossDown = true; store('arcade-boss', '1');
    addScore(2000); SFX.win();
    saveScore();
    unlock('boss', 'BACKLOG CLEARED', 'Defeated the final boss.');
    showBanner('STAGE CLEAR', 'THE BACKLOG IS EMPTY');
    toast('THE INN IS SAFE', 'Step inside and say hello.', 'lvl');
  }

  /* ── particles (screen space, drawn on a separate canvas) ── */
  var fxCv = el('canvas', 'gm-fx');
  fxCv.setAttribute('aria-hidden', 'true');
  bodyEl.appendChild(fxCv);
  var fxCtx = fxCv.getContext('2d');
  var parts = [];
  function burst(wx, wy, colors, n, speed, size) {
    if (reduce) n = Math.ceil(n / 3);
    var sx = wx - cam.x, sy = wy - cam.y;
    for (var i = 0; i < n; i++) {
      parts.push({
        x: sx, y: sy,
        vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed - 1,
        life: 1, d: 0.02 + Math.random() * 0.025,
        s: size || 3 + Math.floor(Math.random() * 3), c: colors[i % colors.length]
      });
    }
  }
  function drawParts() {
    fxCtx.clearRect(0, 0, fxCv.width, fxCv.height);
    parts = parts.filter(function (p) { return p.life > 0; });
    parts.forEach(function (p) {
      p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.life -= p.d;
      fxCtx.globalAlpha = Math.max(p.life, 0);
      fxCtx.fillStyle = p.c;
      fxCtx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    });
    fxCtx.globalAlpha = 1;
  }

  /* ── interaction ── */
  function nearestTarget() {
    var best = null, bd = 1e9;
    function consider(x, y, reach, kind, label, ref) {
      var d = Math.sqrt((x - P.x) * (x - P.x) + (y - P.y) * (y - P.y));
      if (d < reach && d < bd) { bd = d; best = { kind: kind, label: label, ref: ref, x: x, y: y }; }
    }
    PLACES.forEach(function (p) { consider(p.doorX, p.doorY + 14, 58, 'enter', 'ENTER ' + p.name, p); });
    world.npcs.forEach(function (n) { consider(n.x, n.y - 16, 52, 'talk', 'TALK TO ' + n.def.name, n); });
    return best;
  }
  function interact() {
    if (dialogOpen()) { advanceDialog(); return; }
    if (!nearTarget) return;
    if (nearTarget.kind === 'enter') openPanel(nearTarget.ref);
    else {
      var n = nearTarget.ref;
      openDialog(n.def.name, n.def.pages, n.def.map);
      n.told = true;
      unlock('talk', 'FRIENDLY', 'Talked to your first NPC.');
      var told = world.npcs.filter(function (x) { return x.told; }).length;
      if (told >= world.npcs.length) unlock('talkall', 'SOCIAL BUTTERFLY', 'Talked to everyone.');
    }
  }

  /* ═══════════ MAIN LOOP ═══════════ */
  function tick(ts) {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    var dt = lastTs ? Math.min(40, ts - lastTs) / 16.67 : 1;
    lastTs = ts;
    var vw = window.innerWidth, vh = window.innerHeight;
    var paused = menuOpen() || bootActive || dialogOpen() || panelOpen() || document.hidden;

    if (!paused) update(dt, vw, vh);
    draw(ts, vw, vh);
    drawParts();
  }

  function update(dt, vw, vh) {
    /* movement + collision (axis separated) */
    var dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0) + joy.x;
    var dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0) + joy.y;
    var mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0.15) {
      if (mag > 1) { dx /= mag; dy /= mag; mag = 1; }
      var sp = 3.2 * dt;
      var nx = P.x + dx * sp, ny = P.y + dy * sp;
      if (!solidAt(nx, P.y)) P.x = nx;
      if (!solidAt(P.x, ny)) P.y = ny;
      var fm = Math.sqrt(dx * dx + dy * dy) || 1;
      P.fx = dx / fm; P.fy = dy / fm;
      if (Math.abs(dx) > 0.2) P.flip = dx < 0;
      P.ft += dt;
      if (P.ft > 7) { P.ft = 0; P.frame = 1 - P.frame; }
    } else P.frame = 0;
    if (P.inv > 0) P.inv -= dt;
    if (godMode) P.inv = 10;
    if (P.cd > 0) P.cd -= dt;
    var hadPow = P.tri > 0 || P.rap > 0;
    if (P.tri > 0) P.tri -= dt;
    if (P.rap > 0) P.rap -= dt;
    if (hadPow && (P.tri <= 0 || P.rap <= 0 || Math.floor(P.tri / 60) !== Math.floor((P.tri + dt) / 60) || Math.floor(P.rap / 60) !== Math.floor((P.rap + dt) / 60))) showHud();

    /* shooting */
    if (keys[' '] && P.cd <= 0) {
      var fx = P.fx, fy = P.fy;
      if (Math.abs(fx) < 0.01 && Math.abs(fy) < 0.01) fy = 1;
      var base = Math.atan2(fy, fx), angs = P.tri > 0 ? [-0.26, 0, 0.26] : [0];
      angs.forEach(function (a) {
        shots.push({ x: P.x, y: P.y - 16, vx: Math.cos(base + a) * 9, vy: Math.sin(base + a) * 9, life: 70 });
      });
      P.cd = P.rap > 0 ? 6 : 13;
      SFX.shoot();
    }

    /* coins + powers by touch */
    world.coins.forEach(function (c) {
      if (c.got) return;
      var ddx = c.x - P.x, ddy = c.y - (P.y - 12);
      if (ddx * ddx + ddy * ddy < 28 * 28) {
        c.got = true;
        var ids = {};
        world.coins.forEach(function (k) { if (k.got) ids[k.id] = 1; });
        store('arcade-coins', JSON.stringify(ids));
        burst(c.x, c.y, ['#fbe08a', '#f0b94f', '#c98a2b'], 12, 3);
        addScore(250); SFX.coin(); showHud();
        var n = coinsGot();
        if (n === 3) unlock('coins3', 'POCKET CHANGE', 'Found 3 coins.');
        if (n === world.coins.length) {
          unlock('coins7', 'COMPLETIONIST', 'All coins found.');
          showBanner('ALL COINS', 'COMPLETIONIST');
        }
      }
    });
    for (var pi = powers.length - 1; pi >= 0; pi--) {
      var pw = powers[pi];
      pw.life -= dt;
      var px = pw.x - P.x, py = pw.y - (P.y - 12);
      if (px * px + py * py < 26 * 26) { grantPower(pw.kind); powers.splice(pi, 1); }
      else if (pw.life <= 0) powers.splice(pi, 1);
    }

    /* interaction prompt */
    nearTarget = nearestTarget();
    if (nearTarget) {
      promptEl.textContent = (touchUI ? '[A] ' : '[E] ') + nearTarget.label;
      promptEl.style.left = Math.round(P.x - cam.x) + 'px';
      promptEl.style.top = Math.round(P.y - cam.y - 62) + 'px';
      promptEl.classList.add('on');
    } else promptEl.classList.remove('on');

    /* zone music + boss lifecycle */
    zoneT -= dt;
    if (zoneT <= 0) {
      zoneT = 45;
      var bi = 0, bd = 1e9;
      PLACES.forEach(function (p, i) {
        var d = Math.abs(p.doorX - P.x) + Math.abs(p.doorY - P.y);
        if (d < bd) { bd = d; bi = i; }
      });
      musicZone = bi;
    }
    /* easter egg: the boss only shows up once every place has been visited */
    if (!bossDown && !boss && visitedCount() >= PLACES.length) spawnBoss();

    /* spawning */
    spawnT -= dt;
    if (spawnT <= 0) {
      if (enemies.length < Math.max(1, 3 + Math.min(4, visitedCount()) + D().max)) spawnEnemy(pickType());
      spawnT = (Math.max(90, 220 - visitedCount() * 20) + Math.random() * 100) * D().spawn;
    }

    /* enemies */
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i], t = TYPES[e.type];
      var ax = P.x - e.x, ay = (P.y - 14) - e.y, d = Math.sqrt(ax * ax + ay * ay) || 1;
      e.ph += 0.06 * dt;
      if (e.flash > 0) e.flash -= dt;
      if (d > 1200) { enemies.splice(i, 1); continue; }
      var chase = d < 560;
      var wob = e.type === 'fly' ? 1.8 : 0.6;
      var dir = 1;
      if (e.type === 'shooter') {
        dir = d < 230 ? -0.8 : (d > 330 ? 1 : 0.1);
        e.cd -= dt;
        if (e.cd <= 0 && d < 520) {
          e.cd = 130 * D().shoot;
          eshots.push({ x: e.x, y: e.y, vx: ax / d * 3.4, vy: ay / d * 3.4, life: 240 });
        }
      }
      if (chase) {
        e.x += (ax / d * e.sp * dir + Math.cos(e.ph) * wob) * dt;
        e.y += (ay / d * e.sp * dir + Math.sin(e.ph) * wob) * dt;
      } else {
        e.x += Math.cos(e.wa) * 0.5 * dt; e.y += Math.sin(e.wa) * 0.5 * dt;
        if (Math.random() < 0.01) e.wa += rnd(-1, 1);
      }
      if (d < t.r + 6) {
        var took = hurt();
        if (t.kami) killEnemy(i);
        else if (took || P.inv > 0) {
          var nx2 = P.x + (P.x - e.x) / d * 26, ny2 = P.y + (P.y - e.y) / d * 26;
          if (!solidAt(nx2, P.y)) P.x = nx2;
          if (!solidAt(P.x, ny2)) P.y = ny2;
        }
      }
    }
    for (var es = eshots.length - 1; es >= 0; es--) {
      var s2 = eshots[es];
      s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.life -= dt;
      var qx = s2.x - P.x, qy = s2.y - (P.y - 14);
      if (qx * qx + qy * qy < 16 * 16) { hurt(); eshots.splice(es, 1); }
      else if (s2.life <= 0) eshots.splice(es, 1);
    }

    /* boss */
    if (boss) {
      boss.t += dt;
      var bx = P.x - boss.x, by = (P.y - 14) - boss.y, bd2 = Math.sqrt(bx * bx + by * by) || 1;
      boss.x += (bx / bd2 * boss.sp + Math.cos(boss.t * 0.03) * 1.4) * dt;
      boss.y += (by / bd2 * boss.sp + Math.sin(boss.t * 0.05) * 0.8) * dt;
      if (boss.flash > 0) boss.flash -= dt;
      boss.cd -= dt;
      if (boss.cd <= 0) {
        boss.cd = 300 * D().shoot;
        spawnEnemy('fly', { x: boss.x, y: boss.y });
        for (var a2 = 0; a2 < 5; a2++) {
          var an = Math.atan2(by, bx) + (a2 - 2) * 0.35;
          eshots.push({ x: boss.x, y: boss.y, vx: Math.cos(an) * 3, vy: Math.sin(an) * 3, life: 240 });
        }
      }
      if (bd2 < 52) hurt();
    }

    /* player shots */
    for (var s = shots.length - 1; s >= 0; s--) {
      var sh = shots[s];
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
      var gone = sh.life <= 0 || sh.x < 0 || sh.x > WW || sh.y < 0 || sh.y > WH;
      if (!gone) {
        for (var k = enemies.length - 1; k >= 0; k--) {
          var en = enemies[k], tr = TYPES[en.type].r;
          var ex = en.x - sh.x, ey = en.y - sh.y;
          if (ex * ex + ey * ey < tr * tr) {
            en.hp--; en.flash = 4; gone = true;
            if (en.hp <= 0) killEnemy(k); else { burst(sh.x, sh.y, ['#ecebf3'], 3, 2); SFX.kill(); }
            break;
          }
        }
      }
      if (!gone && boss) {
        var ox = boss.x - sh.x, oy = boss.y - sh.y;
        if (ox * ox + oy * oy < 46 * 46) {
          boss.hp--; boss.flash = 4; gone = true;
          addScore(50); SFX.kill();
          burst(sh.x, sh.y, ['#e0607e', '#ecebf3'], 5, 3);
          if (boss.hp <= 0) bossDefeated();
        }
      }
      if (gone) shots.splice(s, 1);
    }

    /* camera */
    cam.x = vw >= WW ? (WW - vw) / 2 : Math.max(0, Math.min(WW - vw, P.x - vw / 2));
    cam.y = vh >= WH ? (WH - vh) / 2 : Math.max(0, Math.min(WH - vh, P.y - vh / 2));
    cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
  }

  /* ═══════════ RENDER ═══════════ */
  function drawBuilding(p) {
    var x = p.px - cam.x, y = p.py - cam.y, w = p.pw, h = p.ph;
    var roofH = 62;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 6, y + h - 4, w, 10);
    g.fillStyle = '#2e3350'; g.fillRect(x, y + roofH - 10, w, h - roofH + 10);
    g.fillStyle = '#3a4066';
    for (var by = y + roofH; by < y + h - 6; by += 16) g.fillRect(x + 2, by, w - 4, 2);
    g.fillStyle = p.roof; g.fillRect(x - 8, y, w + 16, roofH);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - 8, y + roofH - 12, w + 16, 12);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (var rx = x - 8; rx < x + w + 8; rx += 24) g.fillRect(rx, y, 4, roofH - 12);
    g.fillStyle = '#f0b94f';
    g.fillRect(x + 22, y + roofH + 18, 24, 22);
    g.fillRect(x + w - 46, y + roofH + 18, 24, 22);
    g.fillStyle = '#13141f';
    g.fillRect(x + 22 + 11, y + roofH + 18, 2, 22); g.fillRect(x + w - 46 + 11, y + roofH + 18, 2, 22);
    var dx = x + w / 2 - 18;
    g.fillStyle = '#13141f'; g.fillRect(dx - 4, y + h - 52, 44, 52);
    g.fillStyle = '#5a3d2b'; g.fillRect(dx, y + h - 48, 36, 48);
    g.fillStyle = '#f0b94f'; g.fillRect(dx + 28, y + h - 26, 4, 4);
    g.font = '9px "Press Start 2P", monospace'; g.textAlign = 'center';
    var tw = g.measureText(p.label).width + 18;
    g.fillStyle = '#13141f'; g.fillRect(x + w / 2 - tw / 2, y - 24, tw, 20);
    g.strokeStyle = p.roof; g.lineWidth = 2; g.strokeRect(x + w / 2 - tw / 2, y - 24, tw, 20);
    g.fillStyle = '#ecebf3'; g.fillText(p.label, x + w / 2, y - 10);
  }
  function drawTree(t) {
    var x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 14, y - 4, 28, 8);
    g.fillStyle = '#5a3d2b'; g.fillRect(x - 4, y - 16, 8, 16);
    var c1 = ['#3f7d5a', '#487f4a', '#3b7a73'][t.v], c2 = ['#2f6347', '#386439', '#2e615b'][t.v];
    g.fillStyle = c2; g.fillRect(x - 17, y - 36, 34, 24);
    g.fillStyle = c1; g.fillRect(x - 15, y - 48, 30, 30);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - 9, y - 44, 8, 6);
  }
  function draw(ts, vw, vh) {
    if (gc.width !== vw || gc.height !== vh) { gc.width = vw; gc.height = vh; fxCv.width = vw; fxCv.height = vh; g.imageSmoothingEnabled = false; }
    var tx0 = Math.max(0, Math.floor(cam.x / TS)), ty0 = Math.max(0, Math.floor(cam.y / TS));
    var tx1 = Math.min(WT - 1, Math.floor((cam.x + vw) / TS)), ty1 = Math.min(HT - 1, Math.floor((cam.y + vh) / TS));
    g.fillStyle = '#0d0f19'; g.fillRect(0, 0, vw, vh);
    var wave = Math.floor(ts / 400) % 2;
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var sx = tx * TS - cam.x, sy = ty * TS - cam.y, idx = ty * WT + tx;
        if (world.pondMap[idx]) {
          g.fillStyle = '#2d4a78'; g.fillRect(sx, sy, TS, TS);
          g.fillStyle = '#3a5c91';
          g.fillRect(sx + 6 + wave * 8, sy + 8, 10, 2); g.fillRect(sx + 16 - wave * 8, sy + 20, 10, 2);
        } else if (world.pathMap[idx]) {
          g.fillStyle = ((tx + ty) & 1) ? '#5a5472' : '#625c7b'; g.fillRect(sx, sy, TS, TS);
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(sx, sy + TS - 2, TS, 2);
        } else {
          g.fillStyle = ((tx + ty) & 1) ? '#27463e' : '#2b4c43'; g.fillRect(sx, sy, TS, TS);
          var hv = hash(tx + 3, ty + 7);
          if (hv > 0.82) {
            g.fillStyle = '#3a6a58';
            g.fillRect(sx + Math.floor(hv * 40) % 24 + 3, sy + Math.floor(hv * 90) % 22 + 4, 2, 4);
            g.fillRect(sx + Math.floor(hv * 70) % 20 + 6, sy + Math.floor(hv * 33) % 20 + 6, 2, 3);
          }
        }
      }
    }
    /* plaza emblem */
    g.fillStyle = 'rgba(111,211,201,.25)';
    g.fillRect(32 * TS - 40 - cam.x, 22 * TS - 40 - cam.y, 80, 80);
    g.fillStyle = 'rgba(240,163,94,.35)';
    g.fillRect(32 * TS - 24 - cam.x, 22 * TS - 24 - cam.y, 48, 48);

    /* coins */
    var bob = Math.round(Math.sin(ts / 220) * 3), spin = Math.abs(Math.sin(ts / 260));
    world.coins.forEach(function (c) {
      if (c.got) return;
      var cx = c.x - cam.x, cy = c.y - cam.y + bob;
      if (cx < -20 || cx > vw + 20 || cy < -20 || cy > vh + 20) return;
      var cw = Math.max(4, Math.round(16 * spin));
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - 7, c.y - cam.y + 10, 14, 4);
      g.fillStyle = '#c98a2b'; g.fillRect(cx - cw / 2 - 1, cy - 9, cw + 2, 18);
      g.fillStyle = '#f0b94f'; g.fillRect(cx - cw / 2, cy - 8, cw, 16);
      g.fillStyle = '#fbe08a'; g.fillRect(cx - cw / 2 + 2, cy - 6, Math.max(2, cw / 3), 5);
    });

    /* y-sorted drawables */
    var list = [];
    PLACES.forEach(function (p) {
      if (p.px - 12 < cam.x + vw && p.px + p.pw + 12 > cam.x && p.py - 30 < cam.y + vh && p.py + p.ph > cam.y) list.push({ y: p.py + p.ph - 8, f: function () { drawBuilding(p); } });
    });
    world.trees.forEach(function (t) {
      if (t.x > cam.x - 40 && t.x < cam.x + vw + 40 && t.y > cam.y - 10 && t.y < cam.y + vh + 60) list.push({ y: t.y, f: function () { drawTree(t); } });
    });
    var af = Math.floor(ts / 160) % 2;
    world.npcs.forEach(function (n) {
      list.push({ y: n.y, f: function () {
        var x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 11, y - 3, 22, 6);
        g.drawImage(n.sprite, x - 16, y - 30);
        if (!n.told) {
          g.fillStyle = '#f0a35e'; g.font = '12px "Press Start 2P", monospace'; g.textAlign = 'center';
          g.fillText('!', x, y - 36 + Math.round(Math.sin(ts / 180) * 2));
        }
      } });
    });
    powers.forEach(function (p) {
      if (p.life < 120 && Math.floor(ts / 90) % 2) return;
      list.push({ y: p.y, f: function () {
        var def = POWERS[p.kind], b = Math.round(Math.sin(ts / 200) * 3), x = p.x - cam.x, y = p.y - cam.y;
        g.fillStyle = '#13141f'; g.fillRect(x - 12, y - 12 + b, 24, 24);
        g.fillStyle = def.c; g.fillRect(x - 10, y - 10 + b, 20, 20);
        g.fillStyle = '#13141f'; g.font = '10px "Press Start 2P", monospace'; g.textAlign = 'center';
        g.fillText(def.l, x, y + 5 + b);
      } });
    });
    enemies.forEach(function (e) {
      var t = TYPES[e.type];
      list.push({ y: e.y + 10, f: function () {
        var x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 10, y + t.half - 4, 20, 6);
        if (e.flash > 0) g.globalAlpha = 0.5;
        g.drawImage(t.fr[af], x - t.half, y - t.half);
        g.globalAlpha = 1;
        if (e.type === 'tank') {
          g.fillStyle = '#13141f'; g.fillRect(x - 18, y - 34, 36, 6);
          g.fillStyle = '#9b6bd9'; g.fillRect(x - 17, y - 33, Math.round(34 * e.hp / t.hp), 4);
        }
      } });
    });
    if (boss) {
      list.push({ y: boss.y + 40, f: function () {
        var x = Math.round(boss.x - cam.x), y = Math.round(boss.y - cam.y);
        if (boss.flash > 0) g.globalAlpha = 0.5;
        g.drawImage(BOSS_FR[af], x - 40, y - 40);
        g.globalAlpha = 1;
        var bw = 120, bh = 8, bx = x - bw / 2, by = y - 58;
        g.fillStyle = '#13141f'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        g.fillStyle = '#e0607e'; g.fillRect(bx, by, Math.round(bw * boss.hp / boss.max), bh);
      } });
    }
    list.push({ y: P.y, f: function () {
      var x = Math.round(P.x - cam.x), y = Math.round(P.y - cam.y);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 11, y - 3, 22, 6);
      if (P.inv <= 0 || Math.floor(ts / 70) % 2) {
        g.save(); g.translate(x, y - 30);
        if (P.flip) { g.translate(32, 0); g.scale(-1, 1); }
        g.drawImage(PLAYER_FR[P.frame], 0, 0);
        g.restore();
      }
      if (P.sh > 0) { g.strokeStyle = '#7aa2ff'; g.lineWidth = 3; g.strokeRect(x - 20, y - 40, 40, 44); }
    } });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (d) { d.f(); });

    /* shots */
    g.fillStyle = '#e0607e';
    eshots.forEach(function (sh) { g.fillRect(Math.round(sh.x - cam.x - 4), Math.round(sh.y - cam.y - 4), 8, 8); });
    g.fillStyle = cssVar('--accent', '#6fd3c9');
    shots.forEach(function (sh) { g.fillRect(Math.round(sh.x - cam.x - 3), Math.round(sh.y - cam.y - 3), 6, 6); });

    /* minimap every few frames */
    mmT -= 1;
    if (mmT <= 0) {
      mmT = 5;
      var m = mini.getContext('2d');
      m.drawImage(world.mm, 0, 0);
      world.coins.forEach(function (c) { if (!c.got) { m.fillStyle = '#f0b94f'; m.fillRect(c.x * world.sx - 1, c.y * world.sy - 1, 3, 3); } });
      if (boss) { m.fillStyle = '#e0607e'; m.fillRect(boss.x * world.sx - 2, boss.y * world.sy - 2, 5, 5); }
      if (Math.floor(ts / 300) % 2) { m.fillStyle = '#ffffff'; m.fillRect(P.x * world.sx - 2, P.y * world.sy - 2, 5, 5); }
      m.strokeStyle = 'rgba(255,255,255,.4)'; m.lineWidth = 1;
      m.strokeRect(cam.x * world.sx, cam.y * world.sy, Math.min(vw, WW) * world.sx, Math.min(vh, WH) * world.sy);
    }
  }

  /* ═══════════ TOUCH CONTROLS ═══════════ */
  var padEl = el('div', 'gm-pad' + (touchUI ? ' touch' : ''), '<div class="gm-joy"><i></i></div><div class="gm-pad-btns"><button type="button" class="gm-act">A</button><button type="button" class="gm-fire">FIRE</button></div>');
  bodyEl.appendChild(padEl);
  if (touchUI) {
    var joyEl = $('.gm-joy', padEl), knob = $('i', joyEl);
    var joyMove = function (e) {
      var t = e.touches[0], r = joyEl.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var ddx = t.clientX - cx, ddy = t.clientY - cy, m = Math.sqrt(ddx * ddx + ddy * ddy), max = r.width / 2;
      if (m > max) { ddx = ddx / m * max; ddy = ddy / m * max; }
      joy.x = ddx / max; joy.y = ddy / max;
      knob.style.transform = 'translate(' + ddx + 'px,' + ddy + 'px)';
      e.preventDefault();
    };
    var joyEnd = function () { joy.x = 0; joy.y = 0; knob.style.transform = ''; };
    joyEl.addEventListener('touchstart', joyMove, { passive: false });
    joyEl.addEventListener('touchmove', joyMove, { passive: false });
    joyEl.addEventListener('touchend', joyEnd);
    joyEl.addEventListener('touchcancel', joyEnd);
    var fireBtn = $('.gm-fire', padEl), actBtn = $('.gm-act', padEl);
    fireBtn.addEventListener('touchstart', function (e) { keys[' '] = true; e.preventDefault(); }, { passive: false });
    fireBtn.addEventListener('touchend', function () { delete keys[' ']; });
    fireBtn.addEventListener('touchcancel', function () { delete keys[' ']; });
    actBtn.addEventListener('touchstart', function (e) { interact(); e.preventDefault(); }, { passive: false });
  }

  /* ═══════════ PAUSE MENU ═══════════ */
  var menu = el('div', 'gm-menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Pause menu');
  menu.innerHTML = '<div class="gm-menu-box"><h3>PAUSE</h3><ul></ul><div class="gm-scores"></div><p>↑ ↓ MOVE · ENTER SELECT · ESC CLOSE</p></div>';
  bodyEl.appendChild(menu);
  var menuList = $('ul', menu), scoresEl = $('.gm-scores', menu);
  var sel = 0, menuItems = [];
  function menuOpen() { return menu.classList.contains('open'); }
  function toggleSound() {
    soundOn = !soundOn;
    sndBtn.textContent = 'SND ' + (soundOn ? 'ON' : 'OFF');
    sndBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) { var a = ac(); if (a && a.resume) a.resume(); SFX.select(); }
    musicSync();
  }
  function buildMenu() {
    menuItems = [{ label: 'RESUME', run: function () {} }];
    PLACES.forEach(function (p) {
      menuItems.push({ label: 'GO TO: ' + p.name, run: function () { P.x = p.doorX; P.y = p.doorY + 52; } });
    });
    menuItems.push({ label: 'DIFFICULTY: ' + D().label, keep: true, run: function () {
      setDiff(DIFF_ORDER[(DIFF_ORDER.indexOf(diffKey) + 1) % DIFF_ORDER.length]);
    } });
    menuItems.push({ label: 'SOUND: ' + (soundOn ? 'ON' : 'OFF'), run: toggleSound, keep: true });
    menuItems.push({ label: 'MUSIC: ' + (musicOn ? 'ON' : 'OFF'), run: function () { musicOn = !musicOn; musicSync(); }, keep: true });
    menuItems.push({ label: 'SWITCH TO READ MODE', run: function () { setMode('read'); } });
    menuList.innerHTML = '';
    menuItems.forEach(function (it, i) {
      var li = el('li', i === sel ? 'sel' : '');
      li.textContent = it.label;
      li.addEventListener('mouseenter', function () { sel = i; paint(); });
      li.addEventListener('click', function () { choose(i); });
      menuList.appendChild(li);
    });
    var s = loadScores();
    if (!s.length) scoresEl.innerHTML = '';
    else {
      var html = '<h4>HI-SCORES</h4><ol>';
      s.forEach(function (r) { html += '<li>' + pad(r.s, 6) + ' <span>' + r.k + ' bugs' + (r.d ? ' · ' + r.d : '') + '</span></li>'; });
      scoresEl.innerHTML = html + '</ol>';
    }
  }
  function paint() { $$('li', menuList).forEach(function (li, i) { li.classList.toggle('sel', i === sel); }); }
  function choose(i) {
    var it = menuItems[i];
    SFX.select();
    it.run();
    if (it.keep) buildMenu(); else closeMenu();
  }
  function openMenu() {
    sel = 0; clearInput(); saveScore(); buildMenu();
    menu.classList.add('open');
    unlock('menu', 'PAUSE MENU', 'You found the pause menu.');
  }
  function closeMenu() { menu.classList.remove('open'); }
  menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(); });
  menuBtn.addEventListener('click', function () { menuOpen() ? closeMenu() : openMenu(); });
  sndBtn.addEventListener('click', toggleSound);

  /* ═══════════ KEYBOARD ═══════════ */
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var kpos = 0;
  var GAME_KEYS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, w: 1, a: 1, s: 1, d: 1, ' ': 1 };
  document.addEventListener('keydown', function (e) {
    if (!running) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (menuOpen()) {
      if (k === 'Escape') { closeMenu(); e.preventDefault(); }
      else if (k === 'ArrowDown') { sel = (sel + 1) % menuItems.length; paint(); SFX.select(); e.preventDefault(); }
      else if (k === 'ArrowUp') { sel = (sel - 1 + menuItems.length) % menuItems.length; paint(); SFX.select(); e.preventDefault(); }
      else if (k === 'Enter') { choose(sel); e.preventDefault(); }
      return;
    }
    if (bootActive) return;
    if (panelOpen()) {
      if (k === 'Escape' || k === 'e') { closePanel(); e.preventDefault(); }
      return;
    }
    if (dialogOpen()) {
      if (k === 'Escape') { closeDialog(); e.preventDefault(); }
      else if (k === 'Enter' || k === 'e' || k === ' ') { advanceDialog(); e.preventDefault(); }
      return;
    }
    if (k === 'Escape' || k === 'm') { openMenu(); return; }
    if (k === 'e' || k === 'Enter') { interact(); e.preventDefault(); return; }

    if (GAME_KEYS[k]) {
      var onControl = tag === 'BUTTON' || tag === 'A';
      if (!(k === ' ' && onControl)) { e.preventDefault(); keys[k] = true; }
    }
    if (k === KONAMI[kpos]) {
      kpos++;
      if (kpos === KONAMI.length) {
        kpos = 0;
        godMode = !godMode;
        SFX.cheat();
        toast(godMode ? 'CHEAT MODE ON' : 'CHEAT MODE OFF', godMode ? 'God mode enabled.' : 'Back to normal.', 'ach');
        if (godMode) { unlock('konami', 'OLD SCHOOL', 'Entered the Konami code.'); burst(P.x, P.y - 20, palette(), 70, 8, 5); }
      }
    } else kpos = (k === KONAMI[0]) ? 1 : 0;
  });
  document.addEventListener('keyup', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    delete keys[k];
  });
  window.addEventListener('blur', clearInput);

  /* ═══════════ MODES + BOOT ═══════════ */
  var bootActive = false;
  var playBtn = el('button', 'gm-playbtn', '▶ PLAY THE GAME');
  playBtn.type = 'button';
  playBtn.addEventListener('click', function () { setMode('game'); });
  bodyEl.appendChild(playBtn);

  function startGame() {
    if (!world) initWorld();
    innPlace = PLACES.filter(function (p) { return p.id === 'contact'; })[0];
    if (!gc) {
      gc = el('canvas', 'gm-world');
      gc.setAttribute('aria-label', 'Interactive portfolio game');
      bodyEl.insertBefore(gc, bodyEl.firstChild);
      g = gc.getContext('2d');
    }
    gc.style.display = '';
    htmlEl.classList.add('gm-active');
    bodyEl.classList.add('gm-active');
    window.scrollTo(0, 0);
    enemies = []; shots = []; eshots = []; powers = []; boss = null; spawnT = 240;
    clearInput();
    resetPlayer();
    running = true; lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    showBanner('READY?', 'GO!');
    if (!store('arcade-welcomed')) {
      store('arcade-welcomed', '1');
      setTimeout(function () {
        if (running && !dialogOpen()) { var gd = world.guide; openDialog(gd.def.name, gd.def.pages, gd.def.map); gd.told = true; }
      }, 900);
    }
  }
  function stopGame() {
    running = false;
    cancelAnimationFrame(raf);
    saveScore();
    clearInput();
    closeDialog(); closePanel(); closeMenu();
    promptEl.classList.remove('on');
    if (gc) gc.style.display = 'none';
    htmlEl.classList.remove('gm-active');
    bodyEl.classList.remove('gm-active');
    musicSync();
  }
  function setMode(mode) {
    store('arcade-mode', mode);
    if (mode === 'game') startGame(); else stopGame();
  }

  function boot() {
    var b = el('div', 'gm-boot');
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Start screen');
    var help = touchUI ? 'PLAY: joystick to move · FIRE to shoot · A to talk and enter' : 'PLAY: WASD / arrows to move · SPACE to shoot · E to talk and enter';
    b.innerHTML =
      '<div class="gm-boot-inner">' +
      '<div class="gm-boot-top">INSERT COIN</div>' +
      '<h1>URIEL CRUZ</h1>' +
      '<p>Technical Designer · Unreal Engine 5</p>' +
      '<div class="gm-boot-btns">' +
      '<button type="button" class="gm-start" data-mode="game">▶ PLAY</button>' +
      '<button type="button" class="gm-start alt" data-mode="read">JUST READ</button>' +
      '</div>' +
      '<div class="gm-boot-btns" style="margin-top:18px;"><button type="button" class="gm-start alt gm-diff"></button></div>' +
      '<small>PLAY is a small adventure game where the portfolio is a town.<br>JUST READ is the regular scrolling page.<br>' + help + '</small>' +
      '</div>';
    bodyEl.appendChild(b);
    htmlEl.style.overflow = 'hidden';
    bootActive = true;
    $('.gm-start', b).focus();
    var done = false;
    function start(mode) {
      if (done) return;
      done = true;
      bootActive = false;
      SFX.boot();
      b.classList.add('out');
      htmlEl.style.overflow = '';
      document.removeEventListener('keydown', keyStart, true);
      setTimeout(function () { b.remove(); }, 400);
      setMode(mode);
    }
    function keyStart(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab') return;
      e.preventDefault();
      start(e.key.toLowerCase() === 'r' ? 'read' : 'game');
    }
    var diffBtn = $('.gm-diff', b);
    function diffLabel() { diffBtn.textContent = 'DIFFICULTY: ' + D().label + ' ◂▸'; }
    diffLabel();
    diffBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      diffKey = DIFF_ORDER[(DIFF_ORDER.indexOf(diffKey) + 1) % DIFF_ORDER.length];
      try { localStorage.setItem('arcade-diff', diffKey); } catch (e) {}
      diffLabel(); SFX.select();
    });
    $$('.gm-start[data-mode]', b).forEach(function (btn) {
      btn.addEventListener('click', function (ev) { ev.stopPropagation(); start(btn.getAttribute('data-mode')); });
    });
    document.addEventListener('keydown', keyStart, true);
  }

  window.addEventListener('resize', function () { if (gc && running) { gc.width = window.innerWidth; gc.height = window.innerHeight; fxCv.width = gc.width; fxCv.height = gc.height; g.imageSmoothingEnabled = false; } });
  fxCv.width = window.innerWidth; fxCv.height = window.innerHeight;

  var saved = store('arcade-mode');
  if (!saved) boot();
  else if (saved === 'game') startGame();
})();
