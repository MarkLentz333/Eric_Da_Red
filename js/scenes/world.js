'use strict';
// ============================================================================
//  WORLD SCENE (v3) — walkable 3/4 overworld that replaces the click-a-node map.
//  Eric walks (WASD / arrows / click-to-move), talks to villagers, finds caches,
//  bumps into roaming enemies, and walks up to story locations to trigger them.
//  Story flow (banner → cutscene → dialog → battle) is still Game.runNode().
// ============================================================================
const ERIC_H = 160, ERIC_R = 22, WALK = 400;

function _rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _chaikin(pts, it = 2, closed = true) {
  for (let k = 0; k < it; k++) {
    const o = [], n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) { o.unshift(pts[0]); o.push(pts[n - 1]); }
    pts = o;
  }
  return pts;
}
function _catmull(pts, seg = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function _inPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function _segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0, 1);
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
}
function _mkCv(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; }

class WorldScene extends MapScene {
  constructor() { super(); this.built = false; }

  // ------------------------------------------------------------------ build
  build() {
    const R = _rng(1337);
    // textures
    {
      const [cv, c] = _mkCv(512, 512);
      c.fillStyle = '#5d8834'; c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '40,80,20' : '130,170,70'},${0.05 + R() * 0.08})`; c.beginPath(); c.arc(R() * 512, R() * 512, 20 + R() * 60, 0, TAU); c.fill(); }
      for (let i = 0; i < 4200; i++) {
        const x = R() * 512, y = R() * 512, l = 4 + R() * 9, g = R();
        c.strokeStyle = g < 0.4 ? 'rgba(48,86,26,0.55)' : g < 0.8 ? 'rgba(120,165,62,0.45)' : 'rgba(170,200,95,0.4)';
        c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 4, y - l); c.stroke();
      }
      this.grassPat = c.createPattern(cv, 'repeat');
    }
    {
      const [cv, c] = _mkCv(256, 256);
      c.fillStyle = '#8b6b43'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) { const v = R(); c.fillStyle = v < 0.5 ? 'rgba(60,42,24,0.35)' : 'rgba(180,150,105,0.35)'; c.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3); }
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(120,115,105,0.6)'; c.beginPath(); c.ellipse(R() * 256, R() * 256, 2 + R() * 4, 1.5 + R() * 3, R() * 3, 0, TAU); c.fill(); }
      this.dirtPat = c.createPattern(cv, 'repeat');
    }
    {
      const [cv, c] = _mkCv(256, 256);
      c.fillStyle = '#cdb88a'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) { c.fillStyle = R() < 0.5 ? 'rgba(150,130,90,0.4)' : 'rgba(240,225,190,0.4)'; c.fillRect(R() * 256, R() * 256, 1.5, 1.5); }
      this.sandPat = c.createPattern(cv, 'repeat');
    }
    {
      const [cv, c] = _mkCv(512, 512);
      c.fillStyle = '#1f5566'; c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '15,50,65' : '60,120,130'},${0.08 + R() * 0.1})`; c.beginPath(); c.ellipse(R() * 512, R() * 512, 30 + R() * 80, 10 + R() * 25, 0, 0, TAU); c.fill(); }
      this.waterPat = c.createPattern(cv, 'repeat');
    }
    { // large-scale tonal variation over the whole world
      const [cv, c] = _mkCv(130, 80);
      for (let i = 0; i < 160; i++) {
        const dark = R() < 0.55;
        c.fillStyle = dark ? `rgba(20,40,10,${0.15 + R() * 0.25})` : `rgba(190,200,110,${0.08 + R() * 0.15})`;
        c.beginPath(); c.arc(R() * 130, R() * 80, 2 + R() * 7, 0, TAU); c.fill();
      }
      this.varCv = cv;
    }
    // terrain geometry
    this.water = WATER.map(p => _chaikin(p, 3, true));
    this.waterPaths = this.water.map(pts => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; });
    this.roads = ROADS.map(r => _catmull(r, 12));
    this.roadPath = new Path2D();
    for (const r of this.roads) r.forEach(([x, y], i) => i ? this.roadPath.lineTo(x, y) : this.roadPath.moveTo(x, y));
    // solids + sprites
    this.solids = []; this.sprites = []; this.decals = [];
    const nearRoad = (x, y, d) => this.roads.some(r => { for (let i = 0; i < r.length - 1; i++) if (_segDist(x, y, r[i], r[i + 1]) < d) return true; return false; });
    const wet = (x, y, m = 0) => this.water.some(p => _inPoly(x, y, p)) || (m && this.water.some(p => _inPoly(x + m, y, p) || _inPoly(x - m, y, p) || _inPoly(x, y + m, p) || _inPoly(x, y - m, p)));
    this.wet = wet;
    const keepClear = [];
    for (const id in WORLD_NODES) { const w = WORLD_NODES[id]; keepClear.push([w.x, w.y, 300], [w.ix, w.iy, 200]); if (w.mx) keepClear.push([w.mx, w.my, 200]); }
    for (const p of WORLD_PROPS) keepClear.push([p.x, p.y, 170]);
    for (const n of WORLD_NPCS) keepClear.push([n.x, n.y, (n.wander || 0) + 120]);
    for (const s of SKIRMISHES) keepClear.push([s.x, s.y, s.area + 90]);
    for (const c of CACHES) keepClear.push([c.x, c.y, 90]);
    keepClear.push([MEAD_HALL.x, MEAD_HALL.y, 260], [AXE_RANGE.x, AXE_RANGE.y, 220], [GATE.x + 65, GATE.y + 135, 260]);
    const clear = (x, y, extra = 0) => keepClear.every(([cx, cy, r]) => Math.hypot(x - cx, y - cy) > r + extra);
    const addTree = (x, y, kind, h, solid = true) => {
      this.sprites.push({ kind: 'prop', img: 'w_' + kind, x, y, h, tree: true, sway: R() * TAU });
      if (solid) this.solids.push({ x, y: y - 8, r: kind.startsWith('pine') ? 26 : 34 });
    };
    // the east tree-line (closed except the gate gap)
    for (let y = -40; y < WORLD.h + 60; y += 58) {
      if (y > TREELINE.gap[0] && y < TREELINE.gap[1]) continue;
      const x = TREELINE.x + (R() - 0.5) * 50;
      this.sprites.push({ kind: 'prop', img: 'w_' + (R() < 0.5 ? 'pines' : 'pine2'), x, y, h: 300 + R() * 80, tree: true, sway: R() * TAU });
      this.solids.push({ x: TREELINE.x, y, r: 44 });
    }
    // forests & groves
    const zones = [
      { x0: 2850, x1: 3980, y0: 80, y1: 3150, n: 150, mix: ['pines', 'pine2', 'oak', 'pines', 'willow2'] },   // Darkpine Forest
      { x0: 700, x1: 2700, y0: 60, y1: 760, n: 70, mix: ['pines', 'oak', 'willow2', 'pine2'] },              // northern woods
      { x0: 2200, x1: 2720, y0: 2300, y1: 3150, n: 40, mix: ['oak', 'willow', 'pines'] },                    // south meadow edge
      { x0: 4330, x1: 4860, y0: 60, y1: 3150, n: 55, mix: ['pines', 'pine2', 'willow'] },                    // east bank
      { x0: 1500, x1: 2700, y0: 760, y1: 2300, n: 26, mix: ['oak', 'willow2', 'willow'] },                   // town greenery
    ];
    for (const z of zones) {
      let placed = 0, tries = 0;
      while (placed < z.n && tries++ < z.n * 30) {
        const x = z.x0 + R() * (z.x1 - z.x0), y = z.y0 + R() * (z.y1 - z.y0);
        if (wet(x, y, 70) || nearRoad(x, y, 110) || !clear(x, y) || Math.abs(x - TREELINE.x) < 90) continue;
        if (this.sprites.some(s => s.tree && Math.hypot(s.x - x, (s.y - y) * 1.6) < 95)) continue;
        const k = z.mix[Math.floor(R() * z.mix.length)];
        addTree(x, y, k, k.startsWith('pine') ? 280 + R() * 90 : 250 + R() * 80);
        placed++;
      }
    }
    // reeds along shores, grass tufts & bushes in meadows (no collision)
    for (let i = 0; i < 900 && this.decals.length < 420; i++) {
      const x = R() * WORLD.w, y = R() * WORLD.h;
      if (wet(x, y) || nearRoad(x, y, 60)) continue;
      const shore = wet(x, y, 60);
      if (shore) { if (R() < 0.6) this.sprites.push({ kind: 'prop', img: 'w_reeds', x, y, h: 90 + R() * 40, tree: true, sway: R() * TAU }); continue; }
      if (!clear(x, y, -60)) continue;
      const r = R();
      if (r < 0.18) this.sprites.push({ kind: 'prop', img: 'w_' + (R() < 0.5 ? 'grass1' : 'grass2'), x, y, h: 50 + R() * 30, tree: true, sway: R() * TAU });
      else if (r < 0.24) this.sprites.push({ kind: 'prop', img: 'w_bonsai', x, y, h: 70 + R() * 30 });
      else this.decals.push({ x, y, t: r < 0.62 ? 'flower' : 'stone', c: pick(['#f4e6a2', '#e9a8c0', '#ffffff', '#b8c8ff', '#f2b45a']), s: 2 + R() * 3 });
    }
    // fixed props
    for (const p of WORLD_PROPS) {
      if (p.skip) continue;
      this.sprites.push({ kind: 'prop', img: 'w_' + p.p, x: p.x, y: p.y, h: p.h, big: p.h > 200 });
      if (p.r) this.solids.push({ x: p.x, y: p.y - p.h * 0.12, r: p.r });
    }
    // story locations
    for (const id in WORLD_NODES) {
      const w = WORLD_NODES[id], n = NODE[id];
      const ground = id === 'bridge' || id === 'docks';
      this.sprites.push({ kind: 'node', node: n, img: 'w_' + (w.prop || n.prop), x: w.x, y: w.y, h: w.h, ground, big: w.h > 220 });
      if (w.r) this.solids.push({ x: w.x, y: w.y - w.h * 0.14, r: w.r, node: id });
    }
    this.sprites.push({ kind: 'prop', img: 'w_' + MEAD_HALL.p, x: MEAD_HALL.x, y: MEAD_HALL.y, h: MEAD_HALL.h, big: true, hall: true });
    this.solids.push({ x: MEAD_HALL.x, y: MEAD_HALL.y - 40, r: MEAD_HALL.r });
    this.sprites.push({ kind: 'range', x: AXE_RANGE.x, y: AXE_RANGE.y });
    this.solids.push({ x: AXE_RANGE.x, y: AXE_RANGE.y - 10, r: 50 });
    // villagers
    this.npcs = WORLD_NPCS.map(d => ({ d, x: d.x, y: d.y, tx: d.x, ty: d.y, wait: rand(0.5, 3), t: rand(0, 9), face: 1, talk: 0, moving: false, img: null }));
    // roaming enemies
    this.skirm = SKIRMISHES.map(d => ({ d, x: d.x, y: d.y, tx: d.x, ty: d.y, wait: rand(0, 2), t: rand(0, 9), chase: false, face: 1 }));
    // overview (minimap + big map) prerender
    this.overview = this.renderOverview(520, 320);
    this.overviewBig = this.renderOverview(1560, 960);
    this.cloudShadows = Array.from({ length: 6 }, () => ({ x: rand(0, WORLD.w), y: rand(0, WORLD.h), s: rand(900, 1500), v: rand(18, 30) }));
    this.built = true;
  }

  npcBody(n) {
    if (n.img) return n.img;
    const d = n.d;
    if (G.img['npc_' + d.id]) return (n.img = G.img['npc_' + d.id]);   // real art, once supplied
    if (!d.body) return null;
    const src = G.img[d.body[0]]; if (!src) return null;
    const [cv, c] = _mkCv(src.width, src.height);
    c.filter = d.body[1]; c.drawImage(src, 0, 0);
    return (n.img = cv);
  }

  renderOverview(w, h) {
    const [cv, c] = _mkCv(w, h), s = w / WORLD.w;
    c.fillStyle = '#3e5a2a'; c.fillRect(0, 0, w, h);
    c.save(); c.scale(s, h / WORLD.h);
    c.fillStyle = 'rgba(25,45,18,0.55)';
    for (const sp of this.sprites) if (sp.tree && sp.h > 200) { c.beginPath(); c.arc(sp.x, sp.y - 40, 70, 0, TAU); c.fill(); }
    c.lineJoin = 'round';
    for (const p of this.waterPaths) { c.lineWidth = 60; c.strokeStyle = '#b9a676'; c.stroke(p); }
    for (const p of this.waterPaths) { c.fillStyle = '#1d4a5c'; c.fill(p); }
    c.lineCap = 'round'; c.lineWidth = 60; c.strokeStyle = '#a3845a'; c.stroke(this.roadPath);
    c.restore();
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    return cv;
  }

  // ------------------------------------------------------------------ state
  enter() {
    if (!this.built) this.build();
    this.t = 0; this.pack = false; this.menu = false; this.bigmap = false; this.hover = null;
    const pos = Game.save.pos, home = WORLD_NODES.home;
    this.e = { x: pos ? pos.x : home.ix - 40, y: pos ? pos.y : home.iy + 140, dir: 'front', flip: false, phase: 0, moving: false, step: 0 };
    this.target = null; this.focus = null; this.autoArm = false; this.armT = 1.5;
    this.cam = { x: 0, y: 0 }; this.snapCam();
    this.region = this.regionAt(this.e.x, this.e.y); this.regionT = 3.2;
    for (const s of this.skirm) { s.x = s.d.x; s.y = s.d.y; s.chase = false; }
    AudioSys.playMusic('background');
    if (!this._stamp) this._stamp = Art.makeStamp('APPROVED', '#c4271b', 420, 120);
  }
  snapCam() {
    this.cam.x = clamp(this.e.x - W / 2, 0, WORLD.w - W);
    this.cam.y = clamp(this.e.y - H * 0.56, 0, WORLD.h - H);
  }
  regionAt(x, y) {
    if (x > 4280) return ['THE FJORD MOUTH', 'Where the Backorder waits'];
    if (x > 3960 && y < 1000) return ['THE TOLL BRIDGE', 'Under new management'];
    if (x > TREELINE.x) return ['DARKPINE FOREST', 'The road to the Great Hall'];
    if (x < 1400 && y > 1800) return ['FJORDHEIM HARBOR', 'Docks, boats & complaints'];
    return ['FJORDHEIM', 'A small town with a big shipment'];
  }
  gateOpen() { return this.unlocked(NODE[GATE.unlock]); }
  saveP() { Game.save.pos = { x: Math.round(this.e.x), y: Math.round(this.e.y) }; }

  blocked(x, y, who = ERIC_R) {
    if (x < 40 || y < 60 || x > WORLD.w - 40 || y > WORLD.h - 30) return true;
    const d = BRIDGE_DECK;
    const onDeck = x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h;
    if (onDeck) { if (!this.cleared('bridge') && x > d.x + 40) return true; }
    else if (this.wet(x, y)) return true;
    if (!this.gateOpen() && x > GATE.x && x < GATE.x + GATE.w && y > GATE.y && y < GATE.y + GATE.h) return true;
    for (const s of this.solids) { const dx = x - s.x, dy = (y - s.y) * 1.5; if (dx * dx + dy * dy < (s.r + who) * (s.r + who)) return true; }
    return false;
  }
  tryMove(o, dx, dy, who) {
    if (!this.blocked(o.x + dx, o.y + dy, who)) { o.x += dx; o.y += dy; return true; }
    if (dx && !this.blocked(o.x + dx, o.y, who)) { o.x += dx; return true; }
    if (dy && !this.blocked(o.x, o.y + dy, who)) { o.y += dy; return true; }
    return false;
  }

  // things Eric can interact with: { x, y, label, act }
  interactables() {
    const out = [];
    for (const id in WORLD_NODES) {
      const w = WORLD_NODES[id], n = NODE[id], cl = this.cleared(id), un = this.unlocked(n);
      if (!un) { out.push({ x: w.ix, y: w.iy, label: n.name, sub: 'Not yet: ' + (this.objective() ? this.objective().name + ' first' : ''), locked: true }); continue; }
      if (n.type === 'battle' && !cl) out.push({ x: w.mx || w.ix, y: w.my || w.iy, label: 'Fight', sub: n.name, act: () => this.useNode(n), battle: true });
      else if (n.type === 'rest') out.push({ x: w.ix, y: w.iy, label: 'Rest', sub: n.name, act: () => this.useNode(n) });
      else if (n.type === 'treasure' && !cl) out.push({ x: w.ix, y: w.iy, label: 'Search', sub: n.name, act: () => this.useNode(n) });
      else if (n.type === 'story') out.push({ x: w.ix, y: w.iy, label: cl ? 'Rest at home' : 'Enter', sub: n.name, act: () => cl ? this.restHome() : this.useNode(n) });
    }
    for (const p of this.npcs) {
      const d = p.d;
      out.push({ x: p.x, y: p.y, label: d.range ? 'Throw axes' : 'Talk', sub: d.name, act: () => this.talk(p), npc: p });
    }
    out.push({ x: AXE_RANGE.ix, y: AXE_RANGE.iy, label: 'Throw axes', sub: 'The Axe Range', act: () => this.openRange() });
    out.push({ x: MEAD_HALL.ix, y: MEAD_HALL.iy, label: 'Enter', sub: 'The Drunken Goat (mead hall)', act: () => this.openHall() });
    return out;
  }
  nearest(maxD = 150) {
    let best = null, bd = maxD;
    for (const it of this.interactables()) { const d = Math.hypot(it.x - this.e.x, (it.y - this.e.y) * 1.3); if (d < bd) { bd = d; best = it; } }
    return best;
  }

  async useNode(n) {
    this.target = null; this.saveP(); Game.save.at = n.id; Game.persist();
    this.autoArm = false;
    await Game.runNode(n);
  }
  async restHome() {
    if (Game.busy) return; Game.busy = true;
    try {
      await Dialog.play([{ s: 'eric', m: 'calm', t: pick(['Home. My chair. My ledger. Nobody biting anybody.', 'A quick nap. Then back to the shipment.', 'Ah. The good quill. I missed you.']) }]);
      Game.restore(); AudioSys.sfx('heal'); AudioSys.sting('rest');
      await Notice.show('Rested at Home', [{ text: 'HP, Focus restored. Madness calmed.', color: '#9cf08a' }]);
      this.saveP(); Game.persist();
    } finally { Game.busy = false; }
  }
  async talk(p) {
    if (Game.busy) return;
    if (p.d.range) return this.openRange(p);
    Game.busy = true;
    try {
      const sets = p.d.talk, lines = sets[p.talk % sets.length]; p.talk++;
      AudioSys.sfx('blip');
      await Dialog.play(lines);
    } finally { Game.busy = false; }
  }
  async openRange() {
    if (Game.busy) return; Game.busy = true;
    try {
      const best = Game.save.axeBest || 0;
      await Dialog.play([{ s: 'bjarni', t: best ? `Back for more? Your best is ${best}. Five axes. Beat it.` : 'Quartermaster! Five axes, one target. Bullseye is fifty. Mind the wind.' }]);
      this.saveP(); Game.persist();
      await goto(new AxeThrowScene(), 0.5);
    } finally { Game.busy = false; }
  }
  async openHall() {
    if (Game.busy) return;
    this.saveP(); Game.persist(); AudioSys.sfx('step'); AudioSys.sfx('wood');
    await goto(new MeadHallScene(), 0.5);
  }
  async fightSkirmish(s) {
    if (Game.busy) return; Game.busy = true;
    this.saveP(); this.target = null;
    try {
      AudioSys.sfx('growl');
      const won = await Game.startBattle(s.d.enc);
      if (won) { Game.save.skirm = Game.save.skirm || {}; Game.save.skirm[s.d.id] = true; }
      Game.persist();
    } finally { Game.busy = false; this.autoArm = false; }
  }
  async collect(cch) {
    if (Game.busy) return; Game.busy = true;
    try {
      Game.save.found = Game.save.found || {}; Game.save.found[cch.id] = true;
      AudioSys.sfx('coin'); AudioSys.sting('treasure');
      Particles.spawn('glow', cch.x - this.cam.x, cch.y - this.cam.y - 20, 20, { color: 'rgba(255,210,110,0.9)', speed: 260, g: -200, life: 1, layer: 'front' });
      await Notice.show('Hidden Cache!', Game.give(cch.reward));
      this.saveP(); Game.persist();
    } finally { Game.busy = false; }
  }
  async fastTravel(id) {
    const w = WORLD_NODES[id]; this.bigmap = false;
    AudioSys.sfx('whoosh');
    Game.busy = true;
    G.fade.target = 1; G.fade.speed = 3; G.fade.style = 'fade';
    await wait(0.36);
    this.e.x = w.ix; this.e.y = w.iy + 50; this.target = null; this.snapCam(); this.saveP(); Game.persist();
    G.fade.target = 0; Game.busy = false; this.autoArm = false;
  }

  // ------------------------------------------------------------------ update
  hudHit(m) {
    return inRect(m, 0, 0, 640, 230) || inRect(m, W - 660, 0, 660, 300) || inRect(m, W - 380, H - 270, 380, 270);
  }
  update(dt) {
    this.t += dt;
    const e = this.e;
    for (const cl of this.cloudShadows) { cl.x += cl.v * dt; if (cl.x > WORLD.w + cl.s) { cl.x = -cl.s; cl.y = rand(0, WORLD.h); } }
    if (Math.random() < dt * 4) Particles.ambient('glow', { x: 0, y: H, w: W, h: 10 }, { vy: rand(-40, -15), color: 'rgba(255,190,110,0.7)', size: 3, sizeMin: 1, life: rand(5, 9), layer: 'front' });
    const busy = G.overlay || Game.busy || this.pack || this.menu || G.fade.a > 0.05;
    // villagers + roaming enemies live even when we don't control Eric
    this.updateNpcs(dt, busy);
    this.updateSkirm(dt, busy);
    if (this.regionT > 0) this.regionT -= dt;
    if (busy) { e.moving = false; return; }
    if (this.bigmap) { this.updateBigMap(); return; }

    // ---- input → velocity
    let vx = (G.keys.KeyD || G.keys.ArrowRight ? 1 : 0) - (G.keys.KeyA || G.keys.ArrowLeft ? 1 : 0);
    let vy = (G.keys.KeyS || G.keys.ArrowDown ? 1 : 0) - (G.keys.KeyW || G.keys.ArrowUp ? 1 : 0);
    const wm = { x: G.mouse.x + this.cam.x, y: G.mouse.y + this.cam.y };
    if (vx || vy) this.target = null;
    else if ((G.mouse.clicked || (G.mouse.down && this.target)) && !this.hudHit(G.mouse)) {
      // clicking an interactable walks to it and uses it on arrival
      let hit = null;
      if (G.mouse.clicked) for (const it of this.interactables()) if (it.act && Math.hypot(it.x - wm.x, it.y - 60 - wm.y) < 90) hit = it;
      this.target = { x: wm.x, y: wm.y, use: hit || (G.mouse.down && this.target ? this.target.use : null) };
      if (hit) { this.target.x = hit.x; this.target.y = hit.y + 30; }
      if (G.mouse.clicked) AudioSys.sfx('blip');
    }
    if (this.target) {
      const dx = this.target.x - e.x, dy = this.target.y - e.y, d = Math.hypot(dx, dy);
      if (d < (this.target.use ? 90 : 12)) {
        const u = this.target.use; this.target = null;
        if (u) { u.act(); return; }
      } else { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy);
    e.moving = false;
    if (len > 0) {
      vx /= len; vy /= len;
      const sp = WALK * (G.keys.ShiftLeft || G.keys.ShiftRight ? 1.45 : 1) * dt;
      const moved = this.tryMove(e, vx * sp, vy * sp);
      if (!moved && this.target) this.target = null;
      e.moving = moved;
      if (Math.abs(vx) > Math.abs(vy) * 1.2) { e.dir = 'side'; e.flip = vx < 0; }
      else if (vy < 0) e.dir = 'back';
      else e.dir = Math.abs(vx) > 0.35 ? 'q34' : 'front';
      if (e.dir === 'q34') e.flip = vx > 0;
      if (moved) {
        e.phase += dt * (G.keys.ShiftLeft || G.keys.ShiftRight ? 13 : 10);
        if (Math.floor(e.phase / Math.PI) !== e.step) { e.step = Math.floor(e.phase / Math.PI); AudioSys.sfx('step', { x: e.x - this.cam.x }); }
      }
    }
    // camera
    const tx = clamp(e.x - W / 2, 0, WORLD.w - W), ty = clamp(e.y - H * 0.56, 0, WORLD.h - H);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    // region banner
    const rg = this.regionAt(e.x, e.y);
    if (rg[0] !== this.region[0]) { this.region = rg; this.regionT = 3.2; AudioSys.sfx('whoosh'); }
    // auto-trigger: walking into a waiting enemy group starts that fight
    const markers = Object.keys(WORLD_NODES).filter(id => WORLD_NODES[id].mx && NODE[id].type === 'battle' && !this.cleared(id) && this.unlocked(NODE[id]));
    const md = Math.min(9999, ...markers.map(id => Math.hypot(WORLD_NODES[id].mx - e.x, WORLD_NODES[id].my - e.y)));
    if (this.armT > 0) this.armT -= dt;
    if (md > 190 && this.armT <= 0) this.autoArm = true;
    if (this.autoArm && md < 85) { const id = markers.find(id => Math.hypot(WORLD_NODES[id].mx - e.x, WORLD_NODES[id].my - e.y) < 85); this.useNode(NODE[id]); return; }
    // caches
    Game.save.found = Game.save.found || {};
    for (const cch of CACHES) if (!Game.save.found[cch.id] && Math.hypot(cch.x - e.x, cch.y - e.y) < 60) { this.collect(cch); return; }
    // interact
    this.focus = this.nearest();
    if (this.focus && this.focus.act && keyHit('KeyE', 'Enter', 'Space', 'NumpadEnter')) { AudioSys.sfx('click'); this.focus.act(); return; }
    if (keyHit('KeyM', 'Tab')) { this.bigmap = true; AudioSys.sfx('paper'); }
    if (keyHit('KeyI')) this.pack = true;
    if (keyHit('Escape')) this.menu = true;
    if (Math.random() < dt) this.saveP();
  }
  updateNpcs(dt, busy) {
    for (const n of this.npcs) {
      n.t += dt;
      const dE = Math.hypot(n.x - this.e.x, n.y - this.e.y);
      n.moving = false;
      if (dE < 200 || busy || !n.d.wander) { if (dE < 300) n.face = this.e.x < n.x ? -1 : 1; continue; }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 6) {
        n.wait -= dt;
        if (n.wait <= 0) { const a = rand(0, TAU), r = rand(0, n.d.wander); n.tx = n.d.x + Math.cos(a) * r; n.ty = n.d.y + Math.sin(a) * r * 0.7; n.wait = rand(1.5, 4.5); }
      } else {
        const sp = (n.d.fast ? 170 : 75) * dt;
        if (!this.tryMove(n, dx / d * sp, dy / d * sp, 16)) { n.tx = n.x; n.ty = n.y; }
        n.moving = true; n.face = dx < 0 ? -1 : 1;
      }
    }
  }
  updateSkirm(dt, busy) {
    Game.save.skirm = Game.save.skirm || {};
    for (const s of this.skirm) {
      if (Game.save.skirm[s.d.id] || (s.d.need && !this.unlocked(NODE[s.d.need]))) continue;
      s.t += dt;
      if (busy) continue;
      const dE = Math.hypot(s.x - this.e.x, s.y - this.e.y), home = Math.hypot(s.x - s.d.x, s.y - s.d.y);
      const was = s.chase;
      s.chase = this.autoArm && dE < 360 && home < s.d.area + 380;
      if (s.chase && !was) { AudioSys.sfx('growl', { x: s.x - this.cam.x }); s.alert = 1; }
      if (s.alert > 0) s.alert -= dt;
      let tx = s.tx, ty = s.ty, sp = 80;
      if (s.chase) { tx = this.e.x; ty = this.e.y; sp = 250; }
      else if (Math.hypot(tx - s.x, ty - s.y) < 8) {
        s.wait -= dt;
        if (s.wait <= 0) { const a = rand(0, TAU), r = rand(0, s.d.area); s.tx = s.d.x + Math.cos(a) * r; s.ty = s.d.y + Math.sin(a) * r * 0.7; s.wait = rand(1, 3); }
        continue;
      }
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      if (!this.tryMove(s, dx / d * sp * dt, dy / d * sp * dt, 18) && !s.chase) { s.tx = s.x; s.ty = s.y; }
      s.face = dx < 0 ? -1 : 1;
      if (s.chase && dE < 70) { this.fightSkirmish(s); return; }
    }
  }
  updateBigMap() {
    if (keyHit('KeyM', 'Tab', 'Escape')) { this.bigmap = false; AudioSys.sfx('back'); return; }
    this.mapHover = null;
    const { x: ox, y: oy, s } = this.bigMapRect();
    for (const id in WORLD_NODES) {
      const w = WORLD_NODES[id];
      if (!this.travelOk(id)) continue;
      if (Math.hypot(G.mouse.x - (ox + w.ix * s), G.mouse.y - (oy + w.iy * s)) < 34) this.mapHover = id;
    }
    if (this.mapHover && G.mouse.clicked) { G.mouse.clicked = false; this.fastTravel(this.mapHover); }
    else if (G.mouse.clicked && !inRect(G.mouse, ox, oy, WORLD.w * s, WORLD.h * s)) this.bigmap = false;
  }
  travelOk(id) { return id === 'home' || (this.cleared(id) && id !== 'fjord'); }
  bigMapRect() { const s = 1560 / WORLD.w; return { x: (W - 1560) / 2, y: 70, s }; }

  // ------------------------------------------------------------------ draw
  drawGround(c) {
    const v = { x: this.cam.x, y: this.cam.y, w: W, h: H };
    c.fillStyle = this.grassPat; c.fillRect(v.x, v.y, v.w, v.h);
    c.save(); c.globalAlpha = 0.85; c.imageSmoothingEnabled = true; c.drawImage(this.varCv, 0, 0, WORLD.w, WORLD.h); c.restore();
    // shores & water
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of this.waterPaths) { c.lineWidth = 120; c.strokeStyle = this.sandPat; c.stroke(p); }
    for (const p of this.waterPaths) { c.lineWidth = 150; c.strokeStyle = 'rgba(70,90,30,0.18)'; c.stroke(p); c.lineWidth = 120; c.strokeStyle = this.sandPat; c.stroke(p); }
    for (const p of this.waterPaths) {
      c.fillStyle = this.waterPat; c.fill(p);
      c.save(); c.clip(p);
      c.lineWidth = 70; c.strokeStyle = 'rgba(110,190,190,0.35)'; c.stroke(p);
      c.setLineDash([28, 46]); c.lineDashOffset = -this.t * 18;
      c.lineWidth = 8; c.strokeStyle = 'rgba(235,250,245,0.45)'; c.stroke(p);
      c.setLineDash([]);
      // drifting glints
      c.strokeStyle = 'rgba(220,245,255,0.28)'; c.lineWidth = 3;
      const x0 = Math.floor(v.x / 160) * 160, y0 = Math.floor(v.y / 110) * 110;
      for (let gx = x0; gx < v.x + v.w + 160; gx += 160) for (let gy = y0; gy < v.y + v.h + 110; gy += 110) {
        const h = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453, f = h - Math.floor(h);
        const ph = this.t * 0.8 + f * TAU, a = Math.sin(ph);
        if (a < 0.2) continue;
        const ox = gx + f * 120 + Math.sin(this.t * 0.4 + f * 9) * 20, oy = gy + (f * 7 % 1) * 80;
        c.globalAlpha = (a - 0.2) * 0.9; c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + 18, oy - 5, ox + 36, oy); c.stroke();
      }
      c.globalAlpha = 1;
      c.restore();
    }
    // bridge deck shadow across the river
    // roads
    c.lineWidth = 96; c.strokeStyle = 'rgba(55,60,25,0.35)'; c.stroke(this.roadPath);
    c.lineWidth = 80; c.strokeStyle = this.dirtPat; c.stroke(this.roadPath);
    c.lineWidth = 34; c.strokeStyle = 'rgba(255,225,170,0.10)'; c.stroke(this.roadPath);
    c.setLineDash([2, 22]); c.lineWidth = 6; c.strokeStyle = 'rgba(70,50,30,0.35)';
    c.save(); c.translate(-14, 0); c.stroke(this.roadPath); c.translate(28, 0); c.stroke(this.roadPath); c.restore(); c.setLineDash([]);
    // decals
    for (const d of this.decals) {
      if (d.x < v.x - 20 || d.x > v.x + v.w + 20 || d.y < v.y - 20 || d.y > v.y + v.h + 20) continue;
      if (d.t === 'flower') { c.fillStyle = d.c; c.beginPath(); c.arc(d.x, d.y, d.s, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,240,150,0.9)'; c.beginPath(); c.arc(d.x, d.y, d.s * 0.35, 0, TAU); c.fill(); }
      else { c.fillStyle = 'rgba(40,40,35,0.35)'; c.beginPath(); c.ellipse(d.x + 2, d.y + 3, d.s * 2.4, d.s * 1.3, 0, 0, TAU); c.fill(); c.fillStyle = '#8f8a7e'; c.beginPath(); c.ellipse(d.x, d.y, d.s * 2.2, d.s * 1.4, 0, 0, TAU); c.fill(); }
    }
  }
  drawShadow(c, x, y, w, a = 0.42) {
    c.save(); c.globalAlpha = a; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(x, y, w, w * 0.32, 0, 0, TAU); c.fill(); c.restore();
  }
  drawProp(c, sp) {
    const img = G.img[sp.img]; if (!img) return null;
    const s = sp.h / img.height, w = img.width * s;
    if (sp.x + w / 2 < this.cam.x - 50 || sp.x - w / 2 > this.cam.x + W + 50 || sp.y - sp.h > this.cam.y + H + 50 || sp.y < this.cam.y - 50) return null;
    let lockTint = false;
    if (sp.kind === 'node') lockTint = !this.unlocked(sp.node);
    if (!sp.tree) this.drawShadow(c, sp.x + w * 0.04, sp.y - sp.h * 0.06, w * 0.36, 0.16);
    else this.drawShadow(c, sp.x + 8, sp.y - 4, Math.min(80, w * 0.42), 0.32);
    c.save(); c.translate(sp.x, sp.y);
    if (sp.tree && sp.sway != null) { c.transform(1, 0, Math.sin(this.t * 1.2 + sp.sway) * 0.025, 1, 0, 0); }
    c.drawImage(img, -w / 2, -sp.h, w, sp.h);
    if (lockTint) { c.globalAlpha = 0.45; c.drawImage(tinted(img, '#0b0d14'), -w / 2, -sp.h, w, sp.h); }
    c.restore();
    if (sp.hall) {
      const q = Game.save.q, o = q ? DISPATCH[q.d] : DISPATCH[0], ready = !!o && (!q || !q.given || o.prog()[0] >= o.prog()[1]);
      const by = sp.y - sp.h - 30 + Math.sin(this.t * 2) * 4;
      c.save(); c.font = font(26, F.head, 900); const tw = c.measureText('THE DRUNKEN GOAT').width; c.restore();
      rr(c, sp.x - tw / 2 - 22, by - 24, tw + 44, 46, 10); c.fillStyle = 'rgba(58,36,18,0.92)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#c9a25a'; c.stroke();
      txt(c, 'THE DRUNKEN GOAT', sp.x, by, { size: 26, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#ffe2a0' });
      if (ready) txt(c, '!', sp.x + tw / 2 + 40, by, { size: 50, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#ffd76a', stroke: '#000' });
    }
    if (sp.kind === 'node' && this.cleared(sp.node.id) && sp.node.type === 'battle') {
      c.save(); c.translate(sp.x + w * 0.15, sp.y - sp.h * 0.5); c.rotate(-0.22); c.globalAlpha = 0.85; c.drawImage(this._stamp, -80, -23, 160, 46); c.restore();
    }
    return { x: sp.x - w / 2, y: sp.y - sp.h, w, h: sp.h, base: sp.y };
  }
  drawRange(c, x, y) {
    this.drawShadow(c, x, y, 90, 0.35);
    c.save(); c.translate(x, y);
    // posts + crossbar
    const wood = (x0, y0, w, h) => { const g = c.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#3e2714'); g.addColorStop(0.5, '#86592f'); g.addColorStop(1, '#3a2412'); c.fillStyle = g; c.fillRect(x0, y0, w, h); };
    wood(-82, -200, 16, 200); wood(66, -200, 16, 200);
    c.fillStyle = '#5a3a1d'; c.fillRect(-92, -206, 184, 14);
    // log-slice target
    c.save(); c.translate(0, -112); c.scale(1, 1.02);
    const r = 70;
    c.fillStyle = '#4a2d16'; c.beginPath(); c.arc(4, 5, r, 0, TAU); c.fill();
    const g = c.createRadialGradient(-12, -14, 4, 0, 0, r); g.addColorStop(0, '#e6c48c'); g.addColorStop(1, '#a87a46');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(90,55,25,0.45)'; c.lineWidth = 1.4;
    for (let i = 6; i < r; i += 5) { c.beginPath(); c.arc(0, 0, i, 0, TAU); c.stroke(); }
    [[0.82, '#2a1d14'], [0.6, '#e9dcc0'], [0.4, '#2a1d14'], [0.2, '#b52a1c']].forEach(([f, col]) => { c.lineWidth = 7; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, r * f, 0, TAU); c.stroke(); });
    c.fillStyle = '#b52a1c'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill();
    c.restore();
    // two axes stuck in it
    const ax = G.img._axe;
    if (ax) { [[-26, -150, 0.5], [30, -88, -0.7]].forEach(([px, py, rot]) => { c.save(); c.translate(px, py); c.rotate(rot); c.drawImage(ax, -60 * 0.3, -40 * 0.3, 170 * 0.3, 360 * 0.3); c.restore(); }); }
    // little sign
    c.fillStyle = '#6b4524'; c.fillRect(-130, -70, 8, 70);
    rr(c, -176, -112, 100, 44, 6); c.fillStyle = '#7b532c'; c.fill(); c.strokeStyle = '#3a2412'; c.lineWidth = 3; c.stroke();
    txt(c, 'AXES', -126, -84, { size: 22, fam: F.head, weight: 900, align: 'center', color: '#2a170a' });
    c.restore();
    return { x: x - 180, y: y - 210, w: 270, h: 210, base: y };
  }
  drawEric(c, alpha = 1) {
    const e = this.e;
    const key = { front: 'eric_front', back: 'eric_back', side: 'eric_side', q34: 'eric' }[e.dir];
    const img = G.img[key] || G.img.eric; if (!img) return;
    const s = ERIC_H / img.height, w = img.width * s;
    const bob = e.moving ? Math.abs(Math.sin(e.phase)) * 7 : Math.sin(this.t * 2) * 1.2;
    const tilt = e.moving ? Math.sin(e.phase) * 0.045 : 0;
    if (alpha === 1) this.drawShadow(c, e.x, e.y, 36 - bob * 0.8, 0.45);
    c.save(); c.globalAlpha = alpha; c.translate(e.x, e.y - bob); c.rotate(tilt);
    const flip = e.dir === 'side' ? (e.flip ? -1 : 1) : e.dir === 'q34' ? (e.flip ? -1 : 1) : 1;
    c.scale(flip * (1 + (e.moving ? Math.sin(e.phase * 2) * 0.012 : 0)), 1 - (e.moving ? Math.abs(Math.cos(e.phase)) * 0.02 : 0));
    c.drawImage(img, -w / 2, -ERIC_H, w, ERIC_H);
    c.restore();
  }
  drawNpc(c, n) {
    const img = this.npcBody(n);
    const d = n.d, h = ERIC_H * (d.scale || 1);
    if (!img) { // no body yet (e.g. Gunnhild in her office): a lantern + name plate
      const lx = n.x, ly = n.y;
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(glowSprite('rgba(255,180,80,0.7)'), lx - 50, ly - 140, 100, 100); c.restore();
      c.fillStyle = '#3a2412'; c.fillRect(lx - 3, ly - 100, 6, 100);
      c.fillStyle = '#ffcf7a'; c.beginPath(); c.arc(lx, ly - 96, 9, 0, TAU); c.fill();
      return { base: n.y };
    }
    const s = h / img.height, w = img.width * s;
    const bob = n.moving ? Math.abs(Math.sin(n.t * 9)) * 5 : Math.sin(n.t * 2) * 1;
    this.drawShadow(c, n.x, n.y, 30 * (d.scale || 1), 0.42);
    c.save(); c.translate(n.x, n.y - bob); c.rotate(n.moving ? Math.sin(n.t * 9) * 0.04 : 0);
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
    return { base: n.y };
  }
  drawSkirm(c, s) {
    const d = s.d, img = G.img[d.img]; if (!img) return;
    const h = d.h, sc = h / img.height, w = img.width * sc;
    const hop = Math.abs(Math.sin(s.t * (s.chase ? 10 : 4))) * (s.chase ? 14 : 6);
    this.drawShadow(c, s.x, s.y, w * 0.4, 0.4);
    c.save(); c.translate(s.x, s.y - hop); c.scale(s.face < 0 ? -1 : 1, 1);
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite(`rgba(255,60,30,${s.chase ? 0.55 : 0.25})`), s.x - w * 0.6, s.y - h * 0.9, w * 1.2, h * 0.9); c.restore();
    if (s.chase) txt(c, '!', s.x, s.y - h - 22 - hop, { size: 54, fam: F.head, weight: 900, align: 'center', color: '#ff5a3a', stroke: '#000' });
  }
  drawMarker(c, id) { // enemies waiting at a battle location
    const w = WORLD_NODES[id], n = NODE[id];
    if (!w.mark || n.type !== 'battle' || this.cleared(id) || !this.unlocked(n)) return;
    const img = G.img[w.mark]; if (!img) return;
    const big = id === 'fjord' ? 260 : id === 'road' ? 230 : id === 'bridge' || id === 'woodpile' ? ERIC_H * 1.02 : 130;
    const s = big / img.height, wd = img.width * s, t = this.t + w.mx;
    const bob = Math.sin(t * 3) * 4;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite(`rgba(255,70,30,${0.35 + Math.sin(t * 4) * 0.12})`), w.mx - wd, w.my - big * 0.5, wd * 2, big * 0.7); c.restore();
    this.drawShadow(c, w.mx, w.my, wd * 0.4, 0.42);
    c.save(); c.translate(w.mx, w.my + bob * 0.3);
    if (id === 'fjord') { c.rotate(Math.sin(t * 1.6) * 0.12); }
    c.scale(id === 'bridge' || id === 'woodpile' ? -1 : 1, 1);
    c.drawImage(img, -wd / 2, -big, wd, big); c.restore();
    // floating crossed-axes badge
    const by = w.my - big - 46 + Math.sin(t * 2.5) * 6;
    c.save(); c.beginPath(); c.arc(w.mx, by, 26, 0, TAU); c.fillStyle = 'rgba(30,6,4,0.85)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#ff6a3a'; c.stroke();
    c.translate(w.mx, by); c.scale(0.55, 0.55); Art.icon.axe(c, 0, 0); c.restore();
  }
  drawCache(c, cch) {
    if ((Game.save.found || {})[cch.id]) return;
    const p = 0.5 + Math.sin(this.t * 4 + cch.x) * 0.5;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite(`rgba(255,215,120,${0.35 + p * 0.4})`), cch.x - 40, cch.y - 40, 80, 80);
    c.translate(cch.x, cch.y - 6 - p * 4); c.rotate(this.t * 1.5);
    c.fillStyle = `rgba(255,250,220,${0.6 + p * 0.4})`;
    for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(3, -3); c.lineTo(0, -16 - p * 6); c.lineTo(-3, -3); c.closePath(); c.fill(); }
    c.restore();
  }
  drawGate(c) {
    if (this.gateOpen()) return;
    const g = GATE, img = G.img.w_stone_wall;
    const cx = g.x + g.w / 2;
    for (let i = 0; i < 2; i++) {
      const y = g.y + 120 + i * 130;
      if (img) { const h = 110, w = img.width * h / img.height; c.save(); c.translate(cx, y); c.rotate(Math.PI / 2 * 0.0); c.drawImage(img, -w / 2, -h, w, h); c.restore(); }
    }
  }
  draw(c) {
    const cx = Math.round(this.cam.x + G.cam.sx), cy = Math.round(this.cam.y + G.cam.sy);
    c.save(); c.translate(-cx, -cy);
    this.drawGround(c);
    // ground-level things
    for (const sp of this.sprites) if (sp.ground) this.drawProp(c, sp);
    if (!this.cleared('bridge')) { // toll chain across the deck
      const d = BRIDGE_DECK;
      c.save(); c.strokeStyle = 'rgba(40,30,20,0.9)'; c.lineWidth = 6; c.setLineDash([10, 6]);
      c.beginPath(); c.moveTo(d.x + 60, d.y + 10); c.quadraticCurveTo(d.x + 70, d.y + 70, d.x + 60, d.y + d.h); c.stroke(); c.restore();
    }
    for (const cch of CACHES) this.drawCache(c, cch);
    // depth-sorted world
    const list = [];
    for (const sp of this.sprites) if (!sp.ground) list.push({ y: sp.y, f: () => sp.kind === 'range' ? this.drawRange(c, sp.x, sp.y) : this.drawProp(c, sp), big: sp.big || sp.tree && sp.h > 240 });
    for (const n of this.npcs) list.push({ y: n.y, f: () => this.drawNpc(c, n) });
    Game.save.skirm = Game.save.skirm || {};
    for (const s of this.skirm) if (!Game.save.skirm[s.d.id] && !(s.d.need && !this.unlocked(NODE[s.d.need]))) list.push({ y: s.y, f: () => this.drawSkirm(c, s) });
    for (const id in WORLD_NODES) if (WORLD_NODES[id].mx) list.push({ y: WORLD_NODES[id].my, f: () => this.drawMarker(c, id) });
    if (!this.gateOpen()) list.push({ y: GATE.y + GATE.h, f: () => this.drawGate(c) });
    list.push({ y: this.e.y, f: () => this.drawEric(c), eric: true });
    list.sort((a, b) => a.y - b.y);
    let occluded = false;
    const ex = this.e.x, ey = this.e.y - ERIC_H * 0.5;
    let after = false;
    for (const it of list) {
      const r = it.f();
      if (it.eric) { after = true; continue; }
      if (after && r && r.w && it.big && ex > r.x + r.w * 0.15 && ex < r.x + r.w * 0.85 && ey > r.y && ey < r.base) occluded = true;
    }
    if (occluded) this.drawEric(c, 0.38);
    // cloud shadows drifting over the land
    c.save(); c.globalCompositeOperation = 'multiply';
    for (const cl of this.cloudShadows) {
      if (cl.x + cl.s < cx || cl.x - cl.s > cx + W || cl.y + cl.s * 0.5 < cy || cl.y - cl.s * 0.5 > cy + H) continue;
      c.globalAlpha = 0.22; c.drawImage(glowSprite('rgba(60,70,90,0.9)'), cl.x - cl.s, cl.y - cl.s * 0.4, cl.s * 2, cl.s * 0.8);
    }
    c.restore();
    // interaction prompts + objective chevron (world space)
    this.drawWorldUI(c);
    c.restore();
    // golden-hour grade + vignette
    const gr = c.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,190,110,0.12)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,50,90,0.16)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    Particles.draw(c, 'back');
    vignette(c, 0.55);
    this.drawHud(c);
    Particles.draw(c, 'front');
    if (this.bigmap) this.drawBigMap(c);
    if (this.pack) this.drawPack(c);
    if (this.menu) this.drawMenu(c);
  }
  drawWorldUI(c) {
    if (Game.busy || G.overlay) return;
    // name tags for nearby villagers
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - this.e.x, n.y - this.e.y); if (d > 420) continue;
      const a = clamp((420 - d) / 160, 0, 1), h = n.d.office ? 130 : ERIC_H * (n.d.scale || 1) + 22;
      c.save(); c.globalAlpha = a;
      c.font = font(22, F.head, 700); const tw = c.measureText(n.d.name).width;
      rr(c, n.x - tw / 2 - 14, n.y - h - 30, tw + 28, 34, 17); c.fillStyle = 'rgba(12,9,6,0.72)'; c.fill();
      txt(c, n.d.name, n.x, n.y - h - 12, { size: 22, fam: F.head, weight: 700, align: 'center', base: 'middle', color: '#f0e2c4' });
      c.restore();
    }
    // objective chevron (on-screen)
    const obj = this.objective();
    if (obj) {
      const w = WORLD_NODES[obj.id], ox = w.mx || w.ix, oy = (w.my || w.iy) - 230;
      if (ox > this.cam.x && ox < this.cam.x + W && oy > this.cam.y && oy < this.cam.y + H) {
        const b = Math.sin(this.t * 4) * 10;
        c.save(); c.translate(ox, oy + b); c.fillStyle = '#ffcf6a'; c.shadowColor = 'rgba(255,170,60,0.9)'; c.shadowBlur = 18;
        c.beginPath(); c.moveTo(-22, -16); c.lineTo(0, 10); c.lineTo(22, -16); c.lineTo(12, -16); c.lineTo(0, -4); c.lineTo(-12, -16); c.closePath(); c.fill(); c.restore();
      }
    }
    // interaction prompt
    const f = this.focus;
    if (f) {
      const label = f.locked ? f.label : f.label + ':  ' + f.sub, sub = f.locked ? f.sub : null;
      c.save(); c.font = font(26, F.head, 700); const tw = c.measureText(label).width + (f.locked ? 0 : 60);
      const px = f.x, py = (f.npc ? f.y - ERIC_H * (f.npc.d.scale || 1) - 70 : f.y - 180);
      const bw = Math.max(tw, sub ? c.measureText(sub).width * 0.8 : 0) + 40, bh = sub ? 76 : 50;
      panel(c, px - bw / 2, py - bh, bw, bh, { r: 12, shadowBlur: 14 });
      if (!f.locked) {
        rr(c, px - bw / 2 + 14, py - bh + 9, 34, 32, 6); c.fillStyle = '#ffcf6a'; c.fill();
        txt(c, 'E', px - bw / 2 + 31, py - bh + 26, { size: 22, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#2a170a' });
        txt(c, label, px - bw / 2 + 60, py - bh + 26, { size: 26, fam: F.head, weight: 700, base: 'middle', color: '#fff1d0' });
      } else {
        txt(c, label, px, py - bh + 26, { size: 24, fam: F.head, weight: 700, align: 'center', base: 'middle', color: '#c9bca2' });
        txt(c, sub, px, py - bh + 56, { size: 20, align: 'center', base: 'middle', color: C.textDim });
      }
      c.restore();
    }
    // click-to-move target ring
    if (this.target && !this.target.use) {
      c.save(); c.strokeStyle = 'rgba(255,220,140,0.8)'; c.lineWidth = 3; const r = 16 + Math.sin(this.t * 8) * 3;
      c.beginPath(); c.ellipse(this.target.x, this.target.y, r, r * 0.4, 0, 0, TAU); c.stroke(); c.restore();
    }
  }
  drawHud(c) {
    c.save(); c.translate(20, 16); c.scale(0.86, 0.86); drawStatus(c, 0, 0, { w: 600, h: 196, xp: true }); c.restore();
    const obj = this.objective();
    panel(c, W - 644, 20, 620, 120);
    txt(c, 'OBJECTIVE', W - 614, 60, { size: 22, fam: F.head, weight: 900, color: C.gold, letter: 3 });
    txt(c, obj ? obj.name : 'Deliver the shipment!', W - 614, 98, { size: 32, fam: F.head, weight: 700, color: '#fff' });
    txt(c, obj ? obj.blurb : '', W - 614, 128, { size: 22, color: C.textDim });
    const dq = Game.save.q, dor = dq && dq.given && DISPATCH[dq.d];
    if (dor) {
      const [h, n] = dor.prog();
      panel(c, W - 644, 222, 620, 64, { r: 10 });
      txt(c, "DARRELL'S ORDER", W - 620, 260, { size: 18, fam: F.head, weight: 900, color: C.gold, letter: 2 });
      txt(c, `${dor.title}  ${Math.min(h, n)}/${n}`, W - 420, 261, { size: 23, fam: F.head, weight: 700, color: h >= n ? '#9cf08a' : '#fff' });
    }
    if (!this.bigmap && !this.pack && !this.menu) {
      if (button(c, 'pack', W - 644, 152, 196, 58, 'Pack', { icon: Art.icon.pouch, sub: 'I', size: 24 })) this.pack = true;
      if (button(c, 'wmap', W - 436, 152, 196, 58, 'Map', { icon: Art.icon.quill, sub: 'M', size: 24 })) { this.bigmap = true; AudioSys.sfx('paper'); }
      if (button(c, 'menu', W - 228, 152, 204, 58, 'Menu', { icon: Art.icon.shield, sub: 'Esc', size: 24 })) this.menu = true;
    }
    // objective pointer at screen edge
    if (obj && !Game.busy && !G.overlay) {
      const w = WORLD_NODES[obj.id], ox = (w.mx || w.ix) - this.cam.x, oy = (w.my || w.iy) - 120 - this.cam.y;
      if (ox < 0 || ox > W || oy < 0 || oy > H) {
        const cxs = W / 2, cys = H / 2, a = Math.atan2(oy - cys, ox - cxs);
        // keep the pointer inside a safe frame that avoids the HUD panels
        const L = 80, T = 250, Rr = W - 80, B = H - 110;
        const kx = Math.cos(a) > 0 ? (Rr - cxs) / Math.cos(a) : Math.cos(a) < 0 ? (L - cxs) / Math.cos(a) : 1e9;
        const ky = Math.sin(a) > 0 ? (B - cys) / Math.sin(a) : Math.sin(a) < 0 ? (T - cys) / Math.sin(a) : 1e9;
        const k = Math.min(kx, ky), px = cxs + Math.cos(a) * k, py = cys + Math.sin(a) * k;
        const dist = Math.round(Math.hypot((w.mx || w.ix) - this.e.x, (w.my || w.iy) - this.e.y) / 40);
        c.save(); c.translate(px, py); c.rotate(a);
        c.fillStyle = '#ffcf6a'; c.shadowColor = 'rgba(255,170,60,0.9)'; c.shadowBlur = 16;
        c.beginPath(); c.moveTo(28, 0); c.lineTo(-14, -20); c.lineTo(-6, 0); c.lineTo(-14, 20); c.closePath(); c.fill(); c.restore();
        txt(c, `${obj.name} · ${dist} paces`, clamp(px, 200, W - 200), py + (py > H / 2 ? -44 : 52), { size: 22, fam: F.head, weight: 700, align: 'center', color: '#ffe2b0', stroke: 'rgba(0,0,0,0.8)' });
      }
    }
    // minimap
    const mw = 340, mh = 209, mx = W - mw - 24, my = H - mh - 24;
    panel(c, mx - 8, my - 8, mw + 16, mh + 16, { r: 10 });
    c.drawImage(this.overview, mx, my, mw, mh);
    const s = mw / WORLD.w;
    for (const id in WORLD_NODES) {
      const w = WORLD_NODES[id], n = NODE[id]; if (!this.unlocked(n)) continue;
      const cl = this.cleared(id);
      c.fillStyle = n.type === 'battle' && !cl ? '#ff5a3a' : n.type === 'rest' ? '#ffb040' : cl ? '#9cc98a' : '#ffe2a0';
      c.beginPath(); c.arc(mx + w.ix * s, my + w.iy * (mh / WORLD.h), 4.5, 0, TAU); c.fill();
    }
    if (Game.save.revealCaches) for (const cch of CACHES) if (!(Game.save.found || {})[cch.id]) { c.fillStyle = '#ffd76a'; c.fillRect(mx + cch.x * s - 3, my + cch.y * (mh / WORLD.h) - 3, 6, 6); }
    if (obj) { const w = WORLD_NODES[obj.id], p = 0.5 + Math.sin(this.t * 5) * 0.5; c.strokeStyle = `rgba(255,210,110,${0.5 + p * 0.5})`; c.lineWidth = 2; c.beginPath(); c.arc(mx + w.ix * s, my + w.iy * (mh / WORLD.h), 8 + p * 3, 0, TAU); c.stroke(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#c4271b'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(mx + this.e.x * s, my + this.e.y * (mh / WORLD.h), 6, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    c.strokeRect(mx + this.cam.x * s, my + this.cam.y * (mh / WORLD.h), W * s, H * (mh / WORLD.h));
    // region title
    if (this.regionT > 0) {
      const a = clamp(this.regionT > 2.6 ? (3.2 - this.regionT) / 0.6 : this.regionT / 0.8, 0, 1);
      c.save(); c.globalAlpha = a;
      txt(c, this.region[0], W / 2, 250, { size: 64, fam: F.title, weight: 900, align: 'center', color: '#f6dc9a', letter: 4, stroke: 'rgba(0,0,0,0.75)' });
      txt(c, this.region[1], W / 2, 296, { size: 28, fam: F.head, weight: 700, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.75)' });
      c.restore();
    }
    if (!Game.busy && !G.overlay && !this.bigmap)
      txt(c, 'WASD / Arrows or click to walk  ·  Shift run  ·  E interact  ·  M map', W / 2 - 180, H - 26, { size: 22, align: 'center', color: 'rgba(255,240,210,0.62)', stroke: 'rgba(0,0,0,0.6)' });
  }
  drawBigMap(c) {
    c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(0, 0, W, H);
    const { x: ox, y: oy, s } = this.bigMapRect(), mw = WORLD.w * s, mh = WORLD.h * s;
    panel(c, ox - 16, oy - 16, mw + 32, mh + 32 + 50, { r: 14 });
    c.drawImage(this.overviewBig, ox, oy, mw, mh);
    if (!this.gateOpen()) { c.fillStyle = '#8f8a7e'; c.fillRect(ox + GATE.x * s, oy + GATE.y * s, GATE.w * s, GATE.h * s); }
    for (const id in WORLD_NODES) {
      const w = WORLD_NODES[id], n = NODE[id], un = this.unlocked(n), cl = this.cleared(id);
      const px = ox + w.ix * s, py = oy + w.iy * s, hov = this.mapHover === id;
      c.save(); c.globalAlpha = un ? 1 : 0.45;
      c.beginPath(); c.arc(px, py, hov ? 22 : 16, 0, TAU); c.fillStyle = 'rgba(12,9,6,0.85)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = n.type === 'battle' && !cl ? '#ff6a3a' : this.travelOk(id) ? '#ffcf6a' : 'rgba(216,180,106,0.5)'; c.stroke();
      const ic = n.type === 'battle' ? 'axe' : n.type === 'rest' ? 'flame' : n.type === 'treasure' ? 'pouch' : 'quill';
      c.translate(px, py); c.scale(0.42, 0.42); Art.icon[ic](c, 0, 0); c.restore();
      txt(c, un ? n.name : '???', px, py + 38, { size: 20, fam: F.head, weight: 700, align: 'center', color: hov ? '#fff' : un ? '#f0e2c4' : '#8a847a', stroke: 'rgba(0,0,0,0.8)' });
      if (cl && n.type === 'battle') txt(c, '✓', px + 20, py - 14, { size: 22, weight: 900, color: '#9cf08a', stroke: '#000' });
    }
    if (Game.save.revealCaches) for (const cch of CACHES) if (!(Game.save.found || {})[cch.id]) { c.fillStyle = '#ffd76a'; c.beginPath(); c.arc(ox + cch.x * s, oy + cch.y * s, 7, 0, TAU); c.fill(); txt(c, 'cache', ox + cch.x * s, oy + cch.y * s + 22, { size: 16, align: 'center', color: '#ffe2a0', stroke: 'rgba(0,0,0,0.8)' }); }
    const HX = ox + MEAD_HALL.x * s, HY = oy + MEAD_HALL.y * s;
    c.fillStyle = '#ffcf6a'; c.beginPath(); c.arc(HX, HY, 6, 0, TAU); c.fill();
    txt(c, 'The Drunken Goat', HX, HY - 14, { size: 18, fam: F.head, weight: 700, align: 'center', color: '#ffe2b0', stroke: 'rgba(0,0,0,0.8)' });
    const AX = ox + AXE_RANGE.x * s, AY = oy + AXE_RANGE.y * s;
    c.fillStyle = '#ffcf6a'; c.beginPath(); c.arc(AX, AY, 6, 0, TAU); c.fill();
    txt(c, 'Axe Range', AX, AY + 24, { size: 18, fam: F.head, weight: 700, align: 'center', color: '#ffe2b0', stroke: 'rgba(0,0,0,0.8)' });
    const p = 0.5 + Math.sin(this.t * 5) * 0.5;
    c.fillStyle = '#fff'; c.strokeStyle = '#c4271b'; c.lineWidth = 4;
    c.beginPath(); c.arc(ox + this.e.x * s, oy + this.e.y * s, 10 + p * 2, 0, TAU); c.fill(); c.stroke();
    txt(c, 'Click a visited location to fast-travel  ·  M / Esc to close', W / 2, oy + mh + 40, { size: 24, align: 'center', color: '#e8dcc0' });
  }
}
