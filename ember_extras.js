// Ember V1.9.24 - ember_extras.js: three small features, all on-device.
//   1. Saved replies  - a star on every reply keeps it in a searchable list (Menu > Saved Replies).
//   2. Share this chat - the open chat as clean Markdown: preview, copy, or the phone's share sheet (Menu > Share this chat).
//   3. Usage           - how many replies each engine gave you today and this week, average speed, top model (Settings > General > Usage).
// Reads the chat from the screen and the saved chats from Store; nothing is sent anywhere. Loads last.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); };
const log = $('log'), drawerOpen = $('dp_chats'); if (!log) return;
const SK = 'ember_saved', CAP = 200;
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'x' + (h >>> 0).toString(36); };
const saved = () => lsGet(SK, []);
const label = id => { try { return window.Prov ? window.Prov.label(id) : id; } catch (e) { return id; } };

async function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* fall through */ }
  try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return !!ok; } catch (e) { return false; }
}

// ---------- 1. saved replies ----------
const msgText = el => { const d = el.querySelector(':scope > div'); return d ? (d.innerText || d.textContent || '').trim() : ''; };
function decorate() {
  const have = new Set(saved().map(x => x.id));
  log.querySelectorAll('.msg.a:not(.egg):not(.typing) .mt').forEach(mt => {
    const msg = mt.closest('.msg'), id = hash(msgText(msg));
    let b = mt.querySelector('[data-xs]');
    if (!b) { b = document.createElement('button'); b.setAttribute('data-xs', '1'); mt.appendChild(b); }
    const on = have.has(id);
    if (b.dataset.on !== (on ? '1' : '0')) { b.dataset.on = on ? '1' : '0'; b.textContent = on ? '★ Saved' : '☆ Save'; b.title = on ? 'Remove from Saved Replies' : 'Save this reply'; b.setAttribute('aria-label', b.title); }
  });
}
let raf = 0; new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(decorate); }).observe(log, { childList: true, subtree: true });
log.addEventListener('click', e => {
  const b = e.target.closest('[data-xs]'); if (!b) return;
  const msg = b.closest('.msg'), t = msgText(msg); if (!t) return;
  const id = hash(t), list = saved(), at = list.findIndex(x => x.id == id);
  if (at >= 0) { list.splice(at, 1); lsSet(SK, list); toast('Removed from Saved'); }
  else {
    let q = msg.previousElementSibling; while (q && !q.classList.contains('u')) q = q.previousElementSibling;
    const sp = msg.querySelector('.mt span'), eng = sp ? sp.textContent.replace(/^[^·]*·?\s*/, '').trim() : '';
    list.unshift({ id, t: t.slice(0, 8000), q: q ? msgText(q).slice(0, 140) : '', ts: Date.now(), eng });
    if (list.length > CAP) list.length = CAP;
    if (!lsSet(SK, list)) { toast('Could not save (storage full?)'); return; }
    toast('Saved');
  }
  decorate(); if (cur == 'saved' && sheet.classList.contains('show')) paint();
});

// ---------- the shared sheet ----------
const sheet = document.createElement('section'); sheet.id = 'xtras'; sheet.className = 'sheet';
sheet.innerHTML = '<div class="sh"><b>Saved, Share, Usage</b><button class="hb" id="xX" aria-label="Close">✕</button></div>' +
  '<div class="stabs" id="xTabs"><button class="stab on" data-xt="saved">⭐ Saved</button><button class="stab" data-xt="share">📤 Share chat</button><button class="stab" data-xt="usage">📊 Usage</button></div>' +
  '<div class="sb" id="xBody"></div>';
document.getElementById('app').parentNode.appendChild(sheet);
let cur = 'saved', q = '';
const body = $('xBody');
function openTab(t) {
  cur = t; q = '';
  sheet.querySelectorAll('#xTabs .stab').forEach(b => b.classList.toggle('on', b.dataset.xt == t));
  sheet.classList.add('show'); paint();
}
$('xX').onclick = () => sheet.classList.remove('show');
$('xTabs').onclick = e => { const b = e.target.closest('[data-xt]'); if (b) openTab(b.dataset.xt); };

function paint() { if (cur == 'saved') paintSaved(); else if (cur == 'share') paintShare(); else paintUsage(); }

