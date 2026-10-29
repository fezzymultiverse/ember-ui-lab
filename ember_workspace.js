/* Ember 1.10.13 — one GitHub card in the Command Centre and non-overlapping chat controls. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  function init() {
    const comp = document.querySelector('footer.comp');
    if (!comp || !window.EmberRepoRunner) return;
    // Move existing nodes: all original click handlers, provider checks and IDs survive.
    const bar = document.createElement('div'); bar.id = 'chatProviderBar';
    bar.setAttribute('aria-label', 'Chat provider connection and routing');
    const providers = $('bProv');
    if (providers) { const label = document.createElement('span'); label.textContent = 'Providers'; providers.append(label); bar.append(providers); }
    // Keep the engine status accessible in the centred header, but do not show an AI/status chip in the chat footer.
    if ($('bAiFeatures')) { $('bAiFeatures').classList.add('action-item'); $('bAiFeatures').innerHTML = '<span class="action-emoji">🧠</span><span class="action-txt"><b>AI Features</b><small>AI routing, media artifacts and downloads</small></span>'; $('headerActionsMenu')?.append($('bAiFeatures')); }
    if ($('provDrop')) bar.append($('provDrop'));
    comp.append(bar);
    // The real cancellation endpoint remains callable but never floats above the input.
    const stop = $('bStop');
    if (stop) { stop.tabIndex = -1; stop.setAttribute('aria-hidden', 'true'); }
    // ONE GitHub place: the Command Centre card. The same DOM nodes, IDs and handlers as before, just moved here.
    const card = $('eccGitHub');
    if (!card) return;
    const TABS = ['connect', 'repos', 'build', 'files', 'activity'];
    const tabBtns = Array.from(card.querySelectorAll('.ecc-gtabs [role="tab"]'));
    const stamp = () => new Date().toLocaleTimeString([], { hour12: false });
    function setTab(name) {
      if (!TABS.includes(name)) name = 'connect';
      card.dataset.gtab = name;
      tabBtns.forEach(x => { const on = x.dataset.gtab === name; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      if (name === 'repos' || name === 'build') { try { window.EmberRepoRunner.paintSources(); } catch (_) { /* runner not ready */ } }
      try { localStorage.setItem('ember_gh_tab', name); } catch (_) { /* storage blocked */ }
    }
    tabBtns.forEach(x => x.addEventListener('click', () => setTab(x.dataset.gtab)));
    card.querySelector('.ecc-gtabs').addEventListener('keydown', e => {
      const i = TABS.indexOf(card.dataset.gtab); let n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
      if (n < 0) return; e.preventDefault(); setTab(TABS[n]); const t = tabBtns[n]; if (t) t.focus();
    });
    let saved = 'connect'; try { saved = localStorage.getItem('ember_gh_tab') || 'connect'; } catch (_) { /* storage blocked */ }
    setTab(saved);
    function openRepos(tab) {
      if (typeof tab === 'string') setTab(tab);
      const settings = $('settings'); if (settings && settings.classList.contains('show') && $('bSx')) $('bSx').click();
      const ecc = $('emberCommandCenter');
      if (ecc && !ecc.classList.contains('ecc-open')) { if (window.EmberCommandCenter) window.EmberCommandCenter.open(); else if ($('bCommandCenter')) $('bCommandCenter').click(); }
      setTimeout(() => {
        try { card.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) { card.scrollIntoView(); }
        const first = card.dataset.gtab === 'connect' ? $('ghTok') : null; if (first) first.focus({ preventScroll: true });
      }, 160);
    }
    let checking = false;
    $('eccRunnerStatus').addEventListener('click', async () => {
      if (checking) return; checking = true; $('eccRunnerStatus').disabled = true;
      try {
        const r = await window.EmberRepoRunner.status();
        if (!r.ok) throw new Error(r.error);
        const text = r.runs.length ? r.runs.map(x => 'Run ' + x.id + ': ' + x.status + (x.conclusion ? ' / ' + x.conclusion : '') + '\n' + x.url).join('\n\n') : 'No runs found. Install/update the configured runner first.';
        $('eccActionStatus').textContent = '[' + stamp() + '] ' + text;
        window.EmberCommandCenter.write({ source: 'Repo Runner', stream: 'status', text });
      } catch (e) { $('eccActionStatus').textContent = '[' + stamp() + '] ' + e.message; }
      finally { checking = false; $('eccRunnerStatus').disabled = false; }
    });
    const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
    function gitSummary() {
      const g = window.EmberGithub, r = window.EmberRepoRunner; if (!g || !r) return { ready: false };
      const c = r.config(); let dg = null, st = { running: false, repos: {} };
      try { dg = g.digestOf(g.knowledgeSources()[0]); } catch (_) { /* no cache yet */ }
      try { st = g.syncState(); } catch (_) { /* idle */ }
      const live = Object.keys(st.repos || {}).map(k => st.repos[k]).filter(Boolean)[0];
      return { ready: true, token: g.on(), brain: c.brain, target: c.target, linked: Math.max(0, c.sources.length - 1), sources: c.sources.map(x => x.repo),
        files: dg ? dg.files || 0 : 0, synced: dg ? dg.syncedAt || 0 : 0, running: !!st.running, msg: live ? live.msg || '' : '', pct: live && live.pct ? live.pct : 0 };
    }
    function gitLine(s) {
      if (!s.ready) return 'GitHub engine not loaded.';
      const brain = s.running ? 'syncing ' + s.brain + (s.pct ? ' · ' + Math.round(s.pct) + '%' : '…') : s.synced ? s.brain + ' · ' + s.files + ' files · synced ' + ago(s.synced) : s.brain + ' · not loaded yet';
      return 'Brain: ' + brain + '\nLinked repos: ' + s.linked + ' · Output: ' + (s.target || 'not set') + ' · Token: ' + (s.token ? 'saved' : 'missing');
    }
    const gitChip = s => !s.ready ? 'OFF' : s.running ? 'SYNCING' : s.synced ? 'LOADED' : s.token ? 'TOKEN SAVED' : 'NO TOKEN';
    function summary() {
      const s = gitSummary(), line = $('eccRepoSummary'), chip = $('eccGitChip');
      if (line) line.textContent = gitLine(s);
      if (chip && chip.textContent !== gitChip(s)) chip.textContent = gitChip(s);
      try { window.dispatchEvent(new CustomEvent('ember-git-state')); } catch (_) { /* no listeners */ }
    }
    window.addEventListener('ember-repo-config', summary);
    window.addEventListener('ember-repo-runner-dispatched', summary);
    window.EmberGithub.sub(e => { if (e.type === 'state' || e.type === 'feed') summary(); });
    setInterval(summary, 30000); // keeps "synced 5 min ago" honest
    summary();
    // Same API the Hub and the chat widget already call, now served by the one card.
    window.EmberGit = { open: openRepos, close: () => { if (window.EmberCommandCenter) window.EmberCommandCenter.close(); }, isOpen: () => { const e = $('emberCommandCenter'); return !!(e && e.classList.contains('ecc-open')); }, summary: gitSummary, line: () => gitLine(gitSummary()) };
    // Update modal/docked semantics when rotating or resizing an already open panel.
    const media = matchMedia('(min-width: 1100px)');
    function resizePanel() {
      const panel = $('emberCommandCenter'), open = panel.classList.contains('ecc-open'), docked = open && (window.EmberPanelLayout ? window.EmberPanelLayout.canDock() : media.matches);
      document.body.classList.toggle('ecc-docked', docked); $('eccBackdrop').hidden = !open || docked;
      $('app').inert = open && !docked; panel.setAttribute('role', docked ? 'complementary' : 'dialog');
      if (open && !docked) { panel.setAttribute('aria-modal', 'true'); if (!panel.contains(document.activeElement)) $('eccClose').focus(); }
      else panel.removeAttribute('aria-modal');
    }
    media.addEventListener('change', resizePanel);
    window.addEventListener('resize', resizePanel); resizePanel();
    // A cancelled thinking row reflects the actual shared stop state, including redraws.
    let raf = 0;
    function stopState() {
      raf = 0; const stopping = !!stop?.disabled;
      document.querySelectorAll('#typ [data-et="stop"]').forEach(b => { b.disabled = stopping; const label = stopping ? 'Stopping…' : 'STOP'; if (b.textContent !== label) b.textContent = label; });
    }
    new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(stopState); }).observe($('log'), { childList: true, subtree: true });
    if (stop) new MutationObserver(stopState).observe(stop, { attributes: true, attributeFilter: ['disabled'] });
    window.EmberWorkspace = { open: openRepos, setTab, refresh: () => { window.EmberRepoRunner.paintSources(); summary(); } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
