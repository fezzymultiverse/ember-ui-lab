// Ember V1.7.0 - ember_music_ui.js: the Music panel, the now-playing widget above the message box, and the song-identification settings card.
// Loaded last. Talks only to EmberPlayer / EmberAudd / EmberMusicAddon. The chat code (app.js) is not involved.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const P = window.EmberPlayer, AU = window.EmberAudd;
if (!P || !AU || !$('music')) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3000); };
const fmt = s => { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const aiOn = () => { try { return !!JSON.parse(localStorage.getItem('ember_set') || '{}').musicAddon; } catch (e) { return false; } };
const panelOpen = () => $('music').classList.contains('show');

let np = { source: 'none', playing: false, track: null }, npAt = Date.now(), dragging = false, busy = false, idFor = null;

// ---------- now playing: panel card + widget ----------
function posNow() {
  const t = np.track; if (!t) return 0;
  let p = (np.positionSec || 0) + (np.playing ? (Date.now() - npAt) / 1000 : 0);
  if (t.durationSec) p = Math.min(p, t.durationSec); return Math.max(0, p);
}
function paintPos() {
  const t = np.track, dur = t ? (t.durationSec || 0) : 0, p = posNow();
  $('npPos').textContent = fmt(p); $('npDur').textContent = dur ? fmt(dur) : '';
  if (!dragging) { $('npSeek').max = String(dur || 1); $('npSeek').value = String(p); }
  $('npSeek').style.setProperty('--pct', (dur ? Math.min(100, p / dur * 100) : 0) + '%');
  $('npSeek').disabled = !t || !dur;
}
function paint() {
  const t = np.track, playing = !!np.playing;
  $('npTitle').textContent = t ? t.title : 'Nothing playing';
  $('npSub').textContent = t ? [t.artist, t.album].filter(Boolean).join(' · ') : (P.count() ? 'Pick a song from your library.' : 'Upload music or scan the phone.');
  $('npSrc').textContent = !t ? '' : 'Ember player';
  $('npPlay').textContent = playing ? '⏸' : '▶';
  $('npErr').textContent = np.error || '';
  if (np.volume != null && document.activeElement !== $('npVol')) $('npVol').value = String(np.volume);
  $('npShuf').classList.toggle('on', !!np.shuffle); $('npRep').classList.toggle('on', !!np.repeat);
  paintPos();
  $('mw').classList.toggle('hidden', !t);
  $('mwTitle').innerHTML = (playing ? '<span class="live"></span>' : '') + esc(t ? t.title : '');
  $('mwSub').textContent = t ? [t.artist].filter(Boolean).join(' · ') : '';
  $('mwPlay').textContent = playing ? '⏸' : '▶';
  $('npCard').classList.toggle('playing', playing && !!t); $('mw').classList.toggle('playing', playing && !!t);
  paintMeta();
  if (window.EmberLyrics) window.EmberLyrics.paint(np, posNow());
  document.querySelectorAll('#mList .trk').forEach(r => r.classList.toggle('on', !!(t && np.source === 'local' && r.dataset.id === t.id)));
}
// ---------- artwork + About (V1.6.5) ----------
let metaKey = '';
function setArt(u) {
  const ok = !!u;
  [['npArt', 'npArtPh'], ['mwArt', null]].forEach(([i, ph]) => {
    const im = $(i); if (!im) return;
    if (!ok) { im.classList.add('hidden'); im.removeAttribute('src'); if (ph) $(ph).classList.remove('hidden'); return; }
    if (im.getAttribute('src') !== u) im.src = u;
    im.onload = () => { im.classList.remove('hidden'); if (ph) $(ph).classList.add('hidden'); };
    im.onerror = () => { im.classList.add('hidden'); if (ph) $(ph).classList.remove('hidden'); };
  });
}
function renderAbout(m) {
  const box = $('npAbout'), body = $('npAboutBody'), chips = $('npChips');
  if (!m) { box.classList.add('hidden'); chips.innerHTML = ''; return; }
  if (m === 'loading') { box.classList.remove('hidden'); body.innerHTML = '<p class="hint">Looking up artist and song info…</p>'; return; }
  const c = [['Artist', m.artist], ['Album', m.album], ['Year', m.year], ['Genre', m.genre]].filter(x => x[1]);
  chips.innerHTML = c.map(x => '<span class="chip2 c' + x[0] + '"><i>' + x[0] + '</i>' + esc(x[1]) + '</span>').join('');
  const parts = [];
  if (m.aboutSong) parts.push('<h4>The song</h4><p>' + esc(m.aboutSong) + '</p>');
  if (m.aboutAlbum) parts.push('<h4>' + esc(m.album || 'The album') + '</h4><p>' + esc(m.aboutAlbum) + '</p>');
  if (m.aboutArtist) parts.push('<h4>' + esc(m.artist || 'The artist') + '</h4><p>' + esc(m.aboutArtist) + '</p>');
  if (!parts.length) parts.push('<p class="hint">No bio found' + (navigator.onLine === false ? ' (you are offline)' : ' for this one') + '. Artwork and details come from the file tags, Deezer and MusicBrainz when they have it. The Identify button can name a song that has no tags.</p>');
  box.classList.remove('hidden'); body.innerHTML = parts.join('') + (m.sources && m.sources.length ? '<small class="asrc">Source: ' + esc(m.sources.join(' + ')) + '</small>' : '');
  body.scrollTop = 0;
}
function paintMeta() {
  const t = np.track, k = t ? np.source + '|' + t.id + '|' + t.title + '|' + t.artist : '';
  if (k === metaKey) return; metaKey = k;
  if (!t) { setArt(''); renderAbout(null); return; }
  const peek = P.metaPeek(t, np.source); setArt((peek && peek.art) || t.art || ''); if (peek) { renderAbout(peek); return; } renderAbout('loading');
  P.meta(t, np.source).then(m => { if (metaKey !== k || !m) return; setArt(m.art || t.art || ''); renderAbout(m); }).catch(() => { if (metaKey === k) renderAbout({}); });
}
// ---------- Deezer discovery (keyless) + metadata preview ----------
let dzResults = [], dzPreview = null;
function renderDzResults() {
  const box = $('dzRes'); if (!box) return;
  box.innerHTML = dzResults.length ? dzResults.map((x, i) => '<button class="dzr" data-i="' + i + '">' + (x.art ? '<img src="' + esc(x.art) + '" alt="">' : '<span class="dzr-ph">♪</span>') + '<span><b>' + esc(x.title) + '</b><small>' + esc([x.artist, x.album].filter(Boolean).join(' · ')) + '</small></span><em>' + fmt(x.durationSec) + '</em></button>').join('') : '<p class="hint">Search for a track or artist to begin.</p>';
}
function renderDzPreview(m, x) {
  const card = $('dzPreview'); if (!card) return;
  if (!m || !x) { card.classList.add('hidden'); return; }
  $('dzPreviewArt').src = m.art || x.art || ''; $('dzPreviewTitle').textContent = m.title || x.title;
  $('dzPreviewSub').textContent = [m.artist || x.artist, m.album || x.album].filter(Boolean).join(' · ');
  const bits = [['Artist', m.artist || x.artist], ['Album', m.album || x.album], ['Year', m.year], ['Genre', m.genre]].filter(v => v[1]);
  $('dzPreviewAbout').innerHTML = bits.map(v => '<span class="chip2"><i>' + esc(v[0]) + '</i>' + esc(v[1]) + '</span>').join('') + [m.aboutArtist && '<h4>' + esc(m.artist || x.artist) + '</h4><p>' + esc(m.aboutArtist) + '</p>', m.aboutAlbum && '<h4>' + esc(m.album || x.album) + '</h4><p>' + esc(m.aboutAlbum) + '</p>', m.aboutSong && '<p>' + esc(m.aboutSong) + '</p>'].filter(Boolean).join('') || '<p class="hint">Deezer found the track. MusicBrainz background details are not available yet.</p>';
  card.classList.remove('hidden');
}
async function selectDz(x) {
  dzPreview = x; renderDzPreview({ title: x.title, artist: x.artist, album: x.album, art: x.art }, x);
  $('dzPreviewAbout').insertAdjacentHTML('beforeend', '<p class="hint">Loading MusicBrainz artist and release context…</p>');
  try { const m = await P.meta({ id: 'deezer-' + x.id, title: x.title, artist: x.artist, album: x.album, art: x.art }, 'deezer'); if (dzPreview === x) renderDzPreview(m || x, x); } catch (e) { /* preview remains useful without enrichment */ }
}
async function searchDz() {
  const q = $('dzQ').value.trim(); if (!q) return;
  $('dzRes').innerHTML = '<p class="hint">Searching Deezer…</p>';
  try { dzResults = await P.searchDeezer(q, 12); renderDzResults(); } catch (e) { $('dzRes').innerHTML = '<p class="hint">Deezer search failed. Check your connection and try again.</p>'; }
}
if ($('dzSearch')) $('dzSearch').onclick = searchDz;
if ($('dzQ')) $('dzQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchDz(); } });
if ($('dzRes')) $('dzRes').addEventListener('click', e => { const b = e.target.closest('.dzr'); if (b && dzResults[+b.dataset.i]) selectDz(dzResults[+b.dataset.i]); });
if ($('dzToYt')) $('dzToYt').onclick = () => { if (!dzPreview) return; $('gtQ').value = [dzPreview.artist, dzPreview.title].filter(Boolean).join(' '); document.querySelector('.mtab[data-m="get"]').click(); $('gtYt').click(); };
if ($('dzClear')) $('dzClear').onclick = () => { dzPreview = null; renderDzPreview(); };
async function refresh() {
  if (busy) return; busy = true;
  try { np = await P.nowPlaying(); npAt = Date.now(); } catch (e) { /* keep the last known state */ }
  busy = false; paint();
}
let deb = null; const soon = ms => { clearTimeout(deb); deb = setTimeout(refresh, ms || 80); };
async function act(a, o) {
  const r = await P.control(a, o);
  if (!r || !r.ok) toast((r && r.error) || 'That did not work.');
  soon(a === 'toggle' || a === 'next' || a === 'prev' || a === 'play' ? 500 : 150);
}

// ---------- open / close ----------
function openMusic() { renderLib(); renderPls(); renderAi(); refresh(); $('music').classList.add('show'); }
function closeMusic() { $('music').classList.remove('show'); }
window.EmberMusicUI = { open: openMusic, close: closeMusic, refresh }; // V1.8.1: the left-panel Music Console opens the full panel through this, so the lists are drawn
if ($('bMusic')) $('bMusic').onclick = openMusic; // the header Music button no longer exists; an unguarded assignment here aborted the rest of this file
$('bMx').onclick = closeMusic; $('mwOpen').onclick = openMusic;
if ($('bOpenMusic')) $('bOpenMusic').onclick = () => { $('bSx').click(); openMusic(); };

// ---------- transport ----------
$('npPlay').onclick = () => act('toggle'); $('mwPlay').onclick = () => act('toggle');
$('npNext').onclick = () => act('next'); $('mwNext').onclick = () => act('next'); $('npPrev').onclick = () => act('prev');
$('npShuf').onclick = () => act('shuffle'); $('npRep').onclick = () => act('repeat');
$('npVol').oninput = () => P.control('volume', { value: +$('npVol').value });
['pointerdown', 'touchstart', 'mousedown'].forEach(ev => $('npSeek').addEventListener(ev, () => { dragging = true; }, { passive: true }));
$('npSeek').addEventListener('input', () => { $('npPos').textContent = fmt($('npSeek').value); const d = +$('npSeek').max || 1; $('npSeek').style.setProperty('--pct', Math.min(100, $('npSeek').value / d * 100) + '%'); });
$('npSeek').addEventListener('change', () => { dragging = false; act('seek', { value: +$('npSeek').value }); });

// ---------- tabs ----------
document.querySelectorAll('.mtab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.mtab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.mpane').forEach(x => x.classList.toggle('hidden', x.id !== 'mp_' + b.dataset.m));
  if (b.dataset.m === 'ai') renderAi(); if (b.dataset.m === 'lib') { renderLib(); renderPls(); }
}));

