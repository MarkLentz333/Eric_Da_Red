'use strict';
// ============================================================================
//  ART — procedural, painterly-ish vector art rendered to canvases
// ============================================================================
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

const Art = {};

// ---------------------------------------------------------------- Bearded axe
// Canvas 140x360. Grip/pivot at (70, 300). Blade on +x side near the top.
Art.makeAxe = function () {
  const [cv, c] = mkCanvas(170, 360);
  c.translate(60, 0);
  // haft
  const hg = c.createLinearGradient(-9, 0, 9, 0);
  hg.addColorStop(0, '#3a2414'); hg.addColorStop(0.35, '#8a5a33'); hg.addColorStop(0.6, '#6a4224'); hg.addColorStop(1, '#2c1a0e');
  c.fillStyle = hg; rr(c, -8, 18, 16, 335, 7); c.fill();
  // wood grain
  c.strokeStyle = 'rgba(30,16,8,0.35)'; c.lineWidth = 1;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-5 + i * 2.5, 30); c.bezierCurveTo(-4 + i * 2.5, 120, -6 + i * 2.5, 220, -5 + i * 2.5, 340); c.stroke(); }
  // leather wraps
  for (let y = 250; y < 340; y += 11) {
    const lg = c.createLinearGradient(-10, 0, 10, 0);
    lg.addColorStop(0, '#1d120b'); lg.addColorStop(0.5, '#4a3020'); lg.addColorStop(1, '#170e08');
    c.fillStyle = lg; c.save(); c.translate(0, y); c.rotate(-0.12); rr(c, -10, -4, 20, 8, 3); c.fill(); c.restore();
  }
  // pommel
  const pg = c.createRadialGradient(-2, 348, 1, 0, 350, 12);
  pg.addColorStop(0, '#f2f2ec'); pg.addColorStop(0.5, '#8d9399'); pg.addColorStop(1, '#3b4045');
  c.fillStyle = pg; c.beginPath(); c.ellipse(0, 350, 11, 8, 0, 0, TAU); c.fill();
  // socket
  const sg = c.createLinearGradient(-12, 0, 12, 0);
  sg.addColorStop(0, '#41474d'); sg.addColorStop(0.5, '#c9cfd4'); sg.addColorStop(1, '#3a3f44');
  c.fillStyle = sg; rr(c, -12, 22, 24, 74, 5); c.fill();
  // blade (bearded)
  c.beginPath();
  c.moveTo(10, 30);
  c.bezierCurveTo(40, 26, 70, 6, 92, 0);
  c.bezierCurveTo(112, 40, 116, 110, 100, 160);
  c.bezierCurveTo(82, 150, 60, 128, 42, 112);
  c.bezierCurveTo(30, 100, 20, 92, 10, 90);
  c.closePath();
  const bg = c.createLinearGradient(10, 0, 110, 120);
  bg.addColorStop(0, '#4b5258'); bg.addColorStop(0.3, '#aab3ba'); bg.addColorStop(0.55, '#e9eef1'); bg.addColorStop(0.75, '#9aa3aa'); bg.addColorStop(1, '#5c646b');
  c.fillStyle = bg; c.fill();
  c.lineWidth = 2; c.strokeStyle = 'rgba(20,24,28,0.8)'; c.stroke();
  // cutting edge highlight
  c.beginPath(); c.moveTo(92, 2); c.bezierCurveTo(111, 42, 114, 110, 99, 157);
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
  // knotwork engraving
  c.strokeStyle = 'rgba(30,36,40,0.55)'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(30, 40); c.bezierCurveTo(55, 30, 75, 50, 62, 70); c.bezierCurveTo(50, 88, 75, 100, 88, 92); c.stroke();
  c.beginPath(); c.arc(70, 58, 9, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(78, 30); c.lineTo(84, 120); c.stroke();
  // rune glow
  c.strokeStyle = 'rgba(120,220,255,0.55)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(64, 40); c.lineTo(70, 50); c.lineTo(64, 60); c.moveTo(70, 50); c.lineTo(78, 50); c.stroke();
  cv._pivot = { x: 60, y: 300 };
  return cv;
};

