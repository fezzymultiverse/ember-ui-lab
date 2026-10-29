// Ember V1.9.25 test: loose tool-call shapes written by weaker engines are recognised.  Run: node tests/v1925-test.js
const { chromium } = require(process.env.PW || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'); let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const srv = http.createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.Capacitor = { Plugins: {}, isNativePlatform: () => true, isPluginAvailable: n => n == 'EmberYoutube', registerPlugin: n => n != 'EmberYoutube' ? undefined : ({}) }; });
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  const P = t => pg.evaluate(t => window.__ember.parseCalls(t), t), S = t => pg.evaluate(t => window.__ember.stripTags(t), t);
  let c = await P('Okay, I\'ll do it now.\n\n```\nyoutube_search {"query":"Gunna Back to the Moon"}\n```\n\nThis will search YouTube.');
  ok('code box: name {json} runs', c.length == 1 && c[0].tool == 'youtube_search' && c[0].args.query == 'Gunna Back to the Moon', c);
  ok('code box is removed from the shown text', !/youtube_search/.test(await S('```\nyoutube_search {"query":"x"}\n```\nDone.')) , await S('```\nyoutube_search {"query":"x"}\n```\nDone.'));
  c = await P('youtube_search({"query":"abc"})'); ok('name({json})', c.length == 1 && c[0].args.query == 'abc', c);
  c = await P('{"name":"youtube_search","arguments":{"query":"q"}}'); ok('bare {name, arguments}', c.length == 1 && c[0].tool == 'youtube_search' && c[0].args.query == 'q', c);
  c = await P('```json\n{"tool":"youtube_search","args":{"query":"q2"}}\n```'); ok('fenced {tool, args}', c.length == 1 && c[0].args.query == 'q2', c);
  c = await P('<tool_call>{"tool":"youtube_search","args":{"query":"t"}}</tool_call>'); ok('tag form unchanged', c.length == 1 && c[0].args.query == 't', c);
  c = await P('I would use youtube_search to find it, then youtube_download.'); ok('plain mention of a tool name is not a call', c.length == 0, c);
  c = await P('nope_tool {"query":"x"}'); ok('unknown tool name is ignored', c.length == 0, c);
  ok('no page errors', errs.length == 0, errs);
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
