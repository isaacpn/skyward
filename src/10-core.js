/* ==========================================================================
   Skyward - core: constants, helpers, audio, save data, balloon catalog
   ========================================================================== */
'use strict';

const BASE_W = 800, BASE_H = 600;        // the field the levels were tuned against
let W = BASE_W, H = BASE_H;              // the field actually in play, see Layout
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const $ = id => document.getElementById(id);

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
/* Build an SVG fragment from markup, returned as a <g> */
function gfx(markup, cls) {
  const g = document.createElementNS(NS, 'g');
  if (cls) g.setAttribute('class', cls);
  g.innerHTML = markup;
  return g;
}

/* --------------------------------------------------------------- layout --
   The play field is reshaped to whatever viewport it lands in.

   A roomy landscape window keeps the tuned 800x600 field. Anything narrower
   (phones either way up, tablets, a half-width browser window) gets a field
   whose aspect matches the screen, so the game is full-bleed instead of a
   letterboxed stamp in the middle of a black page. World width shrinks on
   small screens so sprites stay a legible size in real pixels.

   Everything downstream reads the scale factors rather than hard numbers:
     kx  horizontal scale, applied to speeds, wind, drift and barrier gaps
     ky  vertical scale, applied to fall speeds so transit time is constant
     k   sprite scale, deliberately blunted so hazards stay readable
   ------------------------------------------------------------------------ */
const Layout = {
  kx: 1, ky: 1, k: 1, framed: true, coarse: false,

  apply() {
    const app = $('app');
    const vw = app.clientWidth || innerWidth;
    const vh = app.clientHeight || innerHeight;
    this.framed = matchMedia('(min-width:901px) and (min-aspect-ratio:5/4)').matches;
    this.coarse = matchMedia('(pointer:coarse)').matches;

    if (this.framed) {
      W = BASE_W; H = BASE_H;
    } else {
      const aspect = vw / Math.max(1, vh);
      /* ~0.78 css px per world unit keeps a balloon thumb-sized on a phone */
      W = Math.round(clamp(vw / 0.78, 440, BASE_W));
      /* never so short that hazards arrive unreadably fast, never so tall
         that the balloon is a speck at the bottom of a chimney */
      H = Math.round(W / clamp(aspect, 0.48, 1.5));
    }

    this.kx = W / BASE_W;
    this.ky = H / BASE_H;
    this.k = Math.pow(this.kx, 0.45);

    HOME_Y = H * 0.66;
    Y_MIN = H * 0.2;
    Y_MAX = H * 0.9;

    $('stage').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    return this;
  },

  /* Client coords to world coords. The stage letterboxes inside #app when the
     aspects do not divide evenly, so the bars have to be taken off first. */
  toWorld(clientX, clientY) {
    const r = $('stage').getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    return {
      x: (clientX - r.left - (r.width - W * s) / 2) / s,
      y: (clientY - r.top - (r.height - H * s) / 2) / s
    };
  }
};

/* ---------------------------------------------------------------- audio --
   Everything is synthesised, so the page stays a single file.            */
const Sound = {
  ctx: null, on: true, master: null, windGain: null, windSrc: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.on = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  noiseBuffer(sec) {
    const n = (this.ctx.sampleRate * sec) | 0;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  tone(freq, dur, type, vol, slideTo) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  burst(dur, vol, filterFreq, sweepTo) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuffer(dur + 0.05);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  },
  ui()      { this.tone(560, 0.07, 'triangle', 0.13); },
  pickup()  { this.tone(760, 0.09, 'triangle', 0.2); setTimeout(() => this.tone(1180, 0.13, 'triangle', 0.17), 70); },
  prick()   { this.tone(320, 0.1, 'square', 0.16, 120); this.burst(0.12, 0.16, 2400, 700); },
  pop()     {
    this.burst(0.28, 0.6, 1600, 180);
    this.tone(180, 0.22, 'sawtooth', 0.28, 40);
  },
  thunder() { this.burst(1.1, 0.42, 320, 60); this.tone(58, 0.9, 'sine', 0.22, 30); },
  zap()     { this.burst(0.18, 0.3, 5200, 1400); this.tone(1400, 0.1, 'square', 0.1, 300); },
  whoosh()  { this.burst(0.35, 0.16, 700, 2600); },
  win()     { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.24, 'triangle', 0.2), i * 110)); },
  lose()    { [440, 349, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sine', 0.2), i * 150)); },
  windStart(level) {
    if (!this.on || !this.ctx || this.windSrc) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer(2); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = this.ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
    this.windSrc = s; this.windGain = g;
    this.windSet(level);
  },
  windSet(v) { if (this.windGain) this.windGain.gain.value = clamp(v, 0, 1) * 0.09; },
  windStop() { if (this.windSrc) { try { this.windSrc.stop(); } catch (e) {} this.windSrc = null; this.windGain = null; } },
  toggle() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.5 : 0;
    return this.on;
  }
};

/* ----------------------------------------------------------------- save -- */
const Save = {
  key: 'skyward.save.v1',
  data: { unlocked: 1, best: {}, colour: 'crimson', type: 'classic', sound: true },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* private mode, run with defaults */ }
    return this.data;
  },
  write() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  unlock(n) { if (n > this.data.unlocked) { this.data.unlocked = n; this.write(); } },
  setBest(id, score) {
    const cur = this.data.best[id] || 0;
    if (score > cur) { this.data.best[id] = score; this.write(); return true; }
    return false;
  },
  reset() { this.data.unlocked = 1; this.data.best = {}; this.write(); }
};

