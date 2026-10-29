// Real local-git integration plus mocked HTTP. No real tokens/network/GitHub writes.
'use strict';
const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const TOKEN = 'ghp_' + 'a'.repeat(36), BRAIN = 'fezzymultiverse/ember-brain';
let passed = 0;
function check(name, condition) { assert(condition, name); passed++; console.log('PASS ' + name); }
function core() {
  const saved = { ember_github: JSON.stringify({ token: TOKEN, cfg: { auto: false } }) }, calls = [];
  let truncated = false, badSubtree = false, denyBlob = false;
  const files = { 'README.md': 'Brain\nneedle line', 'vendor/deep/new.odd': 'new file needle\nsecond needle', '.env': 'needle private', 'binary.bin': 'needle\u0000data', 'big.dat': 'big', ...Object.fromEntries(Array.from({ length: 38 }, (_, i) => ['docs/' + i + '.txt', 'plain text'])) };
  const rows = () => Object.keys(files).map(p => ({ type: 'blob', path: p, sha: 'blob-' + p, size: p === 'big.dat' ? 9000000 : files[p].length }));
  const response = (status, json) => ({ ok: status < 300, status, headers: { get: () => '' }, text: async () => JSON.stringify(json) });
  const w = { console, TextEncoder, TextDecoder, AbortController, URL, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, navigator: {}, document: { readyState: 'complete', addEventListener() {}, getElementById: () => null }, addEventListener() {}, dispatchEvent() {}, CustomEvent: function() {}, localStorage: { getItem: k => saved[k] || null, setItem: (k,v) => { saved[k] = v; }, removeItem: k => delete saved[k] } };
  w.fetch = async (url, options) => {
    calls.push({ url, options }); const u = new URL(url), p = decodeURIComponent(u.pathname);
    if (p === '/repos/' + BRAIN) return response(200, { default_branch: 'main', private: true, permissions: { push: true } });
    if (p.includes('/git/trees/')) {
      if (u.searchParams.has('recursive')) return response(200, { sha: 'root-tree', truncated, tree: truncated ? [rows()[0]] : rows() });
      if (badSubtree) return response(403, { message: 'denied' });
      if (p.endsWith('/root-tree')) return response(200, { tree: [{ type: 'blob', path: 'README.md', sha: 'blob-README.md', size: 20 }, { type: 'tree', path: 'vendor', sha: 'vendor-tree' }] });
      if (p.endsWith('/vendor-tree')) return response(200, { tree: [{ type: 'blob', path: 'deep/new.odd', sha: 'blob-vendor/deep/new.odd', size: 35 }] });
    }
    if (p.includes('/git/blobs/')) {
      if (denyBlob) return response(403, { message: 'rate limit test' });
      const name = p.split('/git/blobs/blob-')[1]; return response(200, { encoding: 'base64', content: Buffer.from(files[name]).toString('base64') });
    }
    if (p === '/search/repositories') return response(200, { total_count: 1, items: [{ full_name: 'someone/repo', description: '<script>bad</script>', html_url: 'https://github.com/someone/repo' }] });
    if (p === '/user/repos') return response(200, [{ full_name: 'me/output', permissions: { push: true }, private: true }]);
    if (p === '/repos/me/output/actions/workflows/ember-repo-sync.yml/dispatches') return response(204, null);
    return response(404, {});
  };
  w.window = w; vm.runInNewContext(read('www/ember_github.js'), w); vm.runInNewContext(read('www/ember_repo_runner.js'), w);
  return { w, g: w.EmberGithub, runner: w.EmberRepoRunner, saved, calls, files, mode: o => { truncated = !!o.truncated; badSubtree = !!o.badSubtree; denyBlob = !!o.denyBlob; } };
}
function run(file, args, cwd, extra) { const r = spawnSync(file, args, { cwd, encoding: 'utf8', ...extra }); assert.equal(r.status, 0, r.stderr); return r.stdout || ''; }
async function integration() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-local-test-')), oldPath = process.env.PATH, oldToken = process.env.GH_TOKEN, oldFetch = global.fetch;
  const realGit = run('which', ['git']).trim(), git = (dir, ...args) => run(realGit, args, dir);
  const bare = {}, work = {};
  try {
    for (const name of ['brain', 'addon', 'output']) {
      bare[name] = path.join(tmp, name + '.git'); work[name] = path.join(tmp, name);
      git(tmp, 'init', '--bare', '--initial-branch=main', bare[name]); git(tmp, 'clone', bare[name], work[name]);
      git(work[name], 'config', 'user.email', 'test@example.invalid'); git(work[name], 'config', 'user.name', 'Test');
      fs.writeFileSync(path.join(work[name], 'README.md'), name + ' original');
      if (name === 'brain') { fs.writeFileSync(path.join(work[name], '.gitignore'), 'forced.dat\n'); fs.writeFileSync(path.join(work[name], 'forced.dat'), 'tracked despite ignore'); fs.writeFileSync(path.join(work[name], 'remove.txt'), 'delete later'); fs.writeFileSync(path.join(work[name], 'package.json'), '{"scripts":{"postinstall":"touch SHOULD_NOT_EXECUTE"}}'); }
      git(work[name], 'add', '--force', '.'); git(work[name], 'commit', '-m', 'initial'); git(work[name], 'push', 'origin', 'main');
    }
    const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
    // Shim only translates fixed github URLs to local bare repos. Git itself remains real.
    const gitShim = '#!/usr/bin/env node\nconst cp=require("node:child_process");const m=' + JSON.stringify({ 'https://github.com/owner/brain.git': bare.brain, 'https://github.com/owner/addon.git': bare.addon, 'https://github.com/me/output.git': bare.output }) + ';const args=process.argv.slice(2).map(a=>m[a]||a);const r=cp.spawnSync(' + JSON.stringify(realGit) + ',args,{stdio:"inherit",env:process.env});process.exit(r.status===null?1:r.status);\n';
    fs.writeFileSync(path.join(bin, 'git'), gitShim, { mode: 0o700 });
    fs.writeFileSync(path.join(bin, 'gh'), '#!/usr/bin/env node\nlet s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{if(!s.startsWith("ghp_"))process.exitCode=1;});\n', { mode: 0o700 });
    process.env.PATH = bin + ':' + oldPath; process.env.GH_TOKEN = TOKEN;
    const requests = []; global.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, json: async () => url.includes('/dispatches') ? null : { default_branch: 'main', private: true, permissions: { push: true } } }; };
    const runner = require('../www/repo-runner-template.cjs'), c = { schema: 1, target: 'me/output', brain: 'owner/brain', branch: '', sources: [{ repo: 'owner/brain' }, { repo: 'owner/addon' }], buildWorkflow: 'build.yml', autoBuild: true, autoSync: false };
    let result = await runner.sync(c, true);
    check('install clones whole sources, commits and pushes with real local git', result.changed && result.sources.length === 2);
    const verify = path.join(tmp, 'verify'); git(tmp, 'clone', bare.output, verify);
    check('original app code survives runner installation', fs.readFileSync(path.join(verify, 'README.md'), 'utf8') === 'output original');
    check('brain and addon snapshots are separately included', fs.existsSync(path.join(verify, 'external/fezzy-super-brain/README.md')) && fs.existsSync(path.join(verify, 'external/repos/owner/addon/README.md')));
    check('forced tracked files remain included despite upstream gitignore', fs.existsSync(path.join(verify, 'external/fezzy-super-brain/forced.dat')));
    check('source package hooks are never executed', !fs.existsSync(path.join(verify, 'external/fezzy-super-brain/SHOULD_NOT_EXECUTE')));
    check('managed script, workflow and configuration are committed', ['scripts/ember-repo-runner.cjs', '.github/workflows/ember-repo-sync.yml', 'ember-repos.json'].every(p => fs.existsSync(path.join(verify, p))));
    check('build is actually dispatched after committing the sources', requests.some(x => x.url.endsWith('/build.yml/dispatches')));
    check('no token in generated configs, source scripts or git remote URL', !['scripts/ember-repo-runner.cjs', 'ember-repos.json', '.github/workflows/ember-repo-sync.yml'].some(p => fs.readFileSync(path.join(verify, p), 'utf8').includes(TOKEN)) && !git(verify, 'remote', '-v').includes(TOKEN));
    result = await runner.sync(c); check('unchanged sync is a no-op with no new commit/build', !result.changed);
    fs.unlinkSync(path.join(work.brain, 'remove.txt')); fs.writeFileSync(path.join(work.brain, 'new.data'), 'new entire brain file'); git(work.brain, 'add', '-A'); git(work.brain, 'commit', '-m', 'upstream changes'); git(work.brain, 'push', 'origin', 'main');
    result = await runner.sync(c); git(verify, 'pull', '--ff-only');
    check('later upstream additions and removals sync without file selection', result.changed && fs.existsSync(path.join(verify, 'external/fezzy-super-brain/new.data')) && !fs.existsSync(path.join(verify, 'external/fezzy-super-brain/remove.txt')));
    result = await runner.sync({ ...c, sources: [{ repo: 'owner/brain' }] }); git(verify, 'pull', '--ff-only');
    check('removed source only deletes its runner-owned snapshot', result.changed && !fs.existsSync(path.join(verify, 'external/repos/owner/addon')) && fs.readFileSync(path.join(verify, 'README.md'), 'utf8') === 'output original');
    process.env.EMBER_EVENT = 'schedule'; result = await runner.sync(c); delete process.env.EMBER_EVENT;
    check('scheduled sync is opt-in', result.skipped);
    assert.throws(() => runner.validate({ ...c, target: 'owner/brain' })); passed++; console.log('PASS source/output identity collision rejected');
    fs.symlinkSync('../README.md', path.join(work.brain, 'bad-link')); git(work.brain, 'add', 'bad-link'); git(work.brain, 'commit', '-m', 'symlink'); git(work.brain, 'push', 'origin', 'main');
    await assert.rejects(() => runner.sync(c), /Symlink/); passed++; console.log('PASS symlink source fails closed without pushing partial data');
  } finally { process.env.PATH = oldPath; if (oldToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = oldToken; global.fetch = oldFetch; fs.rmSync(tmp, { recursive: true, force: true }); }
}
(async () => {
  const t = core(), g = t.g;
  check('whole-repo grep is exposed to Ember without runner enablement', g.toolsFor().some(x => x.name === 'github_grep'));
  let r = await g.dispatch('github_grep', { query: 'needle' });
  check('grep resumably scans more than a single batch', r.ok && !r.complete && r.cursor);
  const hits = [...r.hits]; while (r.cursor) { r = await g.dispatch('github_grep', { query: 'needle', cursor: r.cursor }); assert(r.ok); hits.push(...r.hits); }
  check('grep finds unranked vendor/new-extension text files with line evidence', hits.some(h => h.path === 'vendor/deep/new.odd' && h.matches[0].line === 1));
  check('grep discloses binary/protected/oversized coverage exclusions', r.complete && !r.coverage_complete && r.skipped.protected === 1 && r.skipped.binary === 1 && r.skipped.too_large === 1);
  t.mode({ truncated: true }); r = await g.dispatch('github_find', { query: '*.odd' });
  check('truncated recursive tree is fully expanded through subtrees', r.ok && r.paths.some(x => x.path === 'vendor/deep/new.odd') && !r.partial_index);
  t.mode({ truncated: true, badSubtree: true }); r = await g.dispatch('github_find', { query: '*.odd' }); check('failed subtree traversal cannot claim absence', !r.ok);
  t.mode({ denyBlob: true }); r = await g.dispatch('github_grep', { query: 'needle' }); check('blob read failure preserves a retry cursor and never reports complete', !r.ok && r.cursor && !r.complete);
  t.mode({}); r = await g.dispatch('github_grep', { query: 'changed', cursor: r.cursor }); check('cursor query cannot be silently changed', !r.ok);
  r = await g.managerRequest('/repos/other/unapproved'); check('repository manager rejects unconfigured repos', !r.ok);
  r = await g.dispatch('github_search_repos', { query: 'brain' }); check('repository discovery is read-only and works', r.ok && r.repositories[0].repo === 'someone/repo');
  r = await g.dispatch('github_add_source', { repo: 'owner/addon' }); check('model cannot import repos without explicit user intent', !r.ok);
  g.setIntent('add owner/addon repo'); r = await g.dispatch('github_add_source', { repo: 'owner/addon' }); check('explicit request adds a whole source without altering brain', r.ok && g.knowledgeRepo() === BRAIN && t.runner.config().sources.length === 2);
  t.runner.save({ target: 'me/output' }); r = await g.managerRequest('/repos/' + BRAIN + '/contents/file', { method: 'PUT', body: {} }); check('repo-manager writes cannot touch the brain', !r.ok);
  r = await g.dispatch('github_output_repos'); check('token-accessible output repository discovery works', r.ok && r.repositories[0].can_push);
  check('runner state contains no token', !g.stateBlock().includes(TOKEN));
  await integration(); console.log('\n' + passed + ' repo-runner/whole-brain checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
