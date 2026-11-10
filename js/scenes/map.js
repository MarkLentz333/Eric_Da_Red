'use strict';
// ============================================================================
//  SHARED HUD — Eric's status (portrait, HP, Focus, Madness)
// ============================================================================
function drawPortraitMedallion(c, x, y, r, mood) {
  const P = Game.player;
  const m = mood || (P.madness >= 100 ? 'fury' : P.madness >= 70 ? 'shout' : 'calm');
  const img = G.img['p_' + m];
  c.save();
  const hot = P.madness >= 70;
  c.shadowColor = hot ? `rgba(255,50,20,${0.6 + Math.sin(G.rt * 6) * 0.3})` : 'rgba(0,0,0,0.7)';
  c.shadowBlur = hot ? 30 : 16;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#000'; c.fill();
  c.shadowColor = 'transparent';
  c.save(); c.beginPath(); c.arc(x, y, r - 3, 0, TAU); c.clip();
  if (img) { const s = (r * 2.5) / img.width; c.drawImage(img, x - img.width * s / 2, y - img.height * s * 0.42, img.width * s, img.height * s); }
  c.restore();
  const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#f6dc9a'); g.addColorStop(0.5, '#a57a35'); g.addColorStop(1, '#f0cf84');
  c.lineWidth = 5; c.strokeStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  c.restore();
}

function drawMadnessMeter(c, x, y, w, h) {
  const P = Game.player, v = P.madness, f = v / 100;
  c.save();
  const hot = v >= 70, full = v >= 100;
  if (hot) { c.shadowColor = `rgba(255,40,10,${0.5 + 0.4 * Math.sin(G.rt * (full ? 10 : 5))})`; c.shadowBlur = full ? 30 : 18; }
  rr(c, x, y, w, h, 6); c.fillStyle = 'rgba(10,4,4,0.85)'; c.fill(); c.shadowColor = 'transparent';
  c.lineWidth = 1.5; c.strokeStyle = full ? '#ffb070' : 'rgba(216,180,106,0.6)'; c.stroke();
  c.save(); rr(c, x + 2, y + 2, w - 4, h - 4, 4); c.clip();
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#d98a2a'); g.addColorStop(0.55, '#d0442a'); g.addColorStop(0.75, '#b01828'); g.addColorStop(1, '#ff2a10');
  let gh = _barGhost['mad'] ?? f; gh += (f - gh) * Math.min(1, G.rt * 0 + 0.08); _barGhost['mad'] = gh;
  c.fillStyle = g; c.fillRect(x + 2, y + 2, (w - 4) * gh, h - 4);
  // flicker flames along the top
  if (gh > 0.02) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const fx = x + 2 + (w - 4) * gh * (i / 18 + 0.02), fl = (Math.sin(G.rt * 9 + i * 1.7) * 0.5 + 0.5);
      c.fillStyle = `rgba(255,${120 + fl * 80},40,${0.12 + fl * 0.12})`; c.fillRect(fx, y + 2, (w - 4) / 18, h * 0.45);
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 2, y + 2, (w - 4) * gh, (h - 4) * 0.4);
  c.restore();
  // ticks + threshold
  c.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 1; i < 10; i++) c.fillRect(x + w * i / 10, y + 3, 1.5, h - 6);
  c.fillStyle = '#ffcf7a'; c.fillRect(x + w * 0.7 - 1, y - 3, 2.5, h + 6);
  const label = full ? 'RED FURY READY' : hot ? 'SEEING RED' : 'MADNESS';
  txt(c, label, x + 12, y + h / 2 + 1, { size: h * 0.6, fam: F.head, weight: 900, base: 'middle', color: full ? '#fff2c0' : '#fff', letter: 1 });
  txt(c, Math.round(v) + '', x + w - 10, y + h / 2 + 1, { size: h * 0.62, weight: 700, base: 'middle', align: 'right', color: '#fff' });
  c.restore();
}

