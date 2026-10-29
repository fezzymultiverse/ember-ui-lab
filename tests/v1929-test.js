// Ember V1.9.29 test: tool-execution card, provider dashboard rows (real latency, retry countdown), against fakes.  Run: node tests/v1929-test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');

// ---- download card: pull cardHtml + escH out of ai_agent.js ----
const ag = W('ai_agent.js'), eh = ag.match(/const escH = [^\n]+/)[0], i0 = ag.indexOf('function cardHtml(j) {'), i1 = ag.indexOf('function cardsHtml()');
const cx = {}; vm.createContext(cx); vm.runInContext(eh + '\n' + ag.slice(i0, i1) + '\nthis.cardHtml = cardHtml;', cx);
const run = cx.cardHtml({ id: 'j1', title: 'Gunna - back to the moon.mp3', state: 'running', pct: 45, detail: '' });
ok('running card: title, file, bar 45%, destination', /Downloading Audio/.test(run) && /back to the moon\.mp3/.test(run) && /width:45%/.test(run) && /Saving to Music\/Ember/.test(run) && /act-run/.test(run), run);
ok('card keeps id and dl-card class for the live updater', /id="dl-j1"/.test(run) && /class="dl-card /.test(run));
const done = cx.cardHtml({ id: 'j1', title: 'T', state: 'done', pct: 0 });
ok('done card is full and green-class', /width:100%/.test(done) && /act-done/.test(done) && /Saved to Music\/Ember/.test(done));
const bad = cx.cardHtml({ id: 'j2', title: '<img onerror=x>', state: 'failed', pct: 10, detail: 'no network' });
ok('failed card shows reason, escapes the title', /act-bad/.test(bad) && /no network/.test(bad) && !/<img/.test(bad) && /&lt;img/.test(bad));
const start = cx.cardHtml({ id: 'j3', title: '', state: 'running', pct: 0 });
ok('0% card says looking it up', /Looking it up/.test(start) && /Fetching track info/.test(start));

// ---- provider dashboard ----
const els = {}; const mk = id => els[id] = { id, innerHTML: '', classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, addEventListener() {} };
['provDrop', 'bProv', 'bDocsQuick'].forEach(mk);
const st = { groq: 'ok', mistral: 'ok', cohere: 'limited', gemini: 'none' };
const det = { groq: { keys: 2, model: 'llama3-70b', lat: 120, retry: 0, msg: '' }, mistral: { keys: 1, model: 'mistral-large', lat: 450, retry: 0, msg: '' },
  cohere: { keys: 1, model: 'command-r-plus', lat: 0, retry: 30, msg: '' }, gemini: { keys: 0, model: '', lat: 0, retry: 0, msg: '' } };
const IDS = Object.keys(st);
const P = { IDS, CFG: Object.fromEntries(IDS.map(i => [i, { name: i[0].toUpperCase() + i.slice(1), status: 'ok' }])), stateOf: i => st[i], detail: i => det[i], entries: i => new Array(det[i].keys).fill(0), freeOn: () => true, hasKeys: () => true, pingAll: async () => {} };
const doc = { getElementById: id => els[id] || null, addEventListener() {} };
const w = { Prov: P, addEventListener() {}, dispatchEvent() {} };
const c2 = { window: w, document: doc, setTimeout: () => 0, setInterval: () => 1, clearInterval() {}, Event: function () {}, Date, Number, String };
vm.createContext(c2); vm.runInContext(W('ember_prov_ui.js'), c2);
els.bProv.__click = null;
// open it the way the app does: the module registered a click handler on bProv
let handler; els.bProv.addEventListener = (t, f) => { if (t == 'click') handler = f; };
vm.runInContext(W('ember_prov_ui.js'), c2);
(async () => {
handler && handler({ stopPropagation() {} });
await new Promise(r => setTimeout(r, 30)); // let the (mock) health check finish and the rows repaint
const html = els.provDrop.innerHTML;
ok('five rows (four engines + Free Mode)', (html.match(/class="pdrow/g) || []).length === 5, html.length);
ok('working row shows model, real latency, key count', /llama3-70b/.test(html) && /⚡ 120ms/.test(html) && /2 keys/.test(html) && /⚡ 450ms/.test(html));
ok('limited row dims, says Rate limited and Retry in 30s', /pd-dim[^]*?Cohere[^]*?Rate limited[^]*?Retry in 30s/.test(html));
ok('no key row says no key saved', /Gemini[^]*?no key saved/.test(html) && /No key/.test(html));
ok('provider rows do not display a price', !/\$\d/.test(html));
ok('removed engine is absent from the provider dashboard', !/HuggingFace|Hugging Face/.test(html));
ok('status dots kept for every row', (html.match(/class="pdd /g) || []).length >= 7);
if (process.env.DUMP) console.log(html);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
