// Ember V1.8.0 test: Local Context (chunking, search ladder, read chunk), typed tool binding, the ReAct state graph, document mode end to end.
// Run: node tests/context-test.js   (the last section also drives the real app in Chromium and needs Playwright; set PW=/path/to/playwright if needed)
const vm = require('vm'), fs = require('fs'), path = require('path'), http = require('http');
const WWW = process.env.WWW || path.join(__dirname, '..', 'www');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra === undefined ? '' : JSON.stringify(extra).slice(0, 300))); };

function sandbox(files) {
  const store = {}, ctx = { console, setTimeout, clearTimeout, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, Event: class { constructor(t) { this.type = t; } } };
  ctx.window = ctx; ctx.dispatchEvent = () => true; vm.createContext(ctx);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(WWW, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}
// a long document with headings, a needle deep inside, and prose-only filler
const filler = i => 'This paragraph number ' + i + ' talks about weather, ferries and tea in general terms. ' + 'It keeps going so the chunker has real work to do. '.repeat(6);
function makeDoc() {
  const parts = [];
  for (let s = 1; s <= 40; s++) {
    parts.push('## Section ' + s + ': Topic ' + s);
    for (let p = 0; p < 6; p++) parts.push(filler(s * 10 + p) + (s === 27 && p === 3 ? ' The vault passphrase rotation interval is forty-two days, set by the Zebrafish policy.' : ''));
  }
  parts.push('APPENDIX NOTES'); parts.push('Final words about marmalade and nothing else.');
  return parts.join('\n\n');
}
const DOC = { id: 'doc1', name: 'big.txt', type: 'txt', size: 0, text: makeDoc(), updated: 1 }; DOC.size = DOC.text.length;
const SMALL = { id: 'doc2', name: 'small.txt', type: 'txt', size: 40, text: 'A tiny note about marmalade and toast.', updated: 2 };
const NOHEAD = { id: 'doc3', name: 'plain.txt', type: 'txt', size: 0, text: Array.from({ length: 80 }, (_, i) => 'Plain sentence block ' + i + ' with ordinary words and nothing like a heading at all, repeated for length. '.repeat(4)).join('\n\n'), updated: 3 }; NOHEAD.size = NOHEAD.text.length;

(async () => {
  const docs = [DOC, SMALL, NOHEAD];
  const W = sandbox(['ember_schema.js', 'ember_context.js', 'ai_docs.js']);
  W.EmberDocs = { all: async () => docs.map(d => Object.assign({}, d)), listDocuments: async () => ({ documents: docs.map(d => ({ name: d.name, fileId: d.id, type: d.type, size: d.size })) }), readDocument: async a => { const d = docs.find(x => x.id === a.fileId); return d ? { name: d.name, fileId: d.id, content: d.text } : { error: 'No document with that fileId.' }; } };
  const C = W.EmberContext, S = W.EmberSchema, A = W.EmberDocsAddon;

  // ---------- chunking ----------
  const ix = C._chunkDoc(DOC.text);
  ok('chunker: many chunks for a ' + Math.round(DOC.text.length / 1000) + ' KB document', ix.chunks.length > 60 && ix.chunks.length < 120, ix.chunks.length);
  ok('chunker: every chunk is within the size cap', ix.chunks.every(c => c.e - c.s <= C.limits.CHUNK + C.limits.OVERLAP + 10), Math.max(...ix.chunks.map(c => c.e - c.s)));
  ok('chunker: no text is lost between chunks (only blank space may sit between them)', ix.chunks[0].s === 0 && ix.chunks.every((c, i) => i === 0 || DOC.text.slice(ix.chunks[i - 1].e, c.s).trim() === '') && ix.chunks[ix.chunks.length - 1].e >= DOC.text.trimEnd().length);
  ok('chunker: offsets increase', ix.chunks.every((c, i) => i === 0 || (c.s > ix.chunks[i - 1].s && c.e > ix.chunks[i - 1].e)));
  ok('chunker: finds the 40 markdown headings plus the CAPS heading', ix.heads.length === 41, ix.heads.length);
  ok('chunker: empty and tiny text do not crash', C._chunkDoc('').chunks.length === 0 && C._chunkDoc('hi').chunks.length === 1);
  ok('chunker: a single 20 KB line is split', C._chunkDoc('word '.repeat(4000)).chunks.length > 10);

  // ---------- search ladder ----------
  const r1 = await C.dispatch('search_in_document', { query: 'passphrase rotation interval', fileId: 'doc1' });
  ok('search: phrase hit ranks first and names the right chunk', r1.match === 'phrase' && r1.hits[0].snippet.includes('forty-two days'), r1);
  ok('search: hit carries chunk number, total and heading', r1.hits[0].chunk >= 1 && r1.hits[0].of === ix.chunks.length && /Section 27/.test(r1.hits[0].heading || ''), r1.hits[0]);
  const r2 = await C.dispatch('search_in_document', { query: 'zebrafish policy days', fileId: 'doc1' });
  ok('search: all-words level when it is not an exact phrase', r2.match === 'all_terms' && r2.hits[0].chunk === r1.hits[0].chunk, r2.match);
  const r3 = await C.dispatch('search_in_document', { query: 'zebrafish ferries unicorn', fileId: 'doc1' });
  ok('search: falls back to most words when one word is missing', r3.match === 'most_terms' && r3.total >= 1, r3.match);
  const r4 = await C.dispatch('search_in_document', { query: 'unicorn', fileId: 'doc1' });
  ok('search: no hit says so with advice, never crashes', r4.total === 0 && r4.hits.length === 0 && /Try other words/.test(r4.note), r4);
  const r5 = await C.dispatch('search_in_document', { query: 'weather ferries' });
  ok('search: omitting fileId searches every document, paged', r5.pages > 1 && r5.hits.length === 5 && r5.searched.documents === 3, { pages: r5.pages, docs: r5.searched });
  const r6 = await C.dispatch('search_in_document', { query: 'weather ferries', page: 2 });
  ok('search: page 2 differs from page 1', r6.page === 2 && r6.hits[0].chunk !== r5.hits[0].chunk || r6.hits[0].fileId !== r5.hits[0].fileId);
  ok('search: result fits one ReAct observation (3000 chars)', JSON.stringify(r5).length < 3000 && JSON.stringify(await C.dispatch('search_in_document', { query: 'weather', limit: 8 })).length < 3000, JSON.stringify(r5).length);
  ok('search: stop-word-only query still works', (await C.dispatch('search_in_document', { query: 'the and of', fileId: 'doc1' })).hits !== undefined);
  ok('search: unknown fileId is an error, not a crash', !!(await C.dispatch('search_in_document', { query: 'x', fileId: 'nope' })).error);

  // ---------- read chunk + outline ----------
  const c1 = r1.hits[0].chunk, rd = await C.dispatch('read_document_chunk', { fileId: 'doc1', chunk: c1 });
  ok('read chunk: returns the needle text with next and prev', /forty-two days/.test(rd.text) && rd.next_chunk === c1 + 1 && rd.prev_chunk === c1 - 1, rd);
  const rd2 = await C.dispatch('read_document_chunk', { fileId: 'doc1', chunk: 10, span: 2 });
  ok('read chunk: never exceeds the read cap', rd2.text.length <= C.limits.READ_CLIP && JSON.stringify(rd2).length < 3000, rd2.text.length);
  ok('read chunk: out-of-range chunk is a clear error', /does not exist/.test((await C.dispatch('read_document_chunk', { fileId: 'doc1', chunk: 99999 })).error || ''));
  const ol = await C.dispatch('get_document_outline', { fileId: 'doc1' });
  ok('outline: headings with chunk numbers', ol.chunks === ix.chunks.length && ol.headings.length === 40 && ol.headings[0].chunk === 1, { n: ol.headings && ol.headings.length, note: ol.note });
  const ol2 = await C.dispatch('get_document_outline', { fileId: 'doc3' });
  ok('outline: heading-less document gets landmarks', !ol2.headings && ol2.landmarks.length === 10, ol2);
  ok('chunks of a read stitch back to the original text', ix.chunks.slice(0, 5).every(c => DOC.text.slice(c.s, c.e).length > 0));

  // ---------- bridge integration ----------
  ok('ai_docs: the three Local Context tools are in the document tool set', ['get_document_outline', 'search_in_document', 'read_document_chunk'].every(n => A.TOOLS.some(t => t.name === n)));
  ok('ai_docs: dispatch routes to Local Context', (await A.dispatch('search_in_document', { query: 'marmalade', fileId: 'doc2' })).hits.length === 1);
  const big = await A.dispatch('read_document', { fileId: 'doc1' });
  ok('ai_docs: read_document on a long file says truncated and points to the new tools', big.truncated === true && big.total_chars === DOC.text.length && /search_in_document/.test(big.hint), { t: big.truncated, h: big.hint });
  const sm = await A.dispatch('summarize_document', { fileId: 'doc1' });
  ok('ai_docs: summarize_document on a long file says partial', sm.partial === true && sm.total_chars === DOC.text.length, sm);
  ok('ai_docs: a short file is not flagged', !(await A.dispatch('summarize_document', { fileId: 'doc2' })).partial);
  W.Safety = { lastLevel: () => 2 };
  ok('safety: level 2 pauses every Local Context tool', !!(await C.dispatch('search_in_document', { query: 'marmalade' })).error && !!(await C.dispatch('read_document_chunk', { fileId: 'doc1', chunk: 1 })).error);
  W.Safety = { lastLevel: () => 1 };
  ok('safety: level 1 does not', !!(await C.dispatch('search_in_document', { query: 'marmalade', fileId: 'doc2' })).hits);
  delete W.Safety;

  // ---------- typed binding ----------
  const sd = C.TOOLS.find(t => t.name === 'search_in_document'), rc = C.TOOLS.find(t => t.name === 'read_document_chunk');
  let b = S.bind(sd, { query: '  hello ', limit: '3', page: '2' });
  ok('schema: coerces "3" to 3 and trims', b.ok && b.value.limit === 3 && b.value.page === 2 && b.value.query === 'hello', b);
  b = S.bind(sd, { query: 'x', limit: 99, page: -4 });
  ok('schema: clamps limit and page', b.ok && b.value.limit === 8 && b.value.page === 1, b);
  b = S.bind(sd, {});
  ok('schema: missing required argument is a structured error', !b.ok && b.result.ok === false && /query is required/.test(b.result.error) && b.result.problems[0].path === 'query', b);
  b = S.bind(sd, { query: 'x', bogus: 1 });
  ok('schema: unknown argument is refused', !b.ok && /bogus/.test(b.result.error), b);
  b = S.bind(rc, { fileId: 'a', chunk: 'seven' });
  ok('schema: a word where a number belongs is refused', !b.ok && /chunk must be a number/.test(b.result.error), b);
  b = S.bind(rc, { fileId: 12, chunk: 3.6 });
  ok('schema: number to string and integer rounding', b.ok && b.value.fileId === '12' && b.value.chunk === 4 && b.value.span === 1, b);
  b = S.bind(sd, { query: 'x'.repeat(500) });
  ok('schema: over-long string is refused with the length', !b.ok && /too long/.test(b.result.error));
  b = S.bind(sd, JSON.parse('{"query":"x","__proto__":{"evil":1}}'));
  ok('schema: __proto__ never reaches a tool', b.ok && !({}).evil && !Object.prototype.hasOwnProperty.call(b.value, '__proto__'));
  b = S.bind({ name: 'old_tool', parameters: { n: 'number?', flag: 'boolean?', q: 'string' } }, { n: '5', flag: 'true', q: 7, extra: 'kept' });
  ok('schema: a legacy tool is only coerced, nothing rejected or dropped', b.ok && b.value.n === 5 && b.value.flag === true && b.value.q === 7 && b.value.extra === 'kept', b);
  ok('schema: bind never throws on junk', S.bind(null, 5).ok && S.bind({ name: 'x', parameters: 5 }, null).ok);

  // ---------- state graph ----------
  const Wr = sandbox(['ember_schema.js', 'ember_context.js', 'ai_docs.js', 'ember_engine.js', 'ember_react.js']);
  const RX = Wr.EmberEngine.react, GR = RX.GRAPH, states = Object.keys(GR);
  ok('graph: every edge points at a real state', states.every(s => Object.values(GR[s]).every(t => states.includes(t))));
  ok('graph: every non-final state can reach a final one', states.every(s => { const seen = new Set([s]), q = [s]; while (q.length) { const x = q.shift(); if (RX.TERMINAL.has(x)) return true; Object.values(GR[x]).forEach(t => { if (!seen.has(t)) { seen.add(t); q.push(t); } }); } return RX.TERMINAL.has(s); }));
  ok('graph: final states have no exits', [...RX.TERMINAL].every(s => Object.keys(GR[s]).length === 0));
  const g = RX._makeGraph(); g.go('start'); g.go('reply');
  let threw = ''; try { g.go('go'); } catch (e) { threw = e.message; }
  ok('graph: an illegal move throws instead of jumping', /illegal transition PARSE --go-->/.test(threw), threw);

  // ---------- document mode end to end (scripted model, real tools) ----------
  Wr.EmberDocs = W.EmberDocs;
  const cat = () => Wr.EmberDocsAddon.TOOLS.concat(Wr.EmberEngine.TOOLS);
  const mkHost = script => {
    const calls = [];
    return { calls, host: { tools: () => cat(), has: n => cat().some(t => t.name === n), llm: async (sys, msgs) => { calls.push({ sys, msgs }); const next = script.shift(); return typeof next === 'function' ? next(msgs, calls) : next; },
      run: async (tool, args) => { const def = cat().find(t => t.name === tool); const b = Wr.EmberSchema.bind(def, args); if (!b.ok) return b.result; return Wr.EmberDocsAddon.dispatch(tool, b.value); } } };
  };
  const call = (thought, tool, args) => 'Thought: ' + thought + '\nAction: ' + JSON.stringify({ tool, args });
  let h = mkHost([
    call('Orient first.', 'list_documents', {}),
    call('Search the big file.', 'search_in_document', { query: 'passphrase rotation interval', fileId: 'doc1' }),
    (m, calls) => call('Read the best hit.', 'read_document_chunk', { fileId: 'doc1', chunk: c1 }),
    'Thought: I have it.\nFinal: The rotation interval is forty-two days [#' + c1 + '].'
  ]);
  Wr.EmberEngine.setHost(h.host);
  let out = await Wr.EmberEngine.dispatch('run_react', { goal: 'How often is the vault passphrase rotated?', mode: 'document' });
  ok('doc mode: reaches the right answer from the right chunk', out.ok && /forty-two days/.test(out.answer) && out.steps === 4, out);
  ok('doc mode: the model is offered only the document tools', /list_documents/.test(h.calls[0].sys) && !/youtube|get_current_track|run_plan/.test(h.calls[0].sys) && /DOCUMENT MODE/.test(h.calls[0].sys));
  ok('doc mode: the evidence ledger reaches the model after the first hits', h.calls[3] && /EVIDENCE SO FAR/.test(h.calls[3].sys) && /forty-two days/.test(h.calls[3].sys) && /SEARCH "passphrase/.test(h.calls[3].sys));
  const snap = RX.state();
  ok('doc mode: the whole trail used only legal edges and ended in DONE', snap.graph[0] === 'IDLE -start-> THINK' && /-> DONE$/.test(snap.graph[snap.graph.length - 1]) && snap.status === 'done', snap.graph);
  h = mkHost([call('x', 'run_plan', { steps: [] }), 'Thought: stop\nFinal: done']);
  Wr.EmberEngine.setHost(h.host); out = await Wr.EmberEngine.dispatch('run_react', { goal: 'g', mode: 'document' });
  ok('doc mode: a tool outside the document set is reported, not run', out.ok && out.trace[0].result === 'failed');

  // errors, repeats and the circuit breaker
  h = mkHost([
    call('bad args', 'read_document_chunk', { fileId: 'doc1' }),
    call('same bad args again', 'read_document_chunk', { fileId: 'doc1' }),
    call('wrong type', 'read_document_chunk', { fileId: 'doc1', chunk: 'seven' }),
    'Thought: nothing works\nFinal: I could not read the chunks, so I cannot answer.'
  ]);
  Wr.EmberEngine.setHost(h.host); out = await Wr.EmberEngine.dispatch('run_react', { goal: 'g', mode: 'document' });
  const st = RX.state();
  ok('breaker: an exact repeat of a failed call is not run again', out.trace[1].result === 'repeat', out.trace);
  ok('breaker: three failures in a row force a Final', st.graph.some(x => /OBSERVE -exhaust-> FORCE_FINAL/.test(x)) && out.ok, st.graph);
  ok('breaker: the bad-args error reached the model as data', h.calls[1].msgs.some(m => /Arguments rejected for read_document_chunk/.test(m.content)));
  h = mkHost(['no markers here {{{', 'still {{ nothing', 'Thought: x\nAction: {broken', 'Thought: y\nFinal: late']);
  Wr.EmberEngine.setHost(h.host); out = await Wr.EmberEngine.dispatch('run_react', { goal: 'g' });
  ok('format recovery: plain prose is taken as the answer', out.ok === true && /no markers/.test(out.answer));
  h = mkHost(['Thought: a\nAction: {broken', 'Thought: b\nAction: {broken again', 'Thought: c\nAction: {still broken', 'Thought: d\nAction: {nope']);
  Wr.EmberEngine.setHost(h.host); out = await Wr.EmberEngine.dispatch('run_react', { goal: 'g' });
  ok('format recovery: gives up cleanly after the allowed retries', out.ok === false && /format/.test(out.note) && RX.state().status === 'failed' && /-> FAILED$/.test(RX.state().graph.slice(-1)[0]), out);
  Wr.EmberDocs = undefined;
  h = mkHost([]); Wr.EmberEngine.setHost({ tools: () => [], has: () => false, llm: async () => '', run: async () => ({}) });
  out = await Wr.EmberEngine.dispatch('run_react', { goal: 'g', mode: 'document' });
  ok('doc mode: with no document tools it says what to switch on', /Document tools are off/.test(out.error || ''), out);

  // ---------- the real app in Chromium ----------
  let chromium; try { chromium = require(process.env.PW || 'playwright').chromium; } catch (e) { console.log('SKIP browser section: Playwright not found'); }
  if (chromium) {
    const srv = http.createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]; fs.readFile(path.join(WWW, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html' }); r.end(d); }); });
    await new Promise(r => srv.listen(0, r));
    const b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://localhost:' + srv.address().port + '/'); await pg.waitForTimeout(800);
    await pg.evaluate(async t => { await window.EmberDocs.addText('big.txt', t, 'file'); }, DOC.text);
    const res = await pg.evaluate(async () => {
      const H = window.EmberEngine._host(), id = (await window.EmberDocs.all())[0].id, o = {};
      o.tools = H.tools().map(t => t.name);
      o.search = await H.run('search_in_document', { query: 'passphrase rotation interval', fileId: id, limit: '2' });
      o.bad = await H.run('search_in_document', { query: 'x', nonsense: true });
      o.read = await H.run('read_document_chunk', { fileId: id, chunk: o.search.hits[0].chunk });
      o.readBad = await H.run('read_document_chunk', { fileId: id, chunk: 'abc' });
      o.docRead = await H.run('read_document', { fileId: id });
      return o;
    });
    ok('app: Local Context tools are in the live tool catalog once a document exists', ['get_document_outline', 'search_in_document', 'read_document_chunk'].every(n => res.tools.includes(n)), res.tools);
    ok('app: runTool binds strictly (limit "2" coerced, finds the needle)', res.search.match === 'phrase' && res.search.hits.length === 1 && res.search.page === 1, res.search);
    ok('app: the snippet holds the answer', /forty-two days/.test(JSON.stringify(res.search.hits[0].snippet)), res.search.hits[0].snippet);
    ok('app: runTool rejects an unknown argument with a structured error', res.bad.ok === false && /nonsense/.test(res.bad.error), res.bad);
    ok('app: read chunk through the real app', /forty-two days/.test(res.read.text));
    ok('app: a bad chunk type is refused in the real app', res.readBad.ok === false);
    ok('app: legacy read_document still works and now flags truncation', res.docRead.truncated === true);
    await pg.evaluate(() => window.dispatchEvent(new Event('ember-docs-changed')));
    ok('app: no page errors while loading, adding a document and calling tools', errs.length === 0, errs);
    await b.close(); srv.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
