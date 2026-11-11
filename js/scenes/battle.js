'use strict';
// ============================================================================
//  BATTLE SCENE
// ============================================================================
const GROUND = 840;
const ERIC_X = 420;
const HAND_R = { x: 141, y: -339 }; // right hand in eric_q34 sprite space (anchor = bottom centre)
const HAND_L = { x: -112, y: -322 };

class BattleScene {
  constructor(encId, done) { this.encId = encId; this.enc = ENCOUNTERS[encId]; this.done = done; }

  // ------------------------------------------------------------------ setup
  enter() {
    this.t = 0;
    this.P = Game.player;
    this.snapshot = JSON.parse(JSON.stringify(this.P));
    this.bg = G.img[this.enc.bg];
    const img = G.img.eric;
    this.eric = { x: ERIC_X, y: GROUND, h: 600, offX: -700, offY: 0, rot: 0, sx: 1, sy: 1, flash: 0, flashColor: '#ffffff', alpha: 1, axeA: null, axeB: null, axeSpin: 0, s: 600 / img.height };
    this.enemies = [];
    const ids = this.enc.enemies;
    if (this.enc.kraken) {
      this.addEnemy('tentacle', 1050, 905, { reachX: -560, len: 540 });
      this.addEnemy('kraken', 1450, 890, { scale: 1.0 });
      this.addEnemy('tentacle', 1765, 905, { reachX: -1270, len: 570, phase: 2 });
    } else {
      const xs = { 1: [1420], 2: [1230, 1590], 3: [1110, 1410, 1710] }[ids.length];
      ids.forEach((id, i) => this.addEnemy(id, xs[i], GROUND + (ids.length === 3 && i === 1 ? -14 : 8)));
    }
    this.ui = { mode: 'intro', sel: 0, row: 0, target: 0, resolve: null };
    this.block = { armed: false, open: false, hit: false, early: false };
    this.braced = false; this.qte = null; this.result = null; this.caption = null; this.turnBanner = null;
    this.projs = []; this.stamps = []; this.bubbles = []; this.furyCine = null; this.furyMode = false; this.shockwaves = [];
    this.lightning = 0; this.regrown = false;
    Slashes.clear();
    if (!G.img._stamp_rej) {
      G.img._stamp_rej = Art.makeStamp('REJECTED');
      G.img._stamp_app = Art.makeStamp('APPROVED', '#2f7a2a');
      G.img._stamp_bal = Art.makeStamp('BALANCED', '#1f4f96');
      G.img._stamp_win = Art.makeStamp('SHIPMENT SECURED', '#c4271b', 900, 200);
      G.img._stamp_lose = Art.makeStamp('SHIPMENT LOST', '#5a5a5a', 820, 200);
      G.img._stamp_flag = Art.makeStamp('FLAGGED', '#c4271b', 420, 120);
    }
    // v2: combo, rating stats, camera punch, impact bursts, heartbeat, fog
    this.combo = 0; this.comboT = 0;
    this.stats = { turns: 0, dmgTaken: 0, perfects: 0 };
    this.punch = { z: 0, x: W / 2, y: H / 2 };
    this.bursts = []; this.hbT = 0; this.hbFlash = 0;
    if (!G.img._fog) G.img._fog = Art.makeCloud(1000, 260, '205,210,220');
    this.fog = [0, 1, 2, 3].map(i => ({ x: i * 620 - 300, y: rand(690, 760), v: rand(10, 24) * (i % 2 ? 1 : -1), s: rand(1.1, 1.6) }));
    Music.intensity({ rage: 0, fury: 0 });
    AudioSys.playMusic(this.enc.final ? 'kraken' : this.enc.boss ? 'boss' : 'battle');
    this.run();
  }
  addEnemy(id, x, y, extra) {
    const d = ENEMIES[id];
    const e = Object.assign({ id, d, name: d.name, type: d.type, hp: d.hp, maxHp: d.hp, x, y, offX: 0, offY: 0, rot: 0, sx: 1, sy: 1, flash: 0, alive: true, alpha: 0, phase: rand(0, TAU), flagged: 0, revealed: false, attackT: 0, enterX: 260, blinkAt: rand(1, 4) }, extra);
    if (d.draw === 'paper' && !G.img['_sheet_' + d.sheet]) {
      if (d.sheet === 'manifest') G.img._sheet_manifest = Art.makeSheet(150, 190, { title: 'MANIFEST', curl: true });
      if (d.sheet === 'triplicate') {
        G.img._sheet_triplicate = [Art.makeSheet(160, 205, { title: 'FORM 27-B', c1: '#ffd9e2', c2: '#f0b9c6', c3: '#d48fa0' }),
          Art.makeSheet(160, 205, { title: 'FORM 27-B', c1: '#fff4c2', c2: '#f2df92', c3: '#d6bd62' }), Art.makeSheet(160, 205, { title: 'FORM 27-B' })];
      }
      if (d.sheet === 'duplicate') G.img._sheet_duplicate = Art.makeSheet(105, 135, { title: 'COPY', seal: false });
    }
    this.enemies.push(e); return e;
  }
  alive() { return this.enemies.filter(e => e.alive); }

  // geometry
  ecenter(e) {
    const X = e.x + e.offX, Y = e.y + e.offY;
    switch (e.d.draw) {
      case 'paper': return { x: X, y: Y - 150 - e.d.h * 0.5 };
      case 'kraken': return { x: X, y: Y - 330 };
      case 'tentacle': return e._mid ? { x: e._mid.x, y: e._mid.y } : { x: X, y: Y - 260 };
      default: return { x: X, y: Y - e.d.h * 0.48 };
    }
  }
  etop(e) {
    const X = e.x + e.offX, Y = e.y + e.offY;
    switch (e.d.draw) {
      case 'paper': return { x: X, y: Y - 170 - e.d.h };
      case 'kraken': return { x: X, y: Y - 630 };
      case 'tentacle': return { x: X, y: Y - (e.len || 520) - 30 };
      default: return { x: X, y: Y - e.d.h - 10 };
    }
  }
  ebox(e) {
    const c = this.ecenter(e);
    switch (e.d.draw) {
      case 'kraken': return { x: c.x - 270, y: c.y - 280, w: 540, h: 480 };
      case 'tentacle': return { x: e.x - 120, y: e.y - (e.len || 520), w: 240, h: (e.len || 520) - 150 };
      case 'paper': return { x: c.x - 110, y: c.y - e.d.h * 0.6, w: 220, h: e.d.h * 1.2 };
      default: { const im = G.img[e.d.img]; const w = im ? im.width * e.d.h / im.height : 200; return { x: e.x - w / 2, y: e.y - e.d.h, w, h: e.d.h }; }
    }
  }
  ericCenter() { return { x: this.eric.x + this.eric.offX + 10, y: this.eric.y + this.eric.offY - 330 }; }

