/* Ember 1.9.93 — independent Command Center and terminal. No timeline API calls. */
'use strict';
(() => {
  const W = window, $ = id => document.getElementById(id);
  const MAX_LINES = 1000, MAX_LINE = 3000, MAX_SOURCES = 100;
  const state = { lines: [], candidates: new Map(), files: [], active: new Map(), seen: new Map(), summary: '', request: 0 };
  let stream = null, generation = 0, jobs = new Map(), destroyed = false, lastFocus = null;
  const cleanup = [];
  function on(target, name, fn) { target.addEventListener(name, fn); cleanup.push(() => target.removeEventListener(name, fn)); }
  function clean(value, n = MAX_LINE) {
    return String(value == null ? '' : value)
      .replace(/\x1b\][^\x07]*(?:\x07|$)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{16,})\b/g, '[REDACTED]')
      .replace(/(authorization\s*[:=]\s*(?:bearer|token)\s+)[^\s"']+/ig, '$1[REDACTED]')
      .replace(/((?:api[_-]?key|access[_-]?token|password|secret)\s*["']?\s*[:=]\s*["']?)[^\s"',}]+/ig, '$1[REDACTED]').slice(0, n);
  }
  function panel(open) {
    const el = $('emberCommandCenter'); if (!el) return;
    if (open) lastFocus = document.activeElement;
    el.classList.toggle('ecc-open', open); el.inert = !open;
    el.setAttribute('aria-hidden', String(!open)); $('bCommandCenter').setAttribute('aria-expanded', String(open));
    const docked = open && (W.EmberPanelLayout ? W.EmberPanelLayout.canDock() : W.matchMedia('(min-width: 1100px)').matches);
    document.body.classList.toggle('ecc-docked', docked);
    $('eccBackdrop').hidden = !open || docked;
    $('app').inert = open && !docked;
    el.setAttribute('role', docked ? 'complementary' : 'dialog');
    if (open && !docked) el.setAttribute('aria-modal', 'true'); else el.removeAttribute('aria-modal');
    if (open) $('eccClose').focus({ preventScroll: true }); else if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    W.EmberPanelLayout?.refresh();
  }
  function drawer(open) {
    $('eccTerminalBody').hidden = !open;
    $('eccTerminalToggle').setAttribute('aria-expanded', String(open));
    $('eccTerminalChevron').textContent = open ? '▾' : '▴';
    if (open) renderLines();
  }
  function renderLines() {
    const out = $('eccTerminalOutput'); if (!out) return;
    const previousTop = out.scrollTop;
    const filter = $('eccTerminalFilter').value, fragment = document.createDocumentFragment();
    for (const line of state.lines) {
      if (filter.indexOf('tag:') === 0 ? line.tag !== filter.slice(4) : (filter !== 'all' && filter !== line.stream)) continue;
      const row = document.createElement('div'); row.className = 'ecc-line ecc-line-' + line.stream + (line.tag ? ' ecc-tag-' + line.tag.toLowerCase() : '');
      const time = document.createElement('span'); time.className = 'ecc-time'; time.textContent = line.time + ' ';
      row.append(time);
      if (line.tag) { const badge = document.createElement('span'); badge.className = 'ecc-badge'; badge.textContent = line.tag; row.append(badge, document.createTextNode(' ')); }
      row.append(document.createTextNode('[' + line.source + '/' + line.stream + '] ' + line.text));
      if (line.ms != null) { const ms = document.createElement('span'); ms.className = 'ecc-ms'; ms.textContent = ' ' + (line.ms >= 1000 ? (line.ms / 1000).toFixed(1) + 's' : Math.round(line.ms) + 'ms'); row.append(ms); }
      fragment.append(row);
    }
    out.replaceChildren(fragment); $('eccTerminalCount').textContent = state.lines.length + ' lines';
    out.scrollTop = $('eccTerminalFollow').checked ? out.scrollHeight : previousTop;
  }
  let renderPending = false;
  function scheduleLines() {
    if (renderPending || destroyed) return; renderPending = true;
    requestAnimationFrame(() => { renderPending = false; if (!destroyed && !$('eccTerminalBody').hidden) renderLines(); });
  }
  const TAGS = ['TOOL', 'ROUTE', 'CREATE', 'WEB', 'GIT', 'DL', 'THINK', 'TURN'];
  // V1.10.11: the drawer may only auto-open once the person has touched or typed something. Load-time log lines used to pop it open and shove the layout.
  let armed = false; const arm = () => { armed = true; }; document.addEventListener('pointerdown', arm, { once: true, capture: true }); document.addEventListener('keydown', arm, { once: true, capture: true });
  function write(data) {
    if (destroyed || !data || typeof data !== 'object') return;
    const kind = ['stdout','stderr','status','merged'].includes(data.stream) ? data.stream : 'status';
    const text = clean(data.text, 60000); if (!text) return;
    const source = clean(data.source || 'Backend', 60), time = new Date().toLocaleTimeString([], { hour12: false });
    const tag = TAGS.includes(String(data.tag || '').toUpperCase()) ? String(data.tag).toUpperCase() : '';
    const ms = Number.isFinite(Number(data.ms)) && data.ms !== null && data.ms !== '' ? Math.max(0, Number(data.ms)) : null;
    text.split(/\r?\n|\r/).slice(-MAX_LINES).forEach(t => state.lines.push({ stream: kind, source, time, text: t.slice(0, MAX_LINE), tag, ms }));
    if (state.lines.length > MAX_LINES) state.lines.splice(0, state.lines.length - MAX_LINES);
    $('eccTerminalCount').textContent = state.lines.length + ' lines';
    const tk = $('eccTerminalTicker'); if (tk) tk.textContent = (tag ? tag + ' · ' : '') + text.split(/\r?\n|\r/)[0].slice(0, 70);
    if (armed && tag && tag !== 'TURN' && $('eccTerminalAuto') && $('eccTerminalAuto').checked && $('eccTerminalBody').hidden) drawer(true);
    scheduleLines();
  }
  function activity(key, active) {
    if (active) state.active.set(key, true); else state.active.delete(key);
    $('emberTerminal').classList.toggle('ecc-active', state.active.size > 0);
    $('eccTerminalStatus').textContent = state.active.size ? state.active.size + ' active' : 'Idle';
  }
  function changed(key, value) {
    if (state.seen.get(key) === value) return false;
    state.seen.delete(key); state.seen.set(key, value);
    if (state.seen.size > 500) state.seen.delete(state.seen.keys().next().value);
    return true;
  }
  function inspect(text) {
    // Read only the explicitly public three-phase block. Never read provider reasoning fields.
    const t = String(text || ''), start = t.indexOf('Phase 1: Architecture/Constraint Check.');
    if (start < 0) return;
    const block = t.slice(start).split(/\n\s*Implementation\s*:|<artifact\b|```|<tool_call\b/i)[0];
    const p2 = block.indexOf('Phase 2: Tactical Execution Plan.'), p3 = block.indexOf('Phase 3: Edge-Case Mitigation.');
    if (p2 < 0 || p3 <= p2) return;
    state.summary = clean(block.trim(), 6000); if ($('eccThought').textContent !== state.summary) $('eccThought').textContent = state.summary;
  }
  function registerContext(meta) {
    if (!meta || !meta.needle || !meta.name) return;
    const key = String(meta.id || meta.name); state.candidates.set(key, { id: key, name: clean(meta.name, 240), scope: clean(meta.scope || 'File excerpt', 160), needle: String(meta.needle).slice(0, 200) });
    if (state.candidates.size > MAX_SOURCES) state.candidates.delete(state.candidates.keys().next().value);
  }
  function renderFiles() {
    const list = $('eccMemory'), fragment = document.createDocumentFragment();
    state.files.forEach(file => {
      const li = document.createElement('li'), b = document.createElement('b'), small = document.createElement('small');
      b.textContent = file.name; small.textContent = file.scope; li.append(b, small); fragment.append(li);
    });
    list.replaceChildren(fragment); $('eccMemoryCount').textContent = state.files.length;
    $('eccMemoryEmpty').hidden = !!state.files.length;
    $('eccContextStatus').textContent = 'Request ' + state.request + ' · observed ' + new Date().toLocaleTimeString();
  }
  function observeRequest(options) {
    if (destroyed || !options || !/FINAL CHECK:|reasoning engine inside Ember|Tool: /.test(String(options.system || '') + JSON.stringify(options.messages || []))) return;
    const payload = String(options.system || '') + '\n' + (options.messages || []).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n');
    const files = [];
    for (const meta of state.candidates.values()) {
      if (payload.includes(meta.needle) || payload.includes(JSON.stringify(meta.needle).slice(1,-1))) files.push({ name: meta.name, scope: meta.scope });
    }
    // Only show a repo file if its provenance marker is actually in this request, not merely cached.
    try {
      const proof = W.EmberGithub && W.EmberGithub.lastRead();
      (proof && proof.files || []).forEach(f => {
        if (f.path && payload.includes('--- ' + f.repo + ':' + f.path + ' @')) files.push({ name: f.repo + '/' + f.path, scope: f.range ? 'Repository excerpt · lines ' + f.range : 'Repository excerpt · live read' });
      });
    } catch (_) { /* no GitHub adapter */ }
    // Restored conversation/tool payloads can retain document chunks from earlier turns.
    for (const m of options.messages || []) {
      const re = /Tool: ([\w_]+)\nResult: ([\s\S]*?)(?=\n\nTool: |$)/g; let match;
      while ((match = re.exec(String(m.content || '')))) {
        try { collectResult(JSON.parse(match[2]), files); } catch (_) { /* truncated JSON is not evidence */ }
      }
    }
    state.request++; state.files = files.filter((f,i,a) => a.findIndex(x => x.name === f.name && x.scope === f.scope) === i).slice(0, MAX_SOURCES); renderFiles();
  }
  function collectResult(result, files, depth = 0) {
    if (!result || typeof result !== 'object' || depth > 4) return;
    if (!result.error && (result.text || result.content || result.rawText || result.snippet) && (result.fileId || result.path)) files.push({ name: clean(result.name || ((result.repo ? result.repo + '/' : '') + (result.path || result.fileId)), 240), scope: result.chunk ? 'Document excerpt · part ' + result.chunk : result.snippet ? 'Search excerpt' : 'File excerpt' });
    for (const k of ['hits','results']) if (Array.isArray(result[k])) result[k].slice(0,50).forEach(x => collectResult(x, files, depth+1));
  }
  function observeTool(tool, args, result) {
    if (!result || result.error || result.ok === false) return;
    if (/read|search_in_document|search_documents|summarize_document/.test(tool)) {
      const excerpt = result.text || result.content || result.rawText;
      if (excerpt && (result.fileId || result.path || args && (args.fileId || args.path))) registerContext({ id: tool + ':' + (result.fileId || result.path || args.fileId || args.path), name: result.name || result.path || args.path || args.fileId, scope: result.chunk ? 'Document excerpt · part ' + result.chunk : 'File excerpt', needle: String(excerpt).slice(0, 160) });
    }
  }
  function begin() {
    state.summary = ''; state.files = []; state.candidates.clear();
    $('eccThought').textContent = 'Waiting for Ember’s public three-phase summary…'; renderFiles();
    $('eccContextStatus').textContent = 'Preparing context for this turn…';
  }
  async function api(path, options) {
    const G = W.EmberGithub; if (!G || !G.managerRequest) throw new Error('GitHub adapter is unavailable.');
    const r = await G.managerRequest(path, options); if (!r.ok) throw new Error(r.error || 'GitHub request failed.'); return r.json;
  }
  function stopJob(key) { const job = jobs.get(key); if (job) { clearTimeout(job.timer); jobs.delete(key); } activity(key, false); }
  function followWorkflow(repo, workflow, branch, since, ticket) {
    const key = repo + ':' + workflow;
    stopJob(key); const job = { timer: null, id: null, polls: 0, start: Date.now() }; jobs.set(key, job); activity(key, true);
    const valid = () => !destroyed && ticket === generation && jobs.get(key) === job;
    async function tick() {
      try {
        if (!valid()) return;
        if (document.hidden || navigator.onLine === false) { job.timer = setTimeout(tick, 8000); return; }
        if (!job.id) {
          const list = await api('/repos/' + repo + '/actions/workflows/' + encodeURIComponent(workflow) + '/runs?event=workflow_dispatch&per_page=10&branch=' + encodeURIComponent(branch));
          const run = (list.workflow_runs || []).filter(r => Date.parse(r.created_at) >= since && r.head_branch === branch).sort((a,b) => Date.parse(a.created_at)-Date.parse(b.created_at))[0];
          if (run) job.id = run.id;
          else if (++job.polls >= 20) throw new Error('Dispatched run has not appeared. Open GitHub Actions to verify.');
        }
        if (job.id) {
          const run = await api('/repos/' + repo + '/actions/runs/' + job.id);
          if (!valid()) return;
          const text = 'Run ' + job.id + ': ' + run.status + (run.conclusion ? ' / ' + run.conclusion : '');
          if (changed(key, text)) write({ source: 'GitHub Runner', stream: 'status', text });
          if (run.status === 'completed') {
            write({ source: 'GitHub Runner', stream: run.conclusion === 'success' ? 'status' : 'stderr', text: 'Workflow finished: ' + run.conclusion + '. Full merged logs: https://github.com/' + repo + '/actions/runs/' + job.id });
            stopJob(key); return;
          }
          const r = await api('/repos/' + repo + '/actions/runs/' + job.id + '/jobs?per_page=30');
          if (!valid()) return;
          for (const j of r.jobs || []) for (const step of j.steps || []) {
            const line = j.name + ' / ' + step.name + ': ' + step.status + (step.conclusion ? ' (' + step.conclusion + ')' : '');
            if (changed(key + ':' + j.id + ':' + step.number, line)) write({ source: 'GitHub Runner', stream: 'status', text: line });
          }
        }
        if (Date.now() - job.start > 60*60*1000) throw new Error('Stopped monitoring after one hour; check Actions for the final result.');
        if (valid()) job.timer = setTimeout(tick, 5000);
      } catch (e) {
        if (!valid()) return; write({ source: 'GitHub Runner', stream: 'stderr', text: e.message }); stopJob(key);
      }
    }
    job.timer = setTimeout(tick, 1500);
  }
  let actionBusy = false;
  async function action(kind) {
    if (actionBusy || destroyed) return;
    const ticket = generation;
    try {
      const G = W.EmberGithub, R = W.EmberRepoRunner;
      if (!G || !R) throw new Error('Repo Runner is not loaded.');
      const c = R.config(); let branch, workflow, since;
      if (kind !== 'cache') {
        if (!c.target) throw new Error('Set your output repository in Settings > Features > Repo Runner first.');
        if (!G.on()) throw new Error('Save your GitHub token first.');
        workflow = kind === 'build' ? c.buildWorkflow : 'ember-repo-sync.yml';
        if (!W.confirm(kind === 'build' ? 'Run ' + workflow + ' in ' + c.target + '? This starts a GitHub Actions build.' : 'Sync and push the configured whole repositories into ' + c.target + '? This dispatches the installed runner and may also build. It does not push unsaved chat artifacts.')) return;
      } else if (!W.confirm('Clear repository read caches? Chats, documents, settings, API keys and offline app assets will be kept.')) return;
      actionBusy = true; document.querySelectorAll('[data-ecc-action]').forEach(b => b.disabled = true); drawer(true);
      $('eccActionStatus').textContent = 'Working…';
      if (kind === 'cache') {
        if (G.syncState && G.syncState().running) throw new Error('Wait until repository sync finishes before clearing its caches.');
        for (const source of G.knowledgeSources()) await G.clearCache(source);
        write({ source: 'Command Center', stream: 'status', text: 'Repository read caches cleared. Saved data and credentials preserved.' });
        $('eccActionStatus').textContent = 'Repository read caches cleared.';
      } else {
        const info = await api('/repos/' + c.target); branch = c.branch || info.default_branch;
        if (!branch) throw new Error('Could not resolve the output branch.');
        if (kind === 'build') await api('/repos/' + c.target + '/actions/workflows/' + encodeURIComponent(workflow));
        since = Date.now();
        if (kind === 'build') await api('/repos/' + c.target + '/actions/workflows/' + encodeURIComponent(workflow) + '/dispatches', { method: 'POST', body: { ref: branch } });
        else { const r = await R.sync(); if (!r.ok) throw new Error(r.error || 'Runner sync failed.'); }
        if (ticket !== generation || destroyed) return;
        const msg = workflow + ' dispatched to ' + c.target + ' on ' + branch + '. Waiting for runner status; dispatch is not build success.';
        write({ source: 'GitHub Runner', stream: 'status', text: msg }); $('eccActionStatus').textContent = msg;
        followWorkflow(c.target, workflow, branch, since, ticket);
      }
    } catch (e) { write({ source: 'Command Center', stream: 'stderr', text: e.message }); $('eccActionStatus').textContent = clean(e.message); }
    finally { actionBusy = false; document.querySelectorAll('[data-ecc-action]').forEach(b => b.disabled = false); }
  }
  function disconnectStream() { if (stream) { stream.close(); stream = null; } activity('relay', false); }
  function connectStream(url) {
    // Explicit, authenticated same-origin relay only. No API tokens in a URL, no automatic connections.
    const u = new URL(url, location.href);
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error('Use a same-origin HTTP(S) stream path without URL credentials, query or hash.');
    if (!W.EventSource) throw new Error('EventSource is unavailable in this environment.');
    disconnectStream(); stream = new EventSource(u.href); const current = stream;
    const receive = event => { if (stream !== current) return; try { const d = JSON.parse(event.data); if (event.type === 'stdout' || event.type === 'stderr') d.stream = event.type; write(d); } catch (_) { write({ source: 'Relay', stream: 'stderr', text: 'Invalid terminal event JSON.' }); } };
    stream.onmessage = receive; stream.addEventListener('stdout', receive); stream.addEventListener('stderr', receive);
    stream.onopen = () => { if (stream === current) { activity('relay', true); write({ source: 'Relay', stream: 'status', text: 'Live backend stream connected.' }); } };
    stream.onerror = () => { if (stream === current) { activity('relay', false); if (changed('relay:error', String(current.readyState))) write({ source: 'Relay', stream: 'status', text: current.readyState === 2 ? 'Live stream closed.' : 'Stream interrupted; reconnecting…' }); } };
    stream.addEventListener('end', () => { if (stream === current) disconnectStream(); }); return disconnectStream;
  }
  function init() {
    if (!$('emberCommandCenter') || !$('emberTerminal')) return;
    on($('bCommandCenter'), 'click', () => panel(!$('emberCommandCenter').classList.contains('ecc-open')));
    on($('eccClose'), 'click', () => panel(false)); on($('eccBackdrop'), 'click', () => panel(false));
    on(document, 'keydown', e => {
      if (!$('emberCommandCenter').classList.contains('ecc-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); panel(false); }
      if (e.key === 'Tab' && !document.body.classList.contains('ecc-docked')) {
        const nodes = [...$('emberCommandCenter').querySelectorAll('button:not(:disabled),[tabindex="0"]')], first = nodes[0], last = nodes[nodes.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    on($('eccTerminalToggle'), 'click', () => drawer($('eccTerminalBody').hidden));
    on($('eccTerminalClear'), 'click', () => { state.lines.length = 0; const tk = $('eccTerminalTicker'); if (tk) tk.textContent = ''; renderLines(); });
    on($('eccTerminalCopy'), 'click', async () => {
      const text = state.lines.map(l => l.time + ' ' + (l.tag ? '[' + l.tag + '] ' : '') + '[' + l.source + '/' + l.stream + '] ' + l.text + (l.ms != null ? ' (' + Math.round(l.ms) + 'ms)' : '')).join('\n');
      const b = $('eccTerminalCopy'); let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (__) { ok = false; } }
      if (b) { b.textContent = ok ? 'Copied' : 'Blocked'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); }
    });
    try { const auto = $('eccTerminalAuto'); if (auto) { auto.checked = localStorage.getItem('ember_term_auto') !== '0'; on(auto, 'change', () => { try { localStorage.setItem('ember_term_auto', auto.checked ? '1' : '0'); } catch (_) { /* storage blocked */ } }); } } catch (_) { /* storage blocked */ }
    on($('eccTerminalFilter'), 'change', renderLines); on($('eccTerminalFollow'), 'change', renderLines);
    document.querySelectorAll('[data-ecc-action]').forEach(b => on(b, 'click', () => action(b.dataset.eccAction)));
    on(W, 'ember-turn-start', begin);
    on(W, 'ember-token', e => inspect(e.detail && e.detail.text));
    on(W, 'ember-terminal', e => write(e.detail));
    on(W, 'ember-dl', e => {
      const d = e.detail || {}, key = 'newpipe:' + d.id, text = (d.title || 'Download') + ': ' + (d.state || 'running') + ' ' + (Number(d.pct) || 0) + '%' + (d.detail ? ' · ' + d.detail : '');
      activity(key, !['done','failed'].includes(d.state));
      if (changed(key, text)) write({ source: 'NewPipe', stream: d.state === 'failed' ? 'stderr' : 'status', text });
    });
    on(W, 'ember-runner-status', e => {
      const d = e.detail || {}, key = 'github:' + d.id;
      if (!String(d.id || '').startsWith('gh:')) return;
      activity(key, d.state === 'run');
      if (d.state === 'released') return;
      if (changed(key, d.text + ':' + d.pct)) write({ source: 'GitHub Runner', stream: d.state === 'bad' ? 'stderr' : 'status', text: d.text + (d.pct != null ? ' (' + d.pct + '%)' : '') });
    });
    // A queued command can transition from a temporary dispatch id to a real run id.
    on(W, 'ember-runner-release', e => { activity('github:' + (e.detail && e.detail.id), false); });
    on(W, 'ember-repo-runner-dispatched', e => {
      const d = e.detail || {};
      if (!d.repo || !d.workflow || !d.branch) return;
      write({ source: 'Repo Runner', stream: 'status', text: d.workflow + ' dispatched to ' + d.repo + '. Monitoring GitHub job status, not raw shell output.' });
      followWorkflow(d.repo, d.workflow, d.branch, Number(d.since) || Date.now(), generation);
    });
    on(W, 'ember-runner-output', e => {
      const d = e.detail || {}; activity('github:gh:' + d.runId, false);
      if (changed('output:' + d.runId, d.text)) write(d);
    });
    on(W, 'pagehide', () => { generation++; disconnectStream(); [...jobs.keys()].forEach(stopJob); });
  }
  W.EmberCommandCenter = {
    inspect, registerContext, observeTool, observeRequest, write, open: () => panel(true), close: () => panel(false), connectStream, disconnectStream,
    snapshot: () => ({ files: state.files.map(x => ({ ...x })), summary: state.summary, lineCount: state.lines.length }),
    destroy: () => { destroyed = true; generation++; disconnectStream(); [...jobs.keys()].forEach(stopJob); cleanup.splice(0).forEach(f => f()); }
  };
  init();
})();
