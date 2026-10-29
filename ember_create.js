// Ember V1.9.84 - ember_create.js: Notes (quick notes Ember can read) and the image route behind + > Create image. Loads after ember_extras.js.
// V1.9.84: Imagine left the left menu. + > Create image routes the next message to Pollinations (flux, no chat engine) and answers with an HTML artifact that carries the picture and the thought process.
// V1.9.85: the Notes button left the left menu. It is now the first row in Browser > Documents (#dcNotesOpen) and opens this same Notes sheet.
// Earlier: Imagine (make images) and Notes.
//   Imagine: your prompt goes to image.pollinations.ai (free, third party, no key) only when you tap "Make it". The image is shown in the app.
//   Notes:   stored in the Documents library on this phone (so they also show in Browser > Documents, and Ember's document tools can search and read them).
'use strict';
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); };
const log = $('log'); if (!log) return;
const D = () => window.EmberDocs;
async function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* fall through */ }
  try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return !!ok; } catch (e) { return false; }
}
const shareText = async (title, text) => {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name == 'AbortError') return; } }
  toast((await copyText(text)) ? 'No share sheet here, copied instead' : 'Could not share');
};

// ---------- the sheet ----------
const sheet = document.createElement('section'); sheet.id = 'xcreate'; sheet.className = 'sheet';
sheet.innerHTML = '<div class="sh"><b>Notes</b><button class="hb" id="cX" aria-label="Close">✕</button></div>' +
  '<div class="stabs" id="cTabs"><button class="stab on" data-ct="imagine">🎨 Imagine</button><button class="stab" data-ct="notes">📝 Notes</button></div>' +
  '<div class="sb" id="cBody"></div>';
document.getElementById('app').parentNode.appendChild(sheet);
const body = $('cBody'); let cur = 'notes', noteId = '';
function openTab(t) {
  t = 'notes'; // V1.9.84: Imagine moved to + > Create image
  if (cur == 'notes' && t != 'notes') flushNote();
  cur = t; sheet.querySelectorAll('#cTabs .stab').forEach(b => b.classList.toggle('on', b.dataset.ct == t));
  sheet.classList.add('show'); if (t == 'imagine') paintImagine(); else { noteId = ''; paintNotes(); }
}
$('cX').onclick = async () => { await flushNote(); sheet.classList.remove('show'); };
$('cTabs').onclick = e => { const b = e.target.closest('[data-ct]'); if (b) openTab(b.dataset.ct); };

