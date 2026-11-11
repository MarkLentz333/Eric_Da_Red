'use strict';
// ============================================================================
//  AUDIO — music (HTMLAudio + crossfade) and synthesized SFX (WebAudio)
// ============================================================================
const AudioSys = (() => {
  let ac = null, master = null, sfxBus = null, noiseBuf = null, distCurve = null;
  const settings = { music: CONFIG.musicVolume, sfx: CONFIG.sfxVolume };
  try {
    const s = JSON.parse(localStorage.getItem('eric_audio') || 'null');
    if (s) Object.assign(settings, s);
  } catch (e) {}

  // ------------------------------------------------------------- music
  const tracks = { intro: null, background: null, battle: null, boss: null };
  let current = null, currentKey = null, wanted = null;
  const players = [];

  function classify(name) {
    const n = name.toLowerCase();
    if (/(intro|title|theme|menu|opening|main)/.test(n)) return 'intro';
    if (/(boss|final|kraken)/.test(n)) return 'boss';
    if (/(battle|fight|combat|war|action)/.test(n)) return 'battle';
    return 'background';
  }
  function assignFromList(files) {
    const sorted = [...files].sort();
    for (const f of sorted) {
      if (!/\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i.test(f)) continue;
      const k = classify(f.split('/').pop());
      if (!tracks[k]) tracks[k] = f.includes('/') ? f : CONFIG.musicDir + f;
    }
    // any unclassified extra file becomes background if missing
    if (!tracks.background) {
      const extra = sorted.find(f => /\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i.test(f) && (f.includes('/') ? f : CONFIG.musicDir + f) !== tracks.intro);
      if (extra) tracks.background = extra.includes('/') ? extra : CONFIG.musicDir + extra;
    }
  }
  function probe(url) {
    return new Promise(res => {
      const a = new Audio(); let done = false;
      const fin = ok => { if (!done) { done = true; res(ok ? url : null); } };
      a.addEventListener('canplaythrough', () => fin(true), { once: true });
      a.addEventListener('loadedmetadata', () => fin(true), { once: true });
      a.addEventListener('error', () => fin(false), { once: true });
      setTimeout(() => fin(false), 2500);
      a.preload = 'metadata'; a.src = url;
    });
  }
  async function discover() {
    for (const k in CONFIG.music) if (CONFIG.music[k]) tracks[k] = CONFIG.music[k].includes('/') ? CONFIG.music[k] : CONFIG.musicDir + CONFIG.music[k];
    if (window.MUSIC_FILES && MUSIC_FILES.length) assignFromList(MUSIC_FILES);
    // fallback probing for common names (works when opened without the server)
    const names = {
      intro: ['intro', 'Intro', 'title', 'Title', 'intro_song', 'theme', 'Theme'],
      background: ['background', 'Background', 'bg', 'map', 'music', 'Music', 'ambient'],
      battle: ['battle', 'Battle', 'fight', 'combat'],
      boss: ['boss', 'Boss', 'final'],
    };
    const exts = ['mp3', 'ogg', 'm4a', 'wav'];
    const jobs = [];
    // When served by tools/serve.py the manifest is authoritative — no need to probe.
    if (location.protocol.startsWith('http') && Array.isArray(window.MUSIC_FILES)) { console.log('[music]', tracks); if (wanted) playMusic(wanted, true); return; }
    for (const k in names) {
      if (tracks[k]) continue;
      jobs.push((async () => {
        for (const n of names[k]) for (const e of exts) {
          const u = await probe(CONFIG.musicDir + n + '.' + e);
          if (u) { tracks[k] = u; return; }
        }
      })());
    }
    await Promise.all(jobs);
    console.log('[music]', tracks);
    if (wanted) playMusic(wanted, true);
  }
  function resolve(key) {
    const chain = { intro: ['intro', 'background'], background: ['background', 'intro'], battle: ['battle', 'background', 'intro'], boss: ['boss', 'battle', 'background', 'intro'] }[key] || [key];
    for (const k of chain) if (tracks[k]) return tracks[k];
    return null;
  }
  function playMusic(key, force) {
    wanted = key;
    const url = resolve(key);
    if (!url) return;
    if (current && current.src.endsWith(encodeURI(url).replace(/^.*\//, '')) && current._url === url && !force) return;
    if (current && current._url === url) return;
    const a = new Audio(url); a._url = url; a.loop = true; a.volume = 0;
    a.play().catch(() => { a._pending = true; });
    if (current) { const old = current; old._fadeOut = true; }
    current = a; currentKey = key; players.push(a);
  }
  // duck(0.15) lowers the music (e.g. under a cutscene); duck(1) restores it. instant=true skips the fade.
  let duckMul = 1;
  function duck(v, instant) { duckMul = clamp(v, 0, 1); if (instant) for (const a of players) if (!a._fadeOut) a.volume = settings.music * duckMul; }
  function stopMusic() { wanted = null; if (current) current._fadeOut = true; current = null; }
  function tickMusic(dt) {
    for (let i = players.length - 1; i >= 0; i--) {
      const a = players[i];
      if (a._pending && unlocked) { a._pending = false; a.play().catch(() => {}); }
      const target = a._fadeOut ? 0 : settings.music * duckMul;
      a.volume = clamp(a.volume + Math.sign(target - a.volume) * dt * 0.6, 0, 1);
      if (Math.abs(a.volume - target) < 0.02) a.volume = target;
      if (a._fadeOut && a.volume <= 0.001) { a.pause(); players.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------- SFX synthesis
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createDynamicsCompressor();
      master.threshold.value = -14; master.ratio.value = 4;
      master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      distCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 4); }
    } catch (e) { console.warn('No WebAudio', e); }
  }
  function env(g, t0, a, peak, dec, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + a + dec);
  }
  function tone(o) {
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + (o.glide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain(); env(g, t0, o.a || 0.005, o.vol || 0.3, o.dur);
    let node = osc;
    if (o.dist) { const ws = ac.createWaveShaper(); ws.curve = distCurve; node.connect(ws); node = ws; }
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); g.connect(sfxBus);
    osc.start(t0); osc.stop(t0 + (o.a || 0.005) + o.dur + 0.05);
  }
  function noise(o) {
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = ac.createGain(); env(g, t0, o.a || 0.005, o.vol || 0.3, o.dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + (o.a || 0.005) + o.dur + 0.05);
  }
  const S = {
    hover() { tone({ f0: 1400, dur: 0.035, vol: 0.025, type: 'sine' }); },
    click() { tone({ f0: 520, f1: 300, dur: 0.07, vol: 0.12, type: 'triangle' }); noise({ f0: 2500, dur: 0.03, vol: 0.05 }); },
    back() { tone({ f0: 300, f1: 200, dur: 0.08, vol: 0.1, type: 'triangle' }); },
    blip() { tone({ f0: 600 + Math.random() * 80, dur: 0.025, vol: 0.025, type: 'triangle' }); },
    whoosh() { noise({ f0: 300, f1: 2600, dur: 0.22, vol: 0.28, q: 1.4, a: 0.05 }); },
    chop() {
      tone({ f0: 160, f1: 45, dur: 0.22, vol: 0.7, type: 'sine' });
      noise({ f0: 1800, f1: 400, dur: 0.14, vol: 0.5, filter: 'lowpass' });
      tone({ f0: 2400, f1: 1800, dur: 0.06, vol: 0.06, type: 'square', delay: 0.005 });
    },
    wood() { for (let i = 0; i < 4; i++) noise({ f0: 1200 + i * 500, dur: 0.05, vol: 0.25, q: 3, delay: i * 0.025 }); tone({ f0: 220, f1: 90, dur: 0.12, vol: 0.25, type: 'triangle' }); },
    stamp() { tone({ f0: 120, f1: 40, dur: 0.18, vol: 0.8 }); noise({ f0: 900, dur: 0.06, vol: 0.4, filter: 'lowpass' }); tone({ f0: 1800, dur: 0.03, vol: 0.05, type: 'square', delay: 0.02 }); },
    paper() { for (let i = 0; i < 6; i++) noise({ f0: 3500 + Math.random() * 2500, dur: 0.035, vol: 0.12, q: 2, delay: i * 0.03 + Math.random() * 0.02 }); },
    hit() { noise({ f0: 900, f1: 200, dur: 0.16, vol: 0.55, filter: 'lowpass' }); tone({ f0: 140, f1: 60, dur: 0.15, vol: 0.45 }); },
    hurt() { tone({ f0: 210, f1: 90, dur: 0.25, vol: 0.28, type: 'sawtooth', lp: 1200 }); noise({ f0: 700, f1: 150, dur: 0.2, vol: 0.45, filter: 'lowpass' }); },
    block() { [880, 1320, 1975, 2630].forEach((f, i) => tone({ f0: f, dur: 0.6 - i * 0.1, vol: 0.12, type: 'sine' })); noise({ f0: 4000, dur: 0.05, vol: 0.2, filter: 'highpass' }); },
    heal() { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.35, vol: 0.12, type: 'sine', delay: i * 0.07 })); },
    ink() { tone({ f0: 300, f1: 120, dur: 0.18, vol: 0.2, type: 'sine' }); noise({ f0: 600, dur: 0.15, vol: 0.2, filter: 'lowpass' }); },
    madness() { tone({ f0: 180, f1: 240, dur: 0.3, vol: 0.12, type: 'sawtooth', lp: 900 }); tone({ f0: 186, f1: 250, dur: 0.3, vol: 0.12, type: 'sawtooth', lp: 900 }); },
    qteGood() { tone({ f0: 880, dur: 0.12, vol: 0.12, type: 'triangle' }); },
    qtePerfect() { tone({ f0: 1320, dur: 0.18, vol: 0.14, type: 'triangle' }); tone({ f0: 1980, dur: 0.22, vol: 0.08, type: 'sine', delay: 0.05 }); },
    qteMiss() { tone({ f0: 220, f1: 160, dur: 0.15, vol: 0.12, type: 'square', lp: 900 }); },
    levelup() { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.4, vol: 0.14, type: 'triangle', delay: i * 0.09 })); },
    victory() { [523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.5, vol: 0.14, type: 'triangle', delay: i * 0.12 })); tone({ f0: 1047, dur: 0.9, vol: 0.16, type: 'triangle', delay: 0.38 }); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => tone({ f0: f, dur: 0.5, vol: 0.14, type: 'triangle', delay: i * 0.2 })); },
    fury() {
      tone({ f0: 110, f1: 45, dur: 1.4, vol: 0.5, type: 'sawtooth', dist: true, lp: 1600, a: 0.05 });
      tone({ f0: 165, f1: 70, dur: 1.2, vol: 0.3, type: 'sawtooth', dist: true, lp: 1200, a: 0.05 });
      noise({ f0: 300, f1: 1800, dur: 1.0, vol: 0.4, a: 0.3, filter: 'bandpass' });
    },
    roar() { tone({ f0: 70, f1: 40, dur: 1.6, vol: 0.5, type: 'sawtooth', dist: true, lp: 700, a: 0.1 }); noise({ f0: 400, f1: 150, dur: 1.4, vol: 0.4, filter: 'lowpass', a: 0.2 }); },
    splash() { noise({ f0: 1800, f1: 300, dur: 0.5, vol: 0.4, filter: 'lowpass', a: 0.02 }); },
    thunder() { noise({ f0: 600, f1: 60, dur: 2.2, vol: 0.6, filter: 'lowpass', a: 0.01, rate: 0.5 }); },
    coin() { tone({ f0: 1568, dur: 0.1, vol: 0.1, type: 'square', lp: 4000 }); tone({ f0: 2093, dur: 0.25, vol: 0.1, type: 'square', lp: 4000, delay: 0.08 }); },
    error() { tone({ f0: 180, f1: 140, dur: 0.18, vol: 0.14, type: 'square', lp: 1000 }); },
    slam() { tone({ f0: 90, f1: 30, dur: 0.5, vol: 0.9 }); noise({ f0: 500, f1: 80, dur: 0.5, vol: 0.6, filter: 'lowpass' }); },
    growl() {
      tone({ f0: 62, f1: 48, dur: 1.1, vol: 0.55, type: 'sawtooth', dist: true, lp: 520, a: 0.06 });
      tone({ f0: 93, f1: 70, dur: 1.0, vol: 0.3, type: 'sawtooth', dist: true, lp: 420, a: 0.08 });
      noise({ f0: 260, f1: 140, dur: 1.0, vol: 0.35, filter: 'lowpass', a: 0.1, rate: 0.6 });
    },
    gasp() { for (let i = 0; i < 7; i++) noise({ f0: 1400 + Math.random() * 1600, f1: 3200, dur: 0.45, vol: 0.13, q: 2.5, a: 0.18, delay: Math.random() * 0.08 }); },
    cheer() {
      for (let i = 0; i < 9; i++) noise({ f0: 500 + Math.random() * 1400, f1: 800 + Math.random() * 1800, dur: 0.9 + Math.random() * 0.5, vol: 0.09, q: 4, a: 0.12, delay: Math.random() * 0.25 });
      for (let i = 0; i < 5; i++) tone({ f0: 180 + Math.random() * 160, f1: 260 + Math.random() * 200, dur: 0.5, vol: 0.05, type: 'sawtooth', lp: 1400, a: 0.06, delay: Math.random() * 0.3 });
    },
    laugh() { // big booming HA-HA-HA
      for (let i = 0; i < 5; i++) {
        const d = i * 0.2, f = 118 - i * 6;
        tone({ f0: f * 1.15, f1: f, dur: 0.13, vol: 0.45, type: 'sawtooth', dist: true, lp: 900, a: 0.015, delay: d });
        noise({ f0: 700, dur: 0.1, vol: 0.18, filter: 'bandpass', q: 1.5, delay: d });
      }
    },
    crash() {
      tone({ f0: 80, f1: 28, dur: 0.6, vol: 0.9 });
      noise({ f0: 1400, f1: 120, dur: 0.7, vol: 0.6, filter: 'lowpass' });
      for (let i = 0; i < 8; i++) noise({ f0: 900 + Math.random() * 2600, dur: 0.06, vol: 0.25, q: 3, delay: 0.04 + i * 0.045 + Math.random() * 0.03 });
      tone({ f0: 1250, dur: 0.5, vol: 0.06, type: 'triangle', delay: 0.25 }); tone({ f0: 1660, dur: 0.4, vol: 0.05, type: 'triangle', delay: 0.38 });
    },
    scratch() { tone({ f0: 900, f1: 120, dur: 0.28, vol: 0.18, type: 'sawtooth', lp: 2200 }); noise({ f0: 2400, f1: 500, dur: 0.25, vol: 0.2, q: 2 }); },
    step() { noise({ f0: 400, dur: 0.05, vol: 0.08, filter: 'lowpass' }); },
  };
  function sfx(name) { if (!ac || !S[name]) return; try { S[name](); } catch (e) {} }

  function setVolume(kind, v) {
    settings[kind] = clamp(v, 0, 1);
    if (kind === 'sfx' && sfxBus) sfxBus.gain.value = settings.sfx;
    try { localStorage.setItem('eric_audio', JSON.stringify(settings)); } catch (e) {}
  }

  discover();
  return { unlock, sfx, playMusic, stopMusic, duck, tickMusic, setVolume, settings, tracks, get unlocked() { return unlocked; } };
})();
