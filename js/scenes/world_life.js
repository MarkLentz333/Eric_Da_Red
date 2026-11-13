'use strict';
// ============================================================================
//  WORLD LIFE (v3.3) — village dressing and ambient life for the overworld:
//  cobbled streets, garden plots, fences, stone walls, lanterns, bunting,
//  market stalls, haystacks, chimney smoke, plus animals that wander about
//  (chickens, sheep, pigs, a village dog, a cat, ducks, gulls, crows,
//  butterflies).  Everything here is procedural; when filmed animal clips
//  arrive (docs/ASSET_PROMPTS.txt 1e-1j) they can replace the drawn bodies.
//  Mixed into WorldScene (world.js calls these hooks if present).
// ============================================================================
const TOWN = { x: 1760, y: 1650, r: 720, plaza: 235 };
const VILLAGE = {
  // extra houses (the user's longhouse diorama), flip = mirrored for variety
  houses: [
    { x: 1385, y: 1545, h: 380, flip: false },
    { x: 1720, y: 2210, h: 370, flip: false },
    { x: 2570, y: 1395, h: 380, flip: false },
    { x: 1320, y: 1300, h: 360, flip: true },
  ],
  // garden plots (ground) with a low fence around them: x, y = top-left, w, h
  plots: [
    { x: 1440, y: 1590, w: 170, h: 110, crop: 'cabbage' },
    { x: 2150, y: 1940, w: 160, h: 100, crop: 'wheat' },
    { x: 1480, y: 2080, w: 150, h: 100, crop: 'cabbage' },
    { x: 2380, y: 2030, w: 140, h: 120, crop: 'wheat' },
  ],
  // the sheep pen
  pen: { x: 1880, y: 2410, w: 320, h: 170 },
  // pig wallow by the barn
  wallow: { x: 1470, y: 1190, rx: 80, ry: 40 },
  stalls: [   // the user's market-stall dioramas
    { x: 1590, y: 1530, img: 'stall1', h: 270, flip: false },
    { x: 1955, y: 1560, img: 'stall2', h: 270, flip: true },
  ],
  hay: [[1830, 1210], [1890, 1260], [1790, 1290]],
  forge: { x: 2560, y: 1990, h: 410 },   // the user's blacksmith diorama
  landmarks: [   // more of the user's dioramas
    { img: 'dispatch_office', x: 1060, y: 1470, h: 380, smoke: [0.56, 0.83] },   // harbor / dispatch office (Gunnhild)
    { img: 'jarls_hall', x: 2360, y: 1060, h: 540 },                             // Jarl Bjorn's longhouse
  ],
  walls: [ // low dry-stone walls along field edges
    [[1250, 2180], [1400, 2240], [1520, 2250]],
    [[2660, 2140], [2680, 2330]],
    [[1180, 1180], [1320, 1100], [1470, 1080]],
  ],
  bunting: [[[1620, 1490], [1900, 1480]], [[1560, 1760], [1960, 1800]]],
};

