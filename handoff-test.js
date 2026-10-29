// Ember V1.8.3 handoff test: pure Node, no network. When the native worker takes a reply, the page must stop paying for the same reply.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8');
function boot(store, handler) {
  const mem = Object.assign({}, store), sent = [];
  const LS = { get: (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d), set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v == null ? null : v)); } };
  const hooks = { onRun: null };
  const win = { addEventListener() {}, dispatchEvent() { if (hooks.onRun) hooks.onRun(); }, Event: function () {}, CustomEvent: function () {} };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, setTimeout, clearTimeout, console, Event: function () {}, CustomEvent: function () {},
    fetch: async (url, opt) => { const body = opt && opt.body ? JSON.parse(opt.body) : null; sent.push({ url, body }); return handler(url, body, opt, ctx.window.Prov); } };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(src, ctx);
  return { P: ctx.window.Prov, sent, hooks };
}
const res = (status, json) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => json, text: async () => JSON.stringify(json) });
const KEYS = { groq: [{ key: 'gsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, { key: 'gsk_BBBBBBBBBBBBBBBBBBBBBBBBBBBB' }] };
const isChat = s => !!(s.body && s.body.messages);
const base = (url) => /\/models(\?|$)/.test(url) ? res(200, { data: [{ id: 'llama-3.3-70b-versatile' }] }) : null;

(async () => {
  // 1. the native worker already owns the reply when the run starts: zero network calls from the page
  let { P, sent, hooks } = boot({ ember_keys: KEYS }, (url) => base(url) || res(200, { choices: [{ message: { content: 'page reply' } }] }));
  hooks.onRun = () => P.holdInflight(Promise.resolve(true).then(() => { P.stopInflight(); return true; })); // what app.js does on ember-run-start while hidden
  const a = P.run('fast', { system: 'S', messages: [{ role: 'user', content: 'hi' }] });
  let err = null; try { await a; } catch (e) { err = e; }
  ok('held run stops with code handoff', err && err.code == 'handoff', err && err.message);
  ok('no request at all left the page (nothing billed)', sent.length == 0, String(sent.length));

  // 2. the worker could not take it: the page carries on and answers itself
  ({ P, sent, hooks } = boot({ ember_keys: KEYS }, (url) => base(url) || res(200, { choices: [{ message: { content: 'page reply' } }] })));
  hooks.onRun = () => P.holdInflight(Promise.resolve(false));
  const b = P.run('fast', { system: 'S', messages: [{ role: 'user', content: 'hi' }] });
  const rb = await b;
  ok('failed handoff: the page still answers', rb.text == 'page reply' && sent.filter(isChat).length == 1);

  // 3. the worker takes it while the first paid call is in flight: no failover calls on the other keys afterwards
  let chats = 0, P3;
  ({ P: P3, sent } = boot({ ember_keys: KEYS }, (url, body, opt, prov) => { const m = base(url); if (m) return m; chats++; if (chats == 1) prov.stopInflight(); return res(500, { error: { message: 'boom' } }); }));
  let e3 = null; try { await P3.run('fast', { system: 'S', messages: [{ role: 'user', content: 'hi' }] }); } catch (e) { e3 = e; }
  ok('mid-run handoff: only the call already in flight was made', chats == 1 && e3 && e3.code == 'handoff', chats + ' ' + (e3 && e3.message));

  // 4. normal runs (no handoff) are untouched
  ({ P, sent } = boot({ ember_keys: KEYS }, (url) => base(url) || res(200, { choices: [{ message: { content: 'ok' } }] })));
  const rn = await P.run('fast', { system: 'S', messages: [{ role: 'user', content: 'hi' }] });
  ok('no handoff: normal reply, one chat call', rn.text == 'ok' && sent.filter(isChat).length == 1);
  // 5. util lane is never held or stopped
  P.stopInflight(); const ru = await P.run('util', { system: 'S', messages: [{ role: 'user', content: 'x' }] });
  ok('util lane ignores a stale stop', ru.text == 'ok');
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
