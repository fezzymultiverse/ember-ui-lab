// Ember V1.10.11 - ember_menu.js: one menu system for Settings.
// Level 1  Hub panel (ember_hub.js)  >  Level 2  a section = a short list of rows  >  Level 3  one row = one page.
// Nothing drops down. Every row opens a page to the right and the arrow in the header comes back.
// The cards and every control inside them stay exactly where they were in the page (same ids, same handlers);
// this file only decides which card is showing and builds the rows. Loaded after every other script.
'use strict';
(() => {
  const D = document, $ = id => D.getElementById(id);
  const set = $('settings'), wrap = $('accWrap'), stabs = $('stabs');
  const sb = set && set.querySelector('.sb'), head = set && set.querySelector('.sh-ember');
  if (!set || !wrap || !stabs || !sb || !head || window.EmberMenu) return;
  const IC = window.EmberIcons || { svg: () => '', tile: () => '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHEV = '<svg class="mrow-c" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  /* ---------- names, one-line descriptions and icons for every card ---------- */
  const META = [
    [/^Free Mode/i, 'Free Mode', 'Chat without any key', 'bolt'],
    [/^About you/i, 'About you', 'Your name and what Ember knows about you', 'user'],
    [/^Voice & pacing/i, 'Voice & pacing', 'Warmth, directness, humour and pace', 'wave'],
    [/^System prompt/i, 'System prompt', 'Your own rules for every chat', 'doc'],
    [/^Memory & Context/i, 'Memory & context', 'Context window, summaries, Core Memory', 'chip'],
    [/^Device tools/i, 'Device tools', 'Wi-Fi, storage, RAM, battery', 'phone'],
    [/^Look/i, 'Look', 'Accent colour and engine label', 'palette'],
    [/^Usage/i, 'Usage', 'Replies per engine, today and this week', 'chart'],
    [/^Your data/i, 'Your data', 'Backup, import and delete', 'db'],
    [/^Media engines/i, 'Media engines', 'Picture and PDF providers', 'image'],
    [/^Which engine answers/i, 'Which engine answers', 'Pin an engine or a model', 'route'],
    [/^Paste keys/i, 'Paste keys', 'Detect keys and sort them by provider', 'clip'],
    [/^Engine keys/i, 'Engine keys', 'Providers, saved keys and checks', 'key'],
    [/^Notepad/i, 'Notepad', 'Paste anything, pull the keys out', 'note'],
    [/^AI routing/i, 'AI routing, media & downloads', 'Fallback rules, media artifacts, downloads', 'route'],
    [/^Paste & extract scraping/i, 'Paste & extract keys', 'Find scraper keys inside pasted text', 'clip'],
    [/^Web Scraping/i, 'Web Scraping', 'Reader, scraper keys, health and tests', 'globe'],
    [/^Termux Mode/i, 'Termux mode', 'Pen-test persona and lessons', 'terminal'],
    [/^EMBER TERMUX/i, 'Ember Termux', 'The built-in terminal', 'terminal'],
    [/^Music player/i, 'Music player', 'Open the Music panel', 'music'],
    [/^Song identification/i, 'Song identification', 'Audd.io token and audio links', 'mic'],
    [/^Music control/i, 'Music control & documents', 'Let Ember drive the player and read documents', 'music'],
    [/^Agent & API/i, 'Agent & API tools', 'Web search, YouTube and vision', 'search'],
    [/^Permissions$/i, 'Permissions', 'Notifications, mic, battery and keep-alive', 'shield'],
    [/^System integrations/i, 'System integrations', 'Pings, background replies and the music widget', 'plug'],
    [/^Voice$/i, 'Voice', 'Read aloud, voice engine, speed and pitch', 'speaker']
  ];
  const BYID = {
    efRouting: ['AI routing, media & downloads', 'Fallback rules, media artifacts, downloads', 'route'],
    usageCard: ['Usage', 'Replies per engine, today and this week', 'chart'],
    devToolsCard: ['Device tools', 'Wi-Fi, storage, RAM, battery', 'phone']
  };
  function rawTitle(c) {
    const ct = c.querySelector(':scope > .ct'); if (!ct) return '';
    const k = ct.cloneNode(true); k.querySelectorAll('span,small').forEach(x => x.remove());
    return k.textContent.replace(/\s+/g, ' ').trim();
  }
  function meta(c) {
    if (BYID[c.id]) return { t: BYID[c.id][0], s: BYID[c.id][1], i: BYID[c.id][2] };
    const rt = rawTitle(c), m = META.find(x => x[0].test(rt));
    if (m) return { t: m[1], s: m[2], i: m[3] };
    return { t: rt || 'Options', s: '', i: 'sliders' };
  }
  const cardsOf = body => Array.from(body.querySelectorAll(':scope > .card, :scope > #repoWorkspace > .card')).filter(c => !c.classList.contains('hidden') && !c.hidden);
  const activeId = () => { const t = stabs.querySelector('.stab.on'); return t ? t.dataset.st : 'none'; };
  const bodyOf = id => (id && id !== 'none') ? $('acc_b_' + id) : null;
  const curBody = () => bodyOf(activeId());
  const secTitle = id => { const h = $('acc_h_' + id), b = h && h.querySelector('b'); return b ? b.textContent.trim() : 'Settings'; };

  /* ---------- header: back arrow, logo, title + crumb, close ---------- */
  const bar = D.createElement('div'); bar.className = 'mnu-bar';
  bar.innerHTML = '<button type="button" class="mnu-back" id="mnuBack" aria-label="Back">' + IC.svg('chevL', 20) + '</button>' +
    '<img class="mnu-logo" src="ember-icon.svg" alt="" width="26" height="26">' +
    '<div class="mnu-ttl"><b id="mnuTitle">Settings</b><small id="mnuCrumb">Ember</small></div>';
  head.insertBefore(bar, head.firstChild);

  function paintBar() {
    const id = activeId(), body = bodyOf(id), t = $('mnuTitle'), c = $('mnuCrumb'); if (!t || !c) return;
    let title = 'Settings', crumb = 'Ember';
    if (body) {
      const open = body.querySelector('.card.mnu-open');
      if (open && !body.classList.contains('mnu-single')) { title = meta(open).t; crumb = secTitle(id); }
      else { title = secTitle(id); crumb = 'Settings'; }
    }
    if (t.textContent !== title) t.textContent = title;
    if (c.textContent !== crumb) c.textContent = crumb;
  }

  /* ---------- open / close one page ---------- */
  function anim(body, dir) {
    body.classList.remove('mnu-fwd', 'mnu-back'); void body.offsetWidth; body.classList.add(dir === 'back' ? 'mnu-back' : 'mnu-fwd');
    clearTimeout(body._mnuT); body._mnuT = setTimeout(() => body.classList.remove('mnu-fwd', 'mnu-back'), 420);
  }
  function openCard(c) {
    const body = c && c.closest('.acc-b'); if (!body) return;
    body.querySelectorAll('.card.mnu-open').forEach(x => x.classList.remove('mnu-open'));
    c.classList.add('mnu-open'); body.classList.add('mnu-paged'); anim(body, 'fwd'); body.scrollTop = 0; paintBar();
  }
  function closeCard(body) {
    if (!body) return;
    const open = body.querySelector('.card.mnu-open');
    if (open && open.querySelector('#kList') && window.emberKeysReset) { try { window.emberKeysReset(); } catch (e) { /* list repaint is cosmetic */ } }
    body.querySelectorAll('.card.mnu-open').forEach(x => x.classList.remove('mnu-open'));
    body.classList.remove('mnu-paged'); anim(body, 'back'); body.scrollTop = 0; paintBar();
  }
  const toHub = () => { const x = $('bSx'); if (x) x.click(); setTimeout(() => { if (window.EmberHub) window.EmberHub.open(); }, 60); };
  function goBack() {
    const body = curBody();
    if (body && body.classList.contains('mnu-paged') && !body.classList.contains('mnu-single')) { closeCard(body); return; }
    toHub();
  }

  /* ---------- build the rows of the open section ---------- */
  const sigs = new WeakMap();
  function sync() {
    const body = curBody();
    if (!body) { paintBar(); return; }
    body.classList.add('mnu');
    const cards = cardsOf(body);
    cards.forEach((c, i) => { c.classList.remove('collapsed'); if (!c.dataset.mnu) c.dataset.mnu = c.id || ('card' + i + '_' + Date.now().toString(36)); });
    const sig = cards.map(c => c.dataset.mnu + ':' + meta(c).t).join('|');
    let list = body.querySelector(':scope > .mnu-list');
    if (sigs.get(body) !== sig || (!list && cards.length > 1)) {
      sigs.set(body, sig);
      if (list) list.remove();
      if (cards.length > 1) {
        list = D.createElement('div'); list.className = 'mnu-list';
        list.innerHTML = '<div class="mgrp">' + cards.map(c => {
          const m = meta(c);
          return '<button type="button" class="mrow" data-mnu-open="' + esc(c.dataset.mnu) + '">' + IC.tile(m.i) +
            '<span class="mrow-t"><b>' + esc(m.t) + '</b>' + (m.s ? '<small>' + esc(m.s) + '</small>' : '') + '</span>' + CHEV + '</button>';
        }).join('') + '</div>';
        body.insertBefore(list, body.firstChild);
      }
    }
    if (cards.length === 1) {
      body.classList.add('mnu-single', 'mnu-paged');
      if (!cards[0].classList.contains('mnu-open')) { body.querySelectorAll('.card.mnu-open').forEach(x => x.classList.remove('mnu-open')); cards[0].classList.add('mnu-open'); }
    } else {
      body.classList.remove('mnu-single');
      const open = body.querySelector('.card.mnu-open');
      if (open && !cards.includes(open)) { open.classList.remove('mnu-open'); body.classList.remove('mnu-paged'); }
      if (!open) body.classList.remove('mnu-paged');
    }
    paintBar();
  }
  let raf = 0;
  const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; tidyPerm(); sync(); }); };

  /* ---------- permission rows: label + status on the left, the action(s) on the right ---------- */
  function tidyPerm() {
    D.querySelectorAll('#settings .prow').forEach(r => {
      if (r.classList.contains('prow-g') || !r.querySelector(':scope > .pstatus')) return;
      const act = D.createElement('div'); act.className = 'prow-act';
      Array.from(r.children).forEach(ch => { if (ch.matches('.btn,button,.sw')) act.appendChild(ch); });
      if (act.children.length) r.appendChild(act);
      r.classList.add('prow-g');
    });
  }

  /* ---------- wiring ---------- */
  wrap.addEventListener('click', e => {
    const o = e.target.closest('[data-mnu-open]'); if (!o) return;
    const body = o.closest('.acc-b'), c = body && Array.from(body.querySelectorAll('.card')).find(x => x.dataset.mnu === o.dataset.mnuOpen);
    if (c) openCard(c);
  });
  $('mnuBack').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goBack(); });

  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(wrap, { childList: true, subtree: true });
    new MutationObserver(schedule).observe(stabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
    // something (the Termux dock) adds .collapsed to a card: a card page must never be folded away
    new MutationObserver(ms => { ms.forEach(m => { const t = m.target; if (t.classList && t.classList.contains('card') && t.classList.contains('collapsed')) t.classList.remove('collapsed'); }); })
      .observe(sb, { attributes: true, subtree: true, attributeFilter: ['class'] });
    // closing Settings puts every section back on its list, so the next visit starts at the rows
    new MutationObserver(() => {
      if (set.classList.contains('show')) { schedule(); return; }
      wrap.querySelectorAll('.acc-b.mnu-paged:not(.mnu-single)').forEach(b => { b.classList.remove('mnu-paged'); b.querySelectorAll('.card.mnu-open').forEach(x => x.classList.remove('mnu-open')); });
      if (window.emberKeysReset) { try { window.emberKeysReset(); } catch (e) { /* cosmetic */ } }
    }).observe(set, { attributes: true, attributeFilter: ['class'] });
  }

  window.EmberMenu = {
    sync, openCard, closeCard, back: goBack,
    // bring a control into view even when its card is not the one showing (used by deep links)
    reveal(el) { const c = el && el.closest && el.closest('.card'); if (c && c.closest('.acc-b')) { sync(); openCard(c); } }
  };
  tidyPerm(); sync();
})();
