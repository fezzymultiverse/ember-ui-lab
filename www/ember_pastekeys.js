// Ember V1.9.32 - ember_pastekeys.js: "Paste keys" card (Settings > Keys). One tap reads the clipboard, works out which key belongs to which
// provider (EmberKeyScan), saves ONLY the ones not added yet (EmberKeyScan.ingestAll files them and tests chat keys), and shows a named list:
// provider, masked key, NEW or already added. Keys it could not name are listed with a provider picker so one tap files them too.
// Key values stay in memory for this screen only; they are written nowhere except the normal key stores. Copy named list is an explicit tap.
'use strict';
(() => {
const KS = () => window.EmberKeyScan, P = () => window.Prov, S = () => window.EmberScraper;
const mk = k => (String(k).length > 12 ? String(k).slice(0, 4) + '…' + String(k).slice(-4) : '••••');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
let last = { rows: [], loose: [] };

// every key already saved for a provider id (values stay inside this module)
function savedOf(id) {
  try {
    if (P() && P().CFG && P().CFG[id]) return ((P().entries(id)) || []).map(e => e && e.key).filter(Boolean);
    if (id == 'audd') { const A = window.EmberAudd; return A && A.hasKey && A.hasKey() ? [A.getKey()] : []; }
    if (id == 'easyvoice') { const V = window.EmberVoice, k = V && V.cfg ? String((V.cfg() || {}).ezKey || '').trim() : ''; return k ? [k] : []; }
    if (S() && S().keysOf) return S().keysOf(id);
  } catch (e) { /* a store that is not loaded counts as empty */ }
  return [];
}
// single-slot providers keep one key only: a different key in the paste is not saved
const SINGLE = { audd: 1, easyvoice: 1 };

// what is in this text, and is each key new or already saved. No saving here.
function preview(text) {
  const ks = KS(); if (!ks) throw new Error('Key finder not loaded');
  const sc = ks.scan(text), rows = [];
  ks.IDS.forEach(id => (sc.keys[id] || []).forEach(key => {
    const have = savedOf(id);
    rows.push({ id, label: ks.LABEL[id] || id, key, state: have.includes(key) ? 'have' : (SINGLE[id] && have.length ? 'full' : 'new') });
  }));
  return { sc, rows };
}

// preview, file the new ones, then re-read the stores so the status shown is what really happened
async function run(text) {
  const ks = KS(), before = preview(text), rep = await ks.ingestAll(text);
  const ok = {}; ((rep.chat && rep.chat.added) || []).forEach(a => { ok[a.key] = a.ok; });
  const rows = before.rows.map(r => {
    if (r.state != 'new') return r;
    const saved = savedOf(r.id).includes(r.key);
    return Object.assign({}, r, { state: saved ? (ok[r.key] === false ? 'saved-bad' : 'added') : 'skipped' });
  });
  // keys the finder named only by testing them live (unlabelled 32 / 40 character Mistral / Cohere keys)
  ((rep.chat && rep.chat.added) || []).filter(a => a.guess && !rows.some(r => r.key == a.key)).forEach(a => rows.push({ id: a.id, label: ks.LABEL[a.id] || a.id, key: a.key, state: a.ok ? 'added' : 'saved-bad', guess: a.guess }));
  const loose = (before.sc.unlabelled || []).slice();
  last = { rows, loose, rep };
  return last;
}

// the user names a key the finder could not name: file it straight into that provider
async function assign(tok, id) {
  const ks = KS(), c = ks.CAT[id]; if (!c) return { ok: false, why: 'unknown provider' };
  try {
    if (P() && P().CFG && P().CFG[id]) { const r = await P().addKey(id, tok); return r && r.ok ? { ok: true } : { ok: false, why: (r && r.why) || 'not accepted' }; }
    if (id == 'audd') { const A = window.EmberAudd; if (A && A.hasKey()) return { ok: false, why: 'Audd.io already has a token' }; return { ok: !!(A && A.setKey(tok)) }; }
    if (id == 'easyvoice') { const V = window.EmberVoice; if (!V || !V.setCfg) return { ok: false, why: 'voice settings not loaded' }; if (String((V.cfg() || {}).ezKey || '').trim()) return { ok: false, why: 'EasyVoice already has a key' }; V.setCfg({ ezKey: tok }); return { ok: true }; }
    const r = S() && S().addKey ? S().addKey(id, tok) : ''; return r == 'dup' ? { ok: false, why: 'already saved' } : r ? { ok: true } : { ok: false, why: 'not accepted (no room or wrong shape)' };
  } catch (e) { return { ok: false, why: String(e && e.message || 'failed').slice(0, 80) }; }
}

// every saved key with its provider name, one per line (only when the user taps Copy)
function namedList() {
  const ks = KS(), out = [];
  if (!ks) return '';
  ks.IDS.forEach(id => savedOf(id).forEach(k => out.push(ks.LABEL[id] + ': ' + k)));
  return out.join('\n');
}

const TAG = { added: ['NEW · saved', 'ok'], 'saved-bad': ['NEW · saved, check failed', 'w'], have: ['already added', 'i'], full: ['slot already has a different key', 'w'], skipped: ['not saved', 'w'], new: ['new', 'ok'] };
function html(res) {
  const rows = res.rows, n = s => rows.filter(r => r.state == s).length;
  const newN = n('added') + n('saved-bad') + n('new'), haveN = n('have');
  let h = '<div class="pk-sum">' + (rows.length ? '<b>' + newN + '</b> new · <b>' + haveN + '</b> already added' + (n('full') + n('skipped') ? ' · ' + (n('full') + n('skipped')) + ' not saved' : '') : '<span class="w">No keys with a recognisable provider found.</span>') + '</div>';
  const by = {}; rows.forEach(r => { (by[r.label] = by[r.label] || []).push(r); });
  Object.keys(by).forEach(lbl => {
    h += '<div class="pk-grp"><div class="pk-name">' + esc(lbl) + '</div>' + by[lbl].map(r => { const t = TAG[r.state] || TAG.skipped; return '<div class="pk-row"><code>' + esc(mk(r.key)) + '</code><span class="pk-tag ' + t[1] + '">' + esc(t[0]) + '</span>' + (r.guess ? '<span class="pk-tag i">identified by testing it</span>' : '') + '</div>'; }).join('') + '</div>';
  });
  if (res.loose.length) {
    const opts = KS().IDS.map(id => '<option value="' + id + '">' + esc(KS().LABEL[id]) + '</option>').join('');
    h += '<div class="pk-grp"><div class="pk-name">Which provider? <span class="pk-sub">' + res.loose.length + ' key-like string' + (res.loose.length == 1 ? '' : 's') + ' with no name near ' + (res.loose.length == 1 ? 'it' : 'them') + '</span></div>' +
      res.loose.map((t, i) => '<div class="pk-row" data-i="' + i + '"><code>' + esc(mk(t)) + '</code><select class="pk-sel"><option value="">Pick…</option>' + opts + '</select><button class="btn g pk-fix" style="width:auto;padding:0 12px">Save</button><span class="pk-msg"></span></div>').join('') + '</div>';
  }
  (res.rep && res.rep.errors || []).forEach(e => { h += '<div class="w">' + esc(e) + '</div>'; });
  const fo = (res.rep && res.rep.scan && res.rep.scan.foreign) || [];
  if (fo.length) h += '<div class="pk-sub">Not saved, Ember has no engine for them: ' + esc(fo.map(f => f.n + ' ' + f.kind).join(', ')) + '</div>';
  return h;
}

async function go(text, btn) {
  const out = $('pkOut'); if (!text || !text.trim()) { if (window.emberToast) window.emberToast('Nothing to detect'); return; }
  const lbl = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = 'Detecting…'; }
  try {
    const res = await run(text); out.innerHTML = html(res);
    if (res.rows.some(r => r.state == 'added' || r.state == 'saved-bad')) $('pkBox').value = '';
    out.querySelectorAll('.pk-fix').forEach(b => { b.onclick = async () => {
      const row = b.closest('.pk-row'), id = row.querySelector('.pk-sel').value, msg = row.querySelector('.pk-msg'); if (!id) { msg.textContent = 'Pick a provider'; return; }
      b.disabled = true; const r = await assign(res.loose[+row.dataset.i], id); b.disabled = false;
      msg.textContent = r.ok ? '✓ saved as ' + KS().LABEL[id] : r.why; msg.className = 'pk-msg ' + (r.ok ? 'ok' : 'w'); if (r.ok) { b.remove(); row.querySelector('.pk-sel').disabled = true; if (window.emberRenderKeys) window.emberRenderKeys(); }
    }; });
  } catch (e) { out.innerHTML = '<span class="w">Failed: ' + esc(e.message) + '</span>'; }
  if (btn) { btn.disabled = false; btn.textContent = lbl; }
  if (typeof window.emberRenderKeys == 'function') window.emberRenderKeys();
}

function bind() {
  if (!$('pkGo')) return;
  $('pkGo').onclick = async () => {
    let t = ''; try { t = await navigator.clipboard.readText(); } catch (e) { /* the phone blocks it: use the box */ }
    if (t && t.trim()) { $('pkBox').value = t; return go(t, $('pkGo')); }
    $('pkBox').focus(); if (window.emberToast) window.emberToast('The phone blocked auto-paste. Long-press the box, tap Paste, then Detect');
  };
  $('pkRun').onclick = () => go($('pkBox').value, $('pkRun'));
  $('pkCopy').onclick = async () => {
    const t = namedList(); if (!t) { if (window.emberToast) window.emberToast('No keys saved yet'); return; }
    try { await navigator.clipboard.writeText(t); if (window.emberToast) window.emberToast('Copied: ' + t.split('\n').length + ' keys with their names'); }
    catch (e) { if (window.emberToast) window.emberToast('The phone blocked copying'); }
  };
}
if (typeof document != 'undefined') { if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', bind); else bind(); }
window.EmberPasteKeys = { preview, run, assign, namedList, html, savedOf };
})();
