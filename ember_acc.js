// Ember V1.9.84 - ember_acc.js: Settings as a vertical accordion.
// Every section is one slim row (name + one-line description). Tapping a row opens its cards right under it; one section is open at a time.
// The old tab strip stays in the page (hidden) and still owns "which section is open", so everything that opens a section
// (the engine pill, GitHub shortcuts, the add-ons sheet, the Termux panel) keeps working untouched.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const settings = $('settings'), stabs = $('stabs'), sb = settings && settings.querySelector('.sb');
  if (!settings || !stabs || !sb || $('accWrap')) return;

  const SECTIONS = [
    { id: 'general', title: 'General, Persona & Memory', desc: 'Free Mode, your name, voice and pacing, system prompt, memory, look, usage, backup' },
    { id: 'keys', title: 'Engine Keys & Providers', desc: 'Which engine answers, API keys, engine names' },
    { id: 'features', title: 'Features', desc: 'AI routing, media artifacts and audio/video downloads' },
    { id: 'scraping', title: 'Web Scraping', desc: 'Scraper keys, the free reader, health checks and tests' },
    { id: 'hacking', title: 'Termux & Hacking', desc: 'Termux mode, pen-test persona and the built-in terminal' },
    { id: 'music', title: 'Music', desc: 'Player, song identification, music control, documents' },
    { id: 'permissions', title: 'Permissions, Voice & Background', desc: 'Notifications, mic, battery, keep-alive, read aloud' }
  ];
  const CHEV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const wrap = document.createElement('div'); wrap.id = 'accWrap'; wrap.className = 'acc-wrap';
  wrap.innerHTML = SECTIONS.map(s =>
    '<div class="acc-item" data-acc="' + s.id + '">' +
      '<button type="button" class="acc-h" id="acc_h_' + s.id + '" aria-expanded="false" aria-controls="acc_b_' + s.id + '">' +
        '<span class="acc-t"><b>' + esc(s.title) + '</b><small>' + esc(s.desc) + '</small></span><span class="acc-c">' + CHEV + '</span></button>' +
      '<div class="acc-b" id="acc_b_' + s.id + '" role="region" aria-labelledby="acc_h_' + s.id + '" hidden></div>' +
    '</div>').join('');
  sb.insertBefore(wrap, sb.firstChild);

  const item = id => wrap.querySelector('.acc-item[data-acc="' + id + '"]');
  // Move every card into its section. Cards other scripts add later (direct children of the sheet body) are adopted the same way.
  function adopt() {
    Array.from(sb.children).forEach(c => {
      if (c === wrap || !c.classList || !c.classList.contains('card') || !c.dataset.tab) return;
      const it = item(c.dataset.tab); if (it) it.querySelector('.acc-b').appendChild(c);
    });
  }
  adopt();
  if (window.MutationObserver) new MutationObserver(adopt).observe(sb, { childList: true });

  SECTIONS.forEach(s => {
    const body = item(s.id).querySelector('.acc-b');
    const back = document.createElement('div'); back.className = 'acc-backbar';
    back.innerHTML = '<button type="button" data-acc-back aria-label="Back to Settings">‹ <span>Settings</span></button><b>' + esc(s.title) + '</b>';
    body.prepend(back);
  });
  const active = () => { const t = stabs.querySelector('.stab.on'); return t ? t.dataset.st : 'none'; };
  let shown = 'none';
  function render() {
    const a = active();
    wrap.classList.toggle('acc-in-detail', a !== 'none' && !!item(a));
    SECTIONS.forEach(s => {
      const it = item(s.id), open = s.id === a, h = it.querySelector('.acc-h'), b = it.querySelector('.acc-b');
      it.classList.toggle('open', open); h.setAttribute('aria-expanded', open ? 'true' : 'false'); b.hidden = !open;
    });
    if (a !== shown) {
      shown = a;
      if (a !== 'none' && item(a)) setTimeout(() => {
        const it = item(a); if (!it || !it.classList.contains('open')) return;
        const top = sb.scrollTop + it.getBoundingClientRect().top - sb.getBoundingClientRect().top - 4;
        try { sb.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch (e) { sb.scrollTop = Math.max(0, top); }
      }, 40);
    }
  }
  if (window.MutationObserver) new MutationObserver(render).observe(stabs, { attributes: true, subtree: true, attributeFilter: ['class'] });

  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-acc-back]')) { const none = stabs.querySelector('.stab[data-st="none"]'); if (none) none.click(); return; }
    const h = e.target.closest('.acc-h'); if (!h) return;
    const id = h.parentElement.dataset.acc, target = stabs.querySelector('.stab[data-st="' + (active() === id ? 'none' : id) + '"]');
    if (target) target.click();
  });

  // the title is the AI's own name (Settings > General > Its name), 'Ember' until it is changed
  const title = $('setTitle');
  const paintTitle = () => { if (!title) return; const n = $('pName'), t = n && n.textContent && n.textContent.trim(); title.textContent = t || 'Ember'; };
  if (window.MutationObserver) new MutationObserver(() => { if (settings.classList.contains('show')) paintTitle(); }).observe(settings, { attributes: true, attributeFilter: ['class'] });
  paintTitle(); render();
})();
