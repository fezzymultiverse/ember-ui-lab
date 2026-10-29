// Ember V1.9.8 test: Providers dropdown + honest dots, header centre, command line, auto-fold, one 📎 in Documents, mic removed. Run: node tests/v198-test.js
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
// Only a Groq key exists. Groq answers, everything else would answer too if it were asked: a keyless engine must still never be green.
const MOCK = `
  localStorage.setItem('ember_keys', JSON.stringify({ groq: [{ key: 'gsk_testtesttesttesttesttesttest', st: { at: 1, ok: true, limited: false } }] }));
  const rf = window.fetch;
  window.fetch = async (u, o) => {
    u = String(u);
    if (/api\\.groq\\.com\\/openai\\/v1\\/models/.test(u)) return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/generativelanguage|mistral|cohere/.test(u)) return new Response('{}', { status: 200 });
    return rf(u, o);
  };
  window.__ws = { sent: [], made: 0 };
  window.WebSocket = function () { const s = { readyState: 0, binaryType: '', send(d) { window.__ws.sent.push(typeof d === 'string' ? d : new TextDecoder().decode(d)); }, close() {} }; window.__ws.made++; setTimeout(() => { s.readyState = 1; s.onopen && s.onopen(); }, 40); return s; };
`;
(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url); await pg.waitForTimeout(900);

  // header
  ok('Providers chip is in the header', await pg.locator('#bProv svg').count() == 1);
  const nb = await pg.locator('#pName').boundingBox();
  ok('Ember name is centred', Math.abs((nb.x + nb.width / 2) - 195) < 12, JSON.stringify(nb));
  ok('dictation button is gone', await pg.locator('#bMic').count() == 0);
  ok('Docs quick button replaced it', await pg.locator('#bDocsQuick').count() == 1);

  // dropdown
  await pg.click('#bProv'); await pg.waitForTimeout(700);
  ok('dropdown opens', await pg.locator('#provDrop:not(.hidden)').count() == 1);
  ok('lists all six providers + Free Mode', await pg.locator('#provDrop .pdrow').count() == 7);
  const dot = id => pg.locator('#provDrop .pdrow[data-id="' + id + '"] .pdd').getAttribute('class');
  ok('Groq (has a working key) is green', /\bok\b/.test(await dot('groq')), await dot('groq'));
  ok('Gemini (no key) is NOT green', !/\b(ok|limited|bad)\b/.test(await dot('gemini')) && /\bnone\b/.test(await dot('gemini')), await dot('gemini'));
  ok('Gemini row says no key saved', /no key saved/.test(await pg.locator('#provDrop .pdrow[data-id="gemini"] small').innerText()));
  ok('Prov.stateOf agrees', await pg.evaluate(() => Prov.stateOf('gemini') == 'none' && Prov.stateOf('groq') == 'ok'));
  await pg.evaluate(() => { const k = Prov.keys(); k.groq[0].st.at = 1; });
  ok('an old unchecked key is grey, not green', await pg.evaluate(() => Prov.stateOf('groq') == 'unknown'));
  ok('facts block names Gemini as having no key', await pg.evaluate(() => /NO key is saved for: .*Gemini/.test(Prov.factsBlock('pollinations', 'openai', []))));
  ok('facts block forbids claiming to be Gemini in Free Mode', await pg.evaluate(() => /NOT Gemini/.test(Prov.factsBlock('pollinations', 'openai', []))));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok('Escape closes it', await pg.locator('#provDrop.hidden').count() == 1);

  // documents: one paperclip
  await pg.click('#bGlobe').catch(() => {}); await pg.evaluate(() => EmberBrowser.open('docs')); await pg.waitForTimeout(300);
  ok('Documents bar has one paperclip, no text buttons', await pg.locator('#brDocs #dcAttach').count() == 1 && !/Files|Note/.test(await pg.locator('#brDocs .brbar').first().innerText()));
  await pg.click('#dcAttach'); await pg.waitForTimeout(100);
  ok('paperclip opens file + note icons', await pg.locator('#dcMenu:not(.hidden) button').count() == 2);
  await pg.click('#dcNew'); await pg.waitForTimeout(300);
  ok('note icon makes a note', await pg.locator('#dcView:not(.hidden)').count() == 1);
  await pg.evaluate(() => EmberBrowser.close());

  // termux
  await pg.evaluate(() => { document.getElementById('bSet').click(); }); await pg.waitForTimeout(300);
  await pg.click('.stab[data-st="hacking"]'); await pg.waitForTimeout(700);
  ok('panel starts as a bar', await pg.evaluate(() => document.getElementById('etPanel').dataset.st) == 'bar');
  await pg.click('#etMin'); await pg.waitForTimeout(600);
  ok('arrow opens it', await pg.evaluate(() => document.getElementById('etPanel').dataset.st) == 'half');
  ok('page does not slide up for the half panel', await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#settings .sb')).paddingBottom) < 100));
  await pg.evaluate(() => EmberTerm.connect()); await pg.waitForTimeout(300);
  ok('command line is there', await pg.locator('#etCli').count() == 1);
  await pg.fill('#etCli', 'echo hi'); await pg.press('#etCli', 'Enter'); await pg.waitForTimeout(300);
  ok('command line sends the command with Enter', await pg.evaluate(() => window.__ws.sent.some(s => /echo hi\r/.test(s))));
  ok('command line clears after running', (await pg.inputValue('#etCli')) == '');
  await pg.fill('#etCli', 'rm -rf /'); await pg.press('#etCli', 'Enter'); await pg.waitForTimeout(200);
  ok('destructive command waits for a second Enter', !(await pg.evaluate(() => window.__ws.sent.some(s => /rm -rf/.test(s)))));
  await pg.evaluate(() => { window.EmberNative = { openTermux: async () => ({ ok: true }) }; });
  await pg.click('#etMin'); await pg.waitForTimeout(500);
  await pg.click('#etTabs [data-v="setup"]'); await pg.waitForTimeout(200);
  await pg.click('#etPanel #etOpen').catch(() => {}); await pg.waitForTimeout(800);
  ok('Open Termux folds the panel by itself', await pg.evaluate(() => document.getElementById('etPanel').dataset.st) == 'bar');
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(3200);
  ok('it does not expand again on return', await pg.evaluate(() => document.getElementById('etPanel').dataset.st) == 'bar');

  ok('no page errors', errs.length == 0, errs.join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e.message); process.exit(1); });
