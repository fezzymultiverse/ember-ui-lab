// Deterministic configuration and API-security tests for unified repo workflow.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '../www', f), 'utf8');
const TOKEN = 'ghp_' + 'a'.repeat(36), saved = { ember_github: JSON.stringify({ token: TOKEN, cfg: { auto: false } }) }, calls = [];
let checks = 0, failWrites = false, responseBody = null;
function check(name, value) { assert(value, name); console.log('PASS ' + name); checks++; }
const w = {
 console, AbortController, TextEncoder, TextDecoder, URL,
 atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
 setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
 navigator: {}, document: { readyState: 'complete', getElementById: () => null, addEventListener() {} },
 localStorage: { getItem: k => saved[k] || null, setItem: (k, v) => { saved[k] = v; }, removeItem: k => delete saved[k] },
 addEventListener() {}, dispatchEvent() {}, CustomEvent: function() {},
 fetch: async (url, options) => {
  calls.push({ url, options }); const u = new URL(url);
  if (responseBody) return responseBody(options);
  const data = u.pathname === '/search/repositories' ? { total_count: 0, items: [] } : u.pathname === '/user/repos' ? [] : { default_branch: 'main', permissions: { push: true } };
  return { ok: !failWrites, status: failWrites ? 403 : 200, headers: { get: () => '' }, text: async () => JSON.stringify(data) };
 }
}; w.window = w;
vm.runInNewContext(read('ember_github.js'), w); vm.runInNewContext(read('ember_repo_runner.js'), w);
(async () => {
 const G = w.EmberGithub, R = w.EmberRepoRunner;
 check('whole default Brain is always the first source', R.config().sources[0].repo === G.knowledgeRepo());
 R.setTarget('https://github.com/me/Ember');
 check('Ember URL canonicalizes once for every runner surface', R.config().target === 'me/Ember');
 const r = R.applyBrain('https://github.com/owner/brain');
 check('Apply Brain changes live reader and runner atomically', r.ok && G.knowledgeRepo() === 'owner/brain' && R.config().brain === 'owner/brain' && R.config().sources.length === 1);
 R.addSource('owner/addon'); R.addSource('OWNER/ADDON');
 check('source duplicates are deduplicated case-insensitively', R.config().sources.length === 2);
 check('output cannot be applied as Brain', !R.applyBrain('me/Ember').ok && G.knowledgeRepo() === 'owner/brain');
 assert.throws(() => R.setTarget('OWNER/brain'), /different/); check('Brain cannot be used as output even with different case', R.config().target === 'me/Ember');
 assert.throws(() => R.addSource('me/Ember'), /different/); check('output cannot enter its own snapshot sources', !R.config().sources.some(x => x.repo === 'me/Ember'));
 const bad = R.applyBrain('not a repository'); check('invalid Brain leaves valid configuration intact', !bad.ok && G.knowledgeRepo() === 'owner/brain');
 R.applyBrain('owner/new-brain'); check('switching Brain removes old implicit source but retains staged sources', R.config().sources.length === 2 && R.config().sources[1].repo === 'owner/addon');
 R.save({ sources: [{ repo: 'owner/addon' }] }); check('save cannot accidentally omit whole Brain', R.config().sources[0].repo === 'owner/new-brain');
 const before = calls.length; await R.search({ query: 'ember feature', page: 2 });
 check('search uses authenticated GitHub API and actual page', calls.length === before + 1 && calls.at(-1).url.includes('page=2') && calls.at(-1).options.headers.Authorization === 'Bearer ' + TOKEN);
 check('discovery and local configuration perform no writes', calls.every(x => x.options.method === 'GET'));
 check('manager rejects unconfigured repo reads', !(await G.managerRequest('/repos/other/nope')).ok);
 check('manager blocks writes to configured Brain', !(await G.managerRequest('/repos/owner/new-brain/contents/a', { method: 'PUT' })).ok);
 check('manager blocks writes to staged source', !(await G.managerRequest('/repos/owner/addon/contents/a', { method: 'PUT' })).ok);
 check('manager rejects credential-bearing arbitrary URLs', !(await G.managerRequest('https://evil.example/token')).ok);
 check('model state and manifest do not contain saved token', !G.stateBlock().includes(TOKEN) && !JSON.stringify(R.config()).includes(TOKEN));
 // A response body arriving after Stop must be fenced even if the transport ignores abort.
 let release; responseBody = () => ({ ok: true, status: 200, headers: { get: () => '' }, text: () => new Promise(resolve => { release = resolve; }) });
 const pending = G.managerRequest('/repos/owner/new-brain'); await new Promise(resolve => setImmediate(resolve)); G.cancelReads(); release('{"default_branch":"main"}');
 check('late read response after cancellation is rejected', !(await pending).ok);
 responseBody = null;
 saved.ember_repo_runner = JSON.stringify({ target: 'me/Ember', sources: { malformed: true } });
 check('legacy malformed source list does not break configuration', R.config().sources.length === 1);
 const invalidToken = G.setToken('invalid'); check('invalid replacement preserves valid saved token', !invalidToken && G.on());
 G.setToken(''); check('token removal invalidates live read evidence', !G.on() && G.lastRead().files.length === 0);
 check('offline assets contain new workspace modules', ['ember_workspace.js', 'ember_workspace.css', 'ember_features.js', 'ember_routing.css'].every(f => read('sw.js').includes("'" + f + "'")));
 const originalStyle = read('style.css'); check('old floating Stop rule no longer positions above input', !originalStyle.includes('position:fixed!important;right:16px;bottom:calc(var(--dock,150px) + 12px)'));
 console.log('\n' + checks + ' unified workspace unit/security checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
