// Ember 1.9.48: OpenAI-compatible SSE streaming and cancellation regression test.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : (extra || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'providers.js'), 'utf8');
function boot(handler) {
  const mem = { ember_keys: { groq: [{ key: 'gsk_' + 'a'.repeat(28) }] }, ember_models: { groq: { list: ['llama-3.3-70b-versatile'], at: Date.now() } } };
  const LS = { get: (k, d) => k in mem ? JSON.parse(JSON.stringify(mem[k])) : d, set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } };
  const win = { addEventListener() {}, dispatchEvent() {}, Event: function(){}, CustomEvent: function(){} };
  const ctx = { U: { LS }, window: win, performance: { now: () => Date.now() }, AbortController, TextDecoder, TextEncoder, ReadableStream, setTimeout, clearTimeout, console, Event: function(){}, CustomEvent: function(){}, fetch: handler };
  ctx.window = Object.assign(ctx.window, ctx); vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.Prov;
}
const headers = { get: () => null };
(async () => {
  let chatCount = 0;
  const P = boot(async (url, opt) => {
    if (url.endsWith('/models')) return { ok: true, status: 200, headers, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }), text: async () => '' };
    chatCount++;
    const sse = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello ' } }] }) + '\n\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'from stream.' } }] })
    ].join('');
    const bytes = new TextEncoder().encode(sse);
    if (chatCount === 1) return { ok: true, status: 200, headers, body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }) };
    return { ok: true, status: 200, headers, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'partial' } }] }) + '\n\n')); } }) };
  });
  const chunks = [];
  const result = await P.run('fast', { system: 'test', messages: [{ role: 'user', content: 'hello' }], onToken: (piece, full) => chunks.push([piece, full]) });
  ok('stream accumulates full answer', result.text === 'Hello from stream.', result.text);
  ok('stream callback receives incremental chunks', chunks.length === 2 && chunks[0][1] === 'Hello ' && chunks[1][1] === 'Hello from stream.', JSON.stringify(chunks));
  let cancelCode = '';
  try { await P.run('fast', { system: 'test', messages: [{ role: 'user', content: 'stop me' }], onToken: () => P.abortInflight() }); } catch (e) { cancelCode = e.code; }
  ok('cancel aborts the active stream without provider fallback', cancelCode === 'cancelled' && chatCount === 2, cancelCode + ' / chats=' + chatCount);
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
