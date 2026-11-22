// 図鑑のなかみ・くわしく・せっていで、画面が左右に動かないか(横にはみ出していないか)を確かめる
const pw = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8137/';
(async () => {
  const errs = [];
  for (const [eng, w, h] of [['webkit', 375, 553], ['chromium', 412, 760]]) {
    const b = await pw[eng].launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: eng === 'chromium', hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(eng + ' ' + e.message));
    await p.goto(URL); await p.waitForSelector('.book[data-id]');
    await p.evaluate(async () => {
      const book = (await DB.all('books'))[0];
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; cv.getContext('2d').fillRect(0, 0, 200, 120);
      const blob = await (await fetch(cv.toDataURL())).blob();
      const names = ['ながいながいなまえのいきものずかんのしゃしん', 'abcdefghijklmnopqrstuvwxyzabcdefghij', 'みじかい', '？', 'とてもとてもながいなまえ２ばんめのもの', 'x'];
      for (let n = 1; n <= 6; n++) await DB.put('items', { id: 'it' + n, bookId: book.id, no: n, name: names[n - 1], stars: 1, memo: 'せつめいせつめいせつめいせつめいせつめいせつめいせつめいせつめいせつめいせつめいaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', look: { rot: 0 }, thumb: cv.toDataURL(), orig: await packImg(blob), created: Date.now() });
      book.next = 7; await DB.put('books', book);
    });
    const check = async label => {
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const out = []; const W = innerWidth;
        document.querySelectorAll('*').forEach(el => { if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && el.clientWidth && !el.closest('.pal,.opts')) out.push((el.id ? '#' + el.id : el.tagName) + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth); });
        return out;
      });
      if (r.length) errs.push(`${eng} ${label}: 横にはみ出し ${r.join(' | ')}`);
      // 横にすべらせてみる
      const s = await p.evaluate(() => { const el = document.querySelector('.body'); if (!el) return 0; el.scrollLeft = 300; return el.scrollLeft + scrollX; });
      if (s) errs.push(`${eng} ${label}: 横にスクロールできる ${s}`);
    };
    for (const frame of ['round', 'square', 'circle', 'star', 'polaroid', 'film', 'heart']) {
      await p.evaluate(async f => { const bk = (await DB.all('books'))[0]; bk.frame = f; await DB.put('books', bk); go('book', { id: bk.id }); }, frame);
      await check('なかみ/' + frame);
    }
    await p.evaluate(() => go('detail', { id: 'it1' })); await check('くわしく');
    await p.evaluate(async () => go('settings', { id: (await DB.all('books'))[0].id })); await check('せってい');
    await b.close();
  }
  console.log(errs.length ? errs.join('\n') : 'SIDE OK');
})();
