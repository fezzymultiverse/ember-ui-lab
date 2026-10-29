// Ember V1.10.11 - ember_back.js: Android back closes the top panel instead of leaving the app.
// Opening the left panel, Settings, the right-hand Hub panel or the + menu adds one history entry; back closes the newest open one.
'use strict';
(() => {
  const W = window, D = document, $ = id => D.getElementById(id);
  const has = (id, cls) => { const e = $(id); return !!(e && e.classList.contains(cls)); };
  const DEFS = [
    { id: 'drawer', open: () => has('drawer', 'show'), close: () => { const b = $('bDx'); if (b) b.click(); } },
    { id: 'settings', open: () => has('settings', 'show'), close: () => { const b = $('bSx'); if (b) b.click(); } },
    { id: 'commandCenter', open: () => has('emberCommandCenter', 'ecc-open'), close: () => W.EmberCommandCenter?.close() },
    { id: 'hub', open: () => D.body.classList.contains('ehub-on'), close: () => { if (W.EmberHub && W.EmberHub.close) W.EmberHub.close(); } },
    { id: 'apis', open: () => has('emberApis', 'open'), close: () => { const b = $('emberApisClose'); if (b) b.click(); } },
    { id: 'plugins', open: () => D.body.classList.contains('epl-on'), close: () => { if (W.EmberPlugins) W.EmberPlugins.close(); } },
    { id: 'plus', open: () => { const m = $('plusMenu'); return !!(m && !m.classList.contains('hidden')); }, close: () => D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) },
  ];
  let stack = [];      // ids of panels that are open, oldest first
  let depth = 0;       // history entries Ember has pushed and not yet popped
  let ignore = 0;      // popstate events we caused ourselves
  let timer = null;

  function sync() {
    DEFS.forEach(d => {
      const on = d.open(), at = stack.indexOf(d.id);
      if (on && at < 0) stack.push(d.id);
      else if (!on && at >= 0) stack.splice(at, 1);
    });
    while (depth < stack.length) { try { history.pushState({ emberBack: true }, ''); depth++; } catch (e) { break; } }
    clearTimeout(timer);
    // Panels closed with their own buttons leave spare entries: drop them once things settle (a panel that closes while another opens must not race the push).
    timer = setTimeout(() => {
      const extra = depth - stack.length;
      if (extra > 0 && history.state && history.state.emberBack) { ignore++; depth -= extra; try { history.go(-extra); } catch (e) { ignore--; } }
    }, 120);
  }

  W.addEventListener('popstate', () => {
    if (ignore > 0) { ignore--; return; }
    if (depth > 0) depth--;
    const id = stack.pop();
    const d = DEFS.find(x => x.id === id);
    if (d && d.open()) d.close();
    setTimeout(sync, 0);
  });

  function watch() {
    const mo = new MutationObserver(sync);
    ['drawer', 'settings', 'plusMenu', 'emberApis', 'emberCommandCenter'].forEach(id => { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['class'] }); });
    mo.observe(D.body, { attributes: true, attributeFilter: ['class'] });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', watch); else watch();
})();
