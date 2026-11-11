'use strict';
// ============================================================================
//  OVERLAYS — dialogue, chapter banners, notices
// ============================================================================
const _emblems = {};
function speakerPortrait(line) {
  if (line.s === 'eric') return G.img['p_' + (line.m || 'calm')];
  if (line.s === 'sven') return G.img.p_sven;
  const sp = SPEAKERS[line.s];
  if (sp && sp.portrait) return G.img[sp.portrait];
  if (sp && sp.emblem) { if (!_emblems[line.s]) _emblems[line.s] = Art.makeEmblem(...sp.emblem); return _emblems[line.s]; }
  return null;
}

class DialogOverlay {
  constructor(lines, done, onLine) {
    this.lines = lines; this.done = done; this.onLine = onLine; if (onLine) onLine(lines[0], 0); this.i = 0; this.chars = 0; this.t = 0; this.lt = 0; this.out = 0; this.closing = false;
  }
  get line() { return this.lines[this.i]; }
  next() {
    if (this.i < this.lines.length - 1) { this.i++; this.chars = 0; this.lt = 0; AudioSys.sfx('click'); if (this.onLine) this.onLine(this.line, this.i); }
    else this.close();
  }
  close() {
    if (this.closing) return;
    this.closing = true;
    tween(this, { out: 1 }, 0.25).then(() => { if (G.overlay === this) G.overlay = null; this.done(); });
  }
  update(dt) {
    this.t += dt; this.lt += dt;
    const L = this.line, len = L.t.length;
    const before = Math.floor(this.chars);
    const speed = L.s === 'decree' || L.s === 'tip' ? 140 : 52;
    this.chars = Math.min(len, this.chars + dt * speed);
    if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 3 === 0 && L.s !== 'narr' && this.chars < len) AudioSys.sfx('blip');
    if (this.closing) return;
    if (keyHit('Escape')) { this.close(); return; }
    if (G.mouse.clicked || confirmHit()) {
      G.mouse.clicked = false;
      if (this.lt < 0.15) return;
      if (this.chars < len) this.chars = len; else this.next();
    }
  }
  draw(c) {
    const L = this.line, a = (1 - this.out) * Math.min(1, this.t * 4);
    c.save(); c.globalAlpha = a;
    const shown = L.t.slice(0, Math.floor(this.chars));
    const done = this.chars >= L.t.length;
    if (L.s === 'narr') this.drawNarr(c, shown, done);
    else if (L.s === 'decree') this.drawDecree(c, shown, done);
    else if (L.s === 'tip') this.drawTip(c, shown, done);
    else this.drawSpeech(c, L, shown, done);
    txt(c, 'Esc — skip', W - 30, 40, { size: 20, align: 'right', color: 'rgba(255,255,255,0.45)' });
    c.restore();
  }
  continueMark(c, x, y, done) {
    if (!done) return;
    const b = Math.sin(this.t * 6) * 5;
    c.save(); c.fillStyle = C.gold; c.translate(x, y + b);
    c.beginPath(); c.moveTo(-10, -6); c.lineTo(10, -6); c.lineTo(0, 6); c.closePath(); c.fill(); c.restore();
  }
  drawNarr(c, shown, done) {
    const g = c.createLinearGradient(0, 380, 0, 700);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.78)'); g.addColorStop(0.7, 'rgba(0,0,0,0.78)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 380, W, 320);
    const f = font(42, F.head, 500);
    const lines = wrapLines(c, this.line.t, 1400, f);
    const y0 = 540 - (lines.length - 1) * 30;
    let left = shown.length;
    c.save(); c.font = f;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left)); left -= l.length + 1;
      const lx = W / 2 - c.measureText(l).width / 2;
      if (part) txt(c, part, lx, y0 + i * 60, { font: f, base: 'middle', color: '#f3e3c0' });
    });
    c.restore();
    c.fillStyle = C.goldDim; c.fillRect(W / 2 - 220, y0 - 70, 440, 1.5); c.fillRect(W / 2 - 220, y0 + (lines.length - 1) * 60 + 50, 440, 1.5);
    this.continueMark(c, W / 2, y0 + (lines.length - 1) * 60 + 80, done);
  }
  drawDecree(c, shown, done) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
    if (!this._sheet) this._sheet = Art.makeSheet(900, 700, { seal: true, title: '', c1: '#f7ecd2', c2: '#ead6aa', c3: '#d2b682' });
    const s = this._sheet, k = Ease.outBack(Math.min(1, this.lt * 3));
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.015); c.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    // cover the auto text lines with a clean parchment field
    c.drawImage(s, -s.width / 2, -s.height / 2);
    c.fillStyle = '#efdfb8'; c.globalAlpha = 0.92; c.fillRect(-400, -250, 800, 470); c.globalAlpha = 1;
    txt(c, 'ROYAL DECREE', 0, -280, { size: 50, fam: F.head, weight: 900, align: 'center', color: '#5a1a10', shadow: false, letter: 6 });
    c.fillStyle = 'rgba(90,26,16,0.6)'; c.fillRect(-260, -255, 520, 2);
    const f = font(31, F.head, 700);
    const lines = wrapLines(c, shown, 760, f);
    lines.forEach((l, i) => txt(c, l, -380, -200 + i * 46, { font: f, color: '#2b1a0e', shadow: false }));
    c.restore();
    this.continueMark(c, W / 2 + 380, H / 2 + 330, done);
  }
  drawTip(c, shown, done) {
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, W, H);
    const w = 1040, f = font(32, F.body, 500);
    const lines = wrapLines(c, this.line.t, w - 120, f);
    const h = 170 + lines.length * 44;
    const x = (W - w) / 2, y = (H - h) / 2;
    const k = Ease.outBack(Math.min(1, this.lt * 3));
    c.save(); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
    panel(c, x, y, w, h, { top: 'rgba(56,40,26,0.97)', bottom: 'rgba(26,18,12,0.98)' });
    Art.icon.quill(c, x + 60, y + 62);
    txt(c, "QUARTERMASTER'S TIP", x + 100, y + 74, { size: 34, fam: F.head, weight: 900, color: C.gold, letter: 2 });
    c.fillStyle = C.goldDim; c.fillRect(x + 50, y + 100, w - 100, 1.5);
    const sl = wrapLines(c, shown, w - 120, f);
    sl.forEach((l, i) => txt(c, l, x + 60, y + 150 + i * 44, { font: f, color: '#f6ead0' }));
    c.restore();
    this.continueMark(c, x + w - 50, y + h - 30, done);
  }
  drawSpeech(c, L, shown, done) {
    const g = c.createLinearGradient(0, 560, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    c.fillStyle = g; c.fillRect(0, 560, W, H - 560);
    const sp = SPEAKERS[L.s] || { name: L.s, side: 'right' };
    const left = sp.side === 'left';
    const pw = 300, ph = 375;
    const slide = Ease.outCubic(Math.min(1, this.lt * 5));
    const px = left ? 50 - (1 - slide) * 60 : W - 50 - pw + (1 - slide) * 60, py = H - ph - 40;
    const bx = left ? px + pw + 30 : 60, bw = W - pw - 170, by = H - 250, bh = 210;
    panel(c, bx, by, bw, bh, { top: 'rgba(40,29,21,0.95)', bottom: 'rgba(14,10,8,0.97)' });
    // portrait
    const img = speakerPortrait(L);
    c.save();
    c.shadowColor = L.m === 'fury' || L.m === 'shout' ? 'rgba(255,60,20,0.7)' : 'rgba(0,0,0,0.7)'; c.shadowBlur = 30;
    rr(c, px, py, pw, ph, 14); c.fillStyle = '#000'; c.fill(); c.shadowColor = 'transparent';
    c.save(); rr(c, px, py, pw, ph, 14); c.clip();
    if (img) {
      const iw = img.width, ih = img.height, s = Math.max(pw / iw, ph / ih);
      const jitter = L.m === 'shout' && !done ? rand(-2, 2) : 0;
      c.drawImage(img, px + (pw - iw * s) / 2 + jitter, py + (ph - ih * s) / 2, iw * s, ih * s);
    }
    const pg = c.createLinearGradient(0, py + ph * 0.6, 0, py + ph);
    pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = pg; c.fillRect(px, py, pw, ph);
    c.restore();
    rr(c, px, py, pw, ph, 14); c.lineWidth = 3; c.strokeStyle = C.gold; c.stroke();
    rr(c, px + 7, py + 7, pw - 14, ph - 14, 10); c.lineWidth = 1; c.strokeStyle = 'rgba(216,180,106,0.35)'; c.stroke();
    c.restore();
    // name plate
    const name = sp.name;
    c.save(); c.font = font(30, F.head, 900);
    const nw = c.measureText(name).width + 50; c.restore();
    const nx = left ? bx + 30 : bx + bw - 30 - nw;
    panel(c, nx, by - 30, nw, 52, { r: 10, top: L.s === 'eric' ? 'rgba(120,30,18,0.97)' : 'rgba(60,44,30,0.97)', bottom: L.s === 'eric' ? 'rgba(60,12,6,0.97)' : 'rgba(30,22,15,0.97)', ornaments: false, shadowBlur: 12 });
    txt(c, name, nx + nw / 2, by - 3, { size: 28, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#ffe9c0' });
    // text
    const big = L.m === 'shout' || L.m === 'fury';
    const f = font(big ? 40 : 36, F.body, big ? 700 : 500);
    const lines = wrapLines(c, shown, bw - 90, f);
    lines.forEach((l, i) => txt(c, l, bx + 45, by + 75 + i * 50, { font: f, color: big ? '#fff1dc' : '#f3e9d2' }));
    this.continueMark(c, bx + bw - 40, by + bh - 30, done);
  }
}
const Dialog = {
  play(key, onLine) {
    const lines = typeof key === 'string' ? SCRIPTS[key] : key;
    if (!lines || !lines.length) return Promise.resolve();
    return new Promise(res => { G.overlay = new DialogOverlay(lines, res, onLine); });
  },
};

// ---------------------------------------------------------------- chapter banner
class BannerOverlay {
  constructor(small, big, done) { this.small = small; this.big = big; this.done = done; this.t = 0; this.dur = 3.0; }
  update(dt) {
    this.t += dt;
    if (this.t > 0.4 && (G.mouse.clicked || confirmHit())) { G.mouse.clicked = false; this.t = Math.max(this.t, this.dur - 0.4); }
    if (this.t >= this.dur) { if (G.overlay === this) G.overlay = null; this.done(); }
  }
  draw(c) {
    const t = this.t, a = t < 0.5 ? t / 0.5 : t > this.dur - 0.5 ? (this.dur - t) / 0.5 : 1;
    c.save(); c.globalAlpha = clamp(a, 0, 1);
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, 0, W, H);
    const spread = Ease.outCubic(Math.min(1, t / 1.2));
    c.fillStyle = C.gold;
    c.fillRect(W / 2 - 420 * spread, 470, 840 * spread, 2); c.fillRect(W / 2 - 420 * spread, 640, 840 * spread, 2);
    txt(c, this.small, W / 2, 440, { size: 34, fam: F.head, weight: 700, align: 'center', color: C.gold, letter: 10 });
    txt(c, this.big, W / 2, 575, { size: 92, fam: F.title, weight: 900, align: 'center', base: 'middle', color: '#fff0d6', shadowColor: 'rgba(255,80,30,0.6)', shadowBlur: 30 });
    c.restore();
  }
}
const Banner = { show(small, big) { return new Promise(res => { G.overlay = new BannerOverlay(small, big, res); AudioSys.sfx('slam'); }); } };

// ---------------------------------------------------------------- notice (rewards etc.)
class NoticeOverlay {
  constructor(title, lines, done) { this.title = title; this.lines = lines; this.done = done; this.t = 0; }
  update(dt) {
    this.t += dt;
    if (this.t > 0.3 && confirmHit()) this.finish();
  }
  finish() { if (G.overlay === this) G.overlay = null; this.done(); }
  draw(c) {
    const k = Ease.outBack(Math.min(1, this.t * 3.5));
    c.save(); c.fillStyle = `rgba(0,0,0,${0.55 * Math.min(1, this.t * 4)})`; c.fillRect(0, 0, W, H);
    const w = 720, h = 210 + this.lines.length * 56, x = (W - w) / 2, y = (H - h) / 2;
    c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
    panel(c, x, y, w, h);
    txt(c, this.title, W / 2, y + 70, { size: 44, fam: F.head, weight: 900, align: 'center', color: C.gold });
    this.lines.forEach((l, i) => {
      if (l.icon) Art.icon.item(c, x + 90, y + 130 + i * 56, l.icon);
      txt(c, l.text, x + (l.icon ? 130 : w / 2), y + 140 + i * 56, { size: 32, align: l.icon ? 'left' : 'center', color: l.color || C.text, weight: 700 });
    });
    if (button(c, 'notice_ok', W / 2 - 110, y + h - 80, 220, 56, 'Onward', { layer: 'overlay' })) this.finish();
    c.restore();
  }
}
const Notice = { show(title, lines) { return new Promise(res => { G.overlay = new NoticeOverlay(title, lines, res); }); } };

// ---------------------------------------------------------------- video cutscenes
//  Cutscene.play('intro') plays assets/video/cut_intro.mp4 over the game, skippable.
//  A missing or broken file simply resolves straight away.
class CutsceneOverlay {
  // names: one clip or a list played back-to-back (the next clip is preloaded for a clean hard cut).
  // Click / Enter skips the current clip, Esc skips the whole sequence. Resolves true if anything played.
  constructor(names, done) {
    this.names = [].concat(names); this.idx = 0; this.done = done;
    this.t = 0; this.ct = 0; this.a = 0; this.closing = false; this.started = false; this.played = false;
    this.v = this.make(this.names[0]); this.nextV = null;
    this.start(this.v);
    AudioSys.duck(0.12);
  }
  make(name) {
    const v = document.createElement('video');
    v.src = 'assets/video/cut_' + name + '.mp4'; v.playsInline = true; v.preload = 'auto'; v.volume = 1;
    v.addEventListener('ended', () => { if (v === this.v) this.advance(); });
    v.addEventListener('error', () => { v._bad = true; if (v === this.v) this.advance(true); });
    v.addEventListener('playing', () => { if (v === this.v) { this.started = true; this.played = true; } });
    return v;
  }
  start(v) {
    this.ct = 0; this.started = false;
    v.play().catch(() => { v.muted = true; v.play().catch(() => this.advance(true)); });
    if (this.idx + 1 < this.names.length) this.nextV = this.make(this.names[this.idx + 1]);
  }
  advance(failed) {
    if (this.closing) return;
    if (failed && !this.played) return this.close(true);          // first clip missing → fall back
    try { this.v.pause(); } catch (e) {}
    if (++this.idx >= this.names.length) return this.close();
    this.v = this.nextV; this.nextV = null;
    if (this.v._bad) return this.advance(true);
    this.start(this.v);
  }
  close(now) {
    if (this.closing) return;
    this.closing = true;
    AudioSys.duck(1);
    const fin = () => {
      for (const v of [this.v, this.nextV]) if (v) try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
      if (G.overlay === this) G.overlay = null; this.done(this.played);
    };
    if (now) fin(); else tween(this, { a: 0 }, 0.35, Ease.linear).then(fin);
  }
  update(dt) {
    this.t += dt; this.ct += dt;
    if (!this.closing) this.a = Math.min(1, this.a + dt * 3);
    if (!this.started && this.ct > 6) return this.advance(true); // never started — give up on this clip
    if (this.t > 0.4 && !this.closing) {
      if (cancelHit()) { AudioSys.sfx('click'); this.close(); }
      else if (G.mouse.clicked || confirmHit()) { G.mouse.clicked = false; AudioSys.sfx('click'); this.advance(); this.t = 0.2; }
    }
  }
  draw(c) {
    c.save(); c.globalAlpha = this.a;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (this.v.readyState >= 2) drawCover(c, this.v);
    const multi = this.names.length > 1;
    if (this.t > 0.6 && !this.closing) txt(c, multi ? 'Click — next shot   ·   Esc — skip all  ▸' : 'Click / Esc — skip  ▸', W - 34, H - 34, { size: 22, align: 'right', color: 'rgba(255,255,255,' + (0.5 * Math.min(1, (this.t - 0.6) * 2)) + ')' });
    c.restore();
  }
}
const Cutscene = { play(names) { if (!names) return Promise.resolve(false); return new Promise(res => { G.overlay = new CutsceneOverlay(names, res); }); } };
