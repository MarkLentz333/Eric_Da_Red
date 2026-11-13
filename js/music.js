'use strict';
// ============================================================================
//  MUSIC — original adaptive battle score + transition stingers, synthesized
//  live with WebAudio (no files). Used whenever a slot has no song file.
//
//    Music.play('battle' | 'boss' | 'kraken')   start a looping theme
//    Music.stop(fade)                            fade the theme out
//    Music.intensity({ rage, fury })             0..1 layer targets (adaptive mix)
//    Music.sting(name)                           one-shot musical transition
//
//  Every theme has layers: base (drums, bass, drone), lead (horn melody / arps),
//  rage (war toms + gritty bass, fades in at high Madness) and fury (full blast).
// ============================================================================
const Music = (() => {
  let ac = null, bus = null, noiseBuf = null, distCurve = null;
  let song = null;          // active song state
  let wanted = null;        // song requested before the AudioContext existed
  let timer = null;
  const target = { rage: 0, fury: 0 };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CH = { m: [0, 3, 7], M: [0, 4, 7], d: [0, 3, 6], s: [0, 5, 7] };

  // ----------------------------------------------------------------- songs
  // chords: one per bar, [rootMidi, quality]. Patterns are 16 sixteenth-steps per bar:
  //   'x' hit, '.' rest, 'o' (bass) octave up, 'X' accented.
  // lead: [bar, step, midi, lengthInSteps]
  const SONGS = {
    // "Quartermaster's March" — driving D minor gallop
    battle: {
      bpm: 140,
      chords: [[38, 'm'], [38, 'm'], [34, 'M'], [36, 'M'], [38, 'm'], [38, 'm'], [34, 'M'], [33, 'M'],
               [38, 'm'], [36, 'M'], [34, 'M'], [33, 'M'], [38, 'm'], [41, 'M'], [36, 'M'], [33, 'M']],
      kick:  'x.....x.x.....x.',
      snare: '....x.......x...',
      hat:   '..x...x...x...x.',
      tom:   'x..x..x.x.xx.xxx',
      furyHat: 'xxxxxxxxxxxxxxxx',
      bass:  'x.xx.xx.x.xx.xox',
      drone: true,
      lead: [
        [0, 0, 74, 4], [0, 4, 69, 2], [0, 6, 72, 2], [0, 8, 74, 6], [0, 14, 76, 2],
        [1, 0, 77, 4], [1, 4, 76, 2], [1, 6, 74, 2], [1, 8, 72, 4], [1, 12, 69, 4],
        [2, 0, 70, 6], [2, 6, 72, 2], [2, 8, 74, 4], [2, 12, 77, 4],
        [3, 0, 76, 6], [3, 6, 74, 2], [3, 8, 72, 4], [3, 12, 76, 4],
        [4, 0, 74, 4], [4, 4, 69, 2], [4, 6, 72, 2], [4, 8, 74, 4], [4, 12, 77, 2], [4, 14, 79, 2],
        [5, 0, 81, 6], [5, 6, 79, 2], [5, 8, 77, 4], [5, 12, 76, 4],
        [6, 0, 77, 4], [6, 4, 74, 4], [6, 8, 70, 4], [6, 12, 74, 4],
        [7, 0, 73, 8], [7, 8, 76, 4], [7, 12, 69, 4],
      ],
      arp: 'x.x.x.x.x.x.x.x.', arpBars: [8, 16], // second half: plucked arpeggios instead of the horn
      leadLp: 2200,
    },
    // "Toll & Trouble" — Cousin Sven: pompous, heavy half-time C minor
    boss: {
      bpm: 116,
      chords: [[36, 'm'], [36, 'm'], [32, 'M'], [31, 'M'], [36, 'm'], [29, 'm'], [32, 'M'], [31, 'M']],
      kick:  'x.x.....x.x..x..',
      snare: '........x.......',
      hat:   'x.x.x.x.x.x.x.x.',
      tom:   'x.x.x.x.xxx.xxxx',
      furyHat: 'x.xxx.xxx.xxx.xx',
      bass:  'x..x..x.x..x.xo.',
      drone: true, pad: true,
      lead: [
        [0, 0, 60, 3], [0, 3, 60, 1], [0, 4, 63, 4], [0, 8, 67, 6], [0, 14, 66, 2],
        [1, 0, 67, 4], [1, 4, 68, 4], [1, 8, 67, 4], [1, 12, 63, 4],
        [2, 0, 68, 6], [2, 6, 67, 2], [2, 8, 65, 4], [2, 12, 63, 4],
        [3, 0, 62, 8], [3, 8, 59, 4], [3, 12, 62, 4],
        [4, 0, 72, 3], [4, 3, 72, 1], [4, 4, 70, 4], [4, 8, 67, 6], [4, 14, 66, 2],
        [5, 0, 65, 4], [5, 4, 68, 4], [5, 8, 72, 4], [5, 12, 71, 4],
        [6, 0, 72, 6], [6, 6, 70, 2], [6, 8, 68, 4], [6, 12, 67, 4],
        [7, 0, 67, 6], [7, 6, 65, 2], [7, 8, 62, 4], [7, 12, 59, 4],
      ],
      leadLp: 1500, leadOct: 0,
    },
    // "The Backorder" — the Kraken: dark phrygian choir, storm toms
    kraken: {
      bpm: 96,
      chords: [[38, 'm'], [39, 'M'], [38, 'm'], [37, 'd'], [34, 'M'], [39, 'M'], [38, 'm'], [33, 'M']],
      kick:  'x.......x..x....',
      snare: '............x...',
      hat:   '....x.......x...',
      tom:   'x..x..x...x.x.xx',
      furyHat: 'x.x.x.x.x.x.x.x.',
      bass:  'x.......x...x...',
      drone: true, pad: true, choir: true,
      lead: [
        [0, 0, 62, 8], [0, 8, 63, 4], [0, 12, 62, 4],
        [1, 0, 67, 12], [1, 12, 65, 4],
        [2, 0, 62, 8], [2, 8, 60, 4], [2, 12, 58, 4],
        [3, 0, 61, 16],
        [4, 0, 65, 8], [4, 8, 63, 4], [4, 12, 62, 4],
        [5, 0, 63, 8], [5, 8, 67, 8],
        [6, 0, 69, 6], [6, 6, 67, 2], [6, 8, 65, 4], [6, 12, 63, 4],
        [7, 0, 61, 16],
      ],
      leadLp: 1200,
    },
    // "Last Call at the Drunken Goat" — mead-hall jig, D mixolydian, bouncy and light
    tavern: {
      bpm: 128,
      chords: [[38, 'M'], [36, 'M'], [38, 'M'], [33, 'M'], [38, 'M'], [36, 'M'], [31, 'M'], [33, 'M']],
      kick:  'x.......x.......',
      snare: '....x.......x...',
      hat:   '..x...x...x...x.',
      tom:   '................',
      furyHat: '..x...x...x...x.',
      bass:  'x...x.x.x...x.x.',
      lead: [
        [0, 0, 74, 2], [0, 2, 78, 2], [0, 4, 81, 2], [0, 6, 78, 2], [0, 8, 79, 2], [0, 10, 78, 2], [0, 12, 76, 4],
        [1, 0, 72, 2], [1, 2, 76, 2], [1, 4, 79, 2], [1, 6, 76, 2], [1, 8, 74, 4], [1, 12, 72, 4],
        [2, 0, 74, 2], [2, 2, 78, 2], [2, 4, 81, 2], [2, 6, 83, 2], [2, 8, 81, 2], [2, 10, 79, 2], [2, 12, 78, 4],
        [3, 0, 76, 2], [3, 2, 73, 2], [3, 4, 69, 4], [3, 8, 73, 2], [3, 10, 76, 2], [3, 12, 74, 4],
      ],
      arp: 'x.x.x.x.x.x.x.x.', arpBars: [4, 8],
      leadLp: 2600,
    },
  };

  // ----------------------------------------------------------------- instruments
  function g(dest, v) { const n = ac.createGain(); n.gain.value = v; n.connect(dest); return n; }
  function envGain(dest, t, a, peak, d, sus = 0.0001) {
    const n = ac.createGain();
    n.gain.setValueAtTime(0.0001, t);
    n.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    n.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d);
    n.connect(dest); return n;
  }
  function osc(type, f, t, end, dest, detune = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end + 0.05); return o;
  }
  function noiseSrc(t, end, dest, rate = 1) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
    s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(end + 0.05); return s;
  }
  function filt(type, f, dest, q = 0.8) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }

  const I = {
    kick(t, d, v = 0.9) {
      const e = envGain(d, t, 0.002, v, 0.32);
      const o = osc('sine', 150, t, t + 0.35, e); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      noiseSrc(t, t + 0.03, filt('lowpass', 1200, envGain(d, t, 0.001, v * 0.25, 0.03)));
    },
    snare(t, d, v = 0.5) { // frame drum / snare
      noiseSrc(t, t + 0.2, filt('bandpass', 1900, envGain(d, t, 0.002, v, 0.16), 0.7));
      const o = osc('triangle', 210, t, t + 0.14, envGain(d, t, 0.002, v * 0.6, 0.11)); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    },
    hat(t, d, v = 0.12) { noiseSrc(t, t + 0.05, filt('highpass', 7500, envGain(d, t, 0.001, v, 0.035))); },
    tom(t, d, f = 95, v = 0.7) {
      const o = osc('triangle', f, t, t + 0.4, envGain(d, t, 0.003, v, 0.35)); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.3);
      noiseSrc(t, t + 0.08, filt('lowpass', 900, envGain(d, t, 0.002, v * 0.35, 0.07)));
    },
    crash(t, d, v = 0.25) { noiseSrc(t, t + 1.6, filt('highpass', 4200, envGain(d, t, 0.003, v, 1.5)), 0.9); },
    bass(t, d, f, dur, v = 0.32, grit = false) {
      const e = envGain(d, t, 0.006, v, dur * 0.95, v * 0.3);
      let dest = filt('lowpass', grit ? 1100 : 520, e, 4);
      dest.frequency.setValueAtTime(grit ? 1800 : 900, t); dest.frequency.exponentialRampToValueAtTime(grit ? 600 : 260, t + dur);
      if (grit) { const ws = ac.createWaveShaper(); ws.curve = distCurve; ws.connect(dest); dest = ws; }
      osc('sawtooth', f, t, t + dur, dest); osc('square', f / 2, t, t + dur, g(dest, 0.5));
    },
    drone(t, d, f, dur, v = 0.07) { // tagelharpa-ish bowed drone
      const e = envGain(d, t, 0.25, v, dur, v * 0.8);
      const lp = filt('lowpass', 700, e, 1.5);
      for (const dt of [-8, 7]) osc('sawtooth', f, t, t + dur + 0.3, lp, dt);
      osc('sawtooth', f * 1.5, t, t + dur + 0.3, g(lp, 0.45), 3);
    },
    horn(t, d, f, dur, v = 0.16, lp = 2000) { // brassy war horn with filter swell + late vibrato
      const e = envGain(d, t, 0.04, v, dur, v * 0.55);
      const fl = filt('lowpass', lp, e, 1.2);
      fl.frequency.setValueAtTime(lp * 0.35, t); fl.frequency.exponentialRampToValueAtTime(lp, t + 0.09);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.35, dur));
      lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.1);
      for (const dt of [-6, 6]) { const o = osc('sawtooth', f, t, t + dur + 0.08, fl, dt); lg.connect(o.frequency); }
      const o2 = osc('square', f, t, t + dur + 0.08, g(fl, 0.25)); lg.connect(o2.frequency);
    },
    pluck(t, d, f, v = 0.12) {
      osc('triangle', f, t, t + 0.6, envGain(d, t, 0.002, v, 0.5));
      osc('sine', f * 2, t, t + 0.25, envGain(d, t, 0.002, v * 0.4, 0.2));
    },
    pad(t, d, freqs, dur, v = 0.05) {
      const e = envGain(d, t, 0.5, v, dur, v * 0.8);
      const lp = filt('lowpass', 1100, e);
      for (const f of freqs) for (const dt of [-10, 0, 10]) osc('sawtooth', f, t, t + dur + 0.6, lp, dt);
    },
    choir(t, d, freqs, dur, v = 0.06) { // "aah" — saws through two vowel formants
      const e = envGain(d, t, 0.6, v, dur, v * 0.85);
      const f1 = filt('bandpass', 760, e, 6), f2 = filt('bandpass', 1150, g(e, 0.7), 7);
      for (const f of freqs) for (const dt of [-12, -4, 5, 12]) { osc('sawtooth', f, t, t + dur + 0.7, f1, dt); osc('sawtooth', f, t, t + dur + 0.7, f2, dt); }
    },
  };

  // ----------------------------------------------------------------- sequencer
  function stepDur(s) { return 60 / s.def.bpm / 4; }
  function scheduleStep(s, t) {
    const D = s.def, st = s.step % 16, bar = Math.floor(s.step / 16) % D.chords.length;
    const [root, q] = D.chords[bar], tones = CH[q];
    const sd = stepDur(s), L = s.layers;
    const hit = (pat, i = st) => pat && (pat[i] === 'x' || pat[i] === 'X' || pat[i] === 'o');
    // drums
    if (hit(D.kick)) I.kick(t, L.base);
    if (hit(D.snare)) I.snare(t, L.base);
    if (hit(D.hat)) I.hat(t, L.base);
    if (hit(D.tom)) I.tom(t, L.rage, st % 4 === 0 ? 92 : st % 2 ? 128 : 110);
    if (hit(D.furyHat)) I.hat(t, L.fury, 0.1);
    if (st === 0) { if (bar % 4 === 0) I.crash(t, L.fury, 0.22); if (bar % 8 === 0) I.crash(t, L.base, 0.12); }
    // bass
    if (hit(D.bass)) {
      const f = mtof(root + (D.bass[st] === 'o' ? 12 : 0));
      I.bass(t, L.base, f, sd * 1.6);
      I.bass(t, L.rage, f, sd * 1.4, 0.18, true);
    }
    // sustained harmony at bar start
    if (st === 0) {
      const barDur = sd * 16;
      if (D.drone) I.drone(t, L.base, mtof(root + 12), barDur);
      const chord = tones.map(x => mtof(root + 24 + x));
      if (D.choir) I.choir(t, L.lead, chord, barDur);
      else if (D.pad) I.pad(t, L.base, chord, barDur, 0.035);
    }
    // melody
    const cycle = Math.floor(s.step / 16) % (D.arpBars ? D.arpBars[1] : D.chords.length);
    const arpSection = D.arpBars && cycle >= D.arpBars[0];
    if (!arpSection) {
      const lb = cycle % 8;
      for (const n of D.lead) if (n[0] === lb && n[1] === st) I.horn(t, L.lead, mtof(n[2] + (D.leadOct || 0)), n[3] * sd * 0.95, 0.13, D.leadLp);
    } else if (hit(D.arp)) {
      const seq = [0, 1, 2, 1], k = (st / 2) | 0, oct = k >= 4 ? 12 : 0;
      I.pluck(t, L.lead, mtof(root + 36 + tones[seq[k % 4]] + oct));
    }
    // fury: horn doubles the root an octave up on the beat
    if (st % 8 === 0) I.horn(t, L.fury, mtof(root + 24), sd * 7, 0.06, 1400);
  }
  function tick() {
    if (!song || !ac) return;
    const ahead = ac.currentTime + 0.14;
    // background tabs throttle timers: skip missed steps instead of firing them all at once
    if (song.nextT < ac.currentTime - 0.1) { const sd = stepDur(song), miss = Math.ceil((ac.currentTime - song.nextT) / sd); song.step += miss; song.nextT += miss * sd; }
    while (song.nextT < ahead) { try { scheduleStep(song, song.nextT); } catch (e) { console.warn(e); } song.nextT += stepDur(song); song.step++; }
    // ease layers toward targets
    const now = ac.currentTime;
    song.layers.rage.gain.setTargetAtTime(Math.max(target.rage, target.fury) * 0.9, now, 0.4);
    song.layers.fury.gain.setTargetAtTime(target.fury, now, 0.25);
  }

  function attach(ctx, musicBus, nb, dc) {
    ac = ctx; bus = musicBus; noiseBuf = nb; distCurve = dc;
    if (!timer) timer = setInterval(tick, 25);
    if (wanted) { const w = wanted; wanted = null; play(w); }
  }
  function has(key) { return !!SONGS[key]; }
  function play(key) {
    if (!SONGS[key]) return;
    if (song && song.key === key && !song.stopping) return;
    if (!ac) { wanted = key; return; }
    stop(0.6);
    const out = ac.createGain(); out.gain.setValueAtTime(0.0001, ac.currentTime); out.gain.exponentialRampToValueAtTime(1, ac.currentTime + 0.8); out.connect(bus);
    const layers = { base: g(out, 1), lead: g(out, 0.9), rage: g(out, 0), fury: g(out, 0) };
    song = { key, def: SONGS[key], out, layers, step: 0, nextT: ac.currentTime + 0.08 };
  }
  function stop(fade = 1.0) {
    wanted = null;
    if (!song) return;
    const s = song; song = null; s.stopping = true;
    const now = ac.currentTime;
    s.out.gain.cancelScheduledValues(now); s.out.gain.setValueAtTime(Math.max(0.0001, s.out.gain.value), now);
    s.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    setTimeout(() => { try { s.out.disconnect(); } catch (e) {} }, (fade + 2.5) * 1000);
  }
  function intensity(o) { if (o.rage != null) target.rage = clamp(o.rage, 0, 1); if (o.fury != null) target.fury = clamp(o.fury, 0, 1); }
  function playing() { return song ? song.key : null; }

  // ----------------------------------------------------------------- stingers
  // Short musical transitions. They go to the music bus but are not part of a song.
  function sting(name) {
    if (!ac) return;
    const t = ac.currentTime + 0.03, d = g(bus, 1);
    const horn = (m, at, dur, v = 0.2, lp = 1800) => I.horn(t + at, d, mtof(m), dur, v, lp);
    const S = {
      battleStart() { // war horn call + drum hit
        I.kick(t, d, 1); I.tom(t, d, 80, 0.9); I.crash(t, d, 0.3);
        horn(50, 0.0, 0.9, 0.22, 1200); horn(57, 0.0, 0.9, 0.12, 1200);
        horn(50, 0.95, 0.25, 0.2, 1500); horn(62, 1.2, 1.1, 0.22, 1700); horn(57, 1.2, 1.1, 0.12, 1700);
        I.tom(t + 0.95, d, 110, 0.7); I.tom(t + 1.2, d, 85, 0.9); I.kick(t + 1.2, d, 1);
      },
      victory() { // D major fanfare
        const n = [[62, 0, 0.13], [62, 0.15, 0.13], [66, 0.3, 0.13], [69, 0.45, 0.42], [67, 0.9, 0.16], [69, 1.08, 0.16], [74, 1.26, 1.5]];
        for (const [m, at, dur] of n) horn(m, at, dur, 0.17, 2600);
        horn(62, 1.26, 1.5, 0.1, 1800); horn(66, 1.26, 1.5, 0.08, 1800);
        I.pad(t + 1.26, d, [mtof(50), mtof(57), mtof(62), mtof(66)], 1.6, 0.05);
        for (let i = 0; i < 8; i++) I.tom(t + 0.9 + i * 0.045, d, 100, 0.25 + i * 0.05);
        I.kick(t + 1.26, d, 1); I.crash(t + 1.26, d, 0.3);
      },
      defeat() { // descending lament
        [[62, 0, 0.7], [60, 0.7, 0.7], [58, 1.4, 0.7], [57, 2.1, 1.8]].forEach(([m, at, dur]) => horn(m, at, dur, 0.13, 1000));
        I.pad(t, d, [mtof(50), mtof(53), mtof(57)], 3.6, 0.04);
        I.tom(t, d, 70, 0.8); I.tom(t + 2.1, d, 60, 0.9);
      },
      levelup() {
        [62, 66, 69, 74, 78, 81].forEach((m, i) => I.pluck(t + i * 0.07, d, mtof(m), 0.16));
        I.pad(t + 0.35, d, [mtof(62), mtof(66), mtof(69)], 1.2, 0.04);
        horn(74, 0.4, 0.8, 0.1, 2600);
      },
      chapter() { // lone horn across the fjord
        horn(50, 0, 0.5, 0.2, 1000); horn(57, 0.55, 1.6, 0.2, 1300); horn(50, 0.55, 1.6, 0.1, 1100);
        I.tom(t, d, 70, 0.9); I.tom(t + 0.55, d, 60, 1); I.crash(t + 0.55, d, 0.15);
      },
      rest() { // fireside lyre
        [50, 57, 62, 66, 69, 66, 62, 57].forEach((m, i) => I.pluck(t + i * 0.16, d, mtof(m + 12), 0.12));
        I.pad(t, d, [mtof(50), mtof(57), mtof(66)], 2, 0.03);
      },
      treasure() {
        [67, 71, 74, 79, 83].forEach((m, i) => I.pluck(t + i * 0.06, d, mtof(m), 0.14));
        osc('sine', mtof(91), t + 0.32, t + 1.2, envGain(d, t + 0.32, 0.003, 0.08, 0.9));
      },
    };
    try { S[name] && S[name](); } catch (e) { console.warn(e); }
  }

  return { attach, has, play, stop, intensity, sting, playing, SONGS };
})();