function paintSaved() {
  const all = saved(), s = q.toLowerCase(), list = s ? all.filter(x => x.t.toLowerCase().includes(s) || (x.q || '').toLowerCase().includes(s)) : all;
  body.innerHTML = '<input type="text" id="xQ" placeholder="Search saved replies…" autocomplete="off" value="' + esc(q) + '">' +
    '<p class="hint">' + all.length + ' saved. Tap ☆ Save under any reply to keep it here. Stored on this phone only; "Delete everything" clears it.</p>' +
    (list.length ? list.map(x => '<div class="card xs" data-id="' + x.id + '">' + (x.q ? '<small class="xq">You: ' + esc(x.q) + '</small>' : '') +
      '<div class="xt">' + esc(x.t) + '</div><small class="xm">' + new Date(x.ts).toLocaleString() + (x.eng ? ' · ' + esc(x.eng) : '') + '</small>' +
      '<div class="brbtns"><button class="btn g" data-xa="open">Expand</button><button class="btn g" data-xa="copy">Copy</button><button class="btn g" data-xa="del">Delete</button></div></div>').join('')
      : '<p class="hint">' + (all.length ? 'Nothing matches.' : 'Nothing saved yet.') + '</p>');
  const inp = $('xQ'); inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; paintSaved(); const n = $('xQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } };
}
body.addEventListener('click', async e => {
  const b = e.target.closest('[data-xa]'); if (!b) return;
  const card = b.closest('.xs'), id = card && card.dataset.id, list = saved(), it = list.find(x => x.id == id); if (!it) return;
  if (b.dataset.xa == 'open') { const on = card.classList.toggle('open'); b.textContent = on ? 'Collapse' : 'Expand'; }
  else if (b.dataset.xa == 'copy') toast((await copyText(it.t)) ? 'Copied' : 'Copy failed');
  else if (b.dataset.xa == 'del') { lsSet(SK, list.filter(x => x.id != id)); paintSaved(); decorate(); toast('Deleted'); }
});

// ---------- 2. share this chat ----------
function chatMarkdown() {
  const who = ($('pName') && $('pName').textContent) || 'Ember', rows = [];
  log.querySelectorAll('.msg:not(.typing):not(.egg)').forEach(m => {
    const t = msgText(m); if (!t) return;
    rows.push('**' + (m.classList.contains('u') ? 'You' : who) + ':** ' + t);
  });
  if (!rows.length) return '';
  const first = rows[0].replace(/^\*\*[^*]+\*\*\s*/, '').replace(/\s+/g, ' ').slice(0, 60);
  return '# ' + first + '\n_Chat with ' + who + ' · ' + new Date().toLocaleDateString() + '_\n\n' + rows.join('\n\n') + '\n';
}
function paintShare() {
  const md = chatMarkdown();
  body.innerHTML = md ? '<p class="hint">This is the chat that is open right now, as Markdown. Check it, then copy or share it. Nothing leaves the phone until you pick a share target.</p>' +
    '<textarea id="xMd" rows="14" spellcheck="false">' + esc(md) + '</textarea>' +
    '<div class="brbtns" style="margin-top:8px"><button class="btn" id="xCopy">Copy</button><button class="btn g" id="xShare">Share…</button></div>'
    : '<p class="hint">Open a chat with at least one message first.</p>';
  if (!md) return;
  $('xCopy').onclick = async () => toast((await copyText($('xMd').value)) ? 'Chat copied' : 'Copy failed');
  $('xShare').onclick = async () => {
    const t = $('xMd').value;
    if (navigator.share) { try { await navigator.share({ title: 'Ember chat', text: t }); return; } catch (e) { if (e && e.name == 'AbortError') return; } }
    toast((await copyText(t)) ? 'No share sheet here, copied instead' : 'Could not share');
  };
}

// ---------- 3. usage ----------
// host/flat: the Settings card paints into its own box with flat blocks; the sheet tab keeps its cards.
async function paintUsage(host, flat) {
  host = host || body; const BLK = flat ? 'ux-blk' : 'card', TTL = flat ? 'ux-t' : 'ct';
  host.innerHTML = '<p class="hint">Counting…</p>';
  let convs = []; try { convs = await window.Store.all(); } catch (e) { /* storage blocked */ }
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const day = d0.getTime(), week = day - 6 * 864e5;
  const by = {}; let tot = 0, totW = 0;
  convs.forEach(c => (c.msgs || []).forEach(m => {
    if (m.r != 'a' || !m.eng || !m.eng.p || !m.ts || m.ts < week) return;
    const e = by[m.eng.p] || (by[m.eng.p] = { d: 0, w: 0, ms: 0, n: 0, models: {} });
    e.w++; totW++; if (m.ts >= day) { e.d++; tot++; }
    if (m.eng.ms) { e.ms += m.eng.ms; e.n++; }
    if (m.eng.m) { const k = String(m.eng.m).replace(/^.*\//, ''); e.models[k] = (e.models[k] || 0) + 1; }
  }));
  let st = {}; try { st = window.Prov.status() || {}; } catch (e) { /* no status */ }
  const ids = Object.keys(by).sort((a, b) => by[b].w - by[a].w);
  const dot = id => st[id] == 'ok' ? '🟢' : st[id] == 'limited' ? '🟡' : st[id] == 'bad' ? '🔴' : '⚪';
  host.innerHTML = '<div class="' + BLK + '"><div class="' + TTL + '">Replies</div><p style="margin:4px 0"><b style="font-size:22px">' + tot + '</b> today · <b>' + totW + '</b> in the last 7 days</p>' +
    '<p class="hint" style="margin:6px 0 0">Counted from the chats saved on this phone (private chats included). Private chats you deleted are not counted. Rate limits are set by each provider, so this shows how hard you are leaning on each engine, not how much is left.</p></div>' +
    (ids.length ? ids.map(id => { const e = by[id], top = Object.keys(e.models).sort((a, b) => e.models[b] - e.models[a])[0];
      return '<div class="' + BLK + '"><div class="' + TTL + '">' + dot(id) + ' ' + esc(label(id)) + '</div><p style="margin:4px 0"><b>' + e.d + '</b> today · <b>' + e.w + '</b> this week' +
        (e.n ? ' · avg <b>' + Math.round(e.ms / e.n) + ' ms</b>' : '') + '</p>' + (top ? '<small class="xm">Most used model: ' + esc(top) + '</small>' : '') + '</div>'; }).join('')
      : '<p class="hint">No replies in the last 7 days yet.</p>') +
    '<p class="hint">🟢 ready · 🟡 rate limited right now · 🔴 key problem · ⚪ not checked</p>';
}

// ---------- entry points in the Menu ----------
const anchor = $('bSitesOpen');
if (anchor && anchor.parentNode) {
  [['⭐', 'Saved Replies', 'Replies you starred', 'saved'], ['📤', 'Share this chat', 'Copy it or send it as Markdown', 'share']].forEach(r => {
    const b = document.createElement('button'); b.className = 'rcbtn'; b.setAttribute('aria-label', r[1]);
    b.innerHTML = '<span class="rci">' + r[0] + '</span><span class="rct"><b>' + r[1] + '</b><small>' + r[2] + '</small></span><span class="chev">›</span>';
    b.onclick = () => { const x = $('bDx'); if (x) x.click(); openTab(r[3]); };
    anchor.parentNode.appendChild(b);
  });
}

// ---------- Usage card in Settings > General (it used to be a button in the left menu) ----------
(() => {
  const set = $('settings'), sbEl = set && set.querySelector('.sb'); if (!sbEl || $('usageCard')) return;
  const card = document.createElement('div'); card.className = 'card'; card.id = 'usageCard'; card.dataset.tab = 'general';
  card.innerHTML = '<div class="ct">Usage</div><div id="usageSet"><p class="hint">Replies per engine, today and this week.</p></div>';
  const look = Array.from(sbEl.querySelectorAll('.card[data-tab="general"] > .ct')).find(c => /^Look/.test(c.textContent.trim()));
  if (look) look.parentNode.after(card); else sbEl.appendChild(card);
  const peer = sbEl.querySelector('.card[data-tab="general"]:not(#usageCard)'); card.classList.toggle('stab-show', !!(peer && peer.classList.contains('stab-show')));
  let lastT = 0;
  const fill = () => { if (!set.classList.contains('show') || Date.now() - lastT < 1500) return; lastT = Date.now(); paintUsage($('usageSet'), true); };
  if (window.MutationObserver) new MutationObserver(fill).observe(set, { attributes: true, attributeFilter: ['class'] });
})();
decorate();
window.EmberExtras = { open: openTab, saved, chatMarkdown };
})();
