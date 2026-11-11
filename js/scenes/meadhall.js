'use strict';
// ============================================================================
//  THE DRUNKEN GOAT MEAD HALL (v3) — interactive tavern in Fjordheim.
//  Eric walks left/right and talks to the office crew:
//    Darrell  — the boss. Hands out difficult "dispatch orders" (side quests).
//    Thomas   — VP of Operations. Impossible demands. "Make it happen, huh?"
//    Nichole  — office manager. Patches Eric up, restocks him, gives hints.
// ============================================================================

// Darrell's dispatch orders, given one at a time.  prog() → [have, need]
const DISPATCH = [
  { id: 'troublemakers', title: 'Clear the Troublemakers', desc: 'Defeat 3 roaming troublemakers on the roads.',
    prog: () => [Object.keys(Game.save.skirm || {}).length, 3], reward: { mead: 1, tea: 1 },
    give: [
      { s: 'darrell', t: 'Eric. Good. Got a load for you. Three troublemakers are blocking the routes. Crates, paperwork, whatever. Clear them.' },
      { s: 'eric', m: 'calm', t: 'I\'m in the middle of a forty-barrel delivery.' },
      { s: 'darrell', t: 'And now you\'re in the middle of two things. Need it by end of shift.' },
    ] },
  { id: 'stash', title: 'Recover the Lost Stash', desc: 'Find 4 hidden caches around the map.',
    prog: () => [Object.keys(Game.save.found || {}).length, 4], reward: { rune: 1 },
    give: [
      { s: 'darrell', t: 'Next one. Somebody scattered company supplies all over the county. Find four of the stashes.' },
      { s: 'eric', m: 'shout', t: 'WHO scatters supplies all over the county?!' },
      { s: 'darrell', t: 'Doesn\'t matter who. Matters who\'s picking them up. That\'s you.' },
    ] },
  { id: 'arm', title: 'Prove the Arm', desc: 'Score 150 or more at Bjarni\'s Axe Range.',
    prog: () => [Game.save.axeBest || 0, 150], reward: { mead: 2 },
    give: [
      { s: 'darrell', t: 'Bjarni says nobody in dispatch can throw. I bet him a barrel you could hit 150.' },
      { s: 'eric', m: 'smirk', t: 'You bet a barrel. Of the forty barrels. That I\'m delivering.' },
      { s: 'darrell', t: 'So don\'t lose.' },
    ] },
  { id: 'flawless', title: 'Flawless Delivery', desc: 'Earn an A or S rating in 3 different fights.',
    prog: () => [Object.values(Game.save.ratings || {}).filter(g => g === 'A' || g === 'S').length, 3], reward: { rune: 1, herring: 2 },
    give: [
      { s: 'darrell', t: 'Corporate wants metrics. Get me three clean jobs. A-grade or better.' },
      { s: 'eric', m: 'calm', t: 'Corporate is a man named Thomas sitting right there.' },
      { s: 'darrell', t: 'And he wants metrics.' },
    ] },
];
const THOMAS_QUIPS = [
  'Forty barrels? I wanted fifty. Make it happen, huh?',
  'Why is the goat late? Huh?',
  'I don\'t want excuses, Eric. I want results. Huh?',
  'You\'re sitting. Why are you sitting? Huh?',
  'Did anyone file the form for filing forms? Huh?',
  'I heard the Kraken is "a lot." Everything is a lot. Make it happen, huh?',
  'Sounds like a you problem. Huh?',
  'Back in my day we delivered the mead uphill. Both ways. Huh?',
];
const NICHOLE_HINTS = [
  'Darrell\'s list again? Okay. I marked every hidden cache on your map. Don\'t tell him I helped.',
  'The roaming troublemakers glow red. Walk up close and they\'ll come to you — fight them near a rest stop.',
  'Bjarni\'s trick: lock the aim when the line is near the middle, and lean into the wind a little.',
  'For a good rating: finish fast, take fewer hits, and land your perfect timings. Parries count too!',
  'Herring calms Madness. Tea restores Focus. I put extra in your pack, you\'re welcome.',
  'Thomas means well. Mostly. Probably. Just say "yep" and keep walking.',
];

