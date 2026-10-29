// Ember V1.9.15 test: pure Node, no network. Strict pin, no silent swap to another engine, Free Mode not first when pinned,
// one Ember voice per engine, automatic document retrieval. Run: node tests/v1915-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
const res = (status, json) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => json, text: async () => JSON.stringify(json) });
function boot(store, handler) {
  const mem = Object.assign({}, store), sent = [], events = [];
  const LS = { get: (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d), set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v == null ? null : v)); } };
  const win = { addEventListener() {}, dispatchEvent(e) { events.push(e); }, Event: function () {}, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; } };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, setTimeout, clearTimeout, console, Event: function () {}, CustomEvent: win.CustomEvent,
    fetch: async (url, opt) => { const body = opt && opt.body ? JSON.parse(opt.body) : null; sent.push({ url, body }); return handler(url, body); } };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(W('providers.js'), ctx);
  return { P: ctx.window.Prov, sent, mem, events };
}
const eng = u => /groq/.test(u) ? 'groq' : /pollinations/.test(u) ? 'free' : /mistral/.test(u) ? 'mistral' : 'other';
const models = { groq: [{ id: 'llama-3.3-70b-versatile' }] };
const KEYS = { groq: [{ key: 'gsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }] };
const base = () => (url, body) => {
  if (/\/models(\?|$)/.test(url)) return res(200, { data: models[eng(url)] || [] });
  if (eng(url) == 'free') return res(429, { error: 'busy' });
  return res(200, { choices: [{ message: { content: 'hi from ' + eng(url) } }] });
};
(async () => {
  let t, err = null, r;
  // 3. pinned Groq, Free Mode on: Free is not tried first, no switch toast
  t = boot({ ember_keys: KEYS, ember_pin: 'groq' }, base(() => res(200, {})));
  t.P.setFree(true);
  r = await t.P.run('fast', { system: 's', messages: [{ role: 'user', content: 'yo' }] });
  ok('pinned Groq answers', r.provider == 'groq');
  ok('Free Mode not tried when an engine is pinned', !t.sent.some(s => eng(s.url) == 'free'));
  ok('no "Switched to" event when the pinned engine answers', t.events.filter(e => e.type == 'ember-switch').length == 0);
  // 4. strict pin on an engine with no key
  t = boot({ ember_keys: { groq: KEYS.groq }, ember_pin: 'mistral' }, base(() => res(200, {})));
  err = null; try { await t.P.run('fast', { system: 's', messages: [{ role: 'user', content: 'yo' }] }); } catch (e) { err = e; }
  ok('strict pin without a key says so', err && /no Mistral key is saved/.test(err.message), err && err.message);
  // 5. util lane keeps failing over even when strict
  t = boot({ ember_keys: KEYS, ember_pin: 'groq' }, base());
  r = await t.P.run('util', { system: 's', messages: [{ role: 'user', content: 'title' }] });
  ok('background (util) jobs still fail over', r.provider == 'groq');
  // 6. one voice: identity line and an engine note per engine
  const f = t.P.factsBlock('groq', 'llama-3.3-70b-versatile', []), g = t.P.factsBlock('gemini', 'gemini-2.5-flash', []);
  ok('identity line says always Ember', /always Ember/.test(f) && /always Ember/.test(g));
  ok('Groq note pushes against terse replies', /Do not be terse/.test(f));
  ok('Gemini note pushes against assistant prose', /No headings/.test(g));
  ok('old "You are only the model" line is gone', !/You are only the model named above/.test(f));
  ok('strict flag is exposed', t.P.getStrict() === true);
  // 7. pinNote under strict
  t = boot({ ember_keys: { groq: KEYS.groq }, ember_pin: 'mistral' }, base(() => res(200, {})));
  ok('pin note promises no silent swap', /no silent swap|instead of a silent swap/.test(t.P.pinNote()), t.P.pinNote());
  // 8. automatic document retrieval
  const docs = [
    { id: 'd1', name: 'vault-notes.txt', updated: 1, text: '# Vault design\nThe vault uses AES-256-GCM with a key derived from the passphrase by PBKDF2 at 600000 rounds. The salt is stored beside the ciphertext.\n\n# Backup\nBackups are zipped then encrypted before sharing.' },
    { id: 'd2', name: 'recipes.txt', updated: 1, text: 'Bobotie needs mince, curry powder, bread soaked in milk and an egg custard topping.' }
  ];
  const cctx = { window: { Safety: { lastLevel: () => 0 }, EmberDocs: { all: async () => docs } }, console };
  cctx.window.window = cctx.window; vm.createContext(cctx); vm.runInContext(W('ember_context.js'), cctx);
  const C = cctx.window.EmberContext;
  const b = await C.autoBlock('how does the vault derive its key from the passphrase');
  ok('autoBlock finds the vault chunk', /PBKDF2/.test(b) && /vault-notes\.txt/.test(b), b.slice(0, 200));
  ok('autoBlock is labelled data, not instructions', /not instructions/.test(b));
  ok('autoBlock leaves the unrelated recipe out', !/Bobotie/.test(b));
  ok('autoBlock is empty for a greeting', (await C.autoBlock('yo')) === '');
  ok('autoBlock is empty when nothing matches', (await C.autoBlock('quantum chromodynamics lattice')) === '');
  cctx.window.Safety.lastLevel = () => 3;
  ok('autoBlock is silent at safety level 2+', (await C.autoBlock('vault passphrase key')) === '');
  // 9. V1.9.16: Ember knows how it thinks (block comes from the real code, limits checked against the real files)
  const fctx = { window: {}, document: { getElementById: () => ({ textContent: 'Ember V1.9.16 · x' }) }, console, localStorage: { getItem: () => null, setItem() {} } };
  fctx.window.window = fctx.window; vm.createContext(fctx); vm.runInContext(W('ember_find.js'), fctx);
  const blk = fctx.window.EmberKnow.block({}, { acts: [] });
  ok('self-knowledge names run_react, run_plan and the long-document tools', /run_react/.test(blk) && /run_plan/.test(blk) && /get_document_outline/.test(blk) && /search_in_document/.test(blk) && /read_document_chunk/.test(blk));
  ok('self-knowledge limits match the code', /hard cap 10, 4 minutes/.test(blk) && /up to 12 steps/.test(blk) && /1,500 characters/.test(blk) && /8000 characters/.test(blk));
  ok('code limits are what the block says', /MAX_DEFAULT = 8, MAX_HARD = 10/.test(W('ember_react.js')) && /TOTAL_MS = 240000/.test(W('ember_react.js')) && /MAX_STEPS = 12, MAX_PAR = 3/.test(W('ember_engine.js')) && /STEP_MS = 45000, TOTAL_MS = 120000/.test(W('ember_engine.js')) && /CHUNK = 1500/.test(W('ember_context.js')));
  // 10. V1.9.17: the three document tools are exposed to the model with their real argument names and reach ember_context.js; the hard rule exists
  const dctx = { window: { Safety: { lastLevel: () => 0 }, EmberDocs: { all: async () => docs, count: () => docs.length } }, console };
  dctx.window.window = dctx.window; vm.createContext(dctx); vm.runInContext(W('ember_context.js'), dctx); vm.runInContext(W('ai_docs.js'), dctx);
  const AD = dctx.window.EmberDocsAddon, byName = n => AD.TOOLS.find(x => x.name == n);
  ok('model is shown get_document_outline(fileId)', byName('get_document_outline') && 'fileId' in byName('get_document_outline').parameters);
  ok('model is shown search_in_document(query, fileId?)', byName('search_in_document') && 'query' in byName('search_in_document').parameters && 'fileId' in byName('search_in_document').parameters);
  ok('model is shown read_document_chunk(fileId, chunk)', byName('read_document_chunk') && 'fileId' in byName('read_document_chunk').parameters && 'chunk' in byName('read_document_chunk').parameters);
  const sr = await AD.dispatch('search_in_document', { query: 'PBKDF2 passphrase' });
  ok('dispatcher runs search_in_document for real', sr && Array.isArray(sr.hits) && sr.hits.length > 0 && sr.hits[0].fileId == 'd1', JSON.stringify(sr).slice(0, 160));
  const rc = await AD.dispatch('read_document_chunk', { fileId: 'd1', chunk: 1 });
  ok('dispatcher runs read_document_chunk for real', rc && /AES-256-GCM/.test(rc.text || ''), JSON.stringify(rc).slice(0, 160));
  const ol = await AD.dispatch('get_document_outline', { fileId: 'd1' });
  ok('dispatcher runs get_document_outline for real', ol && !ol.error, JSON.stringify(ol).slice(0, 160));
  ok('persona carries the document hard rule, gated on a non-empty library', /DOCUMENT ACCESS \(hard rule\)/.test(W('persona.js')) && /EmberDocs\.count\(\) > 0/.test(W('persona.js')));
  // 11. V1.9.18 checklist: Router obeys a Gemini pin (Gemini API only, never Groq, answer comes from Gemini)
  const gh = (url, body) => {
    if (/googleapis/.test(url) && /\/models(\?|$)/.test(url)) return res(200, { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    if (/googleapis/.test(url)) return res(200, { candidates: [{ content: { parts: [{ text: 'hi from gemini' }] } }] });
    return res(200, { data: [{ id: 'llama-3.3-70b-versatile' }], choices: [{ message: { content: 'hi from groq' } }] });
  };
  t = boot({ ember_keys: { groq: KEYS.groq, gemini: [{ key: 'AQ.' + 'g'.repeat(30) }] }, ember_pin: 'gemini' }, gh);
  r = await t.P.run('fast', { system: 's', messages: [{ role: 'user', content: 'yo' }] });
  ok('pinned Gemini: the answer comes from Gemini', r.provider == 'gemini' && /gemini/.test(r.text), JSON.stringify(r).slice(0, 120));
  ok('pinned Gemini: only the Gemini API was called, Groq never', t.sent.length > 0 && t.sent.every(s => /googleapis/.test(s.url)));
  t = boot({ ember_keys: { groq: KEYS.groq, gemini: [{ key: 'AQ.' + 'g'.repeat(30) }] }, ember_pin: 'gemini' }, (u, b) => /googleapis/.test(u) ? res(401, { error: { message: 'API keys are not supported by this API' } }) : gh(u, b));
  err = null; try { await t.P.run('fast', { system: 's', messages: [{ role: 'user', content: 'yo' }] }); } catch (e) { err = e; }
  ok('pinned Gemini rejected by Google: shows Gemini\'s error, no Groq call', err && /Gemini is pinned/.test(err.message) && !t.sent.some(s => /groq/.test(s.url)), err && err.message);
  // 12. ReAct loop: every step goes through the dispatcher and the real document tools
  const eng2 = { window: { Safety: { lastLevel: () => 0 }, EmberDocs: { all: async () => docs, count: () => docs.length } }, console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: () => null } };
  eng2.window.window = eng2.window; eng2.window.dispatchEvent = () => true; eng2.window.addEventListener = () => {}; vm.createContext(eng2);
  ['ember_schema.js', 'ember_context.js', 'ai_docs.js', 'ember_engine.js', 'ember_react.js'].forEach(f => vm.runInContext(W(f), eng2, { filename: f }));
  const E2 = eng2.window.EmberEngine, AD2 = eng2.window.EmberDocsAddon, ran = [];
  const script = [
    'Thought: find the key derivation.\nAction: {"tool":"search_in_document","args":{"query":"PBKDF2 passphrase"}}',
    'Thought: read the chunk.\nAction: {"tool":"read_document_chunk","args":{"fileId":"d1","chunk":1}}',
    'Thought: enough.\nFinal: It uses PBKDF2 at 600000 rounds.'
  ];
  let si = 0, seen = [];
  E2.setHost({ tools: () => AD2.TOOLS, has: n => AD2.TOOLS.some(x => x.name == n), run: async (n, a) => { ran.push(n); return AD2.dispatch(n, a); }, llm: async (sys, msgs) => { seen.push(msgs.map(m => m.content).join('\n')); return script[si++]; } });
  const rr = await E2.dispatch('run_react', { goal: 'How does the vault derive its key?', mode: 'document' });
  ok('ReAct: each Action went through the host dispatcher in order', ran.join(',') == 'search_in_document,read_document_chunk', ran.join(','));
  ok('ReAct: the model saw the real search result as an Observation', seen.some(s => /PBKDF2/.test(s) && /Observation/.test(s)));
  ok('ReAct: run ends with the final answer', rr && /600000/.test(JSON.stringify(rr)), JSON.stringify(rr).slice(0, 160));
  // 13. Scraper schema + dispatcher + dynamic injection are in the source (exact wiring lines)
  const ps = W('persona.js'), ap = W('app.js'), sc = W('ai_scraper.js');
  ok('scrape_url is in the scraper tool list', /name: 'scrape_url'/.test(sc) && /window\.EmberScraper = \{[^}]*TOOLS/.test(sc));
  ok('persona shows scraper tools when scraping is on', /sets\.push\(\['WEB SCRAPING \+ SAVED SITES', window\.EmberScraper\.TOOLS\.concat\(window\.EmberSites\.TOOLS\)\]\)/.test(ps));
  ok('persona injects the ready scrapers (from saved keys) and orders scrape_url', /SCRAPER STATE \(true now\): scrape_url is ON\. Providers ready: ' \+ SCR\.plan\(true\)\.map\(id => SCR\.LABEL\[id\]\)/.test(ps) && /call scrape_url first/.test(ps));
  ok('app.js dispatches scrape_url and the document tools', /scrapeOn && namesOf\(A\.EmberScraper\)\.includes\(tool\)\) return await A\.EmberScraper\.dispatch/.test(ap) && /docsOn && A\.EmberDocsAddon && namesOf\(A\.EmberDocsAddon\)\.includes\(tool\)\) return await A\.EmberDocsAddon\.dispatch/.test(ap));
  ok('app.js hands the ReAct loop the same dispatcher (host.run = runTool)', /EmberEngine\.setHost\(\{\s*run: runTool, has: toolOn, tools: toolCatalog/.test(ap));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
