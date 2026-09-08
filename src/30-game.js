/* ==========================================================================
   Skyward - simulation
   ========================================================================== */

/* Set by Layout.apply() for the current viewport */
let HOME_Y = 400;              // where the balloon rests vertically
let Y_MIN = 150, Y_MAX = 520;

const Game = {
  level: null, running: false, over: false,
  t: 0, alt: 0, score: 0, slip: 0, stickers: 3, maxStickers: 5,
  invuln: 0, wind: 0, shakeT: 0,
  ents: [], parts: [], bands: [],
  player: null, playerEl: null, spawners: [],

  /* ------------------------------------------------------------- start -- */
  start(level) {
    Layout.apply();
    this.level = level;
    this.t = 0; this.alt = 0; this.score = 0; this.slip = 0;
    this.over = false; this.running = true; this.invuln = 0; this.wind = 0;
    const ty = typeOf(Save.data.type);
    this.maxStickers = 5;
    this.stickers = clamp((level.startStickers || 3) + (ty.stickers || 0), 1, this.maxStickers);
    this.initialStickers = this.stickers;

    this.ents.length = 0; this.parts.length = 0; this.bands.length = 0;
    ['lBg', 'lParts', 'lWorld', 'lPlayer', 'lFx'].forEach(id => { $(id).innerHTML = ''; });

    this.buildBackground(level.theme);
    this.buildParticles(level.theme);
    this.buildPlayer();
    this.computeEase();

    this.spawners = (level.spawners || []).map(s => ({
      def: s,
      next: rand(0.4, 1.4) + (s.delay || 0),
      from: s.from == null ? 0 : s.from,
      to: s.to == null ? 1 : s.to
    }));

    Sound.init(); Sound.resume();
    Sound.windStart(0.2);
    UI.hudOn(true);
    UI.syncHud();
  },

  stop() {
    this.running = false;
    Sound.windStop();
  },

  /* How crowded this field is compared with the 800x600 one the levels were
     tuned on. A short landscape phone fits the same hazards into less room,
     so it gets fewer of them; a tall portrait field is already roomier than
     baseline and is left alone rather than made denser. */
  computeEase() {
    const ty = this.player.ty;
    const rBase = ty.r * 0.62 + 3;
    const pressure = (this.player.r * this.player.r) / (W * H) *
                     (BASE_W * BASE_H) / (rBase * rBase);
    this.ease = clamp(pressure, 1, 1.35);
    return this.ease;
  },

  /* Rotate the phone, resize the window, open the keyboard: the field changes
     shape under a live game. Rescale everything in place rather than
     restarting, so a run is never lost to an orientation change. */
  reflow() {
    const oldW = W, oldH = H;
    Layout.apply();
    if (!this.level) return;
    const fx = W / oldW, fy = H / oldH;

    $('lBg').innerHTML = '';
    $('lParts').innerHTML = '';
    this.bands.length = 0;
    this.parts.length = 0;
    this.buildBackground(this.level.theme);
    this.buildParticles(this.level.theme);

    for (const e of this.ents) {
      e.x *= fx; e.baseX *= fx; e.y *= fy;
      e.speed *= fy; e.drift *= fx; e.push *= fx; e.chase *= fx;
      if (e.sway) e.sway.amp *= fx;
      if (e.kind === 'barrier') {
        /* the band spans the field, so it has to be redrawn at the new width */
        e.gap *= fx; e.gapX *= fx; e.h = 34 * Layout.ky;
        e.el.innerHTML = SPRITES.barrier.make({ gap: e.gap, gapX: e.gapX, style: e.props.style });
      } else if (e.kind === 'bolt') {
        e.width *= fx;
        e.el.innerHTML = SPRITES.bolt.make({ width: e.width });
        e.el.setAttribute('transform', 'translate(' + e.x.toFixed(1) + ',0)');
        if (e.phase === 'strike') {
          e.el.querySelector('.warn').style.display = 'none';
          e.el.querySelector('.strike').style.display = '';
        }
      }
    }
    const p = this.player;
    p.x = clamp(p.x * fx, p.r, W - p.r);
    p.y = clamp(p.y * fy, Y_MIN, Y_MAX);
    p.accel = 1750 * p.ty.accel * Layout.kx;
    p.top = 380 * p.ty.top * Layout.kx;
    this.balloonScale = 0.62 * Layout.k;
    p.r = p.ty.r * this.balloonScale + 3;
    this.redrawPlayer();
    this.computeEase();
  },

  /* -------------------------------------------------------- background -- */
  buildBackground(th) {
    const bg = $('lBg'), defs = $('defs');
    const old = $('skyGrad'); if (old) old.remove();
    const lg = el('linearGradient', { id: 'skyGrad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': th.sky[0] }, lg);
    el('stop', { offset: '100%', 'stop-color': th.sky[1] }, lg);

    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#skyGrad)' }, bg);

    if (th.sun) {
      const sx = W * 0.8, sy = H * 0.2;
      bg.appendChild(gfx('<g><circle cx="' + sx + '" cy="' + sy + '" r="86" fill="#fff6c9" opacity=".28"/>' +
        '<circle cx="' + sx + '" cy="' + sy + '" r="44" fill="#fff3ad" opacity=".85"/></g>'));
    } else if (th.light === 'night') {
      const mx = W * 0.19, my = H * 0.18;
      bg.appendChild(gfx('<g><circle cx="' + mx + '" cy="' + my + '" r="46" fill="#e9f1ff" opacity=".9"/>' +
        '<circle cx="' + (mx - 18) + '" cy="' + (my - 12) + '" r="40" fill="' + th.sky[0] + '" opacity=".9"/></g>'));
    }

    /* parallax cloud bands */
    const n = th.cloudBands || 3;
    const bandLayer = el('g', { id: 'bands', opacity: th.light === 'storm' ? '.55' : '.75' }, bg);
    for (let i = 0; i < n; i++) {
      const depth = 0.18 + (i / n) * 0.5;
      const tone = th.light === 'storm' ? '#5c6d84' : th.light === 'night' ? '#2b3557' : '#ffffff';
      const g = gfx('<g opacity="' + (0.28 + depth * 0.5) + '">' +
        '<ellipse cx="-70" cy="0" rx="' + (70 + i * 18) + '" ry="' + (22 + i * 6) + '" fill="' + tone + '"/>' +
        '<ellipse cx="10" cy="-12" rx="' + (95 + i * 20) + '" ry="' + (30 + i * 8) + '" fill="' + tone + '"/>' +
        '<ellipse cx="90" cy="2" rx="' + (66 + i * 16) + '" ry="' + (20 + i * 5) + '" fill="' + tone + '"/></g>');
      bandLayer.appendChild(g);
      this.bands.push({ el: g, x: rand(0, W), y: rand(-200, H), sp: 12 + depth * 34, sc: 0.7 + depth });
    }

    /* storm flash plate */
    if (th.flash) {
      const f = el('rect', { id: 'flashPlate', x: 0, y: 0, width: W, height: H, fill: '#fff', opacity: 0 }, $('lFx'));
      this.flashPlate = f;
    } else this.flashPlate = null;
  },

  buildParticles(th) {
    const kind = th.particles || 'none';
    if (kind === 'none') return;
    const layer = $('lParts');
    const base = { rain: 90, snow: 70, leaves: 26, pollen: 44, dust: 40, stars: 60 }[kind] || 40;
    /* keep the density per unit area, not per screen */
    const count = Math.round(clamp(base * (W * H) / (BASE_W * BASE_H), 12, base * 1.4));
    for (let i = 0; i < count; i++) {
      let m;
      if (kind === 'rain') m = '<path d="M0,0 l-2,14" stroke="#cfe6f7" stroke-width="1.6" opacity=".7"/>';
      else if (kind === 'snow') m = '<circle r="' + rand(1.2, 2.6).toFixed(1) + '" fill="#fff" opacity=".85"/>';
      else if (kind === 'leaves') m = '<path d="M0,-5 C5,-2 5,3 0,6 C-5,3 -5,-2 0,-5 Z" fill="' +
        pick(['#d9622b', '#e39a2b', '#9c8b2f']) + '" opacity=".8"/>';
      else if (kind === 'pollen') m = '<circle r="' + rand(1, 2.4).toFixed(1) + '" fill="#fff6c9" opacity=".8"/>';
      else if (kind === 'stars') m = '<circle r="' + rand(0.8, 1.9).toFixed(1) + '" fill="#fff" opacity="' + rand(.4, 1).toFixed(2) + '"/>';
      else m = '<circle r="1.6" fill="#ffffff" opacity=".45"/>';
      const e = gfx(m);
      layer.appendChild(e);
      this.parts.push({
        el: e, x: rand(0, W), y: rand(0, H), kind,
        sp: (kind === 'rain' ? rand(430, 620) : kind === 'stars' ? rand(6, 18) : rand(40, 130)) * Layout.ky,
        dx: rand(-20, 20) * Layout.kx, ph: rand(0, 6.3)
      });
    }
  },

  buildPlayer() {
    const ty = typeOf(Save.data.type);
    this.balloonScale = 0.62 * Layout.k;
    const g = gfx(balloonMarkup(ty.id, Save.data.colour, { scale: this.balloonScale }));
    $('lPlayer').appendChild(g);
    this.playerEl = g;
    this.player = {
      x: W / 2, y: HOME_Y, vx: 0, vy: 0,
      r: ty.r * this.balloonScale + 3, ty,
      accel: 1750 * ty.accel * Layout.kx, drag: ty.drag, top: 380 * ty.top * Layout.kx
    };
    this.redrawPlayer();
  },

  /* Patches on the skin show how many pricks have already been survived. */
  redrawPlayer() {
    const ty = this.player.ty;
    const patched = clamp((this.initialStickers || 0) - this.stickers, 0, 5);
    this.playerEl.innerHTML = balloonMarkup(ty.id, Save.data.colour,
      { scale: this.balloonScale, patches: patched });
  },

  /* --------------------------------------------------------------- tick -- */
  tick(dt) {
    if (!this.running) return;
    const L = this.level, p = this.player;
    this.t += dt;

    /* wind */
    const wnd = L.wind || { base: 0, gust: 0, period: 8 };
    this.wind = (wnd.base || 0) + (wnd.gust || 0) * Math.sin(this.t * 2 * Math.PI / (wnd.period || 8));
    Sound.windSet(0.15 + Math.abs(this.wind) / 220);

    /* ---- input and horizontal movement (the skill) ---- */
    let ax = Input.x * p.accel + this.wind * 2.2 * Layout.kx;
    p.vx += ax * dt;
    p.vx -= p.vx * p.drag * dt;
    p.vx = clamp(p.vx, -p.top * 1.4, p.top * 1.4);
    p.x += p.vx * dt;
    if (p.x < p.r + 6) { p.x = p.r + 6; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x > W - p.r - 6) { p.x = W - p.r - 6; p.vx = -Math.abs(p.vx) * 0.3; }

    /* vertical nudge, springs back to the resting line */
    p.vy += (Input.y * 520 * Layout.ky - (p.y - HOME_Y) * 1.9) * dt;
    p.vy -= p.vy * 3.4 * dt;
    p.y = clamp(p.y + p.vy * dt, Y_MIN, Y_MAX);

    /* ---- altitude, rewarded for lateral speed ---- */
    const speedFrac = clamp(Math.abs(p.vx) / p.top, 0, 1.2);
    const climb = L.climb * (1 + 0.5 * speedFrac);
    this.alt += climb * dt;
    if (speedFrac > 0.65) { this.slip += dt; this.score += 26 * dt; }
    this.score += 9 * dt;

    if (this.invuln > 0) this.invuln -= dt;

    /* ---- spawning ---- */
    const prog = clamp(this.alt / L.targetAltitude, 0, 1);
    for (const sp of this.spawners) {
      if (prog < sp.from || prog > sp.to) continue;
      sp.next -= dt;
      if (sp.next <= 0) {
        const d = sp.def;
        sp.next = ((d.every || 2) + rand(-(d.jitter || 0), d.jitter || 0)) * this.ease;
        if (sp.next < 0.25) sp.next = 0.25;
        const count = d.count || 1, spread = (d.spread || 0) * Layout.kx;
        const baseX = rand(W * 0.09, W * 0.91);
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? (i - (count - 1) / 2) * spread : 0;
          this.spawn(d.sprite, d.props || {}, baseX + off);
        }
      }
    }

    this.updateBackground(dt);
    this.updateEntities(dt);
    this.updateParticles(dt);

    /* ---- render player ---- */
    const tilt = clamp(p.vx / p.top, -1, 1) * 22;
    const blink = this.invuln > 0 && (Math.sin(this.t * 32) > 0);
    const knot = 48 * this.balloonScale;   /* the balloon hangs above the knot */
    this.playerEl.setAttribute('transform',
      'translate(' + p.x.toFixed(1) + ',' + (p.y + knot).toFixed(1) + ') rotate(' + (-tilt).toFixed(1) + ')');
    this.playerEl.setAttribute('opacity', blink ? 0.35 : 1);

    UI.syncHud(prog, speedFrac);

    if (this.alt >= L.targetAltitude) this.win();
  },

  updateBackground(dt) {
    const scroll = this.level.scroll * Layout.ky;
    for (const b of this.bands) {
      b.y += (b.sp * Layout.ky + scroll * 0.28) * dt;
      b.x += this.wind * Layout.kx * 0.35 * dt;
      if (b.y > H + 120) { b.y = -140; b.x = rand(-60, W + 60); }
      if (b.x < -260) b.x = W + 200; if (b.x > W + 260) b.x = -200;
      b.el.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ') scale(' + b.sc.toFixed(2) + ')');
    }
  },

  updateParticles(dt) {
    const scroll = this.level.scroll * Layout.ky;
    for (const q of this.parts) {
      if (q.kind === 'stars') {
        q.y += (q.sp + scroll * 0.08) * dt;
      } else {
        q.y += (q.sp + scroll * 0.5) * dt;
        q.x += (q.dx + this.wind * Layout.kx * 1.5) * dt;
        if (q.kind === 'leaves' || q.kind === 'pollen')
          q.x += Math.sin(this.t * 2 + q.ph) * 18 * Layout.kx * dt;
      }
      if (q.y > H + 20) { q.y = -20; q.x = rand(-40, W + 40); }
      if (q.x < -40) q.x = W + 30; if (q.x > W + 40) q.x = -30;
      q.el.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + ')');
    }
  },

  /* -------------------------------------------------------------- spawn -- */
  spawn(name, props, x) {
    const def = SPRITES[name];
    if (!def) { console.warn('unknown sprite "' + name + '" in level ' + this.level.id); return; }
    const p = Object.assign({}, props);
    const kx = Layout.kx, ky = Layout.ky;
    const sc = (p.scale || 1) * Layout.k;
    const e = {
      name, def, kind: def.kind, t: 0, sc,
      x: x, baseX: x, y: -70 * ky, r: (def.r || 0) * sc,
      speed: (p.speed || 0) * ky, drift: (p.drift || 0) * kx,
      sway: p.sway ? { amp: p.sway.amp * kx, freq: p.sway.freq } : null,
      push: (p.push || 0) * kx, lift: p.lift || 0,
      chase: (p.chase || 0) * kx, damage: p.damage == null ? 1 : p.damage,
      h: (def.h || 0) * sc, dead: false, phase: 'live', props: p
    };

    if (name === 'barrier') {
      /* the gap scales with the field, but never below what the balloon can
         physically fit through with room to aim */
      const gap = Math.max((p.gap || 180) * kx * this.ease, this.player.r * 5.2);
      e.gap = gap;
      const edge = gap / 2 + 24 * kx;
      e.gapX = clamp(rand(edge, W - edge), edge, W - edge);
      /* push the gap away from where the player currently is: that is the test */
      if (Math.abs(e.gapX - this.player.x) < W * 0.24) {
        e.gapX = this.player.x < W / 2
          ? clamp(this.player.x + rand(W * 0.3, W * 0.54), edge, W - edge)
          : clamp(this.player.x - rand(W * 0.3, W * 0.54), edge, W - edge);
      }
      e.x = 0; e.baseX = 0;
      e.y = -50 * ky;
      e.h = 34 * ky;
      e.el = gfx(def.make({ gap: gap, gapX: e.gapX, style: p.style }));
      e.warned = false;
    } else if (name === 'bolt') {
      e.width = (p.width || 30) * kx;
      e.x = clamp(rand(W * 0.08, W * 0.92), e.width, W - e.width);
      e.baseX = e.x; e.y = 0;
      e.warn = p.warn || 1; e.strike = p.strike || 0.3;
      e.el = gfx(def.make({ width: e.width }));
      e.el.setAttribute('transform', 'translate(' + e.x.toFixed(1) + ',0)');
      Sound.zap();
    } else if (def.kind === 'zone') {
      e.h = def.h * sc;
      e.dir = Math.random() < 0.5 ? -1 : 1;
      e.el = gfx(def.make({ dir: e.dir }));
      if (name === 'gust') Sound.whoosh();
    } else {
      e.el = gfx(def.make(p));
      e.rot = rand(0, 360);
      e.spin = rand(-90, 90);
    }
    e.el.setAttribute('class', (e.el.getAttribute('class') || '') + ' ent');
    $('lWorld').appendChild(e.el);
    this.ents.push(e);
  },

  /* ----------------------------------------------------------- entities -- */
  updateEntities(dt) {
    const L = this.level, p = this.player;
    const scroll = L.scroll * Layout.ky;
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const e = this.ents[i];
      e.t += dt;

      if (e.kind === 'bolt') {
        this.updateBolt(e, dt);
        if (e.dead) { e.el.remove(); this.ents.splice(i, 1); }
        continue;
      }

      /* vertical: world scroll plus the entity's own fall speed */
      e.y += (scroll + e.speed) * dt;

      if (e.kind === 'barrier') {
        e.el.setAttribute('transform', 'translate(0,' + e.y.toFixed(1) + ')');
        if (!e.warned && e.y > -20) { e.warned = true; }
        this.hitBarrier(e);
      } else {
        e.baseX += (e.drift + this.wind * Layout.kx * (e.kind === 'soft' ? 1.4 : 0.35)) * dt;
        if (e.chase) {
          const dir = Math.sign(p.x - e.baseX);
          e.baseX += dir * e.chase * dt;
        }
        e.x = e.baseX + (e.sway ? e.sway.amp * Math.sin(e.t * e.sway.freq * 6.283) : 0);
        let tr = 'translate(' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + ')';
        if (e.name === 'meteor') {
          /* meteors point along their own travel */
          tr += ' rotate(' + (Math.atan2(scroll + e.speed, e.drift) * 57.3).toFixed(1) + ')';
        } else if (e.rot != null && e.def.spin !== false && e.kind !== 'zone' && e.kind !== 'decor') {
          e.rot += e.spin * dt;
          tr += ' rotate(' + e.rot.toFixed(1) + ')';
        }
        if (e.sc !== 1) tr += ' scale(' + e.sc.toFixed(3) + ')';
        e.el.setAttribute('transform', tr);
        this.hitEntity(e, dt);
      }

      if (e.y > H + 140 * Layout.ky || e.dead) {
        e.el.remove();
        this.ents.splice(i, 1);
        if (!e.dead && e.kind === 'hazard') this.score += 12;   /* dodged */
      }
    }
  },

  updateBolt(e, dt) {
    if (e.phase === 'live') {
      e.warn -= dt;
      if (e.warn <= 0) {
        e.phase = 'strike';
        e.el.querySelector('.warn').style.display = 'none';
        e.el.querySelector('.strike').style.display = '';
        Sound.thunder();
        this.flash(0.72);
        this.shake();
      }
    } else if (e.phase === 'strike') {
      e.strike -= dt;
      const p = this.player;
      const w = e.width / 2 + p.r * 0.55;
      if (Math.abs(p.x - e.x) < w) this.hurt('struck by lightning');
      if (e.strike <= 0) e.dead = true;
    }
  },

  hitBarrier(e) {
    const p = this.player;
    const half = (e.h || 30) / 2;
    if (Math.abs(p.y - e.y) > half + p.r * 0.85) return;
    const gs = e.gapX - e.gap / 2, ge = e.gapX + e.gap / 2;
    const inside = (p.x - p.r * 0.7) > gs && (p.x + p.r * 0.7) < ge;
    if (!inside) this.hurt('clipped a wall');
    else if (!e.scored) { e.scored = true; this.score += 90; UI.toast('threaded it  +90'); }
  },

  hitEntity(e, dt) {
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y;

    if (e.kind === 'zone') {
      if (Math.abs(dy) < e.h / 2 + p.r) {
        if (e.lift) {                       /* updraft: free altitude, gentle lift */
          this.alt += e.lift * dt;
          p.vy -= 150 * Layout.ky * dt;
          if (!e.scored) { e.scored = true; UI.toast('updraft'); }
        } else {                            /* gust: shoves you sideways */
          p.vx += e.dir * (e.push || 200) * dt;
        }
      }
      return;
    }
    if (e.kind === 'decor') return;

    const rr = e.r + p.r * 0.8;
    if (dx * dx + dy * dy > rr * rr) return;

    if (e.kind === 'pickup') {
      e.dead = true;
      if (this.stickers < this.maxStickers) {
        this.stickers++;
        UI.toast('sticker  +1');
        this.redrawPlayer();
      } else {
        this.score += 150;
        UI.toast('spare sticker  +150');
      }
      this.score += 60;
      Sound.pickup();
      UI.syncStickers();
      return;
    }
    if (e.kind === 'soft') {                /* leaves shove, never puncture */
      const d = Math.max(12, Math.hypot(dx, dy));
      p.vx += (dx / d) * (e.push || 60) * dt * 3;
      p.vy += (dy / d) * (e.push || 60) * dt;
      return;
    }
    if (e.kind === 'hazard' && e.damage > 0) {
      e.dead = true;
      this.hurt('hit by ' + (SPRITE_LABEL[e.name] || e.name));
    }
  },

  /* -------------------------------------------------------------- harm -- */
  hurt(reason) {
    if (this.invuln > 0 || this.over) return;
    this.lastReason = reason;
    if (this.stickers > 0) {
      this.stickers--;
      this.invuln = 1.5;
      Sound.prick();
      this.shake();
      this.puff(this.player.x, this.player.y);
      UI.toast('patched  -1 sticker');
      this.redrawPlayer();
      UI.syncStickers();
    } else {
      this.popBalloon();
    }
  },

  popBalloon() {
    this.over = true;
    this.running = false;
    Sound.pop();
    this.shake();
    const c = colourOf(Save.data.colour);
    const p = this.player;
    this.playerEl.setAttribute('opacity', 0);
    const fx = $('lFx');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.283 + rand(-0.2, 0.2);
      const dist = rand(60, 190);
      const s = gfx('<path d="M0,0 q6,-9 13,-3 q-4,9 -13,3 Z" fill="' + (i % 2 ? c.mid : c.lo) + '"/>');
      fx.appendChild(s);
      s.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      const an = el('animateTransform', {
        attributeName: 'transform', type: 'translate', dur: '0.75s', fill: 'freeze',
        from: p.x + ',' + p.y,
        to: (p.x + Math.cos(a) * dist).toFixed(0) + ',' + (p.y + Math.sin(a) * dist + 80).toFixed(0)
      }, s);
      el('animate', { attributeName: 'opacity', from: '1', to: '0', dur: '0.75s', fill: 'freeze' }, s);
      if (an.beginElement) an.beginElement();
    }
    this.flash(0.35);
    setTimeout(() => { Sound.lose(); UI.lose(); }, 780);
  },

  puff(x, y) {
    const g = gfx('<circle r="4" fill="#fff" opacity=".9"/>');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    $('lFx').appendChild(g);
    const c = g.firstChild;
    el('animate', { attributeName: 'r', from: '4', to: '38', dur: '.45s', fill: 'freeze' }, c);
    el('animate', { attributeName: 'opacity', from: '.9', to: '0', dur: '.45s', fill: 'freeze' }, c);
    setTimeout(() => g.remove(), 500);
  },

  flash(v) {
    if (!this.flashPlate) {
      this.flashPlate = el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff', opacity: 0 }, $('lFx'));
    }
    const f = this.flashPlate;
    f.setAttribute('opacity', v);
    const fade = () => {
      let o = parseFloat(f.getAttribute('opacity'));
      o -= 0.06;
      f.setAttribute('opacity', Math.max(0, o));
      if (o > 0) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  },

  shake() {
    const app = $('app');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  },

  /* --------------------------------------------------------------- win -- */
  win() {
    if (this.over) return;
    this.over = true;
    this.running = false;
    Sound.windStop();
    Sound.win();
    const bonus = Math.round(this.slip * 55);
    const stickBonus = this.stickers * 200;
    this.score = Math.round(this.score + bonus + stickBonus);
    UI.win(bonus, stickBonus);
  }
};
