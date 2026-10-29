// Ember V1.9.9 test: Ember Voice (Gemini / ElevenLabs cloud voice) with the phone voice as fallback.
// fetch is MOCKED, native text-to-speech is MOCKED, nothing is heard and no network is used. Run: node tests/voice-cloud-test.js
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
  localStorage.getItem('ember_keys') || localStorage.setItem('ember_keys', JSON.stringify({ gemini: [{ key: 'AIzaSyTESTKEY0123456789abcdefghijklmnop' }] }));
  window.__tts = { calls: [], pending: [] };
  window.Capacitor = { Plugins: { TextToSpeech: {
    getSupportedVoices: async () => ({ voices: [{ voiceURI: 'en-us-x-aaa-local', name: 'en-us-x-aaa-local', lang: 'en-US', localService: true }] }),
    speak: o => new Promise(res => { window.__tts.calls.push(o); window.__tts.pending.push(res); }),
    stop: async () => { window.__tts.pending.splice(0).forEach(f => f()); }
  } } };
  // fetch mock. window.__mode: 'ok' | 'model404' | '429' | 'noaudio'. window.__secs = seconds of silence returned.
  window.__f = []; window.__mode = 'ok'; window.__secs = 0.2;
  const pcm = s => { const n = Math.round(24000 * s), u = new Uint8Array(n * 2); let b = ''; for (let i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b); };
  const wav = s => { const n = Math.round(8000 * s), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); return b; };
  const J = (st, o) => Promise.resolve({ ok: st >= 200 && st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => {
    u = String(u);
    if (u.includes('generativelanguage.googleapis.com') && u.includes(':generateContent')) {
      const body = JSON.parse((o && o.body) || '{}'); window.__f.push({ url: u, headers: (o && o.headers) || {}, body });
      if (window.__mode === '429') return J(429, { error: { message: 'quota' } });
      if (window.__mode === 'model404' && u.includes('3.1-flash-tts-preview')) return J(404, { error: { message: 'model not found' } });
      if (window.__mode === 'noaudio') return J(200, { candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
      return J(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm(window.__secs) } }] } }] });
    }
    if (u.includes('api.elevenlabs.io')) {
      window.__f.push({ url: u, headers: (o && o.headers) || {}, body: JSON.parse((o && o.body) || '{}') });
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => wav(window.__secs), json: async () => ({}) });
    }
    return u.startsWith('http://localhost') ? realFetch(u, o) : J(404, { error: { message: 'mock: not found' } });
  };`;

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);

  ok('EmberVoice loaded', await pg.evaluate(() => !!window.EmberVoice && typeof window.EmberVoice.speak === 'function'));
  ok('active() true by default with a Gemini key saved', await pg.evaluate(() => window.EmberVoice.active()));

  // 1. normal Gemini speak
  let r = await pg.evaluate(() => window.EmberVoice.speak('Hello there. This is Ember.', {}));
  let f = await pg.evaluate(() => window.__f.slice());
  ok('speak ok', r.ok === true && !r.rest, JSON.stringify(r));
  ok('one Gemini request, first model is 3.1 flash tts preview', f.length === 1 && f[0].url.includes('gemini-3.1-flash-tts-preview'), JSON.stringify(f.map(x => x.url)));
  ok('key goes in x-goog-api-key, not the URL', f[0].headers['x-goog-api-key'] === 'AIzaSyTESTKEY0123456789abcdefghijklmnop' && !f[0].url.includes('key='));
  ok('asks for AUDIO with the Puck voice', f[0].body.generationConfig.responseModalities[0] === 'AUDIO' && f[0].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Puck');
  ok('text and warm style prefix sent', /Hello there\. This is Ember\./.test(f[0].body.contents[0].parts[0].text) && /^Say this in a warm/.test(f[0].body.contents[0].parts[0].text));

  // 2. calm tone
  await pg.evaluate(() => { window.__f.length = 0; });
  await pg.evaluate(() => window.EmberVoice.speak('I am here with you.', { calm: true }));
  f = await pg.evaluate(() => window.__f.slice());
  ok('calm tone asks for slow, soft, no jokes', /^Say this slowly, softly and calmly/.test(f[0].body.contents[0].parts[0].text));

  // 3. model fallback and remembered
  await pg.evaluate(() => { localStorage.removeItem('ember_voice_gm'); window.__f.length = 0; window.__mode = 'model404'; });
  r = await pg.evaluate(() => window.EmberVoice.speak('Second model please.', {}));
  f = await pg.evaluate(() => window.__f.slice());
  ok('404 on the first model moves to the next and succeeds', r.ok && f.length === 2 && f[1].url.includes('gemini-2.5-flash-preview-tts'), JSON.stringify(f.map(x => x.url)));
  await pg.evaluate(() => { window.__f.length = 0; });
  await pg.evaluate(() => window.EmberVoice.speak('Remembered.', {}));
  f = await pg.evaluate(() => window.__f.slice());
  ok('working model is remembered and tried first', f.length === 1 && f[0].url.includes('gemini-2.5-flash-preview-tts'), JSON.stringify(f.map(x => x.url)));

  // 4. rate limit -> note + rest
  await pg.evaluate(() => { window.__mode = '429'; window.__f.length = 0; });
  r = await pg.evaluate(() => window.EmberVoice.speak('Limited now.', {}));
  ok('429 returns not-ok with the text to read on the phone voice', r.ok === false && /Limited now/.test(r.rest) && /phone voice/.test(r.note), JSON.stringify(r));

  // 5. no audio in the response
  await pg.evaluate(() => { window.__mode = 'noaudio'; localStorage.removeItem('ember_voice_gm'); });
  r = await pg.evaluate(() => window.EmberVoice.speak('Nothing comes back.', {}));
  ok('a model that returns no audio falls back', r.ok === false && !!r.rest, JSON.stringify(r));

  // 6. app level: failure hands the text to the native phone voice
  await pg.evaluate(() => { window.__mode = '429'; window.__tts.calls.length = 0; window.EmberSpeech.speak('Fallback now.', null); });
  await pg.waitForFunction(() => window.__tts.calls.length > 0, null, { timeout: 5000 }).catch(() => { });
  const tc = await pg.evaluate(() => window.__tts.calls.map(c => c.text));
  ok('speakText falls back to the phone voice with the same text', tc.length > 0 && /Fallback now/.test(tc.join(' ')), JSON.stringify(tc));
  await pg.evaluate(() => window.EmberSpeech.stop());

  // 7. app level: cloud voice plays and the phone voice stays quiet
  await pg.evaluate(() => { window.__mode = 'ok'; window.__secs = 0.4; window.__tts.calls.length = 0; window.__f.length = 0; window.EmberSpeech.speak('Cloud voice only.', null); });
  await pg.waitForFunction(() => window.__f.length > 0, null, { timeout: 5000 }).catch(() => { });
  await pg.waitForTimeout(900);
  ok('cloud request made and the phone voice not used', (await pg.evaluate(() => window.__f.length)) === 1 && (await pg.evaluate(() => window.__tts.calls.length)) === 0);

  // 8. stop mid-playback
  await pg.evaluate(() => { window.__secs = 6; window.__f.length = 0; });
  const t0 = Date.now();
  const pr = pg.evaluate(() => { window.__p = window.EmberVoice.speak('A long one that will be stopped.', {}); return window.__p.then(x => x); });
  await pg.waitForTimeout(900); await pg.evaluate(() => window.EmberVoice.stop());
  r = await pr;
  ok('stop ends playback early and reports stopped', r.stopped === true && Date.now() - t0 < 4000, JSON.stringify(r) + ' ' + (Date.now() - t0) + 'ms');

  // 9. chunking: sentences stay whole, long replies leave a rest for the phone voice
  const sp = await pg.evaluate(() => { const t = Array.from({ length: 40 }, (_, i) => 'This is sentence number ' + i + ' of a long reply.').join(' '); return { n: window.EmberVoice.split(t, 700).map(x => x.length) }; });
  ok('split keeps every chunk at or under 700 characters', sp.n.length >= 2 && sp.n.every(n => n <= 700), JSON.stringify(sp.n));
  await pg.evaluate(() => { window.__secs = 0.05; window.__f.length = 0; });
  r = await pg.evaluate(() => { const t = Array.from({ length: 400 }, (_, i) => 'Sentence ' + i + ' goes here.').join(' '); return window.EmberVoice.speak(t, {}).then(x => ({ ok: x.ok, hasRest: !!x.rest, restLen: (x.rest || '').length })); });
  const calls = await pg.evaluate(() => window.__f.length);
  ok('a very long reply uses 6 cloud chunks and leaves the rest', r.ok && r.hasRest && calls === 6, JSON.stringify(r) + ' calls=' + calls);

  // 10. ElevenLabs
  await pg.evaluate(() => { window.EmberVoice.setCfg({ engine: 'eleven', elKey: 'sk_test_eleven', elVoice: 'JBFqnCBsd6RMkjVDRZzb' }); window.__f.length = 0; window.__secs = 0.2; });
  ok('active() true with an ElevenLabs key', await pg.evaluate(() => window.EmberVoice.active()));
  r = await pg.evaluate(() => window.EmberVoice.speak('Eleven labs speaking.', {}));
  f = await pg.evaluate(() => window.__f.slice());
  ok('ElevenLabs request has the key header, voice id in the path and the text', r.ok && f.length === 1 && f[0].headers['xi-api-key'] === 'sk_test_eleven' && f[0].url.includes('/text-to-speech/JBFqnCBsd6RMkjVDRZzb') && f[0].body.text === 'Eleven labs speaking.', JSON.stringify(r) + JSON.stringify(f.map(x => x.url)));
  await pg.evaluate(() => window.EmberVoice.setCfg({ elKey: '' }));
  ok('ElevenLabs with no key is not active', !(await pg.evaluate(() => window.EmberVoice.active())));

  // 11. settings UI and phone-only mode
  await pg.evaluate(() => window.EmberVoice.setCfg({ engine: 'gemini', elKey: '' }));
  await pg.reload(); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(300);
  ok('Ember Voice picker, voice list and note exist', await pg.evaluate(() => !!document.getElementById('sEngine') && document.getElementById('sGemV').options.length >= 15 && document.getElementById('voiceNote').textContent.length > 10));
  await pg.evaluate(() => { const e = document.getElementById('sEngine'); e.value = 'device'; e.onchange(); });
  ok('choosing Phone voice only turns the cloud voice off and saves it', await pg.evaluate(() => !window.EmberVoice.active() && window.EmberVoice.cfg().engine === 'device'));
  await pg.evaluate(() => { window.__tts.calls.length = 0; window.__f.length = 0; window.EmberSpeech.speak('Phone only.', null); });
  await pg.waitForFunction(() => window.__tts.calls.length > 0, null, { timeout: 5000 }).catch(() => { });
  ok('Phone voice only: native voice speaks and no cloud request is made', (await pg.evaluate(() => window.__tts.calls.length)) > 0 && (await pg.evaluate(() => window.__f.length)) === 0);
  await pg.evaluate(() => window.EmberSpeech.stop());

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
