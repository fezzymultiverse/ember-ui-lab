// Ember V1.9.51 - rotating status first; tap it to expand the dots/icons timeline.
// Ember V1.9.50 - stable status text: update one node in place; only the spinner moves.
// Ember V1.9.45 - thought-by-thought reveal queue (rv flags) for every style.
// Ember V1.9.42 - ember_timeline.js (single owner of the live thinking card; ReAct feeds it via upsert())
// Ember V1.9.31 - ember_timeline.js
// "Summary" card while Ember works on a reply: grey dot = thought, terminal icon = tool call
// (SUCCESS / FAILED pill), orange radar = active "Thinking...". Does NOT touch ember_think_inline.js
// or the ReAct process: during a run_react job this panel hides, letting the existing
// Summary card handle it.
// API surface unchanged so app.js wiring needs no edit:
//   begin()           – insert the panel (replaces the three typing dots)
//   note(text, key?)  – add a line of thinking text
//   tool(name, args)  – add a tool-call line; .end(result) marks it done / failed
//   snapshot()        – data to save on the reply (null when no tool ran)
//   drop()            – remove the panel
//   liveHtml()        – used by renderLog() to keep the panel alive
//   savedHtml(tl)     – "Thought for Xs" row above the final reply
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; };

  const CHEV = '<svg class="et-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

  // V1.9.39: header like the mockup - spark icon + shimmering "Thinking…" / "Executing Tool…", then "Thought for Xs"
  const SPARK = '<svg class="tl-spark" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>';
  const DOWN = '<svg class="tl-chv" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
  const secsOf = ms => ms ? (ms / 1000).toFixed(1) + 's' : '\u2013';
  const titleHtml = (running, tooling, ms) => '<h2 class="tl-title">' + SPARK + (running
    ? '<span class="tl-shimmer">' + (tooling ? 'Executing Tool\u2026' : 'Thinking\u2026') + '</span>'
    : '<span class="tl-done-t">Thought for ' + secsOf(ms) + '</span>') + '</h2>';

  const reactOn = () => false; // V1.9.42: one card for every run; ember_think_inline.js feeds ReAct steps into it

  // ---------- tool label helpers ----------
  const host = u => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch (e) { return clip(u, 30); } };
  function label(tool, a) {
    a = a && typeof a === 'object' ? a : {};
    const q = a.query || a.q || a.text || a.goal || a.title || a.name || '';
    switch (tool) {
      case 'scrape_url':          return 'Reading ' + (a.url ? host(a.url) : 'a page');
      case 'web_search':          return 'Searching the web' + (q ? ': \u201c' + clip(q, 40) + '\u201d' : '');
      case 'search_in_document':
      case 'search_documents':    return 'Searching your document' + (q ? ': \u201c' + clip(q, 40) + '\u201d' : '');
      case 'read_document_chunk':
      case 'read_document':       return 'Reading your document' + (a.chunk ? ' (chunk #' + a.chunk + ')' : '');
      case 'get_document_outline':return 'Reading the document outline';
      case 'list_documents':      return 'Listing your documents';
      case 'map_knowledge':       return 'Mapping connections';
      case 'youtube_search':      return 'Searching YouTube' + (q ? ': \u201c' + clip(q, 40) + '\u201d' : '');
      case 'run_react':           return 'Working it out step by step';
      case 'youtube_download':    return 'Downloading audio';
      case 'playlist_download':   return 'Downloading playlist audio';
      case 'see_image':           return 'Looking at the image';
      case 'get_public_ip':       return 'Checking the public IP';
      case 'check_grammar':       return 'Checking grammar';
      case 'search_photos':       return 'Searching photos' + (q ? ': \u201c' + clip(q, 40) + '\u201d' : '');
      case 'get_whois':           return 'Looking up the domain';
      case 'get_word_info':       return 'Looking up the word';
      case 'get_lyrics':          return 'Fetching lyrics';
      case 'playlist_list':       return 'Reading the playlist';
      case 'play_song':           return 'Playing' + (q ? ' \u201c' + clip(q, 40) + '\u201d' : ' a song');
      case 'play_playlist':       return 'Playing playlist' + (a.name ? ' \u201c' + clip(a.name, 36) + '\u201d' : '');
      case 'get_library':         return 'Checking your music library' + (q ? ': \u201c' + clip(q, 30) + '\u201d' : '');
      case 'get_current_track':   return 'Checking what is playing';
      case 'identify_song':       return 'Identifying the song';
      case 'create_playlist':     return 'Saving a playlist' + (a.name ? ': ' + clip(a.name, 30) : '');
      case 'control_player': {
        const act = String(a.action || '').toLowerCase(), v = a.value;
        let song = ''; try { if (a.songId && window.EmberPlayer) { const t = window.EmberPlayer.get(a.songId); if (t && t.title) song = ' \u201c' + clip(t.title, 34) + '\u201d'; } } catch (e) { /* label only */ }
        return ({ play: a.songId ? 'Playing' + song : 'Resuming the music', pause: 'Pausing the music', toggle: 'Play / pause', next: 'Skipping to the next song', prev: 'Going back a song', stop: 'Stopping the music', seek: 'Jumping to ' + (v == null ? 'a spot' : v + 's'), volume: 'Setting volume' + (v == null ? '' : ' to ' + v), shuffle: 'Switching shuffle', repeat: 'Switching repeat' })[act] || 'Controlling the player';
      }
      case 'set_timer':           return 'Setting a timer' + (q ? ': ' + clip(q, 30) : '');
      case 'list_timers':         return 'Checking your timers';
      case 'cancel_timer':        return 'Cancelling a timer';
      case 'list_sites':          return 'Checking your saved sites';
      case 'save_site':           return 'Saving a site';
      case 'summarize_document':  return 'Summarising your document';
      case 'run_plan':            return 'Working through a plan';
      case 'key_map':             return 'Checking your saved keys';
      case 'repo_overview':       return 'Studying ' + (a.repo ? clip(a.repo, 40) : 'a linked repo');
      case 'repo_list_files':     return 'Browsing ' + (a.repo ? clip(a.repo, 30) : 'a linked repo') + (a.path ? '/' + clip(a.path, 30) : '');
      case 'repo_read_file':      return 'Reading ' + (a.path ? clip(a.path, 40) : 'a repo file') + (a.repo ? ' from ' + clip(a.repo, 28) : '');
      case 'repo_search':          return 'Searching ' + (a.repo ? clip(a.repo, 30) : 'a linked repo') + (q ? ': \u201c' + clip(q, 30) + '\u201d' : '');
      case 'github_status':       return 'Checking the GitHub token and Knowledge Brain Repo';
      case 'github_repos':        return 'Checking your Knowledge Brain Repo';
      case 'github_sync':         return 'Syncing ' + (a.repo ? clip(a.repo, 36) : 'your repos') + ' from GitHub' + (a.force ? ' (re-reading everything)' : '');
      case 'github_repo_map':      return 'Mapping ' + (a.repo ? clip(a.repo, 30) : 'the repo') + (a.path ? '/' + clip(a.path, 30) : '') + ' from the synced index';
      case 'github_grep': return 'Grepping the entire Super Brain' + (q ? ': ' + clip(q, 40) : '');
      case 'github_find':          return (String(a.mode || '').toLowerCase() == 'code' ? 'Searching the code of ' : 'Finding files in ') + (a.repo ? clip(a.repo, 28) : 'the repo') + (q ? ': \u201c' + clip(q, 30) + '\u201d' : '');
      case 'github_list_files':   return 'Listing ' + (a.repo ? clip(a.repo, 28) + '/' : 'GitHub files ') + (a.path ? clip(a.path, 36) : '');
      case 'github_read_file':    return 'Reading ' + (a.path ? clip(a.path, 40) : 'a GitHub file') + (a.repo ? ' from ' + clip(a.repo, 28) : '');
      case 'github_write_file':   return 'Pushing ' + (a.path ? clip(a.path, 40) : 'a file') + ' to ' + (a.repo ? clip(a.repo, 28) : 'GitHub');
      case 'github_run':          return 'Running on GitHub Actions' + (a.command ? ': ' + clip(a.command, 34) : '');
      case 'github_run_status':   return 'Checking the GitHub run';
      case 'github_install_runner': return 'Installing the GitHub runner';
      case 'find_in_app':         return 'Looking in the app' + (q ? ': \u201c' + clip(q, 36) + '\u201d' : '');
      default: return clip(String(tool || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) + (q ? ': \u201c' + clip(q, 36) + '\u201d' : ''), 90);
    }
  }
  const failed = r => !!(r && typeof r === 'object' && (r.error || r.ok === false));

  // ---------- styles: 'tl' = existing Summary card, 'dd' = compact dropdown, 'claude' = animated status line ----------
  // V1.9.70: one design only - the borderless egg-spinner header with icon rows that drop in one by one.
  const getStyle = () => 'claude';
  const setStyle = () => {};
  const nextStyle = () => 'claude';
  let uidc = 0;

  // ---------- state ----------
  const MAX = 20;
  let live = null; // { lines:[{text,bad,rv,rvAt}], t0, open, seen:{}, toolRan }

  // ---------- V1.9.45: reveal queue ----------
  // Real events (notes / tool calls) can arrive in a burst; the card must show them one at a time,
  // thought by thought. Every line carries rv (revealed) + rvAt; only revealed lines are painted.
  // The first line shows at once, later ones are spaced out and speed up when a backlog builds.
  let rvTimer = null, lastRv = 0;
  const vis = () => (live ? live.lines.filter(l => l.rv) : []);
  const gapFor = pend => getStyle() === 'claude' ? (pend > 4 ? 320 : pend > 2 ? 400 : 520) : (pend > 4 ? 240 : pend > 2 ? 380 : 540);
  function pump() {
    if (!live || rvTimer) return;
    const pend = live.lines.filter(l => !l.rv).length; if (!pend) return;
    const wait = Math.max(0, lastRv + gapFor(pend) - Date.now());
    rvTimer = setTimeout(() => {
      rvTimer = null; if (!live) return;
      const n = live.lines.find(l => !l.rv);
      if (n) { n.rv = true; n.rvAt = lastRv = Date.now(); paint(); }
      pump();
    }, wait);
  }
  function flush() { if (!live) return; if (rvTimer) { clearTimeout(rvTimer); rvTimer = null; } live.lines.forEach(l => { if (!l.rv) { l.rv = true; l.rvAt = 0; } }); paint(); }

  // ---------- core ----------
  function activity(active, text) {
    try { window.dispatchEvent(new CustomEvent('ember-activity', { detail: { active: !!active, text: clip(text || '', 54) } })); } catch (_) {}
  }
  function begin() {
    activity(true, 'Thinking…');
    if (rvTimer) { clearTimeout(rvTimer); rvTimer = null; } lastRv = 0;
    // Keep the useful activity stream visible while Ember works. The header still toggles it closed when he wants a compact view.
    live = { lines: [], t0: Date.now(), open: true, seen: {}, toolRan: false };
    // Hide the welcome hero as soon as a turn starts; otherwise it can sit behind
    // the live Summary card while the first user/assistant rows are being rendered.
    const empty = $('empty'); if (empty) empty.classList.add('hidden');
    const old = $('typ'); if (old) old.remove();
    const log = $('log'); if (!log) return;
    log.insertAdjacentHTML('beforeend', outerHtml());
    log.scrollTop = log.scrollHeight;
  }
  function drop() { activity(false, ''); if (rvTimer) { clearTimeout(rvTimer); rvTimer = null; } live = null; const old = $('typ'); if (old) old.remove(); }

  function paint() {
    const el = $('typ'); if (!el || !live) return;
    const log = $('log');
    // Check before changing the card height; do not pull someone reading older messages back down.
    const follow = log && log.scrollHeight - log.clientHeight - log.scrollTop <= 48;
    el.className = 'et-think' + (reactOn() ? ' et-hide' : '');
    // The compact rotating header updates in place. When open, refresh only the body
    // so provider/tool/download duties appear without replacing the spinner/status nodes.
    if (getStyle() === 'claude' && paintSpin(el)) {
      if (live.open) {
        const body = el.querySelector('.et-timeline-lines');
        if (body) syncRows(body); // V1.9.70: add only new rows (they drop in); update changed rows in place
        if (follow || live.open) log.scrollTop = log.scrollHeight;
        return;
      } else { if (follow) log.scrollTop = log.scrollHeight; return; }
    }
    activity(true, statusOf().t);
    el.innerHTML = innerHtml();
    if (el.querySelectorAll) { // V1.9.45: each revealed row drops in once; a repaint mid-drop carries on from where it was
      const items = el.querySelectorAll('.tl-item:not(.tl-now)'), v = vis(), now = Date.now();
      items.forEach((it, i) => {
        const l = v[i]; if (!l || !l.rvAt) return;
        const age = now - l.rvAt;
        if (age < 460) { it.classList.add('tl-new'); it.style.animationDelay = '-' + age + 'ms'; }
      });
    }
    // While the live stream is intentionally open, keep its latest rows in view;
    // this prevents the card/header from being nudged by the growing activity list.
    if (follow || live.open) log.scrollTop = log.scrollHeight;
  }

  // Keep both the spinner and status node. Overlapping old/new grid items and rotateX/translateY
  // made the text jump on Android, especially when statuses wrapped to different line counts.
  const statusOf = () => { const v = vis(), last = v[v.length - 1]; return last ? { t: clip(last.text, 100), bad: !!last.bad } : { t: 'Thinking\u2026', bad: false }; };
  const statusSpan = st => '<span class="et-status' + (st.bad ? ' et-bad' : '') + '" data-s="' + esc(st.t) + '" title="' + esc(st.t) + '">' + esc(st.t) + '</span>';
  function paintSpin(el) {
    if (!el.querySelector) return false;
    const stage = el.querySelector('.et-stage'); if (!stage) return false;
    const st = statusOf(), cur = stage.querySelector('.et-status'); if (!cur) return false;
    activity(true, st.t);
    if (cur.getAttribute('data-s') !== st.t) {
      cur.textContent = st.t;
      cur.setAttribute('data-s', st.t);
      cur.setAttribute('title', st.t);
    }
    // A tool can change from RUNNING to FAILED without changing its label.
    cur.classList.toggle('et-bad', st.bad);
    return true;
  }

  function addLine(text, bad) {
    if (!live) return null;
    const line = { id: ++uidc, text, bad: !!bad, k: 't', st: '', tool: '' };
    live.lines.push(line);
    if (live.lines.length > MAX) live.lines.shift();
    pump();
    return line;
  }

  function note(text, key) {
    if (!live || !text) return;
    text = clip(text, 120);
    if (key) { if (live.seen[key]) return; live.seen[key] = 1; }
    const last = live.lines[live.lines.length - 1];
    if (last && last.text === text) return;
    addLine(text, false);
  }

  function tool(name, args) {
    if (live) live.toolRan = true;
    const line = live ? addLine(label(name, args), false) : null;
    if (line) line.tool = name;
    if (line) { line.k = 'a'; line.st = 'run'; paint(); pump(); } // V1.9.39: repaint so the RUNNING pill / "Executing Tool…" show while the tool works (they were set after the paint)
    return {
      end(res) { if (line) { line.bad = failed(res); line.st = line.bad ? 'bad' : 'ok'; paint(); } }
    };
  }

  // V1.9.42: keyed lines so ReAct can add a step once and update it as it moves thinking -> running -> done
  function upsert(key, text, k, st, opt) {
    if (!live || !key || !text) return null;
    opt = opt || {};
    live.keyed = live.keyed || {};
    let line = live.keyed[key];
    if (!line) {
      line = { id: ++uidc, text: '', bad: false, k: 't', st: '', key };
      live.keyed[key] = line; live.lines.push(line);
      if (live.lines.length > MAX) live.lines.shift();
    }
    line.text = clip(text, opt.max || 120); line.k = k || line.k || 't'; line.st = st || '';
    line.bad = st === 'bad'; line.pill = opt.pill || ''; line.err = opt.err ? clip(opt.err, 140) : ''; line.pct = +opt.pct || 0; if (opt.ic) line.ic = opt.ic;
    // V1.9.70: new keyed lines wait their turn in the reveal queue so they drop in one by one like the rest.
    if (line.k === 'a') live.toolRan = true;
    paint(); pump();
    return line;
  }
  function unkey(key) {
    if (!live || !live.keyed || !live.keyed[key]) return;
    const l = live.keyed[key]; live.lines = live.lines.filter(x => x !== l); delete live.keyed[key]; paint();
  }
  function collapse() { if (!live) return; live.open = false; paint(); }
  function snapshot() {
    if (!live || (!live.toolRan && live.lines.length < 2)) return null;
    return { ms: Date.now() - live.t0, lines: live.lines.slice(-MAX).map(l => [l.text, l.bad ? 1 : 0, l.k || 't', l.pill || '', l.err || '', l.tool || '', l.key || '', l.ic || '']) };
  }

  // ---------- html ----------
  const TERM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l6-6-6-6M12 19h8"/></svg>';
  const TOOL_ICON = (tool, text) => {
    const x = String(tool || '').toLowerCase() + ' ' + String(text || '').toLowerCase();
    if (/youtube|playlist|download/.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">▶</span>';
    if (/document|file|chunk|outline|searching your/.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">▤</span>';
    if (/web|scrape|page|searching the|browser/.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">◎</span>';
    if (/graph|mapping|connection/.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">⌘</span>';
    if (/image|photo|vision/.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">◉</span>';
    if (/engine|api|asking /.test(x)) return '<span class="tl-tool-symbol" aria-hidden="true">✦</span>';
    return TERM;
  };
  const row = (text, k, st, pill, err, tool) => {
    if (k !== 'a') return '<div class="tl-item"><div class="tl-ico"><div class="tl-dot"></div></div><div class="tl-txt">' + esc(text) + '</div></div>';
    const p = pill ? '<span class="tl-pill tl-pill-warn">' + esc(pill) + '</span>'
      : st === 'ok' ? '<span class="tl-pill tl-pill-ok">SUCCESS</span>'
      : st === 'bad' ? '<span class="tl-pill tl-pill-bad">FAILED</span>'
      : '<span class="tl-pill tl-pill-run">RUNNING</span>';
    return '<div class="tl-item tl-act' + (st === 'bad' ? ' tl-end-bad' : '') + '"><div class="tl-ico"><div class="tl-tool">' + TOOL_ICON(tool, text) + '</div></div><div class="tl-txt"><span class="tl-name">' + esc(text) + '</span>' + p
      + (err ? '<div class="tl-err">' + esc(err) + '</div>' : '') + '</div></div>';
  };
  const nowRow = '<div class="tl-item tl-now"><div class="tl-ico"><div class="tl-live"></div></div><div class="tl-txt">Thinking<span class="tl-ell"></span></div></div>';

  function linesHtml(lines, active) {
    return '<div class="tl">' + (lines || []).map(l => row(l.text, l.k, l.st, l.pill, l.err, l.tool)).join('') + (active ? nowRow : '') + '</div>';
  }

  // ---------- V1.9.70: icon rows (no grid, no border). YouTube / Files / Termux / Globe are real glyphs. ----------
  const IC = {
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="5.4" width="18.8" height="13.2" rx="4"/><path class="ek-fill" d="M10.1 9.3v5.4l4.7-2.7z"/></svg>',
    files: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 6.8A1.8 1.8 0 0 1 5 5h4.2l2 2.3h7.8a1.8 1.8 0 0 1 1.8 1.8v8.1A1.8 1.8 0 0 1 19 19H5a1.8 1.8 0 0 1-1.8-1.8z"/></svg>',
    termux: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7 9.6l3 2.4-3 2.4M12.6 15h4.4"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3L16 12l4 4"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M6 8.2v7.6M18 11.2c0 3.6-6 2.4-12 5.6"/></svg>',
    graph: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="8" r="2.3"/><circle cx="12" cy="18" r="2.3"/><path d="M8 8l8 .6M7.3 9l3.7 7M16.8 10l-3.8 6.2"/></svg>',
    egg: '<img class="ek-egg-mini" src="ember-icon.svg" alt="">',
    brain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5a3 3 0 0 0-3 3v.2A3.2 3.2 0 0 0 4.5 11a3 3 0 0 0 1.3 2.5A3.2 3.2 0 0 0 9 19.5h.5V4.6zM15 4.5a3 3 0 0 1 3 3v.2a3.2 3.2 0 0 1 1.5 3.3 3 3 0 0 1-1.3 2.5 3.2 3.2 0 0 1-3.2 6h-.5V4.6z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.2 10"/></svg>',
    pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 2.8L7.8 18.8z"/><path d="M14.5 6.5l3 3"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3L5 13.5h5.5L10 21l8-10.5h-5.5z"/></svg>',
    key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="3.6"/><path d="M10.6 12.4L19 4M16 7l2.5 2.5M13.5 9.5L15.5 11.5"/></svg>',
    msg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9.5L5.5 19v-3.5H4z"/></svg>'
  };
  const iconKey = (tool, text, k) => {
    const x = String(tool || '').toLowerCase() + ' ' + String(text || '').toLowerCase();
    if (k !== 'a') return /^(asking |got a reply|.* switching to )/.test(x.trim()) ? 'egg' : ''; // plain thoughts keep a small dot
    if (/github|actions run|pushing .* to github|linked repo|studying |browsing /.test(x) || /^repo_/.test(String(tool || ''))) return 'github';
    if (/youtube|playlist|download|newpipe/.test(x) && !/^play_song|\bplaying\b/.test(x)) return 'youtube';
    if (/play_song|control_player|play_playlist|get_current_track|identify_song|create_playlist|get_library|\bplaying\b|pausing|resuming|skipping|going back a song|stopping the music|shuffle|repeat|volume|music library/.test(x)) return 'music';
    if (/termux|terminal|shell|bash|script|command|device|\.sh\b|launch|open app/.test(x)) return 'termux';
    if (/web|scrape|page|url|browser|site|http|searching the|reading [a-z0-9-]+\.[a-z]{2,}/.test(x)) return 'globe';
    if (/document|file|chunk|outline|notes?\b|writing |saved |\.pdf|\.md\b|\.svg|\.html?\b|searching your|library/.test(x)) return 'files';
    if (/music|song|track|player|lyrics/.test(x)) return 'music';
    if (/image|photo|vision/.test(x)) return 'image';
    if (/graph|mapping|connection/.test(x)) return 'graph';
    if (k === 'a') return 'egg';
    if (/^(asking |got a reply|.* switching to )/.test(x.trim())) return 'egg';
    return '';
  };
  const ekRowHtml = (l, drop) => {
    const act = l.k === 'a', key = l.ic && IC[l.ic] ? l.ic : iconKey(l.tool, l.text, l.k);
    const ico = key ? '<span class="ek-ico">' + IC[key] + '</span>' : '<span class="ek-ico"><i class="ek-dot"></i></span>';
    const pillCls = /^(saved|done|playing)$/i.test(l.pill || '') ? 'tl-pill-ok' : /^failed$/i.test(l.pill || '') ? 'tl-pill-bad' : 'tl-pill-warn';
    const pill = !act ? '' : l.pill ? '<span class="tl-pill ' + pillCls + '">' + esc(l.pill) + '</span>'
      : l.st === 'ok' ? '<span class="tl-pill tl-pill-ok">SUCCESS</span>'
      : l.st === 'bad' ? '<span class="tl-pill tl-pill-bad">FAILED</span>'
      : l.st === 'run' ? '<span class="tl-pill tl-pill-run">RUNNING</span>' : '';
    const sig = [l.text, l.st, l.pill, l.err, l.bad ? 1 : 0, l.pct || 0, l.ic || ''].join('|');
    return '<div class="ek-row' + (act ? ' ek-act' : '') + (l.st === 'run' ? ' ek-run' : '') + (l.bad ? ' ek-bad' : '') + (drop ? ' ek-drop' : '') + '" data-id="' + esc(l.id == null ? '' : l.id) + '"' + (l.key ? ' data-key="' + esc(l.key) + '"' : '') + ' data-sig="' + esc(sig) + '">'
      + ico + '<div class="ek-txt">' + esc(l.text) + pill + (l.err ? '<div class="tl-err">' + esc(l.err) + '</div>' : '') + (l.st === 'run' && l.pct > 0 ? '<div class="ek-bar"><i style="width:' + Math.min(100, Math.round(l.pct)) + '%"></i></div>' : '') + '</div></div>';
  };
  const rowsHtml = (lines, drop) => '<div class="ek-rows">' + (lines || []).map(l => ekRowHtml(l, drop)).join('') + '</div>';
  // Add rows that are new (they drop in), refresh rows whose state changed, never rebuild the rest.
  function syncRows(body) {
    let box = body.querySelector('.ek-rows');
    if (!box) { body.innerHTML = '<div class="ek-rows"></div>'; box = body.querySelector('.ek-rows'); }
    const v = vis(), ids = new Set(v.map(l => String(l.id)));
    try { const c = body.parentNode && body.parentNode.querySelector('.et-count'); if (c) c.textContent = countTxt(v); } catch (e) { /* header not drawn */ }
    Array.from(box.children).forEach(n => { if (!ids.has(n.getAttribute('data-id'))) n.remove(); });
    const have = {}; Array.from(box.children).forEach(n => { have[n.getAttribute('data-id')] = n; });
    v.forEach(l => {
      const cur = have[String(l.id)], fresh = ekRowHtml(l, !cur);
      if (!cur) { box.insertAdjacentHTML('beforeend', fresh); return; }
      const sig = [l.text, l.st, l.pill, l.err, l.bad ? 1 : 0, l.pct || 0, l.ic || ''].join('|');
      if (cur.getAttribute('data-sig') !== sig) { const t = document.createElement('div'); t.innerHTML = fresh; const nn = t.firstChild; nn.classList.remove('ek-drop'); cur.replaceWith(nn); }
    });
  }

  const STOP = '<button class="tl-stop" data-et="stop" aria-label="Stop current response" title="Stop current response">STOP</button>';
  const SW = '<button class="tl-x et-sw" data-et="style" aria-label="Switch thinking display" title="Switch thinking display">\u21c4</button>';
  // V1.9.70: the egg is the app icon (ember-icon.svg); an orange arc orbits it while Ember works.
  const SPIN = '<span class="et-egg" aria-hidden="true"><img class="et-egg-img" src="ember-icon.svg" alt=""><svg class="et-egg-ring" viewBox="0 0 40 40"><circle class="et-egg-arc" cx="20" cy="20" r="18"/></svg></span>';
  // V1.9.72: Manus-style progress, steps finished / steps started (actions only, not plain thoughts)
  const countTxt = V => { const a = (V || []).filter(l => l.k === 'a'); return a.length ? a.filter(l => l.st !== 'run').length + '/' + a.length : ''; };
  function innerHtml() { // live only
    const V = vis();
    if (getStyle() === 'claude') { // Rotating status first; tapping the row reveals the richer timeline.
      return '<div class="et-inner et-claude et-spin' + (live.open ? ' et-open' : '') + '">'
        + '<div class="et-hdr" data-et="toggle" role="button" aria-expanded="' + (live.open ? 'true' : 'false') + '" tabindex="0">'
        + SPIN + '<span class="et-led" aria-hidden="true"></span><span class="et-stage">' + statusSpan(statusOf()) + '</span><span class="et-count" aria-label="Steps done">' + countTxt(V) + '</span>' + STOP + SW
        + '<span class="et-drop-hint" aria-hidden="true">' + DOWN + '</span></div>'
        + '<div class="et-body"><div class="et-lines et-timeline-lines">' + rowsHtml(V, false) + '</div></div></div>';
    }
    if (getStyle() === 'dd') {
      return '<div class="et-inner' + (live.open ? ' et-open' : '') + '">'
        + '<div class="et-hdr" data-et="toggle">' + CHEV + '<span class="et-shimmer">Thinking\u2026</span>' + STOP + SW + '</div>'
        + '<div class="et-body"><div class="et-lines">' + (V.length ? V.map(l => '<p class="et-line' + (l.bad ? ' et-bad' : '') + '">' + esc(l.text) + '</p>').join('') : '<p class="et-line et-muted">Starting\u2026</p>') + '</div></div></div>';
    }
    return '<div class="tl-card tl-run' + (live.open ? ' tl-open' : '') + '">'
      + '<div class="tl-hdr" data-et="toggle">' + titleHtml(true, (V[V.length - 1] || {}).st === 'run', 0) + '<span class="tl-meta">' + V.length + ' steps</span>' + STOP + SW
      + '<span class="tl-chev2" data-et="toggle" aria-label="Collapse">' + DOWN + '</span></div>'
      + '<div class="tl-body">' + linesHtml(V, true) + '</div></div>';
  }

  function outerHtml() {
    return '<div id="typ" class="et-think' + (reactOn() ? ' et-hide' : '') + '">' + innerHtml() + '</div>';
  }

  function liveHtml() { return live ? outerHtml() : ''; }

  function savedHtml(tl) {
    if (!tl || !Array.isArray(tl.lines) || !tl.lines.length) return '';
    const secs = tl.ms ? (tl.ms / 1000).toFixed(1) + 's' : '\u2013';
    if (getStyle() === 'claude') {
      const saved = tl.lines.map(l => ({ id: '', text: l[0], bad: !!l[1], k: l[2] === 'a' ? 'a' : 't', st: l[2] === 'a' ? (l[1] ? 'bad' : 'ok') : '', pill: l[3], err: l[4], tool: l[5], key: l[6] || '', ic: l[7] || '' }));
      return '<details class="et-saved et-claude-saved ek-saved"><summary><span class="et-egg et-egg-static" aria-hidden="true"><img class="et-egg-img" src="ember-icon.svg" alt=""></span><span class="ek-done-t">Thought for ' + secs + '</span>' + DOWN + '</summary><div class="et-lines">' + rowsHtml(saved, false) + '</div></details>';
    }
    if (getStyle() === 'dd') {
      const lns = tl.lines.map(l => '<p class="et-line' + (l[1] ? ' et-bad' : '') + '">' + esc(l[0]) + '</p>').join('');
      return '<details class="et-saved"><summary>' + CHEV + '<span>Thought for ' + secs + '</span></summary><div class="et-lines">' + lns + '</div></details>';
    }
    const rows = tl.lines.map(l => row(l[0], l[2] === 'a' ? 'a' : 't', l[2] === 'a' ? (l[1] ? 'bad' : 'ok') : '', l[3], l[4], l[5])).join('');
    return '<div class="et-saved et-think"><div class="tl-card tl-saved"><div class="tl-hdr" data-et="saved">' + titleHtml(false, false, tl.ms) + '<span class="tl-meta">' + tl.lines.length + ' steps</span><span class="tl-chev2">' + DOWN + '</span></div><div class="tl-body"><div class="tl">' + rows + '</div></div></div></div>';
  }

  // ---------- events ----------
  // toggle open/closed: lightweight class flip, no innerHTML rebuild needed
  document.addEventListener('click', e => {
    const stop = e.target.closest && e.target.closest('[data-et="stop"]');
    if (stop && live) { e.preventDefault(); e.stopPropagation(); try { window.dispatchEvent(new CustomEvent('ember-stop-request', { detail: { scope: 'turn' } })); } catch (_) {} return; }
    const sw = e.target.closest && e.target.closest('[data-et="style"]');
    if (sw && live) { e.stopPropagation(); setStyle(nextStyle()); paint(); return; }
    const b = e.target.closest && e.target.closest('[data-et="toggle"]');
    if (!b || !live) return;
    live.open = !live.open;
    const c = b.closest('.tl-card'); if (c) c.classList.toggle('tl-open', live.open);
    const d = b.closest('.et-inner'); if (d) d.classList.toggle('et-open', live.open);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest && e.target.closest('button')) return; // Native button activation must not toggle the parent instead.
    const b = e.target.closest && e.target.closest('[data-et="toggle"]');
    if (!b || !live) return;
    e.preventDefault(); b.click();
  });

  document.addEventListener('click', e => { // V1.9.39: saved "Thought for Xs" card opens / closes
    const h = e.target.closest && e.target.closest('[data-et="saved"]'); if (!h) return;
    const c = h.closest('.tl-card'); if (c) c.classList.toggle('tl-open');
  });

  // hide/show when ReAct starts or ends
  window.addEventListener('ember-react', e => {
    const t = (e.detail || {}).type;
    if (t === 'start' || t === 'end') paint();
  });

  // Avoid flooding the thinking dropdown when the router retries the same provider/model
  // through duplicate keys or repeated fallback events during one turn.
  window.addEventListener('ember-try', e => {
    const d = e.detail || {};
    const label = 'Asking ' + d.name + (d.model && d.model != 'openai' ? ' (' + d.model + ')' : '') + '…';
    if (live) {
      live.trySeen = live.trySeen || new Set();
      const key = String(d.name || '') + '|' + String(d.model || '');
      if (live.trySeen.has(key)) return;
      live.trySeen.add(key);
    }
    note(label);
  });
  // Keep provider fallback visible in the same thinking card used by every routed engine.
  // The router emits this only after a different engine has successfully answered.
  window.addEventListener('ember-switch', e => {
    const d = e.detail || {};
    const label = id => { try { return window.Prov && Prov.label ? Prov.label(id) : String(id || 'engine'); } catch (_) { return String(id || 'engine'); } };
    const why = Number(d.status) === 429 ? 'was rate limited'
      : Number(d.status) === 401 || Number(d.status) === 403 ? 'key was rejected'
      : 'was unavailable';
    note(label(d.from) + ' ' + why + '; switching to ' + label(d.to));
  });
  // Native download lifecycle: rows come only from real job events from the NewPipe bridge.
  // While the turn is live the row updates in the live card; after the turn ended the same row is updated inside the saved "Thought for Xs".
  const dlText = d => {
    const title = String(d.title || 'track').replace(/\s+/g, ' ').trim().slice(0, 48), pct = Math.round(+d.pct || 0);
    const state = d.state === 'done' ? 'ok' : d.state === 'failed' ? 'bad' : 'run';
    return { state, text: state === 'ok' ? 'Saved ' + title + ' to Music/Ember' : state === 'bad' ? 'Download failed: ' + title : 'Downloading ' + title + (pct > 0 ? ' (' + pct + '%)' : ''), pill: state === 'run' ? String(d.engine || 'DOWNLOAD').toUpperCase() : state === 'ok' ? 'SAVED' : 'FAILED', err: state === 'bad' ? String(d.detail || '').slice(0, 140) : '', pct };
  };
  function patchSaved(msgs, key, f) { // finished turn: update the saved row in the message AND on screen
    let hit = null;
    (msgs || []).forEach(m => { if (m && m.tl && Array.isArray(m.tl.lines)) m.tl.lines.forEach(l => { if (l[6] === key) { l[0] = f.text; l[1] = f.state === 'bad' ? 1 : 0; l[3] = f.pill; l[4] = f.err || ''; hit = m; } }); });
    const el = document.querySelector('[data-key="' + String(key).replace(/"/g, '') + '"]');
    if (el) { const t = document.createElement('div'); t.innerHTML = ekRowHtml({ id: '', text: f.text, bad: f.state === 'bad', k: 'a', st: f.state, pill: f.pill, err: f.err, tool: 'youtube_download', key, pct: f.pct }, false); if (t.firstChild) el.replaceWith(t.firstChild); }
    return hit;
  }
  window.addEventListener('ember-dl', e => {
    const d = e.detail || {}; if (!d.id) return;
    const f = dlText(d), key = 'download:' + d.id;
    if (live) {
      // the real job row replaces the generic "Downloading audio" tool line, so one download is one row
      live.lines = live.lines.filter(l => !((l.tool === 'youtube_download' || l.tool === 'playlist_download') && !l.key));
      upsert(key, f.text, 'a', f.state, { pill: f.pill, err: f.err, pct: f.pct }); flush(); return;
    }
    let msgs = null; try { msgs = window.EmberBridge && window.EmberBridge.getConversation && window.EmberBridge.getConversation(); } catch (_) { msgs = null; }
    const hit = patchSaved(msgs, key, f);
    if (hit && f.state !== 'run') { try { window.dispatchEvent(new CustomEvent('ember-saved-row-changed')); } catch (_) {} }
  });
  window.addEventListener('ember-agent-note', e => { if (live && e.detail) note(String(e.detail)); });
  window.addEventListener('ember-duty', e => { if (live && e.detail && e.detail.text) note(String(e.detail.text), e.detail.key || 'duty'); });
  // V1.9.78: step(icon, text, key, opt): a thinking line with its own icon. Same key = the same line updated in place.
  function step(ic, text, key, opt) { return upsert(key || ('st' + (++uidc)), text, 't', '', Object.assign({ ic }, opt || {})); }
  window.EmberTimeline = { step, patchSaved, getStyle, setStyle, begin, drop, note, tool, upsert, unkey, collapse, snapshot, liveHtml, savedHtml, label, flush, _failed: failed, _live: () => live };
})();
