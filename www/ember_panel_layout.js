/* Shared right-panel geometry only. Android never loses chat width to a dock. */
'use strict';
(() => {
  const W = window, D = document, $ = id => D.getElementById(id);
  function android() {
    try { if (W.Capacitor?.getPlatform?.() === 'android') return true; } catch (_) { /* UA fallback */ }
    return /Android/i.test(navigator.userAgent);
  }
  function canDock() { return !android() && W.matchMedia('(min-width: 1100px)').matches; }
  let frame = 0;
  function measure() {
    frame = 0;
    const vv = W.visualViewport, top = vv ? vv.offsetTop : 0;
    const height = vv ? vv.height : W.innerHeight, end = top + height;
    const settings = $('settings'), settingsOpen = settings?.classList.contains('show');
    const header = settingsOpen ? settings.querySelector('.sh') : D.querySelector('#app > header');
    const composer = !settingsOpen && D.querySelector('#app > footer.comp');
    let start = Math.max(top, header?.getBoundingClientRect().bottom || top);
    let bottom = end;
    if (composer) {
      const r = composer.getBoundingClientRect();
      if (r.top > start && r.top < end) bottom = r.top;
    }
    // Never extend under the keyboard or the composer; the body, not the header, scrolls.
    start = Math.min(start, bottom);
    D.documentElement.style.setProperty('--ember-panel-top', start + 'px');
    D.documentElement.style.setProperty('--ember-panel-height', Math.max(0, bottom - start) + 'px');
    D.documentElement.style.setProperty('--ember-panel-vh', height + 'px');
  }
  function refresh() { if (!frame) frame = W.requestAnimationFrame(measure); }
  W.EmberPanelLayout = { canDock, refresh };
  function init() {
    D.body.classList.toggle('ember-android-panel', android());
    W.addEventListener('resize', refresh);
    W.visualViewport?.addEventListener('resize', refresh);
    W.visualViewport?.addEventListener('scroll', refresh);
    if (W.ResizeObserver) {
      const ro = new ResizeObserver(refresh);
      [D.querySelector('#app > header'), D.querySelector('footer.comp'), $('settings')?.querySelector('.sh')].forEach(el => { if (el) ro.observe(el); });
    }
    const mo = new MutationObserver(refresh);
    ['emberCommandCenter', 'settings'].forEach(id => { if ($(id)) mo.observe($(id), { attributes: true, attributeFilter: ['class'] }); });
    measure();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
