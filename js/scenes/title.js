'use strict';
// ============================================================================
//  TITLE SCENE — intro video, logo, main menu
// ============================================================================
class TitleScene {
  enter() {
    this.t = 0; this.menuT = 0;
    this.state = AudioSys.unlocked ? 'menu' : 'press';
    this.panel = null; // 'options' | 'credits'
    this.video = document.getElementById('introVideo');
    this.video.muted = true; this.video.loop = true;
    try { this.video.currentTime = 0; } catch (e) {}
    this.video.play().catch(() => {});
    this.sel = 0;
    if (this.state === 'menu') AudioSys.playMusic('intro');
  }
  exit() { try { this.video.pause(); } catch (e) {} }
  startMenu() {
    this.state = 'menu'; this.menuT = 0;
    this.video.play().catch(() => {});
    AudioSys.playMusic('intro');
    AudioSys.sfx('slam'); shake(12); screenFlash('#ff6a2a', 0.25);
  }
  items() {
    const list = [{ id: 'new', label: Game.hasSave() ? 'New Saga' : 'Begin the Saga' }];
    if (Game.hasSave()) list.unshift({ id: 'cont', label: 'Continue' });
    list.push({ id: 'opt', label: 'Options' }, { id: 'cred', label: 'Credits' });
    return list;
  }
  act(id) {
    if (id === 'new') Game.newGame();
    if (id === 'cont') Game.continueGame();
    if (id === 'opt') this.panel = 'options';
    if (id === 'cred') this.panel = 'credits';
  }
  update(dt, rdt) {
    this.t += rdt; this.menuT += rdt;
    if (Math.random() < rdt * 10) Particles.ambient('glow', { x: 0, y: H - 20, w: W * 0.6, h: 20 }, { vy: rand(-120, -50), vx: rand(0, 40), color: 'rgba(255,140,50,0.9)', size: 4, sizeMin: 1, life: rand(3, 6), layer: 'front' });
    if (this.state === 'press') {
      if (G.anyPressed || G.mouse.clicked) { G.mouse.clicked = false; consumeInput(); this.startMenu(); }
      return;
    }
    if (this.panel) { if (cancelHit()) this.panel = null; return; }
    const L = this.items();
    if (keyHit('ArrowDown', 'KeyS')) { this.sel = (this.sel + 1) % L.length; AudioSys.sfx('hover'); }
    if (keyHit('ArrowUp', 'KeyW')) { this.sel = (this.sel + L.length - 1) % L.length; AudioSys.sfx('hover'); }
    if (confirmHit()) { AudioSys.sfx('click'); this.act(L[this.sel].id); }
  }
  drawLogo(c, x, y, a, scale = 1) {
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(scale, scale);
    const glow = 0.6 + 0.25 * Math.sin(this.t * 2);
    // ERIC
    c.font = font(190, F.title, 900); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.shadowColor = `rgba(255,70,20,${glow})`; c.shadowBlur = 50;
    const g = c.createLinearGradient(0, -170, 0, 10);
    g.addColorStop(0, '#fff2cf'); g.addColorStop(0.45, '#f0c46a'); g.addColorStop(1, '#a8621e');
    c.lineWidth = 10; c.strokeStyle = '#1a0a04'; c.lineJoin = 'round';
    c.strokeText('ERIC', 0, 0); c.fillStyle = g; c.fillText('ERIC', 0, 0);
    // DA RED
    c.font = font(150, F.title, 900);
    const g2 = c.createLinearGradient(0, 30, 0, 180);
    g2.addColorStop(0, '#ff7a3a'); g2.addColorStop(0.5, '#d42a12'); g2.addColorStop(1, '#6a0a02');
    c.shadowColor = `rgba(255,30,0,${glow})`;
    c.strokeText('DA RED', 6, 160); c.fillStyle = g2; c.fillText('DA RED', 6, 160);
    c.shadowColor = 'transparent';
    c.fillStyle = C.gold; c.fillRect(10, 200, 640, 2);
    txt(c, 'A SAGA OF AXES & INVOICES', 12, 246, { size: 34, fam: F.head, weight: 700, color: '#f3e3c0', letter: 6 });
    c.restore();
  }
  draw(c) {
    const v = this.video;
    const ready = v && v.readyState >= 2;
    const z = 1.04 + Math.sin(this.t * 0.1) * 0.02;
    if (ready) drawCover(c, v, G.cam.sx * 0.5 + 120, G.cam.sy * 0.5, z);
    else drawCover(c, G.img.bg_night, 0, 0, z);
    // grade
    const lg = c.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(6,4,3,0.92)'); lg.addColorStop(0.42, 'rgba(6,4,3,0.55)'); lg.addColorStop(0.7, 'rgba(6,4,3,0.05)'); lg.addColorStop(1, 'rgba(6,4,3,0.25)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    vignette(c, 0.7);
    Particles.draw(c, 'front');

    if (this.state === 'press') {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, W, H);
      this.drawLogo(c, 110, 380, Math.min(1, this.t * 0.8));
      const a = 0.5 + 0.5 * Math.sin(this.t * 3);
      txt(c, 'Click or press any key', 120, 780, { size: 36, fam: F.head, weight: 700, color: `rgba(255,236,200,${0.35 + a * 0.6})`, letter: 4 });
      txt(c, 'Best with sound on  •  F for fullscreen', 120, 830, { size: 22, color: 'rgba(255,236,200,0.45)' });
      return;
    }
    const k = Ease.outCubic(Math.min(1, this.menuT * 1.5));
    this.drawLogo(c, 110 - (1 - k) * 80, 300, k);
    const L = this.items();
    L.forEach((it, i) => {
      const bx = 120 - (1 - Ease.outCubic(clamp(this.menuT * 2 - i * 0.15, 0, 1))) * 400, by = 640 + i * 82;
      if (inRect(G.mouse, bx, by, 440, 66) && !this.panel) this.sel = i;
      if (button(c, 'tm' + i, bx, by, 440, 66, it.label, { selected: this.sel === i && !this.panel, size: 32, disabled: !!this.panel })) this.act(it.id);
    });
    txt(c, 'v1.0  •  Arrows/Enter or mouse', W - 30, H - 26, { size: 20, align: 'right', color: 'rgba(255,255,255,0.35)' });
    if (this.panel === 'options') this.drawOptions(c);
    if (this.panel === 'credits') this.drawCredits(c);
  }
  drawOptions(c) {
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, W, H);
    const w = 640, h = 470, x = (W - w) / 2, y = (H - h) / 2;
    panel(c, x, y, w, h);
    txt(c, 'OPTIONS', W / 2, y + 66, { size: 42, fam: F.head, weight: 900, align: 'center', color: C.gold });
    const ms = Math.round(AudioSys.settings.music * 10), ss = Math.round(AudioSys.settings.sfx * 10);
    if (button(c, 'o_m', x + 70, y + 110, w - 140, 62, `Music  ${'■'.repeat(ms)}${'□'.repeat(10 - ms)}`, { size: 26 })) AudioSys.setVolume('music', ms >= 10 ? 0 : (ms + 2) / 10);
    if (button(c, 'o_s', x + 70, y + 190, w - 140, 62, `Effects  ${'■'.repeat(ss)}${'□'.repeat(10 - ss)}`, { size: 26 })) { AudioSys.setVolume('sfx', ss >= 10 ? 0 : (ss + 2) / 10); AudioSys.sfx('chop'); }
    if (button(c, 'o_f', x + 70, y + 270, w - 140, 62, 'Toggle Fullscreen  (F)', { size: 26 })) toggleFullscreen();
    if (button(c, 'o_b', x + w / 2 - 120, y + h - 90, 240, 60, 'Back')) this.panel = null;
  }
  drawCredits(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
    const w = 900, h = 620, x = (W - w) / 2, y = (H - h) / 2;
    panel(c, x, y, w, h);
    txt(c, 'CREDITS', W / 2, y + 66, { size: 42, fam: F.head, weight: 900, align: 'center', color: C.gold });
    const lines = [
      ['Starring', 'Eric Da Red, Quartermaster of Fjordheim'],
      ['Character, props & scenery', 'Original 3D renders & concept art from the project folders'],
      ['Game design & code', 'Built with Claude Code'],
      ['Music', AudioSys.tracks.intro || AudioSys.tracks.background ? 'Your soundtrack from the Music folder' : 'Add songs to the Music folder'],
      ['Sound effects', 'Synthesized live in your browser'],
      ['Special thanks', 'Every crate that ever arrived damaged'],
    ];
    lines.forEach(([a, b], i) => {
      txt(c, a.toUpperCase(), W / 2, y + 140 + i * 70, { size: 22, fam: F.head, weight: 700, align: 'center', color: C.gold, letter: 3 });
      txt(c, b, W / 2, y + 172 + i * 70, { size: 28, align: 'center' });
    });
    if (button(c, 'c_b', x + w / 2 - 120, y + h - 80, 240, 58, 'Back')) this.panel = null;
  }
}
