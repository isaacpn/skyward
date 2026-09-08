/* ==========================================================================
   Skyward - levels, screens, input, main loop
   ========================================================================== */

/* Levels are authored as one JSON file each under /levels. When the page is
   served over http the files are fetched at run time (drop in a new JSON,
   reload, it is in the game). Opened straight from disk, file:// blocks the
   fetch, so the same JSON is also baked in below by tools/build.sh. */
const EMBEDDED_LEVELS = /* __LEVELS__ */ [];

let LEVELS = EMBEDDED_LEVELS.slice();

/* The shared build sets this to true: there is no levels/ directory next to a
   published page, so it plays from the baked-in copy and skips the fetch. */
const EMBEDDED_ONLY = false;

async function loadLevels() {
  if (EMBEDDED_ONLY || !/^https?:$/.test(location.protocol)) return;
  try {
    const idx = await fetch('levels/index.json').then(r => r.json());
    const files = await Promise.all(idx.levels.map(f => fetch('levels/' + f).then(r => r.json())));
    if (files.length) LEVELS = files.sort((a, b) => a.id - b.id);
  } catch (e) {
    console.info('Using embedded levels (' + e.message + ')');
  }
}

/* ------------------------------------------------------------------ input */
const Input = {
  x: 0, y: 0, keys: {}, pointer: null,
  init() {
    addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') UI.togglePause();
      if (e.key.toLowerCase() === 'm') UI.toggleMute();
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.keys = {}; });

    const stage = $('app');
    stage.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.screen') || ev.target.closest('.btn-icon')) return;
      ev.preventDefault();
      this.pointer = Layout.toWorld(ev.clientX, ev.clientY).x;
      try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    stage.addEventListener('pointermove', ev => {
      if (this.pointer != null) this.pointer = Layout.toWorld(ev.clientX, ev.clientY).x;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t =>
      stage.addEventListener(t, () => { this.pointer = null; }));
    stage.addEventListener('contextmenu', ev => ev.preventDefault());
  },
  read() {
    let x = 0, y = 0;
    if (this.keys['arrowleft'] || this.keys['a']) x -= 1;
    if (this.keys['arrowright'] || this.keys['d']) x += 1;
    if (this.keys['arrowup'] || this.keys['w']) y -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) y += 1;
    if (this.pointer != null && Game.player) {
      /* steer toward the finger: it can sit low on the screen, out of the way
         of the balloon, and still aim it */
      const d = this.pointer - Game.player.x;
      x = clamp(d / (90 * Layout.kx), -1, 1);
    }
    this.x = x; this.y = y;
  }
};

