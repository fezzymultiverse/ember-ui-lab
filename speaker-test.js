// Ember V1.8.1 test: red Stop speaker, native voice picker, speed/pitch, lively delivery, mic label, drawer Music Console.
// Native text-to-speech is MOCKED (nothing is heard in this test). Run: node tests/speaker-test.js
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

// Mock @capacitor-community/text-to-speech: speak() stays "talking" until release() or stop().
const MOCK = `
  window.__tts = { calls: [], stops: 0, pending: [], voices: [
    { voiceURI: 'en-us-x-aaa-local', name: 'en-us-x-aaa-local', lang: 'en-US', localService: true },
    { voiceURI: 'en-gb-x-bbb-network', name: 'en-gb-x-bbb-network', lang: 'en-GB', localService: false },
    { voiceURI: 'fr-fr-x-ccc-local', name: 'fr-fr-x-ccc-local', lang: 'fr-FR', localService: true } ] };
  window.__tts.release = () => { const f = window.__tts.pending.shift(); if (f) f(); };
  window.Capacitor = { Plugins: { TextToSpeech: {
    getSupportedVoices: async () => ({ voices: window.__tts.voices }),
    speak: o => new Promise((res) => { window.__tts.calls.push(o); window.__tts.pending.push(res); }),
    stop: async () => { window.__tts.stops++; const p = window.__tts.pending.splice(0); p.forEach(f => f()); }
  } } };`;

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);

  // put a conversation with one assistant reply into storage, then reload so it is restored
  await pg.evaluate(async () => {
    const c = { id: 'spk1', title: 'Speaker', auto: false, created: Date.now(), updated: Date.now(), priv: false, sum: '',
      msgs: [{ r: 'u', t: 'hi', ts: Date.now() }, { r: 'a', t: 'Hello there. Are you ready? Yes! Let us go...', ts: Date.now() }] };
    await window.Store.put(c); sessionStorage.setItem('ember_session_conv', 'spk1');
  });
  await pg.reload(); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(500);
  const sayBtn = () => pg.locator('#log [data-act="say"]');

  ok('reply has a 🔊 button, not red', await sayBtn().count() == 1 && (await sayBtn().innerText()).includes('🔊') && await pg.locator('#log [data-act="say"].talking').count() == 0);

  await sayBtn().click(); await pg.waitForTimeout(250);
  ok('while talking the button is red and says Stop', await pg.locator('#log [data-act="say"].talking').count() == 1 && /Stop/.test(await sayBtn().innerText()));
  const rgb = await sayBtn().evaluate(e => getComputedStyle(e).backgroundColor);
  ok('the talking button background is red', /rgb\(255, 59, 48\)/.test(rgb), rgb);
  ok('native speech was asked to speak', await pg.evaluate(() => window.__tts.calls.length >= 1));

  await sayBtn().click(); await pg.waitForTimeout(250);
  ok('tapping it stops the native voice', await pg.evaluate(() => window.__tts.stops >= 1));
  ok('and it goes back to 🔊, not red', await pg.locator('#log [data-act="say"].talking').count() == 0 && (await sayBtn().innerText()).includes('🔊'));

  // finishing by itself also resets the button
  await pg.evaluate(() => { window.__tts.calls.length = 0; });
  await sayBtn().click(); await pg.waitForTimeout(200);
  for (let i = 0; i < 6; i++) { await pg.evaluate(() => window.__tts.release()); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(300);
  ok('when the voice finishes on its own the button goes back', await pg.locator('#log [data-act="say"].talking').count() == 0);

  // a re-render while talking keeps the red state
  await pg.evaluate(() => { window.__tts.calls.length = 0; });
  await sayBtn().click(); await pg.waitForTimeout(200);
  await pg.evaluate(() => { document.getElementById('log').dispatchEvent(new Event('x')); });
  ok('still red while it is mid-sentence', await pg.locator('#log [data-act="say"].talking').count() == 1);
  await pg.evaluate(() => window.EmberSpeech.stop()); await pg.waitForTimeout(150);

  // voice picker lists the phone's voices, own language first, and the choice is used
  await pg.click('#bSet'); await pg.waitForTimeout(300); await pg.click('.stab[data-st="permissions"]'); await pg.waitForTimeout(200);
  const opts = await pg.locator('#sVoice option').allInnerTexts();
  ok('picker shows the phone voices', opts.length == 4 && /Phone default/.test(opts[0]), JSON.stringify(opts));
  ok('own-language voices are listed first', /en-/.test(opts[1]) && /fr-/.test(opts[3]), JSON.stringify(opts));
  ok('online voices are marked', opts.some(o => /gb.*online/.test(o)), JSON.stringify(opts));
  await pg.selectOption('#sVoice', 'en-gb-x-bbb-network');
  await pg.evaluate(() => { const r = document.getElementById('sRate'); r.value = '1.3'; r.dispatchEvent(new Event('input')); const p = document.getElementById('sPitch'); p.value = '1.2'; p.dispatchEvent(new Event('input')); });
  await pg.evaluate(() => { window.__tts.calls.length = 0; });
  await pg.click('#swLively'); // lively off so the numbers are exact
  ok('lively switch turned off', await pg.evaluate(() => JSON.parse(localStorage.getItem('ember_set')).ttsLively === false));
  await pg.click('#bVoiceTest'); await pg.waitForTimeout(250);
  const c0 = await pg.evaluate(() => window.__tts.calls[0]);
  ok('chosen voice index is sent (index 1 of the plugin list)', c0 && c0.voice === 1, JSON.stringify(c0));
  ok('speed and pitch are sent', c0 && Math.abs(c0.rate - 1.3) < 1e-6 && Math.abs(c0.pitch - 1.2) < 1e-6, JSON.stringify(c0));
  ok('settings are saved', await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('ember_set')); return s.ttsVoiceN === 'en-gb-x-bbb-network' && s.ttsRate === 1.3 && s.ttsPitch === 1.2; }));
  await pg.evaluate(() => window.EmberSpeech.stop()); await pg.waitForTimeout(100);

  // lively delivery: questions lift, exclamations speed up, trailing dots slow down; always bounded
  const sh = await pg.evaluate(() => ({ q: window.EmberSpeech.shape('Are you ready?'), e: window.EmberSpeech.shape('That is great news today!'), d: window.EmberSpeech.shape('Well, I was thinking...'), n: window.EmberSpeech.shape('This is a plain statement of some length.') }));
  ok('question lifts pitch', sh.q.p > 1 && sh.q.r == 1, JSON.stringify(sh));
  ok('exclamation is quicker and higher', sh.e.r > 1 && sh.e.p > 1, JSON.stringify(sh));
  ok('trailing dots slow it down', sh.d.r < 1 && sh.d.p < 1, JSON.stringify(sh));
  ok('plain sentence is unchanged', sh.n.r == 1 && sh.n.p == 1, JSON.stringify(sh));
  await pg.click('#swLively'); // back on
  await pg.evaluate(() => { window.__tts.calls.length = 0; });
  await pg.click('#bVoiceTest'); await pg.waitForTimeout(250);
  const c1 = await pg.evaluate(() => window.__tts.calls[0]);
  ok('lively on: values stay inside 0.5 to 2', c1 && c1.rate >= 0.5 && c1.rate <= 2 && c1.pitch >= 0.5 && c1.pitch <= 2, JSON.stringify(c1));
  await pg.evaluate(() => window.EmberSpeech.stop());

  // V1.9.8: the dictation button was removed; the 📎 Docs button replaced it
  ok('dictation button is gone, Docs button is there', (await pg.locator('#bMic').count()) == 0 && (await pg.locator('#bDocsQuick').count()) == 1);
  ok('settings explain the red Stop', /turns red/.test(await pg.locator('#ttsNote').innerText()));
  await pg.click('#bSx'); await pg.waitForTimeout(200);

  // left-panel Music Console opens the full panel and draws it
  await pg.click('#bHist'); await pg.waitForTimeout(200);
  await pg.click('#dmConsoleBtn'); await pg.click('#dmOpenFull'); await pg.waitForTimeout(300);
  ok('Open Full Music Panel opens the music sheet', await pg.locator('#music.show').count() == 1);
  ok('and closes the left menu behind it', await pg.locator('#drawer.show').count() == 0);
  ok('EmberMusicUI is exposed', await pg.evaluate(() => !!(window.EmberMusicUI && window.EmberMusicUI.open)));

  ok('no page errors', errs.length == 0, errs.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
