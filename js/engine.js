'use strict';
// ============================================================================
//  ENGINE — canvas, loop, input, timing, tweens, particles, UI helpers
// ============================================================================
const W = 1920, H = 1080;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  t: 0, rt: 0, dt: 0, scale: 1,
  scene: null, overlay: null,
  mouse: { x: W / 2, y: H / 2, down: false, clicked: false },
  keys: {}, pressed: {}, anyPressed: false,
  timers: [], tweens: [], hitstop: 0, timeScale: 1,
  cam: { x: 0, y: 0, zoom: 1, shake: 0, sx: 0, sy: 0 },
  hoverId: null, _hoverSeen: false,
  img: {},
  fade: { a: 1, target: 0, speed: 2.5, cb: null },
  flash: { a: 0, color: '#fff' },
};

// ---------------------------------------------------------------- utilities
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inBack: t => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

// ---------------------------------------------------------------- canvas fit
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  canvas.width = Math.round(W * s * dpr);
  canvas.height = Math.round(H * s * dpr);
  G.scale = canvas.width / W;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- input
function toLogical(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H };
}
canvas.addEventListener('mousemove', e => { const p = toLogical(e.clientX, e.clientY); G.mouse.x = p.x; G.mouse.y = p.y; });
canvas.addEventListener('mousedown', e => {
  const p = toLogical(e.clientX, e.clientY); G.mouse.x = p.x; G.mouse.y = p.y;
  if (e.button === 0) { G.mouse.down = true; G.mouse.clicked = true; }
  if (e.button === 2) G.pressed['Escape'] = true;
  G.anyPressed = true; AudioSys.unlock();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mouseup', () => { G.mouse.down = false; });
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0]; const p = toLogical(t.clientX, t.clientY);
  G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.down = true; G.mouse.clicked = true; G.anyPressed = true;
  AudioSys.unlock(); e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => { G.mouse.down = false; });
window.addEventListener('keydown', e => {
  if (!G.keys[e.code]) G.pressed[e.code] = true;
  G.keys[e.code] = true; G.anyPressed = true; AudioSys.unlock();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyF' && !e.repeat) toggleFullscreen();
});
window.addEventListener('keyup', e => { G.keys[e.code] = false; });
window.addEventListener('blur', () => { G.keys = {}; });

function keyHit(...codes) {
  for (const c of codes) if (G.pressed[c]) { G.pressed[c] = false; return true; }
  return false;
}
const confirmHit = () => keyHit('Enter', 'Space', 'KeyZ', 'NumpadEnter');
const cancelHit = () => keyHit('Escape', 'Backspace', 'KeyX');
function consumeInput() { G.mouse.clicked = false; G.pressed = {}; G.anyPressed = false; }
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}
const inRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;

// ---------------------------------------------------------------- async timing
function wait(s) { return new Promise(r => G.timers.push({ t: s, r })); }
function tween(o, props, dur, ease = Ease.outCubic) {
  return new Promise(r => {
    const from = {};
    for (const k in props) from[k] = o[k];
    G.tweens.push({ o, props, from, dur: Math.max(0.0001, dur), t: 0, ease, r });
  });
}
function clearAsync() { G.timers.length = 0; G.tweens.length = 0; }
function updateAsync(dt) {
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i]; tm.t -= dt;
    if (tm.t <= 0) { G.timers.splice(i, 1); tm.r(); }
  }
  for (let i = G.tweens.length - 1; i >= 0; i--) {
    const tw = G.tweens[i]; tw.t += dt;
    const k = clamp(tw.t / tw.dur, 0, 1), e = tw.ease(k);
    for (const p in tw.props) tw.o[p] = tw.from[p] + (tw.props[p] - tw.from[p]) * e;
    if (k >= 1) { G.tweens.splice(i, 1); tw.r(); }
  }
}

// ---------------------------------------------------------------- camera fx
function shake(v) { G.cam.shake = Math.max(G.cam.shake, v); }
function hitstop(s) { G.hitstop = Math.max(G.hitstop, s); }
function screenFlash(color = '#fff', a = 0.6) { G.flash.color = color; G.flash.a = Math.max(G.flash.a, a); }