// ---------------------------------------------------------------- Parchment
Art.makeSheet = function (w, h, o = {}) {
  const pad = 14;
  const [cv, c] = mkCanvas(w + pad * 2, h + pad * 2);
  c.translate(pad, pad);
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
  c.beginPath();
  c.moveTo(4, 2); c.lineTo(w - 4, 0); c.quadraticCurveTo(w + 2, h * 0.5, w - 2, h - (o.curl ? 30 : 2));
  if (o.curl) { c.quadraticCurveTo(w - 20, h - 18, w - 34, h); }
  c.lineTo(6, h - 2); c.quadraticCurveTo(-2, h * 0.5, 4, 2); c.closePath();
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, o.c1 || '#f6ead0'); g.addColorStop(0.6, o.c2 || '#e7d3a6'); g.addColorStop(1, o.c3 || '#cdb07a');
  c.fillStyle = g; c.fill(); c.shadowColor = 'transparent';
  // burnt edges
  c.save(); c.clip();
  const eg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  eg.addColorStop(0, 'rgba(120,80,30,0)'); eg.addColorStop(1, 'rgba(110,70,25,0.55)');
  c.fillStyle = eg; c.fillRect(0, 0, w, h);
  // speckles
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(110,75,30,${rand(0.05, 0.18)})`; c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(0.5, 3), 0, TAU); c.fill(); }
  c.restore();
  // header + lines of text
  if (o.title) {
    c.fillStyle = 'rgba(60,35,18,0.9)'; c.font = `700 ${Math.round(w * 0.11)}px ${F.head}`; c.textAlign = 'center';
    c.fillText(o.title, w / 2, h * 0.14);
    c.fillRect(w * 0.15, h * 0.18, w * 0.7, 2);
  }
  c.strokeStyle = 'rgba(60,40,25,0.55)'; c.lineWidth = 2;
  for (let y = h * 0.26; y < h * 0.8; y += h * 0.07) {
    let x = w * 0.12;
    while (x < w * 0.86) { const L = rand(10, 38); c.beginPath(); c.moveTo(x, y); c.lineTo(Math.min(w * 0.88, x + L), y + rand(-0.6, 0.6)); c.stroke(); x += L + 7; }
  }
  if (o.seal !== false) {
    const sx = w * 0.76, sy = h * 0.86;
    const sg2 = c.createRadialGradient(sx - 4, sy - 4, 1, sx, sy, 18);
    sg2.addColorStop(0, '#e2463a'); sg2.addColorStop(1, '#7a130e');
    c.fillStyle = sg2; c.beginPath();
    for (let a = 0; a < TAU; a += TAU / 14) { const r = 16 + Math.sin(a * 3) * 2; c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,190,170,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(sx, sy, 8, 0, TAU); c.stroke();
  }
  // signature scrawl
  c.strokeStyle = 'rgba(30,30,80,0.7)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(w * 0.14, h * 0.88);
  for (let i = 0; i < 6; i++) c.quadraticCurveTo(w * (0.17 + i * 0.05), h * (0.82 + (i % 2) * 0.1), w * (0.2 + i * 0.05), h * 0.87);
  c.stroke();
  cv._pad = pad;
  return cv;
};

// Angry eyes (used on objects and papers)
Art.eyes = function (c, x1, y1, x2, y2, size, o = {}) {
  const lid = o.lid ?? 1;           // 1 open, 0 closed
  const look = o.look || 0;         // -1..1 horizontal pupil offset
  for (const [x, y, side] of [[x1, y1, -1], [x2, y2, 1]]) {
    c.save(); c.translate(x, y); c.rotate(-side * 0.32);
    if (o.glow) {
      c.globalCompositeOperation = 'lighter';
      c.drawImage(glowSprite(o.glow), -size * 2.4, -size * 2.4, size * 4.8, size * 4.8);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = o.color || '#ffe9a0';
      c.beginPath(); c.ellipse(0, 0, size, size * 0.42 * lid, 0, 0, TAU); c.fill();
      c.fillStyle = '#2a0800'; c.beginPath(); c.arc(look * size * 0.35, 0, size * 0.26 * Math.max(0.2, lid), 0, TAU); c.fill();
    } else {
      c.fillStyle = '#fff'; c.strokeStyle = '#1b120c'; c.lineWidth = Math.max(1.5, size * 0.16);
      c.beginPath(); c.ellipse(0, 0, size, size * 0.75 * lid, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#16100c'; c.beginPath(); c.arc(look * size * 0.4, size * 0.08, size * 0.4 * Math.max(0.2, lid), 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(look * size * 0.4 - size * 0.14, -size * 0.1, size * 0.12, 0, TAU); c.fill();
    }
    // angry brow: outer end high, inner end low
    c.rotate(side * 0.32);
    c.strokeStyle = o.brow || '#1b120c'; c.lineWidth = size * 0.34; c.lineCap = 'round';
    c.beginPath(); c.moveTo(side * size * 1.15, -size * 1.25); c.lineTo(-side * size * 0.95, -size * 0.62); c.stroke();
    c.restore();
  }
};

// ---------------------------------------------------------------- Stamp
Art.makeStamp = function (text, color = '#c4271b', w = 640, h = 170) {
  const [cv, c] = mkCanvas(w + 20, h + 20);
  c.translate(10, 10);
  c.strokeStyle = color; c.fillStyle = color;
  c.lineWidth = 10; rr(c, 5, 5, w - 10, h - 10, 18); c.stroke();
  c.lineWidth = 3; rr(c, 20, 20, w - 40, h - 40, 10); c.stroke();
  c.font = `900 ${Math.round(h * 0.42)}px ${F.head}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  let fs = h * 0.42;
  while (c.measureText(text).width > w - 70 && fs > 20) { fs -= 2; c.font = `900 ${Math.round(fs)}px ${F.head}`; }
  c.fillText(text, w / 2, h / 2 + 4);
  // grunge
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { c.globalAlpha = rand(0.2, 0.9); c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(0.6, 3.2), 0, TAU); c.fill(); }
  for (let i = 0; i < 6; i++) { c.globalAlpha = 0.35; c.lineWidth = rand(1, 3); c.beginPath(); const y = rand(0, h); c.moveTo(0, y); c.lineTo(w, y + rand(-20, 20)); c.stroke(); }
  return cv;
};

