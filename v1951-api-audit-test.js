// Ember V1.9.51 API-platform audit regression: malformed errors, model-cache expiry, and provider fallback.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (name, condition, extra) => { condition ? pass++ : fail++; console.log(condition ? 'PASS' : 'FAIL', name, condition ? '' : (extra || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8');
const headers = { get: () => null };
function boot(store, handler) {
  const mem = Object.assign({}, store), sent = [];
  const LS = { get: (k, d) => k in mem ? JSON.parse(JSON.stringify(mem[k])) : d, set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } };
  const win = { addEventListener() {}, dispatchEvent() {}, Event: function () {}, CustomEvent: function () {} };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, TextDecoder, TextEncoder, setTimeout, clearTimeout, console, Event: function () {}, CustomEvent: function () {}, fetch: async (url, opt) => { const body = opt && opt.body ? JSON.parse(opt.body) : null; sent.push({ url, body }); return handler(url, body); } };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(src, ctx);
  return { P: ctx.window.Prov, sent };
}
const json = (status, value) => ({ ok: status >= 200 && status < 300, status, headers, json: async () => value, text: async () => JSON.stringify(value) });
(async () => {
  let modelCalls = 0;
  let t = boot({ ember_keys: { groq: [{ key: 'gsk_' + 'a'.repeat(28) }], mistral: [{ key: 'm'.repeat(32) }] }, ember_models: { groq: { at: Date.now() - 13 * 60 * 60 * 1000, list: ['old-model'] } } }, (url, body) => {
    if (/groq\.com/.test(url) && /\/models/.test(url)) { modelCalls++; return json(502, '<html>bad gateway</html>'); }
    if (/mistral\.ai/.test(url) && /\/models/.test(url)) return json(200, { data: [{ id: 'mistral-small-latest' }] });
    return json(200, { choices: [{ message: { content: 'mistral recovered' } }] });
  });
  const result = await t.P.run('fast', { system: 'test', messages: [{ role: 'user', content: 'hello' }] });
  ok('HTML provider failure becomes a readable fallback reason', result.provider === 'mistral' && result.text === 'mistral recovered', JSON.stringify(result));
  ok('malformed provider failure does not crash the router', modelCalls === 1, String(modelCalls));

  let freshCalls = 0;
  t = boot({ ember_keys: { groq: [{ key: 'gsk_' + 'b'.repeat(28) }] }, ember_models: { groq: { at: Date.now() - 13 * 60 * 60 * 1000, list: ['stale-model'] } } }, (url) => {
    if (/\/models/.test(url)) { freshCalls++; return json(200, { data: [{ id: 'fresh-model' }] }); }
    return json(200, { choices: [{ message: { content: 'ok' } }] });
  });
  const models = await t.P.modelsOf('groq', false);
  ok('stale model cache refreshes after twelve hours', freshCalls === 1 && models.includes('fresh-model') && !models.includes('stale-model'), JSON.stringify(models));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
