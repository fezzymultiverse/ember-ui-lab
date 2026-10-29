// V1.9.51: rotating-first thinking view with expandable timeline. Run: node tests/v1945-motion-test.js
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const read = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const css = read('www/style.css'), js = read('www/ember_timeline.js');

// --- static: spinner style has no dropdown, rotation + drop keyframes exist, reduced motion respected
assert(js.includes('et-spinner') && js.includes('et-stage') && js.includes('paintSpin'), 'spinner + rotating stage exist');
assert(!/et-spin"[^;]*data-et="toggle"/.test(js), 'spinner style must not be a dropdown toggle');
for (const k of ['@keyframes et-spin', '@keyframes et-rot-in', '@keyframes et-rot-out', '@keyframes tl-drop']) assert(css.includes(k), k);
assert(css.includes('prefers-reduced-motion:reduce){\n  .et-sp-arc'), 'reduced motion handled');

// --- behaviour with a tiny fake DOM
const els = {};
const mkEl = id => {
  const e = { id, className: '', _html: '', _stage: [], classList: { add() {}, remove() {}, toggle() {} }, remove() { delete els[id]; } };
  Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = v; e._stage = []; const m = v.match(/<span class="et-stage">(.*?)<\/span><button/); if (m) e._stage.push(m[1]); } });
  e.insertAdjacentHTML = (_, h) => { if (id === 'log') { els.typ = mkEl('typ'); els.typ.innerHTML = h.replace(/^<div id="typ"[^>]*>/, '').replace(/<\/div>$/, ''); } };
  return e;
};
els.log = mkEl('log'); els.empty = mkEl('empty');
const store = {};
const win = { addEventListener() {} };
const ctx = { window: win, document: { getElementById: id => els[id] || null, addEventListener() {} }, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, setTimeout, clearTimeout, Date };
vm.runInNewContext(js, ctx);
const TL = win.EmberTimeline;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shown = () => TL._live().lines.filter(l => l.rv).length;

(async () => {
  // Summary card: a burst of 5 notes must NOT show at once
  TL.setStyle('tl'); TL.begin();
  ['Reading your message', 'Quick lane: answering directly', 'Loading the chat', 'Choosing the best engine', 'Asking Gemini'].forEach(t => TL.note(t));
  await sleep(40);
  assert.strictEqual(shown(), 1, 'first thought shows at once, the rest wait their turn');
  assert(els.typ.innerHTML.includes('Reading your message') && !els.typ.innerHTML.includes('Asking Gemini'));
  await sleep(700);
  assert(shown() >= 2 && shown() < 5, 'rows arrive one by one, got ' + shown());
  await sleep(2600);
  assert.strictEqual(shown(), 5, 'every thought is eventually shown');
  assert(els.typ.innerHTML.includes('Asking Gemini'));
  // tool row: shows RUNNING then SUCCESS in place
  const h = TL.tool('youtube_search', { query: 'gunna' });
  await sleep(700); assert(els.typ.innerHTML.includes('RUNNING') && els.typ.innerHTML.includes('Executing Tool'));
  h.end({ ok: true }); assert(els.typ.innerHTML.includes('SUCCESS'));
  // snapshot keeps lines that were not yet revealed
  TL.note('late one'); assert(TL.snapshot().lines.some(l => l[0] === 'late one'));
  TL.drop();

  // Spinner style: status follows revealed lines, first paint is the spinner, details expand in place.
  TL.setStyle('claude'); TL.begin();
  assert(els.typ.innerHTML.includes('et-spinner') && els.typ.innerHTML.includes('et-body') && els.typ.innerHTML.includes('et-drop-hint'));
  assert(els.typ.innerHTML.includes('Thinking\u2026'));
  TL.note('Step A'); TL.note('Step B');
  await sleep(40);
  assert.strictEqual(TL._live().lines.filter(l => l.rv).length, 1);
  TL.flush(); assert.strictEqual(shown(), 2);
  TL.drop(); assert.strictEqual(TL._live(), null);
  console.log('PASS V1.9.45 thinking motion checks');
})().catch(e => { console.error(e); process.exit(1); });
