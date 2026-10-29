#!/usr/bin/env node
/* Ember Repo Runner 1.9.92. Node 20+, git; gh CLI for one-time secret installation.
 * No source package scripts are executed. Whole tracked snapshots, isolated under external/.
 * Token: GH_TOKEN environment only. Never put it into this file or Git remote URLs.
 * Run: node ember-repo-runner.cjs install | sync | search words | status
 */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const EMBEDDED_CONFIG = /*EMBER_CONFIG*/null;
const CONFIG_FILE = 'ember-repos.json', LOCK_FILE = 'ember-repos.lock.json', SCRIPT_FILE = 'scripts/ember-repo-runner.cjs', WORKFLOW_FILE = '.github/workflows/ember-repo-sync.yml';
const WORKFLOW = `# ember-repo-sync v1.9.92
name: Ember Repo Sync
on:
  workflow_dispatch: {}
  schedule:
    - cron: '*/15 * * * *'
permissions:
  contents: read
concurrency:
  group: ember-repo-sync
  cancel-in-progress: false
jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Clone whole sources, update snapshots, push and build
        env:
          GH_TOKEN: \${{ secrets.EMBER_REPO_TOKEN }}
          EMBER_EVENT: \${{ github.event_name }}
        run: node scripts/ember-repo-runner.cjs sync
`;
function fail(message) { throw new Error(message); }
function repo(value) { if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,38}\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/.test(value || '') || value.endsWith('/.git')) fail('Use owner/repository, without credentials or a URL.'); return value; }
function destination(source, brain) { return source.toLowerCase() === brain.toLowerCase() ? 'external/fezzy-super-brain' : 'external/repos/' + repo(source); }
function validate(c) {
  if (!c || c.schema !== 1) fail('Unsupported runner configuration.');
  const allowed = new Set(['schema', 'target', 'brain', 'branch', 'sources', 'buildWorkflow', 'autoBuild', 'autoSync']);
  if (Object.keys(c).some(k => !allowed.has(k))) fail('Unexpected configuration field. Credentials must be in GH_TOKEN, never in the manifest.');
  repo(c.target); repo(c.brain);
  if (c.branch && !/^[A-Za-z0-9_-][A-Za-z0-9._/-]{0,99}$/.test(c.branch) || (c.branch || '').includes('..')) fail('Invalid output branch.');
  if (c.buildWorkflow && !/^[A-Za-z0-9_.-]+\.ya?ml$/.test(c.buildWorkflow)) fail('Invalid build workflow filename.');
  if (!Array.isArray(c.sources) || !c.sources.length || c.sources.length > 100) fail('Runner needs 1–100 sources.');
  const seen = new Set();
  c.sources.forEach(s => { if (Object.keys(s).some(k => k !== 'repo')) fail('Sources accept only a repository name, never credentials or paths.'); repo(s.repo); if (s.repo.toLowerCase() === c.target.toLowerCase() && s.repo.toLowerCase() !== c.brain.toLowerCase()) fail('Output repo cannot also be a source (only the brain may be both).'); if (seen.has(s.repo.toLowerCase())) fail('Duplicate source.'); seen.add(s.repo.toLowerCase()); });
  if (!seen.has(c.brain.toLowerCase())) fail('The entire brain must remain a source.');
  return c;
}
const token = () => process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
function scrub(s) { const t = token(); return String(s || '').split(t || '\0').join('[token]').replace(/\b(?:ghp|github_pat|gho|ghs)_[A-Za-z0-9_]+/g, '[token]'); }
function exec(file, args, options = {}) {
  const r = spawnSync(file, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (r.error || r.status !== 0) fail(file + ' failed: ' + scrub(r.error ? r.error.message : r.stderr).slice(-1800));
  return r.stdout || '';
}
async function api(endpoint, method = 'GET', body) {
  if (!token()) fail('Set GH_TOKEN to a token with access to the sources and Contents/Workflows/Actions/Secrets write access on the output repo.');
  const r = await fetch('https://api.github.com' + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) fail('GitHub HTTP ' + r.status + ': ' + scrub(j && j.message));
  return j;
}
function configuration() {
  // Freshly exported feature settings take precedence over an older output manifest.
  // The installed Actions script has no embedded config and reads the checked-out manifest.
  if (EMBEDDED_CONFIG) return validate(EMBEDDED_CONFIG);
  if (fs.existsSync(CONFIG_FILE)) return validate(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
  fail('No runner configuration. Export the feature from Ember or run in the configured output repo.');
}
function gitSession(temp) {
  const helper = path.join(temp, 'askpass.cjs');
  fs.writeFileSync(helper, '#!/usr/bin/env node\nprocess.stdout.write(/username/i.test(process.argv[2]||"")?"x-access-token":(process.env.GH_TOKEN||process.env.GITHUB_TOKEN||""));\n', { mode: 0o700 });
  const env = { ...process.env, GIT_ASKPASS: helper, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' };
  return (cwd, ...args) => exec('git', ['-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env });
}
function verifySnapshot(git, dir) {
  const entries = git(dir, 'ls-tree', '-rz', '--full-tree', 'HEAD').split('\0').filter(Boolean);
  for (const e of entries) {
    const mode = e.slice(0, 6), name = e.slice(e.indexOf('\t') + 1);
    if (mode === '160000') fail('Submodule found at ' + name + '. Add its repository separately; no partial snapshot will be pushed.');
    if (mode === '120000') fail('Symlink found at ' + name + '. This runner fails closed rather than copying unsafe links.');
    if (name.split('/').some(p => p === '..' || p.toLowerCase() === '.git') || path.isAbsolute(name) || name.includes('\\')) fail('Unsafe tracked path: ' + name);
  }
}
function readLock(dir, brain) {
  const p = path.join(dir, LOCK_FILE); if (!fs.existsSync(p)) return { schema: 1, sources: [] };
  const o = JSON.parse(fs.readFileSync(p, 'utf8')); if (o.schema !== 1 || !Array.isArray(o.sources)) fail('Invalid managed-path receipt.');
  const paths = new Set();
  o.sources.forEach(s => { repo(s.repo); if (s.path !== destination(s.repo, brain) || paths.has(s.path)) fail('Invalid managed path in receipt; refusing deletion.'); paths.add(s.path); });
  return o;
}
function assertParents(dir, relative) {
  const bits = relative.split('/'); let current = dir;
  for (const bit of bits) { current = path.join(current, bit); if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail('Refusing symlink destination: ' + relative); }
}
async function sync(c, install = false) {
  validate(c);
  if (!install && process.env.EMBER_EVENT === 'schedule' && !c.autoSync) { console.log('Automatic repo sync is disabled in ember-repos.json.'); return { skipped: true }; }
  if (!token()) fail('GH_TOKEN is missing. For Actions, run install to provision the encrypted EMBER_REPO_TOKEN secret.');
  const meta = await api('/repos/' + repo(c.target));
  if (!(meta.permissions && meta.permissions.push)) fail('Token cannot push to configured output repo.');
  for (const source of c.sources) {
    const info = await api('/repos/' + repo(source.repo));
    if (!meta.private && info.private) fail('Private source ' + source.repo + ' cannot be copied to a public output repo. Choose a private output.');
  }
  if (c.autoBuild) {
    // Fail before mutation when the selected build workflow does not exist.
    await api('/repos/' + c.target + '/actions/workflows/' + encodeURIComponent(c.buildWorkflow || 'build.yml'));
  }
  const branch = c.branch || meta.default_branch;
  if (install && branch !== meta.default_branch) fail('Install on the default branch so GitHub registers workflow_dispatch. Select the default branch or leave branch blank.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-repo-')), git = gitSession(tmp), output = path.join(tmp, 'output');
  try {
    git(tmp, 'clone', '--depth=1', '--branch', branch, 'https://github.com/' + c.target + '.git', output);
    assertParents(output, LOCK_FILE); assertParents(output, CONFIG_FILE);
    if (!install && process.env.EMBER_EVENT) {
      const latest = JSON.parse(fs.readFileSync(path.join(output, CONFIG_FILE), 'utf8'));
      if (JSON.stringify(latest) !== JSON.stringify(c)) fail('Runner configuration changed after this job started. Re-run the latest workflow; stale settings were not pushed.');
    }
    const old = readLock(output, c.brain), locks = [];
    const copySources = c.sources.filter(s => s.repo.toLowerCase() !== c.target.toLowerCase()); // brain == output: it is already here, never copy it into itself
    const previousPaths = old.sources.map(s => s.path), currentPaths = copySources.map(s => destination(s.repo, c.brain));
    if (new Set(currentPaths).size !== currentPaths.length) fail('Sources map to overlapping destinations.');
    for (let i = 0; i < copySources.length; i++) {
      const source = copySources[i], rel = destination(source.repo, c.brain), dest = path.join(output, rel);
      assertParents(output, rel);
      if (fs.existsSync(dest) && !previousPaths.includes(rel)) fail('Destination already exists and is not runner-owned: ' + rel);
      const clone = path.join(tmp, 'source-' + i);
      console.log('Cloning entire source ' + source.repo);
      git(tmp, 'clone', '--depth=1', '--no-checkout', 'https://github.com/' + source.repo + '.git', clone);
      verifySnapshot(git, clone); git(clone, 'checkout', '--detach', 'HEAD');
      const sha = git(clone, 'rev-parse', 'HEAD').trim();
      fs.rmSync(path.join(clone, '.git'), { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(clone, dest, { recursive: true, dereference: false, errorOnExist: true });
      locks.push({ repo: source.repo, path: rel, sha });
    }
    for (const s of old.sources) if (!currentPaths.includes(s.path)) { assertParents(output, s.path); fs.rmSync(path.join(output, s.path), { recursive: true, force: true }); }
    // Only managed paths are staged; no git add -A over the app.
    assertParents(output, CONFIG_FILE); assertParents(output, LOCK_FILE);
    fs.writeFileSync(path.join(output, CONFIG_FILE), JSON.stringify(c, null, 2) + '\n');
    fs.writeFileSync(path.join(output, LOCK_FILE), JSON.stringify({ schema: 1, sources: locks }, null, 2) + '\n');
    const stage = [CONFIG_FILE, LOCK_FILE, ...new Set([...previousPaths, ...currentPaths])];
    if (install) {
      // gh encrypts the token into a repository Actions secret, reading it from stdin.
      exec('gh', ['secret', 'set', 'EMBER_REPO_TOKEN', '--repo', c.target], { input: token(), env: { ...process.env, GH_TOKEN: token() } });
      for (const rel of [SCRIPT_FILE, WORKFLOW_FILE]) assertParents(output, rel);
      fs.mkdirSync(path.join(output, 'scripts'), { recursive: true }); fs.mkdirSync(path.join(output, '.github/workflows'), { recursive: true });
      fs.writeFileSync(path.join(output, SCRIPT_FILE), fs.readFileSync(__filename, 'utf8').replace(/const EMBEDDED_CONFIG = \/\*EMBER_CONFIG\*\/[\s\S]*?;\n/, 'const EMBEDDED_CONFIG = /*EMBER_CONFIG*/null;\n'));
      fs.writeFileSync(path.join(output, WORKFLOW_FILE), WORKFLOW); stage.push(SCRIPT_FILE, WORKFLOW_FILE);
    }
    const tracked = new Set(git(output, 'ls-files', '-z').split('\0'));
    const validStage = stage.filter(p => fs.existsSync(path.join(output, p)) || [...tracked].some(f => f === p || f.startsWith(p + '/')));
    git(output, 'add', '--force', '--all', '--', ...validStage);
    const changed = !!git(output, 'diff', '--cached', '--name-only').trim();
    if (changed) {
      git(output, '-c', 'user.name=Ember Repo Runner', '-c', 'user.email=ember@users.noreply.github.com', 'commit', '-m', install ? 'Install Ember Repo Runner and whole-repo brain snapshots' : 'Sync whole-repo brain and dependency snapshots');
      git(output, 'push', 'origin', 'HEAD:refs/heads/' + branch); // Fast-forward only. Never force or reset user code.
    }
    console.log(changed ? 'Pushed snapshots to ' + c.target + ':' + branch : 'All whole-repo snapshots are already current.');
    if (c.autoBuild && (changed || install)) {
      const wf = c.buildWorkflow || 'build.yml';
      await api('/repos/' + c.target + '/actions/workflows/' + encodeURIComponent(wf) + '/dispatches', 'POST', { ref: branch });
      console.log('Build dispatched: https://github.com/' + c.target + '/actions/workflows/' + wf);
    }
    return { changed, sources: locks, branch };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
async function main(args) {
  const command = args[0] || 'status';
  if (command === 'search') {
    const query = args.slice(1).join(' ').trim(); if (!query) fail('Supply search words.');
    const r = await api('/search/repositories?per_page=30&q=' + encodeURIComponent(query));
    console.log(JSON.stringify({ total: r.total_count, repositories: (r.items || []).map(x => ({ repo: x.full_name, description: x.description, license: x.license && x.license.spdx_id })) }, null, 2)); return;
  }
  const c = configuration();
  if (command === 'status') { console.log(JSON.stringify({ ...c, token: token() ? 'environment token set' : 'missing' }, null, 2)); return; }
  if (!['install', 'sync'].includes(command)) fail('Use install, sync, search or status.');
  await sync(c, command === 'install');
}
module.exports = { validate, destination, WORKFLOW, sync, main, readLock, verifySnapshot };
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(scrub(e.message)); process.exitCode = 1; });
