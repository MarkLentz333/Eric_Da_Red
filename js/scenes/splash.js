'use strict';
// ============================================================================
//  SPLASH — "Eric Da Red - A WolfZtnel Game" studio card shown on boot
// ============================================================================
class SplashScene {
  enter() {
    this.t = 0; this.leaving = false;
    this.DUR = 5.2;
  }
  update(dt, rdt) {
    this.t += rdt;
    if (Math.random() < rdt * 40) Particles.ambient('snow', { x: -100, y: -40, w: W + 200, h: 10 }, { vy: rand(50, 120), vx: rand(-30, 10), color: 'rgba(235,240,250,0.8)', size: 3.5, sizeMin: 1, life: rand(9, 14), layer: 'back' });
    if (this.leaving) return;
    if ((this.t > 0.8 && (G.mouse.clicked || G.anyPressed)) || this.t > this.DUR) {
      G.mouse.clicked = false; consumeInput();
      this.leaving = true; goto(new TitleScene(), 0.9);
    }
  }
  draw(c) {
    const t = this.t;
    // cold dark backdrop with a faint warm glow behind him
    const g = c.createRadialGradient(W / 2, 620, 80, W / 2, 620, 1100);
    g.addColorStop(0, '#2a2622'); g.addColorStop(0.55, '#121112'); g.addColorStop(1, '#050506');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    Particles.draw(c, 'back');

    // --- WolfZtnel, facing forward
    const k = Ease.outCubic(clamp((t - 0.9) / 1.4, 0, 1));
    const body = G.img.wolf, full = G.img.wolf;
    if (body && full) {
      const h = 800, s = h / full.height, w = body.width * s, cx = W / 2, top = 500 + (1 - k) * 40;
      c.save(); c.globalAlpha = k;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28 * k;
      c.drawImage(glowSprite('rgba(255,140,60,0.8)'), cx - 620, top - 120, 1240, 900); c.restore();
      c.drawImage(body, cx - w / 2, top, w, h);
      c.restore();
      // fade his legs into the dark
      const fg = c.createLinearGradient(0, 900, 0, H);
      fg.addColorStop(0, 'rgba(5,5,6,0)'); fg.addColorStop(1, 'rgba(5,5,6,1)');
      c.fillStyle = fg; c.fillRect(0, 900, W, H - 900);
    }

    // --- the tag, large, above him
    const tag = G.img.wolf_tag;
    if (tag) {
      const kt = clamp(t / 0.9, 0, 1), sc = lerp(1.12, 1, Ease.outCubic(kt));
      const th = 270, tw = tag.width * th / tag.height;
      c.save(); c.globalAlpha = kt;
      c.translate(W / 2, 24 + th / 2); c.scale(sc, sc);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 * kt;
      c.drawImage(glowSprite('rgba(255,200,140,0.8)'), -tw, -th, tw * 2, th * 2); c.restore();
      c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 40;
      c.drawImage(tag, -tw / 2, -th / 2, tw, th);
      c.restore();
    }
    // --- the wording beneath the tag
    const kx = clamp((t - 0.5) / 0.8, 0, 1);
    txt(c, 'Eric Da Red - A WolfZtnel Game', W / 2, 362, { size: 56, fam: F.title, weight: 900, align: 'center', color: '#f3e6cc', letter: 2, shadowColor: 'rgba(255,90,30,0.55)', shadowBlur: 26, alpha: kx });
    c.save(); c.globalAlpha = kx; c.fillStyle = C.gold;
    const lw = 520 * Ease.outCubic(kx); c.fillRect(W / 2 - lw, 388, lw * 2, 2); c.restore();

    vignette(c, 0.7);
    if (t > 1.6 && !window.AUTOPLAY) txt(c, 'Click or press any key', W / 2, H - 34, { size: 22, align: 'center', color: 'rgba(255,255,255,' + 0.4 * clamp(t - 1.6, 0, 1) + ')' });
  }
}
