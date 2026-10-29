// Ember 1.9.92: Features > Repo Runner. Whole repo snapshots, separate brain/output.
'use strict';
(() => {
const G = window.EmberGithub; if (!G) return;
const KEY = 'ember_repo_runner', $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = G._clean.cleanRepo;
let intent = '', templatePromise, operation = false, uiBusy = false;
let discovery = { kind: 'search', query: '', page: 1, more: false };
function changed() { try { window.dispatchEvent(new CustomEvent('ember-repo-config', { detail: { brain: G.knowledgeRepo() } })); } catch (_) {} }
function config() {
  let c; try { c = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { c = {}; }
  c = c && typeof c === 'object' ? c : {}; const brain = G.knowledgeRepo();
  const sources = [{ repo: brain }];
  (Array.isArray(c.sources) ? c.sources : []).forEach(x => { const r = clean(x && x.repo); if (r && !sources.some(s => s.repo.toLowerCase() === r.toLowerCase())) sources.push({ repo: r }); });
  return { schema: 1, brain, target: clean(c.target), branch: String(c.branch || ''), sources, buildWorkflow: c.buildWorkflow || 'build.yml', autoBuild: c.autoBuild !== false, autoSync: !!c.autoSync };
}
function save(patch) {
  const c = Object.assign(config(), patch || {});
  c.target = clean(c.target); c.brain = G.knowledgeRepo();
  c.sources = [{ repo: c.brain }].concat((Array.isArray(c.sources) ? c.sources : []).map(x => ({ repo: clean(x && x.repo) })).filter(x => x.repo && x.repo.toLowerCase() !== c.brain.toLowerCase()));
  c.sources = c.sources.filter((x, i, a) => a.findIndex(y => y.repo.toLowerCase() === x.repo.toLowerCase()) === i);
  if (c.sources.length > 100) throw new Error('At most 100 whole repositories per runner.');
  if (c.target && !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(c.target)) throw new Error('Output repo must be owner/name.');
  if (c.sources.some(s => s.repo.toLowerCase() === c.target.toLowerCase() && s.repo.toLowerCase() !== c.brain.toLowerCase())) throw new Error('The output repo must be different from the imported sources (it may be the brain itself).');
  if (!/^[A-Za-z0-9_.-]+\.ya?ml$/.test(c.buildWorkflow)) throw new Error('Build workflow must be a filename such as build.yml.');
  if (c.branch && (!/^[A-Za-z0-9_-][A-Za-z0-9._/-]{0,99}$/.test(c.branch) || c.branch.includes('..'))) throw new Error('Invalid output branch.');
  localStorage.setItem(KEY, JSON.stringify(c)); changed(); return c;
}
function applyBrain(value) {
  const next = clean(value), previous = G.knowledgeRepo(), c = config();
  if (!next) return { ok: false, error: 'Use a GitHub owner/repository or repository URL.' };
  const result = G.setKnowledgeRepo(next);
  if (result.ok) {
    try {
      save({ sources: [{ repo: next }].concat(c.sources.filter(x => ![previous.toLowerCase(), next.toLowerCase()].includes(x.repo.toLowerCase()))) });
    } catch (e) { G.setKnowledgeRepo(previous); return { ok: false, error: e.message }; }
    if ($('ghBrainRepo')) $('ghBrainRepo').value = next;
    paintSources();
  }
  return result;
}
function setTarget(value) {
  const target = clean(value); if (!target) throw new Error('Use owner/repo or a GitHub URL for your Ember output.');
  const c = save({ target }); if ($('rrTarget')) $('rrTarget').value = c.target; paintSources(); return c;
}
async function request(path, options) { const r = await G.managerRequest(path, options); if (!r.ok) throw new Error(r.error || 'GitHub request failed.'); return r.json; }
async function search(a) {
  const query = String(a.query || '').trim().slice(0, 200); if (!query) return { ok: false, error: 'Search words are required.' };
  const page = Math.max(1, Math.min(34, Number(a.page) || 1));
  const r = await request('/search/repositories?per_page=30&page=' + page + '&q=' + encodeURIComponent(query));
  return { ok: true, total: r.total_count, partial: !!r.incomplete_results, page, repositories: (r.items || []).map(x => ({ repo: x.full_name, description: x.description || '', url: x.html_url, can_push: !!(x.permissions && x.permissions.push), private: !!x.private, license: x.license && x.license.spdx_id || 'not specified' })) };
}
async function owned(a) {
  const page = Math.max(1, Number(a.page) || 1), rows = await request('/user/repos?per_page=100&sort=updated&page=' + page);
  return { ok: true, page, more: rows.length === 100, repositories: rows.map(x => ({ repo: x.full_name, can_push: !!(x.permissions && x.permissions.push), private: !!x.private })) };
}
function addSource(repo) {
  const r = clean(repo); if (!r) throw new Error('Use a GitHub owner/repository or repository URL.');
  const c = config(); if (!c.sources.some(s => s.repo.toLowerCase() === r.toLowerCase())) c.sources.push({ repo: r });
  if (c.sources.length > 100) throw new Error('At most 100 whole repositories per runner.');
  save({ sources: c.sources }); paintSources(); return { ok: true, action: 'added whole repository', repo: r };
}
async function template() {
  if (!templatePromise) templatePromise = fetch('repo-runner-template.cjs', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Bundled runner template did not load.'); return r.text(); }).catch(e => { templatePromise = null; throw e; });
  return templatePromise;
}
async function feature() {
  const c = save({}); if (!c.target) throw new Error('Set your existing output/build repo first.');
  const source = await template();
  if (!source.includes('/*EMBER_CONFIG*/null')) throw new Error('Runner template failed validation.');
  return { type: 'code', language: 'javascript', title: 'ember-repo-runner.cjs', content: source.replace('/*EMBER_CONFIG*/null', '/*EMBER_CONFIG*/' + JSON.stringify(c)) };
}
async function addToOutput() {
  const a = await feature();
  if (window.EmberArtifacts) window.EmberArtifacts.view(a);
  return a;
}
async function install() {
  if (operation) throw new Error('A runner operation is already in progress.'); operation = true;
  try {
    const c = save({}); if (!c.target) throw new Error('Set the existing output repo first.');
    const base = '/repos/' + c.target, m = await request(base), branch = c.branch || m.default_branch;
    if (!m.permissions || !m.permissions.push) throw new Error('Your saved token cannot push to the output repo.');
    if (branch !== m.default_branch) throw new Error('Install on the default branch so GitHub can register the workflow.');
    for (const s of c.sources) {
      const info = await request('/repos/' + s.repo);
      if (!m.private && info.private) throw new Error('Private sources cannot be copied into a public output repo. Choose a private output.');
    }
    if (c.autoBuild) await request(base + '/actions/workflows/' + encodeURIComponent(c.buildWorkflow));
    // This sets an encrypted GitHub Actions secret. The token never enters generated code/model text.
    await loadSodium();
    const secret = await G.provisionRunnerSecret(); if (!secret.ok) throw new Error(secret.error);
    const source = await template(), workflowMatch = source.match(/const WORKFLOW = `([\s\S]*?)`;/);
    if (!workflowMatch) throw new Error('Bundled workflow template is missing.');
    const workflow = workflowMatch[1].replace(/\\\$\{/g, '${');
    const ref = await request(base + '/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'));
    const commit = await request(base + '/git/commits/' + ref.object.sha);
    const files = [{ path: 'scripts/ember-repo-runner.cjs', content: source }, { path: 'ember-repos.json', content: JSON.stringify(c, null, 2) + '\n' }, { path: '.github/workflows/ember-repo-sync.yml', content: workflow }];
    const tree = await request(base + '/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) } });
    const next = await request(base + '/git/commits', { method: 'POST', body: { message: 'Install Ember whole-repository sync runner', tree: tree.sha, parents: [ref.object.sha] } });
    await request(base + '/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), { method: 'PATCH', body: { sha: next.sha, force: false } });
    let dispatchError = '';
    // GitHub may take a moment to register a newly committed workflow.
    for (let i = 0; i < 5; i++) {
      try { await request(base + '/actions/workflows/ember-repo-sync.yml/dispatches', { method: 'POST', body: { ref: branch } }); dispatchError = ''; break; }
      catch (e) { dispatchError = e.message; if (i < 4) await new Promise(r => setTimeout(r, 2000)); }
    }
    if (!dispatchError) { try { window.dispatchEvent(new CustomEvent('ember-repo-runner-dispatched', { detail: { repo: c.target, branch, workflow: 'ember-repo-sync.yml', since: Date.now() - 30000 } })); } catch (_) { /* independent terminal */ } }
    return { ok: !dispatchError, installed: true, repo: c.target, commit: next.sha, dispatched: !dispatchError, error: dispatchError || undefined, url: 'https://github.com/' + c.target + '/actions/workflows/ember-repo-sync.yml', note: 'Runner installed. Cloning/pushing/building happens on GitHub Actions; check run status before claiming success. Source files stay under external/, not mixed into app code.' };
  } finally { operation = false; }
}
async function sync() {
  if (operation) throw new Error('A runner operation is already in progress.'); operation = true;
  try { return await syncConfigured(); } finally { operation = false; }
}
async function syncConfigured() {
  const started = Date.now();
  const c = save({}); if (!c.target) throw new Error('Set the output repo.');
  const branch = c.branch || (await request('/repos/' + c.target)).default_branch;
  const manifest = await request('/repos/' + c.target + '/contents/ember-repos.json?ref=' + encodeURIComponent(branch));
  if (!manifest || !manifest.content) throw new Error('Runner manifest is missing. Install/update the runner first.');
  const binary = atob(manifest.content.replace(/\s/g, '')), bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  const remote = JSON.parse(new TextDecoder().decode(bytes));
  if (JSON.stringify(remote) !== JSON.stringify(c)) throw new Error('Source or build settings changed. Use Install / update first to publish the new whole-repo manifest.');
  await request('/repos/' + c.target + '/actions/workflows/ember-repo-sync.yml/dispatches', { method: 'POST', body: { ref: branch } });
  try { window.dispatchEvent(new CustomEvent('ember-repo-runner-dispatched', { detail: { repo: c.target, branch, workflow: 'ember-repo-sync.yml', since: started } })); } catch (_) { /* independent terminal */ }
  return { ok: true, dispatched: true, repo: c.target, url: 'https://github.com/' + c.target + '/actions/workflows/ember-repo-sync.yml', note: 'Runs using the manifest already committed in the output repo. After changing source configuration, install/update again first.' };
}
async function status() {
  const c = config(); if (!c.target) return { ok: false, error: 'Set your output repo.' };
  const r = await request('/repos/' + c.target + '/actions/workflows/ember-repo-sync.yml/runs?per_page=5');
  return { ok: true, repo: c.target, runs: (r.workflow_runs || []).map(x => ({ id: x.id, status: x.status, conclusion: x.conclusion, url: x.html_url })) };
}
function loadScript(src) { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => { s.remove(); reject(new Error('Bundled encryption library could not load.')); }; document.head.appendChild(s); }); }
let sodiumPromise;
function loadSodium() { if (!sodiumPromise) sodiumPromise = (async () => { if (!window.sodium) { await loadScript('vendor/libsodium-0.7.15.js'); await loadScript('vendor/libsodium-wrappers-0.7.15.js'); } await window.sodium.ready; })().catch(e => { sodiumPromise = null; throw e; }); return sodiumPromise; }
const tools = [
  { name: 'github_search_repos', description: 'Discover repositories on GitHub. Read-only. Returns repo names and licenses; never automatically installs or executes found code.', parameters: { query: 'string', page: 'number?' } },
  { name: 'github_output_repos', description: 'List repositories accessible with the saved token for choosing an output target. Read-only.', parameters: { page: 'number?' } },
  { name: 'github_add_source', description: 'Add a whole repo to the runner manifest only when user asks. Never selects individual files. Brain is always included. Does not push yet.', parameters: { repo: 'string' } },
  { name: 'github_repo_runner_status', description: 'Read recent clone/sync/push runner status on the explicitly configured output repo.', parameters: {} },
  { name: 'github_repo_runner_sync', description: 'Dispatch the installed whole-repo sync/push runner ONLY on explicit user request. Target is fixed in Features > Repo Runner. Changing sources requires user installing/updating first.', parameters: {} }
];
const oldTools = G.toolsFor, oldDispatch = G.dispatch, oldIntent = G.setIntent, oldState = G.stateBlock;
G.toolsFor = function() { return oldTools().concat(G.on() ? tools : []); };
G.setIntent = function(a, b) { intent = String(a || ''); return oldIntent(a, b); };
G.dispatch = async function(name, args) {
  if (!tools.some(t => t.name === name)) return oldDispatch(name, args);
  try {
    const a = args || {};
    if (!G.on()) return { ok: false, error: 'Save your GitHub token first.' };
    if (name === 'github_search_repos') return await search(a);
    if (name === 'github_output_repos') return await owned(a);
    if (name === 'github_repo_runner_status') return await status();
    if (/\b(?:do not|don't|never)\b/i.test(intent) || !/\b(?:add|import|sync|push|clone|install|update|refresh)\b/i.test(intent)) return { ok: false, error: 'Explicit user request to add/sync repos is required.' };
    if (name === 'github_add_source') return addSource(a.repo);
    if (name === 'github_repo_runner_sync') return await sync();
  } catch (e) { return { ok: false, error: e.message }; }
};
G.stateBlock = function(o) { const c = config(); return oldState(o) + '\nREPO RUNNER: Features > Repo Runner can discover/import whole repos. The brain remains ' + c.brain + '; it is NOT the build output repo. Output target: ' + (c.target || 'not configured') + '. Never change the brain to redirect a build. Whole sources: ' + c.sources.map(s => s.repo).join(', ') + '. Search is read-only. Pushes/dispatches require user request. Never claim a dispatched workflow has completed.'; };
function paintSources() {
  if (!$('rrSources')) return;
  const c = config();
  $('rrSources').innerHTML = c.sources.map(s => '<article class="rr-repo-card"><div class="rr-role">' + (s.repo.toLowerCase() === c.brain.toLowerCase() ? 'SUPER BRAIN · LIVE KNOWLEDGE' : 'WHOLE SOURCE · STAGED') + '</div><b>' + esc(s.repo) + '</b><small>' + (s.repo.toLowerCase() === c.brain.toLowerCase() ? 'Entire repository · always included · no file selection' : 'Copied as an isolated source snapshot when you install and sync') + '</small>' + (s.repo.toLowerCase() !== c.brain.toLowerCase() ? '<div class="rr-card-actions"><button class="btn g" data-rr-remove="' + esc(s.repo) + '">Remove source</button><button class="btn g" data-rr-brain="' + esc(s.repo) + '">Apply as Brain</button></div>' : '') + '</article>').join('');
  if ($('rrConnection')) $('rrConnection').textContent = (G.on() ? 'Saved GitHub token connected · use Check access on the Connect tab to verify permissions.' : 'No GitHub token saved. Save it on the Connect tab before search, live reads or running Actions.');
  if ($('rrOutputSummary')) $('rrOutputSummary').textContent = 'Ember output: ' + (c.target || 'not selected') + ' · sources: ' + c.sources.length + ' whole repositories. Brain reads and build output have distinct roles.';
}
function message(text) { if ($('rrStatus')) $('rrStatus').textContent = text; }
function fromUI() { const target = $('rrTarget').value.trim(); if (target && !clean(target)) throw new Error('Use owner/name for output repo.'); const c = save({ target: clean(target), branch: $('rrBranch').value.trim(), buildWorkflow: $('rrWorkflow').value.trim() || 'build.yml', autoBuild: $('rrBuild').checked, autoSync: $('rrAuto').checked }); paintSources(); return c; }
function paint() {
  if (!$('repoRunnerFeature')) return;
  const c = config();
  $('repoRunnerFeature').innerHTML = '<p class="hint" id="rrConnection" role="status" data-ghp="repos build"></p>' +
    '<p class="hint" data-ghp="repos">One GitHub connection for Brain, discovery and builds. Search is read-only. Add whole repositories to stage them, then Install / update to publish the manifest and dispatch the GitHub runner. Staging alone does not merge code or push files.</p>' +
    '<section class="rr-section" data-ghp="repos"><h3>Linked whole repositories</h3><div id="rrSources"></div><p id="rrOutputSummary" class="hint"></p>' +
    '<label class="lb" for="rrSource">Add a whole repo directly</label><input id="rrSource" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="owner/repo or GitHub URL"><div class="btnrow"><button class="btn g" data-rr="add">Add entire repo</button><button class="btn g" data-rr="brain-direct">Apply as Brain</button></div></section>' +
    '<section class="rr-section" data-ghp="repos"><h3>Discover repositories</h3><label class="lb" for="rrSearch">Search GitHub repositories</label><input id="rrSearch" type="search" placeholder="Ember features, topic, language or owner/repo"><div class="btnrow"><button class="btn g" data-rr="search">Search repos</button><button class="btn g" data-rr="owned">My repos</button></div><div id="rrResults" aria-live="polite"></div><div class="rr-pagination"><button class="btn g" data-rr="prev" disabled>Previous</button><span id="rrPage">No search yet</span><button class="btn g" data-rr="next" disabled>Next</button></div></section>' +
    '<section class="rr-section" data-ghp="build"><h3>Ember build / output repository</h3><label class="lb" for="rrTarget">Your existing output / build repo</label><input id="rrTarget" type="text" value="' + esc(c.target) + '" autocapitalize="off" spellcheck="false" placeholder="your-account/Ember"><label class="lb" for="rrBranch">Output branch · blank uses default</label><input id="rrBranch" type="text" value="' + esc(c.branch) + '"><label class="lb" for="rrWorkflow">Existing build workflow</label><input id="rrWorkflow" type="text" value="' + esc(c.buildWorkflow) + '">' +
    '<label class="rr-check"><input id="rrBuild" type="checkbox"' + (c.autoBuild ? ' checked' : '') + '> Dispatch build after source updates</label><label class="rr-check"><input id="rrAuto" type="checkbox"' + (c.autoSync ? ' checked' : '') + '> Check upstream repos about every 15 minutes in GitHub Actions</label>' +
    '<div class="btnrow"><button class="btn g" data-rr="save">Save settings</button><button class="btn g" data-rr="output">Export standalone runner</button></div></section>' +
    '<section class="rr-section" data-ghp="build"><h3>Publish, run and inspect</h3><div class="btnrow"><button class="btn" data-rr="install">Install / update + sync + build</button><button class="btn g" data-rr="sync">Sync &amp; push now</button><button class="btn g" data-rr="status">Run status</button></div>' +
    '<p class="hint">Install writes 3 managed files on the output default branch and provisions encrypted Actions secret EMBER_REPO_TOKEN using your saved token. No raw token is put into code, exports or model prompts. Permissions: source Contents read; output Contents, Workflows, Actions and Secrets write. Existing build workflow needs workflow_dispatch. Protected branches may reject direct commits.</p>' +
    '<p class="hint">Complete current snapshots stay isolated under external/fezzy-super-brain and external/repos/owner/repo; they are not automatically wired into Ember entry points. No force-push, no execution of source package hooks. Check licenses before redistribution. Private-to-public copying is blocked. Symlinks/submodules fail closed. Run status, not dispatch, determines success.</p></section><pre id="rrStatus" class="gh-pre" role="status" aria-live="polite">Ready. Apply your Brain, choose Ember output, then save and install.</pre>';
  paintSources();
}
function renderResults(r) {
  $('rrResults').innerHTML = r.repositories.length ? r.repositories.map(x => '<article class="rr-repo-card"><div class="rr-role">' + (x.private ? 'PRIVATE REPOSITORY' : 'GITHUB REPOSITORY') + '</div><b>' + esc(x.repo) + '</b><small>' + esc(x.description || (x.can_push ? 'Push access with your saved token' : 'Repository discovery result')) + (x.license ? ' · license: ' + esc(x.license) : '') + '</small><div class="rr-card-actions"><button class="btn g" data-rr-add="' + esc(x.repo) + '">Add whole repo</button><button class="btn g" data-rr-brain="' + esc(x.repo) + '">Apply as Brain</button>' + (x.can_push ? '<button class="btn g" data-rr-target="' + esc(x.repo) + '">Use as Ember output</button>' : '') + '</div></article>').join('') : '<p class="hint">No repositories found. Try different words or check token access.</p>';
  discovery.more = r.more === true || (discovery.kind === 'search' && discovery.page * 30 < Math.min(1000, r.total || 0));
  $('rrPage').textContent = 'Page ' + discovery.page + (r.total != null ? ' · ' + r.total + ' matches' : ' · your repositories');
  message(r.repositories.length + ' repos shown' + (r.total ? ' of ' + r.total : '') + (r.partial ? ' · GitHub returned partial results' : '') + '. Select a role on a result; nothing has been pushed.');
}
async function discover(kind, page) {
  const query = kind === 'search' ? (page === 1 ? $('rrSearch').value.trim() : discovery.query) : '';
  message('Searching GitHub…');
  const r = kind === 'search' ? await search({ query, page }) : await owned({ page });
  if (!r.ok) throw new Error(r.error || 'Repository search failed.');
  discovery = { kind, query, page, more: false }; renderResults(r);
}
function controlsBusy(value) {
  $('repoRunnerFeature').setAttribute('aria-busy', String(value));
  $('repoRunnerFeature').querySelectorAll('button,input').forEach(b => b.disabled = value);
  if (!value) {
    $('repoRunnerFeature').querySelector('[data-rr="prev"]').disabled = discovery.page <= 1;
    $('repoRunnerFeature').querySelector('[data-rr="next"]').disabled = !discovery.more;
  }
}
async function click(e) {
  const b = e.target.closest('[data-rr], [data-rr-add], [data-rr-target], [data-rr-remove], [data-rr-brain]'); if (!b || b.disabled || uiBusy) return;
  uiBusy = true; controlsBusy(true);
  try {
    if (b.dataset.rrAdd) { addSource(b.dataset.rrAdd); message('Added entire repo. Install/update to publish new manifest.'); return; }
    if (b.dataset.rrBrain) { const r = applyBrain(b.dataset.rrBrain); if (!r.ok) throw new Error(r.error); message('Applied ' + r.repo + ' as the whole Brain. Live reads now use it. Install/update to publish the changed manifest.'); return; }
    if (b.dataset.rrTarget) { setTarget(b.dataset.rrTarget); message('Ember output selected and saved. Review build options before installing.'); return; }
    if (b.dataset.rrRemove) { save({ sources: config().sources.filter(s => s.repo !== b.dataset.rrRemove) }); paintSources(); message('Source removed locally. Install/update to publish the changed manifest.'); return; }
    const action = b.dataset.rr;
    if (action === 'search' || action === 'owned') await discover(action, 1);
    else if (action === 'prev' || action === 'next') await discover(discovery.kind, discovery.page + (action === 'next' ? 1 : -1));
    else if (action === 'add') { addSource($('rrSource').value); $('rrSource').value = ''; message('Entire repo added. Install/update to publish the manifest.'); }
    else if (action === 'brain-direct') { const r = applyBrain($('rrSource').value); if (!r.ok) throw new Error(r.error); $('rrSource').value = ''; message('Applied ' + r.repo + ' as Brain. Install/update to publish the changed manifest.'); }
    else if (action === 'status') { message('Reading GitHub Actions run status…'); message(JSON.stringify(await status(), null, 2)); }
    else {
      const c = fromUI();
      if (action === 'save') message('Saved. Every source is whole-repo; no file selection.');
      else if (action === 'output') { await addToOutput(); message('Standalone runner exported as an artifact. Download it and run with GH_TOKEN locally. Requires Node 20, git and GitHub CLI (gh). No token is embedded.'); }
      else if (action === 'install') {
        if (!G.on()) throw new Error('Save your GitHub token above first.');
        if (!c.target) throw new Error('Select your existing Ember output repo first.');
        if (!window.confirm('Install/update runner in ' + c.target + '? Writes 3 managed files, stores your token as an encrypted Actions secret, then starts whole-repo sync' + (c.autoBuild ? ' and the configured build.' : '.'))) { message('Install cancelled. No GitHub writes were made.'); return; }
        message('Encrypting secret, installing runner and dispatching sync…'); message(JSON.stringify(await install(), null, 2));
      } else if (action === 'sync') {
        if (!G.on()) throw new Error('Save your GitHub token above first.');
        if (!window.confirm('Dispatch installed whole-repository sync into ' + c.target + '? This can push source snapshots and trigger your build.')) { message('Sync cancelled. No workflow dispatched.'); return; }
        message('Dispatching whole-repo sync…'); message(JSON.stringify(await sync(), null, 2));
      }
    }
  } catch (error) { message(error.message || 'GitHub operation failed.'); }
  finally { uiBusy = false; controlsBusy(false); }
}
if ($('repoRunnerFeature')) {
  $('repoRunnerFeature').addEventListener('click', click);
  $('repoRunnerFeature').addEventListener('keydown', e => { if (e.key === 'Enter' && !uiBusy && ['rrSearch','rrSource'].includes(e.target.id)) { e.preventDefault(); $('repoRunnerFeature').querySelector('[data-rr="' + (e.target.id === 'rrSearch' ? 'search' : 'add') + '"]').click(); } });
  G.sub(e => { if (e.type === 'state') paintSources(); });
  paint();
}
window.EmberRepoRunner = { config, save, search, owned, addSource, applyBrain, setTarget, feature, addToOutput, install, sync, status, paint, paintSources };
})();
