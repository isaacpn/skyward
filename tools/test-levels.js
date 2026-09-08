/* ==========================================================================
   Skyward - level test harness

   Paste this whole file into the browser console with the game open, then:

     await SkywardTest.run()          // every level, current viewport
     await SkywardTest.run({from: 5, to: 7, runs: 3})

   It plays each level with a simple avoidance bot and reports whether the
   level is completable, how long it takes, how much damage the bot takes and
   whether anything threw. Static checks catch level JSON that refers to a
   sprite or barrier style that does not exist.
   ========================================================================== */
window.SkywardTest = {

  KNOWN_STYLES: ['hedge', 'string', 'hail', 'ice', 'thorn', 'laser'],

  /* Level JSON is hand-written, so check it before simulating anything. */
  lint(L) {
    const problems = [];
    (L.spawners || []).forEach(s => {
      if (!SPRITES[s.sprite]) problems.push('unknown sprite: ' + s.sprite);
      const st = s.props && s.props.style;
      if (st && !this.KNOWN_STYLES.includes(st)) problems.push('unknown barrier style: ' + st);
      if (s.sprite === 'barrier' && !(s.props && s.props.gap)) problems.push('barrier with no gap');
      if ((s.every || 2) <= 0) problems.push('non-positive spawn interval');
    });
    if (!L.targetAltitude || !L.climb) problems.push('missing targetAltitude or climb');
    if (!L.theme || !L.theme.sky) problems.push('missing theme.sky');
    return problems;
  },

  /* Steers away from whatever is closest and most lethal. Deliberately not a
     great player: it reads one threat at a time, like a person would. */
  bot() {
    const p = Game.player;
    if (!p) return 0;
    let target = p.x;

    const barrier = Game.ents
      .filter(e => e.kind === 'barrier' && e.y < p.y && e.y > -H * 0.3)
      .sort((a, b) => b.y - a.y)[0];

    if (barrier) {
      target = barrier.gapX;                       // thread the gap
    } else {
      const bolt = Game.ents.find(e => e.kind === 'bolt' && Math.abs(e.x - p.x) < W * 0.12);
      if (bolt) {
        target = bolt.x < W / 2 ? bolt.x + W * 0.28 : bolt.x - W * 0.28;
      } else {
        const threat = Game.ents
          .filter(e => e.kind === 'hazard' && e.y < p.y && e.y > p.y - H * 0.45)
          .map(e => ({ e, d: Math.abs(e.x - p.x) }))
          .sort((a, b) => a.d - b.d)[0];
        if (threat && threat.d < W * 0.12) {
          target = threat.e.x < p.x ? p.x + W * 0.22 : p.x - W * 0.22;
        }
      }
    }
    target = clamp(target, p.r + 8, W - p.r - 8);
    return clamp((target - p.x) / (60 * Layout.kx), -1, 1);
  },

  /* One run of one level, stepped by hand so it does not take real minutes. */
  playOnce(index, maxSeconds) {
    const errors = [];
    const onError = ev => errors.push(String(ev.message || ev.reason));
    addEventListener('error', onError);
    addEventListener('unhandledrejection', onError);

    const realTick = Game.tick.bind(Game);
    Game.tick = () => {};                 // stop requestAnimationFrame double-stepping
    const realToast = UI.toast.bind(UI);
    UI.toast = () => {};                  // no DOM animation churn per pickup

    let hits = 0;
    const realHurt = Game.hurt.bind(Game);
    Game.hurt = r => { const before = Game.stickers; realHurt(r); if (Game.stickers < before || Game.over) hits++; };

    UI.play(index);

    const dt = 1 / 50;
    let t = 0, peakEnts = 0;
    try {
      while (t < maxSeconds && Game.running) {
        Input.x = this.bot();
        Input.y = 0;
        realTick(dt);
        t += dt;
        if (Game.ents.length > peakEnts) peakEnts = Game.ents.length;
      }
    } catch (e) {
      errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]);
    }

    const outcome = UI.screen === 'scWin' ? 'cleared'
      : Game.over ? 'popped'
      : 'timeout';

    Game.tick = realTick;
    UI.toast = realToast;
    Game.hurt = realHurt;
    Game.stop();
    removeEventListener('error', onError);
    removeEventListener('unhandledrejection', onError);

    return {
      outcome,
      seconds: +t.toFixed(1),
      altitude: Math.round(Game.alt),
      stickers: Game.stickers,
      hits,
      peakEnts,
      leaked: Game.ents.length,
      errors
    };
  },

  async run(opts) {
    const o = Object.assign({ from: 1, to: LEVELS.length, runs: 2, maxSeconds: 150 }, opts);
    const unlocked = Save.data.unlocked;
    Save.data.unlocked = LEVELS.length;

    const rows = [];
    for (let i = o.from - 1; i < o.to; i++) {
      const L = LEVELS[i];
      const lint = this.lint(L);
      const runs = [];
      for (let r = 0; r < o.runs; r++) runs.push(this.playOnce(i, o.maxSeconds));
      await new Promise(r => setTimeout(r, 0));   // let the page breathe

      const cleared = runs.filter(r => r.outcome === 'cleared').length;
      rows.push({
        level: String(i + 1).padStart(2, '0') + ' ' + L.name,
        field: W + 'x' + H,
        cleared: cleared + '/' + runs.length,
        secs: runs.map(r => r.seconds).join('/'),
        hits: runs.map(r => r.hits).join('/'),
        left: runs.map(r => r.stickers).join('/'),
        peak: Math.max(...runs.map(r => r.peakEnts)),
        leaked: Math.max(...runs.map(r => r.leaked)),
        lint: lint.length ? lint.join('; ') : '-',
        errors: runs.flatMap(r => r.errors).join(' | ') || '-'
      });
    }

    Save.data.unlocked = unlocked;
    UI.show('scLevels');
    console.table(rows);
    return rows;
  }
};
