// Ember V1.9.30 test: the + menu (toggles, chips, prompt line, lane) against a fake DOM.  Run: node tests/v1930-test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
const mk = () => { const cl = new Set(); const e = { innerHTML: '', _l: {}, classList: { toggle: (c, v) => { v === undefined ? (cl.has(c) ? cl.delete(c) : cl.add(c)) : (v ? cl.add(c) : cl.delete(c)); }, contains: c => cl.has(c), add: c => cl.add(c), remove: c => cl.delete(c) }, setAttribute() {}, addEventListener(t, f) { (e._l[t] = e._l[t] || []).push(f); }, contains: () => false, querySelectorAll: () => [], style: {}, dispatchEvent() {}, focus() {} }; return e; };
const els = {}; ['bPlus', 'plusMenu', 'plusChips', 'toast', 'inp'].forEach(i => els[i] = mk()); els.plusMenu.classList.add('hidden'); els.plusChips.classList.add('hidden');
const store = {}; const docL = {};
const cx = { document: { getElementById: i => els[i], addEventListener: (t, f) => { docL[t] = f; } }, window: null, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, setTimeout, clearTimeout, console, JSON, Event: function () {} };
cx.window = cx; cx.addEventListener = () => {}; vm.createContext(cx); vm.runInContext(W('ember_plus.js'), cx);
const P = cx.EmberPlus;
ok('module loads and exposes EmberPlus', !!P && typeof P.stateLine == 'function');
ok('nothing on at start: empty line, no deep lane, chips hidden', P.stateLine() == '' && !P.lane() && els.plusChips.classList.contains('hidden'));
els.plusMenu._l.click.forEach(f => f({ target: { closest: s => s == '[data-t]' ? { dataset: { t: 'reason' } } : null } }));
ok('Reasoning toggle: deep lane + prompt line + chip shown', P.lane() && /REASONING is ON/.test(P.stateLine()) && /Reasoning/.test(els.plusChips.innerHTML) && !els.plusChips.classList.contains('hidden'));
P._set('web', true); P._set('code', true); P._set('device', true);
const L = P.stateLine(); ok('all four lines present when all on', /DEVICE ACCESS/.test(L) && /WEB SEARCH/.test(L) && /CODE MODE/.test(L) && /REASONING/.test(L));
ok('state persisted to storage', JSON.parse(store.ember_plus).web === true);
els.plusChips._l.click.forEach(f => f({ target: { closest: s => s == '[data-x]' ? { dataset: { x: 'reason' } } : null } }));
ok('chip x turns the feature off', !P.lane() && !/REASONING/.test(P.stateLine()) && !/Reasoning/.test(els.plusChips.innerHTML));
els.bPlus.onclick({ stopPropagation() {} }); ok('+ opens the menu', !els.plusMenu.classList.contains('hidden'));
docL.click({ target: {} }); ok('tap outside closes it', els.plusMenu.classList.contains('hidden'));
docL.keydown({ key: 'Escape' }); ok('menu markup has 4 toggles and 3 do-it-now items', (els.plusMenu.innerHTML.match(/data-t=/g) || []).length == 4 && (els.plusMenu.innerHTML.match(/data-o=/g) || []).length == 3);
// app.js hooks are present
const app = W('app.js');
ok('app.js: prompt line, lane and docs switch hooked', /EmberPlus\.stateLine\(\)/.test(app) && /EmberPlus\.lane\(\)/.test(app) && (app.match(/EmberPlus.isOn\('device'\)/g) || []).length == 2);
ok('sw.js lists ember_plus.js and cache is a 1.9.x build', /ember_plus\.js/.test(W('sw.js')) && /ember-v1\.9\.\d+/.test(W('sw.js')));
ok('index.html loads ember_plus.js after the markup', W('index.html').indexOf('ember_plus.js') > W('index.html').indexOf('id="bPlus"'));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