/* -------------------------------------------------------- balloon kit ---- */
const COLOURS = [
  { id: 'crimson', name: 'Crimson',   hi: '#ff9aa6', mid: '#e6394a', lo: '#9d1226' },
  { id: 'mango',   name: 'Mango',     hi: '#ffd79a', mid: '#ff9a2e', lo: '#c25a06' },
  { id: 'lagoon',  name: 'Lagoon',    hi: '#a9ecff', mid: '#22b8e6', lo: '#0a6d90' },
  { id: 'meadow',  name: 'Meadow',    hi: '#bdf3b6', mid: '#46bf5e', lo: '#177033' },
  { id: 'orchid',  name: 'Orchid',    hi: '#e9bdff', mid: '#a552d8', lo: '#5c1c85' },
  { id: 'sunbeam', name: 'Sunbeam',   hi: '#fff3ab', mid: '#f5cf2e', lo: '#a8860a' },
  { id: 'ink',     name: 'Ink',       hi: '#9fb2d6', mid: '#3d4f78', lo: '#1a2440' },
  { id: 'bubble',  name: 'Bubblegum', hi: '#ffd0e6', mid: '#ff77b4', lo: '#b52d6d' }
];

const TYPES = [
  { id: 'classic',  name: 'Classic',  r: 27, accel: 1.00, drag: 3.0, top: 1.00, stickers: 0,
    desc: 'The honest party balloon. Balanced handling, nothing clever.' },
  { id: 'teardrop', name: 'Teardrop', r: 24, accel: 1.22, drag: 2.6, top: 1.16, stickers: 0,
    desc: 'Slim and quick. Smaller target, but it slides past where you meant to stop.' },
  { id: 'heart',    name: 'Heart',    r: 28, accel: 0.92, drag: 3.6, top: 0.94, stickers: 1,
    desc: 'Wide and sentimental. Starts with one extra sticker, turns like a bus.' },
  { id: 'blimp',    name: 'Blimp',    r: 30, accel: 0.86, drag: 4.4, top: 1.06, stickers: 0,
    desc: 'Long body, strong glide. Hard to start, harder to stop, punishes hesitation.' }
];

const colourOf = id => COLOURS.find(c => c.id === id) || COLOURS[0];
const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];

/* Gradient defs are created once per colour and reused by every balloon SVG */
function ensureBalloonGradients() {
  const defs = $('defs');
  COLOURS.forEach(c => {
    if ($('bg-' + c.id)) return;
    const rg = el('radialGradient', { id: 'bg-' + c.id, cx: '35%', cy: '30%', r: '78%' }, defs);
    el('stop', { offset: '0%', 'stop-color': c.hi }, rg);
    el('stop', { offset: '55%', 'stop-color': c.mid }, rg);
    el('stop', { offset: '100%', 'stop-color': c.lo }, rg);
  });
  if (!$('shine')) {
    const lg = el('linearGradient', { id: 'shine', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '.75' }, lg);
    el('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0' }, lg);
  }
}

/* Balloon body path per type, drawn around origin (0,0) at the knot */
function balloonBody(typeId) {
  switch (typeId) {
    case 'teardrop':
      return 'M0,0 C-30,-26 -30,-64 0,-84 C30,-64 30,-26 0,0 Z';
    case 'heart':
      return 'M0,0 C-8,-14 -40,-26 -40,-52 C-40,-72 -18,-80 0,-62 C18,-80 40,-72 40,-52 C40,-26 8,-14 0,0 Z';
    case 'blimp':
      return 'M0,0 C-26,-10 -42,-30 -42,-52 C-42,-76 -22,-92 0,-92 C22,-92 42,-76 42,-52 C42,-30 26,-10 0,0 Z';
    default:
      return 'M0,0 C-12,-10 -36,-24 -36,-52 C-36,-76 -18,-90 0,-90 C18,-90 36,-76 36,-52 C36,-24 12,-10 0,0 Z';
  }
}

/* One balloon, as SVG markup. Used by the picker, the title card and the game. */
function balloonMarkup(typeId, colourId, opts) {
  const o = opts || {};
  const c = colourOf(colourId);
  const body = balloonBody(typeId);
  const scale = o.scale || 1;
  const patches = o.patches || 0;
  const patchDots = ['-18,-58', '14,-44', '-6,-72', '20,-64', '-24,-38'];
  let p = '';
  for (let i = 0; i < patches; i++) {
    const [px, py] = patchDots[i % patchDots.length].split(',');
    p += '<g transform="translate(' + px + ',' + py + ') rotate(' + (i * 37) + ')">' +
         '<circle r="7.5" fill="#fff" opacity=".95"/>' +
         '<circle r="5" fill="' + (o.patchColour || '#ffc94d') + '"/>' +
         '<path d="M-2.4,0 L2.4,0 M0,-2.4 L0,2.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>';
  }
  return '<g transform="scale(' + scale + ')">' +
    '<path d="' + body + '" fill="url(#bg-' + c.id + ')" stroke="' + c.lo + '" stroke-width="2" stroke-opacity=".35"/>' +
    '<ellipse cx="-12" cy="-62" rx="9" ry="15" fill="url(#shine)" transform="rotate(-18 -12 -62)"/>' +
    p +
    '<path d="M-5,-2 L5,-2 L2.5,6 L-2.5,6 Z" fill="' + c.lo + '"/>' +
    '<path d="M0,6 C6,14 -6,22 0,30 C5,36 -3,42 0,48" fill="none" stroke="' + (o.string || '#6b7a92') +
      '" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>' +
    '</g>';
}
