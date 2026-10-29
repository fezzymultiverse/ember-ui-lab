// Ember Add-On wiring (www/ai.js): Settings > Web Scraping (keys) and the Saved Sites list in the drawer.
// Loaded after app.js. State lives in EmberScraper / EmberSites, so app.js needs no settings of its own for this.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, ms) => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms || 3200); };

// ---------- universal router: toast when the engine switches (the routing itself is Prov.run in providers.js) ----------
let lastSw = { k: '', t: 0 };
window.addEventListener('ember-switch', e => {
  const d = e.detail || {}, nm = id => (window.Prov && Prov.label ? Prov.label(id) : id);
  const why = d.status == 429 ? 'rate limited' : (d.status == 401 || d.status == 403) ? 'key rejected' : 'unavailable';
  const k = d.from + '>' + d.to; if (k == lastSw.k && Date.now() - lastSw.t < 60000) return;
  lastSw = { k, t: Date.now() };
  toast('Switched to ' + nm(d.to) + ' (' + nm(d.from) + ' ' + why + (d.why ? ': ' + String(d.why).slice(0, 80) : '') + ')', 6000); // V1.9.15: the real reason, and it stays long enough to read
});

// ---------- drawer tabs + saved AI prompts (V1.6.4: search, tags, pin, edit, copy, export/import, starter pack) ----------
const PK = 'ember_prompts';
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const normTags = v => [...new Set(String(Array.isArray(v) ? v.join(',') : v || '').split(',').map(x => x.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20)).filter(Boolean))].slice(0, 6);
const loadP = () => { try { const a = JSON.parse(localStorage.getItem(PK) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.n && x.t).map(x => ({ id: x.id || nid(), n: String(x.n).slice(0, 40), t: String(x.t).slice(0, 2000), tags: normTags(x.tags), pin: !!x.pin, used: +x.used || 0, last: +x.last || 0, no: String(x.no || '').slice(0, 600), rem: String(x.rem || '').slice(0, 160), task: String(x.task || '').slice(0, 200) })) : []; } catch (e) { return []; } };
// V1.6.8: a prompt can carry what NOT to do, a reminder cue and a task. They are appended as labelled lines when the prompt is used or copied.
const fullP = p => p.t + (p.no ? '\n\nDO NOT (hard constraints): ' + p.no : '') + (p.rem ? '\n\nREMIND ME: ' + p.rem : '') + (p.task ? '\n\nTASK TO CARRY OUT: ' + p.task : '');
const saveP = a => { try { localStorage.setItem(PK, JSON.stringify(a.slice(0, 200))); return true; } catch (e) { toast('Could not save: storage is blocked'); return false; } };
const STARTERS = [
  { n: 'Plan then build', tags: ['plan', 'build'], t: 'Before writing anything, give me a short plan of what you will change and why. Wait for my yes, then build the full production version with no placeholders and no skeletons.' },
  { n: 'Fix this script', tags: ['debug', 'termux'], t: 'Here is the script and its full output. Find every error, fix all of them, tell me what was working and what was broken, and give me the complete fixed file.' },
  { n: 'Audit for silent failures', tags: ['debug', 'review'], t: 'Audit this code for silent failures: swallowed errors, empty catch blocks, stubs, fake success messages and checks that always pass. List each one with its location and the fix.' },
  { n: 'Explain this error', tags: ['debug'], t: 'Explain this error in plain words: what caused it, why it shows up now, and the exact command or edit that fixes it.' },
  { n: 'OSINT workflow', tags: ['osint', 'termux'], t: 'Plan an OSINT workflow for a public topic I have permission to research: the steps in order, the Termux tools for each step, and how to record sources so I can verify them.' },
  { n: 'Ten ideas', tags: ['ideas'], t: 'Give me ten concrete ideas for this. Each gets one line on why it could work and the first step to try. No filler.' },
  { n: 'Make it professional', tags: ['writing', 'design'], t: 'Rewrite this so it reads professional and clear. Keep my meaning, cut the filler, and keep the S.O.I. × Bojack voice.' },
  { n: 'Where are we', tags: ['plan'], t: 'Summarize where we are: what is done, what is broken, and what is left, as a short checklist.' }
];
let pTag = '', pEdit = '', pDel = '', pDelT = 0;
function copyText(t) {
  const done = () => toast('Copied');
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(done, () => fallback()); return; } } catch (e) { /* fall back */ }
  fallback();
  function fallback() { try { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) { toast('Could not copy'); } }
}
function renderPrompts() {
  const el = $('plist'); if (!el) return;
  const all = loadP(), q = ($('pQ').value || '').trim().toLowerCase();
  const tagCount = {}; all.forEach(p => p.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  if (pTag && pTag != '★' && !tagCount[pTag]) pTag = '';
  const chips = [['', 'All ' + all.length], ['★', '★ ' + all.filter(p => p.pin).length]].concat(Object.keys(tagCount).sort().map(t => [t, t + ' ' + tagCount[t]]));
  $('pTags').innerHTML = all.length ? chips.map(c => '<button class="ptag' + (pTag == c[0] ? ' on' : '') + '" data-t="' + esc(c[0]) + '">' + esc(c[1]) + '</button>').join('') : '';
  $('pTagList').innerHTML = Object.keys(tagCount).sort().map(t => '<option value="' + esc(t) + '">').join('');
  let a = all.filter(p => (!pTag || (pTag == '★' ? p.pin : p.tags.includes(pTag))) && (!q || (p.n + ' ' + p.t + ' ' + p.tags.join(' ')).toLowerCase().includes(q)));
  a.sort((x, y) => (y.pin - x.pin) || (y.last - x.last));
  el.innerHTML = a.length ? a.map(p => '<div class="prm' + (p.pin ? ' pinned' : '') + '" data-id="' + esc(p.id) + '"><button class="btn g go"><b>' + esc(p.n) + '</b>' + (p.tags.length ? '<small class="tg">' + esc(p.tags.map(t => '#' + t).join(' ')) + '</small>' : '') + '<small>' + esc(p.t) + '</small>' + (p.no ? '<small class="pf">🚫 ' + esc(p.no) + '</small>' : '') + (p.rem ? '<small class="pf">⏰ ' + esc(p.rem) + '</small>' : '') + (p.task ? '<small class="pf">✅ ' + esc(p.task) + '</small>' : '') + '</button><div class="pa"><button class="btn g pin" aria-label="Pin">' + (p.pin ? '★' : '☆') + '</button><button class="btn g ed" aria-label="Edit">✎</button><button class="btn g cp" aria-label="Copy">⧉</button><button class="btn g x" aria-label="Delete prompt">✕</button></div></div>').join('')
    : '<p class="hint">' + (all.length ? 'Nothing matches.' : 'No saved prompts yet. Add one below, or tap Starter pack.') + '</p>';
  $('pStarter').classList.toggle('hidden', all.length > 0);
}
function resetForm() { pEdit = ''; $('pmName').value = ''; $('pmTags').value = ''; $('pText').value = ''; $('pNo').value = ''; $('pRem').value = ''; $('pTask').value = ''; $('pAdd').textContent = 'Save prompt'; $('pCancel').classList.add('hidden'); }
document.querySelectorAll('.dtab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.dtab').forEach(x => x.classList.toggle('on', x == b));
  document.querySelectorAll('.dpane').forEach(x => x.classList.toggle('hidden', x.id != 'dp_' + b.dataset.d));
  if (b.dataset.d == 'prompts') renderPrompts();
}));
if ($('pAdd')) {
  $('pQ').addEventListener('input', renderPrompts);
  $('pTags').addEventListener('click', e => { const c = e.target.closest('.ptag'); if (!c) return; pTag = c.dataset.t; renderPrompts(); });
  $('pAdd').onclick = () => {
    const n = $('pmName').value.trim(), t = $('pText').value.trim();
    if (!n || !t) { toast('Give the prompt a name and some text'); return; }
    const a = loadP(), tags = normTags($('pmTags').value);
    const ex = { no: $('pNo').value.trim().slice(0, 600), rem: $('pRem').value.trim().slice(0, 160), task: $('pTask').value.trim().slice(0, 200) };
    if (pEdit) { const p = a.find(x => x.id == pEdit); if (p) { p.n = n.slice(0, 40); p.t = t.slice(0, 2000); p.tags = tags; Object.assign(p, ex); } }
    else a.unshift(Object.assign({ id: nid(), n: n.slice(0, 40), t: t.slice(0, 2000), tags, pin: false, used: 0, last: 0 }, ex));
    if (saveP(a)) { toast(pEdit ? 'Prompt updated' : 'Prompt saved'); resetForm(); renderPrompts(); }
  };
  $('pCancel').onclick = resetForm;
  $('plist').addEventListener('click', e => {
    const row = e.target.closest('.prm'); if (!row) return;
    const a = loadP(), p = a.find(x => x.id == row.dataset.id); if (!p) return;
    if (e.target.closest('.x')) {
      if (pDel == p.id && Date.now() - pDelT < 3000) { pDel = ''; saveP(a.filter(x => x.id != p.id)); renderPrompts(); toast('Deleted'); return; }
      pDel = p.id; pDelT = Date.now(); e.target.closest('.x').textContent = 'Sure?'; setTimeout(() => { if (pDel == p.id) renderPrompts(); }, 3000); return;
    }
    if (e.target.closest('.pin')) { p.pin = !p.pin; saveP(a); renderPrompts(); return; }
    if (e.target.closest('.cp')) { copyText(fullP(p)); return; }
    if (e.target.closest('.ed')) { pEdit = p.id; $('pmName').value = p.n; $('pmTags').value = p.tags.join(', '); $('pText').value = p.t; $('pNo').value = p.no || ''; $('pRem').value = p.rem || ''; $('pTask').value = p.task || ''; $('pAdd').textContent = 'Update prompt'; $('pCancel').classList.remove('hidden'); $('pText').focus(); return; }
    if (e.target.closest('.go')) {
      const inp = $('inp'); if (!inp) return;
      inp.value = inp.value.trim() ? inp.value.replace(/\s+$/, '') + '\n\n' + fullP(p) : fullP(p); inp.dispatchEvent(new Event('input', { bubbles: true }));
      p.used++; p.last = Date.now(); saveP(a);
      const d = $('bDx'); if (d) d.click(); inp.focus();
    }
  });
  $('pExport').onclick = () => { const a = loadP(); if (!a.length) { toast('Nothing to export yet'); return; } const j = JSON.stringify(a.map(p => ({ n: p.n, t: p.t, tags: p.tags, pin: p.pin, no: p.no, rem: p.rem, task: p.task })), null, 1); $('pIO').value = j; $('pIO').classList.remove('hidden'); $('pImportGo').classList.add('hidden'); copyText(j); };
  $('pImportBtn').onclick = () => { $('pIO').value = ''; $('pIO').classList.remove('hidden'); $('pImportGo').classList.remove('hidden'); $('pIO').focus(); };
  $('pImportGo').onclick = () => {
    let src; try { src = JSON.parse($('pIO').value); } catch (e) { toast('That is not valid JSON'); return; }
    if (!Array.isArray(src)) { toast('Expected a list of prompts'); return; }
    const a = loadP(); let n = 0;
    src.forEach(x => { if (x && x.n && x.t && !a.some(y => y.n == String(x.n).slice(0, 40) && y.t == String(x.t).slice(0, 2000))) { a.push({ id: nid(), n: String(x.n).slice(0, 40), t: String(x.t).slice(0, 2000), tags: normTags(x.tags), pin: !!x.pin, used: 0, last: 0, no: String(x.no || '').slice(0, 600), rem: String(x.rem || '').slice(0, 160), task: String(x.task || '').slice(0, 200) }); n++; } });
    if (saveP(a)) { toast(n + ' prompt' + (n == 1 ? '' : 's') + ' imported'); $('pIO').classList.add('hidden'); $('pImportGo').classList.add('hidden'); renderPrompts(); }
  };
  $('pStarter').onclick = () => { const a = loadP(); STARTERS.forEach(s => a.push({ id: nid(), n: s.n, t: s.t, tags: s.tags, pin: false, used: 0, last: 0 })); if (saveP(a)) { renderPrompts(); toast('Starter pack added'); } };
  renderPrompts();
}

