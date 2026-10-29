// Ember V1.7.0 - ember_audd.js: name an unknown song with Audd.io (audio fingerprinting).
// You paste YOUR Audd.io API token in Settings > Music. Nothing is sent until you tap Identify (or ask Ember in chat).
// What leaves the phone: one short audio clip (about 12 seconds, converted to a small WAV in the page) or a direct audio link you typed,
// plus your token, to https://api.audd.io/. The token stays in this app's storage on this phone.
// Audd returns title, artist, album, release date and label. It gives no confidence score, so Ember shows the answer and you decide.
'use strict';
(() => {
const KEY = 'ember_audd', API = 'https://api.audd.io/', CLIP_SEC = 12, CLIP_RATE = 22050;
const LIMIT = 9 * 1024 * 1024;           // Audd's standard endpoint refuses files over 10 MB
const BIG = 25 * 1024 * 1024;            // above this a full decode would eat too much phone memory
const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }
};
const emit = d => { try { window.dispatchEvent(new CustomEvent('ember-audd', { detail: d })); } catch (e) { /* no listeners */ } };
const getKey = () => String((ls.get(KEY) || {}).token || '');
const hasKey = () => getKey().length >= 8;
function setKey(v) { v = String(v == null ? '' : v).replace(/\s+/g, '').slice(0, 120); if (!v) ls.del(KEY); else ls.set(KEY, { token: v }); emit({ type: 'key' }); return hasKey(); }
const mask = k => (k.length > 10 ? k.slice(0, 4) + '…' + k.slice(-3) : k ? '••••' : '');
const status = () => ({ hasKey: hasKey(), masked: mask(getKey()), busy });
let busy = false;

// ---------- audio -> small WAV clip ----------
function wavOf(f32, rate) {
  const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([b], { type: 'audio/wav' });
}
// A clip from the first third of the song (capped at 30 s in), mono, 22 kHz. Falls back to the raw bytes when the browser cannot decode the file.
async function clipOf(blob) {
  if (!blob) throw new Error('No audio to identify.');
  if (blob.size <= 400 * 1024) return blob;
  const AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (AC && OAC && blob.size <= BIG) {
    let ctx = null;
    try {
      ctx = new AC(); const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const start = Math.min(30, Math.max(0, buf.duration / 3)), len = Math.max(1, Math.min(CLIP_SEC, buf.duration - start));
      const off = new OAC(1, Math.ceil(len * CLIP_RATE), CLIP_RATE), src = off.createBufferSource();
      src.buffer = buf; src.connect(off.destination); src.start(0, start, len);
      const out = await off.startRendering();
      return wavOf(out.getChannelData(0), CLIP_RATE);
    } catch (e) { /* decode failed: use the raw bytes below */ }
    finally { try { if (ctx && ctx.close) ctx.close(); } catch (e) { /* already closed */ } }
  }
  return blob.slice(0, Math.min(blob.size, 4 * 1024 * 1024), blob.type || 'audio/mpeg');
}

// ---------- the request ----------
async function call(fields, file) {
  if (!hasKey()) return { ok: false, error: 'Song identification is off. Paste your Audd.io API token in Settings > Music first.' };
  if (busy) return { ok: false, error: 'Already identifying a song. Wait for that one to finish.' };
  busy = true; emit({ type: 'busy', on: true });
  const c = new AbortController(), h = setTimeout(() => c.abort(), 30000);
  try {
    const fd = new FormData();
    fd.append('api_token', getKey()); fd.append('return', 'deezer,musicbrainz');
    Object.keys(fields || {}).forEach(k => fd.append(k, fields[k]));
    if (file) { if (file.size > LIMIT) return { ok: false, error: 'That clip is over Audd.io\'s 10 MB limit.' }; fd.append('file', file, 'clip.' + (file.type === 'audio/wav' ? 'wav' : 'bin')); }
    let r; try { r = await fetch(API, { method: 'POST', body: fd, signal: c.signal }); } catch (e) { return { ok: false, error: c.signal.aborted ? 'Audd.io took too long to answer.' : 'Could not reach Audd.io. Check the connection.' }; }
    let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
    return shape(j, r.status);
  } finally { clearTimeout(h); busy = false; emit({ type: 'busy', on: false }); }
}
function shape(j, http) {
  if (!j || typeof j !== 'object') return { ok: false, error: 'Audd.io sent back something Ember could not read (HTTP ' + http + ').' };
  if (j.status === 'error' || j.error) {
    const e = j.error || {}, code = e.error_code, msg = String(e.error_message || 'Audd.io refused the request.').slice(0, 200);
    return { ok: false, code, error: [901, 900, 'invalid_token'].includes(code) ? 'Audd.io did not accept the API token (or the free allowance is used up). ' + msg : msg };
  }
  const r = Array.isArray(j.result) ? j.result[0] : j.result;
  if (!r || typeof r !== 'object' || !r.title) return { ok: true, found: false, note: 'Audd.io did not recognise it. A cleaner or longer part of the song sometimes works.' };
  const dz = (r.deezer && r.deezer.album) || {};
  return {
    ok: true, found: true, title: String(r.title || ''), artist: String(r.artist || ''), album: String(r.album || ''), year: String(r.release_date || '').slice(0, 4),
    label: String(r.label || ''), at: String(r.timecode || ''), link: String(r.song_link || ''), art: String(dz.cover_xl || dz.cover_big || '')
  };
}

// ---------- public API ----------
async function identifyBlob(blob) {
  let clip; try { clip = await clipOf(blob); } catch (e) { return { ok: false, error: e.message || 'Could not prepare the audio.' }; }
  return call({}, clip);
}
async function identifyUrl(u) {
  u = String(u || '').trim();
  if (!/^https:\/\/[^\s]{4,500}$/i.test(u)) return { ok: false, error: 'Give a direct https link to an audio file.' };
  return call({ url: u });
}
async function identifyTrack(id) {
  const P = window.EmberPlayer; if (!P) return { ok: false, error: 'The music player did not load.' };
  const t = P.get(id); if (!t) return { ok: false, error: 'No track with that id in the library.' };
  const blob = await P.audioBlob(id); if (!blob) return { ok: false, error: 'The audio for "' + t.title + '" could not be read.' };
  const r = await identifyBlob(blob); if (r) r.for = id; return r;
}
const wipe = () => { ls.del(KEY); emit({ type: 'key' }); };
window.EmberAudd = { hasKey, getKey, setKey, status, identifyBlob, identifyUrl, identifyTrack, wipe, _shape: shape };
})();
