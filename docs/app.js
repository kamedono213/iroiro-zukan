// いろいろ図鑑: 写真をとって、色や向きを変えて、名前をつけて図鑑にしまう。
// 写真はこのスマホの中(IndexedDB)だけに保存する。どこにも送らない。
'use strict';

const VERSION = '1.3';
const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZK = '<ruby>図鑑<rt>ずかん</rt></ruby>';

// ---------- 色
const PALETTE = ['#e53935', '#fb8c00', '#fdd835', '#7cb342', '#2e7d32', '#00acc1', '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#8d6e63', '#212121'];
const PAGE_COLORS = ['#ffffff', '#fff8e1', '#fce4ec', '#e8f5e9', '#e3f2fd', '#ede7f6', '#fff3e0', '#263238', '#1a237e', '#3e2723'];
const DESIGNS = [['plain', 'むじ'], ['note', 'ノート'], ['dot', 'みずたま'], ['grid', 'ほうがん'], ['stripe', 'しましま'], ['star', 'ほし']];
const FRAMES = [['square', 'しかく'], ['round', 'かどまる'], ['circle', 'まる'], ['star', 'ほし']];
const lum = hex => { const n = parseInt(hex.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const textOn = hex => lum(hex) > 0.62 ? '#222' : '#fff';

// ---------- 音(なくても動く)
let ac = null;
function se(kind) {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (kind === 'zoom') { // ひゅーん(上がる音)+きらっ
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(980, t + .38);
      g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.16, t + .08); g.gain.exponentialRampToValueAtTime(.001, t + .42);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .45);
      [1568, 2093].forEach((f, i) => { const s = ac.createOscillator(), h = ac.createGain(), u = t + .36 + i * .07; s.frequency.value = f; h.gain.setValueAtTime(.09, u); h.gain.exponentialRampToValueAtTime(.001, u + .18); s.connect(h).connect(ac.destination); s.start(u); s.stop(u + .2); });
      return;
    }
    if (kind === 'flip') { // ぱらっ(紙がこすれる音=ざらざらした音を、高さを動かしながら短く)
      const t = ac.currentTime, len = .42, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      n.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3800, t + .2); bp.frequency.exponentialRampToValueAtTime(1500, t + len);
      g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.5, t + .06); g.gain.setValueAtTime(.5, t + .16); g.gain.exponentialRampToValueAtTime(.001, t + len);
      n.connect(bp).connect(g).connect(ac.destination); n.start(t); n.stop(t + len);
      return;
    }
    const seq = { tap: [[660, .05]], shutter: [[1200, .03], [500, .06]], save: [[523, .09], [659, .09], [784, .09], [1047, .18]], del: [[300, .12], [200, .15]], ok: [[784, .08], [1047, .12]] }[kind] || [[600, .05]];
    let t = ac.currentTime;
    for (const [f, d] of seq) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = kind === 'shutter' ? 'square' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .9;
    }
  } catch (e) { /* 音が出せなくてもよい */ }
}

