// Ember V1.9.48 test: a reply can be cancelled (no further engines tried) and each engine attempt is announced. Pure Node, no network.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { K } = require('../diag.js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (typeof x == 'string' ? x : JSON.stringify(x))); };
const mem = { ember_keys: JSON.stringify({ groq: [{ key: K.groq, st: null }], mistral: [{ key: K.mistral, st: null }] }) };
const ls = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const LS = { get: (k, d) => { try { const v = JSON.parse(ls.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => ls.setItem(k, JSON.stringify(v)) };
const events = [], urls = [];
const ctx = { U: { LS }, window: { dispatchEvent: e => { events.push(e); } }, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; }, Event: function (n) { this.type = n; }, localStorage: ls, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent, performance,
  fetch: async u => { urls.push(u); if (urls.length == 2) ctx.window.Prov.abortInflight(); return { ok: false, status: 500, headers: { get: () => '' }, json: async () => ({}), text: async () => 'boom' }; } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8'), ctx);
(async () => {
  const P = ctx.window.Prov; ok('abortInflight is exported', typeof P.abortInflight == 'function');
  let err = null; try { await P.run('deep', { system: 's', messages: [{ role: 'user', content: 'hi' }], temp: 0.5, max: 50 }); } catch (e) { err = e; }
  const tries = events.filter(e => e.type == 'ember-try');
  ok('a cancelled reply stops with a clear cancellation error', err && /cancelled/i.test(err.message) && err.code == 'cancelled', err && { m: err.message, c: err.code });
  ok('it did not walk through every engine and model after the abort', urls.length <= 4, urls);
  ok('each engine attempt was announced with its name', tries.every(e => e.detail && e.detail.name), tries.map(e => e.detail));
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
