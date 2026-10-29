// Ember V1.9.8 - ember_prov_ui.js: the Providers chip in the header (dropdown of every engine with a LIVE status dot)
// and the 📎 Docs quick button that replaced the dictation button.
// Dots are never guessed: no key = grey, never green. Opening the dropdown lists each key's models (no chat call, no credit) to check it.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TXT = { ok: 'authenticated / available', limited: 'rate limited, key is valid', bad: 'key rejected or unreachable', none: 'no key saved', unknown: 'key saved, not checked yet' };
window.addEventListener('ember-provider-stats', () => { if(open && !busy) paint(); });
let open = false, busy = false, lastAt = 0, tk = 0;

function lat(d) { return d.lat ? '⚡ ' + d.lat + ' ms' : '⚡ —'; }
// Branded, full-colour provider marks. Inline SVG keeps the icons crisp and available offline.
function mark(id) { return window.EmberProviderBadge ? window.EmberProviderBadge(id) : '<span class="pdbrand">'+esc(id.slice(0,2).toUpperCase())+'</span>'; }
function rowFor(id) {
  const P = window.Prov, st = P.stateOf(id), n = P.entries(id).length, c = P.CFG[id], d = P.detail(id), chk = busy && n;
  const proto = c.status === 'prototype' ? ' <i class="pdproto">prototype</i>' : '';
  const keys = n + ' key' + (n === 1 ? '' : 's');
  let sub, right;
  if (!n) { sub = TXT.none; right = '<div class="pdlat pdl-mut">No key</div>'; }
  else if (chk) { sub = 'checking…'; right = '<div class="pdlat pdl-mut">Checking…</div>'; }
  else if (st === 'limited') { sub = d.model || TXT.limited; right = '<div class="pdlat pdl-am">Rate limited</div><div class="pdcost">' + (d.retry ? 'Retry in ' + d.retry + 's' : 'key is valid') + '</div>'; }
  else if (st === 'bad') { sub = d.model || TXT.bad; right = '<div class="pdlat pdl-rd">Rejected</div><div class="pdcost">' + esc(String(d.msg || 'check the key').slice(0, 28)) + '</div>'; }
  else if (st === 'unknown') { sub = TXT.unknown; right = '<div class="pdlat pdl-mut">Not checked</div><div class="pdcost">' + keys + '</div>'; }
  else { sub = d.model || 'model picked on first use'; right = '<div class="pdlat">' + lat(d) + '</div><div class="pdcost">' + keys + '</div>'; }
  const dim = !n || st === 'limited' || st === 'bad' ? ' pd-dim' : '';
  return '<button class="pdrow' + dim + '" role="menuitem" data-id="' + esc(id) + '"><span class="pdd ' + (chk ? 'chk' : st) + '"></span>' +
    '<span class="pdinfo"><span class="pdn">' + mark(id) + '<b class="provider-title">' + esc(c.name) + '</b>' + proto + '</span><small>' + esc(sub) + '</small></span><span class="pdright">' + right + '</span></button>';
}
function freeRow() {
  const P = window.Prov, on = P.freeOn();
  return '<button class="pdrow' + (on ? '' : ' pd-dim') + '" role="menuitem" data-id="free"><span class="pdd ' + (on ? 'free' : 'none') + '"></span><span class="pdinfo"><span class="pdn">Free Mode <i class="pdproto">no key</i></span><small>' + (on ? 'on · third-party, model unknown' : 'off') + '</small></span><span class="pdright"><div class="pdlat ' + (on ? '' : 'pdl-mut') + '">' + (on ? 'On' : 'Off') + '</div></span></button>';
}
function paint() {
  const d = $('provDrop'), P = window.Prov; if (!d || !P) return;
  d.innerHTML = '<div class="pdh"><div><b>API &amp; Engine Health</b><small class="pdsummary">Live status · latency · key state</small></div><button class="pdre" id="pdRe" aria-label="Check all providers now">' + (busy ? '…' : '↻ Check') + '</button></div>' +
    P.IDS.map(rowFor).join('') + freeRow() +
    '<div class="pdleg"><span><i class="pdd ok"></i>API available</span><span><i class="pdd limited"></i>Rate limited</span><span><i class="pdd bad"></i>Key/API error</span><span><i class="pdd none"></i>No key</span></div>' +
    '<p class="pdnote">' + (lastAt ? 'Checked ' + new Date(lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '. ' : '') + 'A provider with no key can never show green.</p>';
}
async function check() {
  const P = window.Prov; if (!P || busy) return;
  busy = true; if (open) paint();
  try { await P.pingAll(); } catch (e) { /* offline: dots keep their last honest state */ }
  busy = false; lastAt = Date.now();
  if (open) paint();
  try { window.dispatchEvent(new Event('ember-names')); } catch (e) { /* header refresh is best effort */ }
}
function toggle(force) {
  const d = $('provDrop'), b = $('bProv'); if (!d || !b) return;
  open = force === undefined ? !open : !!force;
  d.classList.toggle('hidden', !open); b.classList.toggle('on', open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { paint(); check(); }
  clearInterval(tk); tk = 0;
  if (open) tk = setInterval(() => { try { if (!busy) paint(); } catch (e) { /* repaint is best effort */ } }, 1000);
}
if ($('bProv')) {
  $('bProv').addEventListener('click', e => { e.stopPropagation(); toggle(); });
  $('provDrop').addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('#pdRe')) { check(); return; }
    const r = e.target.closest('.pdrow'); if (!r) return;
    toggle(false);
    const s = $('bSet'); if (s) s.click();
    setTimeout(() => { const t = document.querySelector('.stab[data-st="keys"]'); if (t) t.click(); }, 60);
  });
  document.addEventListener('click', e => { if (open && !e.target.closest('#provDrop') && !e.target.closest('#bProv')) toggle(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });
  window.addEventListener('ember-names', () => { if (open && !busy) paint(); });
  // quiet first check so the header pill and the dots are right without opening anything
  setTimeout(() => { try { if (window.Prov && window.Prov.hasKeys()) check(); } catch (e) { /* not ready */ } }, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && window.Prov && window.Prov.hasKeys() && Date.now() - lastAt > 5 * 60 * 1000) check(); });
}

// 📎 Docs: opens the Documents tab (one paperclip there attaches files or a note)
if ($('bDocsQuick')) $('bDocsQuick').onclick = () => { if (window.EmberBrowser) window.EmberBrowser.open('docs'); };
})();
