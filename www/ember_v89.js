// Ember V1.9.89 - ember_v89.js: measures the message box so the toast always floats right above it (header and engine pill stay clear).
'use strict';
(() => {
  const root = document.documentElement;
  const place = () => {
    const c = document.querySelector('footer.comp'), t = document.getElementById('toast');
    if (!c || !t) return;
    const r = c.getBoundingClientRect(), vv = window.visualViewport, h = vv ? vv.height + vv.offsetTop : window.innerHeight;
    root.style.setProperty('--ember-toast-b', Math.max(12, Math.round(h - r.top + 10)) + 'px');
  };
  const wire = () => {
    const t = document.getElementById('toast'); if (!t) return;
    place();
    if (window.MutationObserver) new MutationObserver(place).observe(t, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', place);
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', place); window.visualViewport.addEventListener('scroll', place); }
    setInterval(place, 3000);
  };
  if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
