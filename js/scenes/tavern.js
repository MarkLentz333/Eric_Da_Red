'use strict';
// ============================================================================
//  TAVERN — the final scene. Everyone toasts Eric... until he reaches for the
//  apple. Enter WolfZtnel (cut from source_art/Character/Character_Wolfztnel.jpg).
//  Arms are separate cut-out sprites swung from the shoulder, so the same
//  photoreal arm can grab, lift, and raise a horn of mead.
// ============================================================================
const TAV = {
  BG: { x: -440, y: -440, w: 2800, h: 1564 },   // world rect the backdrop covers (room to zoom out)
  TABLE_BACK: 690, TABLE_FRONT: 900,
  ERIC: { x: 700, top: 300, h: 720 },
  WOLF: { x: 1400, top: 0, h: 1150 },
  BOWL: { x: 960, y: 748 },
  // arm sprites: pivot (shoulder) and hand centre in the arm image; base = full-body sprite it was cut from
  ARMS: {
    wolf_armL: { px: 193, py: 54, hx: 53, hy: 401, bx: 193, by: 420, base: 'wolf' },
    wolf_armR: { px: 68, py: 54, hx: 208, hy: 401, bx: 712, by: 420, base: 'wolf' },
    eric_armR: { px: 22, py: 24, hx: 81, hy: 231, bx: 284, by: 138, base: 'eric_front' },
  },
};

class TavernScene {
  enter() {
    this.t = 0;
    this.shot = 'wide';                       // 'wide' | 'insert'
    this.cam = { x: W / 2, y: H / 2, z: 1 };
    this.wolfOn = false;
    this.grabbed = false;                     // WolfZtnel holds Eric's wrist
    this.lift = 0;                            // 0 on the table → 1 dangling in the air
    this.fly = null;                          // { k } while Eric is being thrown
    this.ericGone = false;
    this.toast = 0;                           // 0..1 raise the horn
    this.laughing = false;
    this.card = 0;                            // name-card alpha
    this.ins = { reach: 0, grab: 0, push: 0, struggle: 0 };
    this.phase = 'story'; this.rollT = 0;
    if (!G.img._stamp_del) G.img._stamp_del = Art.makeStamp('DELIVERED ON TIME', '#c4271b', 900, 200);
    this.makeTextures();
    AudioSys.playMusic('background');
    this.play();
  }