// ---------------------------------------------------------------- Emblem portrait
Art.makeEmblem = function (letter, c1, c2, glyph) {
  const S = 300;
  const [cv, c] = mkCanvas(S, S * 1.25);
  const cx = S / 2, cy = S * 0.62;
  const bg = c.createLinearGradient(0, 0, 0, S * 1.25);
  bg.addColorStop(0, c1); bg.addColorStop(1, c2);
  c.fillStyle = bg; c.fillRect(0, 0, S, S * 1.25);
  // pattern
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 2;
  for (let i = -S; i < S * 2; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S * 1.25, S * 1.25); c.stroke(); }
  // medallion
  const mg = c.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110);
  mg.addColorStop(0, '#fff2c8'); mg.addColorStop(0.5, '#c79a4a'); mg.addColorStop(1, '#5a3c14');
  c.fillStyle = mg; c.beginPath(); c.arc(cx, cy, 104, 0, TAU); c.fill();
  c.fillStyle = 'rgba(30,20,10,0.85)'; c.beginPath(); c.arc(cx, cy, 86, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,220,150,0.5)'; c.lineWidth = 2;
  for (let a = 0; a < TAU; a += TAU / 24) { c.beginPath(); c.moveTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92); c.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100); c.stroke(); }
  c.fillStyle = '#f3d590'; c.font = `900 110px ${F.title}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 10;
  c.fillText(glyph || letter, cx, cy + 6);
  return cv;
};

// ---------------------------------------------------------------- Icons
Art.icon = {
  axe(c, x, y, hot) {
    c.save(); c.translate(x, y); c.rotate(-0.6); c.scale(0.16, 0.16);
    const a = G.img._axe; c.drawImage(a, -a._pivot.x, -a._pivot.y + 140);
    c.restore();
  },
  quill(c, x, y, hot) {
    c.save(); c.translate(x, y); c.rotate(-0.7);
    const g = c.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#d9d2c4'); g.addColorStop(1, '#fffaf0');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(12, -6, 2, 18); c.lineTo(-2, 18); c.quadraticCurveTo(-12, -6, 0, -24); c.fill();
    c.strokeStyle = '#6b5a40'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 24); c.stroke();
    c.fillStyle = '#1c2a5a'; c.beginPath(); c.moveTo(-2, 18); c.lineTo(2, 18); c.lineTo(0, 26); c.fill();
    c.restore();
  },
  pouch(c, x, y) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-5, -2, 2, 0, 4, 20); g.addColorStop(0, '#9a6a40'); g.addColorStop(1, '#4a2c16');
    c.fillStyle = g; c.beginPath(); c.moveTo(-12, -8); c.quadraticCurveTo(-20, 18, 0, 18); c.quadraticCurveTo(20, 18, 12, -8); c.closePath(); c.fill();
    c.fillStyle = '#3a2210'; c.fillRect(-11, -12, 22, 6);
    c.fillStyle = '#d8b46a'; c.beginPath(); c.arc(0, -9, 3, 0, TAU); c.fill();
    c.restore();
  },
  shield(c, x, y) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-5, -5, 2, 0, 0, 20); g.addColorStop(0, '#b0473a'); g.addColorStop(1, '#5a1610');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
    c.strokeStyle = '#c9cfd4'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#c9cfd4'; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(40,20,10,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-17, 0); c.lineTo(17, 0); c.moveTo(0, -17); c.lineTo(0, 17); c.stroke();
    c.restore();
  },
  flame(c, x, y) {
    c.save(); c.translate(x, y);
    const g = c.createLinearGradient(0, 20, 0, -24); g.addColorStop(0, '#ff3b10'); g.addColorStop(0.6, '#ffae2a'); g.addColorStop(1, '#fff3a0');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -24 - Math.sin(G.rt * 12) * 3); c.quadraticCurveTo(16, -4, 12, 10); c.quadraticCurveTo(8, 20, 0, 20);
    c.quadraticCurveTo(-10, 20, -12, 8); c.quadraticCurveTo(-14, -6, 0, -24); c.fill();
    c.restore();
  },
  item(c, x, y, kind) {
    c.save(); c.translate(x, y);
    if (kind === 'mead') {
      const g = c.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#e8d8b0'); g.addColorStop(1, '#9c8358');
      c.fillStyle = g; c.beginPath(); c.moveTo(-14, -14); c.quadraticCurveTo(-10, 16, 10, 18); c.quadraticCurveTo(4, 2, 12, -14); c.closePath(); c.fill();
      c.fillStyle = '#e6a92a'; c.beginPath(); c.ellipse(-1, -14, 13, 4, 0, 0, TAU); c.fill();
    } else if (kind === 'herring') {
      const g = c.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#c9d6de'); g.addColorStop(1, '#6f8794');
      c.fillStyle = g; c.beginPath(); c.ellipse(-2, 0, 14, 7, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(20, -8); c.lineTo(20, 8); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(-10, -2, 1.6, 0, TAU); c.fill();
    } else if (kind === 'ink') {
      const g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#1d2c5e'); g.addColorStop(0.5, '#4a68c4'); g.addColorStop(1, '#141f44');
      c.fillStyle = g; rr(c, -11, -6, 22, 20, 5); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(-6, -12, 12, 7);
      c.strokeStyle = '#f2ecdc'; c.lineWidth = 2; c.beginPath(); c.moveTo(2, -10); c.lineTo(12, -24); c.stroke();
    } else if (kind === 'tea') {
      c.fillStyle = '#7a5532'; rr(c, -12, -6, 24, 18, 6); c.fill();
      c.fillStyle = '#5c8a3a'; c.beginPath(); c.ellipse(0, -6, 11, 3, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, -12); c.quadraticCurveTo(-8, -18, -3, -24); c.moveTo(4, -12); c.quadraticCurveTo(0, -18, 5, -24); c.stroke();
    } else if (kind === 'rune') {
      const g = c.createRadialGradient(-4, -4, 2, 0, 0, 16); g.addColorStop(0, '#9a9a96'); g.addColorStop(1, '#3a3a38');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 13, 16, 0.2, 0, TAU); c.fill();
      c.strokeStyle = '#ff5a2a'; c.lineWidth = 2.5; c.shadowColor = '#ff5a2a'; c.shadowBlur = 8;
      c.beginPath(); c.moveTo(-4, -9); c.lineTo(-4, 9); c.moveTo(-4, -9); c.lineTo(5, -2); c.lineTo(-4, 3); c.stroke();
    }
    c.restore();
  },
};

// ---------------------------------------------------------------- Soft cloud texture
Art.makeCloud = function (w, h, color = '255,255,255') {
  const [cv, c] = mkCanvas(w, h);
  for (let i = 0; i < 26; i++) {
    const x = rand(w * 0.15, w * 0.85), y = rand(h * 0.3, h * 0.7), r = rand(h * 0.15, h * 0.42);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},0.22)`); g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  return cv;
};

