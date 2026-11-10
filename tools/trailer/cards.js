// Render transparent 1920x1080 title-card PNGs with the game's own fonts and logo.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  await p.goto('http://127.0.0.1:8642/?nosplash', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof G !== 'undefined' && G.img && G.img.wolf_tag && G.scene && G.scene !== LoadingScene, { timeout: 60000 });
  const cards = await p.evaluate(() => {
    const mk = draw => { const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const c = cv.getContext('2d'); draw(c); return cv.toDataURL('image/png'); };
    const line = (c, s, y, size = 84, color = '#fff0d6') => txt(c, s, 960, y, { size, fam: F.title, weight: 900, align: 'center', base: 'middle', color, letter: 3, stroke: 'rgba(10,4,2,0.9)', strokeW: 10, shadowColor: 'rgba(255,80,30,0.55)', shadowBlur: 36 });
    const rule = (c, y, w = 420) => { c.fillStyle = C.gold; c.fillRect(960 - w, y, w * 2, 2); };
    const card1 = (s, sub) => mk(c => { line(c, s, 540); if (sub) { rule(c, 610); txt(c, sub, 960, 660, { size: 34, fam: F.head, weight: 700, align: 'center', base: 'middle', color: C.gold, letter: 6, stroke: 'rgba(0,0,0,0.85)', strokeW: 6 }); } });
    const R = {};
    R.quarter = card1('ONE QUARTERMASTER.');
    R.days = card1('THREE DAYS TO DELIVER');
    R.cargo = mk(c => { line(c, 'FORTY BARRELS OF MEAD', 470, 76); line(c, 'TWO HUNDRED COD', 570, 76); rule(c, 632, 300); line(c, 'ONE GOLDEN GOAT', 700, 90, '#ffd27a'); });
    R.form = card1('MOST PROBLEMS NEED A FORM.');
    R.axe = card1('SOME NEED AN AXE.');
    R.some = card1('AND SOME...');
    R.bigger = card1('NEED A BIGGER AXE.');
    R.nobody = card1('BUT NOBODY...');
    R.apples = card1('...TOUCHES THE APPLES.');
    // big title slam: the real game logo, centred
    R.title = mk(c => { TitleScene.prototype.drawLogo.call({ t: 1.2 }, c, 960 - 400, 470, 1, 1.2); });
    // end card: tag, logo, studio line
    R.end = mk(c => {
      const tag = G.img.wolf_tag, th = 250, tw = tag.width * th / tag.height;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 40; c.drawImage(tag, 960 - tw / 2, 60, tw, th); c.restore();
      TitleScene.prototype.drawLogo.call({ t: 1.2 }, c, 960 - 335, 520, 1, 1.0);
      txt(c, 'A WolfZtnel Game', 960, 950, { size: 54, fam: F.title, weight: 900, align: 'center', base: 'middle', color: '#f3e6cc', letter: 2, shadowColor: 'rgba(255,90,30,0.55)', shadowBlur: 26 });
    });
    return R;
  });
  for (const k in cards) fs.writeFileSync(path.join(out, k + '.png'), Buffer.from(cards[k].split(',')[1], 'base64'));
  console.log('cards:', Object.keys(cards).join(' '));
  await b.close();
})();
