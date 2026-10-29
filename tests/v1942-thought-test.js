// V1.9.42: thinking card repair. Run: node tests/v1942-thought-test.js
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const read = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const css = read('www/style.css'), pkg = JSON.parse(read('package.json')), sw = read('www/sw.js');
assert(/^1\.9\.\d+$/.test(pkg.version));
assert(/const V = 'ember-v1\.9\.\d+'/.test(sw));
// shimmer can no longer clip the title
assert(css.includes('@keyframes tl-glow') && css.includes('-webkit-text-fill-color:currentColor!important'));
// behaviour: one live card, keyed lines, pills, snapshot, collapse
const els = {}; const mk = id => (els[id] = els[id] || { id, innerHTML: '', className: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, remove() { delete els[id]; }, insertAdjacentHTML(_, h) { els.typ = Object.assign(mk('typ'), { innerHTML: h }); } });
mk('log'); mk('empty'); mk('typ');
const store = {};
const win = { addEventListener() {}, EmberEngine: { react: { state: () => null } } };
const ctx = { window: win, document: { getElementById: id => els[id] || null, addEventListener() {} }, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, setTimeout, clearTimeout };
vm.runInNewContext(read('www/ember_timeline.js'), ctx);
const TL = win.EmberTimeline; assert(TL && TL.upsert && TL.unkey && TL.collapse); TL.setStyle('tl');
TL.begin(); TL.note('Reading your message');
TL.upsert('rt1', 'Check the docs first', 't', '');
TL.upsert('rt1', 'Check the docs first', 't', ''); // same key must not duplicate
TL.upsert('ra1', 'Searching the web', 'a', 'warn', { pill: 'SKIPPED', err: 'He chose not to run this action.' });
TL.upsert('rwait', 'Waiting for your approval', 'a', 'warn', { pill: 'WAITING' }); TL.unkey('rwait');
TL.flush(); // V1.9.45: rows are revealed one at a time; flush shows them all
const lines = Array.from(TL._live().lines, l => l.text);
assert.strictEqual(JSON.stringify(lines), JSON.stringify(['Reading your message', 'Check the docs first', 'Searching the web']));
assert(els.typ.innerHTML.includes('SKIPPED') && els.typ.innerHTML.includes('He chose not to run'), 'pill and error render');
assert(!els.typ.className.includes('et-hide'), 'card must stay visible during ReAct');
const snap = TL.snapshot(); assert(snap && snap.lines.length === 3 && snap.lines[2][3] === 'SKIPPED');
assert(TL.savedHtml(snap).includes('SKIPPED') && TL.savedHtml(snap).includes('Thought for'));
TL.collapse(); assert.strictEqual(TL._live().open, false);
TL.drop(); assert.strictEqual(TL._live(), null);
console.log('PASS V1.9.42 thinking card checks');
