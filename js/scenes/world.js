'use strict';
// ============================================================================
//  WORLD SCENE (v3) — walkable 3/4 overworld that replaces the click-a-node map.
//  Eric walks (WASD / arrows / click-to-move), talks to villagers, finds caches,
//  bumps into roaming enemies, and walks up to story locations to trigger them.
//  Story flow (banner → cutscene → dialog → battle) is still Game.runNode().
// ============================================================================
const ERIC_H = 92, ERIC_R = 12, WALK = 290, ZOOM = 1.12;
// v3.3 perspective camera: the ground is a tilted plane seen through a pinhole camera (pitch = tilt from the ground,
// F = focal length in px, zoom = scale at the focus point, h0 = screen row of the focus point). Standing things are
// billboards scaled by depth; the ground is rendered flat into tiles and projected row by row.
const CAM3 = { pitch: 1.0, F: 1750, zoom: 0.66, h0: 0.6, strip: 2, tile: 512, gs: 0.72 };   // gs = resolution of the per-frame ground layer (world px -> canvas px)
// filmed walk cycles (tools/walk/extract_walk.py -> js/walk_data.js); SIDE_IDLE = side frame with the feet together
const SIDE_IDLE = 27;
// paper-doll rig for the overworld walk cycle (parts cut by tools/rig/rig_eric.py; sprite-pixel pivots)
const RIG = {
  front: { w: 365, h: 682, armL: [70, 202], armR: [295, 202], legL: [125, 462], legR: [240, 462], relax: 0.11 },
  back: { w: 356, h: 677, armL: [72, 205], armR: [284, 205], legL: [120, 436], legR: [236, 436], relax: 0.11 },
  q34: { w: 318, h: 684, armL: [60, 205], armR: [280, 212], legL: [100, 470], legR: [205, 470], relax: 0.05, far: 'armR' },
};
let _cvId = 0;
// point inside a convex polygon (either winding), or within pad of its edges
function _inPoly(q, x, y, pad = 0) {
  let pos = 0, neg = 0;
  for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % q.length], cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cr > 0) pos++; else if (cr < 0) neg++;
  }
  if (!pos || !neg) return true;
  if (pad <= 0) return false;
  for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % q.length], vx = bx - ax, vy = by - ay;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1), dx = x - ax - vx * t, dy = y - ay - vy * t;
    if (dx * dx + dy * dy < pad * pad) return true;
  }
  return false;
}

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
    keepClear.push([DRAGON_RIDGE.x, DRAGON_RIDGE.y, 330], [DRAGON_RIDGE.ix, DRAGON_RIDGE.iy + 80, 260], [MEAD_HALL.x, MEAD_HALL.y, 260], [AXE_RANGE.x, AXE_RANGE.y, 220], [GATE.x + 65, GATE.y + 135, 260]);
    if (typeof VILLAGE !== 'undefined') {   // keep trees off the village pieces (world_life.js)
      for (const h of VILLAGE.houses) keepClear.push([h.x, h.y - 60, h.h * 0.65]);
      for (const p of VILLAGE.plots) keepClear.push([p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h) * 0.7 + 40]);
      const pn = VILLAGE.pen; keepClear.push([pn.x + pn.w / 2, pn.y + pn.h / 2, pn.w * 0.75 + 60]);
      for (const st of VILLAGE.stalls) keepClear.push([st.x, st.y, 160]);
      keepClear.push([TOWN.x, TOWN.y, 520]);
      for (const b of VILLAGE.landmarks) keepClear.push([b.x, b.y - 60, b.h * 0.6]);
      keepClear.push([VILLAGE.forge.x, VILLAGE.forge.y - 60, 260]);
    }
    const clear = (x, y, extra = 0) => keepClear.every(([cx, cy, r]) => Math.hypot(x - cx, y - cy) > r + extra);
    const addTree = (x, y, kind, h, solid = true) => {
      this.sprites.push({ kind: 'prop', img: 't_' + kind, x, y, h, tree: true, sway: R() * TAU });
      if (solid) this.solids.push({ x, y: y - 8, r: kind.startsWith('pine') ? 26 : 34 });
    };
    // the east tree-line (closed except the gate gap)
    for (let y = -40; y < WORLD.h + 60; y += 58) {
      if (y > TREELINE.gap[0] && y < TREELINE.gap[1]) continue;
      const x = TREELINE.x + (R() - 0.5) * 50;
      this.sprites.push({ kind: 'prop', img: 't_' + (R() < 0.5 ? 'pines' : 'pine2'), x, y, h: 300 + R() * 80, tree: true, sway: R() * TAU });
      this.solids.push({ x: TREELINE.x, y, r: 44 });
    }
    // forests & groves
    const zones = [
      { x0: 2850, x1: 3980, y0: 80, y1: 3150, n: 150, mix: ['pines', 'pine2', 'oak', 'pines', 'willow2'] },   // Darkpine Forest
      { x0: 700, x1: 2700, y0: 60, y1: 760, n: 70, mix: ['pines', 'oak', 'willow2', 'pine2'] },              // northern woods
      { x0: 2320, x1: 2720, y0: 2500, y1: 3150, n: 20, mix: ['oak', 'willow', 'pines'] },                    // south meadow edge
      { x0: 4330, x1: 4860, y0: 60, y1: 3150, n: 55, mix: ['pines', 'pine2', 'willow'] },                    // east bank
      { x0: 1500, x1: 2700, y0: 760, y1: 2300, n: 7, mix: ['oak'] },                                        // a few shade oaks in town
    ];
    for (const z of zones) {
      let placed = 0, tries = 0;
      while (placed < z.n && tries++ < z.n * 30) {
        const x = z.x0 + R() * (z.x1 - z.x0), y = z.y0 + R() * (z.y1 - z.y0);
        if (wet(x, y, 70) || nearRoad(x, y, 140) || !clear(x, y, 30) || Math.abs(x - TREELINE.x) < 90) continue;
        if (this.sprites.some(s => s.tree && Math.hypot(s.x - x, (s.y - y) * 1.6) < 95)) continue;
        const k = z.mix[Math.floor(R() * z.mix.length)];
        addTree(x, y, k, k.startsWith('pine') ? 280 + R() * 90 : 250 + R() * 80);
        placed++;
      }
    }
    // reeds along shores, grass tufts & bushes in meadows (no collision)
    for (let i = 0; i < 5200 && this.decals.length < 2200; i++) {
      const x = R() * WORLD.w, y = R() * WORLD.h;
      if (wet(x, y) || nearRoad(x, y, 52)) continue;
      const shore = wet(x, y, 70);
      if (shore) { if (R() < 0.7) this.decals.push({ x, y, t: 'reed', s: 0.8 + R() * 0.6, seed: R() * 99 }); continue; }
      const r = R();
      if (r < 0.62) this.decals.push({ x, y, t: 'tuft', s: 0.7 + R() * 0.8, seed: R() * 99, dark: R() < 0.5 });
      else if (r < 0.86) { if (clear(x, y, -80)) this.decals.push({ x, y, t: 'flower', c: pick(['#f4e6a2', '#e9a8c0', '#ffffff', '#b8c8ff', '#f2b45a']), s: 2 + R() * 3 }); }
      else this.decals.push({ x, y, t: 'stone', s: 2 + R() * 3 });
    }
    // paint forest floor (darker, mossy) under trees and worn earth around the town square into the tonal map
    {
      const vc = this.varCv.getContext('2d'), k = 130 / WORLD.w;
      for (const sp of this.sprites) if (sp.tree) { vc.fillStyle = 'rgba(16,34,10,0.16)'; vc.beginPath(); vc.arc(sp.x * k, sp.y * k, 2.6, 0, TAU); vc.fill(); }
      for (const [x, y, r] of [[1760, 1640, 7], [1700, 1300, 5], [2300, 1600, 4], [1050, 2150, 4], [1300, 1950, 3]]) {
        const g = vc.createRadialGradient(x * k, y * k, 0, x * k, y * k, r); g.addColorStop(0, 'rgba(150,120,70,0.35)'); g.addColorStop(1, 'rgba(150,120,70,0)');
        vc.fillStyle = g; vc.beginPath(); vc.arc(x * k, y * k, r, 0, TAU); vc.fill();
      }
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
      const pr = w.prop || n.prop;
      this.sprites.push({ kind: 'node', node: n, img: (G.img['t_' + pr] ? 't_' : 'w_') + pr, tree: !!G.img['t_' + pr], x: w.x, y: w.y, h: w.h, ground, big: w.h > 220 });
      if (w.r) this.solids.push({ x: w.x, y: w.y - w.h * 0.14, r: w.r, node: id });
    }
    this.sprites.push({ kind: 'prop', img: 'w_' + MEAD_HALL.p, x: MEAD_HALL.x, y: MEAD_HALL.y, h: MEAD_HALL.h, big: true, hall: true });
    this.solids.push({ x: MEAD_HALL.x, y: MEAD_HALL.y - 40, r: MEAD_HALL.r });
    // the axe range: the user's diorama (fenced lane with targets); falls back to the drawn target
    if (G.img.w_axe_range) { this.sprites.push({ kind: 'prop', img: 'w_axe_range', x: AXE_RANGE.x, y: AXE_RANGE.y, h: 350, big: true }); this.solids.push({ x: AXE_RANGE.x + 20, y: AXE_RANGE.y - 70, r: 120 }); }
    else { this.sprites.push({ kind: 'range', x: AXE_RANGE.x, y: AXE_RANGE.y }); this.solids.push({ x: AXE_RANGE.x, y: AXE_RANGE.y - 10, r: 50 }); }
    // villagers
    this.npcs = WORLD_NPCS.map(d => ({ d, x: d.x, y: d.y, tx: d.x, ty: d.y, wait: rand(0.5, 3), t: rand(0, 9), face: 1, talk: 0, moving: false, img: null }));
    // roaming enemies
    this.skirm = SKIRMISHES.map(d => ({ d, x: d.x, y: d.y, tx: d.x, ty: d.y, wait: rand(0, 2), t: rand(0, 9), chase: false, face: 1 }));
    if (this.buildVillage) this.buildVillage(R);
    this.makeFootprints();
    // overview (minimap + big map) prerender
    this.overview = this.renderOverview(520, 320);
    this.overviewBig = this.renderOverview(1560, 960);
    this.cloudShadows = Array.from({ length: 6 }, () => ({ x: rand(0, WORLD.w), y: rand(0, WORLD.h), s: rand(900, 1500), v: rand(18, 30) }));
    this.built = true;
  }

  // villagers: recolored rig parts of the Eric-shaped sprites (sven = front layout, smuggler = 3/4 layout)
  npcRig(n) {
    if (n.rig !== undefined) return n.rig;
    const d = n.d;
    if (G.img['npc_' + d.id] || !d.body) return (n.rig = null);
    const base = d.body[0] === 'sven' ? 'sven_front' : d.body[0] === 'smuggler' ? 'smuggler_q34' : null;
    if (!base || !G.img['rig_' + base + '_body']) return (n.rig = null);
    const parts = {};
    for (const k of ['body', 'armL', 'armR', 'legL', 'legR']) {
      const src = G.img['rig_' + base + '_' + k], [cv, c] = _mkCv(src.width, src.height);
      c.filter = d.body[1]; c.drawImage(src, 0, 0); cv._id = 'npc' + (++_cvId); parts[k] = cv;
    }
    return (n.rig = { dir: base.endsWith('q34') ? 'q34' : 'front', parts });
  }
  npcBody(n) {
    if (n.img) return n.img;
    const d = n.d;
    if (G.img['npc_' + d.id]) return (n.img = G.img['npc_' + d.id]);   // real art, once supplied
    if (!d.body) return null;
    const src = G.img[d.body[0]]; if (!src) return null;
    const [cv, c] = _mkCv(src.width, src.height);
    c.filter = d.body[1]; c.drawImage(src, 0, 0); cv._id = 'npcb' + (++_cvId);
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
    this.e = { x: pos ? pos.x : home.ix - 40, y: pos ? pos.y : home.iy + 140, dir: 'front', flip: false, anim: 0, vx: 0, vy: 0, moving: false };
    setTimeout(() => { if (G.scene === this) this.navGrid(); }, 600);   // build the click-to-move grid off the first frames
    this.target = null; this.focus = null; this.autoArm = false; this.armT = 1.5; this.puffs = []; this.look = { x: 0, y: 0 };
    this.cam = { x: 0, y: 0 }; this.snapCam(); this.tiles = this.tiles || new Map();
    this.region = this.regionAt(this.e.x, this.e.y); this.regionT = 3.2;
    for (const s of this.skirm) { s.x = s.d.x; s.y = s.d.y; s.chase = false; }
    AudioSys.playMusic('background');
    if (!this._stamp) this._stamp = Art.makeStamp('APPROVED', '#c4271b', 420, 120);
  }
  // ---- perspective camera.  this.cam = the ground point under screen row h0 (the focus), not a corner.
  setupCam() {
    this.sinP = Math.sin(CAM3.pitch); this.cosP = Math.cos(CAM3.pitch);
    this.dist = CAM3.F / CAM3.zoom; this.H0 = H * CAM3.h0;
  }
  proj(x, y) {
    const dY = y - this.cam.y, zc = this.dist - dY * this.cosP, s = CAM3.F / zc;
    return { x: W / 2 + (x - this.cam.x) * s, y: this.H0 + CAM3.F * dY * this.sinP / zc, s };
  }
  rowDY(sy) { const a = (sy - this.H0) / CAM3.F; return a * this.dist / (this.sinP + a * this.cosP); }
  rowS(sy) { return CAM3.F / (this.dist - this.rowDY(sy) * this.cosP); }
  unproj(mx, my) { const dY = this.rowDY(my); return { x: this.cam.x + (mx - W / 2) / this.rowS(my), y: this.cam.y + dY }; }
  // visible ground rectangle in world units (wider at the far edge)
  get view() {
    const top = this.rowDY(-40), bot = this.rowDY(H + 40), hw = W / 2 / this.rowS(-40);
    return { x: this.cam.x - hw, y: this.cam.y + top, w: hw * 2, h: bot - top };
  }
  get vw() { return this.view.w; }
  get vh() { return this.view.h; }
  clampCam(x, y) {
    const hw = W / 2 / this.rowS(H) + 40;
    return [clamp(x, hw, WORLD.w - hw), clamp(y, -this.rowDY(0) - 420, WORLD.h - this.rowDY(H) + 10)];
  }
  camTarget() { return this.clampCam(this.e.x, this.e.y); }
  snapCam() { this.setupCam(); [this.cam.x, this.cam.y] = this.camTarget(); }
  // run fn in a billboard frame: world point (x, y) maps to its projected spot, scaled by depth
  bb(c, x, y, fn) {
    const p = this.proj(x, y);
    if (p.x < -900 || p.x > W + 900 || p.y < -30 || p.y > H + 1100) return;
    c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s); c.translate(-x, -y); fn(p); c.restore();
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
    for (const s of this.solids) {
      if (s.q) {   // convex footprint polygon; Eric's radius pads it a little
        if (x < s.x0 - who || x > s.x1 + who || y < s.y0 - who || y > s.y1 + who) continue;
        if (_inPoly(s.q, x, y, who * 0.75)) return true;
        continue;
      }
      if (s.seg) {   // fence/wall run: a capsule along the segment
        const [ax, ay, bx, by] = s.seg, vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
        const dx = x - ax - vx * t, dy = y - ay - vy * t, rr2 = s.r + who * 0.8;
        if (dx * dx + dy * dy < rr2 * rr2) return true;
        continue;
      }
      const dx = x - s.x, dy = (y - s.y) * 1.5; if (dx * dx + dy * dy < (s.r + who) * (s.r + who)) return true;
    }
    return false;
  }
  tryMove(o, dx, dy, who) {
    if (this.blocked(o.x, o.y, who)) { o.x += dx; o.y += dy; return true; }   // stuck inside something (spawn, resized prop): let them walk out
    if (!this.blocked(o.x + dx, o.y + dy, who)) { o.x += dx; o.y += dy; return true; }
    for (const a of [0.52, -0.52, 1.05, -1.05]) {
      const c = Math.cos(a), sn = Math.sin(a), nx = (dx * c - dy * sn) * c, ny = (dx * sn + dy * c) * c;
      if (!this.blocked(o.x + nx, o.y + ny, who)) { o.x += nx; o.y += ny; return true; }
    }
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
    if (this.sqiActive()) out.push({ x: DRAGON_RIDGE.ix, y: DRAGON_RIDGE.iy, label: 'Resolve', sub: "The dragon's SQI", act: () => this.resolveSqi() });
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
      this.convo = { npc: p, t: 0, out: 0 };
      await Dialog.play(lines);
    } finally { Game.busy = false; if (this.convo) this.convo.out = 1e-3; }
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
  sqiActive() { const q = Game.save.q; return !!(q && q.given && DISPATCH[q.d] && DISPATCH[q.d].id === 'sqi' && !Game.save.sqiDone); }
  async resolveSqi() {
    if (Game.busy) return; Game.busy = true;
    try {
      await Dialog.play([{ s: 'eric', m: 'calm', t: 'Right. Scorch marks, claw marks, one very angry Service Quality Inquiry nailed to a tree.' }, { s: 'eric', m: 'shout', t: 'WHERE IS THE COMPLAINANT?' }]);
      AudioSys.sfx('roar'); AudioSys.sfx('thunder'); shake(18);
      await wait(0.8);
      await Cutscene.play('dragon');
      Game.save.sqiDone = true; this.saveP(); Game.persist();
      await Dialog.play([{ s: 'eric', m: 'smirk', t: 'SQI resolved. Root cause: customer was a dragon. Corrective action: also axes.' }]);
      AudioSys.sting('victory');
      await Notice.show('SQI Closed', [{ text: 'Report back to Darrell at the Drunken Goat', color: '#ffd76a' }]);
    } finally { Game.busy = false; }
  }
  drawRidge(c, ground) {
    const r = DRAGON_RIDGE, act = this.sqiActive(), done = Game.save.sqiDone, v = this.view;
    if (r.x < v.x - 400 || r.x > v.x + v.w + 400 || r.y < v.y - 400 || r.y > v.y + v.h + 400) return;
    if (!ground) {   // the standing part: the SQI nailed to a post
      c.fillStyle = '#3a2412'; c.fillRect(r.x + 90, r.y - 120, 10, 120);
      const sh = G.img._invoice;
      if (sh) { c.save(); c.translate(r.x + 95, r.y - 100); c.rotate(Math.sin(this.t * 1.5) * 0.04 + 0.08); c.drawImage(sh, -32, -6, 64, 80); c.restore(); }
      txt(c, done ? 'SQI CLOSED' : 'SQI', r.x + 95, r.y - 130, { size: 22, fam: F.head, weight: 900, align: 'center', color: done ? '#9cf08a' : '#ff6a3a', stroke: 'rgba(0,0,0,0.85)' });
      if (act && Math.random() < 0.3) { const q = this.proj(r.x + rand(-80, 80), r.y + rand(-20, 20)); Particles.spawn('smoke', q.x, q.y, 1, { color: 'rgba(60,55,50,0.8)', speed: 40, speedMin: 10, g: -60, life: 2.5, size: 18, layer: 'back' }); }
      return;
    }
    // scorched clearing
    const g = c.createRadialGradient(r.x, r.y, 10, r.x, r.y, 230);
    g.addColorStop(0, 'rgba(20,12,8,0.9)'); g.addColorStop(0.55, 'rgba(45,30,18,0.65)'); g.addColorStop(1, 'rgba(45,30,18,0)');
    c.save(); c.translate(r.x, r.y); c.scale(1, 0.55); c.translate(-r.x, -r.y); c.fillStyle = g; c.beginPath(); c.arc(r.x, r.y, 230, 0, TAU); c.fill(); c.restore();
    // claw gouges
    c.save(); c.strokeStyle = 'rgba(10,6,4,0.8)'; c.lineWidth = 7; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(r.x - 90 + i * 26, r.y - 40); c.quadraticCurveTo(r.x - 60 + i * 26, r.y, r.x - 20 + i * 26, r.y + 40); c.stroke(); }
    c.restore();
    // embers
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr2 = 40 + (i * 37) % 130, ex = r.x + Math.cos(a) * rr2, ey = r.y + Math.sin(a) * rr2 * 0.5;
      const p = 0.5 + Math.sin(this.t * 3 + i) * 0.5;
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(glowSprite(`rgba(255,${100 + p * 60},30,${0.3 + p * 0.4})`), ex - 18, ey - 18, 36, 36); c.restore();
    }
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
      const cp = this.proj(cch.x, cch.y); Particles.spawn('glow', cp.x, cp.y - 20 * cp.s, 20, { color: 'rgba(255,210,110,0.9)', speed: 260, g: -200, life: 1, layer: 'front' });
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
  // the interactable under the mouse (screen-space: its body, not its feet), nearest the cursor wins
  pickAt(mx, my) {
    let best = null, bd = 1e9;
    for (const it of this.interactables()) if (it.act) {
      const q = this.proj(it.x, it.y), hh = (it.npc ? ERIC_H * (it.npc.d.scale || 1) : 200) * q.s, hw = Math.max(34, 60 * q.s);
      if (Math.abs(mx - q.x) < hw && my > q.y - hh * 1.05 && my < q.y + 26 * q.s) {
        const d = Math.hypot(mx - q.x, my - (q.y - hh * 0.5)); if (d < bd) { bd = d; best = it; }
      }
    }
    return best;
  }
  // ---- walk grid for click-to-move (rebuilt when the gate/bridge opens or solids change)
  navGrid() {
    const key = this.gateOpen() + '|' + this.cleared('bridge') + '|' + this.solids.length;
    if (this._nav && this._nav.key === key) return this._nav;
    const C = 32, nx = Math.ceil(WORLD.w / C), ny = Math.ceil(WORLD.h / C), b = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) b[j * nx + i] = this.blocked(i * C + C / 2, j * C + C / 2, ERIC_R + 1) ? 1 : 0;
    return (this._nav = { key, C, nx, ny, b });
  }
  clearLine(ax, ay, bx, by, who = ERIC_R + 1) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
    for (let k = 1; k <= n; k++) { const t = k / n; if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t, who)) return false; }
    return true;
  }
  // A* on the grid, then string-pulled into a few straight legs. Returns [[x,y],...] ending at the goal (or the nearest
  // walkable spot to it), or null when there's no way there.
  findPath(sx, sy, gx, gy) {
    if (this.clearLine(sx, sy, gx, gy)) return [[gx, gy]];
    const { C, nx, ny, b } = this.navGrid();
    const ci = x => clamp(Math.floor(x / C), 0, nx - 1), cj = y => clamp(Math.floor(y / C), 0, ny - 1);
    const nearFree = (i0, j0, px, py) => {   // nearest walkable cell to (i0,j0), ties broken toward (px,py)
      let best = -1, bd = 1e9;
      for (let r = 1; r < 14 && best < 0; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny || b[j * nx + i]) continue;
        const d = (i - i0) ** 2 + (j - j0) ** 2 + 0.002 * ((i * C - px) ** 2 + (j * C - py) ** 2) / (C * C);
        if (d < bd) { bd = d; best = j * nx + i; }
      }
      return best;
    };
    // Eric may stand in a padded edge or a tiny pocket: cells right around him stay passable, but only ones he can really
    // walk straight to (or any of them when he's actually stuck inside something) - never through a fence or wall
    const si = ci(sx), sj = cj(sy), s0 = sj * nx + si, stuck = this.blocked(sx, sy, ERIC_R), memo = new Map();
    const openNear = k => { if (stuck) return true; if (!memo.has(k)) memo.set(k, this.clearLine(sx, sy, (k % nx) * C + C / 2, ((k / nx) | 0) * C + C / 2, ERIC_R - 3)); return memo.get(k); };
    let gi = ci(gx), gj = cj(gy);
    if (b[gj * nx + gi]) {   // clicked on a house/water: aim for the nearest free cell (prefer the side facing Eric)
      const best = nearFree(gi, gj, sx, sy);
      if (best < 0) return null;
      gi = best % nx; gj = (best / nx) | 0; gx = gi * C + C / 2; gy = gj * C + C / 2;
    }
    const g0 = gj * nx + gi, N = nx * ny;
    const g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    const heap = [], f = new Float32Array(N);
    const hfn = k => { const dx = Math.abs(k % nx - gi), dy = Math.abs(((k / nx) | 0) - gj); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    const push = k => { heap.push(k); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[k]) break; heap[i] = heap[p]; i = p; } heap[i] = k; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; const fm = () => f[m === i ? last : heap[m]]; if (l < heap.length && f[heap[l]] < fm()) m = l; if (r < heap.length && f[heap[r]] < fm()) m = r; if (m === i) break; heap[i] = heap[m]; i = m; } heap[i] = last; } return top; };
    g[s0] = 0; f[s0] = hfn(s0); push(s0);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    // thin things (lanterns, posts) can sit between two cell centres: test the point half-way along each step too
    const NX2 = nx * 2, mid = this._navMid && this._navMid.key === this._nav.key ? this._navMid.m : (this._navMid = { key: this._nav.key, m: new Uint8Array(N * 4) }).m;
    const midOk = (i, j, di, dj) => { const h = (2 * j + 1 + dj) * NX2 + 2 * i + 1 + di; if (!mid[h]) mid[h] = this.blocked((i + 0.5 + di / 2) * C, (j + 0.5 + dj / 2) * C, ERIC_R + 1) ? 2 : 1; return mid[h] === 1; };
    let found = false, steps = 0;
    while (heap.length && steps++ < 40000) {
      const k = pop(); if (shut[k]) continue; shut[k] = 1;
      if (k === g0) { found = true; break; }
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, w] of D) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const kk = jj * nx + ii, near = b[kk] && Math.abs(ii - si) <= 3 && Math.abs(jj - sj) <= 3 && openNear(kk);
        if (shut[kk] || (b[kk] && !near)) continue;
        if (di && dj && !near && (b[j * nx + ii] || b[jj * nx + i])) continue;   // no cutting corners
        if (!b[k] && !b[kk] && !midOk(i, j, di, dj)) continue;
        const ng = g[k] + w * (b[kk] ? 4 : 1); if (ng < g[kk]) { g[kk] = ng; from[kk] = k; f[kk] = ng + hfn(kk); push(kk); }
      }
    }
    if (!found) return null;
    const raw = []; for (let k = g0; k !== s0 && k >= 0; k = from[k]) raw.push([(k % nx) * C + C / 2, ((k / nx) | 0) * C + C / 2]);
    raw.reverse(); raw[raw.length - 1] = [gx, gy];
    // string-pull: from each anchor jump to the farthest point still in a straight clear line
    const out = []; let ax = sx, ay = sy, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1; while (j > i && !this.clearLine(ax, ay, raw[j][0], raw[j][1])) j--;
      out.push(raw[j]); [ax, ay] = raw[j]; i = j + 1;
    }
    return out;
  }
  hudHit(m) {
    return inRect(m, 0, 0, 640, 230) || inRect(m, W - 660, 0, 660, 320) || inRect(m, W - 380, H - 270, 380, 270);
  }
  update(dt) {
    this.t += dt;
    const e = this.e;
    for (const p of this.puffs) p.t += dt; this.puffs = this.puffs.filter(p => p.t < 0.7);
    for (const cl of this.cloudShadows) { cl.x += cl.v * dt; if (cl.x > WORLD.w + cl.s) { cl.x = -cl.s; cl.y = rand(0, WORLD.h); } }
    if (Math.random() < dt * 4) Particles.ambient('glow', { x: 0, y: H, w: W, h: 10 }, { vy: rand(-40, -15), color: 'rgba(255,190,110,0.7)', size: 3, sizeMin: 1, life: rand(5, 9), layer: 'front' });
    const busy = G.overlay || Game.busy || this.pack || this.menu || G.fade.a > 0.05;
    // villagers + roaming enemies live even when we don't control Eric
    this.updateNpcs(dt, busy);
    this.updateSkirm(dt, busy);
    if (this.updateLife) this.updateLife(dt, busy);
    // pre-paint one ground tile per frame around the view so walking never hitches on a fresh tile
    if (this.tiles && this.view) {
      const v = this.view, T = CAM3.tile, m = T;
      outer: for (let ty = Math.floor((v.y - m) / T); ty * T < v.y + v.h + m; ty++)
        for (let tx = Math.floor((v.x - m) / T); tx * T < v.x + v.w + m; tx++)
          if (!this.tiles.has(tx + ',' + ty)) { this.tile(tx, ty); break outer; }
    }
    if (this.regionT > 0) this.regionT -= dt;
    if (busy) { e.moving = false; return; }
    if (this.bigmap) { this.updateBigMap(); return; }

    // ---- input → velocity
    let vx = (G.keys.KeyD || G.keys.ArrowRight ? 1 : 0) - (G.keys.KeyA || G.keys.ArrowLeft ? 1 : 0);
    let vy = (G.keys.KeyS || G.keys.ArrowDown ? 1 : 0) - (G.keys.KeyW || G.keys.ArrowUp ? 1 : 0);
    const wm = this.unproj(G.mouse.x, G.mouse.y);
    this.hover = this.hudHit(G.mouse) ? null : this.pickAt(G.mouse.x, G.mouse.y);
    if (G.canvas || document.querySelector('canvas')) (G.canvas || document.querySelector('canvas')).style.cursor = this.hover ? 'pointer' : 'default';
    if (vx || vy) this.target = null;
    else if ((G.mouse.clicked || (G.mouse.down && this.target)) && !this.hudHit(G.mouse)) {
      // clicking an interactable walks to it (around obstacles) and uses it on arrival; holding the button steers
      const hit = G.mouse.clicked ? this.hover : (this.target ? this.target.use : null);
      const gx = hit ? hit.x : wm.x, gy = hit ? hit.y + 30 : wm.y, tg = this.target;
      if (G.mouse.clicked || !tg || (!hit && Math.hypot(gx - tg.x, gy - tg.y) > 48 && this.t - tg.at > 0.18)) {
        this.target = { x: gx, y: gy, use: hit, at: this.t, path: this.findPath(e.x, e.y, gx, gy) };
        if (this.target.path && !hit) { const l = this.target.path[this.target.path.length - 1]; this.target.x = l[0]; this.target.y = l[1]; }
      }
      if (G.mouse.clicked) AudioSys.sfx('blip');
    }
    if (this.target) {
      const tg = this.target, pth = tg.path;
      while (pth && pth.length > 1 && Math.hypot(pth[0][0] - e.x, pth[0][1] - e.y) < 28) pth.shift();
      const d = Math.hypot(tg.x - e.x, tg.y - e.y), last = pth && pth.length === 1;
      // watchdog: no real progress for 0.7 s -> re-plan once, then stop instead of grinding against a wall
      if (tg.best == null || d < tg.best - 6) { tg.best = d; tg.stall = 0; } else if ((tg.stall = (tg.stall || 0) + dt) > 0.7) {
        if (!tg.replanned) { tg.replanned = true; tg.stall = 0; tg.best = d; tg.path = this.findPath(e.x, e.y, tg.x, tg.y); }
        else if (!tg.use || d > 140) { this.target = null; e.vx *= 0.3; e.vy *= 0.3; }
      }
      if (d < (tg.use ? 90 : 12) || (tg.use && last && Math.hypot(pth[0][0] - e.x, pth[0][1] - e.y) < 14)) {
        const u = tg.use; this.target = null;
        if (u) { u.act(); return; }
      } else {
        const [wx, wy] = pth && pth.length ? pth[0] : [tg.x, tg.y], dx = wx - e.x, dy = wy - e.y, dd = Math.hypot(dx, dy) || 1;
        vx = dx / dd; vy = dy / dd;
      }
    }
    const len = Math.hypot(vx, vy), run = !!(G.keys.ShiftLeft || G.keys.ShiftRight);
    if (len > 0) { vx /= len; vy /= len; }
    const want = len > 0 ? WALK * (run ? 1.5 : 1) : 0, k = Math.min(1, dt * (len > 0 ? 12 : 16));
    e.vx = lerp(e.vx || 0, vx * want, k); e.vy = lerp(e.vy || 0, vy * want, k);
    const spd = Math.hypot(e.vx, e.vy);
    e.moving = false; e.run = run && spd > WALK * 1.1;
    if (spd > 25) {
      const moved = this.tryMove(e, e.vx * dt, e.vy * dt);
      if (!moved) {
        const tg = this.target;
        if (tg && !tg.retried) { tg.retried = true; tg.path = this.findPath(e.x, e.y, tg.x, tg.y); }   // nudged off the path: re-plan once
        else if (tg) this.target = null;
        e.vx *= 0.3; e.vy *= 0.3;
      }
      e.moving = moved;
      const ax = Math.abs(e.vx), ay = Math.abs(e.vy);
      if (e.dir === 'side' ? ax > ay * 0.75 : ax > ay * 1.3) { e.dir = 'side'; e.flip = e.vx < 0; }
      else e.dir = e.vy < 0 ? 'back' : 'front';
      if (moved) {
        const prev = e.anim || 0;
        e.anim = prev + dt * spd / (ERIC_H * (run ? 1.35 : 1.05));      // one filmed cycle (two steps) per stride
        if (Math.floor(e.anim * 2) !== Math.floor(prev * 2)) {
          AudioSys.sfx('step', { x: this.proj(e.x, e.y).x });
          this.puffs.push({ x: e.x + (Math.floor(e.anim * 2) % 2 ? 9 : -9), y: e.y - 2, t: 0, big: e.run });
        }
      }
    }
    // camera: leads a little in the walking direction, eases smoothly
    this.look = this.look || { x: 0, y: 0 };
    this.look.x = lerp(this.look.x, (e.vx || 0) * 0.32, Math.min(1, dt * 2)); this.look.y = lerp(this.look.y, (e.vy || 0) * 0.22, Math.min(1, dt * 2));
    const [lx, ly] = this.clampCam(e.x + this.look.x, e.y + this.look.y);
    this.cam.x += (lx - this.cam.x) * Math.min(1, dt * 4); this.cam.y += (ly - this.cam.y) * Math.min(1, dt * 4);
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
      if (n.bubble) { n.bubble.t -= dt; if (n.bubble.t <= 0) n.bubble = null; }
      if (n.d.barks && !busy && dE < 330 && (!n.lastBark || n.t - n.lastBark > 30) && !this.npcs.some(o => o.bubble && o !== n)) {
        n.lastBark = n.t; n.barkI = (n.barkI === undefined ? -1 : n.barkI) + 1;
        n.bubble = { text: n.d.barks[n.barkI % n.d.barks.length], t: 4.5 };
        AudioSys.sfx('blip', { x: this.proj(n.x, n.y).x });
      }
      if (dE < 200 || busy || !n.d.wander) { if (dE < 300 && !n.d.maiden) n.face = this.e.x < n.x ? -1 : 1; continue; }
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
      if (s.chase && !was) { AudioSys.sfx('growl', { x: this.proj(s.x, s.y).x }); s.alert = 1; }
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
  // ---- ground.  Static terrain is baked once into world-space tiles; each frame the visible tiles plus the
  // animated / moving bits (water, shadows, dust) are composed flat, then projected onto the tilted plane.
  tile(tx, ty) {
    const k = tx + ',' + ty; let t = this.tiles.get(k); if (t) return t;
    const T = CAM3.tile, [cv, c] = _mkCv(T, T);
    c.translate(-tx * T, -ty * T);
    this.paintStatic(c, { x: tx * T, y: ty * T, w: T, h: T });
    this.tiles.set(k, cv); return cv;
  }
  paintStatic(c, v) {
    c.fillStyle = this.grassPat; c.fillRect(v.x, v.y, v.w, v.h);
    c.save(); c.globalAlpha = 0.85; c.imageSmoothingEnabled = true; c.drawImage(this.varCv, 0, 0, WORLD.w, WORLD.h); c.restore();
    // beyond the world edge: open sea to the west/east, deep forest floor north/south
    if (v.x < 0 || v.x + v.w > WORLD.w || v.y < 0 || v.y + v.h > WORLD.h) {
      c.fillStyle = 'rgba(14,30,10,0.55)';
      if (v.y < 0) c.fillRect(v.x, v.y, v.w, -v.y);
      if (v.y + v.h > WORLD.h) c.fillRect(v.x, WORLD.h, v.w, v.y + v.h - WORLD.h);
      c.fillStyle = this.waterPat;
      if (v.x < 0) c.fillRect(v.x, v.y, -v.x, v.h);
      if (v.x + v.w > WORLD.w) c.fillRect(WORLD.w, v.y, v.x + v.w - WORLD.w, v.h);
    }
    if (this.paintVillage) this.paintVillage(c, v, 'under');
    // shores & water
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of this.waterPaths) { c.lineWidth = 150; c.strokeStyle = 'rgba(70,90,30,0.18)'; c.stroke(p); c.lineWidth = 120; c.strokeStyle = this.sandPat; c.stroke(p); }
    for (const p of this.waterPaths) {
      c.fillStyle = this.waterPat; c.fill(p);
      c.save(); c.clip(p); c.lineWidth = 70; c.strokeStyle = 'rgba(110,190,190,0.35)'; c.stroke(p); c.restore();
    }
    // roads (town streets get cobbled by paintVillage)
    c.lineWidth = 96; c.strokeStyle = 'rgba(55,60,25,0.35)'; c.stroke(this.roadPath);
    c.lineWidth = 80; c.strokeStyle = this.dirtPat; c.stroke(this.roadPath);
    c.lineWidth = 34; c.strokeStyle = 'rgba(255,225,170,0.10)'; c.stroke(this.roadPath);
    c.setLineDash([2, 22]); c.lineWidth = 6; c.strokeStyle = 'rgba(70,50,30,0.35)';
    c.save(); c.translate(-14, 0); c.stroke(this.roadPath); c.translate(28, 0); c.stroke(this.roadPath); c.restore(); c.setLineDash([]);
    if (this.paintVillage) this.paintVillage(c, v, 'over');
    // decals
    for (const d of this.decals) {
      if (d.x < v.x - 40 || d.x > v.x + v.w + 40 || d.y < v.y - 10 || d.y > v.y + v.h + 70) continue;
      if (d.t === 'tuft') {
        c.strokeStyle = d.dark ? 'rgba(38,70,22,0.75)' : 'rgba(150,190,80,0.7)'; c.lineWidth = 2; c.lineCap = 'round';
        const sw = Math.sin(d.seed) * 2;
        for (let i = -2; i <= 2; i++) { const hh = (9 + Math.abs((d.seed * (i + 3)) % 7)) * d.s; c.beginPath(); c.moveTo(d.x + i * 3 * d.s, d.y); c.quadraticCurveTo(d.x + i * 4 * d.s, d.y - hh * 0.6, d.x + i * 6 * d.s + sw, d.y - hh); c.stroke(); }
        continue;
      }
      if (d.t === 'reed') {
        const sw = Math.sin(d.seed) * 3;
        c.lineCap = 'round';
        for (let i = -3; i <= 3; i++) {
          const hh = (34 + (d.seed * (i + 5)) % 24) * d.s, tx = d.x + i * 4 + sw * (hh / 50) + i * 2;
          c.strokeStyle = i % 2 ? 'rgba(46,82,32,0.95)' : 'rgba(84,120,48,0.95)'; c.lineWidth = 2.4;
          c.beginPath(); c.moveTo(d.x + i * 3, d.y); c.quadraticCurveTo(d.x + i * 3.5, d.y - hh * 0.5, tx, d.y - hh); c.stroke();
          if ((i + 3) % 3 === 0) { c.fillStyle = '#5a3a1e'; c.beginPath(); c.ellipse(tx, d.y - hh + 6, 2.6, 7, 0, 0, TAU); c.fill(); }
        }
        continue;
      }
      if (d.t === 'flower') { c.fillStyle = d.c; c.beginPath(); c.arc(d.x, d.y, d.s, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,240,150,0.9)'; c.beginPath(); c.arc(d.x, d.y, d.s * 0.35, 0, TAU); c.fill(); }
      else { c.fillStyle = 'rgba(40,40,35,0.35)'; c.beginPath(); c.ellipse(d.x + 2, d.y + 3, d.s * 2.4, d.s * 1.3, 0, 0, TAU); c.fill(); c.fillStyle = '#8f8a7e'; c.beginPath(); c.ellipse(d.x, d.y, d.s * 2.2, d.s * 1.4, 0, 0, TAU); c.fill(); }
    }
  }
  // compose the flat ground for this frame (world coords) into this.gcv
  groundLayer() {
    const v = this.view, x0 = Math.floor(v.x), y0 = Math.floor(v.y), gw = Math.ceil(v.w) + 4, gh = Math.ceil(v.h) + 4;
    const gs = CAM3.gs, cw = Math.ceil(gw * gs), ch = Math.ceil(gh * gs);
    if (!this.gcv || this.gcv.width < cw || this.gcv.height < ch) [this.gcv, this.gctx] = _mkCv(Math.max(cw, this.gcv ? this.gcv.width : 0), Math.max(ch, this.gcv ? this.gcv.height : 0));
    const c = this.gctx, T = CAM3.tile;
    c.setTransform(gs, 0, 0, gs, -x0 * gs, -y0 * gs);
    for (let ty = Math.floor(y0 / T); ty * T < y0 + gh; ty++) for (let tx = Math.floor(x0 / T); tx * T < x0 + gw; tx++) c.drawImage(this.tile(tx, ty), tx * T, ty * T);
    // living water: drifting foam line along the shore and glints
    for (const p of this.waterPaths) {
      c.save(); c.clip(p);
      c.setLineDash([28, 46]); c.lineDashOffset = -this.t * 18; c.lineWidth = 8; c.strokeStyle = 'rgba(235,250,245,0.45)'; c.stroke(p); c.setLineDash([]);
      c.strokeStyle = 'rgba(220,245,255,0.3)'; c.lineWidth = 3;
      for (let gx = Math.floor(v.x / 160) * 160; gx < v.x + v.w + 160; gx += 160) for (let gy = Math.floor(v.y / 110) * 110; gy < v.y + v.h + 110; gy += 110) {
        const h = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453, f = h - Math.floor(h), a = Math.sin(this.t * 0.8 + f * TAU);
        if (a < 0.2) continue;
        const ox = gx + f * 120 + Math.sin(this.t * 0.4 + f * 9) * 20, oy = gy + (f * 7 % 1) * 80;
        c.globalAlpha = (a - 0.2) * 0.9; c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + 18, oy - 5, ox + 36, oy); c.stroke();
      }
      c.globalAlpha = 1; c.restore();
    }
    for (const sp of this.sprites) if (sp.ground) this.drawProp(c, sp);
    if (!this.cleared('bridge')) { // toll chain across the deck
      const d = BRIDGE_DECK;
      c.save(); c.strokeStyle = 'rgba(40,30,20,0.9)'; c.lineWidth = 6; c.setLineDash([10, 6]);
      c.beginPath(); c.moveTo(d.x + 60, d.y + 10); c.quadraticCurveTo(d.x + 70, d.y + 70, d.x + 60, d.y + d.h); c.stroke(); c.restore();
    }
    this.drawRidge(c, true);
    if (this.drawLifeGround) this.drawLifeGround(c, v);
    // cast shadows (light from the upper left) for everything standing up
    const inV = (x, y, m = 400) => x > v.x - m && x < v.x + v.w + m && y > v.y - 60 && y < v.y + v.h + m;
    for (const sp of this.sprites) {
      if (sp.ground || sp.kind === 'range' || sp.noShadow || !inV(sp.x, sp.y)) continue;
      const img = this.pimg(sp); if (!img) continue;
      this.castShadow(c, img, sp.x, sp.y, img.width * sp.h / img.height, sp.h, !!sp.flip, sp.tree ? 0.24 : 0.18);
    }
    { const f = this.ericFrame(); if (f) { c.save(); c.globalAlpha = 0.24; c.translate(this.e.x, this.e.y); c.transform(1, 0, -0.62, -0.36, 0, 0); this.blitFrame(c, f, ERIC_H, true); c.restore(); } }
    for (const n of this.npcs) { const im = this.npcBody(n); if (im && inV(n.x, n.y)) { const h = ERIC_H * (n.d.scale || 1); this.castShadow(c, im, n.x, n.y, im.width * h / im.height, h, false, 0.24); } }
    // footstep dust
    for (const p of this.puffs) {
      const a = 1 - p.t / 0.7; if (a <= 0) continue;
      c.fillStyle = `rgba(150,130,95,${(p.big ? 0.32 : 0.16) * a})`; c.beginPath(); c.ellipse(p.x, p.y, 8 + p.t * (p.big ? 46 : 28), 4 + p.t * (p.big ? 16 : 10), 0, 0, TAU); c.fill();
    }
    // cloud shadows drifting over the land
    c.save(); c.globalCompositeOperation = 'multiply';
    for (const cl of this.cloudShadows) {
      if (!inV(cl.x, cl.y, cl.s)) continue;
      c.globalAlpha = 0.22; c.drawImage(glowSprite('rgba(60,70,90,0.9)'), cl.x - cl.s, cl.y - cl.s * 0.4, cl.s * 2, cl.s * 0.8);
    }
    c.restore();
    // click-to-move target ring
    if (this.target && !this.target.use) {
      c.save(); c.strokeStyle = 'rgba(255,220,140,0.85)'; c.lineWidth = 4; const r = 18 + Math.sin(this.t * 8) * 3;
      c.beginPath(); c.ellipse(this.target.x, this.target.y, r, r * 0.55, 0, 0, TAU); c.stroke(); c.restore();
    }
    // a soft gold ring under Eric (strategy-RPG style) so he's easy to find in a busy street
    { const e = this.e; c.save(); c.strokeStyle = 'rgba(255,214,120,0.75)'; c.lineWidth = 3.5;
      c.beginPath(); c.ellipse(e.x, e.y + 2, 25, 11, 0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,214,120,0.25)'; c.lineWidth = 8; c.stroke(); c.restore(); }
    // the planned route as a faint dotted trail, and a ring under whatever the mouse is pointing at
    if (this.target && this.target.path && this.target.path.length) {
      c.save(); c.fillStyle = 'rgba(255,225,160,0.55)';
      let ax = this.e.x, ay = this.e.y, ph = (this.t * 60) % 26;
      for (const [bx, by] of this.target.path) {
        const d = Math.hypot(bx - ax, by - ay);
        for (let u = ph; u < d - 10; u += 26) { const t = u / d; c.beginPath(); c.ellipse(ax + (bx - ax) * t, ay + (by - ay) * t, 4, 2.4, 0, 0, TAU); c.fill(); }
        ph = 0; ax = bx; ay = by;
      }
      c.restore();
    }
    const hv = this.hover || (this.target && this.target.use);
    if (hv) {
      const r = (hv.npc ? 44 : 60) + Math.sin(this.t * 5) * 3;
      c.save(); c.strokeStyle = hv.battle ? 'rgba(255,110,70,0.9)' : 'rgba(255,225,150,0.9)'; c.lineWidth = 4;
      c.beginPath(); c.ellipse(hv.x, hv.y, r, r * 0.5, 0, 0, TAU); c.stroke(); c.restore();
    }
    return { x0, y0 };
  }
  // project the flat ground onto the screen, one thin row band at a time
  projectGround(c, g) {
    const st = CAM3.strip, gs = CAM3.gs;
    for (let sy = -st; sy < H + st; sy += st) {
      const a = this.rowDY(sy), b = this.rowDY(sy + st), hw = W / 2 / this.rowS(sy + st / 2);
      c.drawImage(this.gcv, (this.cam.x - hw - g.x0) * gs, (this.cam.y + a - g.y0) * gs, hw * 2 * gs, (b - a) * gs, 0, sy, W, st + 0.75);
    }
  }
  drawShadow(c, x, y, w, a = 0.42) {
    c.save(); c.globalAlpha = a; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(x, y, w, w * 0.32, 0, 0, TAU); c.fill(); c.restore();
  }
  // Ground footprint of a standing sprite, read from its art: the lowest opaque pixels give the left, front and right
  // corners of its base; the back corner mirrors the front (iso dioramas sit on a diamond). Mapped onto the ground plane
  // (screen-up in the art = further away / sin(pitch)), then pulled in a little so eaves and soft edges don't block.
  footprintQuad(sp) {
    const img = this.pimg(sp); if (!img || !img.width) return null;
    this._fp = this._fp || {};
    const key = sp.img + '|' + img.width + 'x' + img.height;
    let f = this._fp[key];
    if (f === undefined) {
      const cw = 96, ch = Math.max(8, Math.round(img.height * cw / img.width)), [cv, cx] = _mkCv(cw, ch);
      cx.drawImage(img, 0, 0, cw, ch);
      let d; try { d = cx.getImageData(0, 0, cw, ch).data; } catch (e) { d = null; }
      f = null;
      if (d) {
        const bot = new Array(cw).fill(-1);
        const solid = k => { const r = d[k], g = d[k + 1], b = d[k + 2]; return d[k + 3] > 170 && !(g > r * 1.04 && g > b * 1.12); };   // opaque and not grass
        for (let i = 0; i < cw; i++) for (let j = ch - 1; j >= ch * 0.35; j--) {
          const k = (j * cw + i) * 4;   // need two solid pixels stacked, so stray flowers/pebbles don't count
          if (solid(k) && j > 0 && solid(k - cw * 4)) { bot[i] = j; break; }
        }
        let li = -1, ri = -1, fi = -1;
        for (let i = 0; i < cw; i++) if (bot[i] >= 0) { if (li < 0) li = i; ri = i; if (fi < 0 || bot[i] > bot[fi]) fi = i; }
        if (li >= 0 && ri - li > 3) f = { cw, ch, L: [li, bot[li]], R: [ri, bot[ri]], F: [fi, bot[fi]] };
      }
      this._fp[key] = f;
    }
    if (!f) return null;
    const sinP = Math.sin(CAM3.pitch), s = sp.h / f.ch, fl = sp.flip ? -1 : 1;
    const W_ = ([i, j]) => [sp.x + (i - f.cw / 2) * s * fl, sp.y - (f.ch - 1 - j) * s / sinP];
    let L = W_(f.L), R = W_(f.R), F = W_(f.F);
    if (fl < 0) [L, R] = [R, L];
    const span = R[0] - L[0], front = F[1] - (L[1] + R[1]) / 2;
    let q;
    if (front < span * 0.12) {   // flat-fronted (stalls, carts): a box as deep as half its width
      const y1 = Math.max(L[1], R[1], F[1]), y0 = y1 - span * 0.62 / sinP;
      q = [[L[0], y0], [R[0], y0], [R[0], y1], [L[0], y1]];
    } else q = [L, F, R, [L[0] + R[0] - F[0], L[1] + R[1] - F[1]]];
    const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4, k = 0.8;
    q = q.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    return { q, x0: Math.min(...q.map(p => p[0])), x1: Math.max(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), y1: Math.max(...q.map(p => p[1])), fp: true };
  }
  // swap the round placeholder solids of buildings/props for footprints that match what you see
  makeFootprints() {
    const add = [];
    for (const sp of this.sprites) {
      if (sp.tree || sp.ground || sp.kind === 'range' || !sp.img || sp.h < 70) continue;
      const img = this.pimg(sp); if (!img) continue;
      const w = img.width * sp.h / img.height;
      const near = this.solids.filter(o => !o.q && !o.seg && o.r >= 12 && Math.abs(o.x - sp.x) < w * 0.5 && o.y <= sp.y + 12 && o.y >= sp.y - sp.h * 0.6);
      if (!near.length) continue;
      const fq = this.footprintQuad(sp); if (!fq) continue;
      for (const o of near) o.dead = true;
      add.push(fq);
    }
    this.solids = this.solids.filter(o => !o.dead).concat(add);
    this.dbgSolids = /[?&]solids/.test(location.search);
    this._nav = null;
  }
  pimg(sp) { return (sp.img.startsWith('w_') && G.img['b_' + sp.img.slice(2)]) || G.img[sp.img]; }
  drawProp(c, sp, fade = 1) {
    const img = this.pimg(sp); if (!img) return null;
    const s = sp.h / img.height, w = img.width * s;
    let lockTint = false;
    if (sp.kind === 'node') lockTint = !this.unlocked(sp.node);
    if (sp.tree) this.drawShadow(c, sp.x + 4, sp.y - 2, Math.min(34, w * 0.16), 0.35);   // contact shadow at the trunk
    c.save(); c.translate(sp.x, sp.y); if (fade < 1) c.globalAlpha = fade;
    if (sp.tree && sp.sway != null) { c.transform(1, 0, Math.sin(this.t * 1.2 + sp.sway) * 0.025, 1, 0, 0); }
    if (sp.flip) c.scale(-1, 1);
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
  // draws a rigged character: boots step, body bobs/leans, arms swing about the shoulders
  drawRigged(c, x, y, h, dir, parts, ph, amt, flip, t, alpha = 1) {
    const R = RIG[dir], s = h / R.h, sn = Math.sin(ph);
    const lift = 34 * amt, bob = Math.abs(sn) * 14 * amt + Math.sin(t * 2) * 2 * (1 - amt);
    c.save(); c.globalAlpha = alpha;
    c.translate(x, y); c.scale(s * (flip ? -1 : 1), s);
    if (dir === 'q34') c.rotate(0.035 * amt);                     // lean into the stride
    c.translate(-R.w / 2, -R.h);
    const leg = (k, up, rot) => {
      const [px, py] = R[k]; c.save(); c.translate(px, py - up); c.rotate(rot); c.translate(-px, -py); c.drawImage(parts[k], 0, 0); c.restore();
    };
    const st = dir === 'q34' ? 0.2 * amt : 0;
    leg('legL', Math.max(0, sn) * lift, sn * st); leg('legR', Math.max(0, -sn) * lift, -sn * st);
    const arm = k => {
      const [px, py] = R[k], side = k === 'armL' ? -1 : 1;
      const a = side * R.relax * (0.6 + 0.4 * amt) + sn * 0.17 * amt * (dir === 'q34' ? -side : 1) + Math.sin(t * 1.7 + side) * 0.015;
      c.save(); c.translate(px, py - bob); c.rotate(a); c.translate(-px, -py); c.drawImage(parts[k], 0, 0); c.restore();
    };
    if (R.far) arm(R.far);
    c.drawImage(parts.body, 0, -bob);
    for (const k of ['armL', 'armR']) if (k !== R.far) arm(k);
    c.restore();
  }
  ericParts(dir) {
    const p = {}; for (const k of ['body', 'armL', 'armR', 'legL', 'legR']) { p[k] = G.img['rig_' + dir + '_' + k]; if (!p[k]) return null; }
    return p;
  }
  castShadow(c, img, x, y, w, h, flip = false, a = 0.26) {
    const sh = tinted(img, '#000');
    c.save(); c.globalAlpha = a; c.translate(x, y); c.transform(1, 0, -0.62, -0.36, 0, 0);
    if (flip) c.scale(-1, 1);
    c.drawImage(sh, -w / 2, -h, w, h); c.restore();
  }
  // current walk-sheet frame for Eric: { img, sx, sy, flip }
  ericFrame() {
    const e = this.e, WS = typeof WALK_SHEETS !== 'undefined' ? WALK_SHEETS : null; if (!WS) return null;
    const key = e.dir === 'back' ? 'eric_up' : e.dir === 'side' ? 'eric_side' : 'eric_down';
    const sheet = G.img['walk_' + key]; let img = sheet, i = 0;
    if (e.moving) i = Math.floor((((e.anim % 1) + 1) % 1) * WS.frames[key]);
    else if (e.dir === 'side') i = SIDE_IDLE;
    else img = G.img['walk_' + key + '_idle'] || sheet;
    if (!img) return null;
    if (img !== sheet) return { img, sx: 0, sy: 0, flip: false };
    return { img, sx: (i % WS.cols) * WS.fw, sy: Math.floor(i / WS.cols) * WS.fh, flip: e.dir === 'side' && e.flip };
  }
  blitFrame(c, f, h, sil = false) {
    const WS = WALK_SHEETS, s = h / WS.body;
    c.scale(s * (f.flip ? -1 : 1), s);
    c.drawImage(sil ? tinted(f.img, '#000') : f.img, f.sx, f.sy, WS.fw, WS.fh, -WS.fw / 2, -WS.ay, WS.fw, WS.fh);
  }
  drawEric(c, alpha = 1) {
    const e = this.e, f = this.ericFrame();
    if (alpha === 1) this.drawShadow(c, e.x, e.y, 30, 0.4);
    if (f) {
      const breathe = e.moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.007;
      c.save(); c.globalAlpha = alpha; c.translate(e.x, e.y); c.scale(1, breathe); this.blitFrame(c, f, ERIC_H); c.restore();
      return;
    }
    const img = G.img.eric_front; if (!img) return;
    const w = img.width * ERIC_H / img.height; c.save(); c.globalAlpha = alpha; c.drawImage(img, e.x - w / 2, e.y - ERIC_H, w, ERIC_H); c.restore();
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
    this.drawShadow(c, n.x, n.y, 26 * (d.scale || 1), 0.4);
    const rig = this.npcRig(n);
    n.amt = lerp(n.amt || 0, n.moving ? 1 : 0, Math.min(1, G.dt * 8));
    if (rig) { this.drawRigged(c, n.x, n.y, h, rig.dir, rig.parts, n.t * (d.fast ? 13 : 8), n.amt, n.face < 0, n.t + n.d.x); return { base: n.y }; }
    const s = h / img.height, w = img.width * s, br = 1 + Math.sin(n.t * 2 + n.d.x) * 0.008;
    c.save(); c.translate(n.x, n.y); c.scale(n.face < 0 ? -1 : 1, br); c.drawImage(img, -w / 2, -h, w, h); c.restore();
    return { base: n.y };
  }
  drawSkirm(c, s) {
    const d = s.d, img = G.img[d.img]; if (!img) return;
    const h = d.h, sc = h / img.height, w = img.width * sc;
    const hop = Math.abs(Math.sin(s.t * (s.chase ? 10 : 4))) * (s.chase ? 14 : 6);
    this.drawShadow(c, s.x, s.y, w * 0.4, 0.4);
    c.save(); c.translate(s.x, s.y - hop); c.scale(s.face < 0 && d.img !== '_invoice' ? -1 : 1, 1);
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
    this.setupCam();
    const g = this.groundLayer();
    c.save(); c.translate(G.cam.sx, G.cam.sy);
    c.imageSmoothingEnabled = true;
    this.projectGround(c, g);
    // depth-sorted standing world, each thing a billboard scaled by its depth
    const list = [];
    // things standing in front of Eric (screen overlap, nearer the camera) are remembered so he can be drawn through them
    const eq = this.proj(this.e.x, this.e.y), eh = ERIC_H * eq.s, eb = { x: eq.x - eh * 0.42, y: eq.y - eh * 1.04, w: eh * 0.84, h: eh * 1.04 };
    const occ = [];
    const occTest = sp => {
      if (sp.y <= this.e.y + 2 || sp.kind === 'range') return;
      const img = this.pimg(sp); if (!img) return;
      const q = this.proj(sp.x, sp.y), h = sp.h * q.s, w = img.width * sp.h / img.height * q.s;
      if (q.x - w / 2 < eb.x + eb.w && q.x + w / 2 > eb.x && q.y - h < eb.y + eb.h && q.y > eb.y) occ.push(sp);
    };
    const fadeFor = () => 1;
    this.fadeFor = fadeFor;
    const add = (x, y, f, raw) => list.push({ x, y, f, raw });
    for (const sp of this.sprites) if (!sp.ground) occTest(sp);
    for (const sp of this.sprites) if (!sp.ground) add(sp.x, sp.y, () => sp.kind === 'range' ? this.drawRange(c, sp.x, sp.y) : sp.draw ? sp.draw(c, sp, this) : this.drawProp(c, sp, fadeFor(sp)));
    for (const n of this.npcs) add(n.x, n.y, () => this.drawNpc(c, n));
    Game.save.skirm = Game.save.skirm || {};
    for (const s of this.skirm) if (!Game.save.skirm[s.d.id] && !(s.d.need && !this.unlocked(NODE[s.d.need]))) add(s.x, s.y, () => this.drawSkirm(c, s));
    for (const id in WORLD_NODES) if (WORLD_NODES[id].mx) add(WORLD_NODES[id].mx, WORLD_NODES[id].my, () => this.drawMarker(c, id));
    for (const cch of CACHES) add(cch.x, cch.y, () => this.drawCache(c, cch));
    add(DRAGON_RIDGE.x, DRAGON_RIDGE.y, () => this.drawRidge(c, false));
    if (!this.gateOpen()) add(GATE.x + GATE.w / 2, GATE.y + GATE.h, () => this.drawGate(c));
    if (this.addLife) this.addLife(c, add);
    add(this.e.x, this.e.y, () => this.drawEric(c));
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.raw ? it.f() : this.bb(c, it.x, it.y, it.f);
    if (occ.length) this.drawOccluded(c, occ, eb);
    if (this.dbgSolids) {   // ?solids: every collision shape, projected on top of everything
      const P = (x, y) => { const q = this.proj(x, y); return [q.x, q.y]; };
      c.save(); c.lineWidth = 3;
      for (const o of this.solids) {
        if (Math.abs(o.x - this.cam.x) > 2200 && !o.q) continue;
        c.beginPath(); c.strokeStyle = o.q ? 'rgba(255,40,40,0.95)' : o.seg ? 'rgba(255,160,0,0.95)' : 'rgba(80,160,255,0.9)';
        if (o.q) { o.q.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](...P(x, y))); c.closePath(); }
        else if (o.seg) { c.moveTo(...P(o.seg[0], o.seg[1])); c.lineTo(...P(o.seg[2], o.seg[3])); }
        else for (let k = 0; k <= 16; k++) { const a = k / 16 * TAU; c[k ? 'lineTo' : 'moveTo'](...P(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r / 1.5)); }
        c.stroke();
      }
      c.restore();
    }
    if (this.drawLifeAir) this.drawLifeAir(c);
    // atmospheric depth: the far ground fades into a soft haze
    const hz = c.createLinearGradient(0, 0, 0, H * 0.42);
    hz.addColorStop(0, 'rgba(226,214,190,0.5)'); hz.addColorStop(0.45, 'rgba(226,214,190,0.16)'); hz.addColorStop(1, 'rgba(226,214,190,0)');
    c.fillStyle = hz; c.fillRect(-20, -20, W + 40, H * 0.42 + 20);
    // interaction prompts + objective chevron
    this.drawWorldUI(c);
    c.restore();
    // golden-hour grade + vignette
    const gr = c.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,190,110,0.12)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,50,90,0.16)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    Particles.draw(c, 'back');
    vignette(c, 0.36);
    if (this.convo) { this.drawConvo(c); if (this.convo && this.convo.out === 0) return; }
    this.drawHud(c);
    Particles.draw(c, 'front');
    if (this.bigmap) this.drawBigMap(c);
    if (this.pack) this.drawPack(c);
    if (this.menu) this.drawMenu(c);
  }
  // Eric behind a building/tree: redraw just the hidden part of him as a soft warm silhouette (mask = the occluders)
  drawOccluded(c, occ, eb) {
    if (!this.ericFrame()) return;
    const bx = Math.floor(eb.x - 4), by = Math.floor(eb.y - 4), bw = Math.ceil(eb.w + 8), bh = Math.ceil(eb.h + 8);
    if (!this._occCv || this._occCv.width < bw || this._occCv.height < bh) [this._occCv, this._occCx] = _mkCv(bw + 64, bh + 64);
    const o = this._occCx, cv = this._occCv;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, cv.width, cv.height);
    o.setTransform(1, 0, 0, 1, -bx, -by);
    for (const sp of occ) this.bb(o, sp.x, sp.y, () => sp.draw ? sp.draw(o, sp, this) : this.drawProp(o, sp));
    o.globalCompositeOperation = 'source-in';
    this.bb(o, this.e.x, this.e.y, () => this.drawEric(o, 0.999));
    o.setTransform(1, 0, 0, 1, 0, 0);
    // a thin bright rim around the hidden part, so he reads at a glance
    if (!this._rimCv || this._rimCv.width < cv.width || this._rimCv.height < cv.height) [this._rimCv, this._rimCx] = _mkCv(cv.width, cv.height);
    const r = this._rimCx, rc = this._rimCv;
    r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, rc.width, rc.height);
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) r.drawImage(cv, ox, oy);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = '#ffd98a'; r.fillRect(0, 0, rc.width, rc.height);
    r.globalCompositeOperation = 'destination-out'; r.drawImage(cv, 0, 0);
    o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(255,200,120,0.3)'; o.fillRect(0, 0, bw, bh);
    o.globalCompositeOperation = 'source-over';
    c.save(); c.globalAlpha = 0.72; c.drawImage(cv, 0, 0, bw, bh, bx, by, bw, bh);
    c.globalAlpha = 0.95; c.drawImage(rc, 0, 0, bw, bh, bx, by, bw, bh); c.restore();
  }
  // keep labels/bubbles readable when the camera is pulled back: grow them about their anchor (head height)
  uiScale(c, p, x, y) { const k = clamp(0.8 / p.s, 1, 1.7); c.translate(x, y); c.scale(k, k); c.translate(-x, -y); }
  // conversation stage: the village dims and Eric + the villager stand large, facing each other, above the dialogue box
  drawConvo(c) {
    const cv = this.convo, dt = 1 / 60;
    if (cv.out > 0) { cv.out += dt * 4; if (cv.out >= 1) { this.convo = null; return; } } else cv.t += dt;
    const a = Math.min(1, cv.t * 4) * (1 - cv.out), sl = Ease.outCubic(Math.min(1, cv.t * 3.5));
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(8,6,4,0.55)'; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W / 2, 830, 50, W / 2, 830, 760);
    gl.addColorStop(0, 'rgba(255,200,130,0.22)'); gl.addColorStop(1, 'rgba(255,200,130,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    const spk = G.overlay && G.overlay.line ? G.overlay.line.s : null;
    const fig = (img, x, hgt, flip, lit) => {
      if (!img) return;
      const w = img.width * hgt / img.height, y = 870;
      c.save(); c.globalAlpha = a * 0.5; c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, y - 4, w * 0.36, 22, 0, 0, TAU); c.fill(); c.restore();
      c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
      c.drawImage(img, -w / 2, -hgt, w, hgt);
      if (!lit) { c.globalAlpha = a * 0.38; c.drawImage(tinted(img, '#0b0806'), -w / 2, -hgt, w, hgt); }
      c.restore();
    };
    const n = cv.npc, nh = 700 * Math.min(1.08, n.d.scale || 1);
    fig(G.img.eric_front, 600 - (1 - sl) * 120, 700, false, spk === 'eric' || !spk);
    fig(this.npcBody(n), 1320 + (1 - sl) * 120, nh, false, spk !== 'eric');
    c.restore();
  }
  drawWorldUI(c) {
    if (Game.busy || G.overlay) return;
    // name tags for nearby villagers
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - this.e.x, n.y - this.e.y); if (d > 420 || n.d.hideTag) continue;
      this.bb(c, n.x, n.y, (p) => { this.uiScale(c, p, n.x, n.y - ERIC_H * (n.d.scale || 1));
        const a = clamp((420 - d) / 160, 0, 1), h = n.d.office ? 130 : ERIC_H * (n.d.scale || 1) + 22;
        c.globalAlpha = a;
        c.font = font(22, F.head, 700); const tw = c.measureText(n.d.name).width;
        rr(c, n.x - tw / 2 - 14, n.y - h - 30, tw + 28, 34, 17); c.fillStyle = 'rgba(12,9,6,0.72)'; c.fill();
        txt(c, n.d.name, n.x, n.y - h - 12, { size: 22, fam: F.head, weight: 700, align: 'center', base: 'middle', color: '#f0e2c4' });
      });
    }
    // shieldmaiden greetings: speech bubbles over their heads
    for (const n of this.npcs) {
      if (!n.bubble) continue;
      this.bb(c, n.x, n.y, (p) => { this.uiScale(c, p, n.x, n.y - ERIC_H * (n.d.scale || 1));
        const a = clamp(Math.min(n.bubble.t, 4.5 - n.bubble.t) * 4, 0, 1), h = ERIC_H * (n.d.scale || 1) + (this.focus && this.focus.npc === n ? 150 : 74);
        c.globalAlpha = a; c.font = font(21, F.body, 600);
        const words = n.bubble.text.split(' '), lines = []; let cur = '';
        for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > 330 && cur) { lines.push(cur); cur = w; } else cur = t; }
        lines.push(cur);
        const bw = Math.max(...lines.map(l => c.measureText(l).width)) + 36, bh = lines.length * 27 + 22, bx = n.x - bw / 2, by = n.y - h - bh - (1 - a) * 12;
        rr(c, bx, by, bw, bh, 14); c.fillStyle = 'rgba(255,248,236,0.96)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#b44a5a'; c.stroke();
        c.beginPath(); c.moveTo(n.x - 12, by + bh - 1); c.lineTo(n.x, by + bh + 16); c.lineTo(n.x + 12, by + bh - 1); c.closePath(); c.fillStyle = 'rgba(255,248,236,0.96)'; c.fill();
        lines.forEach((l, i) => txt(c, l, n.x, by + 24 + i * 27, { size: 21, fam: F.body, weight: 600, align: 'center', base: 'middle', color: '#3a1a14' }));
        txt(c, '♥', bx + bw - 6, by + 4, { size: 24, align: 'center', base: 'middle', color: '#d0405a' });
      });
    }
    // objective chevron (on-screen)
    const obj = this.objective();
    if (obj) {
      const w = WORLD_NODES[obj.id], ox = w.mx || w.ix, oy = w.my || w.iy;
      this.bb(c, ox, oy, () => {
        const b = Math.sin(this.t * 4) * 10;
        c.translate(ox, oy - 230 + b); c.fillStyle = '#ffcf6a'; c.shadowColor = 'rgba(255,170,60,0.9)'; c.shadowBlur = 18;
        c.beginPath(); c.moveTo(-22, -16); c.lineTo(0, 10); c.lineTo(22, -16); c.lineTo(12, -16); c.lineTo(0, -4); c.lineTo(-12, -16); c.closePath(); c.fill();
      });
    }
    // interaction prompt (kept at a readable size whatever the depth)
    const f = this.focus;
    if (f) {
      const q = this.proj(f.x, f.y), lift = (f.npc ? ERIC_H * (f.npc.d.scale || 1) + 70 : 180) * q.s;
      c.save(); c.translate(q.x, q.y - lift);
      const label = f.locked ? f.label : f.label + ':  ' + f.sub, sub = f.locked ? f.sub : null;
      c.font = font(26, F.head, 700); const tw = c.measureText(label).width + (f.locked ? 0 : 60);
      const bw = Math.max(tw, sub ? c.measureText(sub).width * 0.8 : 0) + 40, bh = sub ? 76 : 50;
      panel(c, -bw / 2, -bh, bw, bh, { r: 12, shadowBlur: 14 });
      if (!f.locked) {
        rr(c, -bw / 2 + 14, -bh + 9, 34, 32, 6); c.fillStyle = '#ffcf6a'; c.fill();
        txt(c, 'E', -bw / 2 + 31, -bh + 26, { size: 22, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#2a170a' });
        txt(c, label, -bw / 2 + 60, -bh + 26, { size: 26, fam: F.head, weight: 700, base: 'middle', color: '#fff1d0' });
      } else {
        txt(c, label, 0, -bh + 26, { size: 24, fam: F.head, weight: 700, align: 'center', base: 'middle', color: '#c9bca2' });
        txt(c, sub, 0, -bh + 56, { size: 20, align: 'center', base: 'middle', color: C.textDim });
      }
      c.restore();
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
      panel(c, W - 644, 222, 620, 86, { r: 10 });
      txt(c, "DARRELL'S ORDER", W - 620, 252, { size: 18, fam: F.head, weight: 900, color: C.gold, letter: 2 });
      txt(c, `${dor.title}  ${Math.min(h, n)}/${n}`, W - 620, 290, { size: 25, fam: F.head, weight: 700, color: h >= n ? '#9cf08a' : '#fff' });
    }
    if (!this.bigmap && !this.pack && !this.menu) {
      if (button(c, 'pack', W - 644, 152, 196, 58, 'Pack', { icon: Art.icon.pouch, sub: 'I', size: 24 })) this.pack = true;
      if (button(c, 'wmap', W - 436, 152, 196, 58, 'Map', { icon: Art.icon.quill, sub: 'M', size: 24 })) { this.bigmap = true; AudioSys.sfx('paper'); }
      if (button(c, 'menu', W - 228, 152, 204, 58, 'Menu', { icon: Art.icon.shield, sub: 'Esc', size: 24 })) this.menu = true;
    }
    // objective pointer at screen edge
    if (obj && !Game.busy && !G.overlay) {
      const w = WORLD_NODES[obj.id], q = this.proj(w.mx || w.ix, w.my || w.iy), ox = q.x, oy = q.y - 120 * q.s;
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
    if (this.sqiActive()) { c.fillStyle = '#ff6a3a'; c.beginPath(); c.arc(mx + DRAGON_RIDGE.x * s, my + DRAGON_RIDGE.y * (mh / WORLD.h), 5, 0, TAU); c.fill(); }
    if (Game.save.revealCaches) for (const cch of CACHES) if (!(Game.save.found || {})[cch.id]) { c.fillStyle = '#ffd76a'; c.fillRect(mx + cch.x * s - 3, my + cch.y * (mh / WORLD.h) - 3, 6, 6); }
    if (obj) { const w = WORLD_NODES[obj.id], p = 0.5 + Math.sin(this.t * 5) * 0.5; c.strokeStyle = `rgba(255,210,110,${0.5 + p * 0.5})`; c.lineWidth = 2; c.beginPath(); c.arc(mx + w.ix * s, my + w.iy * (mh / WORLD.h), 8 + p * 3, 0, TAU); c.stroke(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#c4271b'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(mx + this.e.x * s, my + this.e.y * (mh / WORLD.h), 6, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    c.beginPath(); [[0, 0], [W, 0], [W, H], [0, H]].forEach(([sx, sy], i) => { const q = this.unproj(sx, sy); c[i ? 'lineTo' : 'moveTo'](mx + clamp(q.x, 0, WORLD.w) * s, my + clamp(q.y, 0, WORLD.h) * (mh / WORLD.h)); }); c.closePath(); c.stroke();
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
    if (this.sqiActive() || Game.save.sqiDone) { const RX = ox + DRAGON_RIDGE.x * s, RY = oy + DRAGON_RIDGE.y * s; c.fillStyle = this.sqiActive() ? '#ff6a3a' : '#9cc98a'; c.beginPath(); c.arc(RX, RY, 8, 0, TAU); c.fill(); txt(c, 'Dragon Ridge', RX, RY - 14, { size: 18, fam: F.head, weight: 700, align: 'center', color: '#ffe2b0', stroke: 'rgba(0,0,0,0.8)' }); }
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
