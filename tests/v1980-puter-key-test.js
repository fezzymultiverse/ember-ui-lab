// Ember V1.9.80: Puter runs on its auth token through the OpenAI-compatible endpoint. Pure Node, no network.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8');
const ksrc = fs.readFileSync(path.join(__dirname, '..', 'www', 'ember_keyscan.js'), 'utf8');
function boot(store, handler) {
  const mem = Object.assign({}, store), sent = [];
  const LS = { get: (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d), set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v == null ? null : v)); } };
  const win = { addEventListener() {}, dispatchEvent() {}, CustomEvent: function () {} };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, setTimeout, clearTimeout, console, CustomEvent: function () {},
    fetch: async (url, opt) => { const body = opt && opt.body ? JSON.parse(opt.body) : null; sent.push({ url, body, auth: opt && opt.headers && opt.headers.Authorization }); return handler(url, body); } };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(ksrc, ctx); vm.runInContext(src, ctx);
  return { P: ctx.window.Prov, K: ctx.window.EmberKeyScan, sent, mem };
}
const res = (status, json) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => json, text: async () => JSON.stringify(json) });
const handler = (url, body) => {
  if (url.includes('api.puter.com') && /\/models(\?|$)/.test(url)) return res(200, { data: [{ id: 'gpt-5.4-nano' }, { id: 'text-embedding-3-small' }, { id: 'claude-sonnet-5' }] });
  if (url.includes('api.puter.com')) return res(200, { choices: [{ message: { content: 'hi from puter' } }] });
  if (/\/models(\?|$)/.test(url)) return res(200, { data: [{ id: 'llama-3.3-70b-versatile' }] });
  return res(503, { error: { message: 'overloaded' } });
};
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0IjoicyIsInYiOiIwLjAuMCIsInUiOiJhYmMifQ.2IENujc9mmjyYgdV2wge_kwKOn116JUwnUDOSvy7E6M';
const GROQ = [{ key: 'gsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }];
const q = { system: 'BASE', messages: [{ role: 'user', content: 'hi' }] };
(async () => {
  let { P, K, sent } = boot({ ember_keys: { groq: GROQ, puter: [{ key: TOKEN }] } }, handler);
  ok('Puter is an OpenAI-compatible engine on api.puter.com', P.CFG.puter.kind == 'oai' && /api\.puter\.com\/puterai\/openai\/v1/.test(P.CFG.puter.base));
  ok('Puter counts as connected from its saved token', P.puterOn() === true && P.keys().puter.length == 1);
  let r = await P.run('fast', q);
  ok('Puter answers after groq fails', r.provider == 'puter' && /hi from puter/.test(r.text), JSON.stringify(r).slice(0, 140));
  const chat = sent.find(s => s.url.includes('api.puter.com') && s.body && s.body.messages);
  ok('the token is sent as a Bearer key', chat && chat.auth == 'Bearer ' + TOKEN, chat && chat.auth);
  ok('embedding models are never picked for chat', chat && chat.body.model != 'text-embedding-3-small', chat && chat.body.model);
  ok('no temperature is sent to Puter', chat && chat.body.temperature === undefined);
  // pinned with no token: the error says what is missing
  ({ P } = boot({ ember_keys: { groq: GROQ }, ember_pin: 'puter' }, handler));
  let err = null; try { await P.run('fast', q); } catch (e) { err = e; }
  ok('pinned Puter without a token says so', err && /Puter is pinned/.test(err.message) && /no Puter key is saved/.test(err.message), err && err.message);
  // the old sign-in flag no longer creates a fake key
  ({ P } = boot({ ember_keys: { groq: GROQ }, ember_puter_on: true }, handler));
  ok('legacy sign-in flag is ignored', P.keys().puter.length == 0 && P.puterOn() === false);
  // the paste scanner names a Puter JWT without a label
  ({ K } = boot({}, handler));
  const sc = K.scan('Here it is:\n' + TOKEN + '\n');
  ok('a bare Puter token is filed under Puter', (sc.keys.puter || []).length == 1 && sc.keys.puter[0] == TOKEN, JSON.stringify(sc.keys.puter));
  ok('Puter is in the provider picker list', K.IDS.includes('puter') && K.LABEL.puter == 'Puter');
  // addKey checks the token live
  ({ P } = boot({}, handler)); const a = await P.addKey('puter', TOKEN);
  ok('addKey saves and health-checks a Puter token', a.ok && a.e.st && a.e.st.ok === true, JSON.stringify(a.e && a.e.st));
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
