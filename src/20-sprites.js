/* ==========================================================================
   Skyward - sprite registry
   Every hazard, pickup and zone is defined here as pure SVG markup plus the
   handful of numbers the simulation needs. A level JSON only ever refers to
   a sprite by name, so adding a hazard means adding one entry below.

   kind:   'hazard' (pops you) | 'soft' (shoves you) | 'zone' | 'pickup' |
           'decor' | 'barrier' | 'bolt'
   r:      collision radius in world units (barriers and bolts use bands)
   ========================================================================== */

const SPRITES = {

  /* ------------------------------------------------------------- birds -- */
  bird: {
    kind: 'hazard', r: 15, spin: false,
    make: () => '<g class="flap">' +
      '<path d="M-19,0 C-12,-11 -5,-11 0,-2 C5,-11 12,-11 19,0 C11,-3 5,-1 0,4 C-5,-1 -11,-3 -19,0 Z" fill="#3b4a63"/>' +
      '<ellipse cx="0" cy="2" rx="7" ry="5.5" fill="#4f6383"/>' +
      '<circle cx="3" cy="0.5" r="1.4" fill="#fff"/>' +
      '<path d="M7,2 L14,4 L7,5.5 Z" fill="#ffb03a"/></g>'
  },

  /* -------------------------------------------------------------- soft -- */
  leaf: {
    kind: 'soft', r: 13,
    make: () => {
      const c = pick(['#d9622b', '#e39a2b', '#b8452a', '#8a9c2f', '#c9762a']);
      return '<path d="M0,-13 C11,-7 12,7 0,14 C-12,7 -11,-7 0,-13 Z" fill="' + c + '"/>' +
             '<path d="M0,-11 L0,12" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>';
    }
  },
  cloud: {
    kind: 'decor', r: 46,
    make: () => '<g opacity=".8"><ellipse cx="-22" cy="4" rx="24" ry="16" fill="#fff"/>' +
      '<ellipse cx="4" cy="-6" rx="30" ry="21" fill="#fff"/>' +
      '<ellipse cx="28" cy="6" rx="22" ry="14" fill="#fff"/></g>'
  },

  /* ------------------------------------------------------------ sharps -- */
  twig: {
    kind: 'hazard', r: 16,
    make: () => '<g><path d="M-20,-6 L20,6" stroke="#6b4a2b" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M-4,0 L-12,-12 M6,2 L14,-9" stroke="#6b4a2b" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M20,6 L27,9" stroke="#8a6134" stroke-width="3" stroke-linecap="round"/></g>'
  },
  kite: {
    kind: 'hazard', r: 20, spin: false,
    make: () => {
      const c = pick(['#ff5d7a', '#3fb8ff', '#ffc94d', '#7ed957', '#c07dff']);
      return '<g><path d="M0,-22 L16,0 L0,22 L-16,0 Z" fill="' + c + '" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>' +
        '<path d="M0,-22 L0,22 M-16,0 L16,0" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>' +
        '<path d="M0,22 C6,30 -6,38 0,46" fill="none" stroke="#e8eef7" stroke-width="1.4"/>' +
        '<path d="M-4,28 L4,32 M-4,38 L4,42" stroke="' + c + '" stroke-width="2.5"/></g>';
    }
  },
  hail: {
    kind: 'hazard', r: 11,
    make: () => '<g><path d="M0,-11 L9,-5 L9,6 L0,11 L-9,6 L-9,-5 Z" fill="#dff0ff" stroke="#9dc4de" stroke-width="1.4"/>' +
      '<path d="M-4,-5 L2,-1 L-2,4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>'
  },
  icicle: {
    kind: 'hazard', r: 12, spin: false,
    make: () => '<g><path d="M-8,-18 L8,-18 L0,26 Z" fill="#cfe9fb" stroke="#8fc0dd" stroke-width="1.3"/>' +
      '<path d="M-3,-14 L-1,14" stroke="#fff" stroke-width="2" opacity=".8" stroke-linecap="round"/></g>'
  },
  burr: {
    kind: 'hazard', r: 14,
    make: () => {
      let sp = '';
      for (let i = 0; i < 12; i++) {
        const a = i * 30 * Math.PI / 180;
        sp += '<path d="M' + (Math.cos(a) * 5).toFixed(1) + ',' + (Math.sin(a) * 5).toFixed(1) +
              ' L' + (Math.cos(a) * 15).toFixed(1) + ',' + (Math.sin(a) * 15).toFixed(1) +
              '" stroke="#4d7c3a" stroke-width="2.4" stroke-linecap="round"/>';
      }
      return '<g>' + sp + '<circle r="7" fill="#7fb069" stroke="#3f6b30" stroke-width="1.5"/></g>';
    }
  },
  spark: {
    kind: 'hazard', r: 10,
    make: () => '<g><circle r="6" fill="#ffe680"/><circle r="10" fill="#ffb02e" opacity=".35"/>' +
      '<path d="M0,-14 L0,14 M-14,0 L14,0" stroke="#fff2b0" stroke-width="1.6" opacity=".8"/></g>'
  },
  meteor: {
    kind: 'hazard', r: 14, spin: false,
    make: () => '<g><path d="M-2,-4 L-46,-26 L-6,4 Z" fill="#ff8a3d" opacity=".55"/>' +
      '<path d="M-2,2 L-38,-4 L-4,8 Z" fill="#ffd36e" opacity=".5"/>' +
      '<circle r="10" fill="#6b4a3a"/><circle cx="-3" cy="-3" r="3" fill="#8d6552"/>' +
      '<circle r="13" fill="#ff7a2f" opacity=".3"/></g>'
  },
  shard: {
    kind: 'hazard', r: 13,
    make: () => '<g><path d="M0,-16 L11,-2 L4,16 L-8,10 L-11,-4 Z" fill="#bfe6ff" opacity=".92" ' +
      'stroke="#7fb6d8" stroke-width="1.3"/>' +
      '<path d="M0,-13 L2,12" stroke="#fff" stroke-width="1.6" opacity=".7"/></g>'
  },
  drone: {
    kind: 'hazard', r: 22, tracks: true, spin: false,
    make: () => '<g><rect x="-13" y="-7" width="26" height="14" rx="5" fill="#3b4657" stroke="#222b38" stroke-width="1.5"/>' +
      '<circle cx="0" cy="0" r="3.4" fill="#ff4757"/>' +
      '<rect x="-26" y="-11" width="12" height="3" rx="1.5" fill="#2a3341"/>' +
      '<rect x="14" y="-11" width="12" height="3" rx="1.5" fill="#2a3341"/>' +
      '<g class="spin1"><ellipse cx="-20" cy="-12" rx="13" ry="2.4" fill="#8fa3bd" opacity=".75"/></g>' +
      '<g class="spin2"><ellipse cx="20" cy="-12" rx="13" ry="2.4" fill="#8fa3bd" opacity=".75"/></g></g>'
  },
  orb: {
    kind: 'hazard', r: 17, tracks: true, spin: false,
    make: () => '<g><circle r="16" fill="#7cf3ff" opacity=".18"/>' +
      '<circle r="10" fill="#39d7ff" opacity=".45"/><circle r="5" fill="#eaffff"/>' +
      '<path d="M-16,0 A16,16 0 0 1 16,0" fill="none" stroke="#9ff6ff" stroke-width="1.4" opacity=".8"/>' +
      '<path d="M0,-16 A16,16 0 0 1 0,16" fill="none" stroke="#9ff6ff" stroke-width="1.4" opacity=".8"/></g>'
  },

  /* ------------------------------------------------------------ pickup -- */
  sticker: {
    kind: 'pickup', r: 18, spin: false,
    make: () => '<g class="bob"><circle r="16" fill="#fff"/>' +
      '<circle r="12.5" fill="#ffc94d"/>' +
      '<path d="M-5,0 L5,0 M0,-5 L0,5" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle r="16" fill="none" stroke="#ffb01f" stroke-width="1.6" stroke-dasharray="3 3"/></g>'
  },

  /* ------------------------------------------------------------- zones -- */
  gust: {
    kind: 'zone', r: 0, h: 120,
    make: (p) => {
      const dir = p.dir || 1;
      let s = '<g opacity=".5">';
      for (let i = 0; i < 5; i++) {
        const y = -50 + i * 25, w = 120 + i * 40;
        s += '<path d="M' + (-w / 2) + ',' + y + ' q' + (w / 2) + ',' + (-10 * dir) + ' ' + w + ',0" ' +
             'fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" opacity="' + (0.35 + i * 0.1) + '"/>';
      }
      const ax = dir > 0 ? 1 : -1;
      s += '<path d="M' + (160 * ax) + ',10 l' + (-18 * ax) + ',-9 l0,18 Z" fill="#fff" opacity=".7"/></g>';
      return s;
    }
  },
  updraft: {
    kind: 'zone', r: 0, h: 150, lift: true,
    make: () => {
      let s = '<g opacity=".55">';
      for (let i = 0; i < 4; i++) {
        const x = -45 + i * 30;
        s += '<path d="M' + x + ',70 q10,-40 0,-80 q-10,-40 0,-60" fill="none" stroke="#b6f5c0" ' +
             'stroke-width="3" stroke-linecap="round" opacity="' + (0.45 + i * 0.12) + '"/>';
      }
      s += '<path d="M0,-96 l-13,20 l26,0 Z" fill="#d6ffdd" opacity=".8"/></g>';
      return s;
    }
  },

  /* ---------------------------------------------------------- barriers --
     One horizontal band with a single gap. This is the core skill test:
     read the gap, cross the screen, get through before the band arrives.  */
  barrier: {
    kind: 'barrier', h: 34,
    make: (p) => {
      const gap = p.gap, gx = p.gapX, style = p.style || 'hedge';
      const segs = [[0, gx - gap / 2], [gx + gap / 2, W]];
      let s = '';
      segs.forEach(([a, b]) => {
        const w = b - a;
        if (w <= 2) return;
        if (style === 'hedge') {
          let spikes = '';
          for (let x = a + 8; x < b - 4; x += 16)
            spikes += '<path d="M' + x + ',6 l7,-20 l7,20 Z" fill="#3f7a3a"/>';
          s += '<rect x="' + a + '" y="0" width="' + w + '" height="26" rx="7" fill="#4f9147"/>' + spikes +
               '<rect x="' + a + '" y="14" width="' + w + '" height="12" rx="5" fill="#3d7538" opacity=".7"/>';
        } else if (style === 'string') {
          let barbs = '';
          for (let x = a + 10; x < b - 4; x += 22)
            barbs += '<path d="M' + x + ',2 l6,-8 M' + x + ',2 l6,8" stroke="#c9d6e8" stroke-width="2"/>';
          s += '<path d="M' + a + ',4 L' + b + ',4" stroke="#e8eef7" stroke-width="3.4"/>' + barbs +
               '<path d="M' + a + ',4 L' + b + ',4" stroke="#9fb2d6" stroke-width="1" stroke-dasharray="6 6"/>';
        } else if (style === 'hail') {
          let stones = '';
          for (let x = a + 10; x < b - 4; x += 20)
            stones += '<path d="M' + x + ',-8 l8,5 l0,10 l-8,5 l-8,-5 l0,-10 Z" fill="#dff0ff" stroke="#9dc4de" stroke-width="1.2"/>';
          s += '<rect x="' + a + '" y="-6" width="' + w + '" height="18" rx="8" fill="#cfe4f5" opacity=".55"/>' + stones;
        } else if (style === 'ice') {
          let spears = '';
          for (let x = a + 8; x < b - 4; x += 18)
            spears += '<path d="M' + x + ',-6 l9,0 l-4.5,24 Z" fill="#cfe9fb" stroke="#8fc0dd" stroke-width="1.1"/>';
          s += '<rect x="' + a + '" y="-14" width="' + w + '" height="14" rx="5" fill="#a9d4ee"/>' + spears;
        } else if (style === 'thorn') {
          let barbs = '';
          for (let x = a + 6; x < b - 4; x += 14)
            barbs += '<path d="M' + x + ',4 l5,-16 l5,16 Z" fill="#6f9c4b"/>' +
                     '<path d="M' + (x + 3) + ',10 l4,12 l-8,0 Z" fill="#4d7c3a"/>';
          s += '<rect x="' + a + '" y="0" width="' + w + '" height="12" rx="6" fill="#7a5a34"/>' + barbs +
               '<rect x="' + a + '" y="4" width="' + w + '" height="6" rx="3" fill="#63482a" opacity=".8"/>';
        } else { /* laser */
          s += '<rect x="' + a + '" y="-3" width="' + w + '" height="6" rx="3" fill="#ff4d6d" opacity=".95"/>' +
               '<rect x="' + a + '" y="-9" width="' + w + '" height="18" rx="9" fill="#ff4d6d" opacity=".22"/>' +
               '<rect x="' + a + '" y="-1.2" width="' + w + '" height="2.4" fill="#fff" opacity=".85"/>';
        }
      });
      /* gap markers so the eye finds the opening early */
      s += '<g opacity=".85"><path d="M' + (gx - gap / 2 + 4) + ',-16 l0,32" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 5"/>' +
           '<path d="M' + (gx + gap / 2 - 4) + ',-16 l0,32" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 5"/></g>';
      return s;
    }
  },

  /* ------------------------------------------------------------- bolt --
     Telegraphed lightning: a warning column, then a lethal strike.       */
  bolt: {
    kind: 'bolt',
    make: (p) => {
      const w = p.width || 30;
      let path = 'M0,0';
      let x = 0;
      for (let y = 40; y <= H + 40; y += 46) {
        x = rand(-w * 0.5, w * 0.5);
        path += ' L' + x.toFixed(1) + ',' + y;
      }
      return '<g class="warn"><rect x="' + (-w / 2) + '" y="0" width="' + w + '" height="' + (H + 60) + '" ' +
        'fill="#ffffff" opacity=".22"/>' +
        '<rect x="' + (-w / 2 - 3) + '" y="0" width="' + (w + 6) + '" height="' + (H + 60) + '" fill="none" ' +
        'stroke="#fff" stroke-width="1.5" stroke-dasharray="8 8" opacity=".7"/></g>' +
        '<g class="strike" style="display:none">' +
        '<path d="' + path + '" fill="none" stroke="#fff8c9" stroke-width="' + (w * 0.55) + '" ' +
        'stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
        '<path d="' + path + '" fill="none" stroke="#ffffff" stroke-width="5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></g>';
    }
  }
};

/* Human-readable hazard names for the level briefing */
const SPRITE_LABEL = {
  bird: 'birds', leaf: 'leaves', twig: 'twigs', kite: 'kites', hail: 'hail',
  icicle: 'icicles', burr: 'burrs', spark: 'sparks', meteor: 'meteors',
  shard: 'ice shards', drone: 'drones', orb: 'static orbs', bolt: 'lightning',
  gust: 'gusts', updraft: 'updrafts', barrier: 'walls', sticker: 'stickers', cloud: 'cloud'
};