  // ------------------------------------------------------------------ flow
  async run() {
    // entrance
    AudioSys.sfx('whoosh');
    tween(this.eric, { offX: 0 }, 0.9, Ease.outCubic);
    this.enemies.forEach((e, i) => {
      e.offX = e.enterX;
      wait(0.25 + i * 0.18).then(() => { tween(e, { offX: 0, alpha: 1 }, 0.7, Ease.outBack); if (e.d.draw === 'kraken') { e.offY = 400; tween(e, { offY: 0 }, 1.6, Ease.outCubic); AudioSys.sfx('roar'); shake(18); } });
    });
    this.showCaption(this.enc.title, 1.8, true);
    await wait(1.4);
    while (true) {
      this.braced = false;
      this.stats.turns++;
      this.planIntents();
      this.banner('YOUR TURN');
      await wait(0.5);
      const act = await this.choose();
      await this.execute(act);
      await wait(0.25);
      if (await this.checkEnd()) return;
      await this.checkRegrow();
      this.banner('ENEMY TURN', true);
      await wait(0.6);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        await this.enemyAct(e);
        await wait(0.2);
        if (this.P.hp <= 0) break;
      }
      for (const e of this.enemies) if (e.flagged > 0) e.flagged--;
      if (await this.checkEnd()) return;
    }
  }
  // ---- v2 helpers ------------------------------------------------------------
  pickMove(e) {
    let moves = e.d.moves.filter(m => !(m.heal && e.hp > e.maxHp * 0.7));
    if (!moves.length) moves = e.d.moves;
    let r = rand(0, moves.reduce((s, m) => s + m.w, 0)), mv = moves[0];
    for (const m of moves) { r -= m.w; if (r <= 0) { mv = m; break; } }
    return mv;
  }
  // enemies decide their next move at the start of your turn, and show it
  planIntents() { for (const e of this.enemies) if (e.alive) e.intent = this.pickMove(e); }
  intentInfo(e) {
    const mv = e.intent; if (!mv) return null;
    const parts = [];
    if (mv.dmg && e.d.atk * mv.dmg >= 3) parts.push(`~${Math.max(1, Math.round(e.d.atk * mv.dmg * (mv.audit ? 1 + this.P.madness / 100 : 1)))} dmg`);
    if (mv.mad) parts.push(`+${mv.mad} mad`);
    if (mv.heal) parts.push('heals');
    if (mv.steal) parts.push('steals');
    const color = mv.heal ? '#9cf08a' : mv.dmg >= 1.15 ? '#ff8a6a' : mv.mad >= 15 ? '#e4a8ff' : '#ffd8b0';
    return { text: `▸ ${mv.name}` + (parts.length ? '  ·  ' + parts.join(' · ') : ''), color };
  }
  addCombo() {
    this.combo = Math.min(5, this.combo + 1); this.comboT = 0;
    AudioSys.sfx('combo', { pitch: 1 + this.combo * 0.12 });
  }
  breakCombo() {
    if (this.combo >= 2) { const c = this.ericCenter(); Floaters.add('RHYTHM LOST', c.x, c.y - 330, { color: '#c9b9a0', size: 34, delay: 0.2 }); AudioSys.sfx('comboBreak'); }
    this.combo = 0;
  }
  addPunch(z, x, y) { if (z >= this.punch.z) Object.assign(this.punch, { z, x, y }); }
  burst(x, y, s = 1, color = '255,230,170') { this.bursts.push({ x, y, s, color, t: 0, rot: rand(0, TAU) }); }
  grade() {
    const st = statsFor(this.P.level), par = this.enc.par || 4, S = this.stats;
    const score = 100 - (S.dmgTaken / st.maxHp) * 55 - Math.max(0, S.turns - par) * 7 + Math.min(15, S.perfects * 3);
    return score >= 88 ? 'S' : score >= 72 ? 'A' : score >= 55 ? 'B' : 'C';
  }

  banner(text, enemy) { this.turnBanner = { text, t: 0, enemy }; AudioSys.sfx(enemy ? 'back' : 'click'); }
  showCaption(text, dur = 1.4, big = false) { this.caption = { text, t: 0, dur, big }; }
  bubble(e, text) { const p = this.etop(e); this.bubbles.push({ text, x: p.x, y: p.y - 20, t: 0, dur: 1.9 }); }

  choose() {
    return new Promise(res => {
      this.ui.mode = 'main'; this.ui.resolve = res;
      if (this.ui.sel === 4 && this.P.madness < 100) this.ui.sel = 0;
    });
  }
  pickAction(a) { const r = this.ui.resolve; this.ui.mode = 'busy'; this.ui.resolve = null; r(a); }

  async checkEnd() {
    if (this.P.hp <= 0) { await this.defeat(); return true; }
    if (!this.alive().length) { await this.victory(); return true; }
    return false;
  }
  async checkRegrow() {
    const k = this.enemies.find(e => e.id === 'kraken' && e.alive);
    if (!k || this.regrown || k.hp > k.maxHp * 0.5) return;
    if (this.enemies.some(e => e.id === 'tentacle' && e.alive)) return;
    this.regrown = true;
    this.showCaption('THE ORDER HAS BEEN... RE-BACKORDERED!', 2.2, true);
    AudioSys.sfx('roar'); shake(20);
    for (const e of this.enemies) if (e.id === 'tentacle') {
      Object.assign(e, { alive: true, hp: 90, maxHp: 90, alpha: 1, offY: 500, flash: 0, sy: 1, attackT: 0 });
      tween(e, { offY: 0 }, 1.0, Ease.outBack);
      Particles.spawn('drop', e.x, 880, 30, { color: ['#9fb6d8', '#dfe9ff'], angle: -Math.PI / 2, spread: 0.8, speed: 900, g: 1600, size: 7 });
    }
    AudioSys.sfx('splash');
    await wait(1.4);
  }

  // ------------------------------------------------------------------ player actions
  async execute(a) {
    const P = this.P;
    if (a.type === 'brace') {
      this.braced = true;
      P.focus = Math.min(statsFor(P.level).maxFocus, P.focus + 8);
      this.addMadness(-6);
      this.showCaption('Brace! (half damage, +8 Focus)');
      AudioSys.sfx('block');
      const c = this.ericCenter();
      Particles.spawn('glow', c.x, c.y, 20, { color: 'rgba(120,180,255,0.9)', speed: 300, g: 0, life: 0.8 });
      Floaters.add('+8 FOCUS', c.x, c.y - 200, { color: '#8cc8ff', size: 40 });
      await wait(0.7); return;
    }
    if (a.type === 'item') { await this.useItem(a.item); return; }
    if (a.type === 'fury') { await this.fury(); return; }
    const sk = SKILLS[a.skill];
    P.focus -= sk.focus;
    this.showCaption(sk.name);
    if (sk.kind === 'axe') await this.axeAttack(sk, a.target);
    else await this.paperAction(sk, a.target);
    this.addMadness(sk.mad);
  }

  async useItem(k) {
    const P = this.P, it = ITEMS[k];
    P.items[k]--;
    this.showCaption(it.name);
    const c = this.ericCenter();
    AudioSys.sfx(k === 'rune' ? 'madness' : 'heal');
    const st = statsFor(P.level);
    if (it.hp) { const v = Math.min(it.hp, st.maxHp - P.hp); P.hp += v; Floaters.add('+' + Math.round(v) + ' HP', c.x, c.y - 120, { color: '#8eea7a' }); }
    if (it.focus) { const v = Math.min(it.focus, st.maxFocus - P.focus); P.focus += v; Floaters.add('+' + Math.round(v) + ' FOCUS', c.x, c.y - 60, { color: '#8cc8ff', size: 42 }); }
    if (it.mad) this.addMadness(it.mad);
    Particles.spawn('glow', c.x, c.y + 100, 26, { color: k === 'rune' ? 'rgba(255,80,30,0.9)' : 'rgba(140,255,140,0.9)', angle: -Math.PI / 2, spread: 0.6, speed: 380, g: -100, life: 1.1 });
    await wait(0.8);
  }

  addMadness(v) {
    const P = this.P, before = P.madness;
    P.madness = clamp(P.madness + v, 0, 100);
    const c = this.ericCenter();
    const d = Math.round(P.madness - before);
    if (d > 0) { Floaters.add(`+${d} MADNESS`, c.x + 80, c.y - 40, { color: '#ff6a5a', size: 34, delay: 0.25 }); AudioSys.sfx('madness'); }
    if (d < 0) Floaters.add(`${d} MADNESS`, c.x + 80, c.y - 40, { color: '#ffd28a', size: 30, delay: 0.25 });
    if (before < 70 && P.madness >= 70 && P.madness < 100) { Floaters.add('SEEING RED!', c.x, c.y - 260, { color: '#ff4a2a', size: 60, delay: 0.5, life: 1.8 }); }
    if (before < 100 && P.madness >= 100) {
      Floaters.add('RED FURY READY!', c.x + 60, c.y - 280, { color: '#ffcf5a', size: 66, delay: 0.5, life: 2.2 });
      wait(0.5).then(() => { AudioSys.sfx('fury'); shake(14); screenFlash('#ff2a0a', 0.35); });
    }
  }

  calc(kind, power, target, rating, o = {}) {
    const st = statsFor(this.P.level);
    let m = (kind === 'axe' ? st.atk : st.wit) * power;
    let mod = TYPE_MOD[target.type][kind];
    if (o.fury) mod = Math.max(1, mod);
    m *= mod * ({ perfect: 1.5, good: 1.15, weak: 0.7 }[rating] || 1) * rand(0.92, 1.08);
    if (target.flagged > 0) m *= 1.4;
    m *= 1 + 0.08 * (this.combo || 0);
    if (kind === 'axe' && this.P.madness >= 70 && !o.fury) m *= 1.25;
    let shielded = false;
    if (target.d.shielded && this.enemies.some(e => e.id === 'tentacle' && e.alive)) { m *= o.fury ? 0.5 : 0.25; shielded = true; }
    return { dmg: Math.max(1, Math.round(m)), mod, shielded };
  }

  hitEnemy(e, kind, power, rating, o = {}) {
    if (!e.alive) return;
    const r = this.calc(kind, power, e, rating, o);
    e.hp -= r.dmg; e.flash = 1;
    const c = this.ecenter(e);
    const crit = rating === 'perfect';
    Floaters.add(String(r.dmg), c.x + rand(-30, 30), c.y - 60, { color: crit ? '#ffd24a' : '#ffffff', size: crit ? 78 : 62 });
    if (r.shielded) Floaters.add('SHIELDED', c.x, c.y - 140, { color: '#b99cff', size: 40, delay: 0.1 });
    else if (r.mod >= 1.5) Floaters.add('EFFECTIVE!', c.x, c.y - 140, { color: '#ffb347', size: 40, delay: 0.1 });
    else if (r.mod < 0.8) Floaters.add('RESISTED', c.x, c.y - 140, { color: '#aaa', size: 36, delay: 0.1 });
    if (crit) { this.P.tally.perfect++; AudioSys.sfx('crit', { x: c.x }); this.addPunch(0.045, c.x, c.y); }
    this.burst(c.x, c.y, crit ? 1.5 : 1, crit ? '255,215,120' : '255,240,210');
    if (e.hp > 0 && (e.d.draw === 'sprite' || e.d.draw === 'person' || e.d.draw === 'paper')) {
      tween(e, { sx: 1.1, sy: 0.9 }, 0.05, Ease.outQuad).then(() => { if (e.alive) tween(e, { sx: 1, sy: 1 }, 0.3, Ease.outBack); });
    }
    // impact particles
    const t = e.type;
    if (t === 'cargo' || t === 'tree') { Particles.spawn('chip', c.x, c.y, 26, { color: ['#8a5a33', '#b07a45', '#5a3a1f', '#d9a46a'], speed: 900, size: 12, ground: e.y + 10 }); AudioSys.sfx('crackWood', { x: c.x }); }
    else if (t === 'rope') { Particles.spawn('chip', c.x, c.y, 22, { color: ['#d9c9a0', '#a8946a', '#efe2c0'], speed: 700, size: 9, ground: e.y + 10 }); AudioSys.sfx('snapRope', { x: c.x }); }
    else if (t === 'paper') { Particles.spawn('paper', c.x, c.y, 22, { color: ['#f6ead0', '#efe0bd', '#ffffff'], speed: 650, g: 260 }); AudioSys.sfx('ripPaper', { x: c.x }); }
    else if (t === 'tentacle' || t === 'kraken') { Particles.spawn('drop', c.x, c.y, 26, { color: ['#3a1a4a', '#7a3d8a', '#1a0a22'], speed: 800, size: 9 }); AudioSys.sfx('squelch', { x: c.x }); }
    else { Particles.spawn('spark', c.x, c.y, 18, { color: '#ffd9a0', speed: 1000, size: 10 }); AudioSys.sfx('thud', { x: c.x }); }
    Particles.spawn('spark', c.x, c.y, crit ? 16 : 8, { color: '#fff3c0', speed: 1100, size: 12 });
    shake(crit ? 22 : 12); hitstop(crit ? 0.11 : 0.05);
    tween(e, { offX: e.offX + 26 }, 0.06).then(() => tween(e, { offX: 0 }, 0.3));
    // axes vs paperwork — copies!
    if (kind === 'axe' && e.d.copies && e.hp > 0 && this.alive().length < 4 && Math.random() < 0.6) wait(0.35).then(() => this.spawnCopy(e));
    if (e.hp <= 0) this.kill(e, kind);
  }
  spawnCopy(src) {
    const used = this.enemies.filter(e => e.alive).map(e => e.x);
    const slots = [1050, 1250, 1450, 1650, 1800].filter(x => used.every(u => Math.abs(u - x) > 150));
    if (!slots.length) return;
    const e = this.addEnemy('duplicate', pick(slots), GROUND + 20);
    e.offX = src.x - e.x; e.alpha = 1;
    tween(e, { offX: 0 }, 0.6, Ease.outBack);
    Floaters.add('COPIES MADE!', e.x, GROUND - 420, { color: '#f6ead0', size: 46 });
    AudioSys.sfx('paper');
  }
  kill(e, kind) {
    e.alive = false;
    if (kind === 'axe') this.P.tally.chopped++; else this.P.tally.filed++;
    const c = this.ecenter(e);
    const word = kind === 'axe' ? (e.type === 'paper' ? 'SHREDDED!' : 'CHOPPED!') : kind === 'fury' ? 'OBLITERATED!' : 'FILED!';
    wait(0.15).then(() => Floaters.add(word, c.x, c.y - 220, { color: '#ffcf6a', size: 64, life: 1.5 }));
    if (e.type === 'paper') Particles.spawn('paper', c.x, c.y, 40, { color: ['#f6ead0', '#efe0bd', '#fff'], speed: 900, g: 200, life: 2 });
    else if (e.type === 'tentacle' || e.type === 'kraken') { Particles.spawn('drop', c.x, c.y, 60, { color: ['#3a1a4a', '#7a3d8a'], speed: 1000, size: 10 }); AudioSys.sfx('splash'); }
    else Particles.spawn('chip', c.x, c.y, 50, { color: ['#8a5a33', '#b07a45', '#5a3a1f'], speed: 1100, size: 14, ground: e.y + 10 });
    Particles.spawn('smoke', c.x, c.y + 40, 14, { color: 'rgba(200,190,180,1)', speed: 200, size: 30, life: 1.4 });
    Particles.spawn('glow', c.x, c.y, 18, { color: 'rgba(255,190,110,0.9)', angle: -Math.PI / 2, spread: 1.2, speed: 380, g: -120, life: 1.3, size: 7 });
    e.flash = 1; e.intent = null;
    this.burst(c.x, c.y, 2.2, '255,200,140');
    const t2 = e.type;
    AudioSys.sfx(t2 === 'paper' ? 'diePaper' : t2 === 'people' ? 'diePerson' : (t2 === 'tentacle' || t2 === 'kraken') ? 'dieTentacle' : 'dieWood', { x: c.x });
    this.addPunch(0.06, c.x, c.y);
    if (!this.alive().length) { slowmo(0.28, 0.75); this.addPunch(0.1, c.x, c.y); }
    if (e.d.draw === 'tentacle') tween(e, { offY: 520, alpha: 0.0 }, 1.0, Ease.inCubic);
    else if (e.d.draw === 'kraken') {
      tween(e, { offY: 600 }, 2.4, Ease.inCubic); AudioSys.sfx('roar'); shake(30);
      for (const t of this.enemies) if (t.id === 'tentacle' && t.alive) this.kill(t, kind);
    }
    else tween(e, { alpha: 0, sy: 0.7, offY: 30 }, 0.6, Ease.inQuad);
  }

  // timing minigames -------------------------------------------------------
  runQTE(kind, o) {
    return new Promise(res => {
      this.qte = Object.assign({ kind, t: 0, res, done: false, hard: this.P.madness >= 70 }, o);
      if (kind === 'ring') this.qte.dur = 0.95 / (o.speed || 1);
      if (kind === 'bar') { this.qte.dur = 1.05; this.qte.zone = rand(0.45, 0.8); this.qte.zw = this.qte.hard ? 0.09 : 0.17; }
    });
  }
  resolveQTE(pressed) {
    const q = this.qte; if (!q || q.done) return;
    q.done = true;
    let rating = 'weak';
    if (pressed) {
      if (q.kind === 'ring') {
        const r = 190 * (1 - q.t / q.dur), d = Math.abs(r - 55);
        rating = d < 13 ? 'perfect' : d < 34 ? 'good' : 'weak';
      } else {
        const p = q.t / q.dur, d = Math.abs(p - q.zone);
        rating = d < q.zw * 0.3 ? 'perfect' : d < q.zw ? 'good' : 'weak';
      }
    }
    q.rating = rating; q.endT = 0;
    if (rating === 'perfect') { this.stats.perfects++; this.addCombo(); }
    else if (rating === 'weak') this.breakCombo();
    AudioSys.sfx(rating === 'perfect' ? 'qtePerfect' : rating === 'good' ? 'qteGood' : 'qteMiss');
    const label = { perfect: 'PERFECT!', good: 'GOOD', weak: pressed ? 'SLOPPY' : 'TOO SLOW' }[rating];
    const pos = q.kind === 'ring' ? { x: q.x, y: q.y - 150 } : { x: W / 2, y: 250 };
    Floaters.add(label, pos.x, pos.y, { color: rating === 'perfect' ? '#ffd24a' : rating === 'good' ? '#cfefff' : '#ff8a7a', size: 50, life: 0.9 });
    const r = q.res; wait(0.05).then(() => { this.qte = null; r(rating); });
  }

  async axeAttack(sk, target) {
    const e = this.eric;
    if (sk.target === 'one') {
      const tc = this.ecenter(target);
      const dx = (target.x - e.x) - (target.d.draw === 'kraken' ? 420 : target.d.draw === 'tentacle' ? 230 : 250);
      AudioSys.sfx('step');
      e.axeA = -0.5; if (sk.power > 1.5) e.axeB = -0.5;
      tween(e, { offX: dx }, 0.4, Ease.inOutCubic);
      const rating = await this.runQTE('ring', { x: tc.x, y: tc.y, speed: sk.speed });
      const dual = e.axeB != null, ax = a => dual ? { axeA: a, axeB: a } : { axeA: a };
      await tween(e, Object.assign(ax(-2.5), { rot: -0.07, offY: sk.power > 1.5 ? -60 : 0 }), 0.14, Ease.outQuad);
      AudioSys.sfx(sk.power > 1.5 ? 'heavySwing' : 'swing', { x: e.x + e.offX });
      await tween(e, Object.assign(ax(1.8), { rot: 0.1, offY: 0 }), 0.09, Ease.inQuad);
      AudioSys.sfx('chop');
      const hx = e.x + e.offX + HAND_R.x * e.s, hy = e.y + HAND_R.y * e.s;
      Slashes.add(hx, hy, 230, -2.2, 1.0, { w: 40 });
      if (e.axeB != null) Slashes.add(hx - 60, hy + 20, 210, -2.3, 0.9, { w: 34, color: '255,200,160' });
      this.hitEnemy(target, 'axe', sk.power, rating);
      if (sk.power > 1.5) { shake(26); this.shockwaves.push({ x: tc.x, y: target.y, t: 0 }); }
      await wait(0.3);
      tween(e, ax(0.4), 0.2);
      await tween(e, { offX: 0, rot: 0 }, 0.45, Ease.inOutCubic);
      e.axeA = null; e.axeB = null;
    } else {
      // Whirling axes — spin through the whole enemy line
      e.axeA = 0; e.axeB = Math.PI;
      tween(e, { offX: 520 }, 0.4, Ease.inOutCubic);
      const rating = await this.runQTE('ring', { x: e.x + 520 + 10, y: e.y - 330, speed: 1 });
      const targets = this.alive();
      e.axeSpin = 1;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]; if (!t.alive) continue;
        AudioSys.sfx('swing', { x: t.x });
        await tween(e, { offX: (t.x - e.x) - 200 }, 0.14, Ease.inOutQuad);
        const tc = this.ecenter(t);
        Slashes.add(tc.x - 60, tc.y, 200, -Math.PI, Math.PI * 0.6, { w: 36 });
        AudioSys.sfx('chop');
        this.hitEnemy(t, 'axe', sk.power, rating);
        await wait(0.12);
      }
      e.axeSpin = 0;
      await tween(e, { offX: 0, rot: 0 }, 0.5, Ease.inOutCubic);
      e.axeA = null; e.axeB = null;
    }
  }

  async stampOn(target, img, rating, power, kind = 'paper') {
    const c = this.ecenter(target);
    const st = { img, x: c.x, y: c.y, t: 0, rot: rand(-0.25, 0.15), s: 0.55 };
    this.stamps.push(st);
    await wait(0.14);
    AudioSys.sfx('stamp'); shake(14);
    Particles.spawn('ink', c.x, c.y, 14, { color: ['#a01a12', '#c4271b'], speed: 500, size: 6 });
    if (power > 0) this.hitEnemy(target, kind, power, rating);
  }

  async paperAction(sk, target) {
    const e = this.eric;
    const ec = this.ericCenter();
    // Eric produces paperwork
    Particles.spawn('paper', ec.x + 60, ec.y, 12, { color: ['#f6ead0', '#fff'], speed: 400, g: 150, angle: -Math.PI / 2, spread: 1 });
    AudioSys.sfx('paper');
    if (sk === SKILLS.inspect) {
      await tween(e, { offX: 60, rot: 0.04 }, 0.25);
      const c = this.ecenter(target);
      Particles.spawn('glow', c.x, c.y, 20, { color: 'rgba(255,230,140,0.9)', speed: 260, g: 0, life: 0.9 });
      target.flagged = 3; target.revealed = true;
      this.stamps.push({ img: G.img._stamp_flag, x: c.x, y: c.y - 40, t: 0, rot: -0.2, s: 0.5 });
      await wait(0.14); AudioSys.sfx('stamp');
      this.hitEnemy(target, 'paper', sk.power, 'good');
      const tm = TYPE_MOD[target.type];
      this.showCaption(`${target.name} — ${tm.label}. Weak to: ${tm.weak}`, 3.2);
      await wait(0.6);
      await tween(e, { offX: 0, rot: 0 }, 0.3);
      return;
    }
    const rating = await this.runQTE('bar', {});
    if (sk === SKILLS.claim) {
      const st = statsFor(this.P.level);
      const amt = Math.round(st.maxHp * 0.36 * ({ perfect: 1.45, good: 1.15, weak: 0.75 }[rating]));
      const v = Math.min(amt, st.maxHp - this.P.hp); this.P.hp += v;
      this.stamps.push({ img: G.img._stamp_app, x: ec.x, y: ec.y - 60, t: 0, rot: -0.15, s: 0.55 });
      await wait(0.14); AudioSys.sfx('stamp'); AudioSys.sfx('heal');
      Floaters.add('+' + v + ' HP', ec.x, ec.y - 180, { color: '#8eea7a', size: 62 });
      Particles.spawn('glow', ec.x, ec.y + 200, 30, { color: 'rgba(140,255,140,0.9)', angle: -Math.PI / 2, spread: 0.5, speed: 420, g: -60, life: 1.2 });
      this.P.tally.filed++;
      await wait(0.6); return;
    }
    if (sk.target === 'all') {
      for (const t of this.alive()) {
        const c = this.ecenter(t);
        Particles.spawn('paper', ec.x + 60, ec.y, 8, { color: ['#f6ead0', '#fff'], angle: Math.atan2(c.y - ec.y, c.x - ec.x), spread: 0.25, speed: 1300, g: 0, life: 0.6 });
        await this.stampOn(t, G.img._stamp_bal, rating, sk.power);
        await wait(0.12);
      }
    } else {
      await tween(e, { offX: 90, rot: 0.05 }, 0.2);
      await this.stampOn(target, G.img._stamp_rej, rating, sk.power);
      await wait(0.3);
      await tween(e, { offX: 0, rot: 0 }, 0.3);
    }
    await wait(0.3);
  }

  async fury() {
    const P = this.P, e = this.eric;
    P.tally.furies++;
    this.furyCine = { t: 0 };
    AudioSys.sfx('fury'); shake(28); screenFlash('#ff3010', 0.55);
    await wait(1.6);
    this.furyCine = null; this.furyMode = true;
    e.axeA = -0.5; e.axeB = -0.5;
    for (let i = 0; i < 6; i++) {
      const alive = this.alive(); if (!alive.length) break;
      const t = pick(alive), tc = this.ecenter(t);
      AudioSys.sfx('swing', { x: t.x, pitch: 0.85 + i * 0.05 });
      await tween(e, { offX: (t.x - e.x) - 240 + rand(-40, 40), axeA: -2.6, axeB: -2.2 }, 0.13, Ease.inOutQuad);
      await tween(e, { axeA: 1.8, axeB: 1.6 }, 0.07, Ease.inQuad);
      Slashes.add(tc.x - 40, tc.y, 220, i % 2 ? 0.9 : -2.2, i % 2 ? -2.2 : 0.9, { w: 46, color: '255,120,60' });
      AudioSys.sfx('chop');
      this.hitEnemy(t, 'axe', 0.85, 'good', { fury: true });
      if (!t.alive) { t._killedBy = 'fury'; }
      screenFlash('#ff2a0a', 0.18);
      await wait(0.09);
    }
    // finale: leap + ground slam on everything
    await tween(e, { offX: 560, offY: -260, axeA: -2.8, axeB: -2.8 }, 0.32, Ease.outQuad);
    AudioSys.sfx('heavySwing');
    await tween(e, { offY: 0, axeA: 1.9, axeB: 1.9 }, 0.14, Ease.inQuad);
    AudioSys.sfx('slam'); AudioSys.sfx('chop'); AudioSys.sfx('crit'); shake(40); hitstop(0.15); screenFlash('#ffffff', 0.5);
    this.addPunch(0.11, e.x + 560, GROUND - 200); this.burst(e.x + 560, GROUND - 40, 3, '255,150,80');
    this.shockwaves.push({ x: e.x + 560, y: GROUND, t: 0, big: true });
    Particles.spawn('chip', e.x + 560, GROUND, 60, { color: ['#6a4a2a', '#3a2a1a', '#8a6a4a'], angle: -Math.PI / 2, spread: 1.2, speed: 1300, size: 14, ground: GROUND + 20 });
    for (const t of this.alive()) this.hitEnemy(t, 'axe', 0.6, 'good', { fury: true });
    this.addMadness(-100);
    await wait(0.6);
    this.furyMode = false;
    await tween(e, { offX: 0, rot: 0 }, 0.5, Ease.inOutCubic);
    e.axeA = null; e.axeB = null;
  }

  // ------------------------------------------------------------------ enemy turn
  armBlock() { this.block = { armed: true, open: false, hit: false, early: false, parry: false, earlyAt: -9 }; }
  // returns 'parry' (pressed the instant the ! lit — or a hair before), true (blocked) or false
  async blockWindow(len = 0.26) {
    const b = this.block;
    b.open = true; b.openT = 0;
    if (b.early && this.t - b.earlyAt < 0.07) { b.early = false; b.hit = true; b.parry = true; }
    await wait(len); b.open = false; b.armed = false;
    return b.parry ? 'parry' : b.hit;
  }

  async enemyAct(e) {
    const P = this.P;
    const mv = e.intent || this.pickMove(e);
    e.intent = null;
    this.showCaption(`${e.name}: ${mv.name}`, 1.5);
    if (mv.line) this.bubble(e, mv.line);
    e.flash = 0.35;
    await wait(0.55);
    const eric = this.eric, ec = this.ericCenter();
    let blocked = false;
    switch (mv.fx) {
      case 'self': {
        const c = this.ecenter(e);
        if (mv.heal) {
          const v = Math.round(e.maxHp * mv.heal); e.hp = Math.min(e.maxHp, e.hp + v);
          Floaters.add('+' + v, c.x, c.y - 80, { color: '#8eea7a' }); AudioSys.sfx('heal');
          Particles.spawn('glow', c.x, c.y + 80, 20, { color: 'rgba(140,255,140,0.9)', angle: -Math.PI / 2, spread: 0.5, speed: 300, g: -60 });
        } else { AudioSys.sfx('roar'); shake(10); Particles.spawn('glow', c.x, c.y, 24, { color: 'rgba(200,120,255,0.9)', speed: 500, g: 0 }); }
        await wait(0.4);
        if (mv.mad) this.hitEric(e, { mad: mv.mad, dmg: 0 }, false);
        await wait(0.4);
        return;
      }
      case 'lunge': case 'roll': {
        this.armBlock();
        const dx = (eric.x + 200) - e.x;
        await tween(e, { offX: 40 }, 0.18, Ease.outQuad);
        AudioSys.sfx('whoosh');
        tween(e, { offX: dx, rot: mv.fx === 'roll' ? -TAU : -0.12 }, 0.34, Ease.inQuad);
        await wait(0.1);
        blocked = await this.blockWindow(0.24);
        this.hitEric(e, mv, blocked);
        await tween(e, { offX: 0, rot: 0 }, 0.45, Ease.outCubic);
        e.rot = 0;
        return;
      }
      case 'slam': {
        this.armBlock();
        tween(e, { rot: -0.32 }, 0.36, Ease.inQuad);
        await wait(0.12);
        blocked = await this.blockWindow(0.24);
        this.shockwaves.push({ x: ec.x + 60, y: GROUND, t: 0 });
        Particles.spawn('leaf', ec.x + 40, ec.y - 100, 24, { color: ['#6a8a2a', '#9ab83a', '#4a6a1a'], speed: 500, g: 300, size: 8 });
        this.hitEric(e, mv, blocked);
        await tween(e, { rot: 0 }, 0.5, Ease.outBack);
        return;
      }
      case 'tentacle': {
        this.armBlock();
        tween(e, { attackT: 1 }, 0.36, Ease.inQuad);
        await wait(0.12);
        blocked = await this.blockWindow(0.24);
        AudioSys.sfx('splash');
        this.hitEric(e, mv, blocked);
        await tween(e, { attackT: 0 }, 0.6, Ease.outCubic);
        return;
      }
      case 'wave': {
        this.armBlock();
        AudioSys.sfx('roar'); shake(12);
        const wv = { x: e.x, t: 0 }; this.wave = wv;
        tween(wv, { x: eric.x + 100 }, 0.75, Ease.inQuad);
        await wait(0.5);
        blocked = await this.blockWindow(0.25);
        AudioSys.sfx('splash');
        Particles.spawn('drop', ec.x, ec.y, 60, { color: ['#9fb6d8', '#dfe9ff', '#6a86b0'], speed: 1100, size: 8 });
        this.hitEric(e, mv, blocked);
        this.wave = null;
        await wait(0.4);
        return;
      }
      case 'proj': default: {
        this.armBlock();
        const c = this.ecenter(e);
        tween(e, { offX: 30 }, 0.1).then(() => tween(e, { offX: 0 }, 0.3));
        const p = { kind: mv.proj || 'paper', x0: c.x - 40, y0: c.y, x1: ec.x + 30, y1: ec.y, t: 0, dur: 0.6 };
        this.projs.push(p);
        AudioSys.sfx(p.kind === 'paper' ? 'paper' : 'whoosh');
        await wait(0.36);
        blocked = await this.blockWindow(0.24);
        this.projs.splice(this.projs.indexOf(p), 1);
        if (p.kind === 'ink') Particles.spawn('ink', ec.x, ec.y, 26, { color: ['#1a0a22', '#3a1a4a'], speed: 600, size: 9 });
        if (p.kind === 'paper') Particles.spawn('paper', ec.x, ec.y, 14, { color: ['#f6ead0', '#fff'], speed: 500, g: 260 });
        if (p.kind === 'mead') Particles.spawn('drop', ec.x, ec.y, 26, { color: ['#e6a92a', '#ffd36a'], speed: 600, size: 6 });
        if (p.kind === 'crate' || p.kind === 'splinter') Particles.spawn('chip', ec.x, ec.y, 22, { color: ['#8a5a33', '#b07a45'], speed: 700, size: 10, ground: GROUND });
        this.hitEric(e, mv, blocked);
        await wait(0.3);
        return;
      }
    }
  }

  hitEric(e, mv, blocked) {
    const P = this.P, er = this.eric, c = this.ericCenter();
    const parried = blocked === 'parry';
    if (parried) {
      P.tally.blocks++; this.addCombo();
      AudioSys.sfx('parry', { x: c.x + 80 }); hitstop(0.09); shake(10);
      Floaters.add('PARRY!', c.x + 40, c.y - 230, { color: '#ffe27a', size: 64 });
      Particles.spawn('spark', c.x + 90, c.y - 40, 40, { color: ['#fff6d0', '#ffd27a'], speed: 1500, size: 14 });
      this.burst(c.x + 90, c.y - 40, 1.8, '255,235,160'); this.addPunch(0.05, c.x + 90, c.y - 40);
      if (['lunge', 'roll', 'slam', 'tentacle'].includes(mv.fx) && e.alive) {
        wait(0.1).then(async () => {
          if (!e.alive) return;
          er.axeA = -2.4; AudioSys.sfx('swing', { x: c.x + 150 });
          await tween(er, { axeA: 1.6 }, 0.08, Ease.inQuad);
          AudioSys.sfx('chop', { x: c.x + 200 });
          Floaters.add('COUNTER!', c.x + 220, c.y - 300, { color: '#ffcf6a', size: 46 });
          this.hitEnemy(e, 'axe', 0.45, 'good');
          await wait(0.25); er.axeA = null;
        });
      }
      return;
    }
    let dmg = e.d.atk * (mv.dmg || 0) * rand(0.9, 1.1);
    if (mv.audit) dmg *= 1 + P.madness / 100;
    if (blocked) dmg *= 0.5;
    if (this.braced) dmg *= 0.5;
    dmg = Math.round(dmg);
    if (blocked) {
      P.tally.blocks++;
      AudioSys.sfx('clang', { x: c.x + 80 });
      Floaters.add('BLOCKED!', c.x + 40, c.y - 220, { color: '#bfe4ff', size: 52 });
      Particles.spawn('spark', c.x + 80, c.y - 40, 24, { color: '#cfefff', speed: 1200, size: 12 });
    }
    if (dmg > 0) {
      P.hp = Math.max(0, P.hp - dmg); this.stats.dmgTaken += dmg;
      if (!blocked) { this.breakCombo(); AudioSys.sfx('thud', { x: c.x }); }
      er.flash = 1; er.flashColor = '#ff3a2a';
      Floaters.add('-' + dmg, c.x + rand(-20, 20), c.y - 120, { color: '#ff5a4a', size: 62 });
      if (!blocked) AudioSys.sfx('hurt');
      shake(blocked ? 6 : 14); hitstop(0.05);
      tween(er, { offX: -40 }, 0.08).then(() => tween(er, { offX: 0 }, 0.35));
    }
    let mad = (mv.mad || 0) * (blocked ? 0.5 : 1) + (dmg > 0 ? 3 : 0);
    if (mad > 0) this.addMadness(Math.round(mad));
    if (mv.steal) {
      const have = Object.keys(P.items).filter(k => P.items[k] > 0);
      if (have.length && !blocked) {
        const k = pick(have); P.items[k]--;
        Floaters.add(`Stole ${ITEMS[k].name}!`, c.x + 120, c.y - 300, { color: '#ffb0a0', size: 40, life: 1.8, delay: 0.3 });
      }
    }
  }

  // ------------------------------------------------------------------ results
  async victory() {
    this.ui.mode = 'end';
    const grade = this.grade();
    Music.intensity({ rage: 0, fury: 0 });
    await wait(0.9);
    AudioSys.stopMusic(0.35); AudioSys.sting('victory');
    const P = this.P, enc = this.enc;
    const res = { type: 'win', t: 0, xp: enc.xp, leveled: [], drops: enc.drops, grade };
    const R = Game.save.ratings || (Game.save.ratings = {}), order = 'SABC';
    res.best = R[this.encId]; res.newBest = !res.best || order.indexOf(grade) < order.indexOf(res.best);
    if (res.newBest) R[this.encId] = grade;
    if (!enc.final) {
      P.xp += enc.xp;
      while (P.level < MAX_LEVEL && P.xp >= xpToNext(P.level)) {
        P.xp -= xpToNext(P.level); P.level++; res.leveled.push(P.level);
        const st = statsFor(P.level); P.hp = st.maxHp; P.focus = st.maxFocus;
      }
      if (P.level >= MAX_LEVEL) P.xp = 0;
      for (const k in enc.drops) P.items[k] = (P.items[k] || 0) + enc.drops[k];
    }
    P.focus = Math.min(statsFor(P.level).maxFocus, P.focus + 10);
    this.result = res;
    await wait(0.3);
    AudioSys.sfx('slam'); shake(18);
    if (res.leveled.length) wait(1.9).then(() => AudioSys.sting('levelup'));
  }
  async defeat() {
    this.ui.mode = 'end';
    Music.intensity({ rage: 0, fury: 0 });
    AudioSys.stopMusic(0.6);
    await tween(this.eric, { rot: -0.5, offY: 40, alpha: 0.6 }, 0.8, Ease.inQuad);
    AudioSys.sfx('bodyfall'); AudioSys.sting('defeat');
    this.result = { type: 'lose', t: 0 };
    await wait(0.3); AudioSys.sfx('slam');
  }
  retry() {
    Object.assign(Game.player, JSON.parse(JSON.stringify(this.snapshot)));
    goto(new BattleScene(this.encId, this.done));
  }

  // ------------------------------------------------------------------ update
  update(dt, rdt) {
    this.t += dt;
    Slashes.update(dt);
    const er = this.eric;
    er.flash = Math.max(0, er.flash - dt * 3);
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt * 3);
      e.blinkAt -= dt; if (e.blinkAt < -0.14) e.blinkAt = rand(2, 5);
    }
    for (const s of this.stamps) s.t += dt;
    this.stamps = this.stamps.filter(s => s.t < 1.1);
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter(b => b.t < b.dur);
    for (const p of this.projs) p.t += dt;
    for (const s of this.shockwaves) s.t += dt;
    this.shockwaves = this.shockwaves.filter(s => s.t < 0.6);
    if (this.caption) { this.caption.t += dt; if (this.caption.t > this.caption.dur) this.caption = null; }
    if (this.turnBanner) { this.turnBanner.t += dt; if (this.turnBanner.t > 1.2) this.turnBanner = null; }
    if (this.furyCine) this.furyCine.t += rdt;
    if (this.result) this.result.t += rdt;
    this.ambient(dt);
    // v2 feel
    this.punch.z *= Math.pow(0.004, rdt); if (this.punch.z < 0.001) this.punch.z = 0;
    for (const b of this.bursts) b.t += rdt;
    this.bursts = this.bursts.filter(b => b.t < 0.28);
    for (const f of this.fog) { f.x += f.v * dt; if (f.x > W + 200) f.x = -1300; if (f.x < -1400) f.x = W + 100; }
    this.comboT += rdt;
    if (this.block.open) this.block.openT += dt;
    if (!this.result) {
      const m = this.P.madness;
      Music.intensity({ rage: m >= 70 ? clamp((m - 60) / 40, 0, 1) : 0, fury: (this.furyMode || this.furyCine) ? 1 : m >= 100 ? 0.35 : 0 });
      const hpf = this.P.hp / statsFor(this.P.level).maxHp;
      this.hbT -= rdt; this.hbFlash = Math.max(0, this.hbFlash - rdt * 2.2);
      if (hpf > 0 && hpf < 0.3 && this.hbT <= 0) { AudioSys.sfx('heartbeat'); this.hbFlash = 1; this.hbT = hpf < 0.15 ? 0.7 : 0.95; }
    }

    // rage embers
    if (this.P.madness >= 70 && Math.random() < dt * (this.P.madness >= 100 ? 40 : 14)) {
      Particles.spawn('glow', er.x + er.offX + rand(-120, 120), er.y - rand(0, 500), 1, { color: 'rgba(255,70,20,0.9)', angle: -Math.PI / 2, spread: 0.3, speed: 160, speedMin: 60, g: -80, life: 1.2, size: 5 });
    }

    // QTE
    if (this.qte && !this.qte.done) {
      this.qte.t += dt;
      const q = this.qte;
      // ?auto (used to record the trailer): hit every timing perfectly
      const autoHit = window.AUTOPLAY && (q.kind === 'ring' ? Math.abs(190 * (1 - q.t / q.dur) - 55) < 6 : Math.abs(q.t / q.dur - q.zone) < 0.02);
      if (autoHit || G.mouse.clicked || confirmHit()) { G.mouse.clicked = false; this.resolveQTE(true); }
      else if (this.qte.t >= this.qte.dur) this.resolveQTE(false);
    }
    if (window.AUTOPLAY && this.block.armed && this.block.open && !this.block.early) this.block.hit = true;
    // block
    if (this.block.armed && (confirmHit() || G.mouse.clicked)) {
      G.mouse.clicked = false;
      const b = this.block;
      if (b.open && !b.early) { if (!b.hit && b.openT <= 0.09) b.parry = true; b.hit = true; }
      else if (!b.open && !b.early) { b.early = true; b.earlyAt = this.t; }
    }
    if (this.ui.mode !== 'end' && this.ui.mode !== 'main' && this.ui.mode !== 'target' && !['axes', 'paper', 'items'].includes(this.ui.mode)) return;
    this.menuKeys();
  }

  ambient(dt) {
    const a = this.enc.amb;
    if (a === 'embers' && Math.random() < dt * 14) Particles.ambient('glow', { x: 0, y: H - 40, w: W, h: 40 }, { vy: rand(-90, -40), vx: rand(-10, 30), color: 'rgba(255,150,60,0.9)', size: 3, sizeMin: 1, life: rand(3, 6) });
    if (a === 'snow' && Math.random() < dt * 40) Particles.ambient('snow', { x: -100, y: -20, w: W + 200, h: 10 }, { vy: rand(60, 140), vx: rand(-30, 10), color: 'rgba(255,255,255,0.85)', size: 3.5, sizeMin: 1, life: 12, layer: Math.random() < 0.3 ? 'front' : 'back' });
    if (a === 'leaves' && Math.random() < dt * 4) Particles.ambient('leaf', { x: 0, y: -20, w: W, h: 10 }, { vy: rand(50, 110), vx: rand(20, 80), color: ['#8aa83a', '#c9a23a', '#6a8a2a', '#b8742a'], size: 7, sizeMin: 4, life: 14 });
    if (a === 'storm') {
      if (Math.random() < dt * 110) Particles.ambient('rain', { x: -200, y: -40, w: W + 300, h: 10 }, { vy: 1500, vx: -350, color: 'rgba(180,200,230,0.35)', life: 1.2, layer: Math.random() < 0.5 ? 'front' : 'back' });
      this.lightning = Math.max(0, this.lightning - dt * 2.5);
      if (Math.random() < dt * 0.12) { this.lightning = 1; wait(0.3).then(() => AudioSys.sfx('thunder')); }
    }
  }

  // ------------------------------------------------------------------ menu & input
  menuList() {
    const P = this.P, st = statsFor(P.level);
    if (this.ui.mode === 'axes' || this.ui.mode === 'paper') {
      return (this.ui.mode === 'axes' ? AXE_SKILLS : PAPER_SKILLS).map(k => {
        const s = SKILLS[k], locked = P.level < s.lvl;
        return { key: k, label: locked ? `Unlocks at Lv ${s.lvl}` : s.name, s, locked, disabled: locked || P.focus < s.focus };
      });
    }
    if (this.ui.mode === 'items') return Object.keys(ITEMS).map(k => ({ key: k, label: ITEMS[k].name, count: P.items[k] || 0, disabled: !(P.items[k] > 0) || (ITEMS[k].hp && !ITEMS[k].mad && P.hp >= st.maxHp) }));
    return [];
  }
  menuKeys() {
    const ui = this.ui;
    if (ui.mode === 'main') {
      const fury = this.P.madness >= 100;
      if (keyHit('ArrowRight', 'KeyD')) { ui.sel = ui.sel === 4 ? 0 : (ui.sel % 2 === 0 ? ui.sel + 1 : ui.sel); AudioSys.sfx('hover'); }
      if (keyHit('ArrowLeft', 'KeyA')) { ui.sel = ui.sel === 4 ? 0 : (ui.sel % 2 === 1 ? ui.sel - 1 : ui.sel); AudioSys.sfx('hover'); }
      if (keyHit('ArrowDown', 'KeyS')) { ui.sel = ui.sel === 4 ? 0 : (ui.sel < 2 ? ui.sel + 2 : ui.sel); AudioSys.sfx('hover'); }
      if (keyHit('ArrowUp', 'KeyW')) { ui.sel = ui.sel >= 2 && ui.sel < 4 ? ui.sel - 2 : (fury ? 4 : ui.sel); AudioSys.sfx('hover'); }
      if (fury && keyHit('KeyR')) this.mainSelect(4);
      if (confirmHit()) this.mainSelect(ui.sel);
    } else if (['axes', 'paper', 'items'].includes(ui.mode)) {
      const L = this.menuList();
      if (keyHit('ArrowDown', 'KeyS')) { ui.row = (ui.row + 1) % L.length; AudioSys.sfx('hover'); }
      if (keyHit('ArrowUp', 'KeyW')) { ui.row = (ui.row + L.length - 1) % L.length; AudioSys.sfx('hover'); }
      if (confirmHit()) this.subSelect(L[ui.row]);
      if (cancelHit()) { ui.mode = 'main'; AudioSys.sfx('back'); }
    } else if (ui.mode === 'target') {
      const A = this.alive();
      let i = A.indexOf(ui.targetE); if (i < 0) i = 0;
      if (keyHit('ArrowRight', 'KeyD')) { ui.targetE = A[(i + 1) % A.length]; AudioSys.sfx('hover'); }
      if (keyHit('ArrowLeft', 'KeyA')) { ui.targetE = A[(i + A.length - 1) % A.length]; AudioSys.sfx('hover'); }
      // mouse hover on enemy
      for (const e of A) { const b = this.ebox(e); if (inRect(G.mouse, b.x, b.y, b.w, b.h)) { if (ui.targetE !== e) AudioSys.sfx('hover'); ui.targetE = e; if (G.mouse.clicked) { G.mouse.clicked = false; this.confirmTarget(); return; } } }
      if (confirmHit()) this.confirmTarget();
      if (cancelHit()) { ui.mode = ui.prevMode; AudioSys.sfx('back'); }
    }
  }
  mainSelect(i) {
    const ui = this.ui; ui.sel = i;
    AudioSys.sfx('click');
    if (i === 0) { ui.mode = 'axes'; ui.row = 0; }
    if (i === 1) { ui.mode = 'paper'; ui.row = 0; }
    if (i === 2) { ui.mode = 'items'; ui.row = 0; }
    if (i === 3) this.pickAction({ type: 'brace' });
    if (i === 4 && this.P.madness >= 100) this.pickAction({ type: 'fury' });
  }
  subSelect(row) {
    if (!row || row.disabled) { AudioSys.sfx('error'); return; }
    const ui = this.ui;
    AudioSys.sfx('click');
    if (ui.mode === 'items') { this.pickAction({ type: 'item', item: row.key }); return; }
    const s = row.s;
    if (s.target === 'one') {
      ui.prevMode = ui.mode; ui.mode = 'target'; ui.pending = row.key;
      const A = this.alive();
      ui.targetE = (ui.targetE && ui.targetE.alive) ? ui.targetE : (A.find(e => e.id === 'tentacle') || A[0]);
    } else this.pickAction({ type: 'skill', skill: row.key });
  }
  confirmTarget() {
    const ui = this.ui; if (!ui.targetE || !ui.targetE.alive) return;
    AudioSys.sfx('click');
    this.pickAction({ type: 'skill', skill: ui.pending, target: ui.targetE });
  }

  // ------------------------------------------------------------------ draw
  draw(c) {
    const t = this.t, er = this.eric;
    c.save();
    if (this.punch.z > 0) { const p = this.punch; c.translate(p.x, p.y); c.scale(1 + p.z, 1 + p.z); c.translate(-p.x, -p.y); }
    // background with slow drift + shake parallax
    drawCover(c, this.bg, Math.sin(t * 0.07) * 18 + G.cam.sx * 0.4 - er.offX * 0.015, G.cam.sy * 0.4, 1.08);
    if (this.lightning > 0) { c.fillStyle = `rgba(220,230,255,${this.lightning * 0.35})`; c.fillRect(0, 0, W, H); }
    // ground darkening
    const gg = c.createLinearGradient(0, 560, 0, H);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.55, 'rgba(8,6,6,0.45)'); gg.addColorStop(1, 'rgba(4,3,3,0.85)');
    c.fillStyle = gg; c.fillRect(0, 560, W, H - 560);
    Particles.draw(c, 'back');
    c.translate(G.cam.sx, G.cam.sy);
    // Fury zoom
    if (this.furyMode) { c.translate(W / 2, H / 2); c.scale(1.04, 1.04); c.translate(-W / 2, -H / 2); }

    this.drawFog(c, 0);
    // enemies behind water
    const ordered = [...this.enemies].sort((a, b) => (a.d.draw === 'kraken' ? -1 : 0) - (b.d.draw === 'kraken' ? -1 : 0) || a.y - b.y);
    for (const e of ordered) this.drawEnemy(c, e);
    if (this.enc.kraken) { Art.drawWater(c, 830, t); this.drawDock(c); }
    if (this.wave) this.drawWave(c);
    this.drawEric(c);
    for (const s of this.shockwaves) {
      const k = s.t / 0.6;
      c.save(); c.globalAlpha = 1 - k; c.strokeStyle = s.big ? '#ffb070' : '#fff1d0'; c.lineWidth = 10 * (1 - k);
      c.beginPath(); c.ellipse(s.x, s.y, (s.big ? 700 : 260) * Ease.outCubic(k), (s.big ? 90 : 40) * Ease.outCubic(k), 0, 0, TAU); c.stroke(); c.restore();
    }
    for (const p of this.projs) this.drawProj(c, p);
    Slashes.draw(c);
    this.drawBursts(c);
    for (const s of this.stamps) {
      const k = s.t / 1.1, sc = s.t < 0.14 ? lerp(2.4, 1, Ease.inQuad(s.t / 0.14)) : 1;
      c.save(); c.translate(s.x, s.y); c.rotate(s.rot); c.scale(sc * s.s, sc * s.s); c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.drawImage(s.img, -s.img.width / 2, -s.img.height / 2); c.restore();
    }
    Particles.draw(c, 'front');
    this.drawFog(c, 1);
    c.restore();

    // madness red grade
    const m = this.P.madness / 100;
    if (m > 0.3 || this.furyMode) {
      const pulse = this.P.madness >= 70 ? 0.5 + 0.5 * Math.sin(this.t * 4) : 0.5;
      vignette(c, (this.furyMode ? 0.75 : Math.pow(m, 2) * 0.5) * (0.7 + 0.3 * pulse), '170,10,0');
    }
    vignette(c, 0.55);
    const hpf = this.P.hp / statsFor(this.P.level).maxHp;
    if (hpf > 0 && hpf < 0.3 && !this.result) vignette(c, 0.25 + 0.45 * this.hbFlash, '150,0,0');
    Floaters.draw(c);
    this.drawEnemyHUD(c);
    this.drawBubbles(c);
    this.drawQTE(c);
    this.drawBlockPrompt(c);
    this.drawUI(c);
    this.drawCaption(c);
    if (this.furyCine) this.drawFuryCine(c);
    if (this.result) this.drawResult(c);
  }

  drawFog(c, layer) {
    const fog = G.img._fog; if (!fog) return;
    const storm = this.enc.amb === 'storm';
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < this.fog.length; i++) {
      if ((i % 2) !== layer) continue;
      const f = this.fog[i], y = layer ? 905 : f.y;
      c.globalAlpha = layer ? 0.32 : (storm ? 0.55 : 0.45);
      c.drawImage(fog, f.x, y - 130 * f.s, 1000 * f.s, 260 * f.s);
    }
    c.restore();
  }
  drawBursts(c) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const b of this.bursts) {
      const k = b.t / 0.28, a = 1 - k, R = (60 + 160 * Ease.outCubic(k)) * b.s;
      c.strokeStyle = `rgba(${b.color},${a})`; c.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const an = b.rot + i * TAU / 12, r0 = R * (i % 2 ? 0.35 : 0.2), r1 = R * (i % 2 ? 0.8 : 1);
        c.lineWidth = (i % 2 ? 4 : 7) * b.s * a;
        c.beginPath(); c.moveTo(b.x + Math.cos(an) * r0, b.y + Math.sin(an) * r0); c.lineTo(b.x + Math.cos(an) * r1, b.y + Math.sin(an) * r1); c.stroke();
      }
      c.globalAlpha = a * 0.8; const gs = 200 * b.s * (1 - k * 0.5);
      c.drawImage(glowSprite(`rgba(${b.color},1)`), b.x - gs / 2, b.y - gs / 2, gs, gs); c.globalAlpha = 1;
    }
    c.restore();
  }
  drawDock(c) {
    c.save();
    const y = GROUND - 6;
    for (let x = -20; x < 760; x += 120) {
      const pg = c.createLinearGradient(x, 0, x + 26, 0); pg.addColorStop(0, '#2a1a10'); pg.addColorStop(0.5, '#5a3a22'); pg.addColorStop(1, '#22150c');
      c.fillStyle = pg; c.fillRect(x + 40, y + 20, 26, 260);
    }
    const g = c.createLinearGradient(0, y, 0, y + 46);
    g.addColorStop(0, '#7a5434'); g.addColorStop(0.3, '#5a3a22'); g.addColorStop(1, '#24160c');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-10, y); c.lineTo(740, y); c.lineTo(770, y + 46); c.lineTo(-10, y + 46); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 2;
    for (let x = 0; x < 760; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 46); c.stroke(); }
    c.fillStyle = 'rgba(255,220,170,0.12)'; c.fillRect(0, y, 740, 3);
    c.restore();
  }
  drawWave(c) {
    const w = this.wave; c.save();
    const g = c.createLinearGradient(w.x - 200, 0, w.x + 200, 0);
    g.addColorStop(0, 'rgba(160,190,230,0)'); g.addColorStop(0.5, 'rgba(160,190,230,0.75)'); g.addColorStop(1, 'rgba(60,80,120,0.9)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(w.x - 260, GROUND + 60); c.quadraticCurveTo(w.x - 80, GROUND - 420, w.x + 120, GROUND - 300); c.quadraticCurveTo(w.x + 40, GROUND - 120, w.x + 260, GROUND + 60); c.closePath(); c.fill();
    c.restore();
    if (Math.random() < 0.6) Particles.spawn('drop', w.x, GROUND - 300, 3, { color: ['#dfe9ff', '#9fb6d8'], speed: 400, size: 6 });
  }

  drawAxe(c, hx, hy, ang, flip) {
    const ax = G.img._axe;
    c.save(); c.translate(hx, hy); c.rotate(ang); if (flip) c.scale(-1, 1); c.scale(0.95, 0.95);
    c.drawImage(ax, -ax._pivot.x, -ax._pivot.y);
    c.restore();
  }
  drawEric(c) {
    const e = this.eric, img = G.img.eric, s = e.s;
    const X = e.x + e.offX, Y = e.y + e.offY;
    // shadow
    c.save(); c.globalAlpha = 0.55 * (1 - Math.min(1, -e.offY / 400));
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(X, GROUND + 6, 150, 26, 0, 0, TAU); c.fill(); c.restore();
    // rage aura
    if (this.P.madness >= 70 || this.furyMode) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const a = this.furyMode ? 1 : 0.4 + 0.25 * Math.sin(this.t * 5);
      c.globalAlpha = a; c.drawImage(glowSprite('rgba(255,40,10,0.8)'), X - 360, Y - 660, 720, 760); c.restore();
    }
    const breathe = 1 + Math.sin(this.t * 2.2) * 0.008;
    c.save(); c.translate(X, Y); c.rotate(e.rot); c.scale(s * e.sx, s * e.sy * breathe);
    c.globalAlpha = e.alpha;
    if (e.axeB != null) this.drawAxe(c, HAND_L.x, HAND_L.y, e.axeB + (e.axeSpin ? this.t * 30 : 0), false);
    c.drawImage(img, -img.width / 2, -img.height);
    if (e.flash > 0) { c.globalAlpha = e.flash * 0.42; c.drawImage(tinted(img, e.flashColor), -img.width / 2, -img.height); c.globalAlpha = e.alpha; }
    if (this.furyMode) { c.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 20); c.drawImage(tinted(img, '#ff2a0a'), -img.width / 2, -img.height); c.globalAlpha = 1; }
    if (e.axeA != null) this.drawAxe(c, HAND_R.x, HAND_R.y, e.axeA + (e.axeSpin ? this.t * 30 : 0), false);
    c.restore();
  }

  drawEnemy(c, e) {
    if (e.alpha <= 0.01) return;
    const t = this.t + e.phase;
    const d = e.d;
    c.save(); c.globalAlpha = clamp(e.alpha, 0, 1);
    if (d.draw === 'kraken') { e.shieldedNow = e.alive && this.enemies.some(o => o.id === 'tentacle' && o.alive); Art.drawKrakenBody(c, e, this.t); c.restore(); return; }
    if (d.draw === 'tentacle') { if (e.alive || e.alpha > 0) Art.drawTentacle(c, e, this.t); c.restore(); return; }
    const X = e.x + e.offX, Y = e.y + e.offY;
    let bob = 0, rot = e.rot, sx = e.sx, sy = e.sy, skew = 0;
    switch (d.idle) {
      case 'hop': { const h = Math.abs(Math.sin(t * 3)); bob = -h * 16; sy *= 1 - (1 - h) * 0.05; sx *= 1 + (1 - h) * 0.04; break; }
      case 'wobble': rot += Math.sin(t * 2.6) * 0.06; break;
      case 'rock': rot += Math.sin(t * 2.2) * 0.05; break;
      case 'sway': skew = Math.sin(t * 1.8) * 0.07; break;
      case 'tree': rot += Math.sin(t * 1.2) * 0.022; break;
      case 'breathe': sy *= 1 + Math.sin(t * 2.1) * 0.01; break;
      case 'float': bob = -150 + Math.sin(t * 2) * 16; rot += Math.sin(t * 1.6) * 0.08; break;
    }
    // shadow
    const sh = d.draw === 'paper' ? 0.5 : 1;
    c.save(); c.globalAlpha *= 0.5; c.fillStyle = '#000';
    const sw = d.draw === 'person' ? 130 : d.draw === 'paper' ? 70 : Math.min(200, d.h * 0.55);
    c.beginPath(); c.ellipse(X, e.y + 6, sw * sh, 22 * sh, 0, 0, TAU); c.fill(); c.restore();

    c.translate(X, Y + bob);
    c.rotate(rot);
    if (skew) c.transform(1, 0, skew, 1, 0, 0);
    if (d.draw === 'paper') {
      const flutter = 1 - Math.abs(Math.sin(t * 3)) * 0.07;
      c.scale(sx * flutter, sy);
      this.drawPaper(c, e, t);
    } else {
      const img = G.img[d.img];
      const s = d.h / img.height;
      c.scale(s * sx, s * sy);
      c.drawImage(img, -img.width / 2, -img.height);
      if (e.flash > 0) { c.globalAlpha *= e.flash * 0.8; c.drawImage(tinted(img, '#ffffff'), -img.width / 2, -img.height); c.globalAlpha = clamp(e.alpha, 0, 1); }
      if (d.eyes && e.alive) {
        const E = d.eyes, lid = e.blinkAt < 0 ? 0.1 : 1;
        Art.eyes(c, (E.x1 - 0.5) * img.width, (E.y1 - 1) * img.height, (E.x2 - 0.5) * img.width, (E.y2 - 1) * img.height, E.s / s * (d.h / 230), { glow: E.glow, lid, look: -0.6 });
      }
      if (e.id === 'smuggler' && e.alive) {
        c.globalCompositeOperation = 'lighter';
        for (const fx of [0.415, 0.5]) c.drawImage(glowSprite('rgba(255,40,20,0.9)'), (fx - 0.5) * img.width - 10, (0.099 - 1) * img.height - 10, 20, 20);
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.restore();
  }
  drawPaper(c, e, t) {
    const d = e.d;
    const lid = e.blinkAt < 0 ? 0.1 : 1;
    if (d.sheet === 'triplicate') {
      const sheets = G.img._sheet_triplicate;
      sheets.forEach((sh, i) => {
        c.save(); c.translate((i - 1) * 16 + Math.sin(t * 2 + i) * 4, -d.h - (2 - i) * 10); c.rotate((i - 1) * 0.08);
        c.drawImage(sh, -sh.width / 2, 0, sh.width, sh.height); c.restore();
      });
    } else {
      const sh = G.img['_sheet_' + d.sheet];
      if (d.sheet === 'manifest') c.globalAlpha *= 0.86 + Math.sin(t * 3) * 0.08;
      c.drawImage(sh, -sh.width / 2, -d.h - 14, sh.width, sh.height);
      if (d.sheet === 'manifest') txt(c, '?', 0, -d.h * 0.42, { size: 70, fam: F.title, weight: 900, align: 'center', base: 'middle', color: 'rgba(120,30,20,0.55)', shadow: false });
    }
    if (e.flash > 0) { c.save(); c.globalAlpha = e.flash * 0.6; c.fillStyle = '#fff'; c.fillRect(-90, -d.h - 10, 180, d.h + 20); c.restore(); }
    if (e.alive) {
      const es = d.h / 18;
      Art.eyes(c, -es * 1.5, -d.h * 0.62, es * 1.5, -d.h * 0.62, es, { lid, look: -0.5 });
      // grumpy mouth
      c.strokeStyle = '#2b1810'; c.lineWidth = es * 0.35; c.lineCap = 'round';
      c.beginPath(); c.arc(0, -d.h * 0.38, es * 1.2, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
    }
  }
  drawProj(c, p) {
    const k = clamp(p.t / p.dur, 0, 1);
    const x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * (p.kind === 'crate' ? 260 : 90);
    c.save(); c.translate(x, y); c.rotate(p.t * (p.kind === 'paper' ? 10 : 7));
    if (p.kind === 'paper') { const sh = G.img._invoice; c.drawImage(sh, -35, -45, 70, 90); }
    else if (p.kind === 'ink') { c.fillStyle = '#1a0a22'; c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill(); c.fillStyle = '#5a2a6a'; c.beginPath(); c.arc(-8, -8, 8, 0, TAU); c.fill(); }
    else if (p.kind === 'mead') { c.fillStyle = 'rgba(230,169,42,0.9)'; c.beginPath(); c.ellipse(0, 0, 26, 14, 0, 0, TAU); c.fill(); }
    else if (p.kind === 'crate') { const im = G.img.en_crate; c.drawImage(im, -60, -50, 120, 100); }
    else { c.fillStyle = '#8a5a33'; for (let i = 0; i < 5; i++) { c.save(); c.rotate(i * 1.3); c.fillRect(-4, -18 + i * 3, 8, 30); c.restore(); } }
    c.restore();
  }

  drawEnemyHUD(c) {
    const ui = this.ui;
    for (const e of this.enemies) {
      if (!e.alive || e.alpha < 0.5) continue;
      const p = this.etop(e);
      const w = e.d.boss ? 300 : 200;
      p.x = clamp(p.x, w / 2 + 30, W - w / 2 - 30);
      const x = p.x - w / 2, y = clamp(p.y - 40, 70, H);
      const targeted = ui.mode === 'target' && ui.targetE === e;
      txt(c, e.name, p.x, y - 10, { size: e.d.boss ? 28 : 23, fam: F.head, weight: 700, align: 'center', color: targeted ? '#ffe9a0' : '#fff' });
      bar(c, 'e' + this.enemies.indexOf(e), x, y, w, 16, e.hp, e.maxHp, '#e0553f', '#8c1c12');
      let ix = x, ly = y + 38;
      const it = this.intentInfo(e);
      if (it) {
        c.save(); c.font = font(19, F.body, 700); const tw = c.measureText(it.text).width + 26; c.restore();
        const tx = clamp(p.x, tw / 2 + 12, W - tw / 2 - 12);
        rr(c, tx - tw / 2, ly - 20, tw, 28, 14); c.fillStyle = 'rgba(12,8,6,0.72)'; c.fill();
        c.strokeStyle = it.color; c.globalAlpha = 0.55; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
        txt(c, it.text, tx, ly - 6 + 1, { size: 19, weight: 700, align: 'center', base: 'middle', color: it.color });
        ly += 30;
      }
      if (e.flagged > 0) { txt(c, `⚑ FLAGGED ${e.flagged}`, ix, ly, { size: 19, weight: 700, color: '#ff8a6a' }); ix += 140; }
      if (e.revealed) txt(c, `Weak: ${TYPE_MOD[e.type].weak.split(' (')[0].split(' —')[0]}`, x, ly + (e.flagged > 0 ? 22 : 0), { size: 19, color: '#ffd28a' });
      if (e.d.shielded && this.enemies.some(o => o.id === 'tentacle' && o.alive)) txt(c, '◈ SHIELDED by tentacles', p.x, ly + 2, { size: 21, weight: 700, align: 'center', color: '#c9b0ff' });
      if (targeted) {
        const b = Math.sin(this.t * 8) * 8, cy = y - 54 + b;
        c.save(); c.fillStyle = '#ffcf5a'; c.shadowColor = 'rgba(255,180,60,0.9)'; c.shadowBlur = 16;
        c.beginPath(); c.moveTo(p.x - 18, cy - 20); c.lineTo(p.x + 18, cy - 20); c.lineTo(p.x, cy); c.closePath(); c.fill(); c.restore();
        const bx = this.ebox(e);
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
        c.drawImage(glowSprite('rgba(255,200,90,0.8)'), bx.x + bx.w / 2 - 160, e.y - 30, 320, 70); c.restore();
      }
    }
  }
  drawBubbles(c) {
    for (const b of this.bubbles) {
      const a = b.t < 0.15 ? b.t / 0.15 : b.t > b.dur - 0.3 ? (b.dur - b.t) / 0.3 : 1;
      c.save(); c.globalAlpha = a;
      c.font = font(26, F.body, 700, 'italic');
      const w = c.measureText(b.text).width + 40, x = clamp(b.x - w / 2, 20, W - w - 20), y = Math.max(80, b.y - 110);
      rr(c, x, y, w, 52, 18); c.fillStyle = 'rgba(250,244,230,0.96)'; c.fill();
      c.beginPath(); c.moveTo(b.x - 10, y + 50); c.lineTo(b.x + 10, y + 50); c.lineTo(b.x, y + 70); c.fill();
      txt(c, b.text, x + w / 2, y + 27, { size: 26, weight: 700, style: 'italic', align: 'center', base: 'middle', color: '#2b1d12', shadow: false });
      c.restore();
    }
  }
  drawQTE(c) {
    const q = this.qte; if (!q) return;
    if (q.kind === 'ring') {
      const r = Math.max(0, 190 * (1 - q.t / q.dur));
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,200,90,0.9)'; c.lineWidth = 6; c.shadowColor = '#ffb040'; c.shadowBlur = 18;
      c.beginPath(); c.arc(q.x, q.y, 55, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,200,90,0.25)'; c.lineWidth = 30; c.beginPath(); c.arc(q.x, q.y, 55, 0, TAU); c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.shadowColor = '#fff'; c.shadowBlur = 12;
      c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.stroke();
      c.restore();
      txt(c, 'SPACE', q.x, q.y + 6, { size: 26, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#fff' });
    } else {
      const w = 640, h = 40, x = W / 2 - w / 2, y = 300;
      panel(c, x - 30, y - 70, w + 60, h + 110, { r: 12, shadowBlur: 20 });
      txt(c, 'SPACE — STAMP IT!', W / 2, y - 26, { size: 28, fam: F.head, weight: 900, align: 'center', color: C.gold, letter: 2 });
      rr(c, x, y, w, h, 8); c.fillStyle = '#e9d8b0'; c.fill();
      c.fillStyle = 'rgba(80,140,60,0.75)'; c.fillRect(x + w * (q.zone - q.zw), y + 3, w * q.zw * 2, h - 6);
      c.fillStyle = 'rgba(255,210,80,0.95)'; c.fillRect(x + w * (q.zone - q.zw * 0.3), y + 3, w * q.zw * 0.6, h - 6);
      c.lineWidth = 2; c.strokeStyle = '#6a4a2a'; rr(c, x, y, w, h, 8); c.stroke();
      const mx = x + w * clamp(q.t / q.dur, 0, 1);
      c.save(); c.translate(mx, y + h / 2); Art.icon.quill(c, 6, -26); c.fillStyle = '#c4271b'; c.fillRect(-3, -h / 2 - 6, 6, h + 12); c.restore();
      if (q.hard) txt(c, 'Hands shaking with rage — smaller zone!', W / 2, y + h + 28, { size: 20, align: 'center', color: '#ff8a6a' });
    }
  }
  drawBlockPrompt(c) {
    if (!this.block.armed) return;
    const ec = this.ericCenter(), x = ec.x + 40, y = ec.y - 330;
    const open = this.block.open, early = this.block.early;
    c.save();
    if (open && !early) { c.shadowColor = '#ffd84a'; c.shadowBlur = 30; }
    c.globalAlpha = open ? 1 : 0.35;
    Art.icon.shield(c, x, y);
    txt(c, early ? '✕' : '!', x + 34, y + 4, { size: 54, fam: F.head, weight: 900, base: 'middle', color: early ? '#ff6a5a' : '#ffe14a' });
    if (open && !early) txt(c, 'SPACE', x, y + 44, { size: 22, fam: F.head, weight: 900, align: 'center', color: '#fff' });
    c.restore();
  }
  drawCaption(c) {
    const cap = this.caption, tb = this.turnBanner;
    if (tb) {
      const k = tb.t / 1.2, a = k < 0.2 ? k / 0.2 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const x = W / 2 + (1 - Ease.outCubic(Math.min(1, k * 4))) * (tb.enemy ? 300 : -300);
      c.save(); c.globalAlpha = a;
      const g = c.createLinearGradient(x - 500, 0, x + 500, 0);
      const col = tb.enemy ? '120,20,20' : '120,80,20';
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},0.75)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(x - 500, 150, 1000, 84);
      txt(c, tb.text, x, 205, { size: 54, fam: F.title, weight: 900, align: 'center', color: '#fff3dc', letter: 4 });
      c.restore();
    }
    if (cap && !tb) {
      const a = cap.t < 0.15 ? cap.t / 0.15 : cap.t > cap.dur - 0.25 ? (cap.dur - cap.t) / 0.25 : 1;
      c.save(); c.globalAlpha = clamp(a, 0, 1);
      const sz = cap.big ? 56 : 34, f = font(sz, cap.big ? F.title : F.head, 900);
      c.font = f; const w = Math.min(1500, c.measureText(cap.text).width + 120);
      const g = c.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
      g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.15, 'rgba(10,6,4,0.8)'); g.addColorStop(0.85, 'rgba(10,6,4,0.8)'); g.addColorStop(1, 'rgba(10,6,4,0)');
      c.fillStyle = g; c.fillRect(W / 2 - w / 2, 40, w, sz + 40);
      c.fillStyle = C.goldDim; c.fillRect(W / 2 - w / 2 + 60, 40, w - 120, 1.5); c.fillRect(W / 2 - w / 2 + 60, 80 + sz, w - 120, 1.5);
      txt(c, cap.text, W / 2, 60 + sz * 0.5 + 6, { font: f, align: 'center', base: 'middle', color: cap.big ? '#ffe2b0' : '#fff' });
      c.restore();
    }
  }
  drawFuryCine(c) {
    const t = this.furyCine.t;
    c.save();
    c.fillStyle = `rgba(60,0,0,${Math.min(0.75, t * 2)})`; c.fillRect(0, 0, W, H);
    // diagonal slash band
    const k = Ease.outCubic(Math.min(1, t * 3)), out = t > 1.3 ? Ease.inCubic((t - 1.3) / 0.3) : 0;
    c.translate(W / 2, H / 2); c.rotate(-0.12);
    const bw = W * 1.4, bh = 520;
    c.save(); c.beginPath(); c.rect(-bw / 2 + (1 - k) * -bw + out * bw, -bh / 2, bw, bh); c.clip();
    const g = c.createLinearGradient(0, -bh / 2, 0, bh / 2); g.addColorStop(0, '#2a0000'); g.addColorStop(0.5, '#7a0a00'); g.addColorStop(1, '#2a0000');
    c.fillStyle = g; c.fillRect(-bw / 2, -bh / 2, bw, bh);
    const img = G.img.p_fury;
    if (img) { const s = bh / img.height * 1.35; c.drawImage(img, -bw / 2 + 250 + t * 30, -img.height * s * 0.45, img.width * s, img.height * s); }
    const ig = c.createLinearGradient(-bw / 2 + 250, 0, -bw / 2 + 900, 0); ig.addColorStop(0, 'rgba(122,10,0,0)'); ig.addColorStop(1, 'rgba(122,10,0,1)');
    c.fillStyle = ig; c.fillRect(-bw / 2 + 250, -bh / 2, 650, bh);
    c.restore();
    c.fillStyle = '#ffb070'; c.fillRect(-bw / 2, -bh / 2 - 6, bw, 6); c.fillRect(-bw / 2, bh / 2, bw, 6);
    const ts = 1 + Math.max(0, 0.6 - t) * 1.5;
    c.save(); c.translate(260 - out * 2000, 0); c.scale(ts, ts);
    txt(c, 'RED FURY!', 0, 0, { size: 150, fam: F.title, weight: 900, align: 'center', base: 'middle', color: '#ffe0a0', stroke: '#3a0000', strokeW: 14, shadowColor: 'rgba(255,60,0,0.9)', shadowBlur: 40 });
    c.restore();
    c.restore();
    if (Math.random() < 0.6) Particles.spawn('glow', rand(0, W), H + 10, 2, { color: 'rgba(255,90,20,0.9)', angle: -Math.PI / 2, spread: 0.3, speed: 900, g: 0, life: 1, layer: 'front' });
  }

  drawCombo(c) {
    if (!this.combo) return;
    const x = 28, y = 28, w = 300, h = 74, pop = this.comboT < 0.2 ? 1 + (0.2 - this.comboT) * 1.2 : 1;
    c.save(); c.translate(x + w / 2, y + h / 2); c.scale(pop, pop); c.translate(-(x + w / 2), -(y + h / 2));
    panel(c, x, y, w, h, { r: 12, ornaments: false, shadowBlur: 14 });
    txt(c, `RHYTHM ×${this.combo}`, x + 20, y + 32, { size: 28, fam: F.head, weight: 900, color: '#ffe27a', letter: 1 });
    txt(c, `+${this.combo * 8}% damage`, x + w - 18, y + 56, { size: 19, weight: 700, align: 'right', base: 'middle', color: C.textDim });
    for (let i = 0; i < 5; i++) {
      c.beginPath(); c.arc(x + 30 + i * 30, y + 54, 8, 0, TAU);
      c.fillStyle = i < this.combo ? '#ffcf5a' : 'rgba(255,255,255,0.12)'; c.fill();
    }
    c.restore();
  }
  drawUI(c) {
    this.drawCombo(c);
    const ui = this.ui, P = this.P, Y = 868;
    drawStatus(c, 20, Y, { w: 620, h: 196 });
    const active = ['main', 'axes', 'paper', 'items', 'target'].includes(ui.mode);
    // Commands
    panel(c, 656, Y, 540, 196);
    const cmds = [['AXES', Art.icon.axe], ['PAPERWORK', Art.icon.quill], ['PACK', Art.icon.pouch], ['BRACE', Art.icon.shield]];
    cmds.forEach(([label, icon], i) => {
      const bx = 676 + (i % 2) * 254, by = Y + 20 + Math.floor(i / 2) * 82;
      const selected = active && ((ui.mode === 'main' && ui.sel === i) || (ui.mode === 'axes' && i === 0) || (ui.mode === 'paper' && i === 1) || (ui.mode === 'items' && i === 2));
      const hovered = inRect(G.mouse, bx, by, 244, 72);
      if (ui.mode === 'main' && hovered) ui.sel = i;
      if (button(c, 'cmd' + i, bx, by, 244, 72, label, { icon, selected, disabled: !active, size: 26 }) && active) this.mainSelect(i);
    });
    // Fury button
    if (P.madness >= 100 && active) {
      const fx = 656, fy = Y - 92, pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
      c.save(); c.shadowColor = `rgba(255,60,10,${0.6 + pulse * 0.4})`; c.shadowBlur = 40 + pulse * 20;
      if (button(c, 'fury', fx, fy, 540, 78, 'UNLEASH RED FURY', { icon: Art.icon.flame, danger: true, selected: ui.sel === 4 && ui.mode === 'main', size: 32, sub: 'R', glow: 'rgba(255,80,20,0.9)' })) this.mainSelect(4);
      c.restore();
      if (inRect(G.mouse, fx, fy, 540, 78) && ui.mode === 'main') ui.sel = 4;
    }
    // Info / submenu
    const ix = 1212, iw = 688;
    panel(c, ix, Y, iw, 196);
    if (ui.mode === 'main') {
      const hints = ['Swing your axes. Calms Madness. Great vs. ropes, timber & tentacles.', 'Fight forms with forms. Strong vs. paperwork & people — but raises Madness.', 'Use mead, herring, ink and other supplies.', 'Halve incoming damage this turn and regain 8 Focus.', 'Unleash six berserk strikes and a ground slam. Resets Madness.'];
      txt(c, ['AXES', 'PAPERWORK', 'PACK', 'BRACE', 'RED FURY'][ui.sel], ix + 30, Y + 50, { size: 30, fam: F.head, weight: 900, color: C.gold });
      wrapLines(c, hints[ui.sel], iw - 60, font(25)).forEach((l, i) => txt(c, l, ix + 30, Y + 92 + i * 32, { size: 25 }));
      txt(c, 'Arrows + Enter, or click  •  SPACE to block — instantly to PARRY', ix + 30, Y + 176, { size: 19, color: C.textDim });
    } else if (['axes', 'paper', 'items'].includes(ui.mode)) {
      const L = this.menuList(), rh = ui.mode === 'items' ? 33 : 40, y0 = Y + 14;
      L.forEach((row, i) => {
        const ry = y0 + i * rh, hov = inRect(G.mouse, ix + 14, ry, iw - 28, rh - 2);
        if (hov && ui.row !== i) { ui.row = i; AudioSys.sfx('hover'); }
        const sel = ui.row === i;
        if (sel) { rr(c, ix + 14, ry, iw - 28, rh - 2, 8); c.fillStyle = 'rgba(216,180,106,0.18)'; c.fill(); c.strokeStyle = 'rgba(241,207,134,0.8)'; c.lineWidth = 1.5; c.stroke(); }
        c.save(); c.globalAlpha = row.disabled ? 0.4 : 1;
        if (ui.mode === 'items') { c.save(); c.translate(ix + 44, ry + rh / 2); c.scale(0.8, 0.8); Art.icon.item(c, 0, 0, row.key); c.restore(); }
        txt(c, row.label, ix + (ui.mode === 'items' ? 76 : 34), ry + rh / 2 + 1, { size: 25, fam: F.head, weight: 700, base: 'middle', color: sel ? '#fff4d8' : C.text });
        if (row.s && !row.locked) {
          const madTxt = (row.s.mad > 0 ? '+' : '') + row.s.mad;
          txt(c, `${row.s.focus} FP`, ix + iw - 170, ry + rh / 2 + 1, { size: 21, weight: 700, base: 'middle', align: 'right', color: P.focus < row.s.focus ? '#ff7a6a' : '#8cc8ff' });
          txt(c, `${madTxt} MAD`, ix + iw - 36, ry + rh / 2 + 1, { size: 21, weight: 700, base: 'middle', align: 'right', color: row.s.mad > 0 ? '#ff7a6a' : '#ffd28a' });
        }
        if (ui.mode === 'items') txt(c, '×' + row.count, ix + iw - 36, ry + rh / 2 + 1, { size: 22, weight: 700, base: 'middle', align: 'right' });
        c.restore();
        if (hov && G.mouse.clicked) { G.mouse.clicked = false; this.subSelect(row); }
      });
      // description tooltip above panel
      const row = L[ui.row];
      if (row) {
        const desc = row.s ? row.s.desc : ITEMS[row.key].desc;
        c.save(); c.font = font(24); const w = Math.min(1000, c.measureText(desc).width + 60); c.restore();
        panel(c, W - 24 - w, Y - 70, w, 56, { r: 10, ornaments: false, shadowBlur: 14 });
        txt(c, desc, W - 24 - w + 30, Y - 42 + 1, { size: 24, base: 'middle' });
      }
      if (button(c, 'back', ix + iw - 150, Y - 70 - 66, 130, 52, 'Back', { size: 22 })) { ui.mode = 'main'; }
    } else if (ui.mode === 'target') {
      txt(c, 'CHOOSE A TARGET', ix + 30, Y + 50, { size: 30, fam: F.head, weight: 900, color: C.gold });
      const e = ui.targetE;
      if (e) {
        txt(c, e.name, ix + 30, Y + 92, { size: 28, fam: F.head, weight: 700 });
        const info = e.revealed ? `${TYPE_MOD[e.type].label} — weak to ${TYPE_MOD[e.type].weak}` : 'Use Quality Inspection to reveal its weakness.';
        wrapLines(c, info, iw - 60, font(22)).slice(0, 2).forEach((l, i) => txt(c, l, ix + 30, Y + 126 + i * 28, { size: 22, color: C.textDim }));
      }
      txt(c, '←/→ or click an enemy  •  Esc to go back', ix + 30, Y + 184, { size: 19, color: C.textDim });
    } else if (ui.mode !== 'end') {
      const q = this.qte;
      txt(c, q ? 'Press SPACE / click on time!' : this.block.armed ? 'Press SPACE when the  !  lights up to BLOCK' : '...', ix + iw / 2, Y + 105, { size: 28, fam: F.head, weight: 700, align: 'center', color: q || this.block.armed ? '#ffe9a0' : C.textDim });
    }
  }

  drawResult(c) {
    const r = this.result, t = r.t;
    c.save();
    c.fillStyle = `rgba(0,0,0,${Math.min(0.7, t * 1.5)})`; c.fillRect(0, 0, W, H);
    const img = r.type === 'win' ? G.img._stamp_win : G.img._stamp_lose;
    const k = Math.min(1, t / 0.18), sc = lerp(2.6, 1, Ease.inQuad(k));
    c.save(); c.translate(W / 2, 260); c.rotate(-0.08); c.scale(sc, sc); c.globalAlpha = k;
    c.drawImage(img, -img.width / 2, -img.height / 2); c.restore();
    if (t > 0.5) {
      const a = Math.min(1, (t - 0.5) * 3);
      c.globalAlpha = a;
      if (r.type === 'win') {
        const lines = [];
        if (!this.enc.final) lines.push({ text: `+${r.xp} XP`, color: '#ffd28a' });
        for (const L of r.leveled) lines.push({ text: `LEVEL UP!  Lv ${L}` + (UNLOCKS[L] ? `  —  New skill: ${UNLOCKS[L]}` : ''), color: '#9cf08a' });
        for (const k2 in r.drops) lines.push({ text: `${ITEMS[k2].name}  ×${r.drops[k2]}`, icon: k2 });
        if (this.enc.final) lines.push({ text: 'The Kraken\'s order has been cancelled. Permanently.', color: '#ffd28a' });
        const S = this.stats;
        lines.push({ text: `Turns ${S.turns}  ·  Damage taken ${S.dmgTaken}  ·  Perfects ${S.perfects}`, color: C.textDim, small: true });
        const w = 900, h = 120 + lines.length * 54, x = (W - w) / 2, y = 420;
        panel(c, x, y, w, h);
        if (r.grade && t > 0.8) {
          const gk = Math.min(1, (t - 0.8) / 0.15), gs = lerp(2.2, 1, Ease.inQuad(gk));
          if (!r.gradeSfx) { r.gradeSfx = true; AudioSys.sfx('stamp'); shake(8); }
          const gc = { S: '#ffd24a', A: '#9cf08a', B: '#8cc8ff', C: '#c9b9a0' }[r.grade];
          c.save(); c.translate(x + w + 20, y + 30); c.rotate(0.12); c.scale(gs, gs); c.globalAlpha = gk * a;
          c.beginPath(); c.arc(0, 0, 74, 0, TAU); c.fillStyle = 'rgba(20,12,8,0.92)'; c.fill(); c.lineWidth = 6; c.strokeStyle = gc; c.stroke();
          txt(c, r.grade, 0, 8, { size: 96, fam: F.title, weight: 900, align: 'center', base: 'middle', color: gc });
          c.restore();
          txt(c, r.newBest ? 'NEW BEST!' : `Best: ${r.best}`, x + w + 20, y + 132, { size: 22, fam: F.head, weight: 900, align: 'center', color: r.newBest ? '#ffe27a' : C.textDim, alpha: gk });
        }
        lines.forEach((l, i) => {
          if (l.icon) Art.icon.item(c, x + 70, y + 64 + i * 54, l.icon);
          txt(c, l.text, l.icon ? x + 110 : W / 2, y + 74 + i * 54, { size: l.small ? 24 : 32, fam: l.small ? F.body : F.head, weight: 700, align: l.icon ? 'left' : 'center', color: l.color || C.text });
        });
        if (t > 1.0 && (button(c, 'cont', W / 2 - 140, y + h + 30, 280, 66, 'Continue') || confirmHit())) { if (!r.leaving) { r.leaving = true; this.done(true); } }
      } else {
        txt(c, 'Eric has been overwhelmed by logistics.', W / 2, 470, { size: 36, fam: F.head, align: 'center', color: '#ddd' });
        txt(c, 'Tip: Block with SPACE, Inspect to find weaknesses, and save RED FURY for big fights.', W / 2, 520, { size: 26, align: 'center', color: C.textDim });
        if (t > 1.0) {
          if (button(c, 'retry', W / 2 - 300, 590, 280, 66, 'Try Again') || confirmHit()) { if (!r.leaving) { r.leaving = true; this.retry(); } }
          if (button(c, 'retreat', W / 2 + 20, 590, 280, 66, 'Retreat')) { if (!r.leaving) { r.leaving = true; Object.assign(Game.player, JSON.parse(JSON.stringify(this.snapshot))); this.done(false); } }
        }
      }
    }
    c.restore();
  }
}
