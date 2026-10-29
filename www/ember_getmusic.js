// Ember V1.9.22 - ember_getmusic.js: Music > Get tab. Search YouTube / SoundCloud, paste a link or playlist, save the audio to Music/Ember
// through the native EmberYoutube plugin (NewPipe extractor). Works without the AI add-on switch: these are buttons you press yourself.
'use strict';
(() => {
const $ = id => document.getElementById(id);
if (!$('mp_get')) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3200); };
const fmt = s => { s = Math.max(0, Math.round(+s || 0)); return s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; };
function yt() {
  if (window.EmberDownloads) return EmberDownloads.available() ? EmberDownloads : undefined;
  const cap = window.Capacitor; if (!cap) return undefined;
  const P = cap.Plugins || {}; if (P.EmberYoutube) return P.EmberYoutube;
  try { if (cap.isNativePlatform && cap.isNativePlatform() && cap.isPluginAvailable && cap.isPluginAvailable('EmberYoutube') && cap.registerPlugin) return cap.registerPlugin('EmberYoutube'); } catch (e) { /* not in this build */ }
  return undefined;
}
const NEED = 'Choose NewPipe in the APK, or configure the local yt-dlp bridge in AI Features for browser and Android downloads.';
const LINK = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be|soundcloud\.com)\/\S+$/i;
// V1.9.27: what we know about each track we queued (YouTube thumbnail, artist, album), keyed by a plain form of its title. The library uses it as a
// cover when no tag or online lookup has one. Mirrors DownloadWorker.splitTitle so the cleaned title the phone saves still matches.
const MK = 'ember_dlmeta';
const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function cleanTitle(raw) {
  let t = String(raw || '').replace(/\s*[(\[][^)\]]*(official|audio|video|lyric|visuali[sz]er|hd|4k|explicit|music video)[^)\]]*[)\]]/ig, '').trim() || String(raw || '').trim();
  const i = t.indexOf(' - '); return i > 0 && i < t.length - 3 ? { artist: t.slice(0, i).trim(), title: t.slice(i + 3).trim() } : { artist: '', title: t };
}
const dlLoad = () => { try { const o = JSON.parse(localStorage.getItem(MK) || '{}'); return (o && typeof o == 'object') ? o : {}; } catch (e) { return {}; } };
function dlSave(title, m) {
  if (!title) return; const o = dlLoad(), c = cleanTitle(title);
  const rec = { thumb: String(m.thumb || '').slice(0, 400), artist: String(m.artist || c.artist || '').slice(0, 120), album: String(m.album || '').slice(0, 160), at: Date.now() };
  [norm(title), norm(c.title), norm(c.artist + c.title)].forEach(k => { if (k) o[k] = rec; });
  const ks = Object.keys(o); if (ks.length > 600) ks.sort((a, b) => (o[a].at || 0) - (o[b].at || 0)).slice(0, ks.length - 600).forEach(k => delete o[k]);
  try { localStorage.setItem(MK, JSON.stringify(o)); } catch (e) { /* storage blocked: covers just fall back to the online lookup */ }
}
window.EmberDlMeta = { cleanTitle, save: dlSave, find: t => { if (!t) return null; const o = dlLoad(); return o[norm((t.artist || '') + (t.title || ''))] || o[norm(t.title)] || null; } };
let list = []; // what the results area shows right now: [{ title, url, sub, thumb }]
const jobs = new Map(); // jobId -> latest detail from the 'ember-dl' event

// ── Download step definitions (V1.9.28) ───────────────────────────────────────
// Maps the native plugin's 0-100 pct value onto 5 visible steps so the user can
// see exactly where their download is at any moment.
const DL_STEPS = [
  { id: 'meta',   ico: '🔍', lbl: 'Fetching metadata',    from: 0,  to: 10 },
  { id: 'stream', ico: '🔗', lbl: 'Resolving stream',     from: 10, to: 20 },
  { id: 'dl',     ico: '⬇',  lbl: 'Downloading audio',   from: 20, to: 85 },
  { id: 'proc',   ico: '⚙',  lbl: 'Processing audio',    from: 85, to: 97 },
  { id: 'save',   ico: '💾', lbl: 'Saving to Music/Ember', from: 97, to: 100 }
];

// Returns 'done' | 'active' | 'pend' | 'err' for a given step + current state
function stepSt(step, pct, state) {
  if (state === 'done')   return 'done';
  if (state === 'failed') return pct >= step.from ? 'err' : 'pend';
  if (pct >= step.to)     return 'done';
  if (pct >= step.from)   return 'active';
  return 'pend';
}

