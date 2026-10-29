// Ember V1.9.84 - ember_v83.js: the Modes pill (Chill / Sharp / Deep live behind it) and the Device tools button in Settings.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const pill = $('bModes'), pop = $('modes'), lbl = $('modesLbl');
  if (pill && pop && lbl) {
    document.body.appendChild(pop); // out of the composer, so no row can clip it; the three buttons and their handlers are the same nodes app.js already wired
    const NAMES = { chill: 'Chill', sharp: 'Sharp', deep: 'Deep' };
    const current = () => {
      const on = pop.querySelector('button.on'); if (on && NAMES[on.dataset.m]) return on.dataset.m;
      try { const m = (JSON.parse(localStorage.getItem('ember_set') || '{}') || {}).mode; if (NAMES[m]) return m; } catch (e) { /* storage blocked */ }
      return 'chill';
    };
    const sync = () => { const m = current(); lbl.textContent = NAMES[m]; pop.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.m == m ? 'true' : 'false')); };
    const place = () => { const r = pill.getBoundingClientRect(); pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - pop.offsetWidth - 12)) + 'px'; pop.style.bottom = Math.max(12, window.innerHeight - r.top + 8) + 'px'; pop.style.top = 'auto'; };
    const isOpen = () => !pop.classList.contains('hidden');
    const set = v => { pop.classList.toggle('hidden', !v); pill.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) { sync(); place(); } };
    pill.addEventListener('click', e => { e.stopPropagation(); set(!isOpen()); });
    pop.addEventListener('click', e => { if (e.target.closest('button[data-m]')) setTimeout(() => { sync(); set(false); }, 0); });
    document.addEventListener('click', e => { if (isOpen() && !pop.contains(e.target) && !pill.contains(e.target)) set(false); });
    document.addEventListener('keydown', e => { if (e.key == 'Escape' && isOpen()) set(false); });
    window.addEventListener('resize', () => { if (isOpen()) place(); });
    if (window.MutationObserver) new MutationObserver(sync).observe(pop, { attributes: true, attributeFilter: ['class'], subtree: true });
    sync(); setTimeout(sync, 400);
  }
  // Device tools moved here from the + menu
  const dev = $('bDevOpen');
  if (dev) dev.onclick = () => {
    const x = $('bSx'); if (x) x.click();
    setTimeout(() => { const b = $('bDevice'); if (b) b.click(); }, 80);
  };
})();

// ---- V1.9.88: Media engines lives in Settings > Engine Keys (it used to hide in the add-ons sheet) ----
(() => {
  const b = document.getElementById('bMediaEng'); if (!b) return;
  b.addEventListener('click', () => { const E = window.EmberEngines; if (E && E.open) E.open(); });
})();
