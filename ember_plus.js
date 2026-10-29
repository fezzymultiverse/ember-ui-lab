// Ember V1.9.84 - ember_plus.js: the "+" button on the left of the message box and its menu.
// V1.9.84: Create image (one-shot, routes the next message to Pollinations and answers with an artifact), a Think group (Reasoning, Go deeper, Learn, Spark),
// Paste, Copy and Device tools are gone from the menu (Device tools now live in Settings), Modes is its own pill by the box.
// Toggles (Device Access, Web Search, Reasoning, Code Mode) stay on and show a removable chip above the box.
// Fire-once items (Upload File, Camera / Vision, Audio Context) run straight away and put their result in the message box as a block he can edit before sending.
'use strict';
(() => {
const $ = id => document.getElementById(id);
if (!$('bPlus')) return;
const KEY = 'ember_plus';
const TOGGLES = [
  { id: 'image', icon: '🎨', label: 'Create image', hint: 'Next message becomes a picture: Pollinations, Forge, then Stability if you saved a key', chip: 'Create image', once: true },
  { id: 'audio_gen', icon: '🎵', label: 'Create audio', hint: 'Next message becomes music or sound, made by Stability AI', chip: 'Create audio', once: true },
  { id: 'video_gen', icon: '🎬', label: 'Create video', hint: 'Next message becomes a video: Stability images + music, composed on this phone', chip: 'Create video', once: true },
  { id: 'stab', icon: '⚡', label: 'Stability bridge', hint: 'ON: just ask in chat for an image, audio or video and Ember makes it with Stability / Puter. OFF: only the Create buttons do', chip: 'Stability bridge' },
  { id: 'pdf', icon: '📄', label: 'Create PDF', hint: 'Next message becomes a full PDF artifact (Save PDF builds the file)', chip: 'Create PDF', once: true },
  { id: 'device', icon: '📱', label: 'Device Access', hint: 'Let Ember read local files & Termux', chip: 'Device Access' },
  { id: 'web', icon: '🌐', label: 'Web Search', hint: 'Force live scraping/DuckDuckGo', chip: 'Web Search' },
  { id: 'reason', icon: '🧠', label: 'Reasoning', hint: 'Use chain-of-thought / slower model', chip: 'Reasoning' },
  { id: 'code', icon: '📝', label: 'Code Mode', hint: 'Format output for programming', chip: 'Code Mode' }
];
const ONCE = [
  { id: 'upload', icon: '📎', label: 'Upload File', hint: 'Attach an image, text, or audio file' },
  { id: 'camera', icon: '📸', label: 'Camera / Vision', hint: 'Snap a photo to analyze or extract text' },
  { id: 'audio', icon: '🎵', label: 'Audio Context', hint: 'Listen to surrounding audio or identify a song' }
];
const LINES = {
  image: '',
  audio_gen: '', video_gen: '',
  stab: 'STABILITY BRIDGE is ON: when he asks for an image, music/sound/audio, or a video, call media_generate (kind image|audio|video, prompt). It really makes the file with Stability AI (image, audio; video is several Stability images plus audio composed on the phone) and saves it; tell him where to find it (Settings > Command Centre > Media). If it fails, say the exact error. Do not claim anything was made unless the tool said ok.',
  pdf: 'PDF MODE is ON for this message: write the whole answer as ONE complete document inside <artifact type="pdf" title="Short-Title.pdf"> ... </artifact> in Markdown: a title, a short summary, numbered sections with real detail, tables where they help, and a closing list of next steps. No filler, no truncation. Before the artifact write one short sentence only.',
  device: 'DEVICE ACCESS is ON for this chat: he allowed you to use his saved Documents tools (list, search, read) and the Termux panel when it helps. Use them instead of saying you cannot reach his files. You still cannot see anything outside those tools.',
  web: 'WEB SEARCH is FORCED ON for this chat: before answering anything that could be current or factual, call web_search (or search_and_read) first, then answer from the results and name the source. If the search fails, say so; do not answer from memory as if it had worked.',
  reason: 'REASONING is ON for this chat: work the problem step by step, check your own answer once before you give it, and say plainly where you are unsure.',
  code: 'CODE MODE is ON for this chat: answer in working code first, in fenced blocks with the language named, complete and runnable (no stubs), then at most a few lines of explanation. Bash for Termux unless he says otherwise.'
};
let on = {}; try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); TOGGLES.forEach(t => { if (r[t.id] && !t.once) on[t.id] = true; }); } catch (e) { on = {}; }
const save = () => { try { const o = {}; TOGGLES.forEach(t => { if (on[t.id] && !t.once) o[t.id] = true; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage blocked */ } };
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getSet = () => { try { return JSON.parse(localStorage.getItem('ember_set') || '{}') || {}; } catch (e) { return {}; } };

// ---------- menu + chips ----------
const menu = $('plusMenu'), chips = $('plusChips'), btn = $('bPlus');
// Think group, in this order. These click the buttons that already exist (hidden under the box), so nothing about how they work changes.
const THINK = [
  { id: 'bReact', icon: '🧠', label: 'Reasoning', hint: 'Open a step-by-step run you can steer' },
  { id: 'bDeep', icon: '💡', label: 'Go deeper', hint: 'Expand on the last reply' },
  { id: 'bLearn', icon: '📚', label: 'Learn', hint: 'Teach Ember from links and saved documents' },
  { id: 'bSpark', icon: '✨', label: 'Spark', hint: 'Ember starts something, no topic needed' }
];
const QUICK = [
  { id: 'bGraph', icon: '🕸', label: 'Knowledge Graph', hint: 'Map local documents, memory and chats' },
  { id: 'bPriv', icon: '🔓', label: 'Normal mode', hint: 'Toggle normal privacy mode' },
  { id: 'bApis', icon: '🔌', label: 'Free APIs', hint: 'IP, grammar, photos, whois, words, lyrics' }
];
const tRow = t => '<button class="pm-i" data-t="' + t.id + '" role="menuitemcheckbox" aria-checked="false"><span class="pm-ic">' + t.icon + '</span><span class="pm-tx"><b>' + t.label + '</b><small>' + t.hint + '</small></span><span class="pm-sw"></span></button>';
const aRow = t => '<button class="pm-i" data-action="' + t.id + '" role="menuitem"><span class="pm-ic">' + t.icon + '</span><span class="pm-tx"><b>' + t.label + '</b><small>' + t.hint + '</small></span></button>';
const CREATE = ['image', 'audio_gen', 'video_gen', 'pdf', 'stab'];
const PLUG = (id, icon, label, sumId, hint) => '<button class="pm-i pm-plug" data-plug="' + id + '" role="menuitem"><span class="pm-ic">' + icon + '</span><span class="pm-tx"><b>' + label + '</b><small id="' + sumId + '">' + hint + '</small></span><span class="pm-go">›</span></button>';
menu.innerHTML = '<div class="pm-h">Plugins</div>' +
  PLUG('web', '🌐', 'Web &amp; Scraping', 'pmWebSum', 'Scrapers, search and the free reader') +
  PLUG('media', '🎛', 'Media &amp; Music', 'pmMediaSum', 'Create image, audio, video, PDF · song ID') +
  '<div class="pm-h pm-action">Think</div>' + THINK.map(aRow).join('') +
  '<div class="pm-h pm-action">Enable for this chat</div>' + TOGGLES.filter(t => !CREATE.includes(t.id) && t.id != 'web').map(tRow).join('') +
  '<div class="pm-h pm-action">Attach or capture</div>' +
  ONCE.map(t => '<button class="pm-i" data-o="' + t.id + '" role="menuitem"><span class="pm-ic">' + t.icon + '</span><span class="pm-tx"><b>' + t.label + '</b><small>' + t.hint + '</small></span></button>').join('') +
  '<div class="pm-h pm-action">Chat tools</div>' + QUICK.map(aRow).join('');
function paint() {
  menu.querySelectorAll('[data-t]').forEach(b => { const v = !!on[b.dataset.t]; b.classList.toggle('on', v); b.setAttribute('aria-checked', v ? 'true' : 'false'); });
  const act = TOGGLES.filter(t => on[t.id]);
  chips.classList.toggle('hidden', !act.length);
  chips.innerHTML = act.map(t => '<span class="pchip">' + t.icon + ' ' + esc(t.chip) + ' <button data-x="' + t.id + '" aria-label="Turn off ' + esc(t.chip) + '">×</button></span>').join('');
  btn.classList.toggle('has', act.length > 0);
  try { window.dispatchEvent(new CustomEvent('ember-plus-change')); } catch (e) { /* listeners optional */ }
}
function setMenu(v) { menu.classList.toggle('hidden', !v); btn.classList.toggle('open', v); btn.setAttribute('aria-expanded', v ? 'true' : 'false'); }
const isOpen = () => !menu.classList.contains('hidden');
btn.onclick = e => { e.stopPropagation(); setMenu(!isOpen()); };
document.addEventListener('click', e => { if (isOpen() && !menu.contains(e.target) && e.target !== btn) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) setMenu(false); });
window.addEventListener('popstate', () => { if (isOpen()) setMenu(false); });
chips.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; on[x.dataset.x] = false; save(); paint(); });
menu.addEventListener('click', e => {
  const action = e.target.closest('[data-action]');
  const t = e.target.closest('[data-t]'), o = e.target.closest('[data-o]');
  const plug = e.target.closest('[data-plug]');
  if (plug) { setMenu(false); if (window.EmberPlugins) window.EmberPlugins.open(plug.dataset.plug); else toast('Plugins did not load.'); return; }
  if (action) {
    setMenu(false);
    const target = $(action.dataset.action);
    if (target) target.click();
    else toast('This tool is not available on this screen.');
    return;
  }
  if (t) { const id = t.dataset.t, def = TOGGLES.find(x => x.id == id); if (flip(id) && def.once) setMenu(false); return; } // toggles keep the menu open so several can be switched at once
  if (o) { setMenu(false); fire(o.dataset.o); }
});

