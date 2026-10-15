/* ARCADE FX — turns the page into a small game: boot screen, XP bar, level-ups, coins,
   achievements, pause menu, chiptune SFX (off by default), particles and a Konami code.
   Everything is injected from here; the page content itself is untouched. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var root = document.documentElement;
  var rootStyle = getComputedStyle(root);

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
  function palette() { return [cssVar('--accent', '#6fd3c9'), cssVar('--accent2', '#f0a35e'), '#ecebf3', '#f0b94f']; }

  /* ── sound (square-wave blips, muted until the visitor turns it on) ── */
  var audioCtx = null, soundOn = false;
  function ac() {
    if (!audioCtx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) audioCtx = new C();
    }
    return audioCtx;
  }
  function beep(freqs, dur, vol) {
    if (!soundOn) return;
    var a = ac(); if (!a) return;
    var t = a.currentTime;
    freqs.forEach(function (f, i) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.04, t + i * dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i + 1) * dur);
      o.connect(g); g.connect(a.destination);
      o.start(t + i * dur); o.stop(t + (i + 1) * dur + 0.02);
    });
  }
  var SFX = {
    coin: function () { beep([988, 1319], 0.07); },
    level: function () { beep([523, 659, 784, 1047], 0.09); },
    select: function () { beep([440], 0.05); },
    ach: function () { beep([784, 988, 1175], 0.08); },
    boot: function () { beep([262, 392, 523], 0.1); },
    cheat: function () { beep([392, 330, 262, 196, 262, 330, 392, 523], 0.07); }
  };

  /* ── particles ── */
  var cv = el('canvas', 'fx-canvas');
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  var parts = [], looping = false;
  function fit() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  fit(); window.addEventListener('resize', fit);

  function burst(x, y, colors, n, speed, size) {
    if (reduce) return;
    for (var i = 0; i < n; i++) {
      parts.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: -Math.random() * speed - 1,
        life: 1, d: 0.02 + Math.random() * 0.025,
        s: size || 3 + Math.floor(Math.random() * 3),
        c: colors[i % colors.length]
      });
    }
    loop();
  }
  function loop() {
    if (looping) return;
    looping = true;
    (function frame() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(function (p) { return p.life > 0; });
      parts.forEach(function (p) {
        p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.life -= p.d;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      });
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(frame);
      else { looping = false; ctx.clearRect(0, 0, cv.width, cv.height); }
    })();
  }

  /* ── toasts + achievements ── */
  var toasts = el('div', 'fx-toasts');
  toasts.setAttribute('aria-live', 'polite');
  document.body.appendChild(toasts);
  function toast(title, body, kind) {
    var t = el('div', 'fx-toast ' + (kind || ''), '<b></b><span></span>');
    t.firstChild.textContent = title;
    t.lastChild.textContent = body;
    toasts.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 400); }, 3600);
    while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
  }
  var ach = {};
  try { ach = JSON.parse(store('arcade-ach') || '{}'); } catch (e) { ach = {}; }
  function unlock(id, name, desc) {
    if (ach[id]) return;
    ach[id] = 1;
    store('arcade-ach', JSON.stringify(ach));
    SFX.ach();
    toast('ACHIEVEMENT UNLOCKED', name + ' — ' + desc, 'ach');
  }

  /* ── HUD: XP bar, level, sprite, coins, buttons ── */
  var xp = el('div', 'fx-xp', '<i></i>');
  var bar = el('div', 'fx-bar');
  var lvEl = el('span', 'fx-lv', 'LV 01');
  var track = el('div', 'fx-track');
  var sprite = el('div', 'fx-sprite');
  var spriteBody = el('i');
  sprite.appendChild(spriteBody);
  track.appendChild(sprite);
  var coinEl = el('span', 'fx-coins', '● 0/7');
  var sndBtn = el('button', 'fx-btn', 'SND OFF');
  var menuBtn = el('button', 'fx-btn', 'MENU');
  sndBtn.type = 'button'; menuBtn.type = 'button';
  sndBtn.setAttribute('aria-pressed', 'false');
  bar.appendChild(lvEl); bar.appendChild(track); bar.appendChild(coinEl);
  bar.appendChild(sndBtn); bar.appendChild(menuBtn);
  document.body.appendChild(xp);
  document.body.appendChild(bar);

  /* 8x8 pixel hero, two walk frames, built as a box-shadow */
  var U = 3;
  var colorMap = { '1': '#f0a35e', '2': '#f2c9a0', '3': '#13141f', '4': '#6fd3c9', '5': '#8be0d7', '6': '#434a6b' };
  var FRAMES = [
    ['..1111..', '.111111.', '..3223..', '..2222..', '.445544.', '24455442', '..6..6..', '.66..66.'],
    ['..1111..', '.111111.', '..3223..', '..2222..', '.445544.', '24455442', '...66...', '...66...']
  ];
  function drawSprite(f) {
    var s = [];
    FRAMES[f].forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var c = colorMap[row.charAt(x)];
        if (c) s.push((x * U) + 'px ' + (y * U) + 'px 0 ' + c);
      }
    });
    spriteBody.style.boxShadow = s.join(',');
  }
  var frame = 0, walking = false, walkTimer = 0;
  drawSprite(0);
  setInterval(function () {
    if (walking) { frame = 1 - frame; drawSprite(frame); }
    else if (frame !== 0) { frame = 0; drawSprite(0); }
  }, 140);

  /* ── sections / levels ── */
  var NAMES = ['START', 'PLAYER SELECT', 'QUEST LOG', 'SKILL TREE', 'STAGES', 'TROPHY ROOM', 'FINAL STAGE'];
  var sections = $$('section');
  var level = 0, maxLevel = 0, lastY = 0;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function currentLevel() {
    var idx = 0, line = window.innerHeight * 0.45;
    sections.forEach(function (s, i) { if (s.getBoundingClientRect().top <= line) idx = i; });
    return idx;
  }
  function jump() {
    if (reduce) return;
    sprite.classList.remove('jump');
    void sprite.offsetWidth;
    sprite.classList.add('jump');
  }
  function spritePoint() {
    var r = sprite.getBoundingClientRect();
    return { x: r.left + 12, y: r.top };
  }
  function onLevel(i) {
    level = i;
    lvEl.textContent = 'LV ' + pad(i + 1);
    if (i > maxLevel) {
      maxLevel = i;
      SFX.level();
      toast('LEVEL UP!  LV ' + pad(i + 1), NAMES[i] || '', 'lvl');
      var p = spritePoint();
      burst(p.x, p.y, palette(), 14, 3);
      jump();
      if (i === sections.length - 1) unlock('end', 'FINAL STAGE', 'You made it to the end.');
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.pageYOffset;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, y / max));
      xp.firstChild.style.width = (p * 100).toFixed(1) + '%';
      sprite.style.setProperty('--p', p.toFixed(4));
      sprite.classList.toggle('left', y < lastY);
      lastY = y;
      walking = true;
      clearTimeout(walkTimer);
      walkTimer = setTimeout(function () { walking = false; }, 180);
      if (!reduce) document.body.style.backgroundPosition = '0 ' + (-y * 0.2).toFixed(1) + 'px, 0 ' + (-y * 0.2).toFixed(1) + 'px';
      var l = currentLevel();
      if (l !== level) onLevel(l);
      if (y > 40) unlock('start', 'HELLO, WORLD', 'You started scrolling.');
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ── coins ── */
  var COINS = 7;
  var coinsGot = 0;
  var gotIds = {};
  try { gotIds = JSON.parse(store('arcade-coins') || '{}'); } catch (e) { gotIds = {}; }
  coinsGot = Object.keys(gotIds).length;
  function showCoins() { coinEl.textContent = '● ' + coinsGot + '/' + COINS; }
  showCoins();

  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  for (var c = 0; c < COINS; c++) {
    (function (c) {
      if (gotIds[c]) return;
      var sec = sections[(c * 2 + 1) % sections.length];
      var b = el('button', 'fx-coin');
      b.type = 'button';
      b.setAttribute('aria-label', 'Collect coin');
      b.style.left = (5 + seeded(c + 1) * 88).toFixed(1) + '%';
      b.style.top = (12 + seeded(c + 7) * 74).toFixed(1) + '%';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var r = b.getBoundingClientRect();
        burst(r.left + 12, r.top + 12, ['#fbe08a', '#f0b94f', '#c98a2b'], 12, 3);
        b.remove();
        gotIds[c] = 1;
        store('arcade-coins', JSON.stringify(gotIds));
        coinsGot = Object.keys(gotIds).length;
        showCoins();
        SFX.coin();
        if (coinsGot === 3) unlock('coins3', 'POCKET CHANGE', 'Found 3 coins.');
        if (coinsGot === COINS) {
          unlock('coins7', 'COMPLETIONIST', 'All ' + COINS + ' coins found. Say hello!');
          burst(window.innerWidth / 2, window.innerHeight / 2, palette(), 60, 7, 5);
        }
      });
      sec.appendChild(b);
    })(c);
  }

  /* ── typewriter section titles ── */
  function titleNodes(h) {
    var out = [];
    (function walk(n) {
      Array.prototype.forEach.call(n.childNodes, function (ch) {
        if (ch.nodeType === 3) { if (ch.nodeValue.length) out.push([ch, ch.nodeValue]); }
        else walk(ch);
      });
    })(h);
    return out;
  }
  if (!reduce && 'IntersectionObserver' in window) {
    var titles = $$('.section-title');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var h = en.target, nodes = h._fx, i = 0, j = 0;
        h.classList.add('typing');
        (function step() {
          if (i >= nodes.length) { h.classList.remove('typing'); h.style.minHeight = ''; return; }
          var n = nodes[i];
          j++;
          n[0].nodeValue = n[1].slice(0, j);
          if (j >= n[1].length) { i++; j = 0; }
          setTimeout(step, 30);
        })();
      });
    }, { threshold: 0.6 });
    titles.forEach(function (h) {
      var r = h.getBoundingClientRect();
      if (r.top < window.innerHeight) return; // already on screen: leave as is
      h._fx = titleNodes(h);
      h.style.minHeight = h.offsetHeight + 'px';
      h._fx.forEach(function (n) { n[0].nodeValue = ''; });
      io.observe(h);
    });
  }

  /* ── hero hint ── */
  var cta = $('.hero-cta');
  if (cta) {
    var hint = el('div', 'fx-hint', '<b>▶</b> SCROLL TO PLAY · FIND <span>' + COINS + '</span> COINS · [ESC] MENU');
    cta.parentNode.insertBefore(hint, cta.nextSibling);
  }

  /* ── pause menu ── */
  var menu = el('div', 'fx-menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Pause menu');
  var menuBox = el('div', 'fx-menu-box', '<h3>PAUSE</h3><ul></ul><p>↑ ↓ MOVE · ENTER SELECT · ESC CLOSE</p>');
  menu.appendChild(menuBox);
  document.body.appendChild(menu);
  var menuList = $('ul', menuBox);
  var sel = 0, menuItems = [];

  function goto(i) {
    var t = sections[i];
    if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  function buildMenu() {
    menuItems = [];
    sections.forEach(function (s, i) {
      menuItems.push({ label: NAMES[i] || s.id.toUpperCase(), run: function () { goto(i); } });
    });
    menuItems.push({ label: 'SOUND: ' + (soundOn ? 'ON' : 'OFF'), run: toggleSound, keep: true });
    menuItems.push({ label: 'RESUME', run: function () {} });
    menuList.innerHTML = '';
    menuItems.forEach(function (it, i) {
      var li = el('li', i === sel ? 'sel' : '');
      li.textContent = it.label;
      li.addEventListener('mouseenter', function () { sel = i; paint(); });
      li.addEventListener('click', function () { choose(i); });
      menuList.appendChild(li);
    });
  }
  function paint() {
    $$('li', menuList).forEach(function (li, i) { li.classList.toggle('sel', i === sel); });
  }
  function choose(i) {
    var it = menuItems[i];
    SFX.select();
    it.run();
    if (it.keep) buildMenu(); else closeMenu();
  }
  function openMenu() {
    sel = level;
    buildMenu();
    menu.classList.add('open');
    unlock('menu', 'PAUSE MENU', 'You found the pause menu.');
  }
  function closeMenu() { menu.classList.remove('open'); }
  function menuOpen() { return menu.classList.contains('open'); }
  menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(); });
  menuBtn.addEventListener('click', function () { menuOpen() ? closeMenu() : openMenu(); });

  function toggleSound() {
    soundOn = !soundOn;
    sndBtn.textContent = 'SND ' + (soundOn ? 'ON' : 'OFF');
    sndBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) { var a = ac(); if (a && a.resume) a.resume(); SFX.select(); }
  }
  sndBtn.addEventListener('click', toggleSound);

  /* ── keyboard: menu, konami ── */
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var kpos = 0, cheat = false, cheatTimer = 0;
  function setCheat(on) {
    cheat = on;
    clearInterval(cheatTimer);
    if (on) {
      var h = 0;
      cheatTimer = setInterval(function () {
        h = (h + 6) % 360;
        root.style.setProperty('--accent', 'hsl(' + h + ',70%,68%)');
        root.style.setProperty('--accent2', 'hsl(' + ((h + 150) % 360) + ',80%,66%)');
      }, 80);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent2');
    }
  }
  document.addEventListener('keydown', function (e) {
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
    if (k === 'Escape' || k === 'm') { openMenu(); return; }

    if (k === KONAMI[kpos]) {
      kpos++;
      if (kpos === KONAMI.length) {
        kpos = 0;
        setCheat(!cheat);
        SFX.cheat();
        toast(cheat ? 'CHEAT MODE ON' : 'CHEAT MODE OFF', cheat ? 'Rainbow palette enabled.' : 'Back to normal.', 'ach');
        if (cheat) { unlock('konami', 'OLD SCHOOL', 'Entered the Konami code.'); burst(window.innerWidth / 2, window.innerHeight / 2, palette(), 70, 8, 5); }
      }
    } else {
      kpos = (k === KONAMI[0]) ? 1 : 0;
    }
  });

  /* ── clicks: particle burst, achievements ── */
  document.addEventListener('click', function (e) {
    burst(e.clientX, e.clientY, palette(), 8, 3);
    var a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (a) unlock('contact', 'CONTACT MADE', 'You reached out. Thanks!');
  });
  $$('.project-card').forEach(function (card) {
    card.addEventListener('mouseenter', function () { unlock('shop', 'WINDOW SHOPPER', 'You checked out a project.'); });
  });

  /* ── cursor trail ── */
  if (!reduce && finePointer) {
    var lastT = 0;
    window.addEventListener('mousemove', function (e) {
      var now = performance.now();
      if (now - lastT < 45) return;
      lastT = now;
      burst(e.clientX, e.clientY, [cssVar('--accent', '#6fd3c9')], 1, 0.6, 3);
    });
  }

  /* ── boot screen ── */
  function boot() {
    var b = el('div', 'fx-boot');
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Start screen');
    b.innerHTML =
      '<div class="fx-boot-inner">' +
      '<div class="fx-boot-top">INSERT COIN</div>' +
      '<h1>URIEL CRUZ</h1>' +
      '<p>Technical Designer · Unreal Engine 5</p>' +
      '<button type="button" class="fx-start">PRESS START</button>' +
      '<small>click or press any key · [ESC] pause menu</small>' +
      '</div>';
    document.body.appendChild(b);
    root.style.overflow = 'hidden';
    var btn = $('.fx-start', b);
    btn.focus();
    var done = false;
    function start() {
      if (done) return;
      done = true;
      store('arcade-booted', '1');
      SFX.boot();
      b.classList.add('out');
      root.style.overflow = '';
      document.removeEventListener('keydown', keyStart, true);
      setTimeout(function () { b.remove(); }, 400);
    }
    function keyStart(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      e.preventDefault();
      start();
    }
    b.addEventListener('click', start);
    document.addEventListener('keydown', keyStart, true);
  }
  if (!reduce && !store('arcade-booted')) boot();

  onScroll();
})();