// ---------- library ----------
function renderLib() {
  const a = P.list($('mQ').value), cur = np.track && np.source === 'local' ? np.track.id : '';
  $('mList').innerHTML = !P.count() ? '<p class="hint">Nothing here yet. Tap Upload music.</p>' : !a.length ? '<p class="hint">No match.</p>' :
    a.slice(0, 200).map(t => '<div class="trk' + (t.id === cur ? ' on' : '') + '" data-id="' + esc(t.id) + '"><button class="go" data-id="' + esc(t.id) + '">' + esc(t.title) + '<small>' + esc([t.artist, t.durationMs ? fmt(t.durationMs / 1000) : '', t.kind === 'device' ? 'on phone' : ''].filter(Boolean).join(' · ')) + '</small></button><button class="x" data-id="' + esc(t.id) + '" aria-label="Remove ' + esc(t.title) + '">✕</button></div>').join('') +
    (a.length > 200 ? '<p class="hint">Showing the first 200. Use search to narrow it down.</p>' : '');
}
$('mQ').addEventListener('input', renderLib);
$('mList').addEventListener('click', async e => {
  const go = e.target.closest('.go'), x = e.target.closest('.x');
  if (go) { act('play', { songId: go.dataset.id, ids: P.list($('mQ').value).map(t => t.id) }); return; }
  if (x) {
    const t = P.get(x.dataset.id); if (!t) return;
    if (!window.confirm(t.kind === 'device' ? 'Remove "' + t.title + '" from Ember? The file stays on your phone.' : 'Remove "' + t.title + '" from Ember? Its copy inside Ember is deleted.')) return;
    await P.remove(t.id); renderLib(); renderPls(); soon();
  }
});
$('mUp').onclick = () => $('mFile').click();
$('mFile').onchange = async e => {
  const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (er) { /* the browser decides */ }
  $('mMsg').textContent = 'Adding ' + files.length + '…';
  const r = await P.addFiles(files);
  $('mMsg').textContent = 'Added ' + r.added + (r.skipped ? ', ' + r.skipped + ' already there' : '') + (r.failed ? ', ' + r.failed + ' could not be read' : '') + '.';
  renderLib(); soon();
};
if (!P.deviceOk()) { $('mScan').style.display = 'none'; } else {
  $('mScan').onclick = async () => {
    const b = $('mScan'); b.disabled = true; $('mMsg').textContent = 'Scanning the phone…';
    const r = await P.scanDevice(); b.disabled = false;
    $('mMsg').textContent = r.ok ? 'Found ' + r.found + ' song' + (r.found === 1 ? '' : 's') + ' on the phone, ' + r.added + ' new.' : r.error;
    renderLib();
  };
}