const SC = window.EmberScraper, ST = window.EmberSites;
if (!SC || !ST || !$('swScrape')) return;

// V1.9.14: extra keys per provider (found by Extract, or the first key kept when a second one is pasted). Masked, each with a remove button.
function renderExtras(s) {
  const box = $('wkExtras'); if (!box) return; s = s || SC.get();
  const rows = []; SC.KEY_IDS.forEach(id => SC.keysOf(id).slice(1).forEach((k, i) => rows.push('<div class="cr"><span>' + esc(SC.LABEL[id]) + ' extra key ' + esc(SC.mask(k)) + '</span><button class="hb wkDrop" data-id="' + id + '" data-i="' + (i + 1) + '" aria-label="Remove this extra key">✕</button></div>')));
  box.innerHTML = rows.length ? '<div class="ct">Extra keys (they take turns with the first and cover for it when it runs out)</div>' + rows.join('') : '';
}
function renderKeys() {
  const s = SC.get();
  $('swScrape').classList.toggle('on', !!s.on);
  if ($('swReader')) $('swReader').classList.toggle('on', SC.readerOn());
  SC.KEY_IDS.forEach(id => { const el = $('wk_' + id); if (el && document.activeElement !== el) el.value = (s.keys || {})[id] || ''; });
  if ($('wk_stingEp') && document.activeElement !== $('wk_stingEp')) $('wk_stingEp').value = s.stingEndpoint || '';
  if ($('wk_octoTask') && document.activeElement !== $('wk_octoTask')) $('wk_octoTask').value = s.octoTask || '';
  if ($('wk_brightZone') && document.activeElement !== $('wk_brightZone')) $('wk_brightZone').value = s.brightZone || '';
  if ($('wk_brightUnlock') && document.activeElement !== $('wk_brightUnlock')) $('wk_brightUnlock').value = s.brightUnlock || '';
  renderExtras(s);
  $('wkStatus').textContent = SC.available().length ? 'Keys take turns, then the free reader: ' + SC.plan(true).map(id => SC.LABEL[id]).join(' → ') : 'Free reader is off and no scraping key is set yet.';
}
function renderSites() {
  const on = SC.enabled(), a = ST.list();
  const off = on ? '' : '<p class="hint">Saved, but Ember can only check them once Web Scraping is switched on in Settings.</p>';
  $('sitesBox').classList.remove('hidden');
  $('sitesList').innerHTML = off + (a.length ? a.map((x, i) => '<div class="cr"><button class="btn g siteGo" data-i="' + i + '" style="text-align:left;padding:10px 12px">' + esc(x.name) + '<span style="display:block;font-size:11px;font-weight:400;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.url) + '</span></button><button class="hb siteDel" data-i="' + i + '" aria-label="Remove">✕</button></div>').join('') : '<p class="hint">No saved sites yet.</p>');
}
function renderAll() { renderKeys(); renderSites(); }
window.EmberScrapeUI = { repaint: renderAll }; // V1.6.1: lets app.js refresh the wk_ inputs after the shared Notepad extracts a scraping key

// ---------- tabs ----------
document.querySelectorAll('.wtab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.wtab').forEach(x => x.classList.toggle('on', x == b));
  document.querySelectorAll('.wpane').forEach(x => x.classList.toggle('hidden', x.id != 'wp_' + b.dataset.t));
  if (b.dataset.t == 'health') renderLocal();
}));

