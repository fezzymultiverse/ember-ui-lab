// Ember V1.10.9 - ember_v108.js: one Settings, not Settings inside Settings.
// The side panel (Ember Hub) is the list. A section opens straight to its page, and Back returns to the side panel.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const set = $('settings'), stabs = $('stabs');
  if (!set || !stabs) return;
  const active = () => { const t = stabs.querySelector('.stab.on'); return t ? t.dataset.st : 'none'; };
  const toHub = () => { const x = $('bSx'); if (x) x.click(); setTimeout(() => { if (window.EmberHub) window.EmberHub.open(); }, 60); };

  // Back arrow inside a section -> the side panel
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('[data-acc-back]')) return;
    e.preventDefault(); e.stopImmediatePropagation(); toHub();
  }, true);

  // If the old landing list would ever be showing (no section chosen), go to the side panel instead.
  let timer = 0;
  const check = () => {
    clearTimeout(timer);
    if (!set.classList.contains('show') || active() !== 'none') return;
    timer = setTimeout(() => { if (set.classList.contains('show') && active() === 'none') toHub(); }, 350);
  };
  if (window.MutationObserver) {
    new MutationObserver(check).observe(set, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(check).observe(stabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }
})();
