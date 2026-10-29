// Ember V1.9.32 test: ember_pastekeys.js (Paste keys card). Pure Node, real keyscan + providers + scraper, no network, no DOM.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { K, rnd, B62, HEX } = require('../tools/diag.js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (typeof x == 'string' ? x : JSON.stringify(x))); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
const mem = {}, ls = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const LS = { get: (k, d) => { try { const v = JSON.parse(ls.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => ls.setItem(k, JSON.stringify(v)) };
const ctx = { U: { LS }, window: {}, localStorage: ls, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent, performance, fetch: async () => { throw new Error('no net'); } };
vm.createContext(ctx); ['ember_keyscan.js', 'providers.js', 'ai_scraper.js', 'ember_pastekeys.js'].forEach(f => vm.runInContext(W(f), ctx));
const w = ctx.window, PK = w.EmberPasteKeys;
let audd = ''; w.EmberAudd = { hasKey: () => !!audd, getKey: () => audd, setKey: v => { audd = v; return true; } };
const state = (r, key) => (r.rows.find(x => x.key == key) || {}).state;

(async () => {
  const Z1 = rnd(HEX, 40, 201), Z2 = rnd(HEX, 40, 202), AU = rnd(B62, 32, 203), LOOSE = rnd(B62, 28, 204) + '9';
  const text = ['Groq ' + K.groq, 'ZenRows ' + Z1, 'Audd.io ' + AU, 'random note', LOOSE].join('\n\n');
  const p = PK.preview(text);
  ok('preview names each key and marks all as new before anything is saved', p.rows.length == 3 && p.rows.every(r => r.state == 'new') && p.rows.some(r => r.label == 'Groq') && p.rows.some(r => r.label == 'ZenRows'), p.rows);
  ok('preview saves nothing', w.EmberScraper.keysOf('zenrows').length == 0 && !audd);

  // first run: a stub Prov.addKey path is not needed for scrapers; chat keys go through Prov.ingest (offline here, so it is tested live and fails)
  const r1 = await PK.run(text);
  ok('first run: ZenRows and Audd.io keys are saved and shown as NEW', state(r1, Z1) == 'added' && state(r1, AU) == 'added' && w.EmberScraper.keysOf('zenrows')[0] == Z1 && audd == AU, r1.rows);
  ok('first run: the label on each row is the provider name', r1.rows.find(x => x.key == Z1).label == 'ZenRows' && r1.rows.find(x => x.key == AU).label == 'Audd.io');
  ok('first run: a key with no name beside it is offered with a provider picker, never guessed', r1.loose.includes(LOOSE), r1.loose);

  // second run with the same keys plus one new ZenRows key: only the new one is NEW
  const r2 = await PK.run(text + '\nZenRows ' + Z2);
  ok('second run: keys already saved are marked already added', state(r2, Z1) == 'have' && state(r2, AU) == 'have', r2.rows);
  ok('second run: only the new key is saved, as an extra', state(r2, Z2) == 'added' && w.EmberScraper.keysOf('zenrows').length == 2, r2.rows);

  // a different Audd token while one is saved: single slot, not overwritten
  const AU2 = rnd(B62, 31, 205) + '7', r3 = await PK.run('Audd.io ' + AU2);
  ok('single-slot provider keeps its first key and says so', state(r3, AU2) == 'full' && audd == AU, r3.rows);

  // picking the provider for a loose key files it
  const a = await PK.assign(LOOSE, 'browserless');
  ok('assign files a loose key under the provider the user picked', a.ok && w.EmberScraper.keysOf('browserless')[0] == LOOSE, a);
  ok('assign refuses a duplicate', (await PK.assign(LOOSE, 'browserless')).ok === false);

  // output safety
  const h = PK.html(r2);
  ok('the report shows masked keys only and escapes text', !h.includes(Z1) && !h.includes(Z2) && !h.includes(AU) && h.includes('ZenRows') && h.includes('NEW'), h.slice(0, 300));
  ok('named list pairs each saved key with its provider name', (() => { const l = PK.namedList().split('\n'); return l.includes('ZenRows: ' + Z1) && l.includes('ZenRows: ' + Z2) && l.includes('Audd.io: ' + AU) && l.includes('Browserless: ' + LOOSE); })(), PK.namedList());
  ok('no keys in the text: report says so', PK.html({ rows: [], loose: [], rep: {} }).includes('No keys'));

  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
