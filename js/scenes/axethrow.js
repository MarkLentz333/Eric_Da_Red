'use strict';
// ============================================================================
//  AXE THROWING (v3 side game at Bjarni's range in Fjordheim)
//  5 throws: lock the sweeping aim line horizontally, then vertically. Wind drifts the axe.
//  Rings: bullseye 50 / 25 / 10 / 5 / edge 1.  Best score + one-time prizes are saved.
// ============================================================================
const AXE_PRIZES = [
  { at: 100, reward: { herring: 1 }, label: 'Bronze' },
  { at: 150, reward: { mead: 1, tea: 1 }, label: 'Silver' },
  { at: 200, reward: { rune: 1 }, label: 'Gold' },
];
const AXE_RINGS = [[0.12, 50], [0.32, 25], [0.55, 10], [0.8, 5], [1, 1]];

class AxeThrowScene {
  enter() {
    this.cx = W / 2; this.cy = 470; this.R = 230;
    this.reset();
    if (!this.board) this.board = this.makeBoard();
    AudioSys.playMusic('background');
  }
  reset() {
    this.t = 0; this.throwN = 0; this.score = 0; this.stuck = []; this.flying = null; this.result = null;
    this.newThrow();
  }
  newThrow() {
    this.phase = 'aimX'; this.pt = 0; this.ax = null; this.ay = null;
    this.wind = Math.round(rand(-3, 3));
    this.speed = 1.7 + this.throwN * 0.22;
    this.off = rand(0, TAU);
  }
  makeBoard() {
    const R = this.R, S = R * 2 + 40, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d'); c.translate(S / 2, S / 2);
    // bark rim
    c.fillStyle = '#3a2412'; c.beginPath(); c.arc(0, 0, R + 16, 0, TAU); c.fill();
    for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; c.strokeStyle = i % 2 ? 'rgba(20,10,4,0.6)' : 'rgba(110,70,40,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2)); c.lineTo(Math.cos(a) * (R + 15), Math.sin(a) * (R + 15)); c.stroke(); }
    // end grain
    const g = c.createRadialGradient(-30, -40, 10, 0, 0, R); g.addColorStop(0, '#efcf98'); g.addColorStop(0.7, '#c99a5e'); g.addColorStop(1, '#9a6c3c');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    for (let r = 6; r < R; r += 4 + Math.random() * 5) { c.strokeStyle = `rgba(110,65,30,${0.18 + Math.random() * 0.2})`; c.lineWidth = 1 + Math.random(); c.beginPath(); c.ellipse(Math.random() * 3, Math.random() * 3, r, r * 0.985, 0, 0, TAU); c.stroke(); }
    // radial checks
    for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; c.strokeStyle = 'rgba(60,35,15,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.stroke(); }
    // painted rings (slightly worn)
    const paint = (r0, r1, col) => { c.save(); c.globalAlpha = 0.86; c.fillStyle = col; c.beginPath(); c.arc(0, 0, r1, 0, TAU); c.arc(0, 0, r0, 0, TAU, true); c.fill(); c.restore(); };
    paint(R * 0.8, R * 0.995, '#231812');
    paint(R * 0.55, R * 0.8, '#e8dcc0');
    paint(R * 0.32, R * 0.55, '#231812');
    paint(R * 0.12, R * 0.32, '#e8dcc0');
    paint(0, R * 0.12, '#b8281a');
    c.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(140,95,55,${Math.random() * 0.35})`; const a = Math.random() * TAU, r = Math.random() * R; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + Math.random() * 7, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    // old cut marks
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r = Math.random() * R * 0.95; c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(Math.random() * 3); c.strokeStyle = 'rgba(40,20,8,0.55)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke(); c.restore(); }
    return cv;
  }
  ringScore(x, y) {
    const d = Math.hypot(x - this.cx, y - this.cy) / this.R;
    for (const [f, pts] of AXE_RINGS) if (d <= f) return pts;
    return 0;
  }
  press() { return confirmHit() || (G.mouse.clicked && !this.result); }
  update(dt) {
    this.t += dt; this.pt += dt;
    if (G.overlay) return;
    if (this.result) {
      if (keyHit('Escape')) this.leave();
      return;
    }
    if (keyHit('Escape')) { this.leave(); return; }
    const R = this.R;
    if (this.phase === 'aimX') {
      this.lx = this.cx + Math.sin(this.off + this.pt * this.speed * 1.6) * R * 1.12;
      if (this.press()) { G.mouse.clicked = false; this.ax = this.lx; this.phase = 'aimY'; this.pt = 0; this.off = rand(0, TAU); AudioSys.sfx('qteGood'); }
    } else if (this.phase === 'aimY') {
      this.ly = this.cy + Math.sin(this.off + this.pt * this.speed * 1.9) * R * 1.12;
      if (this.press()) { G.mouse.clicked = false; this.ay = this.ly; this.throwAxe(); }
    } else if (this.phase === 'fly') {
      const f = this.flying; f.k = Math.min(1, f.k + dt / f.dur);
      if (f.k >= 1) this.land();
    } else if (this.phase === 'land') {
      if (this.pt > 1.0) { if (this.throwN >= 5) this.finish(); else this.newThrow(); }
    }
    for (const s of this.stuck) if (s.fall) { s.vy += 1600 * dt; s.y += s.vy * dt; s.rot += 6 * dt; }
  }
  throwAxe() {
    this.phase = 'fly'; this.pt = 0; this.throwN++;
    const tx = this.ax + this.wind * 22 + rand(-8, 8), ty = this.ay + rand(-8, 8);
    this.flying = { sx: W / 2 + 160, sy: H + 120, tx, ty, k: 0, dur: 0.42 };
    AudioSys.sfx('heavySwing'); AudioSys.sfx('swing');
  }
  land() {
    const f = this.flying, pts = this.ringScore(f.tx, f.ty);
    this.phase = 'land'; this.pt = 0;
    const hit = { x: f.tx, y: f.ty, rot: -0.5 + rand(-0.15, 0.15), fall: pts === 0, vy: -200 };
    this.stuck.push(hit);
    this.flying = null;
    this.score += pts;
    if (pts === 0) { AudioSys.sfx('thud'); AudioSys.sfx('qteMiss'); Floaters.add('MISS', f.tx, f.ty - 60, { color: '#c9bca2', size: 54 }); shake(6); }
    else {
      AudioSys.sfx('crackWood', { x: f.tx }); AudioSys.sfx('thud', { x: f.tx });
      shake(pts >= 25 ? 16 : 9);
      Particles.spawn('chip', f.tx, f.ty, 14, { color: ['#c99a5e', '#8a5a2f', '#efcf98'], speed: 520, g: 1600, life: 0.9 });
      if (pts === 50) {
        AudioSys.sfx('crit'); AudioSys.sfx('cheer'); hitstop(0.08); slowmo(0.35, 0.35); screenFlash('#fff2c0', 0.35);
        Floaters.add('BULLSEYE! +50', f.tx, f.ty - 80, { color: '#ffd76a', size: 70 });
      } else Floaters.add('+' + pts, f.tx, f.ty - 70, { color: pts >= 25 ? '#ffe2a0' : '#fff', size: 60 });
    }
  }
  async finish() {
    const best = Game.save.axeBest || 0, nb = this.score > best;
    if (nb) Game.save.axeBest = this.score;
    Game.save.axePrize = Game.save.axePrize || {};
    const won = [];
    for (const p of AXE_PRIZES) if (this.score >= p.at && !Game.save.axePrize[p.at]) { Game.save.axePrize[p.at] = true; won.push(...Game.give(p.reward)); }
    Game.persist();
    const lines = this.score >= 200 ? ['By Odin\'s left eye. I\'m retiring.', 'Gold! The range is yours, Quartermaster.'] :
      this.score >= 150 ? ['Silver work! Your ledger arm is strong.', 'Now THAT is a throw.'] :
      this.score >= 100 ? ['Bronze. Respectable. The target respects you.', 'Not bad for a man who counts barrels.'] :
      this.score >= 50 ? ['The target is still standing. So is your dignity, mostly.', 'You hit wood! That\'s the main thing.'] :
      ['Did you aim at the target, or at Olaf?', 'The trees behind it have filed a complaint.'];
    this.result = { t: 0, nb, best: Math.max(best, this.score), line: pick(lines), prizes: won };
    if (nb && this.score > 0) AudioSys.sting('levelup'); else AudioSys.sting('victory');
  }
  leave() { if (this.leaving) return; this.leaving = true; AudioSys.sfx('back'); goto(Game.mapScene || new WorldScene(), 0.5); }

  drawAxe(c, x, y, rot, s) {
    const ax = G.img._axe; if (!ax) return;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.drawImage(ax, -60, -50, 170, 360);   // blade (top of sprite) at the pivot
    c.restore();
  }
  draw(c) {
    drawCover(c, G.img.bg_forest, 0, 0, 1.06);
    c.fillStyle = 'rgba(8,6,4,0.55)'; c.fillRect(0, 0, W, H);
    // plank backstop
    const bx = this.cx - 470, by = this.cy - 330, bw = 940, bh = 700;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 50; c.fillStyle = '#4a2f18'; c.fillRect(bx, by, bw, bh); c.restore();
    for (let i = 0; i < 10; i++) {
      const x = bx + i * bw / 10, g = c.createLinearGradient(x, 0, x + bw / 10, 0);
      const t = (i * 37 % 10) / 10;
      g.addColorStop(0, `rgb(${70 + t * 20},${45 + t * 12},${24 + t * 6})`); g.addColorStop(0.5, `rgb(${105 + t * 25},${70 + t * 15},${38 + t * 8})`); g.addColorStop(1, `rgb(${62 + t * 18},${40 + t * 10},${22 + t * 5})`);
      c.fillStyle = g; c.fillRect(x + 2, by, bw / 10 - 4, bh);
      c.fillStyle = 'rgba(30,18,8,0.8)'; c.beginPath(); c.arc(x + bw / 20, by + 30, 5, 0, TAU); c.arc(x + bw / 20, by + bh - 30, 5, 0, TAU); c.fill();
    }
    // ground
    const gg = c.createLinearGradient(0, by + bh - 40, 0, H); gg.addColorStop(0, '#3a2a18'); gg.addColorStop(1, '#120c06');
    c.fillStyle = gg; c.fillRect(0, by + bh - 20, W, H);
    // board
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 40; c.shadowOffsetY = 16;
    c.drawImage(this.board, this.cx - this.board.width / 2, this.cy - this.board.height / 2); c.restore();
    // stuck axes
    for (const s of this.stuck) this.drawAxe(c, s.x, s.y, s.rot, 0.62);
    // flying axe (spins toward the board, shrinking with distance)
    if (this.flying) {
      const f = this.flying, k = Ease.outCubic(f.k);
      const x = lerp(f.sx, f.tx, k), y = lerp(f.sy, f.ty, k) - Math.sin(f.k * Math.PI) * 160;
      this.drawAxe(c, x, y, -0.5 - (1 - f.k) * TAU * 2.5, lerp(1.25, 0.62, f.k));
    }
    // aim lines
    const R = this.R;
    if (this.phase === 'aimX' || this.phase === 'aimY') {
      c.save(); c.shadowColor = 'rgba(255,200,90,0.9)'; c.shadowBlur = 16; c.lineWidth = 5;
      const lx = this.phase === 'aimX' ? this.lx : this.ax;
      c.strokeStyle = this.phase === 'aimX' ? '#ffd76a' : 'rgba(255,215,106,0.55)';
      c.beginPath(); c.moveTo(lx, this.cy - R - 50); c.lineTo(lx, this.cy + R + 50); c.stroke();
      if (this.phase === 'aimY') {
        c.strokeStyle = '#ffd76a';
        c.beginPath(); c.moveTo(this.cx - R - 50, this.ly); c.lineTo(this.cx + R + 50, this.ly); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(this.ax, this.ly, 8, 0, TAU); c.fill();
      }
      c.restore();
      // where the wind will push it
      if (this.wind && this.phase === 'aimY') {
        c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#9fd6ff'; c.setLineDash([6, 8]); c.lineWidth = 3;
        c.beginPath(); c.moveTo(this.ax, this.ly); c.lineTo(this.ax + this.wind * 22, this.ly); c.stroke(); c.restore();
      }
    }
    Particles.draw(c, 'back'); Particles.draw(c, 'front'); Floaters.draw(c);
    // wind flag
    const fx = this.cx + 560, fy = 150;
    c.fillStyle = '#3a2412'; c.fillRect(fx - 4, fy - 20, 8, 240);
    c.save(); c.translate(fx, fy - 10);
    const dir = Math.sign(this.wind) || 1, str = Math.abs(this.wind);
    c.fillStyle = '#b8281a'; c.beginPath(); c.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) { const u = i / 10; c.lineTo(dir * u * (30 + str * 30), Math.sin(this.t * (4 + str * 2) + u * 5) * (6 + (3 - str) * 4) + u * (3 - str) * 18); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; c.lineTo(dir * u * (30 + str * 30), 50 + Math.sin(this.t * (4 + str * 2) + u * 5) * (6 + (3 - str) * 4) + u * (3 - str) * 18); }
    c.closePath(); c.fill(); c.restore();
    txt(c, this.wind ? `WIND ${this.wind < 0 ? '◀' : '▶'} ${str}` : 'NO WIND', fx, fy + 260, { size: 28, fam: F.head, weight: 900, align: 'center', color: '#cfe6ff' });
    // HUD
    panel(c, 40, 30, 470, 150);
    txt(c, "BJARNI'S AXE RANGE", 70, 76, { size: 26, fam: F.head, weight: 900, color: C.gold, letter: 2 });
    txt(c, 'SCORE ' + this.score, 70, 128, { size: 44, fam: F.head, weight: 900, color: '#fff' });
    txt(c, 'Best ' + (Game.save.axeBest || 0), 480, 128, { size: 24, fam: F.head, weight: 700, align: 'right', color: C.textDim });
    for (let i = 0; i < 5; i++) { c.save(); c.globalAlpha = i < 5 - this.throwN ? 1 : 0.2; this.drawAxe(c, 90 + i * 60, 220, -0.4, 0.28); c.restore(); }
    const hint = this.phase === 'aimX' ? 'Press SPACE / click to lock your AIM (left–right)' : this.phase === 'aimY' ? 'Now lock the HEIGHT (up–down)' : '';
    if (hint && !this.result) txt(c, hint, W / 2, H - 60, { size: 30, fam: F.head, weight: 700, align: 'center', color: '#ffe2b0' });
    txt(c, 'Esc: leave', W - 40, H - 30, { size: 22, align: 'right', color: 'rgba(255,240,210,0.5)' });
    // prizes legend
    let py = 290;
    txt(c, 'PRIZES', 70, py, { size: 22, fam: F.head, weight: 900, color: C.gold, letter: 2 });
    for (const p of AXE_PRIZES) {
      py += 36; const got = (Game.save.axePrize || {})[p.at];
      txt(c, `${p.label} ${p.at}+  ${Object.keys(p.reward).map(k => ITEMS[k].name).join(', ')}${got ? '  ✓' : ''}`, 70, py, { size: 21, color: got ? '#9cf08a' : C.textDim });
    }
    if (this.result) this.drawResult(c);
  }
  drawResult(c) {
    const r = this.result; r.t += G.dt;
    const a = clamp(r.t / 0.4, 0, 1);
    c.fillStyle = `rgba(0,0,0,${0.55 * a})`; c.fillRect(0, 0, W, H);
    const w = 760, h = 420 + r.prizes.length * 40, x = (W - w) / 2, y = (H - h) / 2 - 20;
    c.save(); c.globalAlpha = a;
    panel(c, x, y, w, h);
    txt(c, 'FINAL SCORE', W / 2, y + 66, { size: 32, fam: F.head, weight: 900, align: 'center', color: C.gold, letter: 3 });
    txt(c, String(this.score), W / 2, y + 160, { size: 100, fam: F.title, weight: 900, align: 'center', color: '#fff' });
    txt(c, r.nb ? 'NEW BEST!' : 'Best: ' + r.best, W / 2, y + 210, { size: 30, fam: F.head, weight: 900, align: 'center', color: r.nb ? '#ffd76a' : C.textDim });
    txt(c, '"' + r.line + '"  — Bjarni', W / 2, y + 262, { size: 25, style: 'italic', align: 'center', color: C.text });
    r.prizes.forEach((p, i) => txt(c, 'Prize: ' + p.text, W / 2, y + 310 + i * 40, { size: 26, fam: F.head, weight: 700, align: 'center', color: '#9cf08a' }));
    c.restore();
    if (r.t > 0.6) {
      if (button(c, 'ax_again', W / 2 - 300, y + h - 90, 280, 64, 'Throw Again') || confirmHit()) { AudioSys.sfx('click'); this.reset(); }
      else if (button(c, 'ax_leave', W / 2 + 20, y + h - 90, 280, 64, 'Leave')) this.leave();
    }
  }
}