  // ------------------------------------------------------------ prerendered textures
  makeTextures() {
    const bg = G.img.bg_tavern;
    const [cv, x] = mkCanvas(1400, 782);
    if (bg) { x.filter = 'blur(1.4px) saturate(1.08)'; x.drawImage(bg, 0, 0, 1400, 782); x.filter = 'none'; }
    x.fillStyle = 'rgba(40,16,4,0.18)'; x.fillRect(0, 0, 1400, 782);
    this.bg = cv;
    // planks: warm oak with grain
    const [wc, w] = mkCanvas(1024, 512);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y0 = r * 512 / rows, h = 512 / rows;
      const base = [[112, 66, 34], [124, 74, 38], [104, 60, 30], [118, 70, 36], [98, 58, 30]][r];
      const g = w.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, `rgb(${base[0] + 18},${base[1] + 12},${base[2] + 6})`); g.addColorStop(1, `rgb(${base[0] - 14},${base[1] - 10},${base[2] - 6})`);
      w.fillStyle = g; w.fillRect(0, y0, 1024, h);
      for (let i = 0; i < 26; i++) {
        w.strokeStyle = `rgba(${40 + Math.random() * 30},${20 + Math.random() * 14},8,${0.12 + Math.random() * 0.2})`; w.lineWidth = 0.6 + Math.random() * 1.6;
        const yy = y0 + Math.random() * h; w.beginPath(); w.moveTo(0, yy);
        for (let xx = 0; xx <= 1024; xx += 64) w.lineTo(xx, yy + Math.sin(xx * 0.01 + i) * 2.5 + rand(-1, 1));
        w.stroke();
      }
      for (let k = 0; k < 2; k++) { // knots
        const kx = rand(60, 960), ky = y0 + h * rand(0.3, 0.7);
        w.fillStyle = 'rgba(50,24,10,0.5)'; w.beginPath(); w.ellipse(kx, ky, rand(8, 16), rand(4, 7), 0, 0, TAU); w.fill();
      }
      w.fillStyle = 'rgba(20,8,2,0.75)'; w.fillRect(0, y0 + h - 3, 1024, 3);
      w.fillStyle = 'rgba(255,210,150,0.12)'; w.fillRect(0, y0, 1024, 2);
    }
    this.wood = wc;
  }

  // ------------------------------------------------------------ the scene, beat by beat
  async play() {
    // Filmed version (assets/video/cut_tavern_1..4.mp4) if present; the in-engine scene below is the fallback.
    await wait(0.3);
    const filmed = await Cutscene.play(['tavern_1', 'tavern_2', 'tavern_3', 'tavern_4']);
    if (filmed) return this.afterFilm();
    // 1. cheers
    await wait(1.0);
    AudioSys.sfx('cheer'); this.skal(4);
    await Dialog.play('tavern_cheers', L => { if (L.s === 'crowd') { AudioSys.sfx('cheer'); this.skal(7); } });

    // 2. close-up: the reach
    await wait(0.3);
    AudioSys.sfx('whoosh'); this.shot = 'insert';
    await wait(0.5);
    await tween(this.ins, { reach: 1 }, 1.7, Ease.inOutCubic);
    // 3. THE GRAB
    AudioSys.sfx('whoosh');
    await tween(this.ins, { grab: 1 }, 0.11, Ease.inQuad);
    AudioSys.sfx('slam'); AudioSys.sfx('hit'); AudioSys.duck(0, true); AudioSys.sfx('scratch');
    hitstop(0.18); shake(26); screenFlash('#fff', 0.35);
    this.ins.push = 1;
    await wait(0.9);
    // 4. the crowd gasps
    AudioSys.sfx('gasp');
    Floaters.add('*GASP*', W / 2, 190, { size: 92, color: '#ffe9c0', vy: -30, life: 1.8 });
    this.ins.struggle = 1;
    await wait(1.2);
    // 5. a voice from above
    AudioSys.sfx('growl'); shake(14);
    await Dialog.play('tavern_growl');

    // 6. pull back — the reveal
    this.shot = 'wide'; this.wolfOn = true; this.grabbed = true;
    const g0 = this.gripPoint();
    Object.assign(this.cam, { x: g0.x + 40, y: g0.y - 10, z: 1.7 });
    AudioSys.sfx('roar'); shake(10);
    const pull = tween(this.cam, { x: 1120, y: 430, z: 0.8 }, 2.8, Ease.inOutCubic);
    await wait(0.7);
    AudioSys.sfx('hurt');
    tween(this, { lift: 1 }, 1.3, Ease.outBack);
    await pull;
    AudioSys.sfx('slam'); shake(8);
    tween(this, { card: 1 }, 0.5);
    await wait(1.6);
    await Dialog.play('tavern_reveal');
    tween(this, { card: 0 }, 0.4);

    // 7. tossed over the table like a toy
    await wait(0.3);
    AudioSys.sfx('whoosh');
    this.fly = { k: 0, from: this.ericDims() };
    this.grabbed = false;
    await tween(this.fly, { k: 1 }, 1.05, Ease.inQuad);
    this.ericGone = true; this.fly = null;
    AudioSys.sfx('crash'); shake(38); hitstop(0.12);
    const cx = this.cam.x - (W / 2) / this.cam.z + 120, cy = this.cam.y + (H / 2) / this.cam.z - 60;
    Particles.spawn('chip', cx, cy, 40, { color: ['#8a5a32', '#6a4024', '#b07a48'], angle: -Math.PI / 2 - 0.4, spread: 1.2, speed: 1300, size: 18 });
    Particles.spawn('drop', cx + 80, cy, 30, { color: ['#e8b040', '#f5d27a'], angle: -Math.PI / 2, spread: 1.0, speed: 1100, size: 7 });
    Particles.spawn('smoke', cx, cy, 12, { color: 'rgba(120,90,60,0.6)', speed: 220, size: 40, g: -30 });
    Floaters.add('CRASH!', 330, 820, { size: 110, color: '#ffcf6a', vy: -40, life: 1.4 });
    await wait(1.0);
    AudioSys.sfx('gasp');
    await wait(0.8);

    // 8. he laughs, and toasts with mead
    this.laughing = true; AudioSys.sfx('laugh');
    this.haha();
    tween(this, { toast: 1 }, 0.7, Ease.outBack);
    await wait(1.1);
    AudioSys.sfx('laugh'); this.haha();
    AudioSys.duck(1);
    AudioSys.playMusic('intro');
    await wait(0.8);
    AudioSys.sfx('cheer'); this.skal(8);
    await Dialog.play('tavern_toast', L => {
      if (L.s === 'crowd') { AudioSys.sfx('cheer'); this.skal(8); this.clink(); }
      if (L.s === 'wolf' && L.m === 'shout') { AudioSys.sfx('laugh'); this.haha(); this.clink(); }
    });

    // 9. the ledger
    await tween(this.cam, { x: 1010 }, 1.0, Ease.inOutCubic);
    this.phase = 'roll'; this.rollT = 0;
    AudioSys.sfx('slam'); shake(16);
    Game.save.complete = true; Game.persist();
  }

  // after the video: pick up on the final beat — WolfZtnel laughing with his horn raised
  async afterFilm() {
    Object.assign(this.cam, { x: 1120, y: 430, z: 0.8 });
    this.wolfOn = true; this.ericGone = true; this.toast = 1; this.laughing = true;
    AudioSys.playMusic('intro');
    await wait(0.6);
    AudioSys.sfx('cheer'); this.skal(8);
    await Dialog.play('tavern_toast', L => {
      if (L.s === 'crowd') { AudioSys.sfx('cheer'); this.skal(8); this.clink(); }
      if (L.s === 'wolf' && L.m === 'shout') { AudioSys.sfx('laugh'); this.haha(); this.clink(); }
    });
    await tween(this.cam, { x: 1010 }, 1.0, Ease.inOutCubic);
    this.phase = 'roll'; this.rollT = 0;
    AudioSys.sfx('slam'); shake(16);
    Game.save.complete = true; Game.persist();
  }

  skal(n) {
    for (let i = 0; i < n; i++) Floaters.add(pick(['SKÅL!', 'SKÅL!', 'HUZZAH!', 'ERIC!', 'SKÅL!']), rand(160, W - 160), rand(150, 560), { size: rand(46, 72), color: pick(['#ffe2a0', '#fff0d6', '#ffcf6a']), vy: -rand(40, 110), life: rand(1.2, 1.9), delay: rand(0, 0.6) });
  }
  haha() {
    const d = this.wolfDims(), p = this.toScreen(d.x, d.top + d.h * 0.12);
    for (let i = 0; i < 4; i++) Floaters.add(pick(['HA!', 'HAHA!', 'HA HA!', 'HAAA!']), p.x + rand(-300, 300), p.y + rand(-60, 60), { size: rand(56, 84), color: '#ffd27a', vy: -rand(60, 120), life: 1.3, delay: i * 0.18 });
  }
  clink() {
    const h = this.hornTop(), p = this.toScreen(h.x, h.y);
    Particles.spawn('drop', p.x, p.y, 26, { color: ['#e8b040', '#f5d27a', '#fff2c0'], angle: -Math.PI / 2, spread: 0.9, speed: 700, size: 7, g: 1500, layer: 'screen' });
    Particles.spawn('spark', p.x, p.y, 10, { color: '#ffe9a0', speed: 500, size: 10, layer: 'screen' });
  }

  toScreen(x, y) { const C2 = this.cam; return { x: (x - C2.x) * C2.z + W / 2, y: (y - C2.y) * C2.z + H / 2 }; }

  update(dt, rdt) {
    this.t += rdt;
    if (this.phase === 'roll') this.rollT += rdt;
    if (Math.random() < rdt * 10) Particles.ambient('glow', { x: 0, y: H - 40, w: W, h: 40 }, { vy: rand(-110, -40), vx: rand(-20, 20), color: pick(['rgba(255,170,70,0.9)', 'rgba(255,220,120,0.9)']), size: 4, sizeMin: 1, life: rand(3, 6), layer: 'screen' });
    if (this.phase === 'roll' && this.rollT > 2 && confirmHit() && G.scene === this) goto(new TitleScene());
  }

  // ============================================================ drawing
  draw(c) {
    c.save(); c.translate(G.cam.sx, G.cam.sy);
    if (this.shot === 'insert') this.drawInsert(c);
    else this.drawWide(c);
    c.restore();
    Particles.draw(c, 'screen');
    vignette(c, 0.62);
    Floaters.draw(c);
    if (this.card > 0) this.drawCard(c);
    if (this.phase === 'roll') EndingScene.prototype.drawRoll.call(this, c);
  }

  drawWide(c) {
    const C2 = this.cam, t = this.t;
    c.save();
    c.translate(W / 2, H / 2); c.scale(C2.z, C2.z); c.translate(-C2.x, -C2.y);
    const B = TAV.BG;
    c.drawImage(this.bg, B.x, B.y, B.w, B.h);
    // hearth light flicker
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.05 * Math.sin(t * 9) + 0.03 * Math.sin(t * 23);
    c.drawImage(glowSprite('rgba(255,130,40,0.9)'), 300, 200, 1300, 700); c.restore();
    Particles.draw(c, 'back');

    if (this.wolfOn) this.drawWolf(c);
    if (!this.ericGone && !this.fly) this.drawEric(c);
    this.drawTable(c);
    this.drawTableItems(c);

    // the grip: Eric's arm up to the wrist, WolfZtnel's hand clamped on it
    if (this.grabbed) {
      const gp = this.gripPoint(), es = this.ericShoulder(), ws = this.wolfShoulder('L');
      const dir = norm(gp.x - es.x, gp.y - es.y);
      this.drawArm(c, 'eric_armR', es, { x: gp.x + dir.x * 46, y: gp.y + dir.y * 46 }, this.ericScale());
      this.drawArm(c, 'wolf_armL', ws, gp, this.wolfScale());
    }
    if (this.wolfOn && (this.toast > 0 || this.ericGone)) {
      const ws = this.wolfShoulder('R'), h = this.hornHand();
      this.drawArm(c, 'wolf_armR', ws, h, this.wolfScale());
      this.drawHorn(c, h.x + 6, h.y - 20, 1);
    }
    if (this.fly) this.drawFlyingEric(c);
    Particles.draw(c, 'front');
    c.restore();
  }

  // --------------------------------------------- arms
  // Draw an arm sprite rotated about its shoulder so the hand lands on `target`.
  // A little stretch (±20%) is allowed so poses always connect.
  drawArm(c, key, pivot, target, s, alpha = 1) {
    const img = G.img[key], A = TAV.ARMS[key];
    if (!img) return;
    const rest = Math.atan2(A.hy - A.py, A.hx - A.px), len = Math.hypot(A.hx - A.px, A.hy - A.py) * s;
    const ang = Math.atan2(target.y - pivot.y, target.x - pivot.x);
    const stretch = clamp(Math.hypot(target.x - pivot.x, target.y - pivot.y) / len, 0.8, 1.2);
    c.save(); c.globalAlpha = alpha;
    c.translate(pivot.x, pivot.y); c.rotate(ang); c.scale(stretch, 1); c.rotate(-rest);
    c.drawImage(img, -A.px * s, -A.py * s, img.width * s, img.height * s);
    c.restore();
  }
  armLen(key, s) { const A = TAV.ARMS[key]; return Math.hypot(A.hx - A.px, A.hy - A.py) * s; }

  // --------------------------------------------- characters
  ericScale() { return TAV.ERIC.h / G.img.eric_front.height; }
  wolfScale() { const img = G.img.wolf; return TAV.WOLF.h / img.height; }
  // seated (leaning in to reach the apple) and dangling poses, blended by `lift`
  ericDims() {
    const img = G.img.eric_front, s = this.ericScale(), w = img.width * s, E = TAV.ERIC, A = TAV.ARMS.eric_armR;
    const seat = { x: E.x, top: E.top + (this.grabbed ? 40 : 0) };
    const top1 = this.liftedGrip();                       // hanging straight down from the grip
    const sx = (A.bx - img.width / 2) * s, sy = A.by * s, L = this.armLen('eric_armR', s);
    const hang = { x: top1.x - sx, top: top1.y + L * 0.95 - sy };
    const k = this.lift;
    return { img, w, h: E.h, s, x: lerp(seat.x, hang.x, k), top: lerp(seat.top, hang.top, k) };
  }
  ericShoulder() { const d = this.ericDims(), A = TAV.ARMS.eric_armR; return { x: d.x + (A.bx - d.img.width / 2) * d.s, y: d.top + A.by * d.s }; }
  tableGrip() { return { x: TAV.BOWL.x - 40, y: TAV.BOWL.y - 46 }; }
  liftedGrip() {
    const ws = this.wolfShoulder('L'), L = this.armLen('wolf_armL', this.wolfScale()), a = -2.2;
    return { x: ws.x + Math.cos(a) * L, y: ws.y + Math.sin(a) * L };
  }
  gripPoint() {
    const a = this.tableGrip(), b = this.liftedGrip(), k = this.lift;
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) + Math.sin(this.t * 7) * 5 * k };
  }
  drawEric(c) {
    const d = this.ericDims();
    const img = this.grabbed ? (G.img.eric_noR || d.img) : d.img;
    const piv = this.grabbed ? this.ericShoulder() : { x: d.x, y: d.top };
    const sway = this.lift > 0.05 ? Math.sin(this.t * 3.2) * 0.05 * this.lift : 0;
    c.save();
    c.translate(piv.x, piv.y); c.rotate(sway); c.translate(-piv.x, -piv.y);
    c.drawImage(img, d.x - d.w / 2, d.top, d.w, d.h);
    c.restore();
  }
  drawFlyingEric(c) {
    const k = this.fly.k, d = this.fly.from;
    const p0 = { x: d.x, y: d.top + d.h / 2 }, p1 = { x: 640, y: -220 }, p2 = { x: -380, y: 1500 };
    const x = (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * p1.x + k * k * p2.x;
    const y = (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * p1.y + k * k * p2.y;
    const s = lerp(1, 2.7, Ease.inQuad(k));
    c.save(); c.translate(x, y); c.rotate(-k * Math.PI * 3.4); c.scale(s, s);
    c.drawImage(d.img, -d.w / 2, -d.h / 2, d.w, d.h);
    c.restore();
    if (Math.random() < 0.6) Particles.spawn('dot', x, y, 2, { color: 'rgba(255,240,200,0.6)', speed: 60, size: 5, g: 0, life: 0.4 });
  }
  wolfDims() {
    // painted-out arm variants so a swung arm never leaves a third one behind
    const key = this.grabbed ? 'wolf_noL' : (this.toast > 0 || this.ericGone) ? 'wolf_noR' : 'wolf';
    const img = G.img[key] || G.img.wolf, Wd = TAV.WOLF, s = this.wolfScale(), w = img.width * s;
    let top = Wd.top;
    if (this.laughing) top += Math.abs(Math.sin(this.t * 11)) * 10;
    return { img, w, h: Wd.h, s, x: Wd.x, top };
  }
  wolfShoulder(side) {
    const d = this.wolfDims(), A = TAV.ARMS[side === 'L' ? 'wolf_armL' : 'wolf_armR'];
    return { x: d.x + (A.bx - G.img.wolf.width / 2) * d.s, y: d.top + A.by * d.s };
  }
  drawWolf(c) {
    const d = this.wolfDims();
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35;
    c.drawImage(glowSprite('rgba(255,120,40,0.8)'), d.x - d.w, d.top - 120, d.w * 2, d.h * 0.9); c.restore();
    c.save(); c.filter = 'brightness(0.95) sepia(0.12) contrast(1.05)';   // pull him into the firelight
    c.drawImage(d.img, d.x - d.w / 2, d.top, d.w, d.h); c.restore();
  }
  hornHand() {
    const s = this.wolfShoulder('R'), L = this.armLen('wolf_armR', this.wolfScale()), k = this.toast;
    const a = lerp(1.75, -1.15, k) + (this.laughing ? Math.sin(this.t * 6) * 0.06 : 0);
    return { x: s.x + Math.cos(a) * L, y: s.y + Math.sin(a) * L };
  }
  hornTop() { const h = this.hornHand(); return { x: h.x - 40, y: h.y - 250 }; }
  drawHorn(c, x, y, s) {
    // a big drinking horn held upright, mouth at the top, foaming over
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-0.18);
    const g = c.createLinearGradient(-50, 0, 50, 0);
    g.addColorStop(0, '#4a3a26'); g.addColorStop(0.45, '#e6d4a8'); g.addColorStop(1, '#5a4430');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-10, 90); c.quadraticCurveTo(-70, 40, -48, -200);
    c.lineTo(48, -210); c.quadraticCurveTo(20, -40, 14, 90); c.closePath(); c.fill();
    c.fillStyle = 'rgba(40,24,10,0.35)'; for (let i = 0; i < 3; i++) c.fillRect(-46 + i * 2, -150 + i * 70, 80 - i * 18, 5);
    const m = c.createLinearGradient(-50, 0, 50, 0); m.addColorStop(0, '#6a6a64'); m.addColorStop(0.4, '#eeeee6'); m.addColorStop(1, '#5a5a54');
    c.fillStyle = m; c.beginPath(); c.ellipse(0, -205, 50, 13, -0.05, 0, TAU); c.fill();
    c.fillStyle = '#d89a2a'; c.beginPath(); c.ellipse(0, -205, 42, 9, -0.05, 0, TAU); c.fill();
    c.fillStyle = '#fff3d2'; c.beginPath(); c.arc(-22, -212, 16, 0, TAU); c.arc(2, -218, 19, 0, TAU); c.arc(26, -210, 14, 0, TAU); c.fill();
    c.restore();
  }

  // --------------------------------------------- table
  drawTable(c) {
    const B = TAV.TABLE_BACK, F2 = TAV.TABLE_FRONT, x0 = -700, x1 = 2620;
    // top surface
    c.save();
    c.beginPath(); c.rect(x0, B, x1 - x0, F2 - B); c.clip();
    for (let x = x0; x < x1; x += 1024) c.drawImage(this.wood, 0, 0, 1024, 512, x, B, 1024, F2 - B);
    const g = c.createLinearGradient(0, B, 0, F2);
    g.addColorStop(0, 'rgba(10,4,0,0.55)'); g.addColorStop(0.4, 'rgba(10,4,0,0.1)'); g.addColorStop(1, 'rgba(255,190,120,0.08)');
    c.fillStyle = g; c.fillRect(x0, B, x1 - x0, F2 - B);
    c.restore();
    // front edge + face
    c.fillStyle = '#c08a58'; c.fillRect(x0, F2 - 4, x1 - x0, 6);
    const fg = c.createLinearGradient(0, F2, 0, F2 + 500);
    fg.addColorStop(0, '#4a2a14'); fg.addColorStop(0.15, '#2e1a0c'); fg.addColorStop(1, '#0c0603');
    c.fillStyle = fg; c.fillRect(x0, F2 + 2, x1 - x0, 700);
    c.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = x0 + 300; x < x1; x += 420) c.fillRect(x, F2 + 2, 4, 700);
  }
  drawTableItems(c) {
    const B = TAV.TABLE_BACK;
    this.drawPlate(c, 300, 770, 1); this.drawTankard(c, 470, 760, 1);
    this.drawTankard(c, 150, 820, 1.1); this.drawCandle(c, 1180, 730);
    this.drawPlate(c, 1560, 780, 1.05); this.drawTankard(c, 1360, 790, 1.05);
    this.drawTankard(c, 1800, 745, 0.95); this.drawTankard(c, 2050, 820, 1.1);
    this.drawBowl(c, TAV.BOWL.x, TAV.BOWL.y, 1, this.t);
  }
  drawTankard(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(4, 2, 42, 10, 0, 0, TAU); c.fill();
    // handle
    c.strokeStyle = '#3c2412'; c.lineWidth = 9; c.beginPath(); c.arc(34, -48, 22, -1.3, 1.3); c.stroke();
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, '#3a2210'); g.addColorStop(0.35, '#8a5a30'); g.addColorStop(0.6, '#6a4222'); g.addColorStop(1, '#2a1608');
    c.fillStyle = g; c.fillRect(-30, -88, 60, 88);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = -18; i < 30; i += 12) c.fillRect(i, -88, 2, 88);
    const mg = c.createLinearGradient(-30, 0, 30, 0); mg.addColorStop(0, '#4a4a4a'); mg.addColorStop(0.4, '#d8d8d0'); mg.addColorStop(1, '#3a3a3a');
    c.fillStyle = mg; c.fillRect(-31, -76, 62, 7); c.fillRect(-31, -18, 62, 7);
    c.fillStyle = '#f4ead0'; c.beginPath(); c.ellipse(0, -88, 31, 9, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(-14, -94, 9, 0, TAU); c.arc(4, -97, 11, 0, TAU); c.arc(19, -92, 8, 0, TAU); c.fill();
    c.restore();
  }
  drawPlate(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(4, 6, 92, 22, 0, 0, TAU); c.fill();
    const g = c.createRadialGradient(-20, -6, 4, 0, 0, 92); g.addColorStop(0, '#bdbab0'); g.addColorStop(1, '#55534c');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 90, 22, 0, 0, TAU); c.fill();
    // bread loaf + fish
    const b = c.createLinearGradient(0, -40, 0, 0); b.addColorStop(0, '#e0a050'); b.addColorStop(1, '#7a4416');
    c.fillStyle = b; c.beginPath(); c.ellipse(-28, -14, 40, 22, -0.1, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,230,180,0.5)'; c.lineWidth = 3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-40 + i * 16, -28); c.lineTo(-30 + i * 16, -6); c.stroke(); }
    const f = c.createLinearGradient(0, -20, 0, 6); f.addColorStop(0, '#c9a46a'); f.addColorStop(1, '#6a4a22');
    c.fillStyle = f; c.beginPath(); c.ellipse(36, -6, 36, 11, 0.08, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(68, -6); c.lineTo(86, -18); c.lineTo(86, 6); c.closePath(); c.fill();
    c.restore();
  }
  drawCandle(c, x, y) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, 2, 26, 7, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#b8a07a'); g.addColorStop(0.5, '#f4e6c4'); g.addColorStop(1, '#a08a64');
    c.fillStyle = g; c.fillRect(-12, -70, 24, 70);
    const fl = 1 + Math.sin(this.t * 17) * 0.08;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite('rgba(255,170,60,0.9)'), -70, -150, 140, 140);
    c.fillStyle = '#ffd890'; c.beginPath(); c.ellipse(0, -84, 6, 14 * fl, 0, 0, TAU); c.fill(); c.restore();
    c.restore();
  }
  drawBowl(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(6, 8, 104, 24, 0, 0, TAU); c.fill();
    // apples sit in the bowl
    this.drawApple(c, -44, -36, 34, false); this.drawApple(c, 42, -34, 33, false);
    this.drawApple(c, 2, -58, 40, true);
    const g = c.createLinearGradient(-100, 0, 100, 0);
    g.addColorStop(0, '#3a1e0c'); g.addColorStop(0.4, '#8a5428'); g.addColorStop(0.7, '#6a3c1a'); g.addColorStop(1, '#2a1406');
    c.fillStyle = g; c.beginPath(); c.moveTo(-100, -26); c.bezierCurveTo(-96, 30, 96, 30, 100, -26); c.closePath(); c.fill();
    c.strokeStyle = '#c08a52'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, -26, 100, 14, 0, 0, Math.PI); c.stroke();
    c.restore();
  }
  drawApple(c, x, y, r, hero) {
    c.save(); c.translate(x, y);
    if (hero) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.12 * Math.sin(this.t * 3); c.drawImage(glowSprite('rgba(255,90,60,0.9)'), -r * 2.6, -r * 2.6, r * 5.2, r * 5.2); c.restore(); }
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
    g.addColorStop(0, '#ff6a52'); g.addColorStop(0.45, '#d21c16'); g.addColorStop(0.85, '#7a0a08'); g.addColorStop(1, '#3a0404');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -r * 0.72);
    c.bezierCurveTo(r * 0.5, -r * 1.12, r * 1.15, -r * 0.7, r * 1.02, r * 0.05);
    c.bezierCurveTo(r * 0.95, r * 0.75, r * 0.45, r * 1.05, 0, r * 0.9);
    c.bezierCurveTo(-r * 0.45, r * 1.05, -r * 0.95, r * 0.75, -r * 1.02, r * 0.05);
    c.bezierCurveTo(-r * 1.15, -r * 0.7, -r * 0.5, -r * 1.12, 0, -r * 0.72);
    c.fill();
    c.fillStyle = 'rgba(255,230,120,0.18)'; c.beginPath(); c.ellipse(r * 0.35, r * 0.35, r * 0.4, r * 0.3, -0.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-r * 0.42, -r * 0.38, r * 0.16, r * 0.09, -0.6, 0, TAU); c.fill();
    c.strokeStyle = '#4a2a10'; c.lineWidth = Math.max(2, r * 0.09); c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -r * 0.7); c.quadraticCurveTo(r * 0.05, -r * 1.05, r * 0.2, -r * 1.2); c.stroke();
    c.fillStyle = '#4f8a2a'; c.beginPath(); c.ellipse(r * 0.45, -r * 1.08, r * 0.32, r * 0.13, -0.4, 0, TAU); c.fill();
    c.restore();
  }

  // --------------------------------------------- close-up insert
  drawInsert(c) {
    const I = this.ins, t = this.t;
    const push = 1 + 0.05 * I.push + 0.01 * Math.sin(t * 0.8);
    c.save();
    c.translate(W / 2, H / 2); c.scale(push, push); c.translate(-W / 2, -H / 2);
    // blurred tavern far behind
    c.drawImage(this.bg, 350, 120, 700, 391, -200, -300, 2320, 1300);
    c.fillStyle = 'rgba(8,4,2,0.45)'; c.fillRect(-200, -300, 2320, 1500);
    // table surface fills the lower frame
    const top = 420;
    for (let x = -200; x < W + 200; x += 1400) c.drawImage(this.wood, 0, 0, 1024, 512, x, top, 1400, 760);
    const g = c.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(8,3,0,0.8)'); g.addColorStop(0.35, 'rgba(8,3,0,0.15)'); g.addColorStop(1, 'rgba(255,170,90,0.06)');
    c.fillStyle = g; c.fillRect(-200, top, W + 400, H);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.05 * Math.sin(t * 13);
    c.drawImage(glowSprite('rgba(255,150,60,0.9)'), 300, 200, 1300, 900); c.restore();
    // bowl + apple, big
    this.drawBowl(c, 1080, 770, 2.6);
    // Eric's arm slides in from the lower left, hand to the apple
    const es = 2.7, eDir = norm(1, -0.62), eL = this.armLen('eric_armR', es);
    let hx = lerp(-160, 930, I.reach), hy = lerp(1180, 640, I.reach);
    if (I.struggle) { hx += Math.sin(t * 38) * 5; hy += Math.cos(t * 31) * 4; }
    const ep = { x: hx - eDir.x * eL, y: hy - eDir.y * eL };
    this.drawArm(c, 'eric_armR', ep, { x: hx, y: hy }, es);
    // the giant hand slams down from the upper right onto Eric's wrist
    if (I.grab > 0) {
      const ws = 1.75, wDir = norm(-0.55, 0.84), wL = this.armLen('wolf_armL', ws);
      const wx = hx - eDir.x * 95, wy = hy - eDir.y * 95;
      const fx = lerp(wx + 900, wx, I.grab), fy = lerp(wy - 1200, wy, I.grab);
      this.drawArm(c, 'wolf_armL', { x: fx - wDir.x * wL, y: fy - wDir.y * wL }, { x: fx, y: fy }, ws);
      if (I.push && !I.struggle) this.speedLines(c, wx, wy, 1);
    }
    c.restore();
    // letterbox for the close-up
    c.fillStyle = '#000'; c.fillRect(0, 0, W, 70); c.fillRect(0, H - 70, W, 70);
  }
  speedLines(c, x, y, a) {
    c.save(); c.globalAlpha = 0.5 * a; c.strokeStyle = '#fff'; c.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const an = (i / 26) * TAU + 0.1, r0 = 300 + (i % 3) * 40, r1 = 1000;
      c.beginPath(); c.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); c.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); c.stroke();
    }
    c.restore();
  }

  // --------------------------------------------- name card
  drawCard(c) {
    const a = this.card, tag = G.img.wolf_tag, x = 70 - (1 - a) * 80, y = 90;
    c.save(); c.globalAlpha = a;
    panel(c, x, y, 640, 250, { top: 'rgba(24,22,20,0.95)', bottom: 'rgba(8,8,8,0.97)' });
    if (tag) { const h = 210, w = tag.width * h / tag.height; c.drawImage(tag, x + 20, y + 20, w, h); }
    txt(c, 'WOLFZTNEL', x + 245, y + 115, { size: 58, fam: F.title, weight: 900, color: '#f0e6d2', shadowColor: 'rgba(255,120,40,0.5)', shadowBlur: 20 });
    txt(c, 'Keeper of the Apples', x + 248, y + 170, { size: 30, fam: F.head, weight: 700, color: C.gold, letter: 2 });
    c.restore();
  }
}
function norm(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }
