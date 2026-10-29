// Ember Add-On: 999 Philosophy + Music/Lyrics panel (www/nine_nine.js)
// Load order: after ai_music.js, before persona.js. Add to index.html <script> list and sw.js cache list.
'use strict';
(() => {

// Paste your own curated quotes here yourself — not shipped with lyrics (copyright).
// { text: '...', from: '...' }
const QUOTES = [];

function pickQuote() {
  if (!QUOTES.length) return null;
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

const SYS = "999 PHILOSOPHY: he draws strength from Juice WRLD's outlook — take whatever hell you're going through and flip it into 999: something that outlasts the pain and actually means something. When he is frustrated or stuck (never in crisis), name what he is pushing through, then point at the thing he is building as proof it is not wasted. Never quote song lyrics verbatim — speak in your own words. A line or two, then back to the actual fix.";

const LUCID_SYS = 'LUCID DREAMS MODE IS ACTIVE: drop the dry/terse default. More poetic, more feeling — still honest, still useful. Lean on the 999 philosophy more than usual. Never softens HARD RULE 10 (crisis) and never makes you vaguer about an actual bug.';


// ---------- playlist ----------
async function playPlaylist() {
  try {
    const P = window.EmberPlayer;
    if (!P) return { ok: false, error: 'The music player did not load. Reload the app.' };
    const r = await P.playPlaylist('999');
    if (r && r.ok) return r;
    return { ok: false, error: (r && r.error) || 'Could not play.', note: 'Make a playlist named 999 in the Music panel (Library, Save as playlist) and it plays from here.' };
  } catch (e) { return { error: e.message || 'Playback failed.' }; }
}

// ---------- LRC sync (new — no parser existed in this codebase) ----------
function parseLRC(text) {
  const lines = [];
  String(text || '').split('\n').forEach(l => {
    const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) lines.push({ t: (+m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() });
  });
  return lines.sort((a, b) => a.t - b.t);
}
function currentLine(lrc, posSec) {
  let cur = '';
  for (const l of lrc) { if (l.t <= posSec) cur = l.text; else break; }
  return cur;
}

// ---------- panel render ----------
function renderQuote() {
  const el = document.getElementById('nineQuote');
  if (!el) return;
  const q = pickQuote();
  el.textContent = q ? ('"' + q.text + '"' + (q.from ? ' — ' + q.from : '')) : 'Add your own quotes in nine_nine.js (QUOTES array).';
}

let lyricTimer = null;
function startLyricSync(lrcText) {
  stopLyricSync();
  const lrc = parseLRC(lrcText);
  const el = document.getElementById('nineLyrics');
  if (!el || !lrc.length) return;
  lyricTimer = setInterval(() => {
    if (!window.EmberPlayer) return;
    el.textContent = currentLine(lrc, window.EmberPlayer.position()) || '…';
  }, 500);
}
function stopLyricSync() { if (lyricTimer) { clearInterval(lyricTimer); lyricTimer = null; } }

window.NineNine = { QUOTES, pickQuote, SYS, LUCID_SYS, playPlaylist, parseLRC, currentLine, renderQuote, startLyricSync, stopLyricSync };
})();
