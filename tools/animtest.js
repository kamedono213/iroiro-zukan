// 表紙のズームとページめくりを、コマ送りで撮って確かめる
const { chromium } = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 375, height: 553 }, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8137/'); await p.waitForSelector('.book[data-id]');
  await p.evaluate(() => { document.getAnimations = document.getAnimations; });
  const frames = async (pre, n, gap) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: path.join(OUT, `${pre}${i}.png`) }); await p.waitForTimeout(gap); } };
  await p.click('.book[data-id]'); await frames('z', 5, 90);
  await p.waitForSelector('#cover.ready'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, 'z9.png') });
  await p.click('#cover'); await frames('f', 6, 110);
  await p.waitForSelector('#cover', { state: 'detached' }); await p.screenshot({ path: path.join(OUT, 'f9.png') });
  await b.close(); console.log(errs.length ? errs : 'no errors');
})();
