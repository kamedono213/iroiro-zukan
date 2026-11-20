const { chromium } = require('C:/Users/user/Desktop/自作ゲーム/2_カードゲーム/DigimonCard/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  await p.goto(require('url').pathToFileURL(__dirname + '/icon.html').href);
  const out = __dirname + '/../docs/icons/';
  for (const [n, s] of [['icon-512', 512], ['maskable-512', 512], ['icon-192', 192], ['apple-touch-icon', 180]]) {
    await p.setViewportSize({ width: 512, height: 512 });
    const buf = await p.locator('#i').screenshot();
    if (s === 512) require('fs').writeFileSync(out + n + '.png', buf);
    else { const q = await b.newPage({ viewport: { width: s, height: s } }); await q.setContent(`<img src="data:image/png;base64,${buf.toString('base64')}" style="width:${s}px;height:${s}px;display:block">`); require('fs').writeFileSync(out + n + '.png', await q.screenshot()); await q.close(); }
  }
  await b.close(); console.log('icons ok');
})();