const msg = (h) => { $('gtRes').innerHTML = h ? '<p class="hint">' + h + '</p>' : ''; };
let head = '';
function paintList() {
  $('gtRes').innerHTML = (list.length && head ? '<p class="hint">' + esc(head) + '</p>' : '') +
    (list.length ? list.map((x, i) =>
      '<div class="trk">' +
      (/^https:\/\//i.test(x.thumb || '') ? '<img class="gtth" loading="lazy" alt="" src="' + esc(x.thumb) + '">' : '') +
      '<button tabindex="-1">' + esc(x.title) + '<small>' + esc(x.sub) + '</small></button>' +
      '<button class="gtd" data-i="' + i + '" aria-label="Download ' + esc(x.title) + '">⬇</button>' +
      '</div>').join('') : '');
}

function paintJobs() {
  const a = [...jobs.values()].slice(-8).reverse();
  if (!a.length) { $('gtJobs').innerHTML = '<p class="hint">Nothing downloading.</p>'; return; }
  $('gtJobs').innerHTML = a.map(j => {
    const done = j.state === 'done', failed = j.state === 'failed';
    const pct = done ? 100 : Math.max(0, Math.min(100, +j.pct || 0));
    const cur = DL_STEPS.findIndex(st => pct < st.to);
    const idx = done ? DL_STEPS.length : (cur < 0 ? DL_STEPS.length - 1 : cur);
    const chip = done ? 'Saved' : failed ? 'Failed' : pct > 0 ? pct + '%' : 'Starting';
    const meta = done ? (j.engine==='yt-dlp'?'Saved on local bridge · AI Features → Save to this device':j.mode==='video'?'Saved to Movies/Ember':'Saved to Music/Ember') : failed ? 'Stopped at step ' + (idx + 1) + ' of ' + DL_STEPS.length + ': ' + DL_STEPS[idx].lbl : 'Step ' + (idx + 1) + ' of ' + DL_STEPS.length + ': ' + DL_STEPS[idx].lbl;
    const seg = DL_STEPS.map((st, si) => '<i class="dj-s dj-s-' + stepSt(st, pct, j.state) + '"></i>').join('');
    const list = DL_STEPS.map(st => { const ss = stepSt(st, pct, j.state); return '<li class="dj-l dj-l-' + ss + '"><span class="dj-li">' + (ss === 'done' ? '✓' : ss === 'err' ? '✗' : ss === 'active' ? st.ico : '○') + '</span><span>' + esc(st.lbl) + '</span></li>'; }).join('');
    const eng = j.engine ? '<span class="dj-eng">' + esc(j.engine) + '</span>' : '';
    const err = failed && j.detail ? '<div class="dj-err">' + esc(String(j.detail).slice(0, 160)) + '</div>' : '';
    return '<div class="dj dj-' + esc(j.state) + '"><div class="dj-head"><div class="dj-title">' + esc(j.title || 'Fetching track info') + '</div><span class="dj-chip">' + chip + '</span></div>'
      + '<div class="dj-meta">' + eng + '<span>' + esc(meta) + '</span></div>' + err
      + '<div class="dj-seg">' + seg + '</div>'
      + (!done && !failed ? '<div class="dj-bar"><i style="width:' + pct + '%"></i></div>' : '')
      + (done && j.engine!=='yt-dlp' && j.mode!=='video' ? '<button type="button" class="dj-play" data-dl-play="' + esc(j.id) + '" data-title="' + esc(j.title || '') + '">▶ Play</button>' : '')
      + '<details class="dj-more"><summary>All steps</summary><ul>' + list + '</ul></details></div>';
  }).join('');
}
async function perm() { try { if (window.EmberNative && window.EmberNative.ensureNotifyPermission) await window.EmberNative.ensureNotifyPermission(); } catch (e) { /* notifications are optional */ } }
function track(id, title) {
  if (!id) return;
  jobs.set(id, { id, title: title || '', state: 'running', pct: 0, detail: '' }); paintJobs();
  if (window.EmberAgentAddon && window.EmberAgentAddon.trackJob) window.EmberAgentAddon.trackJob(id, title || '', true);
}
async function one(url, title, meta) {
  const P = yt(); if (!P) { toast(NEED); return false; }
  if (!LINK.test(url)) { toast('That is not a YouTube or SoundCloud link'); return false; }
  await perm();
  try { const m = meta || {}; const r = await P.downloadVideo({ url, mode:window.EmberDownloads ? EmberDownloads.cfg().mode : 'audio', title: title || '', artist: m.artist || '', thumb: m.thumb || '' }); if (r && r.jobId) { track(r.jobId, title); dlSave(title, m); toast('Download started'); return true; } toast('The downloader did not start a job'); }
  catch (e) { toast('Could not start: ' + String((e && e.message) || e).slice(0, 120)); }
  return false;
}
async function search(sc) {
  const q = $('gtQ').value.trim(); if (!q) { toast('Type a song or artist first'); return; }
  const P = yt(); if (!P) { list = []; paintList(); msg(NEED); return; }
  head = ''; list = []; paintList(); msg('Searching…');
  try {
    const r = await P.search({ query: q, limit: 10, service: sc ? 'soundcloud' : 'youtube' });
    list = ((r && r.results) || []).map(x => ({ title: x.title || '(no title)', url: x.url, artist: x.channel || '', thumb: x.thumb || '', sub: [x.channel, fmt(x.durationSec)].filter(Boolean).join(' · ') }));
    if (list.length) paintList(); else msg('Nothing found.');
  } catch (e) { msg('Search failed: ' + esc(String((e && e.message) || e).slice(0, 140))); }
}
$('gtYt').onclick = () => search(false);
if ($('gtSc')) $('gtSc').onclick = () => search(true);
$('gtQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(false); } });
$('gtRes').addEventListener('click', async e => {
  const b = e.target.closest('.gtd'); if (!b) return;
  const x = list[+b.dataset.i]; if (!x) return;
  b.disabled = true; const ok = await one(x.url, x.title, x); b.textContent = ok ? '✓' : '⬇'; b.disabled = ok;
});
$('gtOne').onclick = async () => { const u = $('gtUrl').value.trim(); if (!u) { toast('Paste a link first'); return; } if (await one(u, '')) $('gtUrl').value = ''; };
$('gtList').onclick = async () => {
  const u = $('gtUrl').value.trim(), P = yt(); if (!u) { toast('Paste a playlist link first'); return; }
  if (!P) { msg(NEED); return; } if (!LINK.test(u)) { toast('That is not a YouTube or SoundCloud link'); return; }
  list = []; paintList(); msg('Reading the playlist…');
  try {
    const r = await P.playlist({ url: u, limit: 100 });
    list = ((r && r.tracks) || []).map(x => ({ title: x.title || '(no title)', url: x.url, artist: x.artist || '', thumb: x.thumb || '', sub: [x.artist, fmt(x.durationSec)].filter(Boolean).join(' · ') }));
    head = (r.title || 'Playlist') + ' · ' + list.length + ' track' + (list.length == 1 ? '' : 's'); if (list.length) paintList(); else msg('That playlist is empty.');
  } catch (e) { msg('Could not read it: ' + esc(String((e && e.message) || e).slice(0, 140))); }
};
$('gtAll').onclick = async () => {
  const u = $('gtUrl').value.trim(), P = yt(); if (!u) { toast('Paste a playlist link first'); return; }
  if (!P) { toast(NEED); return; } if (!LINK.test(u)) { toast('That is not a YouTube or SoundCloud link'); return; }
  if (!window.confirm('Download this whole playlist (up to 100 tracks, one after another)? Each track is saved with its title, artist and the playlist name as the album.')) return;
  await perm();
  try { const r = await P.downloadPlaylist({ url: u, limit: 100, mode:window.EmberDownloads ? EmberDownloads.cfg().mode : 'audio' }); ((r && r.jobs) || []).forEach(j => { track(j.jobId, j.title); dlSave(j.title, { thumb: j.thumb, artist: j.artist, album: r.title }); }); toast(((r && r.jobs) || []).length + ' downloads queued'); $('gtUrl').value = ''; }
  catch (e) { toast('Could not queue: ' + String((e && e.message) || e).slice(0, 120)); }
};
let scanT = null;
window.addEventListener('ember-dl', e => {
  const j = e.detail || {}; if (!j.id) return;
  jobs.set(j.id, { id: j.id, title: j.title, state: j.state, pct: j.pct, detail: j.detail, mode:j.mode, engine: j.engine || (jobs.get(j.id) || {}).engine || '' }); paintJobs();
});
window.addEventListener('ember-dl-final', e => {
  const d = e.detail || {}; if (d.state !== 'done') { if (d.state === 'failed') toast('A download failed'); return; }
  toast('Saved: ' + (d.title || 'track'));
  clearTimeout(scanT);
  scanT = setTimeout(() => { const P = window.EmberPlayer; if (P && P.deviceOk && P.deviceOk() && P.scanDevice) P.scanDevice().catch(() => { /* the library button still works */ }); }, 2500);
});
if (!yt()) $('gtNote').textContent = NEED;
})();