// ---------- sleep timer (V1.9.22): fades the volume out over 10 s, then pauses ----------
let slpEnd = 0, slpTick = null, slpBusy = false;
function slpPaint() { const left = slpEnd ? Math.max(0, slpEnd - Date.now()) : 0; $('npSleepLeft').textContent = slpEnd ? fmt(left / 1000) : ''; }
async function slpFire() {
  slpBusy = true; slpEnd = 0; clearInterval(slpTick); slpTick = null; $('npSleep').value = '0'; slpPaint();
  const v0 = np.volume != null ? +np.volume : 100;
  for (let k = 1; k <= 10; k++) { await P.control('volume', { value: Math.round(v0 * (1 - k / 10)) }); await new Promise(r => setTimeout(r, 1000)); }
  await P.control('pause'); await P.control('volume', { value: v0 }); slpBusy = false; toast('Sleep timer: paused'); soon(300);
}
$('npSleep').onchange = () => {
  const m = +$('npSleep').value; clearInterval(slpTick); slpTick = null;
  if (!m || slpBusy) { slpEnd = 0; slpPaint(); return; }
  slpEnd = Date.now() + m * 60000; slpPaint(); toast('Music stops in ' + m + ' min');
  slpTick = setInterval(() => { if (Date.now() >= slpEnd) slpFire(); else slpPaint(); }, 1000);
};

