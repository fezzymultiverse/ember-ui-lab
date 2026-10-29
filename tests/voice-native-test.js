// Ember V1.5.1 test: native (Capacitor) voice input path with a MOCKED SpeechRecognition plugin.
// V1.9.8: the dictation button (#bMic) was removed, so this suite has nothing to click. It exits at once.
if (!process.env.FORCE_VOICE_TEST) { console.log('SKIP voice-native-test: dictation button removed in V1.9.8'); process.exit(0); }
// Run: node tests/voice-native-test.js   (PW=/path/to/playwright overrides the module path)
const { chromium } = require(process.env.PW || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const srv = http.createServer((q, r) => {
  const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0];
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    const t = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.png') ? 'image/png' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    r.writeHead(200, { 'content-type': t }); r.end(d);
  });
});
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra || '')); };

const MOCK = mode => `
  window.__sr = { mode: ${JSON.stringify(mode)}, listeners: {}, started: 0, stopped: 0, perms: 0 };
  const emit = (n, d) => (window.__sr.listeners[n] || []).forEach(f => f(d));
  window.Capacitor = { Plugins: { SpeechRecognition: {
    available: async () => ({ available: window.__sr.mode !== 'unavailable' }),
    checkPermissions: async () => ({ speechRecognition: window.__sr.mode === 'denied' ? 'prompt' : 'granted' }),
    requestPermissions: async () => { window.__sr.perms++; return { speechRecognition: window.__sr.mode === 'denied' ? 'denied' : 'granted' }; },
    removeAllListeners: async () => { window.__sr.listeners = {}; },
    addListener: async (n, f) => { (window.__sr.listeners[n] = window.__sr.listeners[n] || []).push(f); return { remove: async () => {} }; },
    start: async o => { window.__sr.started++; window.__sr.opts = o; emit('listeningState', { status: 'started' });
      setTimeout(() => emit('partialResults', { matches: ['hello wor'] }), 30);
      setTimeout(() => emit('partialResults', { matches: ['hello world'] }), 60);
      return {}; },
    stop: async () => { window.__sr.stopped++; emit('listeningState', { status: 'stopped' }); }
  } } };`;

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const run = async (mode, fn) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(MOCK(mode));
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
    await fn(pg); ok(mode + ': no page errors', errs.length == 0, errs.join(' | ')); await ctx.close();
  };

  await run('ok', async pg => {
    ok('native speech bridge exposed', await pg.evaluate(() => !!(window.EmberNative && window.EmberNative.speech && window.EmberNative.speech.isNative)));
    await pg.fill('#inp', 'note:');
    await pg.click('#bMic'); await pg.waitForTimeout(120);
    ok('mic shows recording', await pg.locator('#bMic.rec').count() == 1);
    ok('live text appended to existing draft', (await pg.inputValue('#inp')) == 'note: hello world', await pg.inputValue('#inp'));
    ok('plugin asked for partial results, no popup', await pg.evaluate(() => window.__sr.opts.partialResults === true && window.__sr.opts.popup === false));
    await pg.click('#bMic'); await pg.waitForTimeout(100);
    ok('second tap stops the engine', await pg.evaluate(() => window.__sr.stopped == 1));
    ok('mic back to idle', await pg.locator('#bMic.rec').count() == 0);
    ok('listeners cleaned up', await pg.evaluate(() => Object.keys(window.__sr.listeners).length == 0));
  });
  await run('denied', async pg => {
    await pg.click('#bMic'); await pg.waitForTimeout(150);
    ok('permission requested once', await pg.evaluate(() => window.__sr.perms == 1));
    ok('engine not started when denied', await pg.evaluate(() => window.__sr.started == 0));
    ok('toast says permission denied', /permission denied/i.test(await pg.textContent('body')));
  });
  await run('unavailable', async pg => {
    await pg.click('#bMic'); await pg.waitForTimeout(150);
    ok('only the Android popup fallback is tried when the quiet engine is missing', await pg.evaluate(() => window.__sr.started == 0 || (window.__sr.started == 1 && window.__sr.opts.popup === true && window.__sr.opts.partialResults === false)));
    ok('toast explains the missing speech service', /No speech service/i.test(await pg.textContent('body')));
  });

  // browser path (no Capacitor): unchanged Web Speech fallback message when unsupported
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  const pg = await ctx.newPage(); await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready);
  await pg.click('#bMic'); await pg.waitForTimeout(100);
  ok('browser without speech API shows the unsupported toast', /not supported/i.test(await pg.textContent('body')));

  await b.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