// ---------------------------------------------------------------- Kraken
Art.drawKrakenBody = function (c, e, t) {
  const img = G.img.kraken_head; if (!img) return;
  const X = e.x + e.offX, Y = e.y + e.offY, h = 600 * (e.scale || 1), s = h / img.height;
  const breathe = Math.sin(t * 1.4);
  c.save(); c.translate(X, Y + breathe * 6); c.scale(-s, s * (1 + breathe * 0.012)); // flipped to face Eric
  if (e.shieldedNow) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
    c.drawImage(glowSprite('rgba(170,110,255,0.8)'), -img.width * 0.75, -img.height * 1.15, img.width * 1.5, img.height * 1.3); c.restore();
  }
  c.drawImage(img, -img.width / 2, -img.height);
  if (e.flash > 0) { c.globalAlpha = e.flash * 0.75; c.drawImage(tinted(img, '#ffffff'), -img.width / 2, -img.height); c.globalAlpha = 1; }
  // eye glow (eye sits at ~49% x, 63% y of the source image)
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + 0.25 * Math.sin(t * 2.3);
  const ex = (0.49 - 0.5) * img.width, ey = (0.635 - 1) * img.height, gs = img.width * 0.22;
  c.drawImage(glowSprite('rgba(255,170,40,0.9)'), ex - gs / 2, ey - gs / 2, gs, gs);
  c.restore();
};

