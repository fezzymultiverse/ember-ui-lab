// Ember V1.9.10 - ember_lyrics.js: a three-line lyrics preview under the now-playing card, from LRCLIB (free, no key).
// Shows at most 3 lines. With timed lyrics the preview follows the song (current line first); with plain lyrics it shows the opening lines.
// The full text is only held in memory for the song that is playing (last 12 songs), never saved to storage, never sent anywhere.
// What is sent to lrclib.net: the song title, artist, album and length of the track that is playing, only while the switch is on.
'use strict';
(() => {
const ON = 'ember_lyrics_on', MAX_LINES = 3, MEM = new Map();
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isOn = () => { try { return localStorage.getItem(ON) !== '0'; } catch (e) { return true; } };

const tidy = s => String(s || '').replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyrics?|visualizer|remaster|hd|hq|4k|live|explicit|feat\.?|ft\.?)[^\)\]]*[\)\]]/gi, '').replace(/\s*-\s*topic$/i, '').replace(/\s+/g, ' ').trim();
const key = t => (tidy(t.artist) + '|' + tidy(t.title)).toLowerCase();

function parseLrc(s) {
  const out = [];
  String(s || '').split(/\r?\n/).forEach(l => {
    const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g, tags = []; let m, last = 0;
    while ((m = re.exec(l))) { tags.push(+m[1] * 60 + +m[2]); last = re.lastIndex; }
    if (!tags.length) return;
    const txt = l.slice(last).trim(); tags.forEach(t => out.push({ t, s: txt }));
  });
  return out.sort((a, b) => a.t - b.t);
}
const plainLines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(x => x && !/^\[[^\]]*\]$/.test(x));

async function http(path, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 8000), url = 'https://lrclib.net/api/' + path;
  try {
    try { const r = await fetch(url, { signal: ac.signal }); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) {
      if (e && e.name === 'AbortError') throw e;
      const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp; if (!H || !H.request) throw e;
      const r = await H.request({ url, method: 'GET', connectTimeout: ms || 8000, readTimeout: ms || 8000 });
      if (r.status === 404) return null; if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
      return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    }
  } finally { clearTimeout(tm); }
}
const qs = o => Object.keys(o).filter(k => o[k] !== '' && o[k] != null).map(k => k + '=' + encodeURIComponent(o[k])).join('&');
const pick = (list, dur) => {
  const a = (Array.isArray(list) ? list : []).filter(x => x && (x.syncedLyrics || x.plainLyrics || x.instrumental));
  if (!a.length) return null;
  const score = x => (x.syncedLyrics ? 0 : 10) + (dur && x.duration ? Math.min(9, Math.abs(x.duration - dur)) : 5);
  return a.slice().sort((x, y) => score(x) - score(y))[0];
};
const shape = r => r ? ({ state: 'ok', instrumental: !!r.instrumental && !r.syncedLyrics && !r.plainLyrics, synced: parseLrc(r.syncedLyrics), plain: plainLines(r.plainLyrics) }) : { state: 'none' };

// one lookup per song. Returns { state: 'ok' | 'none' | 'err', synced, plain, instrumental }
async function get(t) {
  if (!t || !t.title) return { state: 'none' };
  const k = key(t); if (MEM.has(k)) return MEM.get(k);
  const title = tidy(t.title), artist = tidy(t.artist), dur = Math.round(t.durationSec || (t.durationMs ? t.durationMs / 1000 : 0) || 0);
  let res;
  try {
    let r = null;
    if (artist && dur) r = await http('get?' + qs({ artist_name: artist, track_name: title, album_name: t.album || '', duration: dur }));
    if (!r || !(r.syncedLyrics || r.plainLyrics || r.instrumental)) r = pick(await http('search?' + (artist ? qs({ track_name: title, artist_name: artist }) : qs({ q: title }))), dur);
    res = shape(r);
  } catch (e) { return { state: 'err' }; } // a failed lookup is not remembered, so the next play tries again
  MEM.set(k, res); if (MEM.size > 12) MEM.delete(MEM.keys().next().value);
  return res;
}

// the (up to 3) lines to show for a position in seconds
function preview(rec, pos) {
  if (!rec || rec.state !== 'ok') return [];
  if (rec.instrumental) return ['♪ Instrumental'];
  if (rec.synced.length) {
    const L = rec.synced; let i = -1; for (let j = 0; j < L.length; j++) { if (L[j].t <= pos + 0.25) i = j; else break; }
    if (i < 0) i = 0;
    const out = []; for (let j = i; j < L.length && out.length < MAX_LINES; j++) if (L[j].s) out.push(L[j].s);
    return out;
  }
  return rec.plain.slice(0, MAX_LINES);
}

let shownKey = '', token = 0, rec = null, lastHtml = '';
function render(lines, state, synced) {
  const box = $('npLyr'), body = $('npLyrBody'); if (!box || !body) return;
  if (!isOn() || state === 'hide') { box.classList.add('hidden'); lastHtml = ''; return; }
  box.classList.remove('hidden');
  const html = state === 'loading' ? '<p class="hint">Looking for lyrics…</p>'
    : state === 'err' ? '<p class="hint">Could not reach the lyrics service' + (navigator.onLine === false ? ' (you are offline)' : '') + '.</p>'
    : !lines.length ? '<p class="hint">No lyrics found for this one.</p>'
    : lines.map((l, n) => '<div class="ly' + (synced && n === 0 ? ' now' : '') + '">' + esc(l) + '</div>').join('');
  if (html !== lastHtml) { body.innerHTML = html; lastHtml = html; }
  const t = $('npTitle'); if (t) t.title = lines.length ? lines.join('\n') : '';
}
// called by the music panel on every paint and once a second while playing
function paint(np, pos) {
  const t = np && np.track;
  if (!isOn() || !t) { shownKey = ''; rec = null; render([], 'hide'); return; }
  const k = np.source + '|' + (t.id || '') + '|' + key(t);
  if (k !== shownKey) {
    shownKey = k; rec = null; render([], 'loading'); const my = ++token;
    get(t).then(r => { if (my !== token) return; rec = r; show(pos == null ? (np.positionSec || 0) : pos); });
    return;
  }
  if (rec) show(pos == null ? (np.positionSec || 0) : pos);
}
function show(pos) {
  if (!rec) return;
  if (rec.state === 'err') { render([], 'err'); return; }
  render(preview(rec, pos), rec.state, !!(rec.synced && rec.synced.length));
}

function bindUI() {
  const sw = $('swLyr'); if (!sw) return;
  sw.classList.toggle('on', isOn());
  sw.onclick = () => { const v = !isOn(); try { localStorage.setItem(ON, v ? '1' : '0'); } catch (e) { } sw.classList.toggle('on', v); shownKey = ''; if (!v) render([], 'hide'); else if (window.EmberMusicUI && window.EmberMusicUI.refresh) window.EmberMusicUI.refresh(); };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI); else bindUI();

window.EmberLyrics = { paint, get, preview, parseLrc, plainLines, tidy, isOn };
})();
