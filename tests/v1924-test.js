// Ember V1.9.24 test: defaults flipped on once, Paste/Copy buttons on the message box.  Run: node tests/v1924-test.js
const { chromium } = require(process.env.PW || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'); let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const srv = http.createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // existing user: saved settings from an older version with both switches off
  await pg.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('ember_set', JSON.stringify({ name: 'Fezzy', agentAddon: false, youtubeAddon: false, accentV: 190, engShownV1915: true })); } });
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  let st = await pg.evaluate(() => JSON.parse(localStorage.getItem('ember_set')));
  ok('old settings: Web Search and YouTube switched on once', st.agentAddon === true && st.youtubeAddon === true && st.defaultsV1924 === true, st);
  await pg.evaluate(() => { document.getElementById('swAgent').click(); });
  await pg.reload(); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  st = await pg.evaluate(() => JSON.parse(localStorage.getItem('ember_set')));
  ok('turning Web Search off by hand is kept after a reload', st.agentAddon === false && st.youtubeAddon === true, st);
  await pg.evaluate(() => navigator.clipboard.writeText('Paste me 123'));
  await pg.fill('#inp', 'abc def'); await pg.evaluate(() => { const e = document.getElementById('inp'); e.setSelectionRange(3, 3); });
  await pg.click('#bPasteIn'); await pg.waitForTimeout(250);
  ok('Paste inserts the clipboard text at the cursor', (await pg.inputValue('#inp')) == 'abcPaste me 123 def', await pg.inputValue('#inp'));
  await pg.evaluate(() => { const e = document.getElementById('inp'); e.focus(); e.setSelectionRange(3, 15); });
  await pg.evaluate(() => navigator.clipboard.writeText('x'));
  await pg.evaluate(() => document.getElementById('bCopyIn').click()); await pg.waitForTimeout(250);
  ok('Copy puts the selected text on the clipboard', (await pg.evaluate(() => navigator.clipboard.readText())) == 'Paste me 123', await pg.evaluate(() => navigator.clipboard.readText()));
  await pg.evaluate(() => { const e = document.getElementById('inp'); e.focus(); e.setSelectionRange(2, 2); });
  await pg.evaluate(() => document.getElementById('bCopyIn').click()); await pg.waitForTimeout(250);
  ok('Copy with no selection copies the whole box', (await pg.evaluate(() => navigator.clipboard.readText())) == 'abcPaste me 123 def');
  ok('no page errors', errs.length == 0, errs);
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
