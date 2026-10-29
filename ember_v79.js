// Ember V1.9.79 - ember_v79.js: layout glue for the visual repair (empty-state offset, jump-to-latest, long-message counter).
'use strict';
(() => {
  const $ = id => document.getElementById(id), root = document.documentElement;
  const log = $('log'), inp = $('inp'), comp = document.querySelector('footer.comp');
  const place = () => { if (log) root.style.setProperty('--empty-top', (log.offsetTop + 8) + 'px'); };
  place(); window.addEventListener('resize', place);
  if (window.ResizeObserver) { const ro = new ResizeObserver(place); ['fBadge', 'projBadge'].forEach(i => { const e = $(i); if (e) ro.observe(e); }); const h = document.querySelector('header'); if (h) ro.observe(h); }
  if (window.MutationObserver) ['fBadge', 'projBadge'].forEach(i => { const e = $(i); if (e) new MutationObserver(place).observe(e, { attributes: true, attributeFilter: ['class'] }); });
  // Natural chat scrolling: no floating jump-to-bottom overlay.
  if (inp && comp) {
    const c = document.createElement('div'); c.id = 'inpCount'; c.className = 'hidden'; comp.appendChild(c);
    inp.addEventListener('input', () => { const n = inp.value.length; c.classList.toggle('hidden', n < 400); c.textContent = n.toLocaleString() + ' characters'; });
  }
})();
