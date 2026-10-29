// Ember V1.10.11 - ember_hub.js: the right-hand side panel ("Ember Hub"), the first level of Settings.
// Every option opens a page to the RIGHT with a Back arrow (no drop-downs):
//   Settings > API keys > one provider      Settings > Command Centre      Settings > any section (opens the Settings sheet)
// Key values are only ever shown masked (first 6 + last 4 characters, via Prov.mask).
'use strict';
(() => {
  const D = document, $ = id => D.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SECTIONS = [
    { id: 'general', ico: 'sliders', title: 'General, Persona & Memory', desc: 'Free Mode, your name, voice and pacing, memory, look, backup' },
    { id: 'keys', ico: 'key', title: 'Engine Keys & Providers', desc: 'Which engine answers, API keys, engine names' },
    { id: 'features', ico: 'spark', title: 'Features', desc: 'AI routing, media artifacts and downloads' },
    { id: 'scraping', ico: 'globe', title: 'Web Scraping', desc: 'Scraper keys, the free reader, health checks and tests' },
    { id: 'hacking', ico: 'terminal', title: 'Termux & Hacking', desc: 'Termux mode, pen-test persona and the built-in terminal' },
    { id: 'music', ico: 'music', title: 'Music', desc: 'Player, song identification, music control, documents' },
    { id: 'permissions', ico: 'shield', title: 'Permissions, Voice & Background', desc: 'Notifications, mic, battery, keep-alive, read aloud' }
  ];
  const STATE_LABEL = { ok: 'working', limited: 'rate-limited', bad: 'failing', unknown: 'not checked', none: 'no key' };
  const TAB_FOR_KIND = { scraper: 'scraping', 'web search': 'scraping', 'code host': 'github', 'song id': 'music' };
  const CC_WAIT = /^(No three-phase|Waiting for)/;

  let isOpen = false, lastFocus = null, painting = false, checking = false;
  let panel = null, backdrop = null;

  function ready(fn) { if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', fn); else fn(); }
  function badge(id) {
    try { if (window.EmberProviderBadge) return window.EmberProviderBadge(id); } catch (e) { /* logo is cosmetic */ }
    return '<span class="ehub-fallback" aria-hidden="true">' + esc(String(id).slice(0, 2).toUpperCase()) + '</span>';
  }

  const IC = (n, sz, c) => (window.EmberIcons ? window.EmberIcons.svg(n, sz, c) : '');
  const TILE = n => (window.EmberIcons ? window.EmberIcons.tile(n) : '<span class="em-tile">' + esc(n.slice(0, 1)) + '</span>');
  const CHEV = '<svg class="mrow-c" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const ROW = (attrs, tile, title, sub, subId, extra) =>
    '<button type="button" class="mrow" ' + attrs + '>' + tile +
    '<span class="mrow-t"><b>' + title + '</b><small' + (subId ? ' id="' + subId + '"' : '') + '>' + sub + '</small></span>' + (extra || '') + CHEV + '</button>';

  // view stack: root > (keys > prov) | cc
  const VIEW_TITLE = { workspace: 'Workspace', root: 'Settings', keys: 'API keys', prov: 'Provider', cc: 'Command Centre' };
  let stack = ['root'], curProv = null;

  function build() {
    backdrop = D.createElement('button');
    backdrop.type = 'button'; backdrop.id = 'ehubBackdrop'; backdrop.className = 'ehub-backdrop';
    backdrop.setAttribute('aria-label', 'Close side panel'); backdrop.tabIndex = -1; backdrop.hidden = true;

    panel = D.createElement('aside');
    panel.id = 'emberHub'; panel.className = 'ehub';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'ehubTitle'); panel.setAttribute('aria-hidden', 'true'); panel.inert = true;
    panel.innerHTML =
      '<div class="ehub-head">' +
        '<button type="button" id="ehubBack" class="ehub-x ehub-back" aria-label="Back" hidden>' + IC('chevL', 18) + '</button>' +
        '<div class="ehub-ttl"><h2 id="ehubTitle">Settings</h2><small id="ehubCrumb">Ember</small></div>' +
        '<button type="button" id="ehubClose" class="ehub-x" aria-label="Close side panel">' + IC('close', 18) + '</button>' +
      '</div>' +
      '<div class="ehub-body">' +

      '<div class="ehub-view" data-view="workspace" hidden>' +
        '<p id="ehubWorkspaceContext" class="ehub-note"></p>' +
        '<div id="ehubChatContext" class="ehub-context-group">' +
          '<div class="mgrp">' + ROW('data-context-action="docs"', TILE('doc'), 'Files &amp; notes', 'Open the existing Documents workspace') + '</div>' +
          '<details class="ehub-context-details" open><summary>Sources in the latest request</summary><ul id="ehubSources"></ul><p id="ehubSourcesEmpty" class="ehub-note">No file excerpts observed yet.</p></details>' +
        '</div>' +
        '<div id="ehubTerminalContext" class="ehub-context-group" hidden>' +
          '<div class="ecx-card"><small>Connection status</small><p id="ehubConnection"></p></div>' +
          '<div class="mgrp">' + ROW('data-context-action="setup"', TILE('terminal'), 'Terminal setup', 'Open the existing bridge setup controls') + '</div>' +
        '</div>' +
        '<details class="ehub-context-details"><summary>Recent activity</summary><p id="ehubRecentActivity" class="ehub-note"></p></details>' +
        '<div class="mgrp">' + ROW('data-context-action="command"', TILE('panel'), 'Command Centre', 'Inspect live context and existing repository actions') + '</div>' +
      '</div>' +

      /* ---- root ---- */
      '<div class="ehub-view" data-view="root">' +
        '<div class="mgrp">' +
          ROW('id="ehubKeysBtn" data-view-open="keys"', TILE('key'), 'API keys', 'Tap to see every provider', 'ehubKeysSum') +
          ROW('id="ehubCCToggle" data-view-open="cc"', TILE('panel'), 'Command Centre', 'Waiting for a model request.', 'ehubCCCtx', '<span class="ehub-chip" id="ehubCC"><i class="ehub-live"></i>LIVE</span>') +
        '</div>' +
        '<h3 class="ehub-h">All settings</h3>' +
        '<div class="mgrp">' +
          SECTIONS.map(s => ROW('data-go="' + s.id + '"', TILE(s.ico), esc(s.title), esc(s.desc))).join('') +
        '</div>' +
        '<div class="ehub-brand" aria-label="S.O.I. by Bojack Security"><b>S.O.I. × Bojack Security</b><small>Strategy Over Impulse · 999</small></div>' +
      '</div>' +

      /* ---- API keys: provider list ---- */
      '<div class="ehub-view" data-view="keys" hidden><div id="ehubKeysList" class="ehub-keys"></div></div>' +

      /* ---- one provider ---- */
      '<div class="ehub-view" data-view="prov" hidden><div id="ehubProv" class="ehub-prov"></div></div>' +

      /* ---- Command Centre ---- */
      '<div class="ehub-view" data-view="cc" hidden>' +
        '<h3 class="ehub-h">Live</h3>' +
        '<div class="ecx-grid">' +
          '<div class="ecx-tile"><small>Memory files</small><b id="ehubCCMem">0</b></div>' +
          '<div class="ecx-tile"><small>Terminal</small><b id="ehubCCTerm">Idle</b></div>' +
          '<div class="ecx-tile"><small>Log lines</small><b id="ehubCCLines">0</b></div>' +
          '<div class="ecx-tile"><small>Scrapers</small><b id="ehubCCScr">0</b></div>' +
        '</div>' +
        '<div class="ecx-card"><small>Thought summary</small><p id="ehubCCThought">No three-phase summary yet.</p></div>' +
        '<h3 class="ehub-h">GitHub</h3>' +
        '<div class="ecx-card"><small>Status</small><p id="ehubCCGit">GitHub engine not loaded.</p></div>' +
        '<div class="mgrp">' +
          ROW('id="ehubGitBtn"', TILE('branch'), 'GitHub', 'Token, brain, repos, builds and files in the Command Centre', 'ehubGitSum') +
        '</div>' +
        '<div class="ecx-btns"><button type="button" class="ehub-btn ehub-btn-hot" id="ehubCCOpen">Open Command Centre</button>' +
        '<button type="button" class="ehub-btn" id="ehubCCRepos">GitHub</button></div>' +
      '</div>' +
      '</div>';

    D.body.appendChild(backdrop);
    D.body.appendChild(panel);
  }

  /* ---------------- view stack (pages slide in from the right) ---------------- */
  function paintHead() {
    const cur = stack[stack.length - 1], t = $('ehubTitle'), c = $('ehubCrumb'), b = $('ehubBack');
    let title = VIEW_TITLE[cur] || 'Settings', crumb = 'Ember';
    if (cur === 'prov') { const P = window.Prov; title = (P && P.CFG && curProv && P.CFG[curProv] ? P.CFG[curProv].name : 'Provider'); crumb = 'API keys'; }
    else if (cur === 'workspace') crumb = terminalContext() ? 'Termux' : 'Current chat';
    else if (cur !== 'root') crumb = 'Settings';
    if (t) t.textContent = title; if (c) c.textContent = crumb; if (b) b.hidden = stack.length < 2;
  }
  function showView(name, dir) {
    panel.querySelectorAll('.ehub-view').forEach(v => {
      const on = v.dataset.view === name;
      v.hidden = !on; v.classList.remove('ehub-in-fwd', 'ehub-in-back');
      if (on && dir) { void v.offsetWidth; v.classList.add(dir === 'back' ? 'ehub-in-back' : 'ehub-in-fwd'); }
    });
    const body = panel.querySelector('.ehub-body'); if (body) body.scrollTop = 0;
    paintHead();
  }
  function push(name) {
    if (stack[stack.length - 1] === name) return;
    stack.push(name);
    if (name === 'keys') paintKeys(); else if (name === 'prov') paintProv(); else if (name === 'cc') paintCC();
    showView(name, 'fwd');
  }
  function pop() {
    if (stack.length < 2) return false;
    stack.pop(); showView(stack[stack.length - 1], 'back'); return true;
  }
  function resetStack() { stack = ['root']; curProv = null; if (panel) showView('root', null); }

  /* ---------------- open / close ---------------- */
  let workspaceMode = false, inertRoots = [];
  function terminalContext() {
    const s = $('settings'), t = $('etPanel');
    return !!(s?.classList.contains('show') && t && !t.classList.contains('hidden') && t.getClientRects().length);
  }
  function paintWorkspace() {
    if (!panel || !workspaceMode) return;
    const terminal = terminalContext();
    $('ehubChatContext').hidden = terminal; $('ehubTerminalContext').hidden = !terminal;
    const project = $('projBadge');
    $('ehubWorkspaceContext').textContent = terminal ? 'Terminal setup and live connection details.' :
      (project && !project.classList.contains('hidden') ? 'Project: ' + ($('projBadgeName')?.textContent || 'Current project') : 'Files, notes and observed sources for this chat.');
    $('ehubConnection').textContent = $('etSub')?.textContent || 'Not connected';
    $('ehubRecentActivity').textContent = $('eccTerminalTicker')?.textContent || 'No recent activity.';
    // Read the public provenance list, not keys, private reasoning or terminal screen text.
    const sources = $('eccMemory'), out = $('ehubSources');
    const text = sources?.textContent || '';
    if (out.dataset.sourceText !== text) {
      out.replaceChildren();
      sources?.querySelectorAll('li').forEach(item => {
        const row = D.createElement('li'); row.textContent = item.textContent; out.append(row);
      });
      out.dataset.sourceText = text;
    }
    $('ehubSourcesEmpty').hidden = !!out.children.length;
    paintHead();
  }
  function restoreRoots() {
    inertRoots.forEach(([el, value]) => { el.inert = value; }); inertRoots = [];
  }
  function focusInside() {
    if (isOpen && !D.body.classList.contains('ehub-docked') && !panel.contains(D.activeElement)) $('ehubClose').focus({ preventScroll: true });
  }
  function syncLayout() {
    if (!panel) return;
    restoreRoots();
    const docked = isOpen && workspaceMode && window.EmberPanelLayout?.canDock();
    D.body.classList.toggle('ehub-docked', !!docked);
    backdrop.hidden = !isOpen || !!docked;
    panel.setAttribute('role', docked ? 'complementary' : 'dialog');
    if (isOpen && !docked) {
      panel.setAttribute('aria-modal', 'true');
      ['app', 'settings'].forEach(id => { const el = $(id); if (el) { inertRoots.push([el, el.inert]); el.inert = true; } });
      if (!panel.contains(D.activeElement)) $('ehubClose').focus({ preventScroll: true });
      requestAnimationFrame(() => requestAnimationFrame(focusInside));
    } else panel.removeAttribute('aria-modal');
    $('bPanelTop')?.setAttribute('aria-expanded', String(isOpen && workspaceMode));
    $('bPanelTerm')?.setAttribute('aria-expanded', String(isOpen && workspaceMode));
    window.EmberPanelLayout?.refresh();
  }
  function openWorkspace() {
    if (isOpen && workspaceMode) { setOpen(false); return; }
    workspaceMode = true;
    if (!isOpen) setOpen(true);
    stack = ['workspace']; panel.dataset.context = 'workspace';
    showView('workspace', null); paintWorkspace(); syncLayout();
  }
  function setOpen(open) {
    if (open === isOpen || !panel) return;
    isOpen = open;
    if (open) { window.EmberCommandCenter?.close(); lastFocus = D.activeElement; }
    panel.classList.toggle('ehub-open', open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    backdrop.hidden = !open;
    D.body.classList.toggle('ehub-on', open);
    if (open) { resetStack(); paintCC(); paintKeys(); const c = $('ehubClose'); if (c) c.focus({ preventScroll: true }); }
    else { workspaceMode = false; delete panel.dataset.context; }
    syncLayout();
    if (!open && lastFocus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* element may be gone */ } }
  }

  // Opens the original, untouched Settings screen (optionally on one section).
  function classic(tab) {
    setOpen(false);
    if (tab === 'github') { setTimeout(() => { if (window.EmberGit) window.EmberGit.open('connect'); }, 250); return; } // GitHub lives only in the Command Centre
    const bSet = $('bSet'); if (!bSet) return;
    if (!$('settings').classList.contains('show')) bSet.click(); // synthetic click: our interceptor ignores it, the original handler runs
    if (!tab) return;
    setTimeout(() => {
      const t = D.querySelector('#stabs [data-st="' + tab + '"]'); if (t) t.click();
      // the older keys side panel auto-opens on the Keys section; this panel replaces it, so tuck it away
      setTimeout(() => { const k = $('keysSidePanel'); if (k && k.classList.contains('show')) { const x = $('kspClose'); if (x) x.click(); } }, 260);
    }, 90);
  }

  function openCommandCentre(repos) {
    setOpen(false);
    setTimeout(() => {
      const b = $('bCommandCenter'), ecc = $('emberCommandCenter');
      if (b && !(ecc && ecc.classList.contains('ecc-open'))) b.click();
      if (repos) setTimeout(() => { if (window.EmberWorkspace) window.EmberWorkspace.open(); }, 380);
    }, 250);
  }

  /* ---------------- Command Centre widget ---------------- */
  function txt(id, fallback) { const e = $(id); return e && e.textContent != null && e.textContent !== '' ? e.textContent : fallback; }
  function paintCC() {
    if (!panel) return;
    const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
    const thought = txt('eccThought', '').replace(/\s+/g, ' ').trim();
    set('ehubCCThought', !thought || CC_WAIT.test(thought) ? 'No three-phase summary yet. It appears here after Ember’s next reply.' : (thought.length > 220 ? thought.slice(0, 220) + '…' : thought));
    set('ehubCCMem', txt('eccMemoryCount', '0'));
    set('ehubCCTerm', txt('eccTerminalStatus', 'Idle'));
    set('ehubCCLines', (txt('eccTerminalCount', '0 lines').match(/\d+/) || ['0'])[0]);
    try { if (window.EmberPlugins) { const s = window.EmberPlugins.scrapers(); set('ehubCCScr', s.on ? String(s.live.length) : 'Off'); } } catch (e) { /* cosmetic */ }
    set('ehubCCCtx', txt('eccContextStatus', 'Waiting for a model request.'));
    try {
      if (window.EmberGit) {
        const g = window.EmberGit.summary();
        set('ehubCCGit', window.EmberGit.line());
        set('ehubGitSum', g.ready ? (g.synced ? g.brain + ' · ' + g.files + ' files' : 'Brain not loaded yet') + ' · ' + g.linked + ' linked · tap to manage' : 'Token, brain, repos, builds and files in the Command Centre');
      }
    } catch (e) { /* github state is cosmetic here */ }
    const live = D.querySelector('#ehubCC .ehub-live'); if (live) live.classList.toggle('busy', /active/i.test(txt('eccTerminalStatus', '')));
  }
  function watchCC() {
    if (!window.MutationObserver) return;
    const mo = new MutationObserver(() => { if (isOpen) { paintCC(); paintWorkspace(); } });
    ['eccThought', 'eccMemoryCount', 'eccMemory', 'eccTerminalTicker', 'etSub', 'eccTerminalStatus', 'eccTerminalCount', 'eccContextStatus'].forEach(id => {
      const e = $(id); if (e) mo.observe(e, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ---------------- API keys dropdown ---------------- */
  function keyState(e) {
    if (!e) return { cls: 'none', text: 'empty' };
    if (e.bad) return { cls: 'bad', text: 'rejected' };
    const s = e.st; if (!s) return { cls: 'unknown', text: 'not checked yet' };
    if (s.ok) return s.limited ? { cls: 'limited', text: 'rate-limited, key is valid' } : { cls: 'ok', text: 'working' + (s.ms ? ' · ' + s.ms + ' ms' : '') };
    return { cls: 'bad', text: s.msg || 'failed' };
  }
  function maskKey(P, k) {
    const v = String(k == null ? '' : k);
    try { if (P && typeof P.mask === 'function') return P.mask(v); } catch (e) { /* fall through */ }
    return v.length > 12 ? v.slice(0, 6) + '…' + v.slice(-4) : v.slice(0, 3) + '…';
  }
  function provInfo(id) {
    const P = window.Prov, c = (P && P.CFG && P.CFG[id]) || { name: id };
    let entries = []; try { entries = P.entries(id) || []; } catch (e) { /* state is cosmetic */ }
    let st = entries.length ? 'unknown' : 'none'; try { st = P.stateOf(id); } catch (e) { /* state is cosmetic */ }
    return { c, entries, st };
  }
  function paintKeys() {
    if (!panel || painting) return;
    painting = true;
    try {
      const list = $('ehubKeysList'), sum = $('ehubKeysSum'), P = window.Prov;
      if (!list) return;
      if (!P || !P.IDS) { list.innerHTML = '<p class="ehub-note">Providers are not ready yet. Close and reopen this panel in a moment.</p>'; return; }
      let withKeys = 0, total = 0, html = '<div class="mgrp">';
      P.IDS.forEach(id => {
        const { c, entries, st } = provInfo(id);
        if (entries.length) withKeys++; total += entries.length;
        html += '<button type="button" class="mrow' + (entries.length ? '' : ' dim') + '" data-prov-open="' + esc(id) + '">' +
          '<span class="ehub-dot ' + esc(st) + '" aria-hidden="true"></span>' + badge(id) +
          '<span class="mrow-t"><b class="provider-title">' + esc(c.name) + '</b>' +
          '<small>' + (entries.length ? entries.length + ' key' + (entries.length === 1 ? '' : 's') + ' · ' + esc(STATE_LABEL[st] || st) : 'no key yet') + '</small></span>' + CHEV + '</button>';
      });
      html += '</div>';

      // Other keys Ember tracks (scrapers, Tavily, GitHub, Audd). Names and counts only.
      let extra = [];
      try {
        const K = window.EmberKeys; if (K && K.inventory) extra = K.inventory().filter(x => P.IDS.indexOf(x.id) < 0);
      } catch (e) { /* inventory is cosmetic */ }
      if (extra.length) {
        html += '<h3 class="ehub-h">Search, scraping &amp; other keys</h3><div class="mgrp">';
        extra.forEach(x => {
          if (x.saved) { withKeys++; total += x.saved; }
          html += '<button type="button" class="mrow' + (x.saved ? '' : ' dim') + '" data-go="' + esc(TAB_FOR_KIND[x.kind] || 'keys') + '">' +
            '<span class="ehub-dot ' + (x.saved ? 'ok' : 'none') + '" aria-hidden="true"></span>' +
            '<span class="ehub-fallback" aria-hidden="true">' + esc(String(x.name || x.id).slice(0, 2).toUpperCase()) + '</span>' +
            '<span class="mrow-t"><b class="provider-title">' + esc(x.name) + '</b><small>' + esc(x.kind) + ' · ' + (x.saved ? x.saved + ' saved' : 'no key yet') + '</small></span>' + CHEV + '</button>';
        });
        html += '</div>';
      }
      html += '<p class="ehub-note">Keys stay on this phone and are only shown masked. A provider with no key can never show green.</p>';
      list.innerHTML = html;
      if (sum) sum.textContent = total + ' key' + (total === 1 ? '' : 's') + ' across ' + withKeys + ' provider' + (withKeys === 1 ? '' : 's');
    } finally { painting = false; }
  }
  function paintProv() {
    const box = $('ehubProv'), P = window.Prov; if (!box || !curProv || !P) return;
    const { c, entries } = provInfo(curProv);
    const keys = entries.length ? '<div class="mgrp">' + entries.map((e, i) => {
      const ks = keyState(e);
      return '<div class="mrow ehub-key"><span class="ehub-kn">#' + (i + 1) + '</span><span class="mrow-t"><code>' + esc(maskKey(P, e && e.key)) + '</code></span>' +
        '<span class="ehub-kst ' + ks.cls + '">' + esc(ks.text) + '</span></div>';
    }).join('') + '</div>' : '<p class="ehub-note">No key saved for ' + esc(c.name) + '. Add one in Engine keys.</p>';
    box.innerHTML = '<div class="ehub-prov-head">' + badge(curProv) + '<span class="mrow-t"><b class="provider-title">' + esc(c.name) + '</b><small>' +
      entries.length + ' key' + (entries.length === 1 ? '' : 's') + '</small></span></div>' + keys +
      '<div class="ehub-pact">' +
        (entries.length ? '<button type="button" class="ehub-btn" data-check="' + esc(curProv) + '">Check key' + (entries.length === 1 ? '' : 's') + '</button>' : '') +
        '<button type="button" class="ehub-btn ehub-btn-hot" data-manage="1">' + (entries.length ? 'Manage keys' : 'Add a key') + '</button>' +
      '</div>';
  }
  async function checkProvider(id, btn) {
    const P = window.Prov; if (!P || typeof P.ping !== 'function' || checking) return;
    checking = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    try { await P.ping(id); } catch (e) { /* ping records its own failure state */ }
    checking = false; paintKeys(); paintProv();
  }

  /* ---------------- wiring ---------------- */
  ready(() => {
    if ($('emberHub')) return;
    build(); watchCC();
    panel.addEventListener('transitionend', focusInside);
    function addPanelButton(host, id) {
      if (!host || $(id)) return;
      const b = D.createElement('button'); b.type = 'button'; b.id = id; b.className = 'ember-panel-button';
      b.textContent = 'Panel'; b.setAttribute('aria-label', 'Open workspace panel');
      b.setAttribute('aria-controls', 'emberHub'); b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', openWorkspace); host.prepend(b);
    }
    addPanelButton(D.querySelector('#app > header .hr'), 'bPanelTop');
    addPanelButton($('etHead'), 'bPanelTerm');
    window.addEventListener('resize', syncLayout);
    window.matchMedia('(min-width: 1100px)').addEventListener('change', syncLayout);
    panel.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !isOpen || D.body.classList.contains('ehub-docked')) return;
      const nodes = [...panel.querySelectorAll('button:not(:disabled), summary, input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .filter(el => !el.closest('[hidden], [inert]') && el.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first?.focus(); }
    });

    // Real taps on Settings (header dropdown) open this panel. Programmatic clicks (other features) keep the classic screen.
    D.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('#bSet');
      if (!b || !e.isTrusted) return;
      e.preventDefault(); e.stopImmediatePropagation();
      setOpen(true);
    }, true);

    panel.addEventListener('click', e => {
      const t = e.target;
      const action = t.closest('[data-context-action]')?.dataset.contextAction;
      if (action) {
        const terminal = terminalContext();
        setOpen(false);
        if (action === 'docs') $('bDocsQuick')?.click();
        if (action === 'command') openCommandCentre(false);
        if (action === 'setup' && terminal) {
          window.EmberTerm?.setPanel('full');
          D.querySelector('#etTabs [data-v="setup"]')?.click();
        }
        return;
      }
      if (t.closest('#ehubClose')) { setOpen(false); return; }
      if (t.closest('#ehubBack')) { pop(); return; }
      const vo = t.closest('[data-view-open]'); if (vo) { push(vo.getAttribute('data-view-open')); return; }
      const po = t.closest('[data-prov-open]'); if (po) { curProv = po.getAttribute('data-prov-open'); push('prov'); return; }
      if (t.closest('#ehubCCOpen')) { openCommandCentre(false); return; }
      if (t.closest('#ehubCCRepos') || t.closest('#ehubGitBtn')) { if (window.EmberGit) { setOpen(false); window.EmberGit.open(); } else { openCommandCentre(true); } return; }
      const chk = t.closest('[data-check]'); if (chk) { checkProvider(chk.getAttribute('data-check'), chk); return; }
      if (t.closest('[data-manage]')) { classic('keys'); return; }
      const go = t.closest('[data-go]'); if (go) classic(go.getAttribute('data-go'));
    });
    backdrop.addEventListener('click', () => setOpen(false));
    D.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) { e.stopPropagation(); if (!pop()) setOpen(false); } });

    // swipe right on the panel to dismiss
    let sx = 0, sy = 0, tracking = false;
    panel.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = e.touches.length === 1; }, { passive: true });
    panel.addEventListener('touchend', e => {
      if (!tracking) return; tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
      if (dx > 90 && dy < 50) { if (!pop()) setOpen(false); }
    }, { passive: true });

    window.addEventListener('ember-provider-stats', () => { if (isOpen) { paintKeys(); paintProv(); } });
    window.addEventListener('ember-names', () => { if (isOpen) { paintKeys(); paintProv(); } });
    window.addEventListener('ember-git-state', () => { if (isOpen) { paintCC(); paintWorkspace(); } });
    window.EmberHub = { section: tab => classic(tab), workspace: openWorkspace, open: () => { workspaceMode = false; delete panel.dataset.context; if (isOpen) { resetStack(); syncLayout(); } else setOpen(true); }, close: () => setOpen(false), isOpen: () => isOpen };
  });
})();
