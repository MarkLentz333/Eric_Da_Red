// Deterministic frame recorder: node cap.js <outdir> <scenario-name>
// Steps the game's clock exactly 1/30 s per frame and saves each canvas frame as JPEG.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const FPS = 30, MS = 1000 / FPS;

const press = k => `G.pressed[${JSON.stringify(k)}]=true;`;
const click = (x, y) => `G.mouse.x=${x};G.mouse.y=${y};G.mouse.clicked=true;`;
const noCuts = `Cutscene.play=()=>Promise.resolve(false);`;
const SCEN = {
  splash: { url: '?auto', from: 0.2, to: 4.6 },
  title: { url: '?nosplash', from: 0.6, to: 6.0, acts: [[1.4, press('Enter')]] },
  map: { url: '?map', from: 0.4, to: 7.5, acts: [[0, noCuts], [1.6, click(520, 790)]] },
  docks: { url: '?battle=docks&level=3&auto', from: 0.8, to: 9.0, acts: [[2.6, press('Enter')], [3.0, press('Enter')], [3.4, press('Enter')]] },
  paper: { url: '?battle=warehouse&level=3&auto', from: 1.0, to: 9.0, acts: [[2.6, press('ArrowRight')], [2.8, press('Enter')], [3.2, press('Enter')], [3.6, press('Enter')]] },
  fury: { url: '?battle=road&level=4&mad=100&auto', from: 1.0, to: 10.0, acts: [[2.6, press('KeyR')]] },
  kraken: { url: '?battle=fjord&level=5&auto', from: 0.8, to: 16.0, acts: [[3.0, press('Enter')], [3.4, press('Enter')], [3.8, press('Enter')]] },
  ledger: { url: '?tavern', from: 2.0, to: 9.5, acts: [[0, `Cutscene.play=()=>Promise.resolve(true);`], [1.2, press('Escape')]] },
};

(async () => {
  const [outdir, name] = process.argv.slice(2);
  const S = SCEN[name]; if (!S) throw new Error('unknown scenario ' + name);
  const dir = path.join(outdir, name); fs.mkdirSync(dir, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1920,1080'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluateOnNewDocument(() => {
    let vt = 0; const cbs = [];
    performance.now = () => vt;
    window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
    window.__step = ms => { vt += ms; const l = cbs.splice(0); for (const cb of l) { try { cb(vt); } catch (e) { console.error(e); } } };
  });
  await p.goto('http://127.0.0.1:8642/' + S.url, { waitUntil: 'load' });
  // boot: step until the first real scene is up
  for (let i = 0; i < 4000; i++) {
    const ok = await p.evaluate(ms => { window.__step(ms); return typeof G !== 'undefined' && G.scene && G.scene !== LoadingScene; }, MS);
    if (ok) break; await new Promise(r => setTimeout(r, 15));
  }
  const total = Math.round(S.to * FPS), from = Math.round(S.from * FPS);
  const acts = (S.acts || []).map(([t, js]) => [Math.round(t * FPS), js]);
  let n = 0;
  for (let f = 0; f < total; f++) {
    for (const [af, js] of acts) if (af === f) await p.evaluate(js);
    // keep the title's background video in lock-step with the virtual clock
    await p.evaluate(async ms => {
      const v = document.getElementById('introVideo');
      if (v && G.scene && G.scene.constructor && G.scene.constructor.name === 'TitleScene' && v.duration) {
        v.pause(); const t = ((v._vt || 0) + ms / 1000) % v.duration; v._vt = t;
        await new Promise(r => { const done = () => { v.removeEventListener('seeked', done); r(); }; v.addEventListener('seeked', done); v.currentTime = t; setTimeout(r, 300); });
      }
      window.__step(ms);
    }, MS);
    if (f >= from) {
      const data = await p.evaluate(() => document.getElementById('game').toDataURL('image/jpeg', 0.93));
      fs.writeFileSync(path.join(dir, String(n++).padStart(5, '0') + '.jpg'), Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  console.log(name, 'frames:', n, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
  await b.close();
})();