class MeadHallScene {
  enter() {
    this.t = 0; this.floor = 960;
    this.e = { x: 260, dir: 'side', flip: false, phase: 0, moving: false, step: 0 };
    this.ppl = [
      { id: 'nichole', name: 'Nichole', role: 'Office Manager', x: 640, h: 455 },
      { id: 'darrell', name: 'Darrell', role: 'The Boss', x: 1080, h: 470 },
      { id: 'thomas', name: 'Thomas', role: 'VP of Operations', x: 1520, h: 490 },
    ];
    this.healed = false; this.focus = null;
    Game.save.q = Game.save.q || { d: 0, given: false, t: false, n: 0, nGift: false };
    AudioSys.playMusic('tavern');
    // first visit: Darrell & Thomas holding court (assets/video/cut_crew.mp4)
    if (!Game.save.q.seenCrew) {
      Game.save.q.seenCrew = true; Game.persist(); Game.busy = true;
      wait(0.6).then(() => Cutscene.play('crew')).then(() => Dialog.play([
        { s: 'thomas', t: "Eric. You're late. Huh?" },
        { s: 'darrell', t: "He's not late. I gave him eleven things to do." },
        { s: 'thomas', t: "Then he's late eleven times. Make it happen, huh?" },
        { s: 'nichole', t: 'Ignore them. Come talk to me first — you look like you need a herring.' },
      ])).finally(() => { Game.busy = false; });
    }
    if (!this.bg) {
      const bg = G.img.bg_tavern, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d');
      if (bg) { x.filter = 'blur(2px) brightness(0.8)'; const s = Math.max(W / bg.width, H / bg.height) * 1.08; x.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2 - 40, bg.width * s, bg.height * s); x.filter = 'none'; }
      this.bg = cv;
    }
  }
  q() { return Game.save.q; }
  order() { return DISPATCH[this.q().d] || null; }
  orderDone() { const o = this.order(); if (!o) return false; const [h, n] = o.prog(); return h >= n; }
  marker(p) {
    const q = this.q();
    if (p.id === 'darrell') { const o = this.order(); if (!o) return null; if (!q.given) return '!'; if (this.orderDone()) return '?'; return null; }
    if (p.id === 'thomas') { const s = Object.values(Game.save.ratings || {}).includes('S'); return !q.t && s ? '?' : !q.tGiven ? '!' : null; }
    if (p.id === 'nichole') return !this.healed ? '+' : null;
    return null;
  }
  async talk(p) {
    if (Game.busy) return; Game.busy = true;
    const q = this.q();
    try {
      if (p.id === 'nichole') await this.talkNichole();
      else if (p.id === 'darrell') await this.talkDarrell();
      else await this.talkThomas();
      Game.persist();
    } finally { Game.busy = false; }
  }
  async talkNichole() {
    const q = this.q(), lines = [];
    if (!q.nGift) {
      lines.push({ s: 'nichole', t: 'Eric! Sit down for one second. You look like you wrestled a crate. ...You did wrestle a crate, didn\'t you.' },
        { s: 'eric', m: 'smirk', t: 'It started it.' },
        { s: 'nichole', t: 'I packed you herring, tea and a fresh ink pot. And I already filed your forms. In triplicate.' },
        { s: 'eric', m: 'calm', t: 'Nichole, you are the only reason this operation runs.' },
        { s: 'nichole', t: 'I know. Now go deliver that goat.' });
    } else {
      lines.push({ s: 'nichole', t: NICHOLE_HINTS[q.n % NICHOLE_HINTS.length] });
      if (q.n % NICHOLE_HINTS.length === 0) Game.save.revealCaches = true;
      q.n++;
    }
    await Dialog.play(lines);
    const got = [];
    if (!this.healed) { Game.restore(); this.healed = true; AudioSys.sfx('heal'); got.push({ text: 'HP, Focus restored. Madness calmed.', color: '#9cf08a' }); }
    if (!q.nGift) { q.nGift = true; got.push(...Game.give({ herring: 1, tea: 1, ink: 1 })); }
    if (Game.save.revealCaches && !q.revealNote) { q.revealNote = true; got.push({ text: 'Hidden caches marked on your map', color: '#ffd76a' }); }
    if (got.length) { AudioSys.sting('rest'); await Notice.show('Nichole Helped Out', got); }
  }
  async talkDarrell() {
    const q = this.q(), o = this.order();
    if (!o) { await Dialog.play([{ s: 'darrell', t: 'That\'s everything on today\'s list.' }, { s: 'darrell', t: 'Tomorrow\'s list is longer.' }, { s: 'eric', m: 'shout', t: 'OF COURSE IT IS.' }]); return; }
    if (!q.given) { q.given = true; await Dialog.play(o.give); AudioSys.sfx('paper'); await Notice.show('New Dispatch Order', [{ text: o.title, color: '#ffd76a' }, { text: o.desc }]); return; }
    const [h, n] = o.prog();
    if (h < n) { await Dialog.play([{ s: 'darrell', t: pick([`${o.title}: you\'re at ${Math.min(h, n)} of ${n}. Clock\'s ticking.`, `Still waiting on "${o.title}". ${Math.min(h, n)} of ${n}. Radio me when it\'s done.`, `${Math.min(h, n)} of ${n}? I told the Jarl you\'d be done an hour ago.`]) }]); return; }
    await Dialog.play([{ s: 'darrell', t: pick(['Done? Already? Huh. Good work.', 'Nice. That\'s one off the board.', 'Good. I\'ll tell corporate it was my idea.']) }, { s: 'thomas', t: 'Took long enough. Huh?' }]);
    AudioSys.sfx('coin'); AudioSys.sting('treasure');
    await Notice.show('Order Complete: ' + o.title, Game.give(o.reward));
    q.d++; q.given = false;
  }
  async talkThomas() {
    const q = this.q();
    if (!q.tGiven) {
      q.tGiven = true;
      await Dialog.play([
        { s: 'thomas', t: 'Eric. I was just telling Darrell — we need perfection on every job. Huh?' },
        { s: 'eric', m: 'calm', t: 'Every job.' },
        { s: 'thomas', t: 'Get me an S rating. One fight, perfect. Make it happen, huh?' },
        { s: 'eric', m: 'shout', t: 'I\'M FIGHTING A KRAKEN WITH A MONOCLE.' },
        { s: 'thomas', t: 'Sounds like a you problem. Huh?' },
      ]);
      return;
    }
    const hasS = Object.values(Game.save.ratings || {}).includes('S');
    if (!q.t && hasS) {
      q.t = true;
      await Dialog.play([{ s: 'thomas', t: 'An S. Huh.' }, { s: 'thomas', t: '...Fine. Here. Don\'t let it go to your head. Huh?' }, { s: 'eric', m: 'smirk', t: 'Was that... a compliment?' }, { s: 'thomas', t: 'No. Make it happen again. Huh?' }]);
      AudioSys.sfx('coin');
      await Notice.show('Thomas Approved (Barely)', Game.give({ rune: 1, mead: 1 }));
      return;
    }
    await Dialog.play([{ s: 'thomas', t: THOMAS_QUIPS[(q.tq = (q.tq || 0) + 1) % THOMAS_QUIPS.length] }]);
  }
  leave() { if (this.leaving) return; this.leaving = true; AudioSys.sfx('back'); goto(Game.mapScene || new WorldScene(), 0.5); }

  update(dt) {
    this.t += dt;
    if (Math.random() < dt * 8) Particles.ambient('glow', { x: 860, y: 640, w: 200, h: 40 }, { vy: rand(-90, -40), color: 'rgba(255,160,60,0.9)', size: 3, sizeMin: 1, life: rand(1.5, 3), layer: 'back' });
    const e = this.e;
    e.moving = false;
    if (G.overlay || Game.busy || G.fade.a > 0.05) return;
    let vx = (G.keys.KeyD || G.keys.ArrowRight ? 1 : 0) - (G.keys.KeyA || G.keys.ArrowLeft ? 1 : 0);
    if (G.mouse.clicked && G.mouse.y > 300) {
      const hit = this.ppl.find(p => Math.abs(G.mouse.x - p.x) < 110 && G.mouse.y > this.floor - p.h);
      this.target = hit ? { x: hit.x + (hit.x > e.x ? -150 : 150), use: hit } : { x: clamp(G.mouse.x, 120, W - 120) };
      if (G.mouse.x < 140) this.target = { x: 120, exit: true };
    }
    if (vx) this.target = null;
    if (this.target) {
      const d = this.target.x - e.x;
      if (Math.abs(d) < 10) { const t = this.target; this.target = null; if (t.use) { e.flip = t.use.x < e.x; this.talk(t.use); return; } if (t.exit) { this.leave(); return; } }
      else vx = Math.sign(d);
    }
    if (vx) {
      e.x = clamp(e.x + vx * 460 * dt, 110, W - 110); e.moving = true; e.flip = vx < 0;
      e.phase += dt * 10;
      if (Math.floor(e.phase / Math.PI) !== e.step) { e.step = Math.floor(e.phase / Math.PI); AudioSys.sfx('step', { x: e.x }); }
    }
    // nearest person / door
    this.focus = null;
    let bd = 230;
    for (const p of this.ppl) { const d = Math.abs(p.x - e.x); if (d < bd) { bd = d; this.focus = p; } }
    if (e.x < 200) this.focus = { door: true };
    if (keyHit('KeyE', 'Enter', 'Space', 'NumpadEnter')) {
      if (this.focus && this.focus.door) { this.leave(); return; }
      if (this.focus) { AudioSys.sfx('click'); e.flip = this.focus.x < e.x; this.talk(this.focus); return; }
    }
    if (keyHit('Escape')) this.leave();
  }
  draw(c) {
    c.drawImage(this.bg, 0, 0);
    // warm firelight flicker + floor
    const fl = 0.5 + Math.sin(this.t * 7) * 0.2 + Math.sin(this.t * 13.3) * 0.12;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + fl * 0.15;
    c.drawImage(glowSprite('rgba(255,140,50,0.8)'), 560, 320, 800, 600); c.restore();
    const g = c.createLinearGradient(0, 760, 0, H); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(0.35, 'rgba(20,10,4,0.75)'); g.addColorStop(1, 'rgba(10,5,2,0.95)');
    c.fillStyle = g; c.fillRect(0, 760, W, H - 760);
    Particles.draw(c, 'back');
    // the exit door glow (left)
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(glowSprite('rgba(140,180,255,0.5)'), -120, 520, 300, 520); c.restore();
    txt(c, '◀ EXIT', 40, this.floor - 300, { size: 26, fam: F.head, weight: 900, color: 'rgba(220,235,255,0.8)' });
    // people (back to front)
    const list = this.ppl.map(p => ({ x: p.x, f: () => this.drawPerson(c, p) }));
    list.push({ x: this.e.x, f: () => this.drawEric(c) });
    for (const it of list) it.f();
    vignette(c, 0.55);
    // title + objective strip
    panel(c, 40, 30, 620, 110);
    txt(c, 'THE DRUNKEN GOAT', 70, 78, { size: 34, fam: F.title, weight: 900, color: C.gold, letter: 2 });
    txt(c, 'Mead hall of Fjordheim  ·  HP restored once per visit by Nichole', 70, 118, { size: 21, color: C.textDim });
    const o = this.order();
    if (o && this.q().given) {
      const [h, n] = o.prog();
      panel(c, W - 600, 30, 560, 110);
      txt(c, "DARRELL'S ORDER", W - 570, 72, { size: 22, fam: F.head, weight: 900, color: C.gold, letter: 2 });
      txt(c, `${o.title}  ${Math.min(h, n)}/${n}`, W - 570, 112, { size: 28, fam: F.head, weight: 700, color: h >= n ? '#9cf08a' : '#fff' });
    }
    if (!Game.busy && !G.overlay) this.drawPrompt(c);
    Particles.draw(c, 'front');
    txt(c, 'A / D or click to walk  ·  E talk  ·  Esc leave', W / 2, H - 26, { size: 22, align: 'center', color: 'rgba(255,240,210,0.6)' });
  }
  drawPerson(c, p) {
    const img = G.img['npc_' + p.id]; if (!img) return;
    const s = p.h / img.height, w = img.width * s, breathe = 1 + Math.sin(this.t * 2 + p.x) * 0.006;
    c.save(); c.globalAlpha = 0.5; c.fillStyle = '#000'; c.beginPath(); c.ellipse(p.x, this.floor, w * 0.42, 22, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(p.x, this.floor); c.scale(this.e.x < p.x ? -1 : 1, breathe);
    c.drawImage(img, -w / 2, -p.h, w, p.h);
    // warm rim light from the hearth
    c.globalAlpha = 0.13; c.drawImage(tinted(img, '#ff9a40'), -w / 2, -p.h, w, p.h);
    c.restore();
    const m = this.marker(p);
    if (m) {
      const y = this.floor - p.h - 50 + Math.sin(this.t * 3 + p.x) * 8;
      c.save(); c.beginPath(); c.arc(p.x, y, 26, 0, TAU); c.fillStyle = m === '+' ? 'rgba(20,60,20,0.9)' : 'rgba(40,24,6,0.9)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = m === '+' ? '#9cf08a' : '#ffd76a'; c.stroke(); c.restore();
      txt(c, m, p.x, y + 2, { size: 36, fam: F.head, weight: 900, align: 'center', base: 'middle', color: m === '+' ? '#9cf08a' : '#ffd76a' });
    }
  }
  drawEric(c) {
    const e = this.e, img = e.moving || e.dir === 'side' ? G.img.eric_side : G.img.eric_front; if (!img) return;
    const h = 510, s = h / img.height, w = img.width * s, fy = this.floor + 55;   // Eric walks a lane in front of the crew
    const bob = e.moving ? Math.abs(Math.sin(e.phase)) * 9 : 0;
    c.save(); c.globalAlpha = 0.5; c.fillStyle = '#000'; c.beginPath(); c.ellipse(e.x, fy, 74, 21, 0, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(e.x, fy - bob); c.rotate(e.moving ? Math.sin(e.phase) * 0.03 : 0); c.scale(e.flip ? -1 : 1, 1);
    c.drawImage(img, -w / 2, -h, w, h);
    c.globalAlpha = 0.13; c.drawImage(tinted(img, '#ff9a40'), -w / 2, -h, w, h);
    c.restore();
  }
  drawPrompt(c) {
    const f = this.focus; if (!f) return;
    const label = f.door ? 'Leave the mead hall' : `Talk to ${f.name}  ·  ${f.role}`;
    c.save(); c.font = font(26, F.head, 700); const tw = c.measureText(label).width + 80; c.restore();
    const x = f.door ? 60 : clamp(f.x - tw / 2, 20, W - tw - 20), y = f.door ? this.floor - 260 : 180;
    panel(c, x, y, tw, 52, { r: 12, shadowBlur: 14 });
    rr(c, x + 14, y + 10, 34, 32, 6); c.fillStyle = '#ffcf6a'; c.fill();
    txt(c, 'E', x + 31, y + 27, { size: 22, fam: F.head, weight: 900, align: 'center', base: 'middle', color: '#2a170a' });
    txt(c, label, x + 60, y + 27, { size: 26, fam: F.head, weight: 700, base: 'middle', color: '#fff1d0' });
  }
}
