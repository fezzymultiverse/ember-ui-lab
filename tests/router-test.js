// Ember V1.6.8 router test: pure Node, no network. Mocks fetch and checks what the router really sends.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8');

function boot(store, handler) {
  const mem = Object.assign({}, store), sent = [];
  const LS = { get: (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d), set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v == null ? null : v)); } };
  const win = { addEventListener() {}, dispatchEvent() {}, Event: function () {}, CustomEvent: function () {} };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, setTimeout, clearTimeout, console, Event: function () {}, CustomEvent: function () {},
    fetch: async (url, opt) => { const body = opt && opt.body ? JSON.parse(opt.body) : null; sent.push({ url, body, headers: opt && opt.headers }); return handler(url, body, opt); } };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(src, ctx);
  return { P: ctx.window.Prov, sent, mem };
}
const res = (status, json) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => json, text: async () => JSON.stringify(json) });
const handler = (url, body, opt) => {
  if (url.includes('generateContent')) return res(401, { error: { message: 'API keys are not supported by this API. ACCESS_TOKEN_TYPE_UNSUPPORTED' } });
  if (/\/models(\?|$)/.test(url)) return res(200, url.includes('googleapis') ? { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] } : { data: [{ id: url.includes('groq') ? 'llama-3.3-70b-versatile' : 'mistral-small-latest' }, { id: 'whisper-large' }] });
  if (url.includes('googleapis')) return res(401, { error: { message: 'API keys are not supported by this API. ACCESS_TOKEN_TYPE_UNSUPPORTED' } });
  return res(200, { choices: [{ message: { content: 'hi from ' + (url.includes('groq') ? 'groq' : 'mistral') } }] });
};
const KEYS = { groq: [{ key: 'gsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, { key: 'gsk_BBBBBBBBBBBBBBBBBBBBBBBBBBBB' }], mistral: [{ key: 'm'.repeat(32) }], gemini: [{ key: 'AQ.' + 'x'.repeat(30) }] };

(async () => {
  // 1. identity is injected at call time with the REAL engine and model
  let { P, sent } = boot({ ember_keys: KEYS }, handler);
  let r = await P.run('fast', { system: 'BASE', messages: [{ role: 'user', content: 'what model are you' }] });
  let chat = sent.find(s => s.body && s.body.messages);
  const sys = chat.body.messages[0].content;
  ok('answers from groq', r.provider == 'groq' && r.model == 'llama-3.3-70b-versatile');
  ok('system prompt keeps the base text', sys.startsWith('BASE'));
  ok('system prompt names real engine + model', /engine "Groq", model id "llama-3\.3-70b-versatile"/.test(sys));
  ok('system prompt lists saved keys', /Groq 2\/2 usable/.test(sys) && /Mistral 1\/1 usable/.test(sys));
  ok('system prompt denies bundled key', /NO bundled, shared or placeholder key/.test(sys));
  ok('system prompt blocks fake tool claims', /TOOL RESULTS/.test(sys));

  // 2. util lane and json calls get NO facts (they must stay clean JSON jobs)
  sent.length = 0; await P.run('util', { system: 'JSONONLY', messages: [{ role: 'user', content: 'x' }], json: true });
  ok('util/json prompt untouched', sent.find(s => s.body && s.body.messages).body.messages[0].content == 'JSONONLY');

  // 3. pinned Gemini with a rejected key: falls back, says so, and tells the model
  ({ P, sent } = boot({ ember_keys: KEYS, ember_pin: 'gemini', ember_pin_strict: false }, handler));
  r = await P.run('fast', { system: 'BASE', messages: [{ role: 'user', content: 'hi' }] });
  const gsys = sent.filter(s => s.body && s.body.messages).pop().body.messages[0].content;
  ok('pin miss reported to the UI', r.pinMiss && r.pinMiss.want == 'gemini' && r.provider != 'gemini');
  ok('model told the pin failed', /Pinned engine in Settings: Gemini/.test(gsys) && /could not answer this message/.test(gsys));
  ok('Settings note explains it', /Pinned: Gemini .*key rejected|Pinned: Gemini but it has only rejected keys/.test(P.pinNote()), P.pinNote());

  // 4. model pin is strict: only that model is requested
  ({ P, sent } = boot({ ember_keys: KEYS, ember_pin: 'mistral', ember_pin_model: { id: 'mistral', model: 'mistral-large-2411' } }, handler));
  await P.run('fast', { system: 'BASE', messages: [{ role: 'user', content: 'hi' }] });
  const m = sent.filter(s => s.body && s.body.messages).pop();
  ok('pinned model is the one sent', m.body.model == 'mistral-large-2411' && m.url.includes('mistral'));
  ok('prompt names the pinned model', /model id "mistral-large-2411"/.test(m.body.messages[0].content));
  P.setPinnedModel('mistral', null); ok('model pin clears', P.getPinnedModel() == null);

  // 5. model list from a key (whisper filtered out), and cached list works offline
  ({ P, sent } = boot({ ember_keys: KEYS }, handler));
  const list = await P.modelsOf('groq', true);
  ok('model list loads from the key', list.includes('llama-3.3-70b-versatile') && !list.includes('whisper-large'), JSON.stringify(list));
  ok('cached list available', P.cachedModels('groq').length == 1);

  // 6. background hand-off carries generic facts (no engine name guessed)
  ({ P } = boot({ ember_keys: KEYS }, handler));
  const gate = P.run('fast', { system: 'BASE', messages: [{ role: 'user', content: 'x' }] });
  const pend = P.pending(); await gate;
  ok('background prompt does not name an engine', pend && /background reply/.test(pend.o.system) && !/engine "Groq"/.test(pend.o.system));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