function drawStatus(c, x, y, o = {}) {
  const P = Game.player, st = statsFor(P.level);
  const w = o.w || 620, h = o.h || 196;
  panel(c, x, y, w, h);
  drawPortraitMedallion(c, x + 92, y + h / 2, 70);
  const bx = x + 182, bw = w - 206;
  txt(c, 'ERIC DA RED', bx, y + 42, { size: 30, fam: F.head, weight: 900, color: '#ffe2b0', letter: 1 });
  txt(c, 'Lv ' + P.level, bx + bw, y + 42, { size: 26, fam: F.head, weight: 700, align: 'right', color: C.gold });
  bar(c, 'hp', bx, y + 58, bw, 32, P.hp, st.maxHp, '#e0553f', '#8c1c12', { label: 'HP', value: `${Math.ceil(P.hp)} / ${st.maxHp}`, size: 20 });
  bar(c, 'focus', bx, y + 98, bw, 26, P.focus, st.maxFocus, '#5aa8f0', '#1f4f96', { label: 'FOCUS', value: `${Math.ceil(P.focus)} / ${st.maxFocus}`, size: 17 });
  drawMadnessMeter(c, bx, y + 134, bw, 32);
  if (o.xp) {
    const need = xpToNext(P.level);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(bx, y + 176, bw, 6);
    c.fillStyle = C.gold; c.fillRect(bx, y + 176, bw * (P.level >= MAX_LEVEL ? 1 : P.xp / need), 6);
  }
}

