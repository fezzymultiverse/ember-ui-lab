// Ember V1.9.88: pinned repo slots, "replace the oldest unpinned" when full, READ-FIRST retrieval before answers, runner copy only in Advanced.
// Pure Node, mocked GitHub, no browser, no network.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' :: ' + x : '')); } };

const store = { ember_github: JSON.stringify({ token: 'ghp_' + 'a'.repeat(36) }) };
const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const b64 = s => Buffer.from(s).toString('base64');

// fake GitHub: owner/name -> { path: text }
const REPOS = {};
const mk = (name, files) => { REPOS[name] = files; };
mk('o/ember', {
  'README.md': '# Ember\nA companion app.\n',
  'www/ember_github.js': 'function syncSlot() {}\nconst x = 1;\n// retry middleware lives elsewhere\n',
  'www/retry_queue.js': 'const MAX_RETRY = 3;\nasync function retryOn503(fn) {\n  for (let i = 0; i < MAX_RETRY; i++) { try { return await fn(); } catch (e) { if (e.status != 503) throw e; } }\n}\n',
  'www/store.js': 'export const store = {};\n',
  'package.json': '{"name":"ember","version":"1.0.0"}'
});
mk('o/prodigy', {
  'README.md': '# Prodigy Syncing\nMusic app.\n',
  'src/player.js': 'function playTrack(t) { return t; }\n',
  'package.json': '{"name":"prodigy","version":"2.0.0"}'
});
for (let i = 1; i <= 12; i++) mk('o/r' + i, { 'README.md': '# r' + i + '\n', 'package.json': '{"name":"r' + i + '"}' });
mk('o/newrepo', { 'README.md': '# new\n' });

const calls = [];
async function fakeFetch(url) {
  calls.push(url); const u = decodeURIComponent(url).replace('https://api.github.com', '');
  const res = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), headers: { get: () => '' } });
  let m;
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)$/))) return REPOS[m[1]] ? res(200, { full_name: m[1], default_branch: 'main', permissions: { push: true }, description: 'test', language: 'JavaScript', private: false }) : res(404, { message: 'Not Found' });
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)\/branches\/main$/))) return res(200, { commit: { sha: 'head_' + m[1], commit: { message: 'm', tree: { sha: 'tree_' + m[1] } } } });
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)\/git\/trees\//))) return res(200, { truncated: false, tree: Object.keys(REPOS[m[1]]).map(p => ({ type: 'blob', path: p, sha: 'sha_' + m[1] + '_' + p, size: REPOS[m[1]][p].length })) });
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)\/languages$/))) return res(200, { JavaScript: 100 });
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)\/git\/blobs\/sha_[^_]+_?(.*)$/))) { const raw = decodeURIComponent(url).split('/git/blobs/')[1]; const mm = raw.match(/^sha_(o\/[^_]+)_(.*)$/); return res(200, { content: b64(REPOS[mm[1]][mm[2]]) }); }
  if ((m = u.match(/^\/repos\/([^\/]+\/[^\/]+)\/contents\/(.+?)(\?.*)?$/))) { const t = REPOS[m[1]] && REPOS[m[1]][m[2]]; return t ? res(200, { type: 'file', size: t.length, sha: 'x', content: b64(t) }) : res(404, { message: 'Not Found' }); }
  return res(404, { message: 'Not Found' });
}
const win = { atob: x => Buffer.from(x, 'base64').toString('binary'), btoa: x => Buffer.from(x, 'binary').toString('base64'), TextDecoder, TextEncoder, localStorage: ls, fetch: fakeFetch, AbortController, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, navigator: { onLine: true }, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, readyState: 'complete', visibilityState: 'visible' }, addEventListener() {}, dispatchEvent() {}, Event: function () {}, console };
win.window = win; vm.runInNewContext(W('ember_github.js'), win, { filename: 'ember_github.js' });
const G = win.EmberGithub;

