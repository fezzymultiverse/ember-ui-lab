// Ember V1.10.10 - ember_v110.js: one Settings button (opens the side panel) + flashing blue dot in front of the name.
'use strict';
(() => {
  const D = document, $ = id => D.getElementById(id);

  function addSettingsButton() {
    const hr = D.querySelector('header .hr'); if (!hr || $('bSetTop')) return;
    const b = D.createElement('button');
    b.id = 'bSetTop'; b.type = 'button'; b.className = 'hb';
    b.setAttribute('aria-label', 'Settings'); b.title = 'Settings'; b.textContent = '⚙️';
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (window.EmberHub) window.EmberHub.open();
      else { const s = $('bSet'); if (s) s.click(); }
    });
    const ref = $('bActionMenu');
    if (ref && ref.parentNode === hr) hr.insertBefore(b, ref); else hr.appendChild(b);
  }

  function ensureDot() {
    const name = $('pName'); if (!name) return;
    const host = name.parentNode; if (!host) return;
    let dot = host.querySelector(':scope > .ember-dot');
    if (dot && dot.nextElementSibling === name) return;
    if (!dot) { dot = D.createElement('i'); dot.className = 'ember-dot'; dot.setAttribute('aria-hidden', 'true'); }
    host.insertBefore(dot, name);
  }

  function run() { addSettingsButton(); ensureDot(); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', () => { run(); setTimeout(run, 400); setTimeout(run, 1500); });
  else { run(); setTimeout(run, 400); setTimeout(run, 1500); }

  // keep the dot (and button) if any other script rebuilds the header
  const hdr = D.querySelector('header');
  if (hdr && window.MutationObserver) {
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 80); }).observe(hdr, { childList: true, subtree: true });
  }
})();
