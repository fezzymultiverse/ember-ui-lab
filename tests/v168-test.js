// Ember V1.6.8 test: key scripts, timers, music small-freedoms gate, persona humour + prompt fields. Pure Node, no network.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
function ctxWith(extra) {
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const evs = [], listeners = {};
  const win = { addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, dispatchEvent: e => { evs.push(e); return true; } };
  const c = Object.assign({ window: win, localStorage: ls, document: { addEventListener() {}, getElementById: () => null }, console, setTimeout, clearTimeout, setInterval: () => 0, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; }, Event: function (n) { this.type = n; }, URL, DOMParser: function () {} }, extra || {});
  Object.assign(win, c); c.window = win; vm.createContext(c); return { c, win, store, evs };
}
const run = (c, f) => vm.runInContext(W(f), c);
(async () => {
  // 1. providers.extract on a shell script
  const mem = {}; const LS = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = v; } };
  let evs; let { c, win } = ctxWith({ U: { LS }, performance: { now: Date.now }, AbortController, fetch: async () => { throw new Error('no net'); } });
  run(c, 'ember_keyscan.js'); run(c, 'providers.js');
  const M1 = 'Mk3Jd9Qw2LmN8vB5cR7tY1uP4oZ6aS0e', M2 = 'Qa3Jd9Qw2LmN8vB5cR7tY1uP4oZ6aS9z', G = 'gsk_' + 'A'.repeat(30), AQ = 'AQ.' + 'b'.repeat(40);
  const script = '#!/bin/bash\nGROQ_API_KEY="' + G + '"\nexport MISTRAL_KEYS=("' + M1 + '" "' + M2 + '")\nGEMINI_KEY=' + AQ + '\nFIRECRAWL_API_KEY="fc-0123456789abcdef0123456789abcdef"\n';
  const ex = win.Prov.extract(script);
  ok('script: groq key found', ex.groq.includes(G));
  ok('script: both mistral keys found by variable name', ex.mistral.includes(M1) && ex.mistral.includes(M2), JSON.stringify(ex.mistral));
  ok('script: AQ gemini key found', ex.gemini.includes(AQ), JSON.stringify(ex.gemini));
  ok('script: variable names are never taken as keys', !Object.values(ex).flat().some(k => /_API_KEY|MISTRAL_KEYS|GEMINI_KEY/.test(k)));

  // 2. scraper ingest from the same script
  ({ c, win } = ctxWith({ fetch: async () => { throw new Error('no net'); }, AbortController }));
  run(c, 'ember_keyscan.js'); run(c, 'ai_scraper.js');
  const bl = 'a1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
  const r = win.EmberScraper.ingestKeys(script + 'BROWSERLESS_TOKEN="' + bl + '"\nZENROWS_API_KEY=zr0123456789abcdef0123456789abcdef0123\n');
  const s = win.EmberScraper.get();
  ok('scraper: firecrawl saved as the real key', s.keys.firecrawl == 'fc-0123456789abcdef0123456789abcdef', JSON.stringify(s.keys));
  ok('scraper: browserless saved as the real key', s.keys.browserless == bl, JSON.stringify(s.keys));
  ok('scraper: zenrows saved', /^zr0123/.test(s.keys.zenrows || ''));
  ok('scraper: no variable name saved as a key', !Object.values(s.keys).some(k => /_API_KEY|_TOKEN/.test(k)));
  // via param: unknown / unavailable providers fail honestly, nothing silently swapped
  const bad = await win.EmberScraper.scrape_url('https://example.com/', '', '', 'scraperbee');
  ok('scraper: via a provider with no key fails honestly', /no key saved/.test(bad.error || ''), JSON.stringify(bad));
  const unk = await win.EmberScraper.scrape_url('https://example.com/', '', '', 'bing');
  ok('scraper: unknown provider named', /Unknown provider/.test(unk.error || ''));

  // 3. timers
  let calls = [];
  ({ c, win, evs } = ctxWith({ }));
  win.EmberPlayer = { control: async (a) => { calls.push(a); return { ok: true }; } };
  win.EmberNative = { notifyReply: t => calls.push('notify:' + t) };
  run(c, 'ember_tasks.js');
  const T = win.EmberTasks;
  T.setIntent('how are you', ''); let g = await T.dispatch('set_timer', { minutes: 5 });
  ok('timer: refused when he did not ask', /did not ask/.test(g.error || ''));
  T.setIntent('play music for an hour then remind me to stretch', '');
  g = await T.dispatch('set_timer', { minutes: 60, note: 'stretch', stop_music: true });
  ok('timer: set when asked', g.ok && g.minutes == 60 && g.stopsMusic);
  ok('timer: bad minutes rejected', (await T.dispatch('set_timer', { minutes: 0 })).error);
  ok('timer: listed', (await T.dispatch('list_timers', {})).timers.length == 1);
  vm.runInContext('(function(){ const n = Date.now.bind(Date); Date.now = () => n() + 61 * 60000; })()', c); T._tick(false);
  ok('timer: fires, stops music, notifies', calls.includes('stop') && calls.some(x => /notify:.*stretch/.test(x)), JSON.stringify(calls));
  ok('timer: tells the chat via ember-timer event', evs.some(e => e.type == 'ember-timer' && /stretch/.test(e.detail.text)));
  ok('timer: gone after firing', T.count() == 0);

  // 4. music small freedoms gate
  ({ c, win } = ctxWith({}));
  win.EmberPlayer = { snapshot: () => ({ playing: true, track: { title: 'Lose Yourself', artist: 'Eminem' } }), capabilities: () => ({ library: 3, playlists: [], audd: false, can: ['skip'], cannot: [] }), control: async a => ({ ok: true, source: 'local' }), nowPlaying: async () => ({ track: { title: 'x' }, playing: true }), list: () => [], count: () => 3, brief: x => x, deviceOk: () => true, get: () => null };
  try { run(c, 'ai_music.js'); } catch (e) { console.log('music load', e.message); }
  const MA = win.EmberMusicAddon;
  MA.setIntent('lol that was a funny joke', ''); MA.setFree(false);
  let d = await MA.dispatch('control_player', { action: 'next' });
  ok('music: gated when freedoms are off', /did not ask about music/.test(d.error || ''), JSON.stringify(d));
  MA.setFree(true);
  d = await MA.dispatch('control_player', { action: 'next' });
  ok('music: next allowed with small freedoms', d && d.ok, JSON.stringify(d));
  d = await MA.dispatch('control_player', { action: 'stop' });
  ok('music: stop still needs him to ask', /did not ask about music/.test(d.error || ''), JSON.stringify(d));
  ok('music: prompt shows what is playing', /NOW PLAYING.*Lose Yourself.*Eminem/.test(MA.stateBlock()));

  // 5. persona + prompts wiring present in source
  ok('persona: humour rule present', /Humour is part of who you are/.test(W('persona.js')) && /lmao/.test(W('persona.js')));
  ok('prompts: fields wired in HTML and JS', ['pNo', 'pRem', 'pTask'].every(id => W('index.html').includes('id="' + id + '"') && W('ai.js').includes("$('" + id + "')")));
  ok('css: drawer textarea no longer white', /#drawer textarea/.test(W('style.css')));
  ok('sw + html load ember_tasks.js', W('sw.js').includes('ember_tasks.js') && W('index.html').includes('ember_tasks.js'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
