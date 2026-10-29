// Ember V1.7.0 - ember_player.js: the music engine. No bridge, no other app. Ember plays your music itself.
// Local library (uploaded files + phone scan) lives in IndexedDB. Song info comes from Deezer (art, album, year, genre) and
// MusicBrainz (artist and album background). Everything else (panel, widget, the AI) talks to ONE object: window.EmberPlayer.
'use strict';
(() => {
const DB_NAME = 'ember_music', EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm|mp4|3gp|amr|wma)$/i;
const PL_KEY = 'ember_playlists';
let db = null;
const mem = { tracks: new Map(), blobs: new Map() };
let lib = [];                       // track records (no audio data), sorted by title
let queue = [], qi = -1;            // queue of local track ids, index into it
let shuffle = false, repeat = false;
let loadToken = 0;
const devCache = [];                // small LRU of device-track blobs: [{id, blob}]
const subs = new Set();
const audio = new Audio(); audio.preload = 'auto';
let curUrl = null, cur = null;      // object URL + record currently loaded into the audio element
let lastErr = '';

// ---------- tiny IndexedDB wrapper (own database, never touches the chat store) ----------
const open = () => new Promise(res => {
  try {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
  } catch (e) { res(null); }
});
const rq = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const store = (n, m) => db.transaction(n, m || 'readonly').objectStore(n);
async function dbAll(n) { if (!db) return [...mem[n].values()]; try { return await rq(store(n).getAll()); } catch (e) { return [...mem[n].values()]; } }
async function dbPut(n, v) { mem[n].set(v.id, v); if (!db) return true; try { await rq(store(n, 'readwrite').put(v)); return true; } catch (e) { return false; } }
async function dbGet(n, id) { if (!db) return mem[n].get(id) || null; try { return (await rq(store(n).get(id))) || null; } catch (e) { return mem[n].get(id) || null; } }
async function dbDel(n, id) { mem[n].delete(id); if (!db) return; try { await rq(store(n, 'readwrite').delete(id)); } catch (e) { /* already gone */ } }

// ---------- playlists (ids of local tracks, in localStorage) ----------
function plLoad() { try { const a = JSON.parse(localStorage.getItem(PL_KEY) || '[]'); return Array.isArray(a) ? a.filter(p => p && p.name && Array.isArray(p.ids)) : []; } catch (e) { return []; } }
function plSave(a) { try { localStorage.setItem(PL_KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }

// ---------- helpers ----------
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function parseName(fn) {
  const base = String(fn || '').replace(EXT, '').replace(/[_]+/g, ' ').trim();
  const m = base.match(/^(.+?)\s+-\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: '', title: base || 'Untitled' };
}
const sortLib = () => lib.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
const emit = kind => { const snap = snapshot(); subs.forEach(f => { try { f(kind, snap); } catch (e) { /* a bad listener must not stop playback */ } }); };
function readDuration(blob) {
  return new Promise(res => {
    const a = new Audio(), u = URL.createObjectURL(blob); let done = false;
    const fin = v => { if (done) return; done = true; try { URL.revokeObjectURL(u); } catch (e) {} res(v); };
    a.preload = 'metadata'; a.onloadedmetadata = () => fin(isFinite(a.duration) ? Math.round(a.duration * 1000) : 0); a.onerror = () => fin(0);
    setTimeout(() => fin(0), 4000); a.src = u;
  });
}

// ---------- library ----------
async function init() {
  if (!db) db = await open();
  lib = (await dbAll('tracks')).filter(t => t && t.id); sortLib(); emit('library');
  return lib.length;
}
function list(q, limit) {
  const s = String(q || '').trim().toLowerCase();
  let a = s ? lib.filter(t => (t.title + ' ' + t.artist + ' ' + t.album).toLowerCase().includes(s)) : lib.slice();
  if (limit > 0) a = a.slice(0, limit);
  return a;
}
const get = id => lib.find(t => t.id === id) || null;
const brief = t => t ? { id: t.id, title: t.title, artist: t.artist, album: t.album, durationSec: Math.round((t.durationMs || 0) / 1000) } : null;

async function addFiles(files) {
  const out = { added: 0, skipped: 0, failed: 0 };
  for (const f of Array.from(files || [])) {
    try {
      if (!f || !((f.type && f.type.indexOf('audio/') === 0) || EXT.test(f.name || ''))) { out.failed++; continue; }
      const id = 'f_' + hash((f.name || '') + '|' + f.size + '|' + (f.lastModified || 0));
      if (get(id)) { out.skipped++; continue; }
      const n = parseName(f.name);
      const rec = { id, kind: 'file', title: n.title, artist: n.artist, album: '', durationMs: await readDuration(f), size: f.size, added: Date.now() };
      const okB = await dbPut('blobs', { id, blob: f, type: f.type || '' });
      const okT = await dbPut('tracks', rec);
      if (!okB || !okT) { out.failed++; continue; }
      lib.push(rec); out.added++;
    } catch (e) { out.failed++; }
  }
  sortLib(); emit('library'); return out;
}
async function remove(id) {
  const t = get(id); if (!t) return false;
  if (cur && cur.id === id) stop();
  lib = lib.filter(x => x.id !== id);
  await dbDel('tracks', id); await dbDel('blobs', id);
  const pl = plLoad().map(p => ({ name: p.name, ids: p.ids.filter(x => x !== id) })); plSave(pl);
  emit('library'); return true;
}
async function wipe() {
  stop(); lib = []; mem.tracks.clear(); mem.blobs.clear();
  if (db) { try { await rq(store('tracks', 'readwrite').clear()); await rq(store('blobs', 'readwrite').clear()); } catch (e) { /* nothing to clear */ } }
  try { localStorage.removeItem(PL_KEY); localStorage.removeItem(META_KEY); localStorage.removeItem('ember_meta'); } catch (e) {}
  metaMem.clear(); emit('library');
}
const deviceOk = () => !!(window.EmberNative && window.EmberNative.device);
async function scanDevice() {
  const D = deviceOk() ? window.EmberNative.device : null;
  if (!D) return { ok: false, error: 'Phone scan only works in the installed app.' };
  let granted = false;
  try { granted = await D.has(); if (!granted) granted = await D.request(); } catch (e) { return { ok: false, error: 'Could not ask for file access: ' + (e.message || e) }; }
  if (!granted) return { ok: false, error: 'File access was not granted. Allow Music and audio for Ember in the phone settings.' };
  let tracks; try { tracks = await D.list(); } catch (e) { return { ok: false, error: 'Scan failed: ' + (e.message || e) }; }
  let added = 0;
  tracks.forEach(t => {
    const id = 'd_' + t.id; if (get(id)) return;
    const rec = { id, kind: 'device', devId: String(t.id), title: t.title || 'Untitled', artist: t.artist && t.artist !== '<unknown>' ? t.artist : '', album: t.album && t.album !== '<unknown>' ? t.album : '', durationMs: +t.durationMs || 0, mime: t.mime || '', size: +t.size || 0, added: Date.now() };
    lib.push(rec); dbPut('tracks', rec); added++;
  });
  sortLib(); emit('library'); return { ok: true, found: tracks.length, added };
}

// ---------- playlists API ----------
const playlists = () => plLoad().map(p => ({ name: p.name, count: p.ids.filter(id => get(id)).length }));
function savePlaylist(name, ids) {
  const n = String(name || '').trim().slice(0, 40); if (!n) return { error: 'Playlist name is required.' };
  const good = (Array.isArray(ids) ? ids : []).map(String).filter(id => get(id));
  if (!good.length) return { error: 'None of those song ids are in the library.' };
  const a = plLoad().filter(p => p.name.toLowerCase() !== n.toLowerCase()); a.push({ name: n, ids: good });
  if (!plSave(a)) return { error: 'Could not save: storage is blocked.' };
  emit('playlists'); return { ok: true, name: n, count: good.length, skipped: (Array.isArray(ids) ? ids.length : 0) - good.length };
}
function deletePlaylist(name) { const a = plLoad(), b = a.filter(p => p.name.toLowerCase() !== String(name || '').toLowerCase()); plSave(b); emit('playlists'); return a.length !== b.length; }
function playlistIds(name) { const p = plLoad().find(x => x.name.toLowerCase() === String(name || '').toLowerCase()); return p ? p.ids.filter(id => get(id)) : null; }

// ---------- local playback ----------
function setSession(t) {
  try {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || '', artist: t.artist || '', album: t.album || '' });
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) { /* action not supported here */ } };
    h('play', () => control('play')); h('pause', () => control('pause')); h('nexttrack', () => control('next')); h('previoustrack', () => control('prev'));
    h('seekto', d => { if (d && d.seekTime != null) seek(d.seekTime); });
  } catch (e) { /* lock-screen controls are a bonus */ }
}
async function blobFor(t) {
  if (t.kind === 'file') { const r = await dbGet('blobs', t.id); return r && r.blob ? r.blob : null; }
  const hit = devCache.find(x => x.id === t.id); if (hit) return hit.blob;
  const D = deviceOk() ? window.EmberNative.device : null; if (!D) return null;
  const blob = await D.read(t.devId, t.size, t.mime);
  devCache.unshift({ id: t.id, blob }); while (devCache.length > 3) devCache.pop();
  return blob;
}
async function loadAndPlay(t, autoplay) {
  const tok = ++loadToken; lastErr = '';
  let blob = null;
  try { blob = await blobFor(t); } catch (e) { lastErr = 'Could not read that file: ' + (e.message || e); }
  if (tok !== loadToken) return { ok: false, error: 'Superseded.' };
  if (!blob) { lastErr = lastErr || 'Audio data is missing for "' + t.title + '". Re-add the file.'; emit('error'); return { ok: false, error: lastErr }; }
  if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} }
  curUrl = URL.createObjectURL(blob); cur = t; audio.src = curUrl; setSession(t);
  if (autoplay) {
    try { await audio.play(); } catch (e) { lastErr = 'The phone blocked or could not play that file (' + (e.name || 'error') + ').'; emit('error'); return { ok: false, error: lastErr }; }
  }
  emit('track'); return { ok: true };
}

