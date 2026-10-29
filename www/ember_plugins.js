// Ember V1.10.12 - ember_plugins.js: the Plugins sheet behind the "+" menu (Web & Scraping, Media & Music)
// and the live abilities line Ember reads every turn (through EmberPlus.stateLine).
// Reads the same storage as ai_scraper.js (ember_scrape, ember_agent). It only COUNTS keys: no key value is shown, logged or put in a prompt.
'use strict';
(() => {
  const D = document, $ = id => D.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SCR = [['firecrawl', 'Firecrawl'], ['browserless', 'Browserless'], ['scraperapi', 'ScraperAPI'], ['scraperbee', 'ScrapingBee'], ['sting', 'Sting'], ['zenrows', 'ZenRows'], ['tavily', 'Tavily'], ['serpapi', 'SerpApi'], ['brightdata', 'Bright Data'], ['octoparse', 'Octoparse']];
  const SEARCHERS = ['serpapi', 'brightdata', 'firecrawl', 'scraperapi', 'scraperbee'];
  const load = k => { try { const o = JSON.parse(localStorage.getItem(k) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  function scrapers() {
    const s = load('ember_scrape'), a = load('ember_agent'), keys = s.keys || {}, more = s.more || {};
    const list = SCR.map(([id, name]) => {
      let n = id === 'tavily' ? (a.tavily ? 1 : 0) : (keys[id] ? 1 : 0);
      if (Array.isArray(more[id])) n += more[id].filter(Boolean).length;
      const ready = n > 0 && (id !== 'sting' || /^https:\/\//i.test(s.stingEndpoint || ''));
      return { id, name, n, ready };
    });
    const on = typeof s.on === 'boolean' ? s.on : list.some(x => x.n > 0);
    return { on, reader: s.reader !== false, list, live: list.filter(x => x.ready) };
  }
  function setScr(field, v) { const s = load('ember_scrape'); s[field] = !!v; try { localStorage.setItem('ember_scrape', JSON.stringify(s)); } catch (e) { /* storage blocked */ } }
  const P = () => window.EmberPlus;
  const songOk = () => { try { return !!(window.EmberAudd && window.EmberAudd.hasKey()); } catch (e) { return false; } };

  function abilities() {
    const s = scrapers(), p = P(), out = ['YOUR ABILITIES (live state of this phone for this turn; never claim anything not listed):'];
    if (s.on) out.push('Reading pages (scrape_url) is ON' + (s.live.length ? ', using his keys for ' + s.live.map(x => x.name + (x.n > 1 ? ' x' + x.n : '')).join(', ') + ' (keyed first, they take turns)' : ', but no scraper keys are saved') + (s.reader ? ', with the free reader as the last fallback.' : '; the free reader is OFF.'));
    else out.push('Reading pages (scrape_url) is OFF: if he wants a link read, tell him to switch on + > Web & Scraping > Web scraping.');
    const tav = s.list.find(x => x.id === 'tavily');
    out.push('Web search (web_search): ' + (tav && tav.n ? 'Tavily first' : 'no Tavily key') + (s.live.some(x => SEARCHERS.includes(x.id)) ? ', then his scraper search keys' : '') + ', then the built-in search.' + (p && p.isOn('web') ? ' Search is FORCED on for this chat.' : ''));
    out.push('Media (+ > Media & Music): Create image (Pollinations, Forge, Stability if a key is saved), Create audio and Create video (Stability), Create PDF. Stability bridge is ' + (p && p.isOn('stab') ? 'ON.' : 'OFF.'));
    out.push(songOk() ? 'Song ID works (Audd token saved).' : 'Song ID needs his Audd.io token (Settings > Music).');
    out.push('GitHub Brain, repos and GitHub settings live in Settings > Command Centre.');
    out.push('If a tool returns an error, quote the exact error.');
    return out.join(' ');
  }

  function section(tab) {
    close();
    if (window.EmberHub && window.EmberHub.section) return window.EmberHub.section(tab);
    const b = $('bSet'); if (!b) return;
    if (!$('settings') || !$('settings').classList.contains('show')) b.click();
    setTimeout(() => { const t = D.querySelector('#stabs [data-st="' + tab + '"]'); if (t) t.click(); }, 90);
  }

  const sw = (attrs, icon, title, sub, onv) => '<button type="button" class="epl-row" role="switch" aria-checked="' + !!onv + '" ' + attrs + '><span class="epl-ic">' + icon + '</span><span class="epl-tx"><b>' + title + '</b><small>' + sub + '</small></span><span class="epl-sw' + (onv ? ' on' : '') + '"></span></button>';
  const go = (attrs, icon, title, sub, dot) => '<button type="button" class="epl-row" ' + attrs + '>' + (dot ? '<span class="epl-dot ' + dot + '"></span>' : '') + '<span class="epl-ic">' + icon + '</span><span class="epl-tx"><b>' + title + '</b><small>' + sub + '</small></span><span class="epl-go">›</span></button>';

  function webView() {
    const s = scrapers(), p = P();
    let h = '<div class="epl-grp">' +
      sw('data-scr="on"', '🕸', 'Web scraping', s.on ? s.live.length + ' keyed provider' + (s.live.length === 1 ? '' : 's') + ' ready · they take turns' : 'Off: Ember cannot read links', s.on) +
      sw('data-flip="web"', '🌐', 'Force web search', 'This chat: search before answering anything current', p && p.isOn('web')) +
      sw('data-scr="reader"', '📖', 'Free reader fallback', 'Only used after every saved key has failed', s.reader) +
      '</div><h4 class="epl-h">Your scraper keys</h4><div class="epl-grp">';
    s.list.forEach(x => {
      const st = x.ready ? 'ok' : x.n ? 'warn' : 'none';
      const what = x.id === 'octoparse' ? 'task rows' : SEARCHERS.includes(x.id) ? 'read + search' : 'read';
      const sub = x.ready ? x.n + ' key' + (x.n === 1 ? '' : 's') + ' · ' + what : x.n ? 'needs an https endpoint' : 'no key';
      h += go('data-sec="scraping"', '<span class="epl-ini">' + esc(x.name.slice(0, 2)) + '</span>', esc(x.name), sub, st);
    });
    return h + '</div><div class="epl-btns"><button type="button" class="epl-btn hot" data-sec="scraping">Add keys &amp; run tests</button></div>';
  }
  function mediaView() {
    const p = P(), is = id => !!(p && p.isOn(id)), ok = songOk();
    return '<h4 class="epl-h">Create (next message)</h4><div class="epl-grp">' +
      sw('data-flip="image"', '🎨', 'Create image', 'Pollinations, Forge, then Stability if a key is saved', is('image')) +
      sw('data-flip="audio_gen"', '🎵', 'Create audio', 'Music or sound, made by Stability AI', is('audio_gen')) +
      sw('data-flip="video_gen"', '🎬', 'Create video', 'Stability images + music, composed on this phone', is('video_gen')) +
      sw('data-flip="pdf"', '📄', 'Create PDF', 'A full PDF document as an artifact', is('pdf')) +
      '</div><h4 class="epl-h">Always on</h4><div class="epl-grp">' +
      sw('data-flip="stab"', '⚡', 'Stability bridge', 'Ask in plain chat for images, audio or video', is('stab')) +
      '</div><h4 class="epl-h">Music</h4><div class="epl-grp">' +
      go('data-fire="audio"', '👂', 'Identify a song', ok ? 'Listens for 10 seconds' : 'Needs your Audd.io token', ok ? 'ok' : 'none') +
      go('data-fire="upload"', '📎', 'Identify from a file', 'Pick an audio file') +
      go('data-sec="music"', '🎧', 'Music settings', 'Player, song ID token, music control') +
      go('data-sec="keys"', '🎛', 'Media engines', 'Engine choice, status and checks') +
      '</div>';
  }

  let sheet = null, back = null, tab = 'web', lastFocus = null, hideT = 0;
  function build() {
    back = D.createElement('div'); back.className = 'epl-back'; back.hidden = true;
    sheet = D.createElement('section'); sheet.id = 'emberPlugins'; sheet.className = 'epl'; sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Plugins');
    sheet.innerHTML = '<div class="epl-grab"></div><div class="epl-head"><b>Plugins</b><button type="button" class="epl-x" data-x aria-label="Close">✕</button></div>' +
      '<div class="epl-tabs" role="tablist"><button type="button" role="tab" data-tab="web">Web &amp; Scraping</button><button type="button" role="tab" data-tab="media">Media &amp; Music</button></div>' +
      '<div class="epl-body" id="eplBody"></div>';
    D.body.append(back, sheet);
    back.addEventListener('click', close);
    sheet.addEventListener('click', onClick);
  }
  function paint() {
    if (!sheet || sheet.hidden) return;
    sheet.querySelectorAll('[data-tab]').forEach(b => { const v = b.dataset.tab === tab; b.classList.toggle('on', v); b.setAttribute('aria-selected', String(v)); });
    $('eplBody').innerHTML = tab === 'web' ? webView() : mediaView();
  }
  function open(t) {
    if (!sheet) build(); if (t) tab = t;
    clearTimeout(hideT); lastFocus = D.activeElement; sheet.hidden = false; back.hidden = false; D.body.classList.add('epl-on');
    requestAnimationFrame(() => sheet.classList.add('show')); paint();
    const x = sheet.querySelector('[data-x]'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { /* no focus */ }
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('show'); back.hidden = true; D.body.classList.remove('epl-on'); hideT = setTimeout(() => { sheet.hidden = true; }, 180);
    if (lastFocus && lastFocus.isConnected) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  function onClick(e) {
    const t = e.target;
    if (t.closest('[data-x]')) return close();
    const tb = t.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return paint(); }
    const sc = t.closest('[data-scr]'); if (sc) { const f = sc.dataset.scr; setScr(f, !scrapers()[f]); paintMenu(); return paint(); }
    const fl = t.closest('[data-flip]'); if (fl) { const p = P(); if (!p || !p.flip) return; const id = fl.dataset.flip, v = p.flip(id); if (v && ['image', 'audio_gen', 'video_gen', 'pdf'].includes(id)) close(); else paint(); return; }
    const fi = t.closest('[data-fire]'); if (fi) { close(); const p = P(); if (p && p._fire) p._fire(fi.dataset.fire); return; }
    const se = t.closest('[data-sec]'); if (se) section(se.dataset.sec);
  }
  function paintMenu() {
    const s = scrapers(), p = P(), a = $('pmWebSum'), b = $('pmMediaSum');
    if (a) a.textContent = (s.on ? 'Scraping on · ' + s.live.length + ' keyed' : 'Scraping off') + (p && p.isOn('web') ? ' · search forced' : '');
    if (b) b.textContent = (songOk() ? 'Song ID ready' : 'Song ID needs token') + ' · bridge ' + (p && p.isOn('stab') ? 'on' : 'off');
  }
  D.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && !sheet.hidden) { e.stopPropagation(); close(); } });
  window.addEventListener('ember-plus-change', () => { paint(); paintMenu(); });
  window.addEventListener('storage', () => { paint(); paintMenu(); });
  D.addEventListener('click', e => { if (e.target.closest && e.target.closest('#bPlus')) paintMenu(); });
  window.EmberPlugins = { open, close, abilities, scrapers, paintMenu };
  paintMenu();
})();