// ---------- 保存(IndexedDB)
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('iroiro-zukan', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('books', { keyPath: 'id' });
      const it = d.createObjectStore('items', { keyPath: 'id' });
      it.createIndex('book', 'bookId');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = () => rej(t.error); }); };
  return {
    all: store => tx(store, 'readonly', s => s.getAll()),
    get: (store, id) => tx(store, 'readonly', s => s.get(id)),
    put: (store, v) => tx(store, 'readwrite', s => s.put(v)),
    del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
    itemsOf: async bookId => (await tx('items', 'readonly', s => s.index('book').getAll(bookId))).sort((a, b) => a.no - b.no),
  };
})();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- 画像
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const blobURL = new Map();
// 写真は ArrayBuffer でしまう(iPhone の Safari などは Blob をそのまま IndexedDB にしまえないことがある)
const packImg = async blob => ({ buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' });
const imgBlob = o => o instanceof Blob ? o : new Blob([o.buf], { type: o.type || 'image/jpeg' });
function urlOf(item) { if (!blobURL.has(item.id)) blobURL.set(item.id, URL.createObjectURL(imgBlob(item.orig))); return blobURL.get(item.id); }
// 写真を長いほう 1200px までに小さくして JPEG にする
async function shrink(file) {
  const u = URL.createObjectURL(file);
  try {
    const img = await loadImg(u);
    const s = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  } finally { URL.revokeObjectURL(u); }
}
// 向き・反転・色をつけて描く。max = 長いほうの大きさ
function draw(img, look, max, canvas) {
  const rot = ((look.rot || 0) % 360 + 360) % 360, side = rot === 90 || rot === 270;
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const s = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * s), h = Math.round(h0 * s);
  const c = canvas || document.createElement('canvas');
  c.width = side ? h : w; c.height = side ? w : h;
  const g = c.getContext('2d');
  g.save(); g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
  g.scale(look.flipH ? -1 : 1, look.flipV ? -1 : 1);
  g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
  if (look.color) {
    // 'color' = 明るさはそのまま、色だけ変える(白いところは白のまま)
    g.save(); g.globalCompositeOperation = 'color'; g.globalAlpha = look.strength ?? 0.7;
    g.fillStyle = look.color; g.fillRect(0, 0, c.width, c.height); g.restore();
    if ((look.strength ?? 0.7) > 0.75) { // こい時は少しだけ色を重ねて、はっきりさせる
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = ((look.strength) - 0.75) * 0.8;
      g.fillStyle = look.color; g.fillRect(0, 0, c.width, c.height); g.restore();
    }
  }
  return c;
}

// ---------- 画面のうつりかわり(スマホの「もどる」でも1つ前へ)
let cur = null;          // 今の画面 {name, args}
let dirty = false;        // へんしゅう中で、まだしまっていない
const screens = {};
function go(name, args = {}, replace = false) {
  const st = { name, args };
  if (replace) history.replaceState(st, ''); else history.pushState(st, '');
  show(st);
}
function show(st) { cur = st; dirty = false; window.onresize = null; document.querySelectorAll('#cover,.viewer,.dlg').forEach(x => x.remove()); screens[st.name](st.args || {}); }
const leaveAsk = () => ask('しまわずに もどる?', 'いまの へんしゅうは きえます。', 'もどる', 'つづける', true);
// 画面の ◀: まだしまっていない時は、先に確かめてからもどる
async function back() {
  if (dirty && !await leaveAsk()) return;
  dirty = false; history.back();
}
// スマホの「もどる」: 履歴はもう1つ前に動いている。まだしまっていない時は確かめて、
// 「つづける」なら1つ先(いまの画面)へもどす(画面は描き直さない)
let skipPop = false;
window.addEventListener('popstate', async e => {
  if (skipPop) { skipPop = false; return; }
  const st = e.state && e.state.name ? e.state : { name: 'shelf', args: {} };
  if (dirty) {
    if (!await leaveAsk()) { skipPop = true; history.forward(); return; }
  }
  show(st);
});

// ---------- ダイアログ・おしらせ
function ask(title, text, yes = 'はい', no = 'やめる', red = false) {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<div><b>${title}</b>${text ? `<p>${text}</p>` : ''}<div class="row"><button data-a="0">${no}</button><button data-a="1" class="${red ? 'r' : 'y'}">${yes}</button></div></div>`;
    d.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b && e.target !== d) return; d.remove(); res(!!b && b.dataset.a === '1'); });
    document.body.appendChild(d);
  });
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }

// ---------- 図鑑の見た目を当てる
function theme(book) {
  const r = document.documentElement.style;
  const cover = book ? book.cover : '#3a7bd5', page = book ? book.page : '#eef2f7';
  r.setProperty('--cover', cover); r.setProperty('--coverText', textOn(cover));
  r.setProperty('--page', page); r.setProperty('--ink', lum(page) < 0.4 ? '#eef' : '#334');
  app.className = book ? 'd-' + (book.design || 'plain') : '';
  $('meta[name=theme-color]').content = cover;
}
const header = (title, left = '', right = '') => `<div class="hd">${left || '<span class="hb"></span>'}<h1>${title}</h1>${right || '<span class="hb"></span>'}</div>`;
const backBtn = '<button class="hb" id="back" aria-label="もどる">◀</button>';

// ---------- 本だな(図鑑えらび)
screens.shelf = async () => {
  theme(null);
  let books = (await DB.all('books')).sort((a, b) => a.created - b.created);
  if (!books.length) { // はじめての時は1冊用意しておく
    const b = { id: uid(), name: 'いろいろ図鑑', cover: '#1e88e5', page: '#fff8e1', design: 'note', frame: 'round', created: Date.now(), next: 1 };
    await DB.put('books', b); books = [b];
  }
  const counts = await Promise.all(books.map(b => DB.itemsOf(b.id)));
  app.innerHTML = header(`いろいろ${ZK}`) + `<div class="body"><div class="shelf">${books.map((b, i) => {
    const last = counts[i][counts[i].length - 1];
    return `<button class="book d-${b.design}" data-id="${b.id}" style="background-color:${b.cover};color:${textOn(b.cover)}"><b>${esc(b.name)}</b>${last ? `<span class="mini" style="background-image:url(${last.thumb})"></span>` : ''}<span class="cnt">${counts[i].length} こ</span></button>`;
  }).join('')}<button class="book add" id="newBook"><span>＋</span>あたらしい${ZK}をつくる</button></div>
  <div class="saveload"><button id="bSave">💾 セーブ</button><button id="bLoad">📂 ロード</button></div>
  <div class="note">しゃしんは このスマホの中だけに しまいます。<br>セーブすると、${ZK}が まるごと 1つの ファイルに なります。ロードで そのファイルを えらぶと、いまの ${ZK}に たされます。<br>Ver ${VERSION}</div></div>`;
  app.querySelectorAll('.book[data-id]').forEach((el, i) => el.onclick = () => openCover(el, books[i], counts[i]));
  $('#newBook').onclick = () => { se('tap'); go('settings', { id: null }); };
  $('#bSave').onclick = () => { se('tap'); exportAll(); };
  $('#bLoad').onclick = () => { se('tap'); const f = $('#fBackup'); f.value = ''; f.onchange = () => f.files[0] && importAll(f.files[0]); f.click(); };
};

// ---------- 表紙: おすと画面いっぱいにズーム → もう一度おすとページがめくれて なかみへ
const slow = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
function openCover(el, book, items) {
  if ($('#cover')) return;
  se('zoom');
  history.pushState({ name: 'shelf', args: {}, cover: book.id }, ''); // スマホの「もどる」で本だなへ
  const from = el.getBoundingClientRect(), to = app.getBoundingClientRect();
  const last = items[items.length - 1];
  const w = document.createElement('div'); w.id = 'cover';
  w.innerHTML = `<div class="cv sheet"><div class="cv-front d-${book.design}" style="background-color:${book.page}"></div><div class="cv-back" style="background-color:${book.page}"></div></div><div class="cv top"><div class="cv-front d-${book.design}" style="background-color:${book.cover};color:${textOn(book.cover)}">
      <button class="cv-x" aria-label="もどる">◀</button>
      <b class="cv-t">${esc(book.name)}</b>
      <div class="cv-ph ph f-${book.frame}" style="${last ? `background-image:url(${last.thumb})` : ''}">${last ? '' : '📷'}</div>
      <span class="cv-n">${items.length} こ あつめた</span>
      <span class="cv-hint">タップして ひらく</span>
    </div><div class="cv-back" style="background-color:${book.page}"></div></div>`;
  const box = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  Object.assign(w.style, box(to));
  document.body.appendChild(w);
  el.style.visibility = 'hidden';
  const dur = 520 * slow, ease = 'cubic-bezier(.2,.85,.25,1)';
  const zoom = w.animate([{ ...box(from), borderRadius: '6px 14px 14px 6px' }, { ...box(to), borderRadius: '0px' }], { duration: dur, easing: ease });
  w.querySelector('.cv-t').animate([{ fontSize: '17px' }, { fontSize: getComputedStyle(w.querySelector('.cv-t')).fontSize }], { duration: dur, easing: ease });
  w.querySelectorAll('.cv-ph,.cv-n,.cv-x').forEach(x => x.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: ease }));
  let ready = false;
  const done = () => { if (ready) return; ready = true; w.classList.add('ready'); };
  zoom.finished.then(done, done); setTimeout(done, dur + 150); // アニメの終わりが届かない端末でも先へ進めるように
  w.querySelector('.cv-x').onclick = e => { e.stopPropagation(); se('tap'); history.back(); };
  w.onclick = async () => {
    if (!ready || w.classList.contains('flip')) return;
    w.classList.add('flip'); se('flip'); setTimeout(() => se('flip'), 260 * slow);
    // 下に なかみの画面を用意してから、表紙をめくる
    cur = { name: 'book', args: { id: book.id } }; dirty = false; window.onresize = null;
    history.replaceState(cur, '');
    await screens.book({ id: book.id });
    const fd = 900 * slow, turn = [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-100deg)', offset: .7 }, { transform: 'rotateY(-180deg)' }];
    // 表紙のあとに、1まい目のページも少しおくれて めくれる
    w.querySelector('.cv.top').animate(turn, { duration: fd, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'forwards' });
    w.querySelector('.cv.sheet').animate(turn, { duration: fd * .8, delay: 260 * slow, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'forwards' });
    w.querySelector('.cv.top .cv-front').animate([{ filter: 'brightness(1)' }, { filter: 'brightness(.7)' }], { duration: fd / 2, fill: 'forwards' });
    w.animate([{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: fd + 260 * slow, fill: 'forwards' }).finished.then(() => w.remove(), () => w.remove()); setTimeout(() => w.remove(), fd + 260 * slow + 400);
  };
}

// ---------- 図鑑のなかみ
screens.book = async ({ id }) => {
  const book = await DB.get('books', id);
  if (!book) return go('shelf', {}, true);
  theme(book);
  const items = await DB.itemsOf(id);
  app.innerHTML = header(esc(book.name), backBtn, '<button class="hb" id="set" aria-label="せってい">⚙<small>せってい</small></button>') +
    `<div class="body"><div class="count">あつめた かず: ${items.length} こ</div>` +
    (items.length ? `<div class="grid f-${book.frame}">${items.map(it => `<button class="card" data-id="${it.id}"><div class="ph" style="background-image:url(${it.thumb})"></div><div class="no">No.${String(it.no).padStart(3, '0')}</div><div class="nm">${esc(it.name) || '？？？'}</div></button>`).join('')}</div>`
      : `<div class="empty"><div class="e">📷</div>まだ なにも ありません。<br>したの ボタンで しゃしんを とって、<br>${ZK}に しまおう!</div>`) +
    `</div><div class="foot"><button class="big" id="cam">📷 とる</button><button class="big sub" id="pick">🖼 えらぶ</button></div>`;
  $('#back').onclick = back;
  $('#set').onclick = () => { se('tap'); go('settings', { id }); };
  app.querySelectorAll('.card').forEach(c => c.onclick = () => { se('tap'); go('detail', { id: c.dataset.id }); });
  const take = inp => { inp.value = ''; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; se('shutter'); try { const blob = await shrink(f); draft = { key: uid(), blob, look: { rot: 0, flipH: false, flipV: false, color: null, strength: 0.7 }, name: '', memo: '', stars: 1 }; go('edit', { bookId: id, did: draft.key }); } catch (e) { toast('この しゃしんは よみこめませんでした'); } }; inp.click(); };
  $('#cam').onclick = () => take($('#fCam'));
  $('#pick').onclick = () => take($('#fPick'));
};

// ---------- へんしゅう(色・向き)→ なまえ
// args: {bookId, did} あたらしく / {itemId} なおす。写真と途中の内容は draft に持つ
let draft = null;
screens.edit = async args => {
  let item = null, book;
  if (args.itemId) { item = await DB.get('items', args.itemId); if (!item) return back(); book = await DB.get('books', item.bookId); }
  else { book = await DB.get('books', args.bookId); if (!draft || draft.key !== args.did) return back(); }
  if (!book) return go('shelf', {}, true);
  theme(book);
  if (item && (!draft || draft.key !== item.id)) {
    draft = { key: item.id, blob: imgBlob(item.orig), look: { ...item.look }, name: item.name, memo: item.memo, stars: item.stars };
  }
  const L = draft.look;
  const src = URL.createObjectURL(draft.blob);
  const img = await loadImg(src); URL.revokeObjectURL(src);
  app.innerHTML = header(item ? 'なおす' : 'いろ と むき', backBtn, '') +
    `<div class="stage"><canvas id="cv"></canvas></div>
    <div class="tools">
      <div class="trow">
        <button class="tb" data-t="l"><i>↺</i>ひだり</button><button class="tb" data-t="r"><i>↻</i>みぎ</button>
        <button class="tb" data-t="h"><i>⇆</i>うらがえし</button><button class="tb" data-t="v"><i>⇅</i>さかさま</button>
      </div>
      <div class="pal" id="pal"></div>
      <div class="trow" id="strRow"><span class="lbl">うすい</span><input type="range" id="str" min="0.15" max="1" step="0.05"><span class="lbl">こい</span></div>
    </div>
    <div class="foot"><button class="big" id="next">つぎへ ▶</button></div>`;
  const cv = $('#cv');
  const fit = () => { // キャンバスを見える所いっぱいに(にじまないよう実寸で描く)
    draw(img, L, 1000, cv);
    const st = $('.stage'); const W = st.clientWidth - 16, H = st.clientHeight - 16;
    const k = Math.min(W / cv.width, H / cv.height);
    cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px';
  };
  const pal = $('#pal');
  const swatches = () => {
    pal.innerHTML = `<button class="sw none${!L.color ? ' on' : ''}" data-c="" aria-label="もとのいろ"></button>` +
      PALETTE.map(c => `<button class="sw${L.color === c ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
      `<label class="sw pick${L.color && !PALETTE.includes(L.color) ? ' on' : ''}" aria-label="すきないろ"><input type="color" id="cp" value="${L.color || '#ff66cc'}"></label>`;
    $('#strRow').classList.toggle('hide', !L.color);
  };
  const upd = () => { dirty = true; fit(); };
  pal.onclick = e => { const b = e.target.closest('.sw[data-c]'); if (!b) return; se('tap'); L.color = b.dataset.c || null; swatches(); upd(); };
  pal.oninput = e => { if (e.target.id !== 'cp') return; L.color = e.target.value; swatches(); upd(); };
  app.querySelectorAll('.tb').forEach(b => b.onclick = () => {
    se('tap'); const t = b.dataset.t;
    if (t === 'l') L.rot = (L.rot + 270) % 360; if (t === 'r') L.rot = (L.rot + 90) % 360;
    if (t === 'h') L.flipH = !L.flipH; if (t === 'v') L.flipV = !L.flipV;
    upd();
  });
  const str = $('#str'); str.value = L.strength; str.oninput = () => { L.strength = +str.value; upd(); };
  swatches(); requestAnimationFrame(fit); window.onresize = fit;
  if (!item) dirty = true;
  $('#back').onclick = back;
  $('#next').onclick = () => { se('tap'); dirty = false; go('name', { ...args }); };
};