// ---------- Imagine ----------
const IMG = 'https://image.pollinations.ai/prompt/', HK = 'ember_imagine';
const STYLES = { None: '', Photo: ', photorealistic, natural light, sharp detail', Anime: ', anime style, clean line art, vivid colour', Neon: ', neon cyberpunk, glowing orange and purple, dark background', Pixel: ', pixel art, 16-bit', Sketch: ', pencil sketch, hand drawn' };
const SIZES = { Square: [1024, 1024], Portrait: [768, 1024], Landscape: [1024, 768] };
let st = { prompt: '', style: 'None', size: 'Square', seed: 0, url: '' };
const urlFor = (p, w, h, seed) => IMG + encodeURIComponent(p) + '?width=' + w + '&height=' + h + '&seed=' + seed + '&nologo=true&model=flux';
function paintImagine() {
  const hist = lsGet(HK, []);
  body.innerHTML = '<textarea id="iP" rows="3" maxlength="400" placeholder="Describe the image… e.g. a husky and a lab hanging out in a neon-lit Cape Town street" spellcheck="false">' + esc(st.prompt) + '</textarea>' +
    '<div class="ptags" id="iStyles">' + Object.keys(STYLES).map(k => '<button class="ptag' + (k == st.style ? ' on' : '') + '" data-is="' + k + '">' + k + '</button>').join('') + '</div>' +
    '<div class="ptags" id="iSizes">' + Object.keys(SIZES).map(k => '<button class="ptag' + (k == st.size ? ' on' : '') + '" data-iz="' + k + '">' + k + '</button>').join('') + '</div>' +
    '<button class="btn" id="iGo">Make it</button>' +
    '<p class="hint">Your prompt text is sent to Pollinations (image.pollinations.ai), a free third party, only when you tap Make it. Do not put private details in it. Images take a few seconds to a minute.</p>' +
    '<div id="iOut"></div>' +
    (hist.length ? '<div class="ct" style="margin-top:8px">Recent</div><div class="ptags" id="iHist" style="flex-wrap:wrap">' + hist.map((h, i) => '<button class="ptag" data-ih="' + i + '">' + esc(h.p.slice(0, 34)) + '</button>').join('') + '</div>' : '');
  $('iP').oninput = () => { st.prompt = $('iP').value; };
  $('iStyles').onclick = e => { const b = e.target.closest('[data-is]'); if (!b) return; st.style = b.dataset.is; $('iStyles').querySelectorAll('.ptag').forEach(x => x.classList.toggle('on', x === b)); };
  $('iSizes').onclick = e => { const b = e.target.closest('[data-iz]'); if (!b) return; st.size = b.dataset.iz; $('iSizes').querySelectorAll('.ptag').forEach(x => x.classList.toggle('on', x === b)); };
  $('iGo').onclick = () => make(true);
  const h = $('iHist'); if (h) h.onclick = e => { const b = e.target.closest('[data-ih]'); if (!b) return; const it = hist[+b.dataset.ih]; if (!it) return; st.prompt = it.p; st.style = 'None'; st.size = it.s || 'Square'; st.seed = it.seed; paintImagine(); make(false); };
  if (st.url) show(st.url);
}
let imgTimer = 0;
function make(fresh) {
  const p = ($('iP').value || '').trim(); if (!p) { toast('Describe the image first'); return; }
  st.prompt = $('iP').value; if (fresh || !st.seed) st.seed = Math.floor(Math.random() * 1e6);
  const full = p + (STYLES[st.style] || ''), [w, h] = SIZES[st.size] || SIZES.Square;
  st.url = urlFor(full, w, h, st.seed);
  const hist = lsGet(HK, []).filter(x => !(x.p == p && x.seed == st.seed)); hist.unshift({ p, seed: st.seed, s: st.size, ts: Date.now() }); hist.length = Math.min(hist.length, 30); lsSet(HK, hist);
  show(st.url, true);
}
function show(url, loading) {
  const out = $('iOut'); if (!out) return; clearTimeout(imgTimer);
  out.innerHTML = '<div class="iwrap"><p class="hint" id="iMsg">' + (loading ? 'Making it…' : '') + '</p><img id="iImg" alt="Generated image" class="hidden"></div>' +
    '<div class="brbtns hidden" id="iAct"><button class="btn g" id="iAgain">New variation</button><button class="btn g" id="iShare">Share</button><button class="btn g" id="iLink">Copy link</button></div>';
  const img = $('iImg');
  img.onload = () => { clearTimeout(imgTimer); img.classList.remove('hidden'); $('iMsg').textContent = ''; $('iAct').classList.remove('hidden'); };
  img.onerror = () => { clearTimeout(imgTimer); $('iMsg').textContent = 'The image service did not answer. It is free and sometimes busy, so tap Make it again in a moment.'; $('iAct').classList.add('hidden'); };
  imgTimer = setTimeout(() => { if (img.classList.contains('hidden')) { img.onload = img.onerror = null; img.removeAttribute('src'); $('iMsg').textContent = 'That took too long. Try again, or a simpler prompt.'; } }, 90000);
  img.src = url;
  $('iAgain').onclick = () => make(true);
  $('iLink').onclick = async () => toast((await copyText(url)) ? 'Link copied' : 'Copy failed');
  $('iShare').onclick = async () => {
    try {
      const r = await fetch(url); const b = await r.blob(); const f = new File([b], 'ember-image.jpg', { type: b.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Ember image' }); return; }
    } catch (e) { if (e && e.name == 'AbortError') return; }
    toast((await copyText(url)) ? 'Cannot share the file here, link copied' : 'Could not share');
  };
}

// ---------- Notes (stored in the Documents library, src "note") ----------
const title = d => String(d.name || 'Untitled').replace(/\.txt$/i, '');
let saveT = 0, dirty = false, noteQ = '';
async function notes() { if (!D()) return []; return (await D().all()).filter(d => d.src === 'note').sort((a, b) => b.updated - a.updated); }
async function paintNotes() {
  if (!D()) { body.innerHTML = '<p class="hint">Documents are not loaded.</p>'; return; }
  if (noteId) return paintEditor();
  const all = await notes(), s = noteQ.toLowerCase(), list = s ? all.filter(d => d.name.toLowerCase().includes(s) || d.text.toLowerCase().includes(s)) : all;
  body.innerHTML = '<button class="btn" id="nNew">＋ New note</button><input type="text" id="nQ" placeholder="Search notes…" autocomplete="off" value="' + esc(noteQ) + '">' +
    '<p class="hint">' + all.length + ' note' + (all.length == 1 ? '' : 's') + '. Notes live in Browser > Documents too, so Ember can search and read them when you ask. Stored on this phone only.</p>' +
    (list.length ? list.map(d => '<button class="btn g xn" data-nid="' + esc(d.id) + '"><b>' + esc(title(d)) + '</b><small>' + new Date(d.updated).toLocaleDateString() + ' · ' + esc(d.text.slice(0, 80).replace(/\s+/g, ' ')) + '</small></button>').join('') : '<p class="hint">' + (all.length ? 'Nothing matches.' : 'No notes yet. Tap New note, or tap 📝 Note under any Ember reply.') + '</p>');
  $('nNew').onclick = async () => { const r = await D().addText('Untitled note.txt', '', 'note'); if (r.doc) { noteId = r.doc.id; paintNotes(); } };
  const q = $('nQ'); q.oninput = () => { noteQ = q.value; const pos = q.selectionStart; paintNotes().then(() => { const n = $('nQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }); };
  body.querySelectorAll('[data-nid]').forEach(b => b.onclick = () => { noteId = b.dataset.nid; paintNotes(); });
}
async function paintEditor() {
  const d = (await D().all()).find(x => x.id === noteId); if (!d) { noteId = ''; return paintNotes(); }
  body.innerHTML = '<input type="text" id="eT" maxlength="100" placeholder="Title" value="' + esc(title(d) == 'Untitled note' ? '' : title(d)) + '">' +
    '<textarea id="eB" rows="14" placeholder="Write anything…" spellcheck="true">' + esc(d.text) + '</textarea><small class="xm" id="eS">Saved</small>' +
    '<input type="text" id="eQ" placeholder="Ask Ember about this note (optional)" autocomplete="off">' +
    '<div class="brbtns"><button class="btn" id="eAsk">Ask Ember</button><button class="btn g" id="eCopy">Copy</button><button class="btn g" id="eShare">Share</button></div>' +
    '<div class="brbtns"><button class="btn g" id="eBack">Back</button><button class="btn g" id="eDel">Delete</button></div>';
  const sched = () => { dirty = true; $('eS').textContent = 'Saving…'; clearTimeout(saveT); saveT = setTimeout(flushNote, 500); };
  $('eT').oninput = sched; $('eB').oninput = sched;
  $('eCopy').onclick = async () => toast((await copyText($('eB').value)) ? 'Copied' : 'Copy failed');
  $('eShare').onclick = () => shareText($('eT').value || 'Note', ($('eT').value ? $('eT').value + '\n\n' : '') + $('eB').value);
  $('eAsk').onclick = async () => {
    await flushNote(); const B = window.EmberBridge; if (!B) { toast('Chat not ready'); return; }
    const t = $('eB').value.trim(); if (!t) { toast('Write something first'); return; }
    const ttl = $('eT').value.trim() || 'My note';
    if (await B.askAbout({ chip: '📝 ' + ttl + ' · ' + t.length + ' chars', ctx: t.slice(0, 24000), q: $('eQ').value, title: ttl })) { sheet.classList.remove('show'); if (window.EmberBrowser) window.EmberBrowser.close(); }
  };
  $('eBack').onclick = async () => { await flushNote(); noteId = ''; paintNotes(); };
  $('eDel').onclick = async () => { if (!confirm('Delete this note?')) return; clearTimeout(saveT); dirty = false; await D().remove(noteId); noteId = ''; toast('Deleted'); paintNotes(); };
}
async function flushNote() {
  clearTimeout(saveT); if (!dirty || !noteId || !$('eB')) { dirty = false; return; }
  dirty = false; const t = $('eT').value.trim(), nm = (t || 'Untitled note').replace(/\.txt$/i, '') + '.txt';
  await D().update(noteId, { name: nm, text: $('eB').value }); const s = $('eS'); if (s) s.textContent = 'Saved';
}

// ---------- 📝 Note button under every Ember reply ----------
const msgText = el => { const d = el.querySelector(':scope > div'); return d ? (d.innerText || d.textContent || '').trim() : ''; };
function decorate() {
  log.querySelectorAll('.msg.a:not(.egg):not(.typing) .mt').forEach(mt => {
    if (mt.querySelector('[data-xn]')) return;
    const b = document.createElement('button'); b.setAttribute('data-xn', '1'); b.textContent = '📝 Note'; b.title = 'Save this reply as a note'; b.setAttribute('aria-label', 'Save this reply as a note'); mt.appendChild(b);
  });
}
let raf = 0; new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(decorate); }).observe(log, { childList: true, subtree: true });
log.addEventListener('click', async e => {
  const b = e.target.closest('[data-xn]'); if (!b) return;
  const t = msgText(b.closest('.msg')); if (!t || !D()) return;
  const r = await D().addText(t.replace(/\s+/g, ' ').slice(0, 50) + '.txt', t, 'note');
  toast(r.error ? r.error : 'Saved to Notes');
});

// ---------- Notes entry: Browser > Documents (it used to be a button in the left menu) ----------
const notesBtn = $('dcNotesOpen');
if (notesBtn) notesBtn.onclick = () => openTab('notes');
decorate();

// ---------- V1.9.84: + > Create image. The next message goes to Pollinations, never to a chat engine. ----------
// Ember answers with an HTML artifact: the picture on top, then her thought process (what she read, what she picked, how long it took).
const KW = [
  [/\b(photo|photograph|photoreal\w*|realistic|dslr|portrait photo)\b/i, 'Photo'], [/\b(anime|manga)\b/i, 'Anime'], [/\b(neon|cyberpunk|synthwave)\b/i, 'Neon'],
  [/\b(pixel art|pixel|8-bit|16-bit)\b/i, 'Pixel'], [/\b(sketch|pencil|hand drawn|line drawing)\b/i, 'Sketch']
];
const pickStyle = p => { for (const [rx, k] of KW) if (rx.test(p)) return k; return 'None'; };
const pickSize = p => /\b(portrait|vertical|tall|poster|phone wallpaper)\b/i.test(p) ? 'Portrait' : /\b(landscape|wide|banner|widescreen|horizontal|desktop wallpaper|cover)\b/i.test(p) ? 'Landscape' : 'Square';
const cleanAsk = p => String(p || '').replace(/^\s*(please\s+)?(can you\s+)?(make|create|draw|generate|imagine|paint|design)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|pic|photo|drawing|illustration)?\s*(of|showing|with|:)?\s*/i, '').replace(/^["'\s]+|["'\s]+$/g, '').trim() || String(p || '').trim();
function loadImage(url, ms) {
  return new Promise(res => {
    const im = new Image(); let done = false; const fin = v => { if (done) return; done = true; clearTimeout(tm); im.onload = im.onerror = null; res(v); };
    const tm = setTimeout(() => fin({ ok: false, why: 'timeout' }), ms || 90000);
    im.onload = () => fin({ ok: true, w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => fin({ ok: false, why: 'error' });
    im.src = url;
  });
}
function imageArtifact(d) {
  const row = (k, v) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(d.title) + '</title><style>' +
    'html,body{margin:0;background:#070708;color:#ececee;font:15px/1.55 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:16px 16px 28px}' +
    'img{display:block;width:100%;height:auto;border-radius:16px;border:1px solid #2a2a30;background:#111}h1{font-size:18px;margin:16px 0 4px}h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#7fb2ff;margin:22px 0 8px}' +
    'p{margin:0 0 8px;color:#bdbdc4}ol{margin:0;padding:0;list-style:none}li{display:flex;gap:10px;padding:9px 0;border-top:1px solid #1d1d22}li:first-child{border-top:0}li i{flex:0 0 22px;height:22px;border-radius:50%;background:#16233b;color:#7fb2ff;font:700 12px/22px system-ui;text-align:center;font-style:normal}' +
    'li span{flex:1}li small{color:#8d8d94;white-space:nowrap}table{width:100%;border-collapse:collapse}td{padding:7px 0;border-top:1px solid #1d1d22;vertical-align:top}td:first-child{color:#8d8d94;width:36%}code{display:block;white-space:pre-wrap;word-break:break-word;background:#101013;border:1px solid #26262c;border-radius:12px;padding:10px 12px;color:#ffb27a;font:13px/1.5 ui-monospace,monospace}' +
    '</style></head><body><main><img src="' + esc(d.url) + '" alt="' + esc(d.ask) + '"><h1>' + esc(d.ask.slice(0, 90)) + '</h1><p>Made with Pollinations (flux), no chat engine involved.</p>' +
    '<h2>Thought process</h2><ol>' + d.steps.map((s, i) => '<li><i>' + (i + 1) + '</i><span>' + esc(s[0]) + '</span><small>' + esc(s[1]) + '</small></li>').join('') + '</ol>' +
    '<h2>Prompt sent</h2><code>' + esc(d.full) + '</code><h2>Settings</h2><table>' + row('Service', 'image.pollinations.ai') + row('Model', 'flux') + row('Style', d.style) + row('Size', d.size + ' · ' + d.w + ' x ' + d.h) + row('Seed', String(d.seed)) + row('Made in', d.secs + ' s') + '</table></main></body></html>';
}
async function route(prompt, hk) {
  hk = hk || {};
  const step = (ic, text, key) => { try { if (hk.step) hk.step(ic, text, key); } catch (e) { /* the card is a view only */ } };
  const raw = String(prompt || '').trim().slice(0, 600), ask = cleanAsk(raw).slice(0, 400);
  if (!ask) return { ok: false, error: 'Describe the picture first.' };
  const t0 = Date.now(), steps = [], lap = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const words = (ask.match(/\S+/g) || []).length;
  step('msg', 'Reading your picture request · ' + words + ' word' + (words == 1 ? '' : 's'), 'im1'); steps.push(['Read your request (' + words + ' word' + (words == 1 ? '' : 's') + ')', lap()]);
  const style = pickStyle(raw), size = pickSize(raw), [w, h] = SIZES[size] || SIZES.Square;
  step('files', 'Style: ' + (style == 'None' ? 'as written' : style) + ' · Size: ' + size + ' (' + w + ' x ' + h + ')', 'im2'); steps.push(['Picked style ' + (style == 'None' ? 'as written' : style) + ' and size ' + size, lap()]);
  const full = ask + (STYLES[style] || ''), seed = Math.floor(Math.random() * 1e6), url = urlFor(full, w, h, seed);
  step('globe', 'Routing to Pollinations (flux). No chat engine used', 'im3'); steps.push(['Routed to Pollinations (flux), seed ' + seed, lap()]);
  step('bolt', 'Waiting for Pollinations to draw it…', 'im4');
  const r = await loadImage(url, 90000);
  if (!r.ok) { step('bolt', r.why == 'timeout' ? 'Pollinations took too long' : 'Pollinations did not answer', 'im4'); return { ok: false, error: r.why == 'timeout' ? 'Pollinations took too long (it is free and sometimes busy). Turn Create image on and send again in a moment.' : 'Pollinations did not answer. Check the connection, then turn Create image on and send again.' }; }
  step('bolt', 'Drawn in ' + lap(), 'im4'); steps.push(['Pollinations drew it', lap()]);
  steps.push(['Wrapped it as an artifact for you to open', lap()]); step('files', 'Wrapping the picture as an artifact', 'im5');
  const title = ('Image - ' + ask.replace(/[^\w\s-]/g, '').trim().slice(0, 38).trim().replace(/\s+/g, ' ') + '.html').replace(/"/g, '');
  const html = imageArtifact({ title, ask, full, style: style == 'None' ? 'As written' : style, size, w, h, seed, url, steps, secs: ((Date.now() - t0) / 1000).toFixed(1) });
  const hist = lsGet(HK, []); hist.unshift({ p: ask, seed, s: size, ts: Date.now() }); hist.length = Math.min(hist.length, 30); lsSet(HK, hist);
  const intro = 'Done. Open the artifact for the picture and how I made it. Say what to change and I will draw another.';
  return { ok: true, url, text: intro + '\n<artifact type="html" title="' + title + '">\n' + html + '\n</artifact>' };
}

window.EmberCreate = { open: openTab, route };
})();
