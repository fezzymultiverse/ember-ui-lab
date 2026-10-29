// No credentials or real network: deterministic single-repository and live-read regression tests.
'use strict';
const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const W = f => fs.readFileSync(path.join(__dirname, '../www', f), 'utf8');
const REPO = 'fezzymultiverse/ember-brain', TOKEN = 'ghp_' + 'a'.repeat(36);
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function setup(extra = {}) {
  const saved = { ember_github: JSON.stringify(Object.assign({ token: TOKEN, cfg: { auto: false }, slots: [{ id: 'old', repo: 'other/legacy', role: 'mine' }], refs: ['other/reference'], repo: 'other/main' }, extra)) }, kv = {}, calls = [];
  const files = { 'README.md': '# Super Repo\nProject knowledge.', 'www/app.js': 'function renderAnswer() { return "live code"; }\n', 'docs/python.md': '# Python\nUse a for loop.\n', 'long.md': 'x'.repeat(16000), 'empty.txt': '', '.env': 'PASSWORD=not-for-reading' };
  let offline = false, denied = false, noFiles = false, truncated = false;
  function response(status, data) { return { ok: status < 300, status, headers: { get: name => name === 'x-oauth-scopes' ? 'repo' : '' }, text: async () => JSON.stringify(data) }; }
  async function fetch(url, options) {
    calls.push({ url, options });
    if (offline) throw new Error('offline');
    if (denied) return response(403, { message: 'access denied' });
    const u = new URL(url), p = decodeURIComponent(u.pathname), rp = p.match(/^\/repos\/([^/]+\/[^/]+)/);
    if (rp && rp[1] !== REPO) return response(404, {});
    if (p === '/user') return response(200, { login: 'mock-user' });
    if (p === '/repos/' + REPO) return response(200, { full_name: REPO, default_branch: 'main', permissions: { push: true } });
    if (p === '/repos/' + REPO + '/git/trees/main') return response(200, { sha: 'tree123', truncated, tree: noFiles ? [] : Object.keys(files).map(p => ({ type: 'blob', path: p, sha: 'sha-' + p, size: files[p].length })) });
    if (p === '/repos/' + REPO + '/contents' || p === '/repos/' + REPO + '/contents/www') return response(200, [{ type: 'file', name: p.endsWith('/www') ? 'app.js' : 'README.md', size: 25 }, ...(p.endsWith('/www') ? [] : [{ type: 'dir', name: 'www' }])]);
    if (p.startsWith('/repos/' + REPO + '/contents/')) {
      const f = p.slice(('/repos/' + REPO + '/contents/').length);
      return Object.hasOwn(files, f) ? response(200, { type: 'file', content: Buffer.from(files[f]).toString('base64'), size: files[f].length, sha: 'sha-' + f }) : response(404, { message: 'Not Found' });
    }
    if (p === '/search/code') return response(200, { total_count: 2, items: [{ path: 'www/app.js', repository: { full_name: REPO } }, { path: 'evil.js', repository: { full_name: 'other/evil' } }] });
    return response(404, { message: 'Not Found' });
  }
  const win = { localStorage: { getItem: k => saved[k] || null, setItem: (k, v) => { saved[k] = v; }, removeItem: k => { delete saved[k]; } }, Store: { getKV: async (k, d) => kv[k] === undefined ? d : kv[k], setKV: async (k, v) => { kv[k] = v; } }, fetch, AbortController, TextEncoder, TextDecoder, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, navigator: { onLine: true }, document: { addEventListener() {}, getElementById: () => null, readyState: 'complete' }, addEventListener() {}, dispatchEvent() {}, Event: function () {}, CustomEvent: function () {}, console };
  win.window = win; vm.runInNewContext(W('ember_github.js'), win);
  return { G: win.EmberGithub, saved, calls, kv, files, mode: value => { offline = !!value.offline; denied = !!value.denied; noFiles = !!value.noFiles; truncated = !!value.truncated; } };
}
(async () => {
  const t = setup(), g = t.G;
  check('defaults to Super Repo and migrates old repositories without losing token', () => { assert.equal(g.knowledgeRepo(), REPO); const s = JSON.parse(t.saved.ember_github); assert.equal(s.token, TOKEN); assert(!('slots' in s)); assert(!('refs' in s)); assert(!('repo' in s)); });
  check('no slot limit, list or mutation API remains', () => { for (const key of ['slots','MAX_SLOTS','addSlot','removeSlot','updateSlot']) assert.equal(g[key], undefined); assert.equal(g.knowledgeSources().length, 1); });
  check('only one repository is reported', () => assert.equal(g.knowledgeSources()[0].repo, REPO));
  check('general programming, identifiers and follow-up questions require read first', () => { for (const q of ['Explain Python loops','Fix www/app.js','Why is renderAnswer slow?','What is recursion?','Write a script','Implement a website','Explain foo_bar']) assert(g.isCodeQuestion(q, ''), q); assert(g.isCodeQuestion('yes do it', 'Fix the code')); });
  check('ordinary greetings are not classified as code', () => { for (const q of ['hello', 'How are you?', 'Tell me a joke']) assert(!g.isCodeQuestion(q, ''), q); });
  let r = await g.dispatch('github_read_file', { repo: 'other/evil', path: 'www/app.js' });
  check('read tool ignores alternate repo and reads live with token', () => { assert(r.ok); assert.equal(r.repo, REPO); assert.match(r.text, /live code/); assert.equal(t.calls.at(-1).options.headers.Authorization, 'Bearer ' + TOKEN); });
  r = await g.dispatch('github_list_files', { repo: 'other/evil' });
  check('list tool reads live without prior sync or runner', () => { assert(r.ok); assert.equal(r.repo, REPO); assert.equal(r.source, 'live from GitHub'); assert(t.calls.at(-1).url.endsWith('/contents')); });
  r = await g.dispatch('github_repo_map', { repo: 'other/evil' });
  check('repository map is also live and needs no sync', () => { assert(r.ok); assert.equal(r.source, 'live from GitHub'); assert.equal(r.repo, REPO); });
  const runner = await g.installRunner('other/evil');
  check('Runner install stays disabled outside Advanced opt-in', () => assert(!runner.ok));
  r = await g.dispatch('github_find', { repo: 'other/evil', query: '*.js' });
  check('path search uses fresh authenticated GitHub tree', () => { assert(r.ok); assert.equal(r.paths[0].path, 'www/app.js'); assert(t.calls.some(x => x.url.includes('/git/trees/main?recursive=1'))); });
  r = await g.dispatch('github_find', { repo: 'other/evil', query: 'renderAnswer OR repo:other/evil', mode: 'code' });
  check('code search cannot inject repository qualifiers or leak cross-repo results', () => { assert(r.ok); assert.equal(r.hits.length, 1); const q = new URL(t.calls.at(-1).url).searchParams.get('q'); assert.equal((q.match(/repo:/g) || []).length, 1); assert(q.endsWith('repo:' + REPO)); });
  r = await g.prefetch('Explain www/app.js', '');
  check('pre-answer read runs live without sync and records genuine provenance', () => { assert(r.required); assert(g.hasLiveRead(r)); assert(r.files.some(f => f.path === 'www/app.js' && f.sha && f.at >= r.at)); g.assertReadFirst(); assert(g.stateBlock().includes('live code')); });
  check('tokens never appear in prompt or provenance', () => { assert(!g.stateBlock().includes(TOKEN)); assert(!JSON.stringify(r).includes(TOKEN)); });
  check('runner is off and absent from tool catalog by default', () => { assert(!g.cfg().runner); assert(!g.toolsFor().some(x => x.name === 'github_run')); });
  g.setCfg({ chat: false, sync: false, runner: false }); r = await g.prefetch('Explain Python loops', '');
  check('legacy chat-off and sync-off cannot bypass read first', () => { assert(g.hasLiveRead(r)); assert(g.toolsFor().some(x => x.name === 'github_read_file')); });
  r = await g.dispatch('github_read_file', { path: 'long.md' });
  check('long file read discloses truncation and supports continuation', () => { assert(r.trimmed); assert.equal(r.text.length, 12000); assert.match(r.more, /start=12000/); });
  r = await g.dispatch('github_read_file', { path: 'long.md', start: 12000 });
  check('continuation returns remaining file text', () => { assert.equal(r.text.length, 4000); assert(!r.trimmed); });
  r = await g.dispatch('github_read_file', { path: 'empty.txt' });
  check('empty text file handled correctly', () => { assert(r.ok); assert.equal(r.text, ''); });
  for (const path of ['../outside.js', '.env']) { r = await g.dispatch('github_read_file', { path }); check('invalid/protected file blocked: ' + path, () => assert(!r.ok)); }
  t.kv['ghf:' + REPO] = { 'www/app.js': ['cached-sha', 'old cached code'] }; t.mode({ offline: true });
  r = await g.dispatch('github_read_file', { path: 'www/app.js' });
  check('offline reads fail rather than using cached code', () => assert(!r.ok));
  r = await g.prefetch('Explain www/app.js', '');
  check('failed next turn resets previous proof and blocks answer', () => { assert.equal(r.files.length, 0); assert.throws(() => g.assertReadFirst(), /Read-First blocked/); });
  t.mode({ denied: true }); r = await g.prefetch('Explain Java', '');
  check('403 fails closed with actionable error', () => { assert.equal(r.files.length, 0); assert.match(r.error, /403/); assert.throws(() => g.assertReadFirst()); });
  const status = await g.status(); check('invalid token/access status fails rather than claiming success', () => assert(!status.ok));
  t.mode({ noFiles: true }); r = await g.prefetch('Write code', '');
  check('empty repository cannot satisfy read-first', () => { assert.equal(r.files.length, 0); assert.throws(() => g.assertReadFirst()); });
  t.mode({ truncated: true }); r = await g.dispatch('github_find', { query: '.js' });
  check('truncated tree whose subtrees cannot be read fails closed', () => { assert.equal(r.ok, false); assert(r.error); });
  t.mode({}); await g.prefetch('Explain code', ''); const count = t.calls.length; g.setToken(''); r = await g.prefetch('Explain code', '');
  check('no token blocks code before any network call', () => { assert.equal(t.calls.length, count); assert.throws(() => g.assertReadFirst(), /token/); });
  r = await g.prefetch('hello', ''); check('ordinary chat can continue without token', () => { assert(!r.required); g.assertReadFirst(); });
  g.setToken(TOKEN); check('invalid replacement does not erase saved token', () => { assert(!g.setToken('bad')); assert(g.token()); });
  await g.prefetch('Explain code', ''); const proof = g.lastRead();
  check('single setting persists, invalid values rejected and switching invalidates proof', () => { assert(!g.setKnowledgeRepo('bad').ok); assert(!g.setKnowledgeRepo('../foo').ok); assert(g.setKnowledgeRepo('owner/new-brain').ok); assert.equal(g.knowledgeRepo(), 'owner/new-brain'); assert.equal(g.lastRead().files.length, 0); assert(!g.hasLiveRead(proof)); });
  check('no alternate repository was ever fetched', () => assert(!t.calls.some(x => /\/repos\/other\//.test(x.url))));
  const ui = W('ember_github_ui.js'), app = W('app.js'), index = W('index.html');
  check('one labelled repository field and no repository slot UI', () => { assert(ui.includes('for="ghBrainRepo">Knowledge Brain Repo')); assert(!/addSlot|slotCard|MAX_SLOTS|Slot \d|Pin \(keep connected\)/.test(ui)); });
  check('Runner has its own Settings Advanced section', () => { assert(index.includes('data-tab="advanced" id="ghRunnerCard"')); assert(W('ember_acc.js').includes("id: 'advanced'")); });
  check('read-first gate precedes model call and sits inside failure handling', () => { const start = app.indexOf('const rr = await GHr.prefetch'); assert(start < app.indexOf('const call = Persona.respond')); assert(app.indexOf('GHr.assertReadFirst();', start) < app.indexOf('const call = Persona.respond')); });
  check('Last Read chip and proof are saved per assistant answer', () => { assert(app.includes('Last Read · ')); assert(app.includes('ghRead: GHr.lastRead()')); assert(app.includes('conv.ghReadTurns[turnId] = rr')); assert(app.includes("c.msgs.push({ r: 'a', t: text, ghRead")); });
  console.log('\n' + passed + ' Knowledge Brain checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
