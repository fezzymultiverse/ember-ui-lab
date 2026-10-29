// Ember V1.9.14 key finder test: pure Node, no network. Covers ember_keyscan.js (every case the handover found missed), the providers.js adapter,
// the multi-key store with failover in ai_scraper.js, Bright Data (SERP + Web Unlocker), zones, and ingestAll for every paste box.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { K, rnd, B62, HEX } = require('../tools/diag.js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (typeof x == 'string' ? x : JSON.stringify(x))); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
const mkStore = () => { const mem = {}; return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, mem }; };
function load(files, extra) {
  const ls = mkStore(), sent = [], opts = [];
  const LS = { get: (k, d) => { try { const v = JSON.parse(ls.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => ls.setItem(k, JSON.stringify(v)) };
  const ctx = Object.assign({ U: { LS }, window: {}, localStorage: ls, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent, performance, fetch: async () => { throw new Error('no net'); } }, extra || {});
  if (typeof ctx.fetch == 'function' && extra && extra.handler) { const h = extra.handler; ctx.fetch = async (u, o) => { sent.push(u); opts.push(o || {}); return h(u, o); }; }
  vm.createContext(ctx); files.forEach(f => vm.runInContext(W(f), ctx));
  return { w: ctx.window, ls, sent, opts, ctx };
}
const res = (status, text) => ({ ok: status < 300, status, headers: { get: () => 'text/html' }, json: async () => JSON.parse(text), text: async () => text });
const BODY = '# Page\n\n' + 'Real page text that is long enough to count as a page. '.repeat(20);
const KS = load(['ember_keyscan.js']).w.EmberKeyScan;
const sc = t => KS.scan(t), keys = (t, id) => sc(t).keys[id];
const eq = (a, b) => JSON.stringify(a) == JSON.stringify(b);

(async () => {
  // ---------- 1. the misses the handover found ----------
  let o = sc('Mistral: ' + K.mistral + '  Gemini: ' + K.gemini);
  ok('Name: key  Name2: key2 on one line: each key goes to its own provider', eq(o.keys.mistral, [K.mistral]) && eq(o.keys.gemini, [K.gemini]), o.keys);
  ok('blank lines after a label do not use up the window', eq(keys('Mistral\n\n\n' + K.mistral, 'mistral'), [K.mistral]));
  ok('Cohere key on the line below its label is kept', eq(keys('Cohere key:\n' + K.cohere, 'cohere'), [K.cohere]));
  ok('CO_API_KEY=... is recognised as Cohere', eq(keys('CO_API_KEY=' + K.cohere, 'cohere'), [K.cohere]));
  ok('a key written BEFORE its name ("key <- mistral") is kept', eq(keys(K.mistral + ' <- mistral', 'mistral'), [K.mistral]));
  ok('a hex-only 32 character string under a Mistral label is a hash, not a key', keys('Mistral\n' + rnd(HEX, 32, 91), 'mistral').length == 0);
  ok('Audd.io token is extracted from a paste', eq(keys('Audd.io token: ' + rnd(B62, 32, 92), 'audd'), [rnd(B62, 32, 92)]));
  ok('EasyVoice ev_ key is extracted with no label', eq(keys('x ev_' + rnd(B62, 30, 93) + ' y', 'easyvoice'), ['ev_' + rnd(B62, 30, 93)]));
  ok('Bright Data key (64 hex) is extracted next to its name', eq(keys('Bright Data API key\n' + K.bright, 'brightdata'), [K.bright]));
  ok('prefixed keys of every provider are found with no label', (() => { const t = [K.groq, K.gemini, K.geminiAQ, K.firecrawl, K.tavily, K.octo].join('\n\n'); const k = sc(t).keys; return k.groq.length == 1 && k.gemini.length == 2 && !('huggingface' in k) && k.firecrawl.length == 1 && k.tavily.length == 1 && k.octoparse.length == 1; })());
  ok('several keys in a row under one name (bullets) all belong to it', (() => { const a = rnd(HEX, 40, 94), b = rnd(HEX, 40, 95); return eq(keys('ZenRows:\n- ' + a + '\n- ' + b, 'zenrows'), [a, b]); })());
  ok('far from its name a key must still have the provider shape', keys('SerpApi\nnote\nnote\n' + rnd(HEX, 40, 96), 'serpapi').length == 0);
  ok('JSON one-liner with three providers', (() => { const k = sc(JSON.stringify({ mistral: K.mistral, cohere: K.cohere, groq: K.groq })).keys; return eq(k.mistral, [K.mistral]) && eq(k.cohere, [K.cohere]) && eq(k.groq, [K.groq]); })());
  o = sc('openai: sk-' + rnd(B62, 48, 97) + '\nclaude sk-ant-' + rnd(B62, 40, 98));
  ok('OpenAI is counted as foreign and Anthropic is filed only under its own provider', o.foreign.length == 1 && o.keys.anthropic.length == 1 && Object.entries(o.keys).filter(([id]) => id != 'anthropic').every(([, a]) => !a.length), o);
  o = sc('random ' + rnd(B62, 48, 99) + ' text');
  ok('an unlabelled key-like string is only counted, never saved', o.unlabelled.length == 1 && Object.values(o.keys).every(a => !a.length), o);
  o = sc('Mistral ' + rnd(B62, 32, 100) + '\n\n' + rnd(B62, 40, 101));
  ok('an unlabelled 40 character string is handed back to be probed on Cohere', o.probes.cohere.length == 1 && o.keys.cohere.length == 0, o);
  ok('placeholders, variable names and a 160 character blob are never keys', Object.values(sc('ZenRows: your_api_key_here\nFIRECRAWL_API_KEY=\nZenRows ' + 'a1'.repeat(80)).keys).every(a => !a.length));
  o = sc('Bright Data\nzone: serp_api1\nunlocker zone = web_unlocker1\nbrd-customer-hl_abc123-zone-web_unlocker1');
  ok('Bright Data zone names are read (SERP and Web Unlocker)', o.zones.serp == 'serp_api1' && o.zones.unlocker == 'web_unlocker1', o.zones);
  ok('the report masks keys (first 4 + last 4 only)', (() => { const l = KS.describe({ chat: { added: [{ id: 'groq', key: K.groq, ok: true }] }, scrape: { addedKeys: [{ id: 'zenrows', key: K.zenrows, slot: 'extra' }] }, scan: {} }).map(x => x.text).join('|'); return !l.includes(K.groq) && !l.includes(K.zenrows) && /gsk_…/.test(l); })());

  // ---------- 2. providers.js adapter keeps the old shape ----------
  const P = load(['ember_keyscan.js', 'providers.js']).w.Prov;
  const ex = P.extract(rnd(B62, 40, 102) + '\n\nGROQ_API_KEY="' + K.groq + '"\nMistral\n\n' + K.mistral + '\nCohere\n' + K.cohere);
  ok('Prov.extract: old shape, groq/mistral/cohere found', ex.groq[0] == K.groq && ex.mistral[0] == K.mistral && ex.cohere[0] == K.cohere && Array.isArray(ex.unknown) && Array.isArray(ex.unknownCohere), ex);
  ok('Prov.extract: an unlabelled 40 character string lands in unknownCohere for a live test', ex.unknownCohere.length == 1, ex);

  // ---------- 3. scraper: several keys, failover, Bright Data ----------
  const Z1 = rnd(HEX, 40, 110), Z2 = rnd(HEX, 40, 111), Z3 = rnd(HEX, 40, 112);
  let t = load(['ember_keyscan.js', 'ai_scraper.js'], { handler: () => res(200, BODY) }); let S = t.w.EmberScraper;
  let r = S.ingestKeys('ZenRows\n- ' + Z1 + '\n- ' + Z2);
  ok('ingest saves ALL keys: first primary, second extra', S.keysOf('zenrows').join() == [Z1, Z2].join() && r.addedKeys.map(x => x.slot).join() == 'primary,extra', r);
  r = S.ingestKeys('ZenRows ' + Z1 + '\nZenRows ' + Z3);
  ok('re-pasting never overwrites: a known key is a dupe, a new one is another extra', r.dupes == 1 && S.keysOf('zenrows').join() == [Z1, Z2, Z3].join() && S.get().keys.zenrows == Z1, r);
  ok('the keys never appear in the settings read for the UI except the primary; extras only through keysOf', S.get().more.zenrows.length == 2);
  t = load(['ember_keyscan.js', 'ai_scraper.js'], { handler: (u) => { const m = /apikey=([0-9a-f]+)/.exec(u); return m && m[1] == Z1 ? res(401, '{}') : res(200, BODY); } }); S = t.w.EmberScraper;
  S.setOn(true); S.setReader(false); S.addKey('zenrows', Z1); S.addKey('zenrows', Z2);
  const outs = []; for (let i = 0; i < 4; i++) outs.push(await S.scrape_url('https://example.com/a' + i, 'x', '', 'zenrows'));
  const z1Tries = t.sent.filter(u => u.includes(Z1)).length;
  ok('first key rejected (401): the extra key answers, every call still gets a page', outs.every(x => !x.error && /ZenRows/.test(x.provider)) && t.sent.filter(u => u.includes(Z2)).length == 4, outs.map(x => x.error || x.provider));
  ok('the rejected key is parked: it is tried once, then skipped', z1Tries == 1, t.sent);
  t = load(['ember_keyscan.js', 'ai_scraper.js'], { handler: () => res(200, BODY) }); S = t.w.EmberScraper; S.setOn(true); S.setReader(false); S.addKey('zenrows', Z1); S.addKey('zenrows', Z2);
  for (let i = 0; i < 6; i++) await S.scrape_url('https://example.com/p' + i, 'x', '', 'zenrows');
  const used = new Set(t.sent.map(u => /apikey=([0-9a-f]+)/.exec(u)[1]));
  ok('healthy keys take turns so credits are used evenly', used.has(Z1) && used.has(Z2), [...used]);
  ok('a 5xx stops at once and is not retried on the next key (no double bill)', await (async () => { const q = load(['ember_keyscan.js', 'ai_scraper.js'], { handler: () => res(503, '{}') }); const s = q.w.EmberScraper; s.setOn(true); s.setReader(false); s.addKey('zenrows', Z1); s.addKey('zenrows', Z2); await s.scrape_url('https://example.com/a', 'x', '', 'zenrows'); return q.sent.length == 1; })());
  S.dropKey('zenrows', Z1);
  ok('removing the primary promotes the first extra', S.get().keys.zenrows == Z2 && S.keysOf('zenrows').join() == Z2, S.keysOf('zenrows'));
  ok('every saved key is hidden from error text, extras included', !S.scrub('x ' + Z2 + ' y').includes(Z2));

  // Bright Data
  const BR = K.bright;
  const SERP = JSON.stringify({ organic: [{ title: 'B1', link: 'https://b.example/1', description: 'bright snippet' }, { title: 'bad', link: 'javascript:x', description: 'z' }] });
  t = load(['ember_keyscan.js', 'ai_scraper.js'], { handler: (u, o) => /brightdata/.test(u) ? res(200, SERP) : res(200, BODY) }); S = t.w.EmberScraper; S.setOn(true); S.setReader(true); S.addKey('brightdata', BR);
  ok('Bright Data is the 10th key provider, after SerpApi', S.KEY_IDS.length == 10 && S.ORDER.indexOf('brightdata') == S.ORDER.indexOf('serpapi') + 1);
  ok('with only a SERP zone it is NOT a page fetcher (snippets are the last resort, after the reader)', JSON.stringify(S.plan(true)) == '["reader","brightdata"]', S.plan(true));
  ok('Bright Data is a search backup', S.searchIds().includes('brightdata'));
  const sr = await S.searchVia('brightdata', 'cats & dogs', 4);
  const body = JSON.parse(t.opts[0].body);
  ok('Bright SERP call: POST /request, Bearer key, zone serp_api1, brd_json=1, format raw', t.opts[0].method == 'POST' && t.opts[0].headers.authorization == 'Bearer ' + BR && body.zone == 'serp_api1' && /google\.com\/search\?q=cats%20%26%20dogs/.test(body.url) && /brd_json=1/.test(body.url) && body.format == 'raw', { o: t.opts[0], body });
  ok('Bright SERP rows (organic: link, title, description) are mapped, non-http results dropped', sr.source == 'Bright Data' && sr.results.length == 1 && sr.results[0].url == 'https://b.example/1' && sr.results[0].snippet == 'bright snippet', sr);
  const sn = await S.scrape_url('https://example.com/x', 'x', '', 'brightdata');
  ok('with no Web Unlocker zone a page request returns snippets flagged degraded, never passed off as the page', !sn.error && sn.degraded === true && /NOT the page/.test(sn.markdown), sn);
  S.setBrightUnlock('web_unlocker1'); S.setBrightZone('my_serp');
  ok('with a Web Unlocker zone it becomes a page fetcher in the rotation', S.plan(true).includes('brightdata') && S.plan(true).indexOf('brightdata') < S.plan(true).indexOf('reader'), S.plan(true));
  t.sent.length = 0; t.opts.length = 0; const pg = await S.scrape_url('https://example.com/y', 'x', '', 'brightdata');
  ok('Web Unlocker call sends the unlocker zone and the page url, raw format', !pg.error && !pg.degraded && JSON.parse(t.opts[0].body).zone == 'web_unlocker1' && JSON.parse(t.opts[0].body).url == 'https://example.com/y' && JSON.parse(t.opts[0].body).format == 'raw', { pg: pg.error, o: t.opts[0] });
  await S.searchVia('brightdata', 'q', 2);
  ok('the saved SERP zone name is used for search', JSON.parse(t.opts[t.opts.length - 1].body).zone == 'my_serp');
  t = load(['ember_keyscan.js', 'ai_scraper.js']); S = t.w.EmberScraper;
  r = S.ingestKeys('Bright Data\n' + BR + '\nzone: serp_api2\nweb unlocker zone = web_unlocker2');
  ok('ingest saves the Bright key and both zones (only into empty slots)', S.keysOf('brightdata')[0] == BR && S.get().brightZone == 'serp_api2' && S.get().brightUnlock == 'web_unlocker2' && r.zonesAdded.length == 2, r);
  r = S.ingestKeys('Bright Data zone: other_serp');
  ok('an already saved zone is never overwritten by a later paste', S.get().brightZone == 'serp_api2' && r.zonesAdded.length == 0, r);

  // ---------- 4. ingestAll: one call files everything ----------
  t = load(['ember_keyscan.js', 'ai_scraper.js']); S = t.w.EmberScraper;
  let audd = '', ez = {};
  t.w.Prov = { ingest: async (text, scn) => ({ found: {}, added: scn.keys.groq.map(k => ({ id: 'groq', key: k, ok: true, guess: false })), dupes: 0, rejected: 0 }) };
  t.w.EmberAudd = { hasKey: () => !!audd, setKey: v => { audd = v; return true; } };
  t.w.EmberVoice = { cfg: () => ez, setCfg: p => { ez = Object.assign({}, ez, p); } };
  const AU = rnd(B62, 32, 120), EV = 'ev_' + rnd(B62, 30, 121);
  const rep = await t.w.EmberKeyScan.ingestAll([K.groq, 'ZenRows ' + Z1, 'ZenRows ' + Z2, 'Audd.io ' + AU, EV, 'Bright Data ' + BR].join('\n\n'));
  ok('ingestAll: chat key, two ZenRows, Bright, Audd.io and EasyVoice all filed in one go', rep.chat.added.length == 1 && S.keysOf('zenrows').length == 2 && S.keysOf('brightdata')[0] == BR && audd == AU && ez.ezKey == EV && rep.total == 6, { total: rep.total, audd, ez, errors: rep.errors });
  ok('ingestAll: the report lines are plain text, masked, no key value inside', rep.lines.length > 0 && !JSON.stringify(rep.lines).includes(Z1) && !JSON.stringify(rep.lines).includes(K.groq), rep.lines);
  const rep2 = await t.w.EmberKeyScan.ingestAll('nothing useful in here');
  ok('ingestAll on text with no keys says so in plain words', rep2.total == 0 && rep2.lines.some(l => /No keys found/.test(l.text)), rep2.lines);

  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
