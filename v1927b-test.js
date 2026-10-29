// Ember V1.9.27 test: Get tab thumbnails, tags handed to the downloader, whole-playlist download, saved cover fallback.  Run: node tests/v1927b-test.js
const { chromium } = require(process.env.PW || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'); let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const srv = http.createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.route('https://img.example/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await pg.addInitScript(() => {
    window.__yt = { dl: [], pl: [] };
    window.Capacitor = { Plugins: {}, isNativePlatform: () => true, isPluginAvailable: n => n == 'EmberYoutube', registerPlugin: n => n != 'EmberYoutube' ? undefined : ({
      search: async o => ({ results: [{ title: 'Gunna - back to the moon (Official Video)', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA', channel: 'GunnaVEVO', durationSec: 200, thumb: 'https://img.example/a.png' }] }),
      playlist: async o => ({ title: 'My Mix', tracks: [{ title: 'T1', url: 'https://www.youtube.com/watch?v=BBBBBBBBBBB', artist: 'A1', durationSec: 10, thumb: 'https://img.example/b.png' }] }),
      downloadVideo: async o => { window.__yt.dl.push(o); return { jobId: 'job-1' }; },
      downloadPlaylist: async o => { window.__yt.pl.push(o); return { title: 'My Mix', jobs: [{ jobId: 'p1', title: 'T1', thumb: 'https://img.example/b.png', artist: 'A1' }, { jobId: 'p2', title: 'T2', thumb: '', artist: '' }] }; },
      status: async () => ({ state: 'running' }) }) };
  });
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.getElementById('gtQ').value = 'gunna'; }); await pg.evaluate(() => document.getElementById('gtYt').click()); await pg.waitForSelector('#gtRes .trk', { state: 'attached' });
  ok('search result shows its thumbnail', await pg.evaluate(() => !!document.querySelector('#gtRes .trk img.gtth[src="https://img.example/a.png"]')));
  await pg.evaluate(() => document.querySelector('#gtRes .gtd').click()); await pg.waitForTimeout(300);
  const dl = await pg.evaluate(() => window.__yt.dl[0]);
  ok('downloadVideo gets artist and thumb', dl && dl.artist == 'GunnaVEVO' && dl.thumb == 'https://img.example/a.png' && /back to the moon/.test(dl.title), dl);
  const dm = await pg.evaluate(() => ({ a: window.EmberDlMeta.find({ title: 'back to the moon', artist: 'Gunna' }), b: window.EmberDlMeta.find({ title: 'Gunna - back to the moon (Official Video)' }), c: window.EmberDlMeta.cleanTitle('Gunna - back to the moon (Official Video)') }));
  ok('saved cover is found by the cleaned title the phone will use', dm.a && dm.a.thumb == 'https://img.example/a.png' && dm.b && dm.c.artist == 'Gunna' && dm.c.title == 'back to the moon', dm);
  await pg.evaluate(() => { document.getElementById('gtUrl').value = 'https://www.youtube.com/playlist?list=PLabc'; }); await pg.evaluate(() => document.getElementById('gtAll').click()); await pg.waitForTimeout(400);
  const pl = await pg.evaluate(() => window.__yt.pl[0]);
  ok('whole playlist asks for up to 100 tracks', pl && pl.limit == 100, pl);
  const m2 = await pg.evaluate(() => window.EmberDlMeta.find({ title: 'T1', artist: 'A1' }));
  ok('playlist tracks save thumb and the playlist name as album', m2 && m2.thumb == 'https://img.example/b.png' && m2.album == 'My Mix', m2);
  ok('button label says whole playlist', await pg.evaluate(() => /Whole playlist/.test(document.getElementById('gtAll').textContent)));
  ok('no page errors', errs.length == 0, errs);
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