// ---------- local playlists ----------
function renderPls() {
  const a = P.playlists();
  $('mPls').innerHTML = a.length ? a.map(p => '<div class="trk"><button class="plgo" data-n="' + esc(p.name) + '">' + esc(p.name) + '<small>' + p.count + ' song' + (p.count === 1 ? '' : 's') + '</small></button><button class="x pldel" data-n="' + esc(p.name) + '" aria-label="Delete playlist ' + esc(p.name) + '">✕</button></div>').join('') : '<p class="hint">No playlists yet. Search or filter the library, type a name below and save, or ask Ember in chat.</p>';
}
$('mPls').addEventListener('click', async e => {
  const g = e.target.closest('.plgo'), d = e.target.closest('.pldel');
  if (g) { const r = await P.playPlaylist(g.dataset.n); if (!r.ok) toast(r.error); soon(500); }
  if (d && window.confirm('Delete the playlist "' + d.dataset.n + '"? The songs stay.')) { P.deletePlaylist(d.dataset.n); renderPls(); }
});
$('mPlSave').onclick = () => {
  const ids = P.list($('mQ').value).map(t => t.id), r = P.savePlaylist($('mPlName').value, ids);
  if (r.error) { toast(r.error); return; }
  $('mPlName').value = ''; renderPls(); toast('Saved "' + r.name + '" (' + r.count + ' songs)');
};

