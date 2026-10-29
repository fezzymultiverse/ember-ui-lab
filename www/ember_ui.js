// Ember V1.9.0 - ember_ui.js: UI glue added in V1.9.0 (loads last).
// engine pill tap, music-console wallpaper, editable provider names, key-provider auto-detect, dynamic provider labels.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };

// ---- provider names: engine names come from providers.js; nothing hard-codes "Groq" any more. V1.9.85: renaming is gone, the Keys list just shows the names. ----
const NK = 'ember_provnames', DEFAULTS = {};
function applyNames() {
  const P = window.Prov; if (!P || !P.CFG) return;
  try { localStorage.removeItem(NK); } catch (e) { /* storage blocked */ } // V1.9.85: names saved by the old rename boxes are dropped, so every engine shows its real name
  P.IDS.forEach(id => { if (!(id in DEFAULTS)) DEFAULTS[id] = P.CFG[id].name; P.CFG[id].name = DEFAULTS[id]; });
  syncLabels();
}
function syncLabels() {
  const P = window.Prov; if (!P) return;
  const sel = $('kProv');
  if (sel) Array.from(sel.options).forEach(op => { if (P.CFG[op.value]) op.textContent = P.CFG[op.value].name + (P.CFG[op.value].status == 'prototype' ? ' (Prototype)' : ''); });
  document.querySelectorAll('.pingname').forEach(n => { n.textContent = P.label('groq'); });
  const pn = $('provNames'); if (pn) pn.textContent = P.IDS.map(id => P.CFG[id].name).join(', ');
}
function paintNames() {
  const P = window.Prov, host = $('provNameBox'); if (!P || !host) return;
  host.innerHTML = P.IDS.map(id => '<div class="pnrow"><span class="pn-name">' + esc(DEFAULTS[id] || id) + '</span></div>').join('');
}
function mountNames() { // V1.9.96: the "Provider names" card is gone. Any copy left in the page is removed; nothing is added.
  const box = $('provNameBox'), card = box && box.closest ? box.closest('.card') : null; if (card) card.remove();
}

// ---- key box: the provider follows the key you paste ----
function guess(k) {
  k = String(k || '').trim();
  if (/^gsk_/.test(k)) return 'groq'; if (/^(AIza|AQ\.)/.test(k)) return 'gemini'; if (/^sk-ant-/.test(k)) return 'anthropic';
  return '';
}
if ($('kIn')) $('kIn').addEventListener('input', () => { const g = guess($('kIn').value), sel = $('kProv'); if (g && sel && sel.value != g) { sel.value = g; toast('Looks like a ' + window.Prov.label(g) + ' key'); } });

// ---- header pill ----
if ($('engs')) $('engs').onclick = () => { const b = $('bSet'); if (b) b.click(); setTimeout(() => { const t = document.querySelector('.stab[data-st="keys"]'); if (t) t.click(); }, 60); };

// ---- music console wallpaper: app icon (default), ember glow, or your own picture ----
const WK = 'ember_dm_wall';
function paintWall() {
  const box = document.querySelector('.drawer-music'); if (!box) return;
  const w = lsGet(WK, { mode: 'icon' });
  box.dataset.wall = w.mode;
  if (w.mode == 'custom' && w.img) box.style.setProperty('--dm-img', 'url("' + w.img + '")'); else box.style.removeProperty('--dm-img');
}
function shrink(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const s = Math.min(1, 640 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
if ($('dmWall')) {
  $('dmWall').onclick = () => {
    const w = lsGet(WK, { mode: 'icon' }), order = ['icon', 'glow', 'custom'];
    const next = order[(order.indexOf(w.mode) + 1) % order.length];
    if (next == 'custom') { if (w.img) { lsSet(WK, { mode: 'custom', img: w.img }); paintWall(); toast('Wallpaper: your picture'); } else $('dmWallFile').click(); return; }
    lsSet(WK, { mode: next, img: w.img }); paintWall(); toast(next == 'icon' ? 'Wallpaper: Ember icon' : 'Wallpaper: orange glow');
  };
  $('dmWallFile').onchange = async () => { const f = $('dmWallFile').files[0]; if (!f) return; try { const img = await shrink(f); if (!lsSet(WK, { mode: 'custom', img })) toast('Picture too large to save'); else toast('Wallpaper set'); } catch (e) { toast('Could not read that picture'); } $('dmWallFile').value = ''; paintWall(); };
  $('dmWall').addEventListener('contextmenu', e => { e.preventDefault(); $('dmWallFile').click(); });
}

const hadNames = Object.keys(lsGet(NK, {})).length; applyNames(); mountNames(); paintWall(); if (hadNames) window.dispatchEvent(new Event('ember-names'));
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#bSet')) setTimeout(() => { mountNames(); syncLabels(); }, 30); });
window.EmberUI = { applyNames, syncLabels, paintWall };
})();

// V1.9.3: the empty-state hero sits above the music widget + composer, whatever their height (no more overlap).
(() => {
  const root = document.documentElement, foot = document.querySelector('footer.comp'), mw = document.getElementById('mw');
  if (!foot) return;
  const fit = () => {
    const h = foot.offsetHeight + ((mw && !mw.classList.contains('hidden')) ? mw.offsetHeight + 6 : 0);
    root.style.setProperty('--dock', h + 'px');
  };
  fit();
  if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(foot); if (mw) ro.observe(mw); }
  if (mw && window.MutationObserver) new MutationObserver(fit).observe(mw, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', fit);
})();