// ============================================================================
//  MAP SCENE
// ============================================================================
class MapScene {
  enter() {
    this.t = 0;
    const at = NODE[Game.save.at] || NODE.home;
    this.token = { x: at.x, y: at.y - at.h - 46, moving: false };
    this.hover = null; this.pack = false; this.menu = false;
    this.clouds = [];
    if (!G.img._cloud) G.img._cloud = Art.makeCloud(700, 300, '220,225,235');
    for (let i = 0; i < 7; i++) this.clouds.push({ x: rand(-300, W), y: rand(0, H), s: rand(0.8, 1.8), v: rand(8, 20), a: rand(0.18, 0.35) });
    AudioSys.playMusic('background');
    if (!this._stamp) this._stamp = Art.makeStamp('APPROVED', '#c4271b', 420, 120);
  }
  cleared(id) { return !!Game.save.cleared[id]; }
  unlocked(n) { return n.id === 'home' || NODES.some(m => this.cleared(m.id) && m.links.includes(n.id)); }
  canVisit(n) {
    if (!this.unlocked(n) || Game.busy || this.token.moving) return false;
    if (!this.cleared(n.id)) return true;
    return n.type === 'rest';
  }
  neighbors(id) {
    const out = new Set(NODE[id].links);
    for (const n of NODES) if (n.links.includes(id)) out.add(n.id);
    return [...out];
  }
  route(from, to) { // BFS through unlocked nodes
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur === to) break;
      for (const nb of this.neighbors(cur)) if (!(nb in prev) && this.unlocked(NODE[nb])) { prev[nb] = cur; q.push(nb); }
    }
    if (!(to in prev)) return [to];
    const path = []; let c = to;
    while (c) { path.unshift(c); c = prev[c]; }
    return path;
  }
  async travel(n) {
    const path = this.route(Game.save.at, n.id);
    this.token.moving = true;
    for (let i = 1; i < path.length; i++) {
      const nd = NODE[path[i]], d = Math.hypot(nd.x - this.token.x, nd.y - nd.h - 46 - this.token.y);
      AudioSys.sfx('step');
      await tween(this.token, { x: nd.x, y: nd.y - nd.h - 46 }, clamp(d / 900, 0.25, 0.8), Ease.inOutCubic);
    }
    this.token.moving = false;
    Game.save.at = n.id; Game.persist();
    Game.runNode(n);
  }
  objective() {
    const next = NODES.find(n => !n.optional && !this.cleared(n.id));
    return next ? next : null;
  }
  update(dt) {
    this.t += dt;
    for (const cl of this.clouds) { cl.x += cl.v * dt; if (cl.x > W + 200) { cl.x = -900; cl.y = rand(0, H); } }
    if (Math.random() < dt * 6) Particles.ambient('glow', { x: 0, y: H, w: W, h: 10 }, { vy: rand(-40, -15), color: 'rgba(255,170,80,0.8)', size: 3, sizeMin: 1, life: rand(5, 9), layer: 'back' });
    if (G.overlay || this.pack || this.menu) return;
    this.hover = null;
    for (const n of NODES) {
      if (Math.hypot(G.mouse.x - n.x, G.mouse.y - (n.y - n.h * 0.45)) < Math.max(70, n.h * 0.55)) this.hover = n;
    }
    if (this.hover && this.canVisit(this.hover)) {
      G._hoverSeen = true;
      if (G.hoverId !== 'node_' + this.hover.id) { G.hoverId = 'node_' + this.hover.id; AudioSys.sfx('hover'); }
      if (G.mouse.clicked) { G.mouse.clicked = false; AudioSys.sfx('click'); this.travel(this.hover); }
    }
    if (keyHit('KeyI')) this.pack = true;
    if (keyHit('Escape')) this.menu = true;
  }
  drawEdge(c, a, b) {
    const ca = this.cleared(a.id), cb = this.cleared(b.id), ub = this.unlocked(b);
    const ax = a.x, ay = a.y - 20, bx = b.x, by = b.y - 20;
    const mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - (bx - ax) * 0.18;
    c.save();
    c.lineCap = 'round';
    if (ca && cb) { c.strokeStyle = 'rgba(232,196,120,0.75)'; c.lineWidth = 6; c.setLineDash([2, 16]); c.shadowColor = 'rgba(255,190,90,0.6)'; c.shadowBlur = 10; }
    else if (ca && ub) { c.strokeStyle = 'rgba(255,214,140,0.95)'; c.lineWidth = 7; c.setLineDash([2, 18]); c.lineDashOffset = -this.t * 40; c.shadowColor = 'rgba(255,170,60,0.9)'; c.shadowBlur = 14; }
    else { c.strokeStyle = 'rgba(200,190,170,0.18)'; c.lineWidth = 5; c.setLineDash([2, 18]); }
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
    c.restore();
  }
  drawNode(c, n) {
    const img = G.img['prop_' + n.prop]; if (!img) return;
    const un = this.unlocked(n), cl = this.cleared(n.id), can = this.canVisit(n);
    const hov = this.hover === n && can;
    const s = n.h / img.height, w = img.width * s;
    const lift = hov ? -8 : 0;
    // ground glow
    if (un) {
      const pulse = 0.6 + Math.sin(this.t * 3 + n.x) * 0.25;
      const col = can && !cl ? `rgba(255,180,70,${0.55 * pulse})` : cl ? 'rgba(160,210,140,0.35)' : 'rgba(255,180,70,0.3)';
      c.save(); c.globalCompositeOperation = 'lighter';
      const gw = w * 1.5;
      c.drawImage(glowSprite(col), n.x - gw / 2, n.y - gw * 0.2, gw, gw * 0.4);
      c.restore();
    }
    c.save();
    c.translate(n.x, n.y + lift);
    if (hov) { c.shadowColor = 'rgba(255,200,110,0.9)'; c.shadowBlur = 30; }
    c.drawImage(img, -w / 2, -n.h, w, n.h);
    c.shadowColor = 'transparent';
    if (!un) { c.globalAlpha = 0.62; c.drawImage(tinted(img, '#0b0d14'), -w / 2, -n.h, w, n.h); c.globalAlpha = 1; }
    c.restore();
    if (cl && n.type !== 'rest' && n.type !== 'story') {
      c.save(); c.translate(n.x + w * 0.18, n.y - n.h * 0.45); c.rotate(-0.22); c.globalAlpha = 0.9;
      c.drawImage(this._stamp, -70, -20, 140, 40); c.restore();
    }
    // label
    const label = un ? n.name : '???';
    const ly = n.y + 34;
    c.save(); c.font = font(24, F.head, 700); const lw = c.measureText(label).width; c.restore();
    c.save(); c.globalAlpha = un ? 1 : 0.6;
    rr(c, n.x - lw / 2 - 40, ly - 22, lw + 64, 36, 18); c.fillStyle = 'rgba(12,9,6,0.72)'; c.fill();
    c.lineWidth = 1; c.strokeStyle = hov ? C.gold : 'rgba(216,180,106,0.35)'; c.stroke();
    const ic = n.type === 'battle' ? 'axe' : n.type === 'rest' ? 'flame' : n.type === 'treasure' ? 'pouch' : 'quill';
    c.save(); c.translate(n.x - lw / 2 - 18, ly - 4); c.scale(0.62, 0.62); Art.icon[ic](c, 0, 0); c.restore();
    txt(c, label, n.x + 12, ly + 3, { size: 24, fam: F.head, weight: 700, align: 'center', base: 'middle', color: hov ? '#fff1d0' : un ? '#f0e2c4' : '#9a948a' });
    c.restore();
  }
  drawToken(c) {
    const tk = this.token, b = Math.sin(this.t * 3) * 6;
    const x = tk.x, y = tk.y + b;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite('rgba(255,80,30,0.9)'), x - 90, y - 90, 180, 180);
    c.restore();
    c.save(); c.fillStyle = C.gold;
    c.beginPath(); c.moveTo(x - 14, y + 40); c.lineTo(x + 14, y + 40); c.lineTo(x, y + 60); c.closePath(); c.fill(); c.restore();
    drawPortraitMedallion(c, x, y, 44, 'calm');
  }
  drawTooltip(c, n) {
    if (!n || !this.unlocked(n)) return;
    const cl = this.cleared(n.id);
    const lines = [n.blurb];
    if (n.type === 'battle') { const enc = ENCOUNTERS[n.enc]; lines.push((cl ? 'Cleared' : 'Threats: ') + (cl ? '' : enc.enemies.map(e => ENEMIES[e].name).filter((v, i, a) => a.indexOf(v) === i).join(', '))); }
    if (n.type === 'rest') lines.push(cl ? 'Click to rest again.' : 'Rest and resupply.');
    if (n.optional) lines.push(cl ? 'Searched.' : 'Optional — worth a look.');
    const w = 460, h = 70 + lines.length * 32;
    let x = n.x + 90, y = n.y - n.h - 40;
    if (x + w > W - 20) x = n.x - 90 - w;
    y = clamp(y, 150, H - h - 20);
    panel(c, x, y, w, h, { r: 12, shadowBlur: 20 });
    txt(c, n.name, x + 24, y + 42, { size: 28, fam: F.head, weight: 900, color: C.gold });
    lines.forEach((l, i) => txt(c, l, x + 24, y + 80 + i * 32, { size: 23, color: i ? C.textDim : C.text }));
  }
  draw(c) {
    const px = (G.mouse.x - W / 2) * -0.01, py = (G.mouse.y - H / 2) * -0.01;
    drawCover(c, G.img.bg_map, px, py, 1.04);
    Particles.draw(c, 'back');
    // dark table tint
    c.fillStyle = 'rgba(6,8,12,0.12)'; c.fillRect(0, 0, W, H);
    for (const cl of this.clouds) { c.globalAlpha = cl.a * 0.6; c.drawImage(G.img._cloud, cl.x, cl.y, 700 * cl.s, 300 * cl.s); }
    c.globalAlpha = 1;
    // decor
    for (const d of DECOR) {
      const im = G.img['prop_' + d.prop]; if (!im) continue;
      const s = d.h / im.height;
      c.globalAlpha = 0.6; c.drawImage(im, d.x - im.width * s / 2, d.y - d.h, im.width * s, d.h);
      c.globalAlpha = 0.5; c.drawImage(tinted(im, '#0b0d14'), d.x - im.width * s / 2, d.y - d.h, im.width * s, d.h);
      c.globalAlpha = 1;
    }
    for (const n of NODES) for (const l of n.links) this.drawEdge(c, n, NODE[l]);
    [...NODES].sort((a, b) => a.y - b.y).forEach(n => this.drawNode(c, n));
    this.drawToken(c);
    vignette(c, 0.7);
    // HUD
    drawStatus(c, 24, 20, { w: 600, h: 196, xp: true });
    const obj = this.objective();
    panel(c, W - 644, 20, 620, 120);
    txt(c, 'OBJECTIVE', W - 614, 60, { size: 22, fam: F.head, weight: 900, color: C.gold, letter: 3 });
    txt(c, obj ? obj.name : 'Deliver the shipment!', W - 614, 98, { size: 32, fam: F.head, weight: 700, color: '#fff' });
    txt(c, obj ? obj.blurb : '', W - 614, 128, { size: 22, color: C.textDim });
    if (button(c, 'pack', W - 644, 152, 300, 58, 'Pack', { icon: Art.icon.pouch, sub: 'I' })) this.pack = true;
    if (button(c, 'menu', W - 324, 152, 300, 58, 'Menu', { icon: Art.icon.shield, sub: 'Esc' })) this.menu = true;
    if (!G.overlay && !Game.busy) {
      if (this.hover) this.drawTooltip(c, this.hover);
      txt(c, 'Click a glowing location to travel', W / 2, H - 28, { size: 24, align: 'center', color: 'rgba(255,240,210,0.6)' });
    }
    Particles.draw(c, 'front');
    if (this.pack) this.drawPack(c);
    if (this.menu) this.drawMenu(c);
  }
  drawPack(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
    const P = Game.player, w = 760, h = 520, x = (W - w) / 2, y = (H - h) / 2;
    panel(c, x, y, w, h);
    txt(c, "ERIC'S PACK", x + w / 2, y + 62, { size: 40, fam: F.head, weight: 900, align: 'center', color: C.gold });
    let i = 0;
    for (const k of Object.keys(ITEMS)) {
      const it = ITEMS[k], n = P.items[k] || 0, ry = y + 100 + i * 66;
      c.globalAlpha = n ? 1 : 0.4;
      Art.icon.item(c, x + 60, ry + 28, k);
      txt(c, `${it.name}  ×${n}`, x + 100, ry + 26, { size: 28, fam: F.head, weight: 700 });
      txt(c, it.desc, x + 100, ry + 54, { size: 21, color: C.textDim });
      c.globalAlpha = 1;
      if (k !== 'rune' && button(c, 'use_' + k, x + w - 150, ry + 8, 110, 48, 'Use', { disabled: !n, size: 24 })) Game.useItem(k, true);
      i++;
    }
    if (button(c, 'pack_close', x + w / 2 - 110, y + h - 74, 220, 54, 'Close') || keyHit('Escape', 'KeyI')) this.pack = false;
  }
  drawMenu(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
    const w = 560, h = 520, x = (W - w) / 2, y = (H - h) / 2;
    panel(c, x, y, w, h);
    txt(c, 'MENU', x + w / 2, y + 64, { size: 40, fam: F.head, weight: 900, align: 'center', color: C.gold });
    if (button(c, 'm_resume', x + 80, y + 100, w - 160, 60, 'Resume')) this.menu = false;
    const ms = Math.round(AudioSys.settings.music * 10), ss = Math.round(AudioSys.settings.sfx * 10);
    if (button(c, 'm_music', x + 80, y + 175, w - 160, 60, `Music  ${'■'.repeat(ms)}${'□'.repeat(10 - ms)}`, { size: 24 })) { AudioSys.setVolume('music', ms >= 10 ? 0 : (ms + 2) / 10); }
    if (button(c, 'm_sfx', x + 80, y + 250, w - 160, 60, `Effects  ${'■'.repeat(ss)}${'□'.repeat(10 - ss)}`, { size: 24 })) { AudioSys.setVolume('sfx', ss >= 10 ? 0 : (ss + 2) / 10); AudioSys.sfx('chop'); }
    if (button(c, 'm_fs', x + 80, y + 325, w - 160, 60, 'Toggle Fullscreen  (F)', { size: 24 })) toggleFullscreen();
    if (button(c, 'm_title', x + 80, y + 410, w - 160, 60, 'Save & Quit to Title', { danger: true })) { Game.persist(); this.menu = false; goto(new TitleScene()); }
    if (keyHit('Escape')) this.menu = false;
  }
}
