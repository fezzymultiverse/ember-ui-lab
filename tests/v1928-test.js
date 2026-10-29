// Ember V1.9.28 test: "Summary" thinking timeline (www/ember_think_inline.js), run against a tiny fake DOM.  Run: node tests/v1928-test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : JSON.stringify(x)); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'ember_think_inline.js'), 'utf8');
const mkEl = id => { const el = { id, dataset: {}, innerHTML: '', removed: false, cls: new Set(), children: [], className: '',
  classList: { add: c => el.cls.add(c), remove: c => el.cls.delete(c), toggle: (c, on) => { (on === undefined ? !el.cls.has(c) : on) ? el.cls.add(c) : el.cls.delete(c); }, contains: c => el.cls.has(c) },
  remove() { el.removed = true; reg.delete(el.id); }, querySelector: () => null, insertAdjacentElement(_, n) { reg.set(n.id, n); return n; }, appendChild(n) { reg.set(n.id, n); return n; } }; return el; };
const reg = new Map(); reg.set('log', mkEl('log')); reg.set('typ', mkEl('typ'));
const lis = {}, doc = { getElementById: id => reg.get(id) || null, createElement: () => mkEl(''), addEventListener: (t, f) => { lis['doc' + t] = f; } };
let S = null; const timers = [];
const win = { EmberEngine: { react: { state: () => S } }, addEventListener: (t, f) => { lis[t] = f; } };
const ctx = { window: win, document: doc, requestAnimationFrame: f => f(), setInterval: f => { timers.push(f); return timers.length; }, clearInterval: () => {}, setTimeout: f => { timers.push(f); return 99; }, clearTimeout: () => {}, Date, JSON, Object, String, Set };
vm.createContext(ctx); vm.runInContext(src, ctx);
const fire = type => lis['ember-react']({ detail: { type } });
const card = () => reg.get('amber-think');
const base = { id: 'r1', status: 'running', startedAt: Date.now() - 2500, waiting: null, entries: [] };

S = Object.assign({}, base); fire('start');
ok('card inserted on start', !!card() && /Thinking/.test(card().innerHTML) && /tl-live/.test(card().innerHTML), card() && card().innerHTML);
ok('card is a chat message with the timeline class', card().className === 'msg a tl-card' && card().cls.has('tl-open') && card().cls.has('tl-run'));
S = Object.assign({}, base, { entries: [
  { n: 1, type: 'step', thought: 'Need to find the song first.', tool: 'youtube_search', args: { query: 'gunna' }, observation: '3 results', status: 'done' },
  { n: 2, type: 'step', thought: '', tool: 'youtube_download', args: { url: 'x' }, observation: 'no network', status: 'failed' },
  { n: 3, type: 'step', thought: 'Try <b>again</b>', tool: 'web_search', args: {}, observation: '', status: 'running' }] });
fire('obs'); const h = card().innerHTML;
ok('thought renders as a dot item', /tl-dot/.test(h) && /Need to find the song first\./.test(h));
ok('tool calls read as plain sentences with the query, no raw JSON', /Searching YouTube: “gunna”/.test(h) && /Searching the web/.test(h) && !/\{&quot;|\{"/.test(h));
ok('success pill', /tl-pill-ok">SUCCESS/.test(h));
ok('failed pill and error line', /tl-pill-bad">FAILED/.test(h) && /tl-err">no network/.test(h));
ok('running tool gets RUNNING pill and active radar says what runs', /tl-pill-run">RUNNING/.test(h) && /tl-now[^]*Searching the web/.test(h));
ok('terminal tool icon svg present', /<svg viewBox="0 0 24 24"[^>]*><path d="M4 17l6-6-6-6M12 19h8"\/>/.test(h));
ok('html in thoughts is escaped', /Try &lt;b&gt;again&lt;\/b&gt;/.test(h) && !/<b>again/.test(h));
ok('meta shows steps and time', /3 steps · /.test(h));
S = Object.assign({}, S, { waiting: { kind: 'step', n: 3 } }); fire('wait');
ok('awaiting approval line', /Waiting for your approval/.test(card().innerHTML) && !/tl-live/.test(card().innerHTML));
S = Object.assign({}, S, { waiting: null, status: 'done', endedAt: Date.now(), entries: S.entries.concat([{ n: 4, type: 'step', thought: 'Got it.', tool: '', args: {}, observation: '', final: 'Done, it is on your phone.', status: 'final' }]) });
fire('end');
const e2 = card().innerHTML;
ok('final shows a plain line, not the reply text', /Writing the answer\./.test(e2) && !/on your phone/.test(e2));
ok('no radar after the run, chevron shown', !/tl-live/.test(e2) && /tl-chev/.test(e2) && !card().cls.has('tl-run'));
timers.forEach(f => { try { f(); } catch (e) {} });
ok('card collapses after the run ends', !card().cls.has('tl-open'));
const mkT = sel => ({ closest: s => sel.includes(s) ? ({}) : (s === '#amber-think' ? card() : null) });
lis['docclick']({ target: mkT(['.tl-hdr']) });
ok('tap on header re-opens the finished card', card().cls.has('tl-open'));
lis['docclick']({ target: mkT(['.tl-x']) });
ok('x dismisses the card', !card() || card().removed);
fire('obs');
ok('dismissed run does not come back', !card());
S = Object.assign({}, base, { id: 'r2' }); fire('start');
ok('a new run shows a new card', !!card() && card().dataset.run === 'r2');
S = Object.assign({}, base, { id: 'r2', status: 'stopped', endedAt: Date.now() }); fire('end');
ok('stopped run says so', /Stopped\./.test(card().innerHTML));
S = null; fire('end'); ok('no state removes the card', !card());
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
