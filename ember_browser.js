// Ember V1.6.4 - ember_browser.js: the Browser (clean reader view you can browse) and the Documents library screen. Opened by the globe button.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const sheet = $('browser'); if (!sheet) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); };
const SC = () => window.EmberScraper, DOCS = () => window.EmberDocs, BR = () => window.EmberBridge;
let hist = [], pos = -1, cur = null, pending = '', docId = '', delId = '', delT = 0;

// ---------- reader-view rendering (text only, links stay inside the browser) ----------
function resolve(u, base) {
  try {
    let x = new URL(u, base || undefined);
    if (/(^|\.)duckduckgo\.com$/.test(x.hostname) && x.pathname.indexOf('/l/') === 0 && x.searchParams.get('uddg')) x = new URL(x.searchParams.get('uddg'));
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch (e) { return ''; }
}
function mdHtml(md, base) {
  return String(md || '').split('```').map((seg, i) => {
    if (i % 2) return '<pre>' + esc(seg.replace(/^[^\n]*\n/, '')) + '</pre>';
    let h = esc(seg);
    h = h.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, t, u) => { const r = resolve(u.replace(/&amp;/g, '&'), base); return r ? '<a href="#" data-u="' + esc(r) + '">' + t + '</a>' : t; });
    h = h.replace(/^(#{1,3})\s+(.+)$/gm, (m, a, t) => '<h' + a.length + '>' + t + '</h' + a.length + '>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');
    return h.replace(/(<\/(?:h[1-3]|ul)>)\n+/g, '$1').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  }).join('');
}

// ---------- browsing ----------
const setNote = (t, bad) => { const n = $('brNote'); n.textContent = t || ''; n.style.color = bad ? 'var(--rd)' : ''; };
const readerReady = () => { const s = SC(); return !!(s && s.enabled() && s.available().length); };
function enablePanel() {
  $('brView').innerHTML = '<p>Pages are fetched with your scraping keys (they take turns), then the free reader as a fallback. Web Scraping is off.</p><button class="btn" id="brEnable">Turn on Web Scraping</button>';
  $('brEnable').onclick = () => { const s = SC(); if (!s) { toast('Reader not loaded'); return; } s.setOn(true); if (!s.available().length) s.setReader(true); try { if (window.EmberScrapeUI) window.EmberScrapeUI.repaint(); } catch (e) { /* settings not drawn */ } toast('Web Scraping on'); if (pending) go(pending); };
}
function title() { const m = /^#{1,3}\s+(.+)$/m.exec(cur.md); try { return (m ? m[1] : new URL(cur.url).hostname).slice(0, 80); } catch (e) { return 'Saved page'; } }
function paint() {
  if (!cur) return;
  $('brUrl').value = cur.url;
  $('brView').innerHTML = cur.md.trim() ? mdHtml(cur.md.slice(0, 60000), cur.url) : '<p>The page came back empty.</p>';
  $('brView').scrollTop = 0;
  setNote(cur.md.length + ' chars via ' + cur.provider + (cur.degraded ? ' · search snippets only, not the real page' : '') + (cur.tried || ''));
  $('brBack').disabled = pos <= 0; $('brFwd').disabled = pos >= hist.length - 1;
}
async function go(input, noPush, fresh) {
  input = String(input || '').trim(); if (!input) return;
  let url = '';
  if (/^https?:\/\//i.test(input)) url = input;
  else if (!/\s/.test(input) && /\.[a-z]{2,}(\/|$|:|\?)/i.test(input)) url = 'https://' + input;
  else if (window.EmberSites) { const s = (window.EmberSites.list() || []).find(x => x.name.toLowerCase() == input.toLowerCase()); if (s) url = s.url; }
  if (!url) url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(input);
  if (!readerReady()) { pending = input; setNote(''); enablePanel(); return; }
  pending = ''; setNote('Loading…');
  let r; try { r = await SC().scrape_url(url, 'the main text of this page', undefined, undefined, { fresh: !!fresh }); } catch (e) { r = { error: e.message || 'Could not read the page.' }; }
  if (!r || r.error) { setNote(String((r && r.error) || 'Could not read the page.').slice(0, 300) + ' · tap ↗ to open it outside', true); return; }
  cur = { url: r.url || url, md: r.markdown || '', provider: r.provider + (r.cached ? ' (cached)' : ''), degraded: !!r.degraded, tried: (r.tried || []).length ? ' · skipped: ' + r.tried.join(' | ').slice(0, 160) : '' };
  if (!noPush) { hist = hist.slice(0, pos + 1); hist.push(cur); pos = hist.length - 1; }
  paint();
}
function sitesChips() {
  const el = $('brSites'); if (!el) return;
  let a = []; try { a = (window.EmberSites && window.EmberSites.list()) || []; } catch (e) { a = []; }
  el.innerHTML = a.map((s, i) => '<button class="ptag" data-i="' + i + '">' + esc(s.name) + '</button>').join('');
  el.onclick = e => { const b = e.target.closest('button'); if (b && a[+b.dataset.i]) { if (!(realOn() && toReal(a[+b.dataset.i].url))) go(a[+b.dataset.i].url); } };
}
$('brView').addEventListener('click', e => { const a = e.target.closest('a[data-u]'); if (a) { e.preventDefault(); go(a.dataset.u); } });
// ---------- V1.8.3: real browser (native full-screen WebView). The reader view above stays, for clean text through the scraping keys. ----------
const WEB = () => (window.EmberNative && window.EmberNative.web && window.EmberNative.web.available) ? window.EmberNative.web : null;
const realOn = () => { let v = ''; try { v = localStorage.getItem('ember_br_real') || ''; } catch (e) { /* storage blocked */ } return !!WEB() && v !== '0'; };
function paintReal() { const b = $('brReal'); if (!b) return; b.classList.toggle('hidden', !WEB()); b.textContent = realOn() ? 'Real browser: on' : 'Reader view'; b.title = realOn() ? 'Pages open in a full browser (JavaScript, logins). Tap for clean-text Reader view.' : 'Pages open as clean text through your scraping keys. Tap for the real browser.'; }
function toReal(input) {
  input = String(input || '').trim(); if (!input) return false;
  let url = input;
  if (!/^https?:\/\//i.test(input)) {
    if (!/\s/.test(input) && /\.[a-z]{2,}(\/|$|:|\?)/i.test(input)) url = 'https://' + input;
    else { const s = window.EmberSites && (window.EmberSites.list() || []).find(x => x.name.toLowerCase() == input.toLowerCase()); url = s ? s.url : 'https://duckduckgo.com/?q=' + encodeURIComponent(input); }
  }
  WEB().open(url).then(r => { if (!r.ok) { toast((r.error || 'Could not open the browser') + ' · using Reader view'); go(input); } });
  return true;
}
if ($('brReal')) { $('brReal').onclick = () => { try { localStorage.setItem('ember_br_real', realOn() ? '0' : '1'); } catch (e) { /* storage blocked */ } paintReal(); toast(realOn() ? 'Real browser on' : 'Reader view on'); }; paintReal(); }
const hookWeb = () => { const W = WEB(); if (!W || hookWeb.done) return; hookWeb.done = true; W.onPage(async ev => {
  if (!ev || !String(ev.text || '').trim()) { toast('That page has no readable text'); return; }
  const u = String(ev.url || ''), t = String(ev.title || '').slice(0, 80) || u, txt = String(ev.text);
  if (ev.kind == 'save') { const D = DOCS(); if (!D) { toast('Documents not loaded'); return; } const r = await D.addText(t, u + '\n\n' + txt, 'browser'); toast(r.error ? r.error : (r.saved ? 'Saved to Documents' : 'Saved for this session only (storage blocked)')); return; }
  const B = BR(); if (!B) { toast('Chat not ready'); return; }
  const ok = await B.askAbout({ chip: '📎 ' + u + ' · ' + txt.length + ' chars (real browser)', ctx: txt.slice(0, 24000), q: $('brAsk') ? $('brAsk').value : '', title: t });
  if (ok) { if ($('brAsk')) $('brAsk').value = ''; close(); }
}); };
hookWeb();
$('brGo').onclick = () => { if (realOn() && toReal($('brUrl').value)) return; go($('brUrl').value); };
$('brUrl').addEventListener('keydown', e => { if (e.key == 'Enter') { e.preventDefault(); if (!(realOn() && toReal($('brUrl').value))) go($('brUrl').value); $('brUrl').blur(); } });
$('brBack').onclick = () => { if (pos > 0) { pos--; cur = hist[pos]; paint(); } };
$('brFwd').onclick = () => { if (pos < hist.length - 1) { pos++; cur = hist[pos]; paint(); } };
$('brReload').onclick = () => { if (cur) go(cur.url, true, true); };
$('brExt').onclick = () => { if (!cur) { toast('Open a page first'); return; } const a = document.createElement('a'); a.href = cur.url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
$('brSave').onclick = async () => {
  if (!cur || !cur.md.trim()) { toast('Open a page first'); return; }
  const D = DOCS(); if (!D) { toast('Documents not loaded'); return; }
  const r = await D.addText(title(), cur.url + '\n\n' + cur.md, 'browser');
  toast(r.error ? r.error : (r.saved ? 'Saved to Documents' : 'Saved for this session only (storage blocked)'));
};
$('brSend').onclick = async () => {
  if (!cur || !cur.md.trim()) { toast('Open a page first'); return; }
  const B = BR(); if (!B) { toast('Chat not ready'); return; }
  const ok = await B.askAbout({ chip: '📎 ' + cur.url + ' · ' + cur.md.length + ' chars via ' + cur.provider + (cur.degraded ? ' (search snippets only)' : ''), ctx: cur.md.slice(0, 24000), q: $('brAsk').value, title: title(), degraded: cur.degraded });
  if (ok) { $('brAsk').value = ''; close(); }
};

// ---------- Documents ----------
const kb = n => n < 1024 ? n + ' chars' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' k chars';
const lcb = d => { const C = window.EmberContext; return (C && d.size > 8000) ? ' · <span class="lcb">LOCAL CONTEXT · ' + C.count(d) + ' chunks</span>' : ''; };
async function renderDocs() {
  const D = DOCS(); if (!D) return;
  const q = $('dcQ').value.trim().toLowerCase();
  let list = await D.all(); list.sort((a, b) => b.updated - a.updated);
  if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.text.toLowerCase().includes(q));
  $('dcItems').innerHTML = list.length ? list.map(d => '<div class="dci" data-id="' + esc(d.id) + '"><button class="btn g go"><b>' + esc(d.name) + '</b><small>' + kb(d.size) + lcb(d) + ' · ' + new Date(d.updated).toLocaleDateString() + ' · ' + esc(d.text.slice(0, 70).replace(/\s+/g, ' ')) + '</small></button><button class="btn g x" aria-label="Delete document">✕</button></div>').join('')
    : '<p class="hint">' + (q ? 'Nothing matches.' : 'No documents yet. Add text files, make a note, or save a page from the Browser tab. Ember can list, search and read everything here.') + '</p>';
}
async function openDoc(id) {
  const D = DOCS(); const d = D && (await D.all()).find(x => x.id === id); if (!d) return;
  docId = id; $('dcName').value = d.name; $('dcText').value = d.text; $('dcAskQ').value = '';
  $('dcList').classList.add('hidden'); $('dcView').classList.remove('hidden');
}
function closeDoc() { docId = ''; $('dcView').classList.add('hidden'); $('dcList').classList.remove('hidden'); renderDocs(); }
$('dcQ').addEventListener('input', renderDocs);
const dcMenu = (on) => { const m = $('dcMenu'); if (!m) return; m.classList.toggle('hidden', on === undefined ? !m.classList.contains('hidden') ? true : false : !on); $('dcAttach').setAttribute('aria-expanded', m.classList.contains('hidden') ? 'false' : 'true'); };
$('dcAttach').onclick = e => { e.stopPropagation(); dcMenu(); };
$('dcAdd').onclick = () => { dcMenu(false); $('dcFile').click(); };
$('dcFile').addEventListener('change', async () => {
  const D = DOCS(), fs = [...($('dcFile').files || [])]; $('dcFile').value = ''; if (!D || !fs.length) return;
  let ok = 0; const bad = [];
  for (const f of fs) { const r = await D.addFile(f); if (r.error) bad.push(r.error); else ok++; }
  toast((ok ? 'Added ' + ok + ' file' + (ok == 1 ? '' : 's') : 'Nothing added') + (bad.length ? ' · ' + bad[0] : '')); renderDocs();
});
$('dcNew').onclick = async () => { dcMenu(false); const D = DOCS(); if (!D) return; const r = await D.addText('Untitled note.txt', '', 'note'); if (r.doc) openDoc(r.doc.id); };
$('dcItems').addEventListener('click', async e => {
  const row = e.target.closest('.dci'); if (!row) return; const id = row.dataset.id;
  if (e.target.closest('.x')) {
    if (delId === id && Date.now() - delT < 3000) { delId = ''; await DOCS().remove(id); renderDocs(); toast('Deleted'); return; }
    delId = id; delT = Date.now(); e.target.closest('.x').textContent = 'Sure?'; setTimeout(() => { if (delId === id) renderDocs(); }, 3000); return;
  }
  if (e.target.closest('.go')) openDoc(id);
});
$('dcSave').onclick = async () => { const r = await DOCS().update(docId, { name: $('dcName').value, text: $('dcText').value }); toast(r.error || (r.saved ? 'Saved' : 'Saved for this session only')); };
$('dcBack').onclick = closeDoc;
$('dcAsk').onclick = async () => {
  const B = BR(); if (!B) return; const text = $('dcText').value; if (!text.trim()) { toast('The document is empty'); return; }
  await DOCS().update(docId, { name: $('dcName').value, text });
  const ok = await B.askAbout({ chip: '📄 ' + $('dcName').value + ' · ' + text.length + ' chars', ctx: text.slice(0, 24000), q: $('dcAskQ').value, title: $('dcName').value });
  if (ok) close();
};
window.addEventListener('ember-docs-changed', () => { if (!$('brDocs').classList.contains('hidden') && $('dcView').classList.contains('hidden')) renderDocs(); });

// ---------- sheet + tabs ----------
function tab(name) {
  document.querySelectorAll('#brTabs .stab').forEach(b => b.classList.toggle('on', b.dataset.bt == name));
  $('brWeb').classList.toggle('hidden', name != 'web'); $('brDocs').classList.toggle('hidden', name != 'docs');
  if (name == 'docs') renderDocs(); else sitesChips();
  try { window.dispatchEvent(new CustomEvent('ember-ui-tab', { detail: name == 'docs' ? 'Documents' : 'Browser' })); } catch (e) { /* no listener */ }
}
$('brTabs').addEventListener('click', e => { const b = e.target.closest('.stab'); if (b) tab(b.dataset.bt); });
function open(which) { paintReal(); hookWeb(); sheet.classList.add('show'); tab(which == 'docs' ? 'docs' : 'web'); if (which != 'docs' && !cur) setTimeout(() => $('brUrl').focus(), 150); }
function close() { sheet.classList.remove('show'); try { window.dispatchEvent(new CustomEvent('ember-ui-tab', { detail: 'Chat' })); } catch (e) { /* no listener */ } }
$('brX').onclick = close;
window.EmberBrowser = { open, close, go };
})();
