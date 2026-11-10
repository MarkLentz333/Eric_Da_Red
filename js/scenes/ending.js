'use strict';
// ============================================================================
//  ENDING — the feast in the Great Hall, then on to the tavern (tavern.js)
// ============================================================================
class EndingScene {
  enter() {
    this.t = 0; this.phase = 'feast'; this.rollT = 0;
    AudioSys.playMusic('intro');
    if (!G.img._stamp_del) G.img._stamp_del = Art.makeStamp('DELIVERED ON TIME', '#c4271b', 900, 200);
    this.play();
  }
  async play() {
    await wait(0.8);
    await Cutscene.play('ending');
    await wait(0.4);
    await Dialog.play('ending');
    await goto(new TavernScene(), 1.4);
  }
  update(dt, rdt) {
    this.t += rdt;
    if (this.phase === 'roll') this.rollT += rdt;
    if (Math.random() < rdt * 16) Particles.ambient('glow', { x: 0, y: H, w: W, h: 10 }, { vy: rand(-120, -40), vx: rand(-20, 20), color: pick(['rgba(255,170,70,0.9)', 'rgba(255,220,120,0.9)']), size: 4, sizeMin: 1, life: rand(4, 7) });
    if (this.phase === 'roll' && this.rollT > 2 && confirmHit() && G.scene === this) goto(new TitleScene());
  }
  draw(c) {
    drawCover(c, G.img.bg_hall || G.img.bg_docks, Math.sin(this.t * 0.08) * 16, 0, 1.06);
    c.fillStyle = 'rgba(30,12,4,0.15)'; c.fillRect(0, 0, W, H);
    const gg = c.createLinearGradient(0, 600, 0, H); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = gg; c.fillRect(0, 600, W, H - 600);
    Particles.draw(c, 'back');
    // Eric, triumphant, front view with props
    const img = G.img.eric_front, h = 700, s = h / img.height, x = this.phase === 'roll' ? 1380 : W / 2, y = 1035;
    const drawProp = (im, px, h) => { if (!im) return; const w = im.width * h / im.height; c.save(); c.globalAlpha = 0.45; c.fillStyle = '#000'; c.beginPath(); c.ellipse(px, y + 4, w * 0.45, 16, 0, 0, TAU); c.fill(); c.restore(); c.drawImage(im, px - w / 2, y - h + 6, w, h); };
    drawProp(G.img.en_crate, x - 330, 190); drawProp(G.img.en_barrel, x - 200, 160); drawProp(G.img.en_cart, x + 300, 170);
    c.save(); c.globalAlpha = 0.5; c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, y + 4, 170, 26, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.08 * Math.sin(this.t * 7);
    c.drawImage(glowSprite('rgba(255,140,50,0.8)'), x - 330, y - h - 60, 660, h + 120); c.restore();
    c.drawImage(img, x - img.width * s / 2, y - h, img.width * s, h);
    Particles.draw(c, 'front');
    vignette(c, 0.6);
    if (this.phase === 'roll') this.drawRoll(c);
  }
  drawRoll(c) {
    const t = this.rollT, P = Game.player, T = P.tally;
    const st = G.img._stamp_del, k = Math.min(1, t / 0.2), sc = lerp(2.4, 1, Ease.inQuad(k));
    c.save(); c.translate(560, 200); c.rotate(-0.07); c.scale(sc * 0.85, sc * 0.85); c.globalAlpha = k; c.drawImage(st, -st.width / 2, -st.height / 2); c.restore();
    const a = clamp((t - 0.6) * 2, 0, 1);
    c.save(); c.globalAlpha = a;
    panel(c, 120, 340, 880, 600);
    txt(c, "QUARTERMASTER'S LEDGER", 560, 410, { size: 38, fam: F.head, weight: 900, align: 'center', color: C.gold, letter: 2 });
    const rows = [
      ['Final level', 'Lv ' + P.level],
      ['Problems chopped', T.chopped],
      ['Problems filed', T.filed],
      ['Red Furies unleashed', T.furies],
      ['Hits blocked', T.blocks],
      ['Perfect timings', T.perfect],
      ['Cod eaten by Olaf', 2],
      ['Apples eaten by Eric', 0],
    ];
    rows.forEach(([l, v], i) => {
      const yy = 480 + i * 56;
      txt(c, l, 180, yy, { size: 30 });
      txt(c, String(v), 940, yy, { size: 32, fam: F.head, weight: 900, align: 'right', color: '#ffe2b0' });
      c.fillStyle = 'rgba(216,180,106,0.15)'; c.fillRect(180, yy + 16, 760, 1);
    });
    c.restore();
    if (t > 2) {
      txt(c, 'THE END', 560, 1000, { size: 64, fam: F.title, weight: 900, align: 'center', color: '#fff0d6', shadowColor: 'rgba(255,80,30,0.7)', shadowBlur: 30, alpha: clamp((t - 2) * 2, 0, 1) });
      txt(c, 'Press Enter to return to the title', 560, 1050, { size: 22, align: 'center', color: C.textDim, alpha: clamp((t - 2.5) * 2, 0, 1) });
    }
  }
}