// ---------------------------------------------------------------- assets
function loadImages(map, onProgress) {
  const keys = Object.keys(map); let done = 0;
  return Promise.all(keys.map(k => new Promise(res => {
    const im = new Image();
    im.onload = () => { G.img[k] = im; done++; onProgress && onProgress(done / keys.length); res(); };
    im.onerror = () => { console.warn('Missing image', map[k]); done++; onProgress && onProgress(done / keys.length); res(); };
    im.src = map[k];
  })));
}

// ---------------------------------------------------------------- canvas helpers
const F = {
  title: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
  head: "'Cinzel', Georgia, serif",
  body: "'Alegreya Sans', 'Segoe UI', Arial, sans-serif",
};
const C = {
  gold: '#d8b46a', goldDim: 'rgba(216,180,106,0.35)', parchment: '#efe0bd', ink: '#2b1d12',
  red: '#d4442c', redHot: '#ff5a2a', hp: '#c9372c', focus: '#3f8fd8', mad: '#b0263a',
  text: '#f3e9d2', textDim: 'rgba(243,233,210,0.6)', green: '#7fcf6a',
};
function font(size, fam = F.body, weight = 500, style = '') { return `${style} ${weight} ${size}px ${fam}`; }

function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function txt(c, s, x, y, o = {}) {
  c.save();
  c.font = o.font || font(o.size || 28, o.fam || F.body, o.weight || 500, o.style || '');
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'alphabetic';
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (o.letter) { try { c.letterSpacing = o.letter + 'px'; } catch (e) {} }
  if (o.shadow !== false) {
    c.shadowColor = o.shadowColor || 'rgba(0,0,0,0.85)';
    c.shadowBlur = o.shadowBlur ?? 8; c.shadowOffsetY = o.shadowY ?? 2;
  }
  if (o.stroke) { c.lineWidth = o.strokeW || 6; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); c.shadowColor = 'transparent'; }
  c.fillStyle = o.color || C.text;
  c.fillText(s, x, y);
  c.restore();
}

function wrapLines(c, s, maxW, fnt) {
  c.save(); c.font = fnt;
  const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  c.restore(); return out;
}

// Ornate dark panel with gold trim
function panel(c, x, y, w, h, o = {}) {
  const r = o.r ?? 16;
  c.save();
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = o.shadowBlur ?? 30; c.shadowOffsetY = 10;
  rr(c, x, y, w, h, r);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top || 'rgba(44,32,24,0.93)');
  g.addColorStop(1, o.bottom || 'rgba(16,12,9,0.95)');
  c.fillStyle = g; c.fill();
  c.shadowColor = 'transparent';
  // subtle top sheen
  const sh = c.createLinearGradient(0, y, 0, y + 40);
  sh.addColorStop(0, 'rgba(255,230,180,0.08)'); sh.addColorStop(1, 'rgba(255,230,180,0)');
  c.fillStyle = sh; c.fill();
  c.lineWidth = 2; c.strokeStyle = o.border || 'rgba(216,180,106,0.8)'; c.stroke();
  rr(c, x + 6, y + 6, w - 12, h - 12, Math.max(2, r - 5));
  c.lineWidth = 1; c.strokeStyle = 'rgba(216,180,106,0.22)'; c.stroke();
  if (o.ornaments !== false) {
    c.fillStyle = o.border || C.gold;
    for (const [cx, cy] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) {
      c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 5, cy); c.lineTo(cx, cy + 5); c.lineTo(cx - 5, cy); c.closePath(); c.fill();
    }
  }
  c.restore();
}

// Smoothly animated bar (keeps a "ghost" trailing value per id)
const _barGhost = {};
function bar(c, id, x, y, w, h, v, max, col1, col2, o = {}) {
  const f = clamp(v / max, 0, 1);
  let gh = _barGhost[id]; if (gh == null) gh = _barGhost[id] = f;
  gh = _barGhost[id] = gh > f ? Math.max(f, gh - G.rt * 0 - 0.012) : Math.min(f, gh + 0.03);
  c.save();
  rr(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(216,180,106,0.5)'; c.stroke();
  c.save(); rr(c, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); c.clip();
  if (gh > f) { c.fillStyle = 'rgba(255,240,200,0.55)'; c.fillRect(x + 2, y + 2, (w - 4) * gh, h - 4); }
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, col1); g.addColorStop(1, col2);
  c.fillStyle = g; c.fillRect(x + 2, y + 2, (w - 4) * Math.min(f, gh <= f ? gh : f), h - 4);
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 2, y + 2, (w - 4) * f, (h - 4) * 0.4);
  c.restore();
  if (o.label) txt(c, o.label, x + 12, y + h / 2 + 1, { size: o.size || h * 0.7, weight: 700, base: 'middle', fam: F.head, color: '#fff' });
  if (o.value) txt(c, o.value, x + w - 12, y + h / 2 + 1, { size: o.size || h * 0.7, weight: 700, base: 'middle', align: 'right', color: '#fff' });
  c.restore();
}

// Immediate-mode button. Returns true when clicked.
function button(c, id, x, y, w, h, label, o = {}) {
  const blocked = (G.overlay && o.layer !== 'overlay') || o.disabled;
  const hov = !blocked && inRect(G.mouse, x, y, w, h);
  if (hov) { G._hoverSeen = true; if (G.hoverId !== id) { G.hoverId = id; AudioSys.sfx('hover'); } }
  const sel = hov || o.selected;
  c.save();
  if (o.disabled) c.globalAlpha *= 0.45;
  const lift = sel ? -2 : 0;
  c.shadowColor = sel ? (o.glow || 'rgba(255,170,80,0.55)') : 'rgba(0,0,0,0.5)';
  c.shadowBlur = sel ? 22 : 10; c.shadowOffsetY = sel ? 0 : 4;
  rr(c, x, y + lift, w, h, o.r ?? 10);
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (o.danger) { g.addColorStop(0, sel ? '#a8321f' : '#7a2216'); g.addColorStop(1, sel ? '#5a1408' : '#3e0e06'); }
  else { g.addColorStop(0, sel ? 'rgba(92,66,40,0.98)' : 'rgba(58,42,30,0.95)'); g.addColorStop(1, sel ? 'rgba(48,32,20,0.98)' : 'rgba(26,19,14,0.95)'); }
  c.fillStyle = g; c.fill();
  c.shadowColor = 'transparent';
  c.lineWidth = sel ? 2.5 : 1.5; c.strokeStyle = sel ? '#f1cf86' : 'rgba(216,180,106,0.6)'; c.stroke();
  if (o.icon) o.icon(c, x + 34, y + h / 2 + lift, sel);
  txt(c, label, o.icon ? x + 64 : x + w / 2, y + h / 2 + lift + 1, {
    size: o.size || 28, fam: o.fam || F.head, weight: 700, base: 'middle',
    align: o.icon ? 'left' : 'center', color: sel ? '#fff4d8' : C.text, letter: o.letter,
  });
  if (o.sub) txt(c, o.sub, x + w - 14, y + h / 2 + lift + 1, { size: 20, base: 'middle', align: 'right', color: o.subColor || C.textDim, weight: 700 });
  c.restore();
  if (hov && G.mouse.clicked) { G.mouse.clicked = false; AudioSys.sfx('click'); return true; }
  return false;
}

// Image drawn so it covers the screen, with optional parallax offset/zoom
function drawCover(c, img, ox = 0, oy = 0, zoom = 1) {
  if (!img) return;
  const iw = img.videoWidth || img.width, ih = img.videoHeight || img.height;
  if (!iw) return;
  const s = Math.max(W / iw, H / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  c.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
}

function vignette(c, strength = 0.65, color = '0,0,0') {
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${strength})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// Cached tinted silhouettes (for hit flashes, shadows, locked nodes)
const _tintCache = new Map();
function tinted(img, color) {
  const key = (img.src || img._id || '') + '|' + color;
  let cv = _tintCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, cv.width, cv.height);
  _tintCache.set(key, cv); return cv;
}

// Soft glow sprite cache
const _glowCache = new Map();
function glowSprite(color) {
  let cv = _glowCache.get(color);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glowCache.set(color, cv); return cv;
}

// ============================================================================
//  PARTICLES
// ============================================================================
const Particles = {
  list: [],
  spawn(kind, x, y, n = 10, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : rand(0, TAU);
      const sp = rand(o.speedMin ?? 120, o.speed ?? 520);
      const p = {
        kind, x: x + rand(-(o.jx || 0), o.jx || 0), y: y + rand(-(o.jy || 0), o.jy || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g ?? 1400, drag: o.drag ?? 0.985,
        life: 0, max: rand(o.lifeMin ?? 0.5, o.life ?? 1.1), size: rand(o.sizeMin ?? 4, o.size ?? 10),
        rot: rand(0, TAU), vr: rand(-12, 12), color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'),
        layer: o.layer || 'front', ground: o.ground ?? 9999, sway: rand(0, TAU), add: o.add || false,
      };
      if (kind === 'paper') { p.g = o.g ?? 260; p.drag = 0.96; p.w = rand(10, 22); p.h = p.w * 1.3; }
      if (kind === 'chip') { p.w = p.size * rand(1, 2.4); p.h = p.size * rand(0.4, 0.8); }
      if (kind === 'smoke') { p.g = o.g ?? -40; p.drag = 0.94; p.vr = rand(-1, 1); }
      if (kind === 'glow' || kind === 'spark') p.add = true;
      this.list.push(p);
    }
  },
  ambient(kind, area, o = {}) { // single ambient particle
    const p = {
      kind, x: rand(area.x, area.x + area.w), y: rand(area.y, area.y + area.h), vx: o.vx ?? rand(-20, 20), vy: o.vy ?? rand(-20, 20),
      g: o.g ?? 0, drag: 1, life: 0, max: o.life ?? rand(4, 8), size: rand(o.sizeMin ?? 2, o.size ?? 5), rot: rand(0, TAU),
      vr: rand(-2, 2), color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'), layer: o.layer || 'back',
      ground: 9999, sway: rand(0, TAU), add: o.add || false, fadeIn: true,
    };
    this.list.push(p); return p;
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt;
      if (p.life >= p.max) { L.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      if (p.kind === 'paper' || p.kind === 'leaf' || p.kind === 'snow') p.vx += Math.sin(p.life * 3 + p.sway) * 60 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > p.ground) { p.y = p.ground; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
    }
    if (L.length > 1400) L.splice(0, L.length - 1400);
  },
  draw(c, layer) {
    for (const p of this.list) {
      if (p.layer !== layer) continue;
      const k = p.life / p.max;
      let a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (p.fadeIn) a *= Math.min(1, p.life / 0.6);
      c.globalAlpha = a;
      if (p.add) c.globalCompositeOperation = 'lighter';
      switch (p.kind) {
        case 'chip': case 'paper': case 'leaf': {
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          if (p.kind === 'paper') c.scale(Math.cos(p.life * 8 + p.sway), 1);
          c.fillStyle = p.color;
          const w = p.w || p.size, h = p.h || p.size * 0.6;
          if (p.kind === 'leaf') { c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU); c.fill(); }
          else c.fillRect(-w / 2, -h / 2, w, h);
          if (p.kind === 'paper') { c.fillStyle = 'rgba(80,60,40,0.35)'; c.fillRect(-w / 2 + 2, -h / 4, w - 4, 1.5); c.fillRect(-w / 2 + 2, 0, w - 6, 1.5); }
          c.restore(); break;
        }
        case 'spark': {
          c.strokeStyle = p.color; c.lineWidth = p.size * 0.35 * (1 - k);
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); break;
        }
        case 'glow': {
          const s = p.size * 4 * (1 - k * 0.5);
          c.drawImage(glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s); break;
        }
        case 'smoke': {
          const s = p.size * (1 + k * 2.5);
          c.globalAlpha = a * 0.35; c.fillStyle = p.color;
          c.beginPath(); c.arc(p.x, p.y, s, 0, TAU); c.fill(); break;
        }
        case 'rain': {
          c.strokeStyle = p.color; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke(); break;
        }
        default: { // drop / snow / ink / dot
          c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (p.kind === 'drop' ? 1 - k * 0.5 : 1), 0, TAU); c.fill();
        }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  },
  clear() { this.list.length = 0; },
};