async function playLocal(id, ids) {
  const t = get(id); if (!t) return { ok: false, error: 'No track with id ' + id + ' in the library.' };
  queue = (Array.isArray(ids) && ids.includes(id)) ? ids.filter(x => get(x)) : lib.map(x => x.id);
  qi = queue.indexOf(id);
  return loadAndPlay(t, true);
}
async function step(dir, auto) {
  if (!queue.length) return { ok: false, error: 'Nothing queued.' };
  let n;
  if (shuffle && queue.length > 1) { do { n = Math.floor(Math.random() * queue.length); } while (n === qi); }
  else { n = qi + dir; if (n >= queue.length) { if (repeat || !auto) n = 0; else { stop(); return { ok: true, ended: true }; } } if (n < 0) n = queue.length - 1; }
  qi = n; const t = get(queue[qi]); if (!t) return { ok: false, error: 'Track no longer in the library.' };
  return loadAndPlay(t, true);
}
function stop() { loadToken++; try { audio.pause(); } catch (e) {} audio.removeAttribute('src'); try { audio.load(); } catch (e) {} if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} curUrl = null; } cur = null; emit('track'); }
function seek(sec) { if (!cur) return { ok: false, error: 'No local track loaded.' }; const d = isFinite(audio.duration) ? audio.duration : (cur.durationMs || 0) / 1000; audio.currentTime = Math.max(0, Math.min(+sec || 0, d || 0)); emit('tick'); return { ok: true }; }
audio.addEventListener('play', () => emit('state')); audio.addEventListener('pause', () => emit('state'));
audio.addEventListener('ended', () => { step(1, true); });
audio.addEventListener('loadedmetadata', () => { if (cur && isFinite(audio.duration) && !cur.durationMs) { cur.durationMs = Math.round(audio.duration * 1000); dbPut('tracks', cur); } emit('track'); });
audio.addEventListener('error', () => { if (!cur) return; lastErr = 'The phone could not decode "' + cur.title + '".'; emit('error'); });
let lastTick = 0; audio.addEventListener('timeupdate', () => { const n = Date.now(); if (n - lastTick > 900) { lastTick = n; emit('tick'); } });

