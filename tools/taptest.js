// 指でタップするのと同じやり方で、全部のボタンが効くかを確かめる(iPhone=WebKit / Android=Chromium)
// タップの前に「その場所のいちばん上にあるのが、そのボタンか」も調べる(見えない膜がかぶっていないか)
// URL=... node tools/taptest.js
const pw = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8137/';
(async () => {
  const errs = [];
  for (const [eng, dev] of [['webkit', { viewport: { width: 375, height: 553 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }], ['chromium', { viewport: { width: 412, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const b = await pw[eng].launch();
    const ctx = await b.newContext(dev);
    const p = await ctx.newPage();
    const E = m => errs.push(`[${eng}] ${m}`);
    p.on('pageerror', e => E('pageerror ' + e.message));
    const photo = await (async () => { const q = await ctx.newPage(); await q.setContent('<div style="width:300px;height:200px;background:linear-gradient(#f80,#08f)"></div>'); const s = await q.screenshot(); await q.close(); return s; })();
    await p.goto(URL); await p.waitForSelector('.book[data-id]');
    const tap = async (sel, label) => {
      const el = await p.waitForSelector(sel, { timeout: 5000 }).catch(() => null);
      if (!el) { E(`${label}: ${sel} が見つからない`); return false; }
      const bx = await el.boundingBox();
      const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
      const top = await p.evaluate(([x, y, sel]) => { const t = document.elementFromPoint(x, y); const want = document.querySelector(sel); return !t ? 'なし' : (want && (want === t || want.contains(t)) ? 'ok' : (t.id ? '#' + t.id : '') + '.' + t.className); }, [x, y, sel]);
      if (top !== 'ok') E(`${label}: ${sel} の上に ${top} がかぶっている`);
      await p.touchscreen.tap(x, y);
      return true;
    };
    const expect = async (sel, label, t = 3000) => { const ok = await p.waitForSelector(sel, { timeout: t }).then(() => true, () => false); if (!ok) E(`${label}: ${sel} にならない`); return ok; };
    const settle = () => p.waitForTimeout(1600);

    await tap('.book[data-id]', '本をおす'); await expect('#cover.ready', '表紙ズーム');
    await tap('.cv-x', '表紙の◀'); await settle(); if (await p.$('#cover')) E('表紙の◀でもどれない');
    await tap('.book[data-id]', '本をおす2'); await expect('#cover.ready', '表紙ズーム2');
    await tap('#cover', '表紙をおす'); await expect('#cam', 'なかみ'); await settle();
    if (await p.$('#cover')) E('めくったあと表紙が残っている');
    // 写真を3まい
    for (let k = 0; k < 2; k++) {
      const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), tap('#pick', 'えらぶ')]);
      if (!fc) { E('えらぶでファイル選択が出ない'); break; }
      await fc.setFiles({ name: 'a.png', mimeType: 'image/png', buffer: photo });
      if (!await expect('#cv', '色の画面')) break;
      for (const t of ['l', 'r', 'h', 'v']) await tap(`[data-t=${t}]`, '向き' + t);
      await tap('.sw[data-c="#1e88e5"]', '色'); await tap('.sw.none', 'もとの色');
      await tap('#next', 'つぎへ'); await expect('#nm', 'なまえ画面');
      await tap('#nm', 'なまえ欄'); await p.keyboard.type('てすと' + k);
      await tap('#stars [data-n="3"]', '星');
      await tap('#back', 'なまえ→もどる'); await expect('#cv', 'なまえから色へもどる');
      await tap('#next', 'つぎへ2'); await expect('#nm', 'なまえ画面2');
      await tap('#save', 'しまう'); await expect('.card', 'しまった後の図鑑'); await settle();
    }
    // 写真をおす → くわしく
    await tap('.card', '写真をおす'); await expect('#fix', 'くわしく');
    await tap('#bigph', '写真をおおきく'); await expect('.viewer', 'おおきく画面'); await tap('.viewer img', 'おおきくを とじる'); await p.waitForTimeout(400); if (await p.$('.viewer')) E('おおきくが とじない');
    await tap('#nxt', 'つぎ'); await p.waitForTimeout(500); await tap('#prev', 'まえ'); await p.waitForTimeout(500);
    await tap('#back', 'くわしく→もどる'); await expect('#cam', 'くわしくからもどる');
    await tap('.card', '写真をおす2'); await expect('#fix', 'くわしく2');
    await tap('#fix', 'なおす'); await expect('#cv', 'なおす画面');
    await tap('#back', 'なおす→もどる'); await settle();
    if (await p.$('.dlg')) await tap('.dlg [data-a="1"]', '確認もどる');
    await expect('#fix', 'なおすからくわしくへ');
    // スマホの「もどる」: 色の画面で確かめ→つづける→もどる
    await tap('#fix', 'なおす2'); await expect('#cv', 'なおす画面2'); await tap('[data-t=r]', '向きを変える');
    await p.goBack(); await expect('.dlg', 'スマホもどる確認'); await tap('.dlg [data-a="0"]', 'つづける'); await p.waitForTimeout(600);
    if (!await p.$('#cv')) E('つづけるで 色の画面が きえた');
    await p.goBack(); await expect('.dlg', 'スマホもどる確認2'); await tap('.dlg [data-a="1"]', 'もどる'); await expect('#fix', 'スマホもどるでくわしくへ');
    await p.goBack(); await expect('#cam', 'スマホもどるで図鑑へ'); await p.goForward(); await expect('#fix', 'すすむ');
    await tap('#del', 'すてる'); await expect('.dlg', 'すてる確認'); await tap('.dlg [data-a="0"]', 'すてるやめる');
    await tap('#back', 'くわしく→もどる2'); await expect('#cam', '図鑑へ');
    await tap('#set', 'せってい'); await expect('#bn', 'せってい画面');
    await tap('.opts[data-k=design] .opt[data-v=dot]', 'もよう');
    await tap('#back', 'せってい→もどる'); await settle();
    if (await p.$('.dlg')) await tap('.dlg [data-a="1"]', 'せってい確認もどる');
    await expect('#cam', 'せっていから図鑑へ');
    await tap('#back', '図鑑→もどる'); await expect('#newBook', '本だなへ');
    await tap('#newBook', 'あたらしい図鑑'); await expect('#bn', '新しい図鑑画面');
    await tap('#back', '新しい図鑑→もどる'); await expect('#newBook', '本だなへ2');
    await tap('#bSave', 'セーブ'); await tap('#bLoad', 'ロード');
    await b.close();
  }
  console.log(errs.length ? errs.join('\n') : 'ALL OK');
})();