/* --------------------------------------------------------------------- UI */
const UI = {
  screen: 'scTitle', current: 0, toastT: 0,

  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    this.screen = id;
    this.hudOn(id === null);
  },
  hide() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); this.screen = null; },
  hudOn(v) { $('hud').classList.toggle('on', !!v); },

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  },

  /* ---------------------------------------------------------- balloon -- */
  buildPicker() {
    const sw = $('swatches'); sw.innerHTML = '';
    COLOURS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw' + (c.id === Save.data.colour ? ' sel' : '');
      b.style.background = 'radial-gradient(circle at 34% 30%,' + c.hi + ',' + c.mid + ' 58%,' + c.lo + ')';
      b.title = c.name;
      b.onclick = () => { Save.data.colour = c.id; Save.write(); Sound.ui(); this.buildPicker(); };
      sw.appendChild(b);
    });
    const tw = $('types'); tw.innerHTML = '';
    TYPES.forEach(t => {
      const d = document.createElement('button');
      d.className = 'type' + (t.id === Save.data.type ? ' sel' : '');
      d.innerHTML = '<svg viewBox="-50 -100 100 116">' + balloonMarkup(t.id, Save.data.colour, {}) + '</svg>' +
        '<b>' + t.name + '</b><span>' + (t.stickers ? '+1 sticker' : 'r ' + t.r) + '</span>';
      d.onclick = () => { Save.data.type = t.id; Save.write(); Sound.ui(); this.buildPicker(); };
      tw.appendChild(d);
    });
    $('typeDesc').textContent = typeOf(Save.data.type).desc;
    $('titleBalloon').innerHTML = balloonMarkup(Save.data.type, Save.data.colour, { scale: 1.15 });
    $('titleBalloon').setAttribute('transform', 'translate(60,116)');
  },

  /* ---------------------------------------------------------- levels --- */
  buildLevels() {
    const grid = $('levelGrid'); grid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const locked = (i + 1) > Save.data.unlocked;
      const b = document.createElement('button');
      b.className = 'lv' + (locked ? ' locked' : '');
      const best = Save.data.best[L.id];
      b.innerHTML = '<div class="n">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="t">' + (locked ? 'Locked' : L.name) + '</div>' +
        '<div class="s">' + (locked ? '&#128274;' : (best ? 'best ' + best : L.targetAltitude + ' m')) + '</div>' +
        (best ? '<div class="star">&#11088;</div>' : '');
      if (!locked) b.onclick = () => { Sound.init(); Sound.ui(); this.brief(i); };
      grid.appendChild(b);
    });
  },

  brief(i) {
    this.current = i;
    const L = LEVELS[i];
    $('briefNo').textContent = 'Level ' + String(i + 1).padStart(2, '0');
    $('briefName').textContent = L.name;
    $('briefSub').textContent = L.subtitle || '';
    $('briefAlt').textContent = L.targetAltitude + ' m';
    const w = L.wind || {};
    const strength = Math.abs(w.base || 0) + (w.gust || 0);
    $('briefWind').textContent = strength < 15 ? 'calm' : strength < 60 ? 'light' :
      strength < 110 ? 'brisk' : strength < 160 ? 'strong' : 'violent';
    const haz = [...new Set((L.spawners || []).map(s => SPRITE_LABEL[s.sprite] || s.sprite))]
      .filter(h => h !== 'stickers' && h !== 'cloud');
    $('briefHaz').textContent = haz.join(', ');
    $('briefHint').textContent = L.hint || '';
    this.show('scBrief');
  },

  play(i) {
    this.current = i;
    this.hide();
    Game.start(LEVELS[i]);
    this.buildStickerPips();
    if (Layout.coarse && !this.taughtTouch) {
      this.taughtTouch = true;
      this.toast('drag anywhere to steer');
    }
  },

  buildStickerPips() {
    const row = $('stickerRow'); row.innerHTML = '';
    for (let i = 0; i < Game.maxStickers; i++) {
      const d = document.createElement('div');
      d.className = 'sticker-pip';
      row.appendChild(d);
    }
    this.syncStickers();
  },
  syncStickers() {
    const pips = $('stickerRow').children;
    for (let i = 0; i < pips.length; i++)
      pips[i].classList.toggle('spent', i >= Game.stickers);
  },

  syncHud(prog, speedFrac) {
    $('hudLevel').textContent = 'Level ' + String(this.current + 1).padStart(2, '0') + ' - ' + Game.level.name;
    $('hudAlt').textContent = Math.round(Game.alt) + ' / ' + Game.level.targetAltitude + ' m';
    $('hudScore').textContent = Math.round(Game.score);
    if (prog != null) $('altFill').style.height = (prog * 100).toFixed(1) + '%';
    if (speedFrac != null) $('speedFill').style.width = clamp(speedFrac * 100, 0, 100).toFixed(0) + '%';
  },

  togglePause() {
    if (Game.over) return;
    if (Game.running) {
      Game.running = false;
      $('pauseHint').textContent = Game.level.hint || '';
      this.show('scPause');
    } else if (this.screen === 'scPause') {
      this.hide();
      Game.running = true;
      this.hudOn(true);
    }
  },

  toggleMute() {
    const on = Sound.toggle();
    $('btnMute').innerHTML = on ? '&#128266;' : '&#128263;';
  },

  toggleFullscreen() {
    const app = $('app');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (app.requestFullscreen) app.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  },

  /* Losing focus on a phone means a call, a notification, or a swipe away.
     Freeze rather than let hail land on an unattended balloon. */
  autoPause() {
    if (Game.running && !Game.over) this.togglePause();
  },

  win(bonus, stickBonus) {
    const L = LEVELS[this.current];
    const isLast = this.current >= LEVELS.length - 1;
    $('winTitle').textContent = isLast ? 'You made it to the edge' : 'Altitude reached';
    $('winSub').textContent = isLast
      ? 'Nothing left above you but vacuum. Well flown.'
      : L.name + ' is behind you.';
    $('winAlt').textContent = Math.round(Game.alt) + ' m';
    $('winStick').textContent = Game.stickers + '  (+' + stickBonus + ')';
    $('winBonus').textContent = '+' + bonus;
    $('winScore').textContent = Math.round(Game.score);
    const isBest = Save.setBest(L.id, Math.round(Game.score));
    $('winBest').textContent = Save.data.best[L.id] + (isBest ? '  (new)' : '');
    Save.unlock(this.current + 2);
    $('btnNext').style.display = isLast ? 'none' : '';
    this.show('scWin');
    this.buildLevels();
  },

  lose() {
    const L = LEVELS[this.current];
    $('loseSub').textContent = Game.lastReason ? 'You were ' + Game.lastReason + '.' : 'The atmosphere won that one.';
    $('loseAlt').textContent = Math.round(Game.alt) + ' / ' + L.targetAltitude + ' m';
    $('loseScore').textContent = Math.round(Game.score);
    $('loseHint').textContent = L.hint || '';
    this.show('scLose');
  },

  quit() {
    Game.stop();
    this.buildLevels();
    this.show('scLevels');
  },

  bind() {
    const go = (id, fn) => { $(id).onclick = () => { Sound.init(); Sound.resume(); Sound.ui(); fn(); }; };
    go('btnPlay', () => { this.buildPicker(); this.show('scPick'); });
    go('btnHow', () => this.show('scHow'));
    go('btnHowBack', () => this.show('scTitle'));
    go('btnPickBack', () => this.show('scTitle'));
    go('btnPickGo', () => { this.buildLevels(); this.show('scLevels'); });
    go('btnLevelsBack', () => { this.buildPicker(); this.show('scPick'); });
    go('btnReset', () => { Save.reset(); this.buildLevels(); this.toast('progress reset'); });
    go('btnBriefBack', () => this.show('scLevels'));
    go('btnBriefGo', () => this.play(this.current));
    go('btnResume', () => this.togglePause());
    go('btnQuit', () => this.quit());
    go('btnNext', () => { this.brief(Math.min(this.current + 1, LEVELS.length - 1)); });
    go('btnWinLevels', () => this.quit());
    go('btnRetry', () => this.play(this.current));
    go('btnLoseLevels', () => this.quit());
    $('btnPause').onclick = () => this.togglePause();
    $('btnMute').onclick = () => { Sound.init(); this.toggleMute(); };

    const full = $('btnFull');
    if ($('app').requestFullscreen) {
      full.hidden = false;
      full.onclick = () => this.toggleFullscreen();
    }

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    addEventListener('blur', () => this.autoPause());

    let rt = 0;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => { Game.reflow(); if (Game.level) this.buildStickerPips(); }, 140);
    };
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);
  }
};

/* ------------------------------------------------------------- main loop */
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  Input.read();
  Game.tick(dt);
  requestAnimationFrame(frame);
}

(async function boot() {
  Save.load();
  Layout.apply();
  ensureBalloonGradients();
  await loadLevels();
  Input.init();
  UI.bind();
  UI.buildPicker();
  UI.buildLevels();
  requestAnimationFrame(frame);
})();