// ---------- unified state ----------
const localPlaying = () => !!cur && !audio.paused && !audio.ended;
function snapshot() {
  return {
    source: 'local', playing: localPlaying(), loaded: !!cur, track: brief(cur),
    positionSec: cur ? Math.round(audio.currentTime || 0) : 0, volume: Math.round(audio.volume * 100), shuffle, repeat, error: lastErr, queueLength: queue.length
  };
}
// What is playing right now. This is what the widget, the panel and the AI all read.
async function nowPlaying() {
  const loc = snapshot();
  if (loc.loaded) return Object.assign({}, loc, { source: 'local' });
  return { source: 'none', playing: false, track: null };
}

// ---------- unified control ----------
// action: play | pause | toggle | next | prev | stop | seek | volume | shuffle | repeat
async function control(action, o) {
  o = o || {};
  if (action === 'volume') {
    const v = Math.max(0, Math.min(100, Math.round(+o.value)));
    if (!isFinite(v)) return { ok: false, error: 'volume needs a number from 0 to 100.' };
    audio.volume = v / 100; emit('state'); return { ok: true, volume: v, source: 'local' };
  }
  if (action === 'shuffle') { shuffle = o.value == null ? !shuffle : !!o.value; emit('state'); return { ok: true, shuffle }; }
  if (action === 'repeat') { repeat = o.value == null ? !repeat : !!o.value; emit('state'); return { ok: true, repeat }; }
  if (action === 'play' && o.songId) return playLocal(String(o.songId), o.ids);
  switch (action) {
    case 'play': {
      if (cur) { try { await audio.play(); return { ok: true }; } catch (e) { return { ok: false, error: 'Could not resume (' + (e.name || 'error') + ').' }; } }
      if (lib.length) return playLocal(lib[0].id, lib.map(x => x.id));
      return { ok: false, error: 'The library is empty. Upload music in the Music panel first.' };
    }
    case 'pause': if (!cur) return { ok: false, error: 'Nothing is playing here.' }; audio.pause(); return { ok: true };
    case 'toggle': return localPlaying() ? control('pause') : control('play');
    case 'next': return step(1, false);
    case 'prev': if (audio.currentTime > 3) { audio.currentTime = 0; return { ok: true, restarted: true }; } return step(-1, false);
    case 'stop': stop(); return { ok: true };
    case 'seek': return seek(o.value);
    default: return { ok: false, error: 'Unknown action: ' + action };
  }
}
async function playPlaylist(name) {
  const ids = playlistIds(name); if (ids === null) return { ok: false, error: 'No playlist called "' + name + '".' };
  if (!ids.length) return { ok: false, error: 'That playlist has no tracks left in the library.' };
  return playLocal(ids[0], ids);
}