// ---------- Ember tab: what the AI may do, and what it did ----------
function renderAi() {
  const on = aiOn(), c = P.capabilities(), li = a => a.map(x => '<li>' + esc(x) + '</li>').join('');
  $('mAiSw').classList.toggle('on', on);
  $('mCan').innerHTML = on ? li(c.can) : '<li>Nothing. Music control is switched off, so Ember cannot touch the player.</li>';
  $('mCant').innerHTML = li(c.cannot);
  const lg = window.EmberMusicAddon ? window.EmberMusicAddon.log() : [];
  $('mLog').innerHTML = lg.length ? lg.map(l => '<div class="lg">' + esc(new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(l.text) + '</div>').join('') : '<p class="hint">Nothing yet. Everything Ember does to the player shows up here.</p>';
}
$('mAiSw').onclick = () => { const s = $('swMusic'); if (s) s.click(); setTimeout(renderAi, 80); };
if ($('swMusic')) $('swMusic').addEventListener('click', () => setTimeout(renderAi, 80));
window.addEventListener('ember-music-ai', e => { toast(String(e.detail || '')); if (panelOpen()) renderAi(); soon(600); });

// ---------- song identification (Audd.io) ----------
const goSettings = () => { closeMusic(); $('bSet').click(); setTimeout(() => { const t = document.querySelector('.stab[data-st="music"]'); if (t) t.click(); }, 80); };
function showId(r, id) {
  const box = $('npIdRes'); idFor = null;
  if (!r || !r.ok) { box.textContent = (r && r.error) || 'That did not work.'; return; }
  if (!r.found) { box.textContent = r.note || 'No match.'; return; }
  idFor = { id, r };
  box.innerHTML = '<b>' + esc(r.title) + '</b>' + (r.artist ? ' · ' + esc(r.artist) : '') + (r.album ? '<br>' + esc(r.album) + (r.year ? ' (' + esc(r.year) + ')' : '') : '') + (r.label ? '<br><small>' + esc(r.label) + '</small>' : '') +
    (id ? '<div class="btnrow" style="margin-top:6px"><button class="btn" id="npIdUse">Use these tags</button></div>' : '') + '<br><small class="asrc">Best match from Audd.io. It gives no confidence score.</small>';
}
$('npId').onclick = async () => {
  if (!AU.hasKey()) { toast('Paste your Audd.io token in Settings, Music first'); goSettings(); return; }
  const t = np.track; if (!t || !t.id) { toast('Play a song first'); return; }
  $('npId').disabled = true; $('npIdRes').textContent = 'Listening… sending a short clip to Audd.io';
  const r = await AU.identifyTrack(t.id); $('npId').disabled = false; showId(r, t.id);
};
$('npIdRes').addEventListener('click', e => {
  if (!e.target.closest('#npIdUse') || !idFor) return;
  const { id, r } = idFor, u = P.updateTrack(id, { title: r.title, artist: r.artist, album: r.album });
  toast(u.ok ? 'Tags updated for this song' : u.error); if (u.ok) { $('npIdRes').textContent = 'Updated: ' + r.title + (r.artist ? ' · ' + r.artist : ''); idFor = null; renderLib(); soon(); }
});
function renderAu() {
  const s = AU.status();
  $('auStat').textContent = s.hasKey ? 'Token saved (' + s.masked + '). Identify works from the Music panel and from chat.' : 'Off. Paste your Audd.io API token to turn it on.';
  if (document.activeElement !== $('auToken')) $('auToken').value = '';
  $('auToken').placeholder = s.hasKey ? 'Token saved. Paste a new one to replace it' : 'API token from dashboard.audd.io';
  $('auClear').disabled = !s.hasKey; $('auUrlGo').disabled = !s.hasKey;
}
$('auSave').onclick = () => { const v = $('auToken').value.trim(); if (v.length < 8) { toast('That does not look like a token'); return; } AU.setKey(v); $('auToken').value = ''; renderAu(); renderAi(); toast('Audd.io token saved on this phone'); };
$('auClear').onclick = () => { AU.setKey(''); renderAu(); renderAi(); toast('Audd.io token removed'); };
$('auUrlGo').onclick = async () => {
  const u = $('auUrl').value.trim(); if (!u) return;
  $('auUrlRes').textContent = 'Asking Audd.io…'; const r = await AU.identifyUrl(u);
  $('auUrlRes').textContent = !r.ok ? r.error : !r.found ? r.note : r.title + (r.artist ? ' · ' + r.artist : '') + (r.album ? ' · ' + r.album : '') + (r.year ? ' (' + r.year + ')' : '');
};
window.addEventListener('ember-audd', renderAu);

// ---------- live updates ----------
P.on(kind => { if (kind === 'library') { renderLib(); renderPls(); } if (kind === 'playlists') renderPls(); soon(kind === 'tick' ? 0 : 80); });
setInterval(() => { if (!document.hidden && !P.snapshot().playing) refresh(); }, 5000);
setInterval(() => { if (np.playing && !dragging && (panelOpen() || !$('mw').classList.contains('hidden'))) paintPos(); if (np.playing && panelOpen() && window.EmberLyrics) window.EmberLyrics.paint(np, posNow()); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

renderAu();
P.init().then(() => { renderLib(); renderPls(); refresh(); });
})();
