// Ember V1.9.101 - ember_v96_ui.js: right-panel refinements.
// 1) "Ember" title sits on a grid line with 3 flashing blue lights (big to small) sweeping left to right.
// 2) The Command Centre is a widget at the bottom of the Settings list; tap its header to expand it.
// 3) Tapping the API-keys section opens a dedicated right sub-panel listing every provider
//    with its real brand logo and its name as the title.
// Nothing here rewrites existing behaviour: it only wraps, pins and opens.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  ready(() => {
    /* ---- 1) Ember title on the grid line + three blue sweep lights ---- */
    try {
      const who = document.querySelector('header .who'), name = $('pName');
      if (who && name && !name.closest('.ember-title-grid')) {
        const grid = document.createElement('span');
        grid.className = 'ember-title-grid';
        grid.setAttribute('aria-label', 'Ember active');
        const lights = document.createElement('span');
        lights.className = 'ember-lights'; lights.setAttribute('aria-hidden', 'true');
        lights.innerHTML = '<i></i><i></i><i></i>';
        grid.appendChild(name); grid.appendChild(lights);
        who.insertBefore(grid, who.firstChild);
        const old = who.querySelector('.ember-signal'); if (old) old.style.display = 'none';
      }
    } catch (e) { /* header polish is cosmetic */ }

    /* ---- 2) Command Centre widget at the BOTTOM of Settings; tap the header to expand ---- */
    try {
      const settings = $('settings'), sb = settings && settings.querySelector('.sb');
      if (settings && sb && !$('ccWidget')) {
        const CHEV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
        const w = document.createElement('section');
        w.id = 'ccWidget'; w.className = 'ccw'; w.setAttribute('aria-label', 'Ember Command Centre widget');
        w.innerHTML =
          '<button type="button" class="ccw-top" id="ccWidgetToggle" aria-expanded="false" aria-controls="ccWidgetBody">' +
          '<span class="ccw-ico" aria-hidden="true">◫</span>' +
          '<span class="ccw-t"><b>Ember Command Centre</b><small id="ccWidgetStatus">Waiting for a model request.</small></span>' +
          '<span class="ecc-chip">WIDGET</span><span class="ccw-chev" aria-hidden="true">' + CHEV + '</span></button>' +
          '<div class="ccw-body" id="ccWidgetBody" hidden>' +
            '<div class="ccw-tiles">' +
              '<div class="ccw-tile"><small>Memory files</small><b id="ccwMem">0</b></div>' +
              '<div class="ccw-tile"><small>Terminal</small><b id="ccwTerm">Idle</b></div>' +
              '<div class="ccw-tile"><small>Log lines</small><b id="ccwLines">0</b></div>' +
            '</div>' +
            '<div class="ccw-box ccw-git"><small>GITHUB</small><p id="ccwGit">GitHub engine not loaded.</p></div>' +
            '<div class="ccw-box ccw-thought"><small>THOUGHT SUMMARY</small><p id="ccwThought">No three-phase summary yet.</p></div>' +
            '<div class="ccw-btns"><button type="button" id="ccWidgetOpen">Open Command Centre</button>' +
            '<button type="button" id="ccWidgetRepos">GitHub</button></div>' +
          '</div>';
        sb.appendChild(w); // below the accordion wrap = bottom of the Settings list
        const openCC = () => { const b = $('bCommandCenter'); if (b) b.click(); };
        const txt = (id, fb) => { const e = $(id); return e && e.textContent ? e.textContent : fb; };
        const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
        const paint = () => {
          const thought = txt('eccThought', '').replace(/\s+/g, ' ').trim();
          set('ccwThought', !thought || /^(No three-phase|Waiting for)/.test(thought) ? 'No three-phase summary yet. It appears here after Ember’s next reply.' : (thought.length > 220 ? thought.slice(0, 220) + '…' : thought));
          set('ccwMem', txt('eccMemoryCount', '0'));
          set('ccwTerm', txt('eccTerminalStatus', 'Idle'));
          set('ccwLines', (txt('eccTerminalCount', '0 lines').match(/\d+/) || ['0'])[0]);
          set('ccWidgetStatus', txt('eccContextStatus', 'Waiting for a model request.'));
          try { if (window.EmberGit) set('ccwGit', window.EmberGit.line()); } catch (e) { /* github state is cosmetic */ }
        };
        const setOpen = open => {
          w.classList.toggle('open', open);
          w.querySelector('#ccWidgetToggle').setAttribute('aria-expanded', String(open));
          w.querySelector('#ccWidgetBody').hidden = !open;
          if (open) { paint(); setTimeout(() => { try { w.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch (e) { /* older WebView */ } }, 30); }
        };
        w.querySelector('#ccWidgetToggle').addEventListener('click', () => setOpen(!w.classList.contains('open')));
        w.querySelector('#ccWidgetOpen').addEventListener('click', openCC);
        w.querySelector('#ccWidgetRepos').addEventListener('click', () => { if (window.EmberWorkspace) window.EmberWorkspace.open(); else openCC(); });
        if (window.MutationObserver) {
          const mo = new MutationObserver(paint);
          ['eccThought', 'eccMemoryCount', 'eccTerminalStatus', 'eccTerminalCount', 'eccContextStatus'].forEach(id => { const e = $(id); if (e) mo.observe(e, { childList: true, characterData: true, subtree: true }); });
        }
        window.addEventListener('ember-git-state', paint);
        paint();
      }
    } catch (e) { /* widget is additive */ }

    /* ---- 3) API keys: a right-hand sub-panel with real logos + provider names ---- */
    const panel = document.createElement('aside');
    panel.id = 'keysSidePanel'; panel.setAttribute('aria-label', 'API keys and providers'); panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="ksp-head"><div><span class="ksp-eyebrow">EMBER / API KEYS</span><h3>API Keys &amp; Providers</h3>' +
      '<small class="ksp-sub">Real provider icons, live key state — opened to the right</small></div>' +
      '<button type="button" id="kspClose" aria-label="Close API keys panel">✕</button></div>' +
      '<div class="ksp-body"><div id="kspList" role="list"></div>' +
      '<button type="button" class="btn g" id="kspManage">Manage all keys in Settings</button>' +
      '<p class="ksp-note">Keys stay on this phone. A provider with no key can never show green.</p></div>';
    const backdrop = document.createElement('button');
    backdrop.id = 'kspBackdrop'; backdrop.className = 'ksp-backdrop'; backdrop.setAttribute('aria-label', 'Close API keys panel'); backdrop.hidden = true;
    document.body.appendChild(backdrop); document.body.appendChild(panel);

    let kOpen = false, suppressUntil = 0;
    const setKeysPanel = open => {
      kOpen = !!open;
      panel.classList.toggle('show', kOpen);
      panel.setAttribute('aria-hidden', String(!kOpen));
      backdrop.hidden = !kOpen;
    };
    const dotCls = st => ({ ok: 'ok', limited: 'limited', bad: 'bad' }[st] || (st === 'unknown' ? 'unknown' : 'none'));
    const paintKeys = () => {
      const list = $('kspList'); if (!list) return;
      const P = window.Prov;
      if (!P || !P.IDS) { list.innerHTML = '<p class="ksp-note">Providers not ready yet.</p>'; return; }
      list.innerHTML = P.IDS.map(id => {
        const c = P.CFG[id] || { name: id };
        let n = 0; try { n = P.entries(id).length; } catch (e) { /* state is cosmetic */ }
        let st = 'unknown'; try { st = P.stateOf(id); } catch (e) { /* state is cosmetic */ }
        const badge = window.EmberProviderBadge ? window.EmberProviderBadge(id) : '';
        return '<button type="button" class="ksp-row' + (n ? '' : ' ksp-dim') + '" role="listitem" data-id="' + esc(id) + '">' +
          '<span class="ksp-dot ' + dotCls(st) + '" aria-hidden="true"></span>' + badge +
          '<span class="ksp-info"><b class="provider-title">' + esc(c.name) + '</b>' +
          '<small>' + (n ? n + ' key' + (n === 1 ? '' : 's') + ' saved' : 'no key yet') + '</small></span>' +
          '<span class="ksp-go" aria-hidden="true">›</span></button>';
      }).join('');
    };
    const openKeysPanel = () => { paintKeys(); setKeysPanel(true); };
    panel.addEventListener('click', e => {
      if (e.target.closest('#kspClose') || e.target === panel) { setKeysPanel(false); return; }
      const row = e.target.closest('.ksp-row');
      if (row || e.target.closest('#kspManage')) {
        setKeysPanel(false); suppressUntil = Date.now() + 1200; // opening Settings below must not re-trigger this panel
        const s = $('bSet'); if (s && !$('settings').classList.contains('show')) s.click();
        setTimeout(() => {
          document.querySelectorAll('#stabs [data-st]').forEach(t => t.classList.remove('on'));
          const t = document.querySelector('#stabs [data-st="keys"]'); if (t) { t.classList.add('on'); t.click(); }
          const h = document.querySelector('.acc-item[data-acc="keys"] .acc-h'); if (h && h.getAttribute('aria-expanded') !== 'true') h.click();
          const item = document.querySelector('.acc-item[data-acc="keys"]'); if (item) item.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 80);
      }
    });
    backdrop.addEventListener('click', () => setKeysPanel(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && kOpen) setKeysPanel(false); });

    // Triggers: the API-keys row in the accordion, the Keys tab, and the new header action.
    document.addEventListener('click', e => {
      const accH = e.target.closest && e.target.closest('.acc-item[data-acc="keys"] .acc-h');
      const tab = e.target.closest && e.target.closest('#stabs [data-st="keys"]');
      if ((accH || tab) && Date.now() > suppressUntil) setTimeout(openKeysPanel, 120); // let the accordion open underneath too
      if (e.target.closest && e.target.closest('#bKeysMenu')) { e.stopPropagation(); openKeysPanel(); }
    }, true); // capture: fires alongside, never blocks, the existing handlers
    window.addEventListener('ember-provider-stats', () => { if (kOpen) paintKeys(); });
    window.addEventListener('ember-names', () => { if (kOpen) paintKeys(); });
  });
})();