// V1.10.12: one toggle path for the + menu AND the Plugins sheet (one-shot exclusivity, Stability enable, toasts).
function flip(id, v) {
  const def = TOGGLES.find(x => x.id == id); if (!def) return false;
  on[id] = v == null ? !on[id] : !!v;
  if (def.once && on[id]) TOGGLES.forEach(x => { if (x.once && x.id != id) on[x.id] = false; });
  save(); paint();
  if (def.once) { toast(on[id] ? def.icon + ' Describe it and send' : def.label + ' off'); if (on[id]) { const i = $('inp'); if (i) { try { i.focus(); } catch (e) { /* no focus */ } } } return on[id]; }
  if (id == 'stab') { if (on[id] && window.EmberMediaPlus) window.EmberMediaPlus.enable(); toast(on[id] ? '⚡ Stability bridge on: ask for images, audio or video in chat' : 'Stability bridge off'); return on[id]; }
  toast((on[id] ? '✔ ' : '✖ ') + def.label + (on[id] ? ' on' : ' off')); return on[id];
}

// ---------- put a result into the message box ----------
function addToBox(block) {
  const i = $('inp'); if (!i) return;
  i.value = (i.value ? i.value.replace(/\s+$/, '') + '\n\n' : '') + block + '\n';
  i.dispatchEvent(new Event('input', { bubbles: true })); i.style.height = 'auto'; i.style.height = Math.min(140, i.scrollHeight) + 'px'; i.focus();
}
function pick(accept, capture) {
  return new Promise(res => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = accept; if (capture) f.setAttribute('capture', capture);
    f.style.display = 'none'; document.body.appendChild(f); let done = false;
    const fin = v => { if (done) return; done = true; try { f.remove(); } catch (e) { /* gone */ } res(v); };
    f.onchange = () => fin(f.files && f.files[0] || null);
    f.addEventListener('cancel', () => fin(null));
    f.click();
  });
}
const readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsText(file); });
// Shrink a photo to a JPEG under ~1.2 MB so it fits the image reader's limit and the phone's memory.
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('That image could not be opened.')); im.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.68, 0.5]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 1500000) return d; }
    throw new Error('That photo is too large even after shrinking.');
  } finally { URL.revokeObjectURL(url); }
}
async function describe(dataUrl, ask) {
  const set = getSet(), AG = window.EmberAgentAddon;
  if (!set.visionAddon) return { error: 'Vision is off. Turn on "Vision" in Settings first: the photo is sent to Pollinations\' free image reader, so it is your call.' };
  if (!AG || !AG.dispatch) return { error: 'The image reader did not load.' };
  return AG.dispatch('see_image', { image_url: dataUrl, prompt: ask });
}
async function doImage(file) {
  toast('Reading the image…');
  let d; try { d = await shrink(file); } catch (e) { return toast(e.message); }
  const r = await describe(d, 'Describe this image. If it contains text, copy that text out exactly, line by line.');
  if (r && r.description) { addToBox('[Image: ' + (file.name || 'photo') + ' - what the image reader saw]\n' + r.description); toast('Image added'); }
  else toast((r && r.error) || 'The image could not be read.');
}
async function doText(file) {
  let t; try { t = await readText(file); } catch (e) { return toast(e.message); }
  if (/[\u0000]/.test(t.slice(0, 4000))) return toast('That looks like a binary file, not text.');
  const cut = t.length > 20000; addToBox('[File: ' + file.name + (cut ? ' - first 20,000 characters' : '') + ']\n' + t.slice(0, 20000)); toast('File added');
}
function songBlock(r) {
  if (!r || r.ok === false) return null;
  if (!r.found) return '[Song identification: no match found]';
  return '[Song identified: ' + r.title + (r.artist ? ' - ' + r.artist : '') + (r.album ? ' (' + r.album + ')' : '') + (r.year ? ' ' + r.year : '') + ']';
}
async function doAudioFile(file) {
  const A = window.EmberAudd; if (!A || !A.hasKey()) return toast('Song ID needs your Audd.io token: Settings > Music.');
  toast('Identifying the song…');
  const r = await A.identifyBlob(file);
  const b = songBlock(r); if (b) { addToBox(b); toast('Done'); } else toast((r && r.error) || 'Could not identify it.');
}
// Listen through the mic for 10 seconds, then identify.
let listening = false;
async function listen() {
  const A = window.EmberAudd; if (!A || !A.hasKey()) return toast('Song ID needs your Audd.io token: Settings > Music.');
  if (listening) return toast('Already listening.');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') return toast('This phone cannot record audio here.');
  let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch (e) { return toast('Microphone permission was refused.'); }
  listening = true; btn.classList.add('rec'); toast('Listening for 10 seconds…');
  const parts = [], rec = new MediaRecorder(st);
  rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  rec.onstop = async () => {
    st.getTracks().forEach(t => t.stop()); listening = false; btn.classList.remove('rec');
    const blob = new Blob(parts, { type: rec.mimeType || 'audio/webm' }); if (!blob.size) return toast('Nothing was recorded.');
    toast('Identifying…'); const r = await A.identifyBlob(blob); const b = songBlock(r);
    if (b) { addToBox(b); toast('Done'); } else toast((r && r.error) || 'Could not identify it.');
  };
  rec.start(); setTimeout(() => { try { if (rec.state != 'inactive') rec.stop(); } catch (e) { /* stopped */ } }, 10000);
}
async function fire(id) {
  try {
    if (id == 'upload') { const f = await pick('image/*,audio/*,text/*,.txt,.md,.json,.csv,.log,.sh,.py,.js,.html,.css,.xml,.yml,.yaml,.ini,.conf'); if (!f) return;
      if (/^image\//.test(f.type)) return doImage(f); if (/^audio\//.test(f.type)) return doAudioFile(f); return doText(f); }
    if (id == 'camera') { const f = await pick('image/*', 'environment'); if (f) return doImage(f); return; }
    if (id == 'audio') return listen();
  } catch (e) { toast((e && e.message) || 'That did not work.'); }
}

// ---------- what app.js reads each turn ----------
window.EmberPlus = {
  isOn: id => !!on[id],
  lane: () => !!on.reason,
  stateLine: () => [TOGGLES.filter(t => on[t.id] && LINES[t.id]).map(t => LINES[t.id]).join(' '), window.EmberPlugins ? window.EmberPlugins.abilities() : ''].filter(Boolean).join(' '),
  consume: id => { if (!on[id]) return false; on[id] = false; save(); paint(); return true; },
  flip, _fire: fire, _set: (id, v) => { on[id] = !!v; save(); paint(); }
};
paint();
})();