screens.name = async args => {
  if (!draft || draft.key !== (args.itemId || args.did)) return back();
  const item = args.itemId ? await DB.get('items', args.itemId) : null;
  const book = await DB.get('books', item ? item.bookId : args.bookId);
  if (!book) return go('shelf', {}, true);
  theme(book);
  const iu = URL.createObjectURL(draft.blob); const img = await loadImg(iu); URL.revokeObjectURL(iu);
  const thumb = draw(img, draft.look, 360).toDataURL('image/jpeg', 0.85);
  app.innerHTML = header('なまえを つける', backBtn) +
    `<div class="body"><div class="form">
      <div class="prev ph f-${book.frame}" style="background-image:url(${thumb});background-size:cover"></div>
      <label class="fl">なまえ<input class="in" id="nm" maxlength="24" placeholder="れい: あかい くるま" value="${esc(draft.name)}"></label>
      <div class="fl">レアど<div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" aria-label="${n}">★</button>`).join('')}</div></div>
      <label class="fl">せつめい(かかなくても いいよ)<textarea class="in" id="memo" maxlength="300" placeholder="どこで みつけた? どんな ところが すき?">${esc(draft.memo)}</textarea></label>
    </div></div>
    <div class="foot"><button class="big" id="save">${item ? '✔ なおして しまう' : `📖 ${ZK}に しまう`}</button></div>`;
  dirty = true;
  const paint = () => app.querySelectorAll('#stars button').forEach(b => b.classList.toggle('on', +b.dataset.n <= draft.stars));
  $('#stars').onclick = e => { const b = e.target.closest('button'); if (!b) return; se('tap'); draft.stars = +b.dataset.n; paint(); };
  paint();
  $('#nm').oninput = e => { draft.name = e.target.value; };
  $('#memo').oninput = e => { draft.memo = e.target.value; };
  $('#back').onclick = () => { dirty = false; back(); }; // 色の画面へもどるだけ(draft は残る)
  $('#save').onclick = async () => {
    const name = draft.name.trim();
    if (!name && !await ask('なまえが ないよ', 'このまま しまうと「？？？」になります。', 'しまう', 'なまえを かく')) { $('#nm').focus(); return; }
    $('#save').disabled = true;
    let it;
    try {
      if (item) { it = { ...item, name, memo: draft.memo.trim(), stars: draft.stars, look: { ...draft.look }, thumb, updated: Date.now() }; await DB.put('items', it); }
      else {
        const no = book.next || 1;
        it = { id: uid(), bookId: book.id, no, name, memo: draft.memo.trim(), stars: draft.stars, look: { ...draft.look }, orig: await packImg(draft.blob), thumb, created: Date.now() };
        await DB.put('items', it);
        book.next = no + 1; await DB.put('books', book);
      }
    } catch (e) {
      $('#save').disabled = false;
      toast('しまえませんでした。もういちど おしてね');
      return;
    }
    blobURL.delete(it.id);
    se('save'); draft = null; dirty = false;
    toast(item ? 'なおしました!' : `No.${String(it.no).padStart(3, '0')} を しまいました!`);
    // 図鑑の画面までもどる(へんしゅうの画面を履歴にのこさない)
    history.go(-2); // あたらしく: 図鑑→色→なまえ / なおす: くわしく→色→なまえ
  };
};

// ---------- 写真を画面いっぱいに見る(おすと とじる)
function viewer(src) {
  const v = document.createElement('div'); v.className = 'viewer';
  v.innerHTML = `<img src="${src}" alt=""><button class="vx" aria-label="とじる">✕</button>`;
  v.onclick = () => { se('tap'); v.classList.add('out'); setTimeout(() => v.remove(), 200); };
  document.body.appendChild(v);
}

// ---------- くわしく
screens.detail = async ({ id }) => {
  const it = await DB.get('items', id);
  if (!it) return back();
  const book = await DB.get('books', it.bookId); theme(book);
  const list = await DB.itemsOf(it.bookId); const i = list.findIndex(x => x.id === id);
  const img = await loadImg(urlOf(it));
  const big = draw(img, it.look, 900).toDataURL('image/jpeg', 0.9);
  const d = new Date(it.created);
  app.innerHTML = header(esc(book.name), backBtn, '<button class="hb" id="del" aria-label="すてる">🗑</button>') +
    `<div class="body"><div class="detail">
      <button class="ph zoomable" id="bigph" aria-label="おおきく みる" style="background-image:url(${big})"><span class="zm">🔍</span></button>
      <div class="no">No.${String(it.no).padStart(3, '0')}</div>
      <h2>${esc(it.name) || '？？？'}</h2>
      <div class="st">${'★'.repeat(it.stars)}<span style="color:#ccc">${'★'.repeat(5 - it.stars)}</span></div>
      <div class="memo">${esc(it.memo) || '<span style="color:#99a">(せつめいは まだ ありません)</span>'}</div>
      <div class="dt">${d.getFullYear()}ねん ${d.getMonth() + 1}がつ ${d.getDate()}にち に しまった</div>
      <div class="nav"><button id="prev" ${i <= 0 ? 'disabled' : ''}>◀ まえ</button><button id="nxt" ${i >= list.length - 1 ? 'disabled' : ''}>つぎ ▶</button></div>
    </div></div>
    <div class="foot"><button class="big" id="fix">✏ なおす</button></div>`;
  $('#back').onclick = back;
  $('#prev').onclick = () => { se('tap'); go('detail', { id: list[i - 1].id }, true); };
  $('#nxt').onclick = () => { se('tap'); go('detail', { id: list[i + 1].id }, true); };
  // 左右にすべらせても、まえ・つぎ
  let sx = null; const body = $('.body');
  body.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  body.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) < 70) return; if (dx > 0 && i > 0) $('#prev').click(); if (dx < 0 && i < list.length - 1) $('#nxt').click(); });
  $('#bigph').onclick = () => { se('zoom'); viewer(big); };
  $('#fix').onclick = () => { se('tap'); draft = null; go('edit', { itemId: id }); };
  $('#del').onclick = async () => {
    if (!await ask(`「${esc(it.name) || '？？？'}」を すてる?`, 'すてると もとに もどせません。', 'すてる', 'やめる', true)) return;
    await DB.del('items', id); se('del'); toast('すてました'); back();
  };
};

// ---------- 図鑑のせってい(なまえ・色・もよう・わく)
screens.settings = async ({ id }) => {
  const old = id ? await DB.get('books', id) : null;
  const b = old ? { ...old } : { id: uid(), name: '', cover: PALETTE[Math.floor(Math.random() * 10)], page: '#ffffff', design: 'plain', frame: 'round', created: Date.now(), next: 1 };
  const render = () => {
    theme(b);
    app.innerHTML = header(old ? `${ZK}の せってい` : `あたらしい${ZK}`, backBtn) +
      `<div class="body"><div class="form">
        <label class="fl">${ZK}の なまえ<input class="in" id="bn" maxlength="20" placeholder="れい: いきもの${ZK}" value="${esc(b.name)}"></label>
        <div class="fl">ひょうしの いろ<div class="pal" data-k="cover">${PALETTE.map(c => `<button class="sw${b.cover === c ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}<label class="sw pick${!PALETTE.includes(b.cover) ? ' on' : ''}"><input type="color" data-k="cover" value="${b.cover}"></label></div></div>
        <div class="fl">ページの いろ<div class="pal" data-k="page">${PAGE_COLORS.map(c => `<button class="sw${b.page === c ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}<label class="sw pick${!PAGE_COLORS.includes(b.page) ? ' on' : ''}"><input type="color" data-k="page" value="${b.page}"></label></div></div>
        <div class="fl">ページの もよう<div class="opts" data-k="design">${DESIGNS.map(([k, t]) => `<button class="opt${b.design === k ? ' on' : ''}" data-v="${k}"><span class="smp d-${k}" style="background-color:${b.page}"></span>${t}</button>`).join('')}</div></div>
        <div class="fl">しゃしんの わく<div class="opts" data-k="frame">${FRAMES.map(([k, t]) => `<button class="opt${b.frame === k ? ' on' : ''}" data-v="${k}"><span class="smp ph f-${k}" style="background:${b.cover};border:0"></span>${t}</button>`).join('')}</div></div>
        ${old ? `<button class="danger" id="delBook">この ${ZK}を すてる</button>` : ''}
      </div></div>
      <div class="foot"><button class="big" id="ok">${old ? '✔ きめる' : '📖 つくる'}</button></div>`;
    $('#bn').oninput = e => { b.name = e.target.value; dirty = true; };
    app.querySelectorAll('.pal[data-k]').forEach(p => {
      p.onclick = e => { const s = e.target.closest('.sw[data-c]'); if (!s) return; se('tap'); b[p.dataset.k] = s.dataset.c; dirty = true; render(); };
      p.onchange = e => { if (e.target.type !== 'color') return; b[p.dataset.k] = e.target.value; dirty = true; render(); };
    });
    app.querySelectorAll('.opts').forEach(p => p.onclick = e => { const o = e.target.closest('.opt'); if (!o) return; se('tap'); b[p.dataset.k] = o.dataset.v; dirty = true; render(); });
    $('#back').onclick = back;
    $('#ok').onclick = async () => {
      b.name = b.name.trim();
      if (!b.name) { toast(`${'ずかん'}の なまえを かいてね`); $('#bn').focus(); return; }
      await DB.put('books', b); se('ok'); dirty = false;
      if (old) back(); else go('book', { id: b.id }, true);
    };
    const del = $('#delBook');
    if (del) del.onclick = async () => {
      const n = (await DB.itemsOf(b.id)).length;
      if (!await ask(`「${esc(old.name)}」を すてる?`, `なかの しゃしん ${n}まいも ぜんぶ きえます。もとに もどせません。`, 'すてる', 'やめる', true)) return;
      if (n && !await ask('ほんとうに いい?', 'もういちど たしかめます。', 'すてる', 'やめる', true)) return;
      for (const it of await DB.itemsOf(b.id)) await DB.del('items', it.id);
      await DB.del('books', b.id); se('del'); dirty = false; toast('すてました');
      history.go(-2);
    };
  };
  render();
};

// ---------- セーブ(ファイルに書き出す)/ロード(読みこむ)
const b2d = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
async function exportAll() {
  const books = await DB.all('books'), items = await DB.all('items');
  const out = { app: 'iroiro-zukan', v: 1, books, items: await Promise.all(items.map(async it => ({ ...it, orig: await b2d(imgBlob(it.orig)) }))) };
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const d = new Date(); const fn = `iroiro-zukan-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  const file = new File([blob], fn, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('セーブしました');
}
async function importAll(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'iroiro-zukan') throw new Error('ちがうファイル');
    const have = new Set((await DB.all('items')).map(x => x.id));
    let n = 0;
    for (const b of data.books) if (!await DB.get('books', b.id)) await DB.put('books', b);
    for (const it of data.items) { if (have.has(it.id)) continue; it.orig = await packImg(await (await fetch(it.orig)).blob()); await DB.put('items', it); n++; }
    for (const b of data.books) { const bb = await DB.get('books', b.id); const mx = Math.max(0, ...(await DB.itemsOf(b.id)).map(x => x.no)); if ((bb.next || 1) <= mx) { bb.next = mx + 1; await DB.put('books', bb); } }
    se('save'); toast(`${n}まい ロードしました`); show({ name: 'shelf' });
  } catch (e) { toast('ロードできませんでした'); }
}

// ---------- はじまり
history.replaceState({ name: 'shelf', args: {} }, '');
show({ name: 'shelf', args: {} });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(r => { document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update(); }); });
  let reloaded = !navigator.serviceWorker.controller; // はじめて入れた時は読みこみ直さない(更新の時だけ)
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || dirty || (cur && cur.name !== 'shelf' && cur.name !== 'book')) return; reloaded = true; location.reload(); });
}