Art.drawTentacle = function (c, e, t) {
  const img = G.img.kraken_tentacle; if (!img) return;
  const h = e.len || 540, s = h / img.height, w = img.width * s;
  const atk = e.attackT || 0;
  const sway = Math.sin(t * 1.7 + (e.phase || 0)) * 0.07 * (1 - atk);
  const rot = sway - atk * 1.15;
  const X = e.x + e.offX + atk * ((e.reachX || -560) + h * 0.85), Y = e.y + e.offY;
  c.save(); c.translate(X, Y); c.rotate(rot); c.scale(s * (1 + atk * 0.08), s * (1 + Math.sin(t * 2.1 + (e.phase || 0)) * 0.015));
  c.drawImage(img, -img.width / 2, -img.height);
  if (e.flash > 0) { c.globalAlpha = e.flash * 0.75; c.drawImage(tinted(img, '#ffffff'), -img.width / 2, -img.height); }
  c.restore();
  // centre point used for targeting / hit effects
  const mid = -h * 0.5;
  e._mid = { x: X + Math.sin(-rot) * mid * -1 + Math.sin(rot) * 0, y: Y + Math.cos(rot) * mid };
  e._mid.x = X - Math.sin(rot) * mid; e._w = w;
};

// Water band drawn in front of the kraken
Art.drawWater = function (c, y, t) {
  c.save();
  const g = c.createLinearGradient(0, y - 40, 0, H);
  g.addColorStop(0, 'rgba(40,46,70,0.0)'); g.addColorStop(0.15, 'rgba(34,40,62,0.92)'); g.addColorStop(1, 'rgba(10,12,22,1)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x * 0.012 + t * 1.6) * 10 + Math.sin(x * 0.031 - t * 2.3) * 5);
  c.lineTo(W, H); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(200,220,255,0.35)'; c.lineWidth = 3;
  c.beginPath();
  for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x * 0.012 + t * 1.6) * 10 + Math.sin(x * 0.031 - t * 2.3) * 5; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
  c.stroke();
  c.strokeStyle = 'rgba(200,220,255,0.12)'; c.lineWidth = 2;
  for (let k = 1; k < 4; k++) {
    c.beginPath();
    for (let x = 0; x <= W; x += 30) { const yy = y + k * 28 + Math.sin(x * 0.02 + t * (1 + k * 0.3) + k) * 6; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
    c.stroke();
  }
  c.restore();
};

// Slash arc effect
const Slashes = {
  list: [],
  add(x, y, r, a0, a1, o = {}) { this.list.push({ x, y, r, a0, a1, life: 0, max: o.life || 0.28, color: o.color || '255,240,210', w: o.w || 34 }); },
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const s = this.list[i]; s.life += dt; if (s.life > s.max) this.list.splice(i, 1); } },
  draw(c) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const s of this.list) {
      const k = s.life / s.max;
      const grow = Ease.outCubic(Math.min(1, k * 2.2));
      const a1 = s.a0 + (s.a1 - s.a0) * grow;
      const a0 = s.a0 + (s.a1 - s.a0) * Math.max(0, k * 1.6 - 0.4);
      const n = 10;
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (a1 - a0) * (i / n), t1 = a0 + (a1 - a0) * ((i + 1) / n);
        c.strokeStyle = `rgba(${s.color},${(1 - k) * (0.25 + 0.75 * i / n)})`;
        c.lineWidth = s.w * (0.25 + 0.75 * i / n) * (1 - k * 0.6);
        c.beginPath(); c.arc(s.x, s.y, s.r, t0, t1, s.a1 < s.a0); c.stroke();
      }
      c.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.9})`; c.lineWidth = 4;
      c.beginPath(); c.arc(s.x, s.y, s.r, a0 + (a1 - a0) * 0.5, a1, s.a1 < s.a0); c.stroke();
    }
    c.restore();
  },
  clear() { this.list.length = 0; },
};