(async () => {
  // ---------- slots: pin + replace oldest unpinned ----------
  for (let i = 1; i <= 12; i++) { const r = await G.addSlot('o/r' + i, {}); if (!r.ok) { ok('setup add r' + i, false, r.error); } }
  ok('12 slots in place', G.slots().length === 12 && G.MAX_SLOTS === 12);
  const first = G.slots()[0];
  ok('slots carry a pin flag, off by default', G.slots().every(s => s.pin === false));
  G.updateSlot(first.id, { pin: true });
  ok('pin persists through a reload of the slot list', G.slots()[0].pin === true && G.slots()[1].pin === false);
  const full = await G.addSlot('o/newrepo', {});
  ok('full + not confirmed: nothing removed, victim named', !full.ok && full.full === true && full.victim && full.victim.repo === 'o/r2' && G.slots().length === 12, JSON.stringify(full));
  ok('the victim is the oldest UNPINNED repo, not the pinned first one', full.victim.repo !== first.repo);
  const bad = await G.addSlot('o/does-not-exist', { replace: true });
  ok('confirmed replace with a repo that does not exist fails and removes NOTHING', !bad.ok && G.slots().some(s => s.repo === 'o/r2') && G.slots().length === 12, JSON.stringify(bad));
  await G.syncAll({ slots: [G.slots().find(s => s.repo === 'o/r2')] });
  ok('victim had cached data before the swap', !!(await G.tree(G.slots().find(s => s.repo === 'o/r2'))));
  const v2 = G.slots().find(s => s.repo === 'o/r2');
  const rep = await G.addSlot('o/newrepo', { replace: true });
  ok('confirmed replace adds the new repo', rep.ok && G.slots().some(s => s.repo === 'o/newrepo'), JSON.stringify(rep));
  ok('still 12 slots, victim gone, pinned first kept', G.slots().length === 12 && !G.slots().some(s => s.repo === 'o/r2') && G.slots().some(s => s.id === first.id && s.pin));
  ok('victim cache is cleared (no stale files left behind)', (await G.tree(v2)) === null && !G.digestOf(v2));
  G.slots().forEach(s => G.updateSlot(s.id, { pin: true }));
  const allp = await G.addSlot('o/ember', {});
  ok('all pinned: clear error, no victim, nothing removed', !allp.ok && allp.full === true && !allp.victim && /pinned/.test(allp.error) && G.slots().length === 12);
  const dup = await G.addSlot('o/r5', {});
  ok('adding a repo that is already there still says so', !dup.ok && /already in a slot/.test(dup.error));
  // reset to two real repos for retrieval tests
  for (const s of G.slots()) await G.removeSlot(s.id);
  ok('slots cleared', G.slots().length === 0);

  // ---------- READ FIRST ----------
  const a1 = await G.addSlot('o/ember', {}), a2 = await G.addSlot('o/prodigy', {});
  ok('two repos added', a1.ok && a2.ok);
  await G.syncAll({});
  ok('both synced from the token (no runner call anywhere)', !!G.digestOf(a1.slot) && !!G.digestOf(a2.slot) && !calls.some(u => /workflows|actions/.test(u)));
  G.setCfg({ chat: false });
  const off = await G.prefetch('why does retryOn503 fail with a 503 in ember', '');
  ok('chat switch OFF: nothing is read, nothing is injected', off.files.length === 0 && !/READ-FIRST/.test(G.stateBlock()));
  G.setCfg({ chat: false }); ok('chat OFF: tools are locked and she is told where the switch is', G.toolsFor().length === 0 && /Let Ember use my repos in chat/.test(G.stateBlock()));
  G.setCfg({ chat: true }); ok('chat is ON by default once a repo is synced (no pill to tap)', G.pill.get() === true && G.toolsFor().length > 3);
  const r1 = await G.prefetch('why does retryOn503 keep failing when the server sends a 503 in ember', '');
  ok('chat ON: reads the file the question points at', r1.files.length >= 1 && r1.files[0].path === 'www/retry_queue.js' && r1.files[0].repo === 'o/ember', JSON.stringify(r1.files));
  const sb = G.stateBlock();
  ok('the file text reaches the model (stateBlock)', /READ-FIRST/.test(sb) && /MAX_RETRY = 3/.test(sb) && /o\/ember:www\/retry_queue\.js/.test(sb));
  ok('model is told to cite paths and never fill gaps from memory', /name each path you used/.test(sb) && /never fill the gap from memory/.test(sb) && /untrusted data/.test(sb));
  ok('the Settings preview does NOT carry a one-turn retrieval', !/READ-FIRST/.test(G.stateBlock({ preview: true })));
  ok('lastRead() exposes what was read, for the thinking card', G.lastRead().files.length >= 1 && G.lastRead().searched > 3 && G.lastRead().terms.includes('retryon503'));
  const none = await G.prefetch('what is the capital of zanzibar quarkfoam', '');
  ok('no match is reported honestly, not hidden', none.files.length === 0 && /nothing matched/.test(G.stateBlock()));
  const named = await G.prefetch('in prodigy where is playTrack defined', '');
  ok('a repo named in the message is the only one searched', named.repos.length === 1 && named.repos[0] === 'o/prodigy' && named.files[0] && named.files[0].path === 'src/player.js', JSON.stringify(named));
  const follow = await G.prefetch('yes do it', 'fix retryOn503 in www/retry_queue.js');
  ok('a short follow-up inherits the previous message\'s subject', follow.files.length >= 1 && follow.files[0].path === 'www/retry_queue.js', JSON.stringify(follow.files));
  const pathq = await G.prefetch('open ember_github.js and explain syncSlot', '');
  ok('a file name in the question wins on path', pathq.files[0] && pathq.files[0].path === 'www/ember_github.js', JSON.stringify(pathq.files));
  // big file: only the windows around the hit, not the whole file
  const big = Array.from({ length: 900 }, (_, i) => i === 640 ? 'function zorkBlatt() { return 42; }' : 'const filler' + i + ' = ' + i + ';').join('\n');
  const sn = G._t.rfSnippet(big, new Map([['zorkblatt', 1]]), 3000);
  ok('big file snippet keeps the hit line and its range, and stays under the cap', /zorkBlatt/.test(sn.text) && sn.text.length <= 3200 && /641|63\d|64\d/.test(sn.range), sn.range);
  const secret = await G.prefetch('show retryOn503', '');
  ok('prefetch never throws and always returns the same shape', Array.isArray(secret.files) && typeof secret.ms === 'number');
  const t0 = Date.now(); await G.prefetch('', ''); ok('empty message is a no-op', Date.now() - t0 < 200 && G.lastRead().files.length === 0);

  // ---------- runner stays in Advanced ----------
  G.setCfg({ runner: false });
  const sb2 = G.stateBlock({ preview: true });
  ok('runner OFF: the AI is not told about a runner at all', !/runner/i.test(sb2.replace(/no runner, no clone/gi, '')), sb2.match(/.{40}runner.{40}/i));
  G.setCfg({ runner: true }); ok('runner ON: mentioned', /runner/i.test(G.stateBlock({ preview: true }).replace(/no runner, no clone/gi, ''))); G.setCfg({ runner: false });

  // ---------- wiring ----------
  const app = W('app.js'), ui = W('ember_github_ui.js'), sw = W('sw.js'), pk = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
  ok('app.js reads first before Persona.respond', /GHr\.prefetch/.test(app) && app.indexOf('GHr.prefetch') < app.indexOf('const call = Persona.respond('));
  ok('prefetch failure can never block a reply (try/catch)', /reading first is a help, never a gate/.test(app));
  ok('UI: pin switch, replace confirm, no disabled Add when full', /sw\('pin:'/.test(ui) && /data-a=\"replaceok\"/.test(ui) && !/data-a=\"add\" style=\"width:auto;padding:0 16px\"' \+ \(full/.test(ui));
  ok('UI: runner lives in a folded Advanced block', /<details class=\"gh-sec gh-adv\"/.test(ui) && /Advanced <small>cloud runner/.test(ui));
  ok('UI: Home preview asks for the standing rules only', /stateBlock\(\{ preview: true \}\)/.test(ui));
  const idx = W('index.html'), v83 = W('ember_v83.js'), acc = W('ember_acc.js');
  ok('no GitHub pill in the message box', !/bGhPill/.test(idx) && !/bGhPill/.test(v83));
  ok('add-ons sheet is gone: no script, no file, no "More add-ons" row', !/ember_v81\.js/.test(idx) && !fs.existsSync(path.join(__dirname, '..', 'www', 'ember_v81.js')) && !/ember_v81\.js/.test(sw));
  ok('Settings says Music, not Add-ons', /title: 'Music', desc:/.test(acc) && !/Music & Add-ons/.test(acc) && !/Ember add-ons/.test(idx));
  ok('Media engines has its native place in Settings > Engine Keys', /id="bMediaEng"/.test(idx) && /bMediaEng/.test(v83) && !/Add-ons > Media engines/.test(W('ember_engines.js')));
  ok('one blue for every toggle and selection, loaded last', /ember_blue\.css/.test(idx) && idx.lastIndexOf('ember_blue.css') > idx.lastIndexOf('ember_acc.css') && /ember_blue\.css/.test(sw) && /\.sw\.on\{background:var\(--blue\)/.test(W('ember_blue.css')) && /gh-sw input:checked/.test(W('ember_blue.css')) && /\.stab\.on/.test(W('ember_blue.css')));
  ok('GitHub Home has the chat switch', /cfg\.chat/.test(ui));
  ok('service worker + package are V1.9.88', /ember-v1\.9\.(88|89)/.test(sw) && /"version": "1\.9\.(88|89)"/.test(pk) && /test:v1988/.test(pk));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
