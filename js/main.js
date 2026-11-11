'use strict';
// ============================================================================
//  MAIN — game state, saving, node events, boot
// ============================================================================
const SAVE_KEY = 'eric_da_red_save_v1';

// video cutscene played the first time each location is visited (assets/video/cut_<name>.mp4)
const NODE_CUTSCENES = { home: 'intro', docks: 'docks', warehouse: 'warehouse', bridge: 'bridge', fjord: 'kraken' };

const Game = {
  player: null,
  save: { cleared: {}, at: 'home' },
  busy: false,
  mapScene: null,

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ player: this.player, save: this.save })); } catch (e) {}
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return false;
      this.player = Object.assign(newPlayer(), d.player);
      this.save = Object.assign({ cleared: {}, at: 'home', ratings: {} }, d.save);
      if (!this.save.ratings) this.save.ratings = {};
      return true;
    } catch (e) { return false; }
  },
  async newGame() {
    this.player = newPlayer();
    this.save = { cleared: {}, at: 'home', ratings: {} };
    this.persist();
    this.mapScene = new MapScene();
    await goto(this.mapScene, 0.8);
    await wait(0.6);
    this.runNode(NODE.home);
  },
  async continueGame() {
    if (!this.load()) return this.newGame();
    this.mapScene = new MapScene();
    await goto(this.mapScene, 0.6);
    if (!this.save.cleared.home) { await wait(0.4); this.runNode(NODE.home); }
  },
  restore() {
    const st = statsFor(this.player.level);
    this.player.hp = st.maxHp; this.player.focus = st.maxFocus; this.player.madness = 0;
  },
  give(rew) {
    const lines = [];
    for (const k in rew) { this.player.items[k] = (this.player.items[k] || 0) + rew[k]; lines.push({ text: `${ITEMS[k].name}  ×${rew[k]}`, icon: k }); }
    return lines;
  },
  useItem(k, onMap) {
    const P = this.player, it = ITEMS[k], st = statsFor(P.level);
    if (!(P.items[k] > 0)) return;
    P.items[k]--;
    if (it.hp) P.hp = Math.min(st.maxHp, P.hp + it.hp);
    if (it.focus) P.focus = Math.min(st.maxFocus, P.focus + it.focus);
    if (it.mad) P.madness = clamp(P.madness + it.mad, 0, 100);
    AudioSys.sfx('heal');
    this.persist();
  },
  startBattle(encId) {
    return new Promise(res => {
      // war horn + axe-slash wipe into the fight
      AudioSys.stopMusic(0.4); AudioSys.sting('battleStart'); AudioSys.sfx('heavySwing');
      goto(new BattleScene(encId, async won => {
        if (ENCOUNTERS[encId].final && won) { res(won); return; }
        await goto(this.mapScene);
        res(won);
      }), 0.55, 'slash');
    });
  },
  async runNode(n) {
    if (this.busy) return;
    this.busy = true;
    try {
      const first = !this.save.cleared[n.id];
      if (first && n.chapter) await Banner.show(n.chapter[0], n.chapter[1]);
      if (first && NODE_CUTSCENES[n.id]) await Cutscene.play(NODE_CUTSCENES[n.id]);
      if (n.type === 'story') {
        await Dialog.play(n.script);
      } else if (n.type === 'battle') {
        if (!first) return;
        await Dialog.play(n.enc + '_pre');
        const won = await this.startBattle(n.enc);
        if (!won) { this.persist(); return; }
        if (ENCOUNTERS[n.enc].final) {
          this.save.cleared[n.id] = true; this.persist();
          await goto(new EndingScene(), 1.2);
          return;
        }
        await wait(0.5);
        await Dialog.play(n.enc + '_post');
      } else if (n.type === 'rest') {
        await Dialog.play(first ? n.script : n.again);
        this.restore();
        AudioSys.sfx('heal'); AudioSys.sting('rest');
        const lines = [{ text: 'HP, Focus restored. Madness calmed.', color: '#9cf08a' }];
        if (first && n.reward) lines.push(...this.give(n.reward));
        await Notice.show(first ? 'Rested & Resupplied' : 'Rested', lines);
      } else if (n.type === 'treasure') {
        await Dialog.play(n.script);
        const lines = this.give(n.reward);
        if (n.heal) { this.restore(); lines.unshift({ text: 'HP, Focus restored. Madness calmed.', color: '#9cf08a' }); }
        AudioSys.sfx('coin'); AudioSys.sting('treasure');
        await Notice.show('Found!', lines);
      }
      this.save.cleared[n.id] = true;
      this.persist();
    } finally {
      this.busy = false;
    }
  },
};

// ---------------------------------------------------------------- loading screen
const LoadingScene = {
  p: 0,
  update() {},
  draw(c) {
    c.fillStyle = '#0a0705'; c.fillRect(0, 0, W, H);
    txt(c, 'ERIC DA RED', W / 2, H / 2 - 30, { size: 64, fam: F.title, weight: 900, align: 'center', color: '#d8b46a' });
    rr(c, W / 2 - 300, H / 2 + 20, 600, 14, 7); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fill();
    rr(c, W / 2 - 300, H / 2 + 20, 600 * this.p, 14, 7); c.fillStyle = '#c4271b'; c.fill();
    txt(c, 'Counting crates…', W / 2, H / 2 + 80, { size: 24, align: 'center', color: 'rgba(255,255,255,0.5)' });
  },
};

// ---------------------------------------------------------------- boot
(async function boot() {
  G.scene = LoadingScene; G.fade.a = 0; G.fade.target = 0;
  // music crossfades run on their own clock (unaffected by hitstop/slow-mo)
  setInterval(() => AudioSys.tickMusic(0.05), 50);
  startLoop();
  try { await Promise.race([document.fonts.ready, wait(3)]); } catch (e) {}
  try {
    await Promise.all([document.fonts.load(`900 40px 'Cinzel Decorative'`), document.fonts.load(`700 40px 'Cinzel'`), document.fonts.load(`500 40px 'Alegreya Sans'`), document.fonts.load(`700 40px 'Alegreya Sans'`)]);
  } catch (e) {}
  await loadImages(IMAGES, p => { LoadingScene.p = p; });
  // procedural assets
  G.img._axe = Art.makeAxe();
  G.img._invoice = Art.makeSheet(90, 112, { title: 'INVOICE', seal: true });

  // debug / quick-jump: ?battle=docks  ?map  ?ending  ?tavern  ?cut=intro  ?level=3
  const q = new URLSearchParams(location.search);
  if (q.has('auto')) window.AUTOPLAY = true;
  Game.player = newPlayer();
  if (q.get('level')) { Game.player.level = +q.get('level'); Game.restore(); }
  if (q.get('mad')) Game.player.madness = +q.get('mad');
  if (q.has('battle')) {
    Game.mapScene = new MapScene();
    Game.save.ratings = Game.save.ratings || {};
    goto(new BattleScene(q.get('battle'), async () => { await goto(Game.mapScene); }), 0.2);
  } else if (q.has('map')) {
    if (!Game.load()) { Game.save.cleared.home = true; }
    Game.mapScene = new MapScene(); goto(Game.mapScene, 0.2);
  } else if (q.has('tavern')) {
    goto(new TavernScene(), 0.2);
  } else if (q.has('cut')) {
    goto(new TitleScene(), 0.2); wait(0.5).then(() => Cutscene.play(q.get('cut')));
  } else if (q.has('ending')) {
    goto(new EndingScene(), 0.2);
  } else if (q.has('nosplash')) {
    goto(new TitleScene(), 0.6);
  } else {
    goto(new SplashScene(), 0.6);
  }
})();
