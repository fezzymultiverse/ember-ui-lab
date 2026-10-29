// Ember V1.8.3 test: real in-app browser wiring (native plugin MOCKED) and Termux auto-connect (WebSocket MOCKED). Run: node tests/v183-test.js
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const srv = http.createServer((q, r) => {
  const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0];
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    const t = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.png') ? 'image/png' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    r.writeHead(200, { 'content-type': t }); r.end(d);
  });
});
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra || '')); };
const MOCK = `
  window.__web = { opened: [], closed: 0, cbs: {}, failOpen: false };
  window.Capacitor = { Plugins: { EmberWeb: {
    open: async o => { if (window.__web.failOpen) throw new Error('boom'); window.__web.opened.push(o.url); return { ok: true }; },
    close: async () => { window.__web.closed++; },
    addListener: (n, cb) => { window.__web.cbs[n] = cb; return { remove() {} }; } } } };
  window.__ws = { mode: 'ok', made: 0, sent: [] };
  window.WebSocket = function (url, proto) {
    const s = { readyState: 0, binaryType: '', send(d) { window.__ws.sent.push(typeof d === 'string' ? d : new TextDecoder().decode(d)); }, close() {} };
    window.__ws.made++;
    setTimeout(() => { if (window.__ws.mode === 'ok') { s.readyState = 1; s.onopen && s.onopen(); } else { s.readyState = 3; s.onclose && s.onclose(); } }, 60);
    return s;
  };`;

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);

  // ---- real browser ----
  ok('native web is available in the app', await pg.evaluate(() => !!(window.EmberNative && window.EmberNative.web && window.EmberNative.web.available)));
  await pg.evaluate(() => window.EmberBrowser.open('web'));
  ok('Browser sheet shows the Real browser switch, on by default', (await pg.textContent('#brReal')).trim() == 'Real browser: on' && await pg.isVisible('#brReal'));
  await pg.fill('#brUrl', 'github.com'); await pg.click('#brGo'); await pg.waitForTimeout(150);
  ok('typing a site opens the real browser with https://', JSON.stringify(await pg.evaluate(() => window.__web.opened)) == '["https://github.com"]', JSON.stringify(await pg.evaluate(() => window.__web.opened)));
  await pg.fill('#brUrl', 'cape town weather'); await pg.press('#brUrl', 'Enter'); await pg.waitForTimeout(150);
  ok('typing words searches in the real browser', (await pg.evaluate(() => window.__web.opened)).pop() == 'https://duckduckgo.com/?q=cape%20town%20weather');
  ok('the reader view was not used (no scraping credits spent)', await pg.evaluate(() => !document.getElementById('brNote').textContent.includes('Loading')));

  // Ask / Save buttons of the native browser come back as page events
  await pg.evaluate(() => { window.__asked = null; window.__saved = null;
    window.EmberBridge = Object.assign(window.EmberBridge || {}, { askAbout: async o => { window.__asked = o; return true; } });
    window.EmberDocs = Object.assign(window.EmberDocs || {}, { addText: async (n, t, k) => { window.__saved = { n, t, k }; return { saved: true }; } }); });
  await pg.evaluate(() => window.__web.cbs.page({ kind: 'ask', url: 'https://x.io/a', title: 'X page', text: 'hello page text' }));
  await pg.waitForTimeout(100);
  const asked = await pg.evaluate(() => window.__asked);
  ok('Ask Ember sends the page text to the chat as data', asked && asked.ctx == 'hello page text' && /x\.io\/a/.test(asked.chip) && /real browser/.test(asked.chip), JSON.stringify(asked));
  await pg.evaluate(() => window.EmberBrowser.open('web'));
  await pg.evaluate(() => window.__web.cbs.page({ kind: 'save', url: 'https://x.io/a', title: 'X page', text: 'saved text' }));
  await pg.waitForTimeout(100);
  const saved = await pg.evaluate(() => window.__saved);
  ok('Save to Documents stores url + text', saved && saved.n == 'X page' && /^https:\/\/x\.io\/a\n\nsaved text$/.test(saved.t) && saved.k == 'browser', JSON.stringify(saved));
  await pg.evaluate(() => window.__web.cbs.page({ kind: 'ask', url: 'u', title: 't', text: '   ' }));
  ok('an empty page is not sent', await pg.evaluate(() => window.__asked.ctx) == 'hello page text');

  // switch to Reader view: Go no longer opens the native browser
  const before = (await pg.evaluate(() => window.__web.opened)).length;
  await pg.click('#brReal'); ok('toggle switches to Reader view', (await pg.textContent('#brReal')).trim() == 'Reader view');
  await pg.fill('#brUrl', 'example.com'); await pg.click('#brGo'); await pg.waitForTimeout(150);
  ok('Reader view does not open the native browser', (await pg.evaluate(() => window.__web.opened)).length == before);
  await pg.click('#brReal');
  // native open fails: falls back to Reader view with a message
  await pg.evaluate(() => { window.__web.failOpen = true; });
  await pg.fill('#brUrl', 'example.org'); await pg.click('#brGo'); await pg.waitForTimeout(250);
  ok('if the native browser cannot open, Reader view takes over', await pg.evaluate(() => /Web Scraping is off|Loading|chars via|Could not|No reader|Every provider/.test(document.getElementById('brView').textContent + document.getElementById('brNote').textContent)), await pg.evaluate(() => document.getElementById('brView').textContent.slice(0, 120)));

  // ---- Termux auto-connect ----
  ok('EmberTerm.ensureOn exists', await pg.evaluate(() => typeof window.EmberTerm.ensureOn == 'function'));
  ok('starts disconnected', await pg.evaluate(() => window.EmberTerm.state()) == 'off');
  const up = await pg.evaluate(() => window.EmberTerm.ensureOn());
  ok('ensureOn connects by itself when the bridge answers', up === true && await pg.evaluate(() => window.EmberTerm.state()) == 'on' && await pg.evaluate(() => window.__ws.made) == 1);
  const again = await pg.evaluate(() => window.EmberTerm.ensureOn());
  ok('already connected: no second socket', again === true && await pg.evaluate(() => window.__ws.made) == 1);
  await pg.evaluate(() => { window.EmberTerm.disconnect(); window.__ws.mode = 'down'; });
  const t0 = Date.now(); const dead = await pg.evaluate(() => window.EmberTerm.ensureOn());
  ok('bridge not running: gives up quickly with false (command gets copied by the caller)', dead === false && Date.now() - t0 < 3000, dead + ' ' + (Date.now() - t0));

  // pressing a preset while disconnected connects first, then types the command
  await pg.evaluate(() => { window.EmberTerm.disconnect(); window.__ws.mode = 'ok'; window.__ws.sent.length = 0; });
  await pg.evaluate(() => window.EmberBrowser.close()); await pg.waitForTimeout(200);
  await pg.click('#bSet'); await pg.click('.stab[data-st="hacking"]'); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.EmberTerm.disconnect());
  const cmd = await pg.evaluate(() => { const b = document.querySelector('#etPre .etpc'); return b ? b.title : ''; });
  await pg.evaluate(() => { const on = document.querySelector('#etPre .etp0[data-a="enter"]'); if (on && !on.classList.contains('on')) on.click(); });
  await pg.click('#etPre .etpc'); await pg.waitForTimeout(700);
  const sent = await pg.evaluate(() => window.__ws.sent.join('|'));
  ok('preset tapped while disconnected: connected by itself and the command was sent', await pg.evaluate(() => window.EmberTerm.state()) == 'on' && cmd && sent.includes(cmd), 'cmd=' + cmd + ' sent=' + sent.slice(0, 200));

  ok('no page errors', errs.length == 0, errs.join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
