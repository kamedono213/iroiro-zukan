// テスト用のかんたんなサーバー: node tools/serve.js → http://localhost:8137/
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root)) { s.writeHead(403); return s.end(); }
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end('404'); } s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(8137, () => console.log('http://localhost:8137/'));