// ---------- what Ember can and cannot do, built from the real state (the AI is told exactly this) ----------
function capabilities() {
  const au = !!(window.EmberAudd && window.EmberAudd.hasKey());
  const can = [
    'play, pause, resume, skip, go back, stop, seek, set volume, shuffle and repeat for his uploaded music (' + lib.length + ' track' + (lib.length === 1 ? '' : 's') + ' in the library)',
    'tell him what is playing right now',
    'search the library and play a track by id, make local playlists and play them (' + (playlists().map(p => p.name).join(', ') || 'none yet') + ')'
  ];
  if (au) can.push('identify the song that is playing in Ember\'s player (a short audio clip goes to Audd.io), or a song from a direct audio link he gives');
  const cannot = [
    'delete music or playlists, change settings, or connect / disconnect anything',
    'start, stop or change music by himself: only when his latest message asks for it',
    'hear audio or read lyrics from the player (lyrics need a web lookup)',
    'see music playing in other apps: only Ember\'s own player is visible to you'
  ];
  if (!au) cannot.push('identify an unknown song: song identification is off until he pastes an Audd.io API token in Settings > Music');
  return { can, cannot, library: lib.length, playlists: playlists(), audd: au, phoneScan: deviceOk() };
}

// ---------- V1.7.0 metadata + artwork: embedded tags first, then Deezer (art/album/year/genre), then MusicBrainz (artist and album background, with the Wikipedia page it links to) ----------
const META_KEY = 'ember_meta2', metaMem = new Map(), metaBusy = new Map(); let embUrl = null;
const mkey = (a, t) => (String(a || '') + '|' + String(t || '')).toLowerCase().replace(/\s+/g, ' ').trim();
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\.?.*$|ft\.?.*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const firstArtist = a => String(a || '').split(/,|&| feat\.? | ft\.? | x /i)[0].trim();
function metaLoad() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { return {}; } }
function metaSave(k, v) {
  try {
    const o = metaLoad(); o[k] = Object.assign({}, v, { t: Date.now() }); const ks = Object.keys(o);
    if (ks.length > 150) ks.sort((a, b) => o[a].t - o[b].t).slice(0, ks.length - 150).forEach(x => delete o[x]);
    localStorage.setItem(META_KEY, JSON.stringify(o));
  } catch (e) { /* cache is a bonus */ }
}
async function jget(u, ms) {
  const c = new AbortController(), h = setTimeout(() => c.abort(), ms || 6000);
  try { const r = await fetch(u, { signal: c.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(h); }
}
// ID3v2 (mp3): title, artist, album, year and the embedded cover picture
async function readId3(blob) {
  try {
    const h = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return null;
    const ver = h[3], size = ((h[6] & 127) << 21) | ((h[7] & 127) << 14) | ((h[8] & 127) << 7) | (h[9] & 127);
    const buf = new Uint8Array(await blob.slice(10, 10 + Math.min(size, 8 * 1024 * 1024)).arrayBuffer());
    const dec = (b, enc) => {
      try {
        if (enc === 1) { const be = b[0] === 0xFE && b[1] === 0xFF; return new TextDecoder(be ? 'utf-16be' : 'utf-16le').decode(b).replace(/^\uFEFF/, '').replace(/\0/g, '').trim(); }
        return new TextDecoder(enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1').decode(b).replace(/\0/g, '').trim();
      } catch (e) { return ''; }
    };
    const out = {}; let p = 0;
    while (p + 10 <= buf.length) {
      const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fl = ver === 4 ? ((buf[p + 4] & 127) << 21) | ((buf[p + 5] & 127) << 14) | ((buf[p + 6] & 127) << 7) | (buf[p + 7] & 127) : ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0;
      const body = buf.subarray(p + 10, p + 10 + fl); p += 10 + fl; if (!fl) continue;
      if (id === 'TIT2') out.title = dec(body.subarray(1), body[0]);
      else if (id === 'TPE1') out.artist = dec(body.subarray(1), body[0]);
      else if (id === 'TALB') out.album = dec(body.subarray(1), body[0]);
      else if (id === 'TYER' || id === 'TDRC') out.year = dec(body.subarray(1), body[0]).slice(0, 4);
      else if (id === 'TCON') out.genre = dec(body.subarray(1), body[0]).replace(/^\(\d+\)/, '');
      else if (id === 'APIC' && !out.pic) {
        const enc = body[0]; let i = 1; while (i < body.length && body[i]) i++;
        const mime = String.fromCharCode.apply(null, body.subarray(1, i)); i += 2;
        if (enc === 1 || enc === 2) { while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2; i += 2; } else { while (i < body.length && body[i]) i++; i++; }
        if (body.length - i > 200) out.pic = new Blob([body.subarray(i)], { type: /^image\//.test(mime) ? mime : 'image/jpeg' });
      }
    }
    return out;
  } catch (e) { return null; }
}
const clipText = x => {
  let t = String(x || '').replace(/\s+/g, ' ').trim();
  if (t.length > 1000) { const c = t.slice(0, 1000), i = c.lastIndexOf('. '); t = i > 400 ? c.slice(0, i + 1) : c + '…'; }
  return t;
};
async function wiki(q, must) {
  const r = await jget('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts&exintro=1&explaintext=1&exchars=1100&generator=search&gsrlimit=1&gsrsearch=' + encodeURIComponent(q));
  const pg = r && r.query && r.query.pages && Object.values(r.query.pages)[0];
  if (!pg || !pg.extract || pg.extract.length < 60) return '';
  const hay = norm(pg.title + ' ' + pg.extract); if (must && !hay.includes(norm(must))) return '';
  return clipText(pg.extract);
}
async function wikiPage(title) {
  const r = await jget('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts&exintro=1&explaintext=1&exchars=1100&titles=' + encodeURIComponent(title));
  const pg = r && r.query && r.query.pages && Object.values(r.query.pages)[0];
  return pg && pg.extract && pg.extract.length >= 60 ? clipText(pg.extract) : '';
}
// MusicBrainz links an artist or album to its Wikipedia page directly, or through Wikidata. Follow that link instead of guessing by search.
async function wikiFromRels(rels) {
  rels = Array.isArray(rels) ? rels.filter(x => x && x.url && x.url.resource) : [];
  let title = '';
  const w = rels.find(x => x.type === 'wikipedia'), m = w && String(w.url.resource).match(/^https?:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/);
  if (m) { try { title = decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (e) { title = ''; } }
  if (!title) {
    const wd = rels.find(x => x.type === 'wikidata'), q = wd && String(wd.url.resource).match(/\/(Q\d+)$/);
    if (q) { const j = await jget('https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&sitefilter=enwiki&format=json&origin=*&ids=' + q[1]); const e = j && j.entities && j.entities[q[1]]; title = (e && e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title) || ''; }
  }
  return title ? wikiPage(title) : '';
}
const mbText = a => String(a || '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\[(?:https?:[^\s\]]+)\s+([^\]]*)\]/g, '$1').replace(/'''?/g, '').replace(/\s+/g, ' ').trim();
const topGenre = a => (Array.isArray(a) && a.length ? a.slice().sort((x, y) => (y.count || 0) - (x.count || 0))[0].name : '');
const cap1 = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());

// Deezer: keyless search. A plain browser has no CORS access to it, so the fallback is Deezer's own JSONP mode.
const DZ = 'https://api.deezer.com';
function jsonp(u, ms) {
  return new Promise(res => {
    const cb = 'emberdz' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36), sc = document.createElement('script'); let done = false;
    const fin = v => { if (done) return; done = true; try { delete window[cb]; } catch (e) { window[cb] = undefined; } try { sc.remove(); } catch (e) { /* already gone */ } res(v); };
    window[cb] = d => fin(d); sc.onerror = () => fin(null); sc.src = u + (u.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
    setTimeout(() => fin(null), ms || 7000); document.head.appendChild(sc);
  });
}
async function dz(path) {
  const u = DZ + path;
  // Deezer's public endpoint is not consistently CORS-enabled in Android WebViews;
  // JSONP is the quiet browser-safe path, with fetch retained for hosts that block JSONP.
  const k = await jsonp(u, 7000); if (k && !k.error) return k;
  const j = await jget(u, 6000); return j && !j.error ? j : null;
}
// MusicBrainz asks for at most one request per second, so every call waits its turn.
let mbChain = Promise.resolve(), mbLast = 0;
function mb(path) {
  const run = async () => {
    const w = mbLast + 1100 - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w));
    mbLast = Date.now(); return jget('https://musicbrainz.org/ws/2' + path + (path.includes('?') ? '&' : '?') + 'fmt=json', 8000);
  };
  const p = mbChain.then(run); mbChain = p.catch(() => null); return p;
}
const lq = s => String(s || '').replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
async function fetchDeezer(title, artist, out) {
  const a1 = firstArtist(artist), nt = norm(title); if (!nt) return;
  let r = await dz('/search/track?limit=6&q=' + encodeURIComponent((a1 ? 'artist:"' + lq(a1) + '" ' : '') + 'track:"' + lq(title) + '"'));
  let rs = (r && r.data) || [];
  if (!rs.length) { r = await dz('/search/track?limit=6&q=' + encodeURIComponent([a1, title].filter(Boolean).join(' '))); rs = (r && r.data) || []; }
  const same = (x, y) => !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  const hit = rs.find(x => same(norm(x.title_short || x.title), nt) && (!a1 || same(norm(x.artist && x.artist.name), norm(a1))));
  if (!hit) return;
  const al = hit.album || {}, ar = hit.artist || {};
  out.art = al.cover_xl || al.cover_big || ar.picture_xl || ''; out.artist = ar.name || ''; out.album = al.title || '';
  if (al.id) { const d = await dz('/album/' + encodeURIComponent(al.id)); if (d) { out.year = String(d.release_date || '').slice(0, 4); out.genre = (d.genres && d.genres.data && d.genres.data[0] && d.genres.data[0].name) || ''; } }
  out.sources.push('Deezer');
}
async function searchDeezer(q, limit) {
  q = lq(q); if (!q) return [];
  const r = await dz('/search/track?limit=' + Math.max(1, Math.min(+limit || 12, 25)) + '&q=' + encodeURIComponent(q));
  return ((r && r.data) || []).map(x => ({
    id: String(x.id || ''), title: x.title || x.title_short || '', artist: x.artist && x.artist.name || '',
    album: x.album && x.album.title || '', art: x.album && (x.album.cover_xl || x.album.cover_big || x.album.cover_medium) || '',
    durationSec: +x.duration || 0, previewUrl: x.preview || '', link: x.link || ''
  })).filter(x => x.id && x.title);
}
async function fetchBrainz(title, artist, out) {
  const name = lq(out.artist ? firstArtist(out.artist) : firstArtist(artist));
  const tasks = [];
  if (name) tasks.push((async () => {
    const s = await mb('/artist/?limit=3&query=' + encodeURIComponent('artist:"' + name + '"'));
    const a = ((s && s.artists) || []).find(x => norm(x.name) === norm(name) && (x.score || 0) >= 85);
    if (!a) return;
    const d = await mb('/artist/' + a.id + '?inc=url-rels+genres+annotation'); if (!d) return;
    let bio = await wikiFromRels(d.relations);
    if (!bio && d.annotation) bio = clipText(mbText(d.annotation));
    if (!bio) {
      const ty = String(d.type || '').toLowerCase(), area = d.area && d.area.name, ls = d['life-span'] || {}, b = String(ls.begin || '').slice(0, 4);
      const bits = [d.name + (ty ? ' is a ' + ty : ' is an artist') + (area ? ' from ' + area : '') + (b ? ', active since ' + b : '') + '.'];
      const g = (d.genres || []).slice().sort((x, y) => (y.count || 0) - (x.count || 0)).slice(0, 3).map(x => cap1(x.name)); if (g.length) bits.push('Known for ' + g.join(', ') + '.');
      bio = bits.join(' ');
    }
    out.aboutArtist = bio; if (!out.genre) out.genre = cap1(topGenre(d.genres));
    out.sources.push('MusicBrainz');
  })());
  if (title) tasks.push((async () => {
    const q = 'recording:"' + lq(title) + '"' + (name ? ' AND artist:"' + name + '"' : '');
    const s = await mb('/recording/?limit=3&query=' + encodeURIComponent(q));
    const rec = ((s && s.recordings) || []).find(x => norm(x.title) === norm(title) && (x.score || 0) >= 85);
    if (!rec) return;
    if (!out.year && rec['first-release-date']) out.year = String(rec['first-release-date']).slice(0, 4);
    const rg = rec.releases && rec.releases[0] && rec.releases[0]['release-group'];
    if (rg && rg.id) {
      const d = await mb('/release-group/' + rg.id + '?inc=url-rels+genres+annotation');
      if (d) {
        const t = await wikiFromRels(d.relations) || (d.annotation ? clipText(mbText(d.annotation)) : '');
        if (t) out.aboutAlbum = t;
        if (!out.album && d.title) out.album = d.title; if (!out.genre) out.genre = cap1(topGenre(d.genres));
      }
    }
    if (out.sources.indexOf('MusicBrainz') < 0) out.sources.push('MusicBrainz');
  })());
  await Promise.all(tasks);
}
async function fetchOnline(title, artist) {
  const out = { sources: [] };
  await fetchDeezer(title, artist, out);
  const name = firstArtist(out.artist || artist);
  const [, song] = await Promise.all([fetchBrainz(title, artist, out), name && title ? wiki('"' + title + '" ' + name + ' song', name) : '']);
  if (song && song !== out.aboutArtist && song !== out.aboutAlbum) { out.aboutSong = song; if (out.sources.indexOf('Wikipedia') < 0) out.sources.push('Wikipedia'); }
  return out;
}
async function embeddedFor(t) {
  const rec = get(t.id); if (!rec) return null; let blob = null;
  try { if (rec.kind === 'file') { const r = await dbGet('blobs', rec.id); blob = r && r.blob; } else { const h = devCache.find(x => x.id === rec.id); blob = h && h.blob; } } catch (e) { blob = null; }
  return blob ? readId3(blob) : null;
}
// meta(track, source) -> { art, title, artist, album, year, genre, aboutArtist, aboutSong }. Never throws; fields are '' when unknown.
function meta(t, source) {
  if (!t || !t.title) return Promise.resolve(null);
  const id = (source || '') + '|' + (t.id || '') + '|' + mkey(t.artist, t.title);
  if (metaMem.has(id)) return Promise.resolve(metaMem.get(id));
  if (metaBusy.has(id)) return metaBusy.get(id);
  const job = (async () => {
    const m = { title: t.title || '', artist: t.artist || '', album: t.album || '', year: '', genre: '', art: t.art || '', aboutArtist: '', aboutSong: '', aboutAlbum: '', sources: [] };
    let emb = null;
    if (t.id) {
      emb = await embeddedFor(t);
      if (emb) {
        ['title', 'artist', 'album', 'year', 'genre'].forEach(k => { if (emb[k] && (k === 'year' || k === 'genre' || !m[k])) m[k] = emb[k]; });
        if (emb.pic) { if (embUrl) { try { URL.revokeObjectURL(embUrl); } catch (e) {} } embUrl = URL.createObjectURL(emb.pic); m.art = embUrl; m.embedded = true; }
        m.sources.push('file tags');
        const rec = get(t.id); if (rec && ((!rec.artist && m.artist) || (!rec.album && m.album))) { rec.artist = rec.artist || m.artist; rec.album = rec.album || m.album; dbPut('tracks', rec); }
      }
    }
    const k = mkey(m.artist || t.artist, m.title || t.title), cached = metaLoad()[k];
    const on = cached || await fetchOnline(m.title || t.title, m.artist || t.artist);
    if (!cached && (on.art || on.aboutArtist || on.album)) metaSave(k, on);
    (on.sources || []).forEach(x => { if (m.sources.indexOf(x) < 0) m.sources.push(x); });
    if (!m.art || (!m.embedded && !t.art)) m.art = m.art || on.art || '';
    if (!m.art) { try { const dm = window.EmberDlMeta && window.EmberDlMeta.find(t); if (dm && dm.thumb) m.art = dm.thumb; if (dm && !m.album && dm.album) m.album = dm.album; } catch (e) { /* no saved cover */ } } // V1.9.27: the thumbnail of what he downloaded
    ['album', 'year', 'genre'].forEach(f => { if (!m[f]) m[f] = on[f] || ''; });
    if (!m.artist) m.artist = on.artist || ''; m.aboutArtist = on.aboutArtist || ''; m.aboutSong = on.aboutSong || ''; m.aboutAlbum = on.aboutAlbum || '';
    metaMem.set(id, m); if (metaMem.size > 40) metaMem.delete(metaMem.keys().next().value);
    try { if (cur && t.id === cur.id && 'mediaSession' in navigator && navigator.mediaSession.metadata && m.art && !/^blob:/.test(m.art)) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || '', artist: m.artist || '', album: m.album || '', artwork: [{ src: m.art, sizes: '600x600' }] }); } catch (e) { /* lock-screen art is a bonus */ }
    emit('meta'); return m;
  })().finally(() => metaBusy.delete(id));
  metaBusy.set(id, job); return job;
}
const metaPeek = (t, source) => (t && metaMem.get((source || '') + '|' + (t.id || '') + '|' + mkey(t.artist, t.title))) || null;

// Used by song identification (ember_audd.js): the audio of a library track, and a way to fix its title / artist / album once it is identified.
async function audioBlob(id) { const t = get(id); if (!t) return null; try { return await blobFor(t); } catch (e) { return null; } }
function updateTrack(id, f) {
  const t = get(id); if (!t) return { ok: false, error: 'No such track.' };
  ['title', 'artist', 'album'].forEach(k => { if (f && f[k]) t[k] = String(f[k]).slice(0, 200); });
  dbPut('tracks', t); sortLib();
  for (const k of [...metaMem.keys()]) if (k.split('|')[1] === id) metaMem.delete(k);
  emit('library'); emit('track'); return { ok: true };
}
window.EmberPlayer = {
  init, list, get, brief, addFiles, remove, wipe, scanDevice, playlists, savePlaylist, deletePlaylist, playlistIds, playPlaylist, searchDeezer,
  playLocal, control, nowPlaying, snapshot, capabilities, seek, stop, meta, metaPeek, audioBlob, updateTrack,
  on: f => { subs.add(f); return () => subs.delete(f); },
  position: () => (cur ? audio.currentTime || 0 : 0), count: () => lib.length, deviceOk
};
})();
