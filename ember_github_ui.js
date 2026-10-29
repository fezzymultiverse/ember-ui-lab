// Single Knowledge Brain Repo. All browsing reads live with the saved token.
'use strict';
(() => {
const G = () => window.EmberGithub, $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
if (!$('ghHub') || !G()) return;
let currentPath = '', opened = null, busy = false, grepCursor = null;
const message = (id, text) => { const el = $(id); if (el) el.textContent = text || ''; };
function paint() {
  const g = G(), c = g.cfg();
  $('ghHub').innerHTML = '<div class="gh-sec" data-ghp="connect"><div class="gh-h">Knowledge Brain</div>' +
    '<label class="lb" for="ghBrainRepo">Knowledge Brain Repo</label>' +
    '<input id="ghBrainRepo" type="text" value="' + esc(g.knowledgeRepo()) + '" placeholder="fezzymultiverse/ember-brain" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<button class="btn g" data-gh-action="save-repo">Apply Brain repository</button>' +
    '<p class="hint">One Brain for live knowledge tools, automatically included in the linked repos on the Repos tab. Use the Repos tab to add whole sources or pick your Ember output repo. Applying a Brain is local; live reads require your saved token.</p><p class="hint" id="ghRepoStatus" role="status"></p></div>' +
    '<div class="gh-sec" data-ghp="connect"><label class="lb" for="ghTok">GitHub token</label>' +
    '<input type="password" id="ghTok" placeholder="' + (g.token() ? 'Token saved. Paste to replace.' : 'Paste GitHub token') + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<p class="hint">The token stays on this device and is sent only to the GitHub API, never to the model. It needs access to the Super Repo, including Contents read access for a fine-grained token.</p>' +
    '<div class="btnrow"><button class="btn" data-gh-action="save-token">Save token</button><button class="btn g" data-gh-action="check-token">Check access</button><button class="btn g danger" data-gh-action="remove-token">Remove token</button></div><p class="hint" id="ghTokenStatus" role="status">' + (g.token() ? 'Token saved.' : 'No token saved. Code answers require a live repository read.') + '</p></div>' +
    '<div class="gh-sec" data-ghp="connect"><div class="gh-h">Read-First · always on</div><p class="hint">Before answering a code question, Ember must read a real file live from the Super Repo. If reading fails, the code answer is blocked. Each grounded answer has a Last Read chip with its file, revision and read time. File content is treated as data, not instructions.</p></div>' +
    '<details class="gh-sec" data-ghp="files" open><summary class="gh-h">Files · live GitHub API</summary><label class="lb" for="ghFilePath">Folder path</label><input id="ghFilePath" type="text" placeholder="Repository root" spellcheck="false">' +
    '<div class="btnrow"><button class="btn g" data-gh-action="list">List files</button><button class="btn g" data-gh-action="root">Root</button></div>' +
    '<label class="lb" for="ghQuery">Find file or code</label><input id="ghQuery" type="text" spellcheck="false"><select id="ghFindMode"><option value="path">File paths</option><option value="code">GitHub indexed code</option><option value="grep">Entire repo content grep</option></select><button class="btn g" data-gh-action="find">Find</button><button class="btn g" id="ghGrepMore" data-gh-action="grep-more" hidden>Continue whole-repo grep</button><p class="hint" id="ghFilesStatus" role="status"></p><div id="ghFileList"></div><pre class="gh-pre" id="ghFileText" hidden></pre><button class="btn g" id="ghReadMore" data-gh-action="more" hidden>Read next part</button></details>' +
    '<details class="gh-sec" data-ghp="files"><summary class="gh-h">Sync cache · optional</summary><p class="hint">The ENTIRE repository is searchable without syncing or selecting files. This optional ranked preview cache is NOT the brain and NOT the search scope. It is never accepted as proof for Read-First.</p><label><input type="checkbox" id="ghAutoSync"' + (c.auto && c.sync ? ' checked' : '') + '> Keep cache fresh automatically</label><div class="btnrow"><button class="btn g" data-gh-action="sync">Sync cache now</button><button class="btn g" data-gh-action="clear-cache">Clear cache</button></div><p class="hint" id="ghSyncStatus" role="status"></p></details>' +
    '<details class="gh-sec" data-ghp="activity" open><summary class="gh-h">Activity · time-stamped</summary><div id="ghActivity"></div></details>';
  paintAdvanced(); paintActivity(); paintSync();
}
function paintAdvanced() {
  if (!$('ghAdvanced')) return;
  const enabled = G().cfg().runner;
  $('ghAdvanced').innerHTML = '<p class="hint">GitHub Actions builds and tests. Reading the Knowledge Brain Repo never uses this Runner.</p>' +
    '<label><input id="ghRunnerEnabled" type="checkbox"' + (enabled ? ' checked' : '') + '> Enable GitHub Actions Runner</label>' +
    '<p class="hint">Off by default. Installation writes .github/workflows/ember-run.yml to your Knowledge Brain Repo. Classic tokens need workflow permission; fine-grained tokens need equivalent repository permissions. Public repositories expose run logs and output.</p>' +
    '<button class="btn g" data-gh-action="install-runner"' + (enabled && G().token() ? '' : ' disabled') + '>Install / update Runner</button><p class="hint" id="ghRunnerStatus" role="status"></p>';
}
function paintActivity() {
  if (!$('ghActivity')) return;
  const rows = G().logs().act.slice(-40).reverse();
  $('ghActivity').innerHTML = rows.length ? rows.map(a => '<div class="gh-li"><div><b>' + esc(a.tool) + '</b><small>' + esc((a.repo || '') + ' · ' + (a.path || '') + ' · ' + (a.ok ? 'worked' : 'failed') + ' · ' + new Date(a.t).toLocaleTimeString()) + (a.note ? '<br>' + esc(a.note) : '') + '</small></div></div>').join('') : '<p class="hint">No repository tool calls yet.</p>';
}
function paintSync() {
  const state = G().syncState(), row = state.repos['knowledge-brain'];
  message('ghSyncStatus', state.running ? (row && row.msg) || 'Syncing…' : row ? row.error || row.msg : 'Reading works without a sync.');
}
function showFiles(items, parent) {
  opened = null; $('ghFileText').hidden = true; $('ghReadMore').hidden = true;
  $('ghFileList').innerHTML = items.map(x => {
    const path = x.path || (parent ? parent + '/' : '') + x.name;
    return '<button class="btn g" data-gh-action="' + (x.type === 'folder' ? 'folder' : 'read') + '" data-path="' + esc(path) + '">' + esc((x.type === 'folder' ? '▸ ' : '') + (x.name || path)) + '</button>';
  }).join('');
}
async function listFiles(path) {
  currentPath = path; $('ghFilePath').value = path; message('ghFilesStatus', 'Reading live from GitHub…');
  const r = await G().dispatch('github_list_files', { path });
  if (!r.ok) { $('ghFileList').innerHTML = ''; return message('ghFilesStatus', r.error); }
  showFiles(r.items, path); message('ghFilesStatus', r.items.length + ' shown of ' + r.count + ' entries · ' + r.source + (r.items.length < r.count ? ' · list trimmed' : ''));
}
async function readFile(path, start) {
  message('ghFilesStatus', 'Reading ' + path + ' live…');
  const r = await G().dispatch('github_read_file', { path, start: start || 0 });
  if (!r.ok) return message('ghFilesStatus', r.error);
  const sameRevision = opened && opened.path === path && opened.sha === r.sha;
  $('ghFileText').hidden = false; $('ghFileText').textContent = start && sameRevision ? $('ghFileText').textContent + r.text : r.text;
  opened = { path, sha: r.sha, next: (start || 0) + r.text.length }; $('ghReadMore').hidden = !r.trimmed;
  message('ghFilesStatus', path + ' @' + r.sha + ' · ' + r.source + (r.trimmed ? ' · partial file; read next part to continue' : '') + (start && !sameRevision ? ' · revision changed; showing this part only' : ''));
}
async function click(e) {
  const b = e.target.closest && e.target.closest('[data-gh-action]'); if (!b || b.disabled || busy) return;
  const action = b.dataset.ghAction; busy = true; b.disabled = true;
  try {
    if (action === 'save-repo') {
      grepCursor = null; $('ghGrepMore').hidden = true;
      const r = window.EmberRepoRunner ? window.EmberRepoRunner.applyBrain($('ghBrainRepo').value) : G().setKnowledgeRepo($('ghBrainRepo').value);
      message('ghRepoStatus', r.ok ? 'Saved ' + r.repo + '. Every repository tool now uses this one repository.' : r.error);
      if (r.ok) { $('ghBrainRepo').value = r.repo; currentPath = ''; opened = null; $('ghFilePath').value = ''; $('ghFileList').innerHTML = ''; $('ghFileText').hidden = true; $('ghReadMore').hidden = true; }
    } else if (action === 'save-token') {
      const value = $('ghTok').value; if (!value.trim()) return message('ghTokenStatus', 'Paste a token first. Your saved token was not changed.');
      const saved = G().setToken(value); $('ghTok').value = ''; message('ghTokenStatus', saved ? 'Token saved on this device.' : 'Invalid token. Paste a GitHub token.'); paintAdvanced();
    } else if (action === 'remove-token') { G().setToken(''); $('ghTok').value = ''; message('ghTokenStatus', 'Token removed. Code answers require a live repository read.'); paintAdvanced();
    } else if (action === 'check-token') { message('ghTokenStatus', 'Checking token and Super Repo access…'); const r = await G().status(); const failed = r.repo_errors && r.repo_errors.length; message('ghTokenStatus', r.ok && !failed ? 'Token works for ' + r.user + ' · ' + G().knowledgeRepo() : (failed ? r.repo_errors.join(' ') : r.error) || r.warning || 'Access check failed.');
    } else if (action === 'root') await listFiles('');
    else if (action === 'list') await listFiles($('ghFilePath').value.trim());
    else if (action === 'folder') await listFiles(b.dataset.path);
    else if (action === 'read') await readFile(b.dataset.path, 0);
    else if (action === 'more' && opened) await readFile(opened.path, opened.next);
    else if (action === 'find' || action === 'grep-more') {
      const mode = $('ghFindMode').value, grep = mode === 'grep';
      if (action !== 'grep-more') { grepCursor = null; $('ghFileList').innerHTML = ''; }
      message('ghFilesStatus', grep ? 'Grepping whole repository blobs…' : 'Searching live…');
      const r = await G().dispatch(grep ? 'github_grep' : 'github_find', { query: $('ghQuery').value, mode, cursor: grep ? grepCursor : undefined });
      grepCursor = r.cursor || null; $('ghGrepMore').hidden = !grepCursor;
      if (!r.ok) { message('ghFilesStatus', r.error); }
      else if (grep) {
        if (opened) { opened = null; $('ghFileText').hidden = true; $('ghReadMore').hidden = true; }
        const html = (r.hits || []).map(x => '<div><button class="btn g" data-gh-action="read" data-path="' + esc(x.path) + '">' + esc(x.path) + '</button><pre class="gh-pre">' + esc((x.matches || []).map(m => m.line + ': ' + m.text).join('\n')) + '</pre></div>').join('');
        $('ghFileList').insertAdjacentHTML('beforeend', html);
        message('ghFilesStatus', r.visited + '/' + r.total_files + ' files visited · ' + r.scanned + ' text files scanned · ' + (r.complete ? 'snapshot scan finished' : 'more files remain; Continue grep') + ' · skipped: ' + JSON.stringify(r.skipped) + (r.submodules && r.submodules.length ? ' · submodules not traversed: ' + r.submodules.join(', ') : ''));
      } else { showFiles(r.paths || r.hits || [], ''); message('ghFilesStatus', (r.total || 0) + ' matches · live GitHub API' + (r.partial_index || r.partial ? ' · partial results' : '')); }
    } else if (action === 'sync') { const r = await G().syncAll({ force: true }); if (!r.ok) message('ghSyncStatus', r.error || 'Sync failed.'); }
    else if (action === 'clear-cache') { await G().clearCache(G().knowledgeSources()[0]); message('ghSyncStatus', 'Cache cleared. Live reads still work.'); }
    else if (action === 'install-runner') { message('ghRunnerStatus', 'Installing optional Runner…'); const r = await G().installRunner(G().knowledgeRepo()); message('ghRunnerStatus', r.ok ? 'Runner ' + r.action + ' in ' + r.repo : r.error); }
  } catch (error) { message(action === 'install-runner' ? 'ghRunnerStatus' : action.includes('token') ? 'ghTokenStatus' : action === 'save-repo' ? 'ghRepoStatus' : 'ghFilesStatus', error.message || 'GitHub request failed.'); }
  finally { busy = false; if (b.isConnected) b.disabled = false; paintActivity(); }
}
$('ghHub').addEventListener('click', click);
if ($('ghAdvanced')) $('ghAdvanced').addEventListener('click', click);
document.addEventListener('change', e => {
  if (e.target.id === 'ghRunnerEnabled') { G().setCfg({ runner: e.target.checked }); paintAdvanced(); }
  if (e.target.id === 'ghAutoSync') G().setCfg({ sync: e.target.checked, auto: e.target.checked });
});
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-gh-open]'); if (b && window.EmberWorkspace) window.EmberWorkspace.open(b.dataset.ghOpen === 'files' ? 'files' : 'connect'); });
G().sub(e => { if (e.type === 'act') paintActivity(); if (e.type === 'state' || e.type === 'feed') paintSync(); });
paint();
})();