Object.assign(WorldScene.prototype, {
  // ------------------------------------------------------------------ build
  buildVillage(R) {
    const L = this.life = { animals: [], lamps: [], smoke: [], butter: [], gulls: [], fences: [], walls: [], bunting: [] };
    const roadDist = (x, y) => { let best = 1e9; for (const r of this.roads) for (let i = 0; i < r.length - 1; i++) best = Math.min(best, _segDist(x, y, r[i], r[i + 1])); return best; };
    this.roadDist = roadDist;
    // bigger buildings (people are ~186 tall: a house should be well over twice that)
    for (const sp of this.sprites) if (!sp.tree && sp.h > 220 && !sp.ground) { sp.h *= 1.25; sp.big = true; }
    for (const s of this.solids) if (s.r > 100) s.r *= 1.15;
    for (const sp of this.sprites) if (sp.tree) sp.h *= 1.22;
    // houses
    for (const hs of VILLAGE.houses) {
      this.sprites.push({ kind: 'prop', img: 'w_longhouse', x: hs.x, y: hs.y, h: hs.h, big: true, flip: hs.flip, smoke: [hs.flip ? 0.43 : 0.57, 0.86] });
      this.solids.push({ x: hs.x, y: hs.y - hs.h * 0.2, r: hs.h * 0.27 });
    }
    // lanterns along the town streets (every ~280 px, alternating sides)
    for (const r of this.roads) {
      let acc = 140, side = 1;
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, ay] = r[i], [bx, by] = r[i + 1], len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 10) {
          acc += 10; if (acc < 280) continue;
          const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len;
          if (Math.hypot(x - TOWN.x, y - TOWN.y) > TOWN.r + 200) continue;
          const nx = -(by - ay) / len, ny = (bx - ax) / len, px = x + nx * 62 * side, py = y + ny * 62 * side;
          if (this.blocked(px, py, 12) || roadDist(px, py) < 50 || L.lamps.some(l => Math.hypot(l.x - px, l.y - py) < 160)) continue;
          L.lamps.push({ x: px, y: py, seed: R() * 99 }); acc = 0; side = -side;
        }
      }
    }
    for (const l of L.lamps) this.solids.push({ x: l.x, y: l.y, r: 8 });
    // garden plot fences + pen fence (split into short runs so depth sorting works)
    const fence = (pts, gate) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 64));
        for (let k = 0; k < n; k++) {
          if (gate && i === gate[0] && k === gate[1]) continue;
          L.fences.push({ a: [ax + (bx - ax) * k / n, ay + (by - ay) * k / n], b: [ax + (bx - ax) * (k + 1) / n, ay + (by - ay) * (k + 1) / n], seed: R() });
        }
      }
    };
    for (const p of VILLAGE.plots) fence([[p.x - 8, p.y - 8], [p.x + p.w + 8, p.y - 8], [p.x + p.w + 8, p.y + p.h + 8], [p.x - 8, p.y + p.h + 8], [p.x - 8, p.y - 8]], [2, 1]);
    const pn = VILLAGE.pen;
    fence([[pn.x, pn.y], [pn.x + pn.w, pn.y], [pn.x + pn.w, pn.y + pn.h], [pn.x, pn.y + pn.h], [pn.x, pn.y]]);
    for (const f of L.fences) this.solids.push({ x: (f.a[0] + f.b[0]) / 2, y: (f.a[1] + f.b[1]) / 2, seg: [f.a[0], f.a[1], f.b[0], f.b[1]], r: 10, fence: true });
    for (const w of VILLAGE.walls) for (let i = 0; i < w.length - 1; i++) {
      const [ax, ay] = w[i], [bx, by] = w[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 70));
      for (let k = 0; k < n; k++) {
        const a = [ax + (bx - ax) * k / n, ay + (by - ay) * k / n], b = [ax + (bx - ax) * (k + 1) / n, ay + (by - ay) * (k + 1) / n];
        L.walls.push({ a, b, seed: R() * 999 }); this.solids.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, seg: [a[0], a[1], b[0], b[1]], r: 16 });
      }
    }
    L.bunting = VILLAGE.bunting.map(([a, b]) => ({ a, b, seed: R() * 9 }));
    for (const [a, b] of VILLAGE.bunting) { this.solids.push({ x: a[0], y: a[1], r: 8 }); this.solids.push({ x: b[0], y: b[1], r: 8 }); }
    for (const s of VILLAGE.stalls) { this.sprites.push({ kind: 'prop', img: 'w_' + s.img, x: s.x, y: s.y, h: s.h, flip: s.flip }); this.solids.push({ x: s.x, y: s.y - s.h * 0.18, r: s.h * 0.3 }); }
    for (const b of VILLAGE.landmarks) { this.sprites.push({ kind: 'prop', img: 'w_' + b.img, x: b.x, y: b.y, h: b.h, big: true, smoke: b.smoke }); this.solids.push({ x: b.x, y: b.y - b.h * 0.2, r: b.h * 0.28 }); }
    const fg = VILLAGE.forge;
    this.sprites.push({ kind: 'prop', img: 'w_blacksmith', x: fg.x, y: fg.y, h: fg.h, big: true, smoke: [0.6, 0.78] });
    this.solids.push({ x: fg.x, y: fg.y - fg.h * 0.2, r: fg.h * 0.28 });
    // a second goat-signed inn by the harbor road
    this.sprites.push({ kind: 'prop', img: 'w_goat_inn', x: 1390, y: 1960, h: 430, big: true, smoke: [0.62, 0.9] });
    this.solids.push({ x: 1390, y: 1960 - 86, r: 118 });
    for (const [x, y] of VILLAGE.hay) this.solids.push({ x, y: y - 10, r: 40 });
    // extra town clutter from the existing prop art
    const extra = [['crate_barrel', 1300, 1640, 110], ['crates', 2010, 1990, 105], ['handcart', 1700, 2010, 115], ['crate_barrel', 2440, 1450, 105],
      ['shrub', 1500, 1500, 90], ['shrub', 2200, 1790, 85], ['shrub', 1260, 1980, 95], ['shrub', 2470, 1960, 80], ['shrub', 1660, 1390, 90],
      ['bonsai', 1880, 1850, 130], ['hearth', 1690, 1420, 90], ['ladder_wood', 2660, 1440, 140], ['crates', 1120, 1680, 100], ['shrub', 1390, 2150, 80]];
    for (const [p, x, y, h] of extra) {
      if (this.blocked(x, y, 0)) continue;
      this.sprites.push({ kind: 'prop', img: 'w_' + p, x, y, h, flip: R() < 0.5 });
      this.solids.push({ x, y: y - 8, r: h * 0.28 });
    }
    // chimney smoke from the home cottage, the houses and the other buildings that have a chimney
    for (const sp of this.sprites) {
      if (sp.smoke) L.smoke.push({ sp, fx: sp.smoke[0], fy: sp.smoke[1], seed: R() * 99 });
      if (sp.kind === 'node' && sp.node.id === 'home') L.smoke.push({ sp, fx: 0.62, fy: 0.9, seed: R() * 99 });
    }
    // flower beds (ground)
    L.beds = [];
    for (const hs of VILLAGE.houses) for (let k = 0; k < 2; k++) L.beds.push({ x: hs.x + (k ? 1 : -1) * hs.h * 0.42 + (R() - 0.5) * 30, y: hs.y + 18 + R() * 20, n: 14 + Math.floor(R() * 8), seed: R() * 999 });
    // ------------------------------------------------------------ townsfolk
    // Each walker follows one road polyline back and forth (keeping to one side), pausing now and then.
    // Looks: the two filmed villagers, varied a little by size and a gentle colour shift.
    L.walkers = [];
    const looks = [['villager_man', 'none', 1.0], ['villager_woman', 'none', 0.95], ['villager_man', 'brightness(0.88) contrast(1.06)', 1.04],
      ['villager_woman', 'sepia(0.25) brightness(0.96)', 0.93], ['villager_man', 'sepia(0.35) brightness(0.92)', 0.97], ['villager_woman', 'saturate(0.8) brightness(1.05)', 0.97],
      ['villager_man', 'saturate(1.15) brightness(1.04)', 1.02], ['villager_woman', 'brightness(0.9) contrast(1.05)', 0.95]];   // no hue shifts: they tint skin too
    const routes = [0, 3, 2, 4, 0, 3, 1, 2];
    looks.slice(0, 5).forEach(([sheet, filter, sc], k) => {   // 5 strollers: room left for animals/extra life later
      const r = this.roads[routes[k] % this.roads.length];
      // only the stretch of that road inside town
      const pts = r.filter(([x, y]) => Math.hypot(x - TOWN.x, y - TOWN.y) < TOWN.r + 120);
      if (pts.length < 4) return;
      const i = Math.floor(R() * (pts.length - 1));
      L.walkers.push({ sheet, filter, sc, pts, i, f: R(), dir: R() < 0.5 ? 1 : -1, side: (R() < 0.5 ? -1 : 1) * (18 + R() * 16), x: pts[i][0], y: pts[i][1],
        anim: R(), wait: R() * 3, face: 1, moving: false, seed: R() * 99 });
    });
    // ------------------------------------------------------------ animals
    const A = (type, x, y, area, o = {}) => L.animals.push(Object.assign({ type, x, y, hx: x, hy: y, area, tx: x, ty: y, wait: R() * 3, t: R() * 9, face: R() < 0.5 ? -1 : 1, moving: false, seed: R() * 99, col: 0 }, o));
    const flock = (type, cx, cy, n, area, o) => { for (let i = 0; i < n; i++) A(type, cx + (R() - 0.5) * area, cy + (R() - 0.5) * area * 0.6, area, Object.assign({ col: Math.floor(R() * 3) }, o)); };
    flock('chicken', 1350, 1660, 6, 150);
    flock('chicken', 2180, 2050, 5, 130);
    flock('chicken', 1400, 2420, 5, 140);
    flock('chicken', 1700, 1250, 4, 120);
    for (let i = 0; i < 7; i++) A('sheep', pn.x + 40 + R() * (pn.w - 80), pn.y + 30 + R() * (pn.h - 50), 0, { pen: pn, col: i === 2 ? 1 : 0 });
    for (let i = 0; i < 3; i++) A('pig', VILLAGE.wallow.x + (R() - 0.5) * 120, VILLAGE.wallow.y + (R() - 0.5) * 60, 110, { col: i % 2 });
    for (let i = 0; i < 3; i++) A('goat', 2900 + R() * 140, 2600 + R() * 100, 160, { col: i % 2 });
    A('dog', 1700, 1720, 420, { dog: true });
    A('cat', 1880, 1518, 0, { cat: true, perch: 62 });
    A('cat', 1300, 1640, 0, { cat: true, perch: 54, col: 1 });
    // ducks paddle along the harbor shore and the river
    for (const [x, y] of [[640, 2150], [700, 2210], [660, 2260], [4150, 1500], [4180, 1560], [900, 2650], [940, 2700]]) A('duck', x, y, 120, { swim: true });
    // crows peck in the meadows and scatter when Eric comes close
    for (const [x, y] of [[2350, 2500], [1900, 2500], [2480, 1250], [1200, 2300], [3300, 2000], [2200, 1000]]) flock('crow', x, y, 3, 90, { bird: true });
    // gulls circle over the harbor
    for (let i = 0; i < 6; i++) L.gulls.push({ cx: 500 + R() * 600, cy: 1500 + R() * 1100, r: 120 + R() * 200, a: R() * TAU, v: (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.2), z: 260 + R() * 160, seed: R() * 9 });
    for (let i = 0; i < 14; i++) L.butter.push({ x: 1100 + R() * 1700, y: 1300 + R() * 1300, z: 30 + R() * 40, a: R() * TAU, col: pick(['#f6e27a', '#ffffff', '#9fc7ff', '#f2a65a']), seed: R() * 99 });
  },

  // ------------------------------------------------------------------ ground paint (baked into tiles)
  paintVillage(c, v, layer) {
    const R = _rng(Math.floor(v.x * 7 + v.y * 13));
    const inside = (x, y, m) => x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;
    if (layer === 'under') {
      // worn earth around the plaza
      if (inside(TOWN.x, TOWN.y, TOWN.plaza + 140)) {
        const g = c.createRadialGradient(TOWN.x, TOWN.y, TOWN.plaza * 0.6, TOWN.x, TOWN.y, TOWN.plaza + 130);
        g.addColorStop(0, 'rgba(120,95,60,0.55)'); g.addColorStop(1, 'rgba(120,95,60,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(TOWN.x, TOWN.y, TOWN.plaza + 130, TOWN.plaza + 100, 0, 0, TAU); c.fill();
      }
      // garden plots
      for (const p of VILLAGE.plots) {
        if (!inside(p.x + p.w / 2, p.y + p.h / 2, p.w)) continue;
        c.fillStyle = '#4e3520'; rr(c, p.x, p.y, p.w, p.h, 10); c.fill();
        const rows = Math.floor(p.h / 22);
        for (let i = 0; i < rows; i++) {
          const y = p.y + 14 + i * 22;
          c.fillStyle = '#6a4a2c'; c.fillRect(p.x + 8, y - 4, p.w - 16, 7);
          c.fillStyle = 'rgba(30,18,8,0.5)'; c.fillRect(p.x + 8, y + 4, p.w - 16, 3);
          for (let x = p.x + 16; x < p.x + p.w - 12; x += p.crop === 'wheat' ? 7 : 19) {
            if (p.crop === 'wheat') { c.strokeStyle = R() < 0.5 ? '#c9a548' : '#e2c46a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + (R() - 0.5) * 3, y - 13 - R() * 5); c.stroke(); }
            else {
              const r = 6 + R() * 2.5;
              c.fillStyle = '#3f7a2c'; c.beginPath(); c.arc(x, y - 2, r, 0, TAU); c.fill();
              c.fillStyle = '#7fbf55'; c.beginPath(); c.arc(x - 1.5, y - 4, r * 0.62, 0, TAU); c.fill();
              c.fillStyle = 'rgba(220,255,190,0.5)'; c.beginPath(); c.arc(x - 3, y - 6, r * 0.25, 0, TAU); c.fill();
            }
          }
        }
      }
      // sheep pen: trampled grass, a hay pile and a trough
      const pn = VILLAGE.pen;
      if (inside(pn.x + pn.w / 2, pn.y + pn.h / 2, pn.w)) {
        c.fillStyle = 'rgba(120,110,60,0.35)'; rr(c, pn.x + 6, pn.y + 6, pn.w - 12, pn.h - 12, 18); c.fill();
        for (let i = 0; i < 160; i++) { c.strokeStyle = R() < 0.5 ? 'rgba(214,180,90,0.8)' : 'rgba(170,140,60,0.8)'; c.lineWidth = 1.6; const x = pn.x + 40 + R() * 70, y = pn.y + 40 + R() * 40, a = R() * TAU; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 6); c.stroke(); }
      }
      // pig wallow
      const wl = VILLAGE.wallow;
      if (inside(wl.x, wl.y, 120)) {
        const g = c.createRadialGradient(wl.x, wl.y, 4, wl.x, wl.y, wl.rx);
        g.addColorStop(0, '#3a2a1a'); g.addColorStop(0.7, '#4a3522'); g.addColorStop(1, 'rgba(74,53,34,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(wl.x, wl.y, wl.rx, wl.ry, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(140,150,160,0.35)'; c.beginPath(); c.ellipse(wl.x + 14, wl.y + 4, 26, 9, 0, 0, TAU); c.fill();
      }
      // flower beds by the houses
      for (const b of (this.life ? this.life.beds : [])) {
        if (!inside(b.x, b.y, 60)) continue;
        const Rb = _rng(b.seed | 0);
        c.fillStyle = 'rgba(70,48,28,0.8)'; c.beginPath(); c.ellipse(b.x, b.y, 46, 16, 0, 0, TAU); c.fill();
        for (let i = 0; i < b.n; i++) {
          const x = b.x + (Rb() - 0.5) * 80, y = b.y + (Rb() - 0.5) * 24, col = pick(['#f4e6a2', '#e9a8c0', '#ffffff', '#b8c8ff', '#f2b45a', '#e05a4a']);
          c.strokeStyle = '#3d6b25'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x, y - 6); c.stroke();
          c.fillStyle = col; c.beginPath(); c.arc(x, y - 7, 3.2 + Rb() * 1.6, 0, TAU); c.fill();
        }
      }
      return;
    }
    // 'over': cobbles on the plaza and the town streets
    if (!inside(TOWN.x, TOWN.y, TOWN.r + 120)) return;
    const S = 23, ox = Math.floor((v.x - 30) / S) * S, oy = Math.floor((v.y - 30) / S) * S;
    for (let gy = oy; gy < v.y + v.h + 30; gy += S * 0.8) {
      const row = Math.round(gy / (S * 0.8));
      for (let gx = ox + (row % 2) * S * 0.5; gx < v.x + v.w + 30; gx += S) {
        const h1 = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453, f = h1 - Math.floor(h1), f2 = (f * 17.3) % 1;
        const x = gx + (f - 0.5) * 6, y = gy + (f2 - 0.5) * 5;
        const dp = Math.hypot(x - TOWN.x, (y - TOWN.y) * 1.15), dTown = Math.hypot(x - TOWN.x, y - TOWN.y);
        let inZone = dp < TOWN.plaza - f * 18;
        if (!inZone && dTown < TOWN.r) { const rd = this.roadDist(x, y); inZone = rd < 38 - f2 * 10 - Math.max(0, dTown - TOWN.r + 160) * 0.2; }
        if (!inZone) continue;
        const r = 9.5 + f * 3, tone = 128 + Math.floor(f2 * 46) - 23, warm = Math.floor(f * 14);
        c.fillStyle = 'rgba(40,34,28,0.55)'; c.beginPath(); c.ellipse(x + 1.5, y + 2, r + 1.5, r * 0.78 + 1.5, f * 2, 0, TAU); c.fill();
        const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, `rgb(${tone + 34 + warm},${tone + 28 + warm},${tone + 18})`); g.addColorStop(1, `rgb(${tone - 22 + warm},${tone - 26 + warm},${tone - 32})`);
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.78, f * 2, 0, TAU); c.fill();
        if (f2 < 0.18) { c.fillStyle = 'rgba(70,110,40,0.55)'; c.beginPath(); c.arc(x + r * 0.7, y + r * 0.5, 2.5, 0, TAU); c.fill(); }   // moss
      }
    }
  },

  // ------------------------------------------------------------------ per-frame update
  updateLife(dt, busy) {
    const L = this.life; if (!L) return;
    const e = this.e;
    for (const a of L.animals) {
      a.t += dt;
      const dE = Math.hypot(a.x - e.x, a.y - e.y);
      a.moving = false;
      if (a.fly) {  // a startled bird: up and away, lands again after a while
        a.fly -= dt; a.x += a.fvx * dt; a.y += a.fvy * dt; a.z = Math.min(140, (a.z || 0) + dt * 160);
        if (a.fly <= 0) { a.fly = 0; a.x = a.hx + (Math.random() - 0.5) * 120; a.y = a.hy + (Math.random() - 0.5) * 60; a.z = 0; }
        continue;
      }
      if (a.cat) { a.look = e.x < a.x ? -1 : 1; continue; }
      let sp = { chicken: 60, sheep: 34, pig: 40, goat: 55, dog: 150, duck: 26, crow: 70 }[a.type] || 40;
      // reactions to Eric
      if (a.bird && dE < 150 && !busy) { a.fly = 2.6; const d = dE || 1; a.fvx = (a.x - e.x) / d * 260 + (Math.random() - 0.5) * 80; a.fvy = (a.y - e.y) / d * 160 - 40; a.face = a.fvx < 0 ? -1 : 1; if (Math.random() < 0.5) AudioSys.sfx('whoosh', { x: this.proj(a.x, a.y).x }); continue; }
      if (a.type === 'chicken' && dE < 120 && !busy) {   // flap away
        const d = dE || 1; a.tx = a.x + (a.x - e.x) / d * 110; a.ty = a.y + (a.y - e.y) / d * 70; a.wait = 0; sp = 190; a.flap = 0.5;
      }
      if (a.dog) {   // the village dog trots over to Eric and keeps him company for a bit
        if (dE < 520 && dE > 130) { a.tx = e.x + (a.x < e.x ? -95 : 95); a.ty = e.y + 25; a.wait = 0; a.happy = 3; sp = dE > 300 ? 230 : 150; }
        else if (a.happy > 0) a.happy -= dt;
      }
      if (a.flap > 0) a.flap -= dt;
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 5) {
        a.wait -= dt;
        if (a.wait <= 0) {
          if (a.pen) { a.tx = a.pen.x + 40 + Math.random() * (a.pen.w - 80); a.ty = a.pen.y + 30 + Math.random() * (a.pen.h - 50); }
          else { const ang = Math.random() * TAU, r = Math.random() * a.area; a.tx = a.hx + Math.cos(ang) * r; a.ty = a.hy + Math.sin(ang) * r * 0.6; }
          a.wait = { chicken: 0.6 + Math.random() * 2, sheep: 2 + Math.random() * 5, pig: 1.5 + Math.random() * 4 }[a.type] || 1 + Math.random() * 3;
          if (a.swim && !this.wet(a.tx, a.ty)) { a.tx = a.x; a.ty = a.y; }
          else if (!a.swim && !a.pen && this.wet(a.tx, a.ty)) { a.tx = a.x; a.ty = a.y; }
        }
      } else {
        const st = Math.min(d, sp * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st;
        const ok = a.swim ? this.wet(nx, ny) : a.pen ? true : !this.blocked(nx, ny, 6) || a.dog && dE < 200;
        if (ok) { a.x = nx; a.y = ny; a.moving = true; if (Math.abs(dx) > 2) a.face = dx < 0 ? -1 : 1; }
        else { a.tx = a.x; a.ty = a.y; }
      }
    }
    for (const w of L.walkers || []) {
      w.moving = false;
      if (w.wait > 0) { w.wait -= dt; continue; }
      const a = w.pts[w.i], b = w.pts[w.i + w.dir];
      if (!b) { w.dir = -w.dir; w.wait = 1 + Math.random() * 4; continue; }
      const sx = b[0] - a[0], sy = b[1] - a[1], len = Math.hypot(sx, sy) || 1, sp = 62 * w.sc;
      w.f += sp * dt / len;
      if (w.f >= 1) { w.f = 0; w.i += w.dir; if (Math.random() < 0.02) w.wait = 1.5 + Math.random() * 3; continue; }
      const nx = -sy / len, ny = sx / len, side = w.side * w.dir;
      const px = w.x, py = w.y;
      w.x = a[0] + sx * w.f + nx * side; w.y = a[1] + sy * w.f + ny * side;
      const d = Math.hypot(w.x - px, w.y - py);
      if (Math.abs(w.x - px) > 0.01) w.face = w.x > px ? 1 : -1;
      w.anim += d / (ERIC_H * w.sc * 1.05); w.moving = true;
    }
    for (const g of L.gulls) g.a += g.v * dt;
    for (const b of L.butter) { b.a += (Math.sin(this.t * 0.7 + b.seed) * 1.6) * dt; b.x += Math.cos(b.a) * 40 * dt; b.y += Math.sin(b.a) * 22 * dt; }
    // random clucks / baas near Eric
    if (!busy && Math.random() < dt * 0.6) {
      const near = L.animals.filter(a => Math.hypot(a.x - e.x, a.y - e.y) < 500 && ['chicken', 'sheep', 'goat', 'pig', 'dog', 'duck'].includes(a.type));
      if (near.length) { const a = pick(near); AudioSys.sfx('blip', { x: this.proj(a.x, a.y).x, pitch: { chicken: 1.9, duck: 1.4, sheep: 0.7, goat: 0.85, pig: 0.5, dog: 1.0 }[a.type] }); }
    }
  },

  // ------------------------------------------------------------------ draw hooks
  drawLifeGround(c, v) {
    const L = this.life; if (!L) return;
    // soft shadows for animals, ripples for ducks
    for (const a of L.animals) {
      if (a.x < v.x - 50 || a.x > v.x + v.w + 50 || a.y < v.y - 50 || a.y > v.y + v.h + 50) continue;
      if (a.swim) {
        c.strokeStyle = 'rgba(230,250,250,0.35)'; c.lineWidth = 2;
        for (let k = 0; k < 2; k++) { const p = ((this.t * 0.8 + k * 0.5 + a.seed) % 1); c.globalAlpha = 1 - p; c.beginPath(); c.ellipse(a.x - a.face * 6, a.y, 12 + p * 26, 5 + p * 9, 0, 0, TAU); c.stroke(); }
        c.globalAlpha = 1; continue;
      }
      const sz = { chicken: 12, sheep: 34, pig: 30, goat: 28, dog: 26, cat: 0, crow: 8 }[a.type] || 10;
      if (!sz) continue;
      const lift = a.z || 0;
      c.fillStyle = `rgba(0,0,0,${0.3 * Math.max(0.2, 1 - lift / 160)})`; c.beginPath(); c.ellipse(a.x + lift * 0.4, a.y, sz * 0.55, sz * 0.2, 0, 0, TAU); c.fill();
    }
    for (const w of L.walkers || []) { if (w.x < v.x - 60 || w.x > v.x + v.w + 60 || w.y < v.y - 60 || w.y > v.y + v.h + 60) continue; c.fillStyle = 'rgba(0,0,0,0.32)'; c.beginPath(); c.ellipse(w.x + 4, w.y, 16 * w.sc, 6 * w.sc, 0, 0, TAU); c.fill(); }
    for (const g of L.gulls) { const x = g.cx + Math.cos(g.a) * g.r, y = g.cy + Math.sin(g.a) * g.r * 0.6; c.fillStyle = 'rgba(0,0,0,0.14)'; c.beginPath(); c.ellipse(x + g.z * 0.5, y, 14, 5, 0, 0, TAU); c.fill(); }
    // lantern pools of light
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const l of L.lamps) { if (l.x < v.x - 100 || l.x > v.x + v.w + 100 || l.y < v.y - 100 || l.y > v.y + v.h + 100) continue; const f = 0.8 + Math.sin(this.t * 9 + l.seed) * 0.08; c.globalAlpha = 0.16 * f; c.drawImage(glowSprite('rgba(255,170,80,1)'), l.x - 90, l.y - 40, 180, 80); }
    c.restore(); c.globalAlpha = 1;
  },
  addLife(c, add) {
    const L = this.life; if (!L) return;
    for (const a of L.animals) add(a.x, a.y, () => this.drawAnimal(c, a));
    for (const w of L.walkers || []) add(w.x, w.y, () => this.drawWalker(c, w));
    for (const l of L.lamps) add(l.x, l.y, () => this.drawLamp(c, l));
    for (const [x, y] of VILLAGE.hay) add(x, y, () => this.drawHay(c, x, y));
    // fences / walls / bunting are drawn straight in screen space (they run across depth)
    for (const f of L.fences) add((f.a[0] + f.b[0]) / 2, Math.max(f.a[1], f.b[1]) - 1, () => this.drawFence(c, f), true);
    for (const w of L.walls) add((w.a[0] + w.b[0]) / 2, Math.max(w.a[1], w.b[1]) - 1, () => this.drawWall(c, w), true);
    for (const b of L.bunting) add((b.a[0] + b.b[0]) / 2, Math.max(b.a[1], b.b[1]) + 1, () => this.drawBunting(c, b), true);
  },
  drawLifeAir(c) {
    const L = this.life; if (!L) return;
    // chimney smoke
    for (const sm of L.smoke) {
      const sp = sm.sp, img = this.pimg(sp); if (!img) continue;
      const w = img.width * sp.h / img.height, bx = sp.x + (sm.fx - 0.5) * w, by = sp.y, top = sp.h * sm.fy;
      const p = this.proj(bx, by); if (p.x < -200 || p.x > W + 200 || p.y < -100 || p.y > H + 700) continue;
      for (let k = 0; k < 7; k++) {
        const q = ((this.t * 0.16 + k / 7 + sm.seed) % 1), rise = q * 220, drift = q * q * 90 + Math.sin(this.t * 0.8 + k + sm.seed) * 10;
        const r = (14 + q * 46) * p.s, a = 0.32 * Math.sin(q * Math.PI) * (1 - q * 0.4);
        c.globalAlpha = a; c.drawImage(glowSprite('rgba(225,225,230,1)'), p.x + (drift - r) , p.y - (top + rise) * p.s - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    }
    // gulls and butterflies
    for (const g of L.gulls) {
      const x = g.cx + Math.cos(g.a) * g.r, y = g.cy + Math.sin(g.a) * g.r * 0.6, p = this.proj(x, y);
      if (p.x < -50 || p.x > W + 50 || p.y < -400 || p.y > H + 400) continue;
      const fl = Math.sin(this.t * 7 + g.seed), sx = p.x, sy = p.y - g.z * p.s, s = p.s * 1.1, dir = Math.sign(g.v) * -Math.sign(Math.sin(g.a)) || 1;
      c.save(); c.translate(sx, sy); c.scale(s * dir, s);
      c.strokeStyle = '#f4f4f0'; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-22, -fl * 9); c.quadraticCurveTo(-10, -6 - fl * 4, 0, 0); c.quadraticCurveTo(10, -6 - fl * 4, 22, -fl * 9); c.stroke();
      c.strokeStyle = 'rgba(60,60,70,0.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-22, -fl * 9); c.lineTo(-17, -fl * 7.5); c.moveTo(22, -fl * 9); c.lineTo(17, -fl * 7.5); c.stroke();
      c.fillStyle = '#fafaf6'; c.beginPath(); c.ellipse(2, 1, 7, 3, 0, 0, TAU); c.fill();
      c.restore();
    }
    for (const b of L.butter) {
      const p = this.proj(b.x, b.y); if (p.x < -20 || p.x > W + 20 || p.y < -50 || p.y > H + 50) continue;
      const fl = Math.abs(Math.sin(this.t * 14 + b.seed)), y = p.y - (b.z + Math.sin(this.t * 2 + b.seed) * 10) * p.s;
      c.fillStyle = b.col; c.globalAlpha = 0.9;
      c.beginPath(); c.ellipse(p.x - 4 * fl * p.s, y, 4 * fl * p.s + 0.5, 3.5 * p.s, 0, 0, TAU); c.ellipse(p.x + 4 * fl * p.s, y, 4 * fl * p.s + 0.5, 3.5 * p.s, 0, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
  },

  // ------------------------------------------------------------------ kit pieces (billboards, local world coords)
  // a townsperson from a filmed side-view walk sheet (mirrored when walking left)
  drawWalker(c, w) {
    const WS = typeof WALK_SHEETS !== 'undefined' ? WALK_SHEETS : null, sheet = G.img['walk_' + w.sheet]; if (!WS || !sheet) return;
    const n = WS.frames[w.sheet], i = w.moving ? Math.floor((((w.anim % 1) + 1) % 1) * n) % n : (WS.stand ? WS.stand[w.sheet] : 0);
    let img = sheet;
    if (w.filter !== 'none') {   // tinted copy, made once per look
      const key = w.sheet + '|' + w.filter; this._tint = this._tint || {};
      if (!this._tint[key]) { const [cv, cx] = _mkCv(sheet.width, sheet.height); cx.filter = w.filter; cx.drawImage(sheet, 0, 0); this._tint[key] = cv; }
      img = this._tint[key];
    }
    const s = ERIC_H * w.sc / WS.body, br = w.moving ? 1 : 1 + Math.sin(this.t * 2 + w.seed) * 0.007;
    c.save(); c.translate(w.x, w.y); c.scale(s * w.face, s * br);
    c.drawImage(img, (i % WS.cols) * WS.fw, Math.floor(i / WS.cols) * WS.fh, WS.fw, WS.fh, -WS.fw / 2, -WS.ay, WS.fw, WS.fh);
    c.restore();
  },
  drawLamp(c, l) {
    const x = l.x, y = l.y, f = 0.85 + Math.sin(this.t * 11 + l.seed) * 0.06 + Math.sin(this.t * 23 + l.seed * 2) * 0.04;
    const wood = c.createLinearGradient(x - 5, 0, x + 5, 0); wood.addColorStop(0, '#2c1a0c'); wood.addColorStop(0.5, '#6e4826'); wood.addColorStop(1, '#2a180a');
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y, 12, 4, 0, 0, TAU); c.fill();
    c.fillStyle = wood; c.fillRect(x - 5, y - 150, 10, 150);
    c.fillStyle = '#4a2f18'; c.fillRect(x - 5, y - 150, 30, 7);                      // arm
    c.strokeStyle = '#1e1a16'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 21, y - 143); c.lineTo(x + 21, y - 132); c.stroke();
    // iron lantern with a flame
    c.fillStyle = '#1f1b17'; c.beginPath(); c.moveTo(x + 13, y - 132); c.lineTo(x + 29, y - 132); c.lineTo(x + 26, y - 127); c.lineTo(x + 16, y - 127); c.closePath(); c.fill();
    const lg = c.createLinearGradient(0, y - 127, 0, y - 104); lg.addColorStop(0, `rgba(255,236,170,${f})`); lg.addColorStop(1, `rgba(255,150,50,${f})`);
    c.fillStyle = lg; c.fillRect(x + 15, y - 127, 12, 21);
    c.strokeStyle = '#1f1b17'; c.lineWidth = 1.6; c.strokeRect(x + 15, y - 127, 12, 21); c.beginPath(); c.moveTo(x + 21, y - 127); c.lineTo(x + 21, y - 106); c.stroke();
    c.fillStyle = '#1f1b17'; c.fillRect(x + 13, y - 106, 16, 3);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 * f;
    c.drawImage(glowSprite('rgba(255,175,80,1)'), x + 21 - 46, y - 116 - 46, 92, 92); c.restore();
  },
  drawHay(c, x, y) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 6, y, 50, 14, 0, 0, TAU); c.fill();
    const g = c.createRadialGradient(x - 14, y - 52, 6, x, y - 30, 60); g.addColorStop(0, '#f3d98a'); g.addColorStop(0.6, '#c99a3e'); g.addColorStop(1, '#7a5520');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 46, y); c.quadraticCurveTo(x - 50, y - 66, x, y - 76); c.quadraticCurveTo(x + 50, y - 66, x + 46, y); c.closePath(); c.fill();
    const R = _rng(Math.floor(x * 3 + y));
    c.lineWidth = 1.4; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI * (0.1 + R() * 0.8), r = 20 + R() * 40, px = x + Math.cos(a) * r * 0.9, py = y - 6 + Math.sin(a) * r * 1.05;
      c.strokeStyle = R() < 0.5 ? 'rgba(255,236,160,0.7)' : 'rgba(120,85,30,0.6)';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + (R() - 0.5) * 12, py + 6 + R() * 6); c.stroke();
    }
    c.strokeStyle = '#6a4a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 44, y - 30); c.quadraticCurveTo(x, y - 20, x + 44, y - 30); c.stroke();
  },
  drawStall(c, s) {
    const x = s.x, y = s.y, w = 150;
    c.fillStyle = 'rgba(0,0,0,0.32)'; c.beginPath(); c.ellipse(x + 8, y, w * 0.58, 20, 0, 0, TAU); c.fill();
    const post = (px, h) => { const g = c.createLinearGradient(px - 4, 0, px + 4, 0); g.addColorStop(0, '#2c1a0c'); g.addColorStop(0.5, '#7a5230'); g.addColorStop(1, '#2c1a0c'); c.fillStyle = g; c.fillRect(px - 4, y - h, 8, h); };
    post(x - w / 2 + 6, 150); post(x + w / 2 - 6, 150);
    // counter
    const cg = c.createLinearGradient(0, y - 64, 0, y); cg.addColorStop(0, '#8a5a30'); cg.addColorStop(1, '#3e2612');
    c.fillStyle = cg; c.fillRect(x - w / 2, y - 60, w, 60);
    c.strokeStyle = 'rgba(25,14,6,0.6)'; c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - w / 2 + k * w / 4, y - 58); c.lineTo(x - w / 2 + k * w / 4, y); c.stroke(); }
    c.fillStyle = '#a77445'; c.fillRect(x - w / 2 - 6, y - 66, w + 12, 9);
    // goods
    const R = _rng(Math.floor(x + y));
    for (let i = 0; i < 3; i++) {
      const bx = x - 46 + i * 46, by = y - 66;
      c.fillStyle = '#7a5226'; c.beginPath(); c.ellipse(bx, by, 20, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#5a3a18'; c.fillRect(bx - 20, by, 40, 6);
      for (let k = 0; k < 6; k++) {
        const gx = bx + (R() - 0.5) * 26, gy = by - 4 - R() * 8;
        if (s.kind === 'fish') { c.fillStyle = R() < 0.5 ? '#c9d2d8' : '#9aa7b0'; c.beginPath(); c.ellipse(gx, gy, 10, 3.5, (R() - 0.5) * 0.8, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(gx - 5, gy - 2, 7, 1.2); }
        else if (s.kind === 'bread') { c.fillStyle = R() < 0.5 ? '#c98a3c' : '#a8682a'; c.beginPath(); c.ellipse(gx, gy, 8, 5, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,230,170,0.5)'; c.fillRect(gx - 4, gy - 3, 6, 1.4); }
        else { c.fillStyle = pick(['#c8321e', '#e0a22a', '#8ab838']); c.beginPath(); c.arc(gx, gy, 4.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(gx - 1.5, gy - 1.5, 1.4, 0, TAU); c.fill(); }
      }
    }
    // striped awning
    const top = y - 168, fr = y - 128;
    for (let k = 0; k < 6; k++) {
      const x0 = x - w / 2 - 12 + k * (w + 24) / 6, x1 = x0 + (w + 24) / 6;
      c.fillStyle = k % 2 ? '#efe2c4' : s.col;
      c.beginPath(); c.moveTo(x0 + 6, top); c.lineTo(x1 + 6, top); c.lineTo(x1, fr); c.lineTo(x0, fr); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x0, fr); c.lineTo(x1, fr); c.lineTo(x1, fr + 9); c.quadraticCurveTo((x0 + x1) / 2, fr + 17, x0, fr + 9); c.closePath(); c.fill();
    }
    const sh = c.createLinearGradient(0, top, 0, fr + 16); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = sh; c.fillRect(x - w / 2 - 12, top, w + 30, fr + 16 - top);
  },
  // fences, walls and bunting: drawn in screen space from projected endpoints
  drawFence(c, f) {
    const a = this.proj(f.a[0], f.a[1]), b = this.proj(f.b[0], f.b[1]);
    if (Math.max(a.x, b.x) < -40 || Math.min(a.x, b.x) > W + 40 || Math.max(a.y, b.y) < -20 || Math.min(a.y, b.y) > H + 200) return;
    const H1 = 52, post = (p) => {
      const g = c.createLinearGradient(p.x - 4 * p.s, 0, p.x + 4 * p.s, 0); g.addColorStop(0, '#3a2412'); g.addColorStop(0.5, '#8a6038'); g.addColorStop(1, '#3a2412');
      c.fillStyle = g; c.fillRect(p.x - 4 * p.s, p.y - H1 * p.s, 8 * p.s, H1 * p.s);
      c.fillStyle = '#9a6e42'; c.beginPath(); c.ellipse(p.x, p.y - H1 * p.s, 4 * p.s, 1.6 * p.s, 0, 0, TAU); c.fill();
    };
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(b.x + 10 * b.s, b.y + 4 * b.s); c.lineTo(a.x + 10 * a.s, a.y + 4 * a.s); c.closePath(); c.fill();
    c.lineCap = 'round';
    for (const [hf, col] of [[0.38, '#6e4826'], [0.76, '#7a5230']]) {
      c.strokeStyle = col; c.lineWidth = 5.5 * (a.s + b.s) / 2;
      c.beginPath(); c.moveTo(a.x, a.y - H1 * hf * a.s); c.lineTo(b.x, b.y - H1 * hf * b.s); c.stroke();
      c.strokeStyle = 'rgba(255,220,170,0.25)'; c.lineWidth = 1.5 * (a.s + b.s) / 2;
      c.beginPath(); c.moveTo(a.x, a.y - H1 * hf * a.s - 2 * a.s); c.lineTo(b.x, b.y - H1 * hf * b.s - 2 * b.s); c.stroke();
    }
    post(a); post(b);
  },
  drawWall(c, w) {
    const a = this.proj(w.a[0], w.a[1]), b = this.proj(w.b[0], w.b[1]);
    if (Math.max(a.x, b.x) < -60 || Math.min(a.x, b.x) > W + 60 || Math.max(a.y, b.y) < -20 || Math.min(a.y, b.y) > H + 200) return;
    const R = _rng(w.seed | 0), n = 6;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(a.x, a.y + 3 * a.s); c.lineTo(b.x, b.y + 3 * b.s); c.lineTo(b.x + 14 * b.s, b.y + 8 * b.s); c.lineTo(a.x + 14 * a.s, a.y + 8 * a.s); c.closePath(); c.fill();
    for (const [row, hh] of [[0, 0], [1, 17], [2, 31]]) {
      for (let i = 0; i <= n - (row === 2 ? 1 : 0); i++) {
        const t = (i + (row % 2) * 0.5) / n; if (t > 1) continue;
        const s = a.s + (b.s - a.s) * t, x = a.x + (b.x - a.x) * t + (R() - 0.5) * 4 * s, y = a.y + (b.y - a.y) * t - (hh + 9) * s;
        const rx = (12 + R() * 5) * s * (row === 2 ? 0.85 : 1), ry = (9 + R() * 3) * s, tone = 110 + Math.floor(R() * 40);
        const g = c.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
        g.addColorStop(0, `rgb(${tone + 40},${tone + 38},${tone + 30})`); g.addColorStop(1, `rgb(${tone - 40},${tone - 40},${tone - 42})`);
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, (R() - 0.5) * 0.5, 0, TAU); c.fill();
        if (R() < 0.3) { c.fillStyle = 'rgba(90,130,50,0.7)'; c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.6, rx * 0.4, ry * 0.25, 0, 0, TAU); c.fill(); }
      }
    }
  },
  drawBunting(c, bn) {
    const a = this.proj(bn.a[0], bn.a[1]), b = this.proj(bn.b[0], bn.b[1]), PH = 255;
    if (Math.max(a.x, b.x) < -40 || Math.min(a.x, b.x) > W + 40 || Math.max(a.y, b.y) < -PH || Math.min(a.y, b.y) > H + 300) return;
    for (const p of [a, b]) {
      const g = c.createLinearGradient(p.x - 4 * p.s, 0, p.x + 4 * p.s, 0); g.addColorStop(0, '#2c1a0c'); g.addColorStop(0.5, '#7a5230'); g.addColorStop(1, '#2c1a0c');
      c.fillStyle = g; c.fillRect(p.x - 4 * p.s, p.y - PH * p.s, 8 * p.s, PH * p.s);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(p.x, p.y, 9 * p.s, 3 * p.s, 0, 0, TAU); c.fill();
    }
    const ax = a.x, ay = a.y - (PH - 6) * a.s, bx = b.x, by = b.y - (PH - 6) * b.s, sag = 34 * (a.s + b.s) / 2 + Math.sin(this.t * 1.3 + bn.seed) * 4;
    const at = t => [ax + (bx - ax) * t, ay + (by - ay) * t + Math.sin(t * Math.PI) * sag];
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.6; c.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = at(i / 20); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    const cols = ['#c0392b', '#f1c40f', '#2e6da4', '#efe6d0', '#2f8a4a'], n = 13, s = (a.s + b.s) / 2;
    for (let i = 1; i < n; i++) {
      const [x0, y0] = at((i - 0.32) / n), [x1, y1] = at((i + 0.32) / n), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const sw = Math.sin(this.t * 3 + i * 0.9 + bn.seed) * 4 * s;
      c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(mx + sw, my + 22 * s); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.moveTo(mx, my); c.lineTo(x1, y1); c.lineTo(mx + sw, my + 22 * s); c.closePath(); c.fill();
    }
  },

  // ------------------------------------------------------------------ animals (side view, facing a.face)
  drawAnimal(c, a) {
    const t = a.t, mv = a.moving ? 1 : 0;
    c.save(); c.translate(a.x, a.y - (a.z || 0));
    const fl = a.type === 'cat' ? (a.look || 1) : a.face;
    c.scale(fl * 0.55, 0.55);   // animals sized to the (smaller) townsfolk
    if (this['_a_' + a.type]) this['_a_' + a.type](c, a, t, mv);
    c.restore();
  },
  _a_chicken(c, a, t, mv) {
    const peck = !mv && Math.sin(t * 2.3 + a.seed) > 0.55 ? 1 : 0, step = Math.sin(t * 16) * mv, bob = Math.abs(step) * 2;
    const body = ['#f4efe4', '#b8642a', '#3a2c22'][a.col], dark = ['#cfc6b4', '#7a3c16', '#1a120c'][a.col];
    c.strokeStyle = '#d9a030'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-2, -8); c.lineTo(-2 + step * 4, 0); c.moveTo(3, -8); c.lineTo(3 - step * 4, 0); c.stroke();
    c.translate(0, -bob);
    if (a.flap > 0) { c.fillStyle = dark; c.beginPath(); c.ellipse(-2, -22, 12, 5, -0.6 + Math.sin(t * 40) * 0.5, 0, TAU); c.fill(); }
    c.fillStyle = dark; c.beginPath(); c.moveTo(-9, -16); c.lineTo(-17, -30); c.lineTo(-12, -27); c.lineTo(-14, -34); c.lineTo(-5, -20); c.closePath(); c.fill();
    const g = c.createRadialGradient(-1, -20, 2, 0, -15, 14); g.addColorStop(0, body); g.addColorStop(1, dark);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -15, 11, 8.5, 0.1, 0, TAU); c.fill();
    c.fillStyle = dark; c.beginPath(); c.ellipse(-1, -15, 6, 4, 0.2, 0, TAU); c.fill();   // wing
    const hx = peck ? 13 : 9, hy = peck ? -7 : -25;
    c.strokeStyle = body; c.lineWidth = 6; c.beginPath(); c.moveTo(5, -18); c.lineTo(hx - 1, hy + 2); c.stroke();
    c.fillStyle = body; c.beginPath(); c.arc(hx, hy, 4.6, 0, TAU); c.fill();
    c.fillStyle = '#d42a1a'; c.beginPath(); c.arc(hx - 1, hy - 4.5, 2.2, 0, TAU); c.arc(hx + 1.5, hy - 4, 2, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(hx + 2.5, hy + 4, 1.5, 2.4, 0, 0, TAU); c.fill();
    c.fillStyle = '#e8a42a'; c.beginPath(); c.moveTo(hx + 4, hy - 1); c.lineTo(hx + 9, hy + 0.5); c.lineTo(hx + 4, hy + 2); c.closePath(); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(hx + 1.5, hy - 1, 1, 0, TAU); c.fill();
  },
  _a_sheep(c, a, t, mv) {
    const graze = !mv && Math.sin(t * 0.5 + a.seed) > -0.2, step = Math.sin(t * 9) * mv;
    const legs = [[-17, step], [-9, -step], [11, -step], [19, step]];
    c.strokeStyle = '#1e1a18'; c.lineWidth = 4.5; c.lineCap = 'round';
    for (const [x, s] of legs) { c.beginPath(); c.moveTo(x, -22); c.lineTo(x + s * 5, 0); c.stroke(); }
    const wool = a.col ? ['#5a4a40', '#2e241e'] : ['#fbf6ea', '#b9ae98'];
    const puffs = [[-18, -34, 13], [-6, -40, 14], [8, -39, 14], [19, -33, 12], [-12, -26, 12], [4, -26, 13], [16, -25, 11], [-22, -24, 9]];
    const bob = Math.abs(step) * 1.5;
    for (const [x, y, r] of puffs) { const g = c.createRadialGradient(x - r * 0.4, y - r * 0.5 - bob, 1, x, y - bob, r); g.addColorStop(0, wool[0]); g.addColorStop(1, wool[1]); c.fillStyle = g; c.beginPath(); c.arc(x, y - bob, r, 0, TAU); c.fill(); }
    const hx = graze ? 30 : 28, hy = graze ? -14 : -40;
    c.fillStyle = '#26201c'; c.beginPath(); c.ellipse(hx, hy, 7, 10, graze ? 1.2 : 0.5, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(hx - 6, hy - 6, 6, 3, -0.4, 0, TAU); c.fill();
    c.fillStyle = wool[0]; c.beginPath(); c.arc(hx - 4, hy - 8, 5, 0, TAU); c.fill();
    c.fillStyle = '#e8e2d0'; c.beginPath(); c.arc(hx + 2, hy - 3, 1.2, 0, TAU); c.fill();
  },
  _a_goat(c, a, t, mv) {
    const graze = !mv && Math.sin(t * 0.6 + a.seed) > 0, step = Math.sin(t * 11) * mv;
    const col = a.col ? ['#e8e0d0', '#9a8c78'] : ['#9a6a3a', '#4a3018'];
    c.strokeStyle = col[1]; c.lineWidth = 4; c.lineCap = 'round';
    for (const [x, s] of [[-14, step], [-7, -step], [10, -step], [16, step]]) { c.beginPath(); c.moveTo(x, -24); c.lineTo(x + s * 5, 0); c.stroke(); }
    const g = c.createLinearGradient(0, -44, 0, -20); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -32, 21, 11, 0, 0, TAU); c.fill();
    c.strokeStyle = col[1]; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, -36); c.lineTo(-25, -44); c.stroke();
    const hx = graze ? 26 : 24, hy = graze ? -14 : -48;
    c.strokeStyle = col[0]; c.lineWidth = 9; c.beginPath(); c.moveTo(16, -36); c.lineTo(hx - 3, hy + 3); c.stroke();
    c.fillStyle = col[0]; c.beginPath(); c.ellipse(hx, hy, 9, 6, graze ? 1 : 0.4, 0, TAU); c.fill();
    c.strokeStyle = '#3a3026'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hx - 3, hy - 4); c.quadraticCurveTo(hx - 12, hy - 14, hx - 14, hy - 4); c.stroke();
    c.fillStyle = col[1]; c.beginPath(); c.moveTo(hx + 3, hy + 4); c.lineTo(hx + 1, hy + 12); c.lineTo(hx + 6, hy + 5); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(hx + 2, hy - 2, 1.3, 0, TAU); c.fill();
  },
  _a_pig(c, a, t, mv) {
    const step = Math.sin(t * 12) * mv, snif = !mv ? Math.sin(t * 6 + a.seed) * 1.5 : 0;
    c.strokeStyle = '#c08070'; c.lineWidth = 5; c.lineCap = 'round';
    for (const [x, s] of [[-16, step], [-8, -step], [10, -step], [17, step]]) { c.beginPath(); c.moveTo(x, -14); c.lineTo(x + s * 4, 0); c.stroke(); }
    const g = c.createRadialGradient(-4, -30, 3, 0, -22, 28); g.addColorStop(0, '#ffd2c4'); g.addColorStop(0.7, '#e8a090'); g.addColorStop(1, '#b06a5a');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -22, 25, 14, 0, 0, TAU); c.fill();
    if (a.col) { c.fillStyle = 'rgba(40,24,20,0.75)'; c.beginPath(); c.ellipse(-8, -26, 7, 5, 0.3, 0, TAU); c.ellipse(8, -18, 5, 4, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(80,55,35,0.55)'; c.beginPath(); c.ellipse(0, -12, 22, 4, 0, 0, TAU); c.fill();   // mud
    c.fillStyle = '#e8a090'; c.beginPath(); c.ellipse(24, -24 + snif, 10, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#d48878'; c.beginPath(); c.ellipse(33, -23 + snif, 3.5, 4.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#7a3a30'; c.beginPath(); c.arc(33.5, -24 + snif, 0.9, 0, TAU); c.arc(33.5, -21.5 + snif, 0.9, 0, TAU); c.fill();
    c.fillStyle = '#d07868'; c.beginPath(); c.moveTo(20, -31); c.lineTo(17, -40); c.lineTo(25, -33); c.closePath(); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(27, -27 + snif, 1.2, 0, TAU); c.fill();
    c.strokeStyle = '#d48878'; c.lineWidth = 1.8; c.beginPath(); c.arc(-27, -26, 3, 0, Math.PI * 1.6); c.stroke();
  },
  _a_dog(c, a, t, mv) {
    const step = Math.sin(t * 14) * mv, wag = Math.sin(t * (a.happy > 0 ? 22 : 6)) * (a.happy > 0 ? 0.6 : 0.25);
    const col = ['#9a948a', '#4a463f'];
    c.strokeStyle = col[1]; c.lineWidth = 4.5; c.lineCap = 'round';
    for (const [x, s] of [[-15, step], [-9, -step], [11, -step], [16, step]]) { c.beginPath(); c.moveTo(x, -26); c.lineTo(x + s * 6, 0); c.stroke(); }
    c.save(); c.translate(-20, -38); c.rotate(-0.6 + wag); c.strokeStyle = col[0]; c.lineWidth = 6; c.beginPath(); c.arc(-4, -6, 7, 0.5, Math.PI * 1.7); c.stroke(); c.restore();
    const g = c.createLinearGradient(0, -48, 0, -24); g.addColorStop(0, '#b8b2a6'); g.addColorStop(1, col[1]);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -35, 22, 11, 0, 0, TAU); c.fill();
    c.fillStyle = '#e8e2d6'; c.beginPath(); c.ellipse(14, -30, 9, 7, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#a8a296'; c.beginPath(); c.ellipse(24, -48, 10, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#5a554c'; c.beginPath(); c.moveTo(18, -54); c.lineTo(19, -66); c.lineTo(25, -55); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(25, -55); c.lineTo(28, -66); c.lineTo(31, -53); c.closePath(); c.fill();
    c.fillStyle = '#3a3630'; c.beginPath(); c.ellipse(34, -45, 7, 5, 0.1, 0, TAU); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(40, -46, 2, 0, TAU); c.fill(); c.beginPath(); c.arc(27, -50, 1.5, 0, TAU); c.fill();
    if (a.happy > 0 || mv) { c.fillStyle = '#d0505a'; c.beginPath(); c.ellipse(35, -39, 3, 4.5, 0.2, 0, TAU); c.fill(); }
  },
  _a_cat(c, a, t) {
    c.translate(0, -(a.perch || 0) * 0.98);
    const col = a.col ? ['#3a3430', '#1a1614'] : ['#e8a050', '#a85a20'];
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(2, 0, 13, 3, 0, 0, TAU); c.fill();
    const sw = Math.sin(t * 1.8 + a.seed) * 0.6;
    c.strokeStyle = col[1]; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -3); c.quadraticCurveTo(-20, -2, -18 + sw * 6, -16); c.stroke();
    const g = c.createLinearGradient(-10, -24, 10, 0); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = g; c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-12, -20, 0, -22); c.quadraticCurveTo(10, -20, 9, 0); c.closePath(); c.fill();
    c.fillStyle = col[0]; c.beginPath(); c.arc(2, -27, 7, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-4, -31); c.lineTo(-3, -39); c.lineTo(1, -33); c.moveTo(4, -33); c.lineTo(8, -39); c.lineTo(8, -30); c.fill();
    c.fillStyle = '#c8e070'; c.beginPath(); c.arc(4, -28, 1.4, 0, TAU); c.arc(8, -28, 1.4, 0, TAU); c.fill();
  },
  _a_duck(c, a, t, mv) {
    c.translate(0, Math.sin(t * 2 + a.seed) * 1.2);
    const g = c.createLinearGradient(0, -14, 0, 0); g.addColorStop(0, '#8a6a4a'); g.addColorStop(1, '#4a3424');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -5, 12, 6, 0, Math.PI, TAU); c.lineTo(12, -3); c.quadraticCurveTo(0, 2, -12, -3); c.fill();
    c.fillStyle = '#f2f0ea'; c.fillRect(4, -9, 3, 2);
    c.fillStyle = '#1f5a3a'; c.beginPath(); c.arc(9, -14, 4.5, 0, TAU); c.fill();
    c.fillStyle = '#e0b030'; c.beginPath(); c.moveTo(12, -14); c.lineTo(18, -12.5); c.lineTo(12, -11.5); c.fill();
    c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(-12, -6); c.lineTo(-17, -10); c.lineTo(-10, -9); c.fill();
  },
  _a_crow(c, a, t, mv) {
    if (a.fly) {
      const fl = Math.sin(t * 22);
      c.fillStyle = '#16141a'; c.beginPath(); c.ellipse(0, -6, 7, 3, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-2, -6); c.lineTo(-10, -6 - fl * 10); c.lineTo(4, -6); c.fill();
      c.beginPath(); c.moveTo(2, -6); c.lineTo(10, -6 - fl * 8); c.lineTo(6, -6); c.fill();
      return;
    }
    const peck = Math.sin(t * 3 + a.seed) > 0.4;
    c.strokeStyle = '#2a2420'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-1, -5); c.lineTo(-2, 0); c.moveTo(2, -5); c.lineTo(3, 0); c.stroke();
    c.fillStyle = '#16141a'; c.beginPath(); c.ellipse(0, -9, 8, 5, peck ? 0.5 : 0.1, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-6, -10); c.lineTo(-13, -12); c.lineTo(-6, -7); c.fill();
    const hx = peck ? 8 : 7, hy = peck ? -4 : -14;
    c.beginPath(); c.arc(hx, hy, 3.6, 0, TAU); c.fill();
    c.fillStyle = '#3a3640'; c.beginPath(); c.moveTo(hx + 3, hy - 1); c.lineTo(hx + 8, hy + 1); c.lineTo(hx + 3, hy + 1.5); c.fill();
  },
});