// ---------- health ----------
const COL = { ok: '#5FFF00', fail: '#FF3B3B', none: '#777', info: '#E5B800' };
function renderLocal() {
  $('hLocal').innerHTML = SC.healthLocal().map(r => '<div class="hrow"><div class="l"><span class="dot" style="background:' + (r.ok ? COL.ok : COL.fail) + '"></span><div>' + esc(r.name) + '<small>' + esc(r.msg) + '</small></div></div></div>').join('');
}
function provRow(r) { return '<div class="hrow"><div class="l"><span class="dot" style="background:' + COL[r.state] + '"></span><div>' + esc(r.label) + '<small>' + esc(r.msg) + (r.state == 'ok' || r.state == 'fail' ? ' · ' + r.ms + ' ms' : '') + '</small></div></div>' + (r.state == 'none' || r.state == 'info' ? '' : '<button class="btn g hOne" data-id="' + r.id + '" style="width:auto;padding:6px 12px;font-size:12px">Retry</button>') + '</div>'; }
const hRows = {};
function drawProv() { $('hProv').innerHTML = ['reader'].concat(SC.KEY_IDS).map(id => provRow(hRows[id] || { id, label: SC.LABEL[id], state: id == 'reader' ? 'info' : SC.get().keys[id] ? 'info' : 'none', msg: id == 'reader' ? 'Not checked yet (no key needed)' : SC.get().keys[id] ? 'Not checked yet' : 'No key set', ms: 0 })).join(''); }
$('hRun').onclick = async () => {
  const b = $('hRun'); b.disabled = true; b.textContent = 'Checking…';
  for (const id of ['reader'].concat(SC.KEY_IDS)) { hRows[id] = { id, label: SC.LABEL[id], state: 'info', msg: 'Checking…', ms: 0 }; drawProv(); hRows[id] = await SC.healthCheck(id); drawProv(); }
  b.disabled = false; b.textContent = 'Check all providers'; $('hWhen').textContent = 'Last checked ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
$('hProv').addEventListener('click', async e => {
  const b = e.target.closest('.hOne'); if (!b) return; b.disabled = true; hRows[b.dataset.id] = { id: b.dataset.id, label: SC.LABEL[b.dataset.id], state: 'info', msg: 'Checking…', ms: 0 }; drawProv();
  hRows[b.dataset.id] = await SC.healthCheck(b.dataset.id); drawProv();
});

// ---------- test panel ----------
$('tRun').onclick = async () => {
  const b = $('tRun'); b.disabled = true; b.textContent = 'Running…'; $('tMeta').textContent = ''; $('tOut').classList.add('hidden');
  const r = await SC.test($('tUrl').value, $('tObj').value, $('tProv').value);
  $('tMeta').textContent = r.error ? 'Failed' + (r.ms ? ' after ' + r.ms + ' ms' : '') : r.provider + ' · ' + r.ms + ' ms · ' + r.chars + ' chars' + (r.trimmed ? ' · trimmed to the objective' : '');
  $('tOut').textContent = r.error || r.markdown.slice(0, 3000) + (r.markdown.length > 3000 ? '\n\n[preview cut at 3000 chars]' : ''); $('tOut').classList.remove('hidden');
  b.disabled = false; b.textContent = 'Run scrape test';
};
$('tSelf').onclick = () => {
  const t = SC.selfTest(), bad = t.filter(x => !x.ok).length;
  $('tMeta').textContent = bad ? bad + ' of ' + t.length + ' offline checks failed' : 'All ' + t.length + ' offline checks passed';
  $('tOut').textContent = t.map(x => (x.ok ? 'PASS ' : 'FAIL ') + x.name).join('\n'); $('tOut').classList.remove('hidden');
};


if ($('wkExtras')) $('wkExtras').addEventListener('click', e => { const b = e.target.closest('.wkDrop'); if (!b) return; const k = SC.keysOf(b.dataset.id)[+b.dataset.i]; if (k && SC.dropKey(b.dataset.id, k)) { renderAll(); toast('Extra key removed'); } });
if ($('wk_brightZone')) $('wk_brightZone').addEventListener('input', () => SC.setBrightZone($('wk_brightZone').value));
if ($('wk_brightUnlock')) $('wk_brightUnlock').addEventListener('input', () => { SC.setBrightUnlock($('wk_brightUnlock').value); $('wkStatus').textContent = SC.available().length ? 'Keys take turns, then the free reader: ' + SC.plan(true).map(k => SC.LABEL[k]).join(' → ') : 'Free reader is off and no scraping key is set yet.'; });
$('swScrape').onclick = () => { SC.setOn(!SC.enabled()); renderAll(); toast(SC.enabled() ? 'Web Scraping on' : 'Web Scraping off'); };
if ($('swReader')) $('swReader').onclick = () => { SC.setReader(!SC.readerOn()); renderAll(); toast(SC.readerOn() ? 'Free reader on (no key needed)' : 'Free reader off'); };
SC.KEY_IDS.forEach(id => { const el = $('wk_' + id); if (el) el.addEventListener('input', () => { SC.setKey(id, el.value); $('wkStatus').textContent = SC.available().length ? 'Keys take turns, then the free reader: ' + SC.plan(true).map(k => SC.LABEL[k]).join(' → ') : 'Free reader is off and no scraping key is set yet.'; }); });
$('wk_stingEp').addEventListener('input', () => { SC.setStingEndpoint($('wk_stingEp').value); renderKeys(); });
if ($('wk_octoTask')) $('wk_octoTask').addEventListener('input', () => { SC.setOctoTask($('wk_octoTask').value); });

$('siteAdd').onclick = () => {
  const r = ST.add($('siteName').value, $('siteUrl').value);
  if (r.error) { toast(r.error); return; }
  $('siteName').value = ''; $('siteUrl').value = ''; renderSites(); toast('Saved ' + r.name);
};
$('sitesList').addEventListener('click', e => {
  const del = e.target.closest('.siteDel'), go = e.target.closest('.siteGo');
  const a = ST.list();
  if (del && a[+del.dataset.i]) { ST.remove(a[+del.dataset.i].name); renderSites(); }
  else if (go && a[+go.dataset.i]) {
    $('bDx').click(); $('inp').value = 'Check my ' + a[+go.dataset.i].name; $('inp').dispatchEvent(new Event('input')); $('bSend').click();
  }
});
// refresh whenever the drawer or settings open
['bSet', 'bMenu', 'bHist'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', () => setTimeout(renderAll, 50)); });
new MutationObserver(renderAll).observe($('drawer'), { attributes: true, attributeFilter: ['class'] });
new MutationObserver(renderAll).observe($('settings'), { attributes: true, attributeFilter: ['class'] });
renderAll(); drawProv();
})();
