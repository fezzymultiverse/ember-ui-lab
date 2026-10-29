// V1.9.74: Ember must read a repo file after repo_search, and must read it by the exact path the search returned.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n); } };

const store = { ember_github: JSON.stringify({ token: 'ghp_' + 'a'.repeat(36), refs: ['scrapy/scrapy'] }) };
const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const REAL = 'scrapy/downloadermiddlewares/retry.py';
const calls = [];
const b64 = s => Buffer.from(s).toString('base64');
async function fakeFetch(url) {
  calls.push(url); const u = decodeURIComponent(url);
  const res = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), headers: { get: () => '' } });
  if (/search\/code/.test(u) && /filename:retry\.py/.test(u)) return res(200, { total_count: 1, items: [{ path: REAL }] });
  if (/search\/code/.test(u) && /filename:/.test(u)) return res(200, { total_count: 0, items: [] });
  if (/search\/code/.test(u)) return res(200, { total_count: 2, items: [{ path: REAL }, { path: 'scrapy/utils/log.py' }] });
  if (u.endsWith('/contents/' + REAL)) return res(200, { type: 'file', size: 20, content: b64('class RetryMiddleware: pass') });
  return res(404, { message: 'Not Found' });
}
const win = { localStorage: ls, fetch: fakeFetch, AbortController, setTimeout, clearTimeout, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, readyState: 'complete' }, addEventListener() {}, Buffer, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'), TextDecoder, TextEncoder, encodeURIComponent, decodeURIComponent, Date, JSON, Math, Promise, String, Object, Array, Error, RegExp, URL, console };
win.window = win; vm.runInNewContext(W('ember_github.js'), win, { filename: 'ember_github.js' });
const G = win.EmberGithub;

(async () => {
  const s = await G.dispatch('repo_search', { repo: 'scrapy/scrapy', query: 'retry' });
  ok('search returns exact paths', s.ok && s.hits[0].path === REAL);
  ok('search tells the AI it must read a file next', /MUST now call repo_read_file/.test(s.next_step));
  const bad = await G.dispatch('repo_read_file', { repo: 'scrapy/scrapy', path: 'lib/scrapy/spiders/feedexporters/retry.py' });
  ok('a guessed path fails with a clear reason', !bad.ok && /does not exist/.test(bad.error) && /guessed/.test(bad.error));
  ok('failed read points at the real path from the search', Array.isArray(bad.did_you_mean) && bad.did_you_mean[0] === REAL && /did_you_mean/.test(bad.next_step));
  const good = await G.dispatch('repo_read_file', { repo: 'scrapy/scrapy', path: bad.did_you_mean[0] });
  ok('reading the exact returned path works and returns the code', good.ok && /RetryMiddleware/.test(good.text) && good.path === REAL);
  const nofile = await G.dispatch('repo_read_file', { repo: 'scrapy/scrapy', path: 'nothing/here/zzz.py' });
  ok('unknown file with no match says to search or list first', !nofile.ok && Array.isArray(nofile.did_you_mean) && /repo_search or repo_list_files/.test(nofile.next_step));
  ok('tool descriptions carry the rule', /MUST call repo_read_file/.test(G.REF_TOOLS.find(t => t.name == 'repo_search').description) && /EXACTLY as repo_search/.test(G.REF_TOOLS.find(t => t.name == 'repo_read_file').description));
  ok('repo state block carries the rule', /MUST use repo_read_file to read the most relevant file before answering/.test(G.stateBlock()) && /Never write code based on assumptions/.test(G.stateBlock()));
  const p = W('persona.js');
  ok('persona hard rule has both requested sentences', /If repo_search returns a list of files, you MUST use repo_read_file to read the most relevant file before answering\./.test(p) && /Never write code based on assumptions\. If you are asked to study a repo, read the file first\./.test(p));
  ok('persona rule only appears when a repo is linked and the read tool exists', /EmberGithub\.refs\(\)\.length && window\.EmberGithub\.toolsFor\(\)\.some\(t => t\.name == 'repo_read_file'\)/.test(p));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