// Floating combat text
const Floaters = {
  list: [],
  add(text, x, y, o = {}) {
    this.list.push({ text, x, y, vy: o.vy ?? -90, life: 0, max: o.life ?? 1.3, color: o.color || '#fff', size: o.size || 54, stroke: o.stroke || 'rgba(0,0,0,0.85)', fam: o.fam || F.head, delay: o.delay || 0 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.life += dt; f.y += f.vy * dt; f.vy *= Math.pow(0.97, dt * 60);
      if (f.life > f.max) this.list.splice(i, 1);
    }
  },
  draw(c) {
    for (const f of this.list) {
      if (f.delay > 0) continue;
      const k = f.life / f.max;
      const s = k < 0.15 ? Ease.outBack(k / 0.15) : 1;
      c.save(); c.translate(f.x, f.y); c.scale(s, s);
      txt(c, f.text, 0, 0, { size: f.size, fam: f.fam, weight: 900, align: 'center', base: 'middle', color: f.color, stroke: f.stroke, strokeW: 8, alpha: k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1 });
      c.restore();
    }
  },
  clear() { this.list.length = 0; },
};

// ============================================================================
//  SCENE MANAGEMENT + LOOP
// ============================================================================
function goto(scene, fadeTime = 0.45) {
  return new Promise(res => {
    G.fade.target = 1; G.fade.speed = 1 / fadeTime;
    G.fade.cb = () => {
      if (G.scene && G.scene.exit) G.scene.exit();
      clearAsync(); Particles.clear(); Floaters.clear();
      G.cam.zoom = 1; G.cam.shake = 0; G.timeScale = 1; G.hitstop = 0;
      G.scene = scene; scene.enter && scene.enter();
      G.fade.target = 0; res();
    };
  });
}

let _last = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - _last) / 1000); _last = now;
  G.rt += rdt;
  let dt = rdt * G.timeScale;
  if (G.hitstop > 0) { G.hitstop -= rdt; dt = 0; }
  G.dt = dt; G.t += dt;
  G._hoverSeen = false;

  // fade
  const fd = G.fade;
  if (fd.a !== fd.target) {
    fd.a = fd.target > fd.a ? Math.min(fd.target, fd.a + rdt * fd.speed) : Math.max(fd.target, fd.a - rdt * fd.speed);
    if (fd.a === 1 && fd.cb) { const cb = fd.cb; fd.cb = null; cb(); }
  }

  try {
    updateAsync(dt);
    if (G.overlay) G.overlay.update(rdt);
    if (G.scene) G.scene.update(dt, rdt);
    Particles.update(dt); Floaters.update(dt);
  } catch (e) { console.error(e); }

  // camera shake
  G.cam.shake *= Math.pow(0.0015, rdt);
  if (G.cam.shake < 0.3) G.cam.shake = 0;
  G.cam.sx = (Math.random() * 2 - 1) * G.cam.shake;
  G.cam.sy = (Math.random() * 2 - 1) * G.cam.shake;

  ctx.setTransform(G.scale, 0, 0, G.scale, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  try {
    if (G.scene) G.scene.draw(ctx);
    if (G.overlay) G.overlay.draw(ctx);
  } catch (e) { console.error(e); }

  if (G.flash.a > 0) {
    ctx.globalAlpha = G.flash.a; ctx.fillStyle = G.flash.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    G.flash.a = Math.max(0, G.flash.a - rdt * 3);
  }
  if (fd.a > 0) { ctx.globalAlpha = fd.a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  if (!G._hoverSeen) G.hoverId = null;
  G.mouse.clicked = false; G.pressed = {}; G.anyPressed = false;
  requestAnimationFrame(frame);
}
function startLoop() { _last = performance.now(); requestAnimationFrame(frame); }
