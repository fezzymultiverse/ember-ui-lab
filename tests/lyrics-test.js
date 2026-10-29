// Ember V1.9.10 test: three-line lyrics preview (LRCLIB). fetch is MOCKED, no network. All lyric text below is made-up test text.
// Run: node tests/lyrics-test.js
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
  window.__f = []; window.__mode = 'ok';
  const J = (st, o) => Promise.resolve({ ok: st >= 200 && st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const SYN = '[00:05.00]Test line one\\n[00:10.50]Test line two\\n[00:15.00]\\n[00:20.00]Test line three\\n[00:25.00]Test line four\\n[00:30.00]Test line five';
  const PLAIN = '[Verse 1]\\nPlain line A\\nPlain line B\\n\\nPlain line C\\nPlain line D';
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => {
    u = String(u);
    if (u.includes('lrclib.net/api/')) {
      window.__f.push(u);
      if (window.__mode === 'down') return Promise.reject(new TypeError('Failed to fetch'));
      if (u.includes('/api/get?')) { if (['search', 'none', 'instr'].includes(window.__mode)) return J(404, { message: 'not found' }); return J(200, { duration: 200, plainLyrics: PLAIN, syncedLyrics: SYN, instrumental: false }); }
      if (u.includes('/api/search?')) {
        if (window.__mode === 'none') return J(200, []);
        if (window.__mode === 'instr') return J(200, [{ duration: 200, instrumental: true, plainLyrics: null, syncedLyrics: null }]);
        return J(200, [{ duration: 260, plainLyrics: PLAIN, syncedLyrics: null }, { duration: 201, plainLyrics: PLAIN, syncedLyrics: SYN }]);
      }
    }
    return u.startsWith('http://localhost') ? realFetch(u, o) : J(404, {});
  };`;

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  const T = (n, extra) => Object.assign({ id: 't' + n, title: 'Song ' + n, artist: 'Artist', album: 'Album', durationSec: 200 }, extra || {});

  ok('EmberLyrics loaded, card and switch exist', await pg.evaluate(() => !!window.EmberLyrics && !!document.getElementById('npLyr') && !!document.getElementById('swLyr')));
  ok('tidy strips video tags and Topic', await pg.evaluate(() => window.EmberLyrics.tidy('Song (Official Video) [HD]') === 'Song' && window.EmberLyrics.tidy('Artist - Topic') === 'Artist'));
  const pl = await pg.evaluate(() => window.EmberLyrics.parseLrc('[00:05.00]a\n[01:02.5][00:01.00]b\nnot a line'));
  ok('parseLrc reads times, multi-tags, sorts', pl.length === 3 && pl[0].t === 1 && pl[0].s === 'b' && pl[2].t === 62.5, JSON.stringify(pl));

  // exact lookup
  let r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'a', title: 'Song A (Official Video)', artist: 'Artist - Topic', album: 'Album', durationSec: 200 }));
  let f = await pg.evaluate(() => window.__f.slice());
  ok('exact lookup uses /get with cleaned artist, title, album, duration', r.state === 'ok' && r.synced.length === 6 && f.length === 1 && /\/api\/get\?/.test(f[0]) && f[0].includes('artist_name=Artist&') && f[0].includes('track_name=Song%20A&') && f[0].includes('duration=200'), JSON.stringify(f));
  await pg.evaluate(() => window.EmberLyrics.get({ id: 'a', title: 'Song A', artist: 'Artist', durationSec: 200 }));
  ok('same song is not fetched twice', (await pg.evaluate(() => window.__f.length)) === 1);

  // preview: 3 lines max, current first, skips blank lines
  const pv = await pg.evaluate(async () => { const rec = await window.EmberLyrics.get({ id: 'a', title: 'Song A', artist: 'Artist', durationSec: 200 }); const E = window.EmberLyrics; return { p0: E.preview(rec, 0), p12: E.preview(rec, 12), p16: E.preview(rec, 16), p29: E.preview(rec, 29) }; });
  ok('before the first line shows the first 3', JSON.stringify(pv.p0) === JSON.stringify(['Test line one', 'Test line two', 'Test line three']), JSON.stringify(pv.p0));
  ok('at 12s the current line is first, max 3', JSON.stringify(pv.p12) === JSON.stringify(['Test line two', 'Test line three', 'Test line four']), JSON.stringify(pv.p12));
  ok('a blank gap line is skipped', JSON.stringify(pv.p16) === JSON.stringify(['Test line three', 'Test line four', 'Test line five']), JSON.stringify(pv.p16));
  ok('near the end shows what is left (fewer than 3)', pv.p29.length === 2 && pv.p29[0] === 'Test line four', JSON.stringify(pv.p29));

  // search fallback picks the synced one closest in length
  await pg.evaluate(() => { window.__mode = 'search'; window.__f.length = 0; });
  r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'b', title: 'Song B', artist: 'Artist', durationSec: 200 }));
  f = await pg.evaluate(() => window.__f.slice());
  ok('/get 404 falls back to /search and prefers timed lyrics', f.length === 2 && /\/api\/search\?/.test(f[1]) && r.state === 'ok' && r.synced.length === 6, JSON.stringify(f) + JSON.stringify(r).slice(0, 100));

  // plain lyrics preview skips section headers
  await pg.evaluate(() => { window.__mode = 'none'; });
  r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'c', title: 'Song C', artist: 'Artist', durationSec: 200 }));
  ok('no result gives state none', r.state === 'none', JSON.stringify(r));
  const pp = await pg.evaluate(() => window.EmberLyrics.preview({ state: 'ok', synced: [], plain: window.EmberLyrics.plainLines('[Verse 1]\nPlain line A\nPlain line B\n\nPlain line C\nPlain line D') }, 50));
  ok('plain lyrics: first 3 lines, [Verse] header skipped', JSON.stringify(pp) === JSON.stringify(['Plain line A', 'Plain line B', 'Plain line C']), JSON.stringify(pp));
  await pg.evaluate(() => { window.__mode = 'instr'; });
  r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'd', title: 'Song D', artist: 'Artist', durationSec: 200 }));
  ok('instrumental shows one note line', r.instrumental === true && (await pg.evaluate(rec => window.EmberLyrics.preview(rec, 0), r))[0].includes('Instrumental'));

  // a failed lookup is not remembered
  await pg.evaluate(() => { window.__mode = 'down'; window.__f.length = 0; });
  r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'e', title: 'Song E', artist: 'Artist', durationSec: 200 }));
  ok('network failure gives state err', r.state === 'err');
  await pg.evaluate(() => { window.__mode = 'ok'; window.__f.length = 0; });
  r = await pg.evaluate(() => window.EmberLyrics.get({ id: 'e', title: 'Song E', artist: 'Artist', durationSec: 200 }));
  ok('after an error the next play tries again', r.state === 'ok' && (await pg.evaluate(() => window.__f.length)) >= 1);

  // card rendering through paint()
  await pg.evaluate(() => { window.__mode = 'ok'; window.__f.length = 0; });
  await pg.evaluate(() => window.EmberLyrics.paint({ source: 'local', track: { id: 'u1', title: 'Song U', artist: 'Artist', album: 'Album', durationSec: 200 }, positionSec: 0 }, 0));
  await pg.waitForFunction(() => document.querySelectorAll('#npLyrBody .ly').length > 0, null, { timeout: 4000 }).catch(() => { });
  let ui = await pg.evaluate(() => ({ hidden: document.getElementById('npLyr').classList.contains('hidden'), n: document.querySelectorAll('#npLyrBody .ly').length, now: document.querySelector('#npLyrBody .ly.now') && document.querySelector('#npLyrBody .ly.now').textContent, tip: document.getElementById('npTitle').title }));
  ok('card shows 3 lines with the current one marked', !ui.hidden && ui.n === 3 && ui.now === 'Test line one', JSON.stringify(ui));
  ok('title tooltip holds the same 3 lines', ui.tip.split('\n').length === 3, JSON.stringify(ui.tip));
  await pg.evaluate(() => window.EmberLyrics.paint({ source: 'local', track: { id: 'u1', title: 'Song U', artist: 'Artist', album: 'Album', durationSec: 200 }, positionSec: 21 }, 21));
  ui = await pg.evaluate(() => ({ now: document.querySelector('#npLyrBody .ly.now').textContent }));
  ok('card follows the song position', ui.now === 'Test line three', JSON.stringify(ui));
  ok('no new request while the same song keeps playing', (await pg.evaluate(() => window.__f.length)) === 1);

  // music panel calls the preview
  ok('music panel paint calls EmberLyrics.paint', await pg.evaluate(async () => { let n = 0; const o = window.EmberLyrics.paint; window.EmberLyrics.paint = (...a) => { n++; return o(...a); }; await window.EmberMusicUI.refresh(); window.EmberLyrics.paint = o; return n > 0; }));

  // switch off
  await pg.evaluate(() => { window.__f.length = 0; document.getElementById('swLyr').click(); });
  ok('switch off hides the card and is saved', await pg.evaluate(() => document.getElementById('npLyr').classList.contains('hidden') === false ? false : localStorage.getItem('ember_lyrics_on') === '0'));
  await pg.evaluate(() => window.EmberLyrics.paint({ source: 'local', track: { id: 'u2', title: 'Song V', artist: 'Artist', durationSec: 200 }, positionSec: 0 }, 0));
  await pg.waitForTimeout(300);
  ok('switch off: nothing is sent to lrclib', (await pg.evaluate(() => window.__f.length)) === 0 && await pg.evaluate(() => document.getElementById('npLyr').classList.contains('hidden')));

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
