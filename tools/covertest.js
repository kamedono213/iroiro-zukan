// 表紙の写真(No.1 → えらんだ1まい)と、画面が左右にずれないかを確かめる
const pw = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8137/';
(async () => {
  const errs = [];
  for (const [eng, w, h] of [['webkit', 375, 553], ['chromium', 412, 760]]) {
    const b = await pw[eng].launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: eng === 'chromium', hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(eng + ' ' + e.message));
    await p.goto(URL); await p.waitForSelector('.book[data-id]');
    // 写真3まいを直接しまう
    await p.evaluate(async () => {
      const book = (await DB.all('books'))[0];
      const mk = c => { const cv = document.createElement('canvas'); cv.width = cv.height = 60; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 60, 60); return cv.toDataURL(); };
      for (const [n, c] of [[1, '#f00'], [2, '#0f0'], [3, '#00f']]) {
        const blob = await (await fetch(mk(c))).blob();
        await DB.put('items', { id: 'it' + n, bookId: book.id, no: n, name: 'No' + n, stars: 1, memo: '', look: { rot: 0, flipH: false, flipV: false, tint: null, amt: 0 }, thumb: mk(c), orig: await packImg(blob), created: Date.now() });
      }
      book.next = 4; await DB.put('books', book);
    });
    await p.reload(); await p.waitForSelector('.book[data-id]');
    const mini = () => p.$eval('.book[data-id] .mini', e => e.style.backgroundImage);
    const red = await p.evaluate(() => (async () => (await DB.get('items', 'it1')).thumb)());
    const m1 = await mini(); if (!m1.includes(red)) errs.push(eng + ' 本だなの表紙がNo.1でない');
    // No.3 をひょうしにする
    await p.evaluate(() => go('detail', { id: 'it3' })); await p.waitForSelector('#toCover');
    const bb = await (await p.$('#toCover')).boundingBox(); const fb = await (await p.$('#fix')).boundingBox();
    if (bb.y + bb.height > fb.y) errs.push(eng + ' ひょうしボタンが下のボタンにかぶる');
    await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(400);
    if ((await p.textContent('#toCover')).indexOf('いまの') < 0) errs.push(eng + ' ひょうしに ならない');
    await p.screenshot({ path: `tools/_cover_${eng}.png` });
    await p.evaluate(() => go('shelf', {})); await p.waitForSelector('.book[data-id] .mini');
    const blue = await p.evaluate(() => (async () => (await DB.get('items', 'it3')).thumb)());
    if (!(await mini()).includes(blue)) errs.push(eng + ' えらんだ写真が表紙にならない');
    await p.tap('.book[data-id]'); await p.waitForSelector('#cover.ready');
    const cph = await p.$eval('.cv-ph', e => e.style.backgroundImage); if (!cph.includes(blue)) errs.push(eng + ' ズームした表紙がちがう');
    // せってい画面でも No.2 にかえられる
    await p.evaluate(async () => go('settings', { id: (await DB.all('books'))[0].id })); await p.waitForSelector('.cvp');
    await p.tap('.cvp[data-i=it2]'); await p.screenshot({ path: 'tools/_set_' + eng + '.png' }); await p.tap('#ok'); await p.waitForTimeout(600);
    if ((await p.evaluate(async () => (await DB.all('books'))[0].coverId)) !== 'it2') errs.push(eng + ' せっていで ひょうしが かわらない');
    // 左右にずれないか
    await p.evaluate(() => go('settings', { id: null })); await p.waitForTimeout(500);
    const sc = await p.evaluate(() => { window.scrollTo(200, 0); document.body.scrollLeft = 200; return [window.scrollX, document.documentElement.scrollWidth, innerWidth, document.body.scrollLeft]; });
    if (sc[0] || sc[3] || sc[1] > sc[2]) errs.push(eng + ' 左右にずれる ' + sc);
    const vp = await p.$eval('meta[name=viewport]', e => e.content); if (!vp.includes('user-scalable=no')) errs.push('viewport');
    await b.close();
  }
  console.log(errs.length ? errs.join('\n') : 'COVER OK');
})();
