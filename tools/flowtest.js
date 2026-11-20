// 遊びの流れをはじめから最後まで通して、画面に収まるかと、エラーが出ないかを確かめる
// node tools/flowtest.js  (先に node tools/serve.js)
const PW = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright'); const chromium = PW[process.env.ENG || 'chromium'];
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [['se2', 375, 553], ['sense9', 412, 760], ['big', 430, 740]];
(async () => {
  const b = await chromium.launch();
  // テスト用の「写真」(横長・カラフル)
  const pg = await b.newPage({ viewport: { width: 640, height: 420 } });
  await pg.setContent('<div style="width:640px;height:420px;background:linear-gradient(120deg,#8bc34a,#ffeb3b 40%,#ff7043);position:relative"><div style="position:absolute;left:220px;top:110px;width:200px;height:200px;border-radius:50%;background:#e53935"></div><div style="position:absolute;left:40px;top:40px;width:90px;height:150px;background:#fff"></div><div style="position:absolute;left:500px;top:250px;font:bold 80px sans-serif">▲</div></div>');
  const photo = await pg.screenshot(); await pg.close();
  const errs = [];
  for (const [nm, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nm + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(nm + ' console: ' + m.text()); });
    await p.goto('' + (process.env.URL || 'http://localhost:8137/') + '');
    await p.waitForSelector('.book[data-id]');
    const shot = async t => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(OUT, `${nm}-${t}.png`) }); };
    const fits = async t => { const r = await p.evaluate(() => { const o = []; document.querySelectorAll('.foot,.hd,.tools,.stage,.cv-hint,.cv-n').forEach(e => { const b = e.getBoundingClientRect(); o.push([e.className, Math.round(b.top), Math.round(b.bottom)]); }); return { h: innerHeight, sh: document.documentElement.scrollHeight, o }; }); const bad = r.o.filter(x => x[2] > r.h + 1); if (bad.length || r.sh > r.h + 1) errs.push(`${nm} ${t}: はみ出し ${JSON.stringify(r)}`); return r; };
    await shot('1shelf'); await fits('shelf');
    await p.click('.book[data-id]'); await p.waitForSelector('#cover.ready'); await shot('1b-cover'); await fits('cover');
    await p.click('.cv-x'); await p.waitForSelector('#cover', { state: 'detached' }); if (!await p.$('.book[data-id]')) errs.push(nm + ': 表紙からもどれない');
    await p.click('.book[data-id]'); await p.waitForSelector('#cover.ready'); await p.goBack(); await p.waitForSelector('#cover', { state: 'detached' });
    await p.click('.book[data-id]'); await p.waitForSelector('#cover.ready'); await p.click('#cover'); await p.waitForSelector('#cam'); await p.waitForSelector('#cover', { state: 'detached' });
    await shot('2book-empty'); await fits('book');
    // 写真をえらぶ ×3
    for (let k = 0; k < 3; k++) {
      { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pick')]); await fc.setFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo }); }
      await p.waitForSelector('#cv');
      await p.waitForTimeout(200);
      if (k === 0) { await shot('3edit'); const r = await fits('edit'); const cv = await p.$eval('#cv', c => [c.clientWidth, c.clientHeight]); console.log(nm, 'canvas', cv); }
      await p.click('[data-t=r]'); if (k === 1) await p.click('[data-t=h]');
      await p.click(`.sw[data-c="${['#e53935', '#1e88e5', '#8e24aa'][k]}"]`);
      if (k === 0) { await shot('4edit-color'); await fits('edit-color'); }
      await p.click('#next'); await p.waitForSelector('#nm');
      await p.fill('#nm', ['あかい まる', 'あおい くるま', ''][k]);
      await p.click('#stars [data-n="' + (k + 2) + '"]');
      await p.fill('#memo', k === 0 ? 'こうえんで みつけた' : '');
      if (k === 0) { await shot('5name'); await fits('name'); }
      await p.click('#save');
      if (k === 2) { await p.waitForSelector('.dlg'); await shot('5b-noname'); await p.click('.dlg [data-a="1"]'); }
      await p.waitForSelector('#cam');
    }
    await shot('6book'); await fits('book-3');
    const names = await p.$$eval('.card .nm', es => es.map(e => e.textContent)); console.log(nm, 'cards', names);
    if (names.length !== 3) errs.push(nm + ': カードが3まいでない ' + names);
    // くわしく → なおす(色を消して、むきを左) → しまう
    await p.click('.card'); await p.waitForSelector('#fix'); await shot('7detail'); await fits('detail');
    await p.click('#nxt'); await p.waitForTimeout(300); const n2 = await p.$eval('.detail h2', e => e.textContent); if (n2 !== 'あおい くるま') errs.push(nm + ': つぎ ' + n2);
    await p.click('#prev'); await p.waitForTimeout(300);
    await p.click('#fix'); await p.waitForSelector('#cv'); await p.click('.sw.none'); await p.click('[data-t=l]');
    await p.click('#next'); await p.waitForSelector('#nm'); await p.fill('#nm', 'あかい まる2'); await p.click('#save');
    await p.waitForSelector('#fix'); const n3 = await p.$eval('.detail h2', e => e.textContent); if (n3 !== 'あかい まる2') errs.push(nm + ': なおす ' + n3);
    // もどる → 図鑑
    await p.click('#back'); await p.waitForSelector('#cam');
    // へんしゅうの途中で スマホの「もどる」→ 確かめが出る → つづける
    { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pick')]); await fc.setFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo }); }
    await p.waitForSelector('#cv'); await p.goBack(); await p.waitForSelector('.dlg'); await shot('8confirm');
    await p.click('.dlg [data-a="0"]'); await p.waitForTimeout(200); if (!await p.$('#cv')) errs.push(nm + ': つづけるで画面が消えた');
    await p.goBack(); await p.waitForSelector('.dlg'); await p.click('.dlg [data-a="1"]'); await p.waitForSelector('#cam');
    // せってい: なまえ・ひょうし・ページ・もよう・わく
    await p.click('#set'); await p.waitForSelector('#bn'); await shot('9settings'); await fits('settings');
    await p.fill('#bn', 'いきもの図鑑');
    await p.click('.pal[data-k=cover] .sw[data-c="#2e7d32"]');
    await p.click('.pal[data-k=page] .sw[data-c="#263238"]');
    await p.click('.opts[data-k=design] .opt[data-v=star]');
    await p.click('.opts[data-k=frame] .opt[data-v=circle]');
    await shot('9b-settings2');
    await p.click('#ok'); await p.waitForSelector('#cam'); await shot('10book-themed');
    const t = await p.$eval('.hd h1', e => e.textContent); if (t !== 'いきもの図鑑') errs.push(nm + ': なまえ ' + t);
    // 本だなへ・新しい図鑑
    await p.click('#back'); await p.waitForSelector('#newBook'); await p.waitForTimeout(300); await p.click('#newBook'); await p.waitForSelector('#bn');
    await p.fill('#bn', 'おもちゃ図鑑'); await p.click('#ok'); await p.waitForSelector('#cam');
    await p.click('#back'); await p.waitForSelector('#newBook'); await shot('11shelf2');
    const bc = await p.$$eval('.book[data-id]', e => e.length); if (bc !== 2) errs.push(nm + ': 本が' + bc);
    // 読みこみ直しても残っている
    await p.reload(); await p.waitForSelector('.book[data-id]'); const cnt = await p.$eval('.book[data-id] .cnt', e => e.textContent); if (!cnt.startsWith('3')) errs.push(nm + ': reload後 ' + cnt);
    await ctx.close();
  }
  await b.close();
  console.log(errs.length ? 'ERR\n' + errs.join('\n') : 'ALL OK');
})();
