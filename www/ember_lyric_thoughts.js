// Ember V1.9.73 - ember_lyric_thoughts.js: while a song plays, the persona now and then has a passing thought about the line that is playing.
// It shows in the chat as a thought bubble (a cloud with two trailing dots), never as a chat message: it is not saved in the conversation,
// not sent to the AI as history and gone after a restart. The one thing that carries over: for ten minutes the last thought is added to the
// system prompt, so if he answers it ("what did you mean by that?") the AI knows what he is talking about.
// What leaves the phone: the title, artist and ONE lyric line go to the same AI engine that answers chat (util lane), only while the Lyrics switch
// in the Music settings is on, a song is playing, lyrics were found and no chat reply is running.
// Pacing: first thought 30-70 s into a song, then every 80-200 s, at most 5 per song, never while the app is in the background, a panel is open,
// a reply is running, or the chat is in a crisis state (Safety level 3+). A lyric line that trips the safety detector is skipped.
'use strict';
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const MAX_PER_SONG = 5, MAX_PER_CHAT = 12, CONTEXT_MS = 10 * 60 * 1000, TICK_MS = 5000, GEN_TIMEOUT_MS = 14000;

const store = new Map();            // chat id -> [{ anchor, track, line, thought, ts }]
let songKey = '', nextAt = 0, count = 0, used = new Set(), busyGen = false, lastThought = null;

const name = () => { const n = $('pName'); return (n && n.textContent.trim()) || 'Ember'; };
const chat = () => (window.EmberChatState && window.EmberChatState.conv && window.EmberChatState.conv()) || null;

// ---------- rendering ----------
function bubbleHtml(b) {
  return '<div class="lt" role="note" aria-label="' + esc(name()) + ' is thinking about the song">' +
    '<div class="lt-cloud"><span class="lt-ico" aria-hidden="true">💭</span><div class="lt-body">' +
    '<small class="lt-h">' + esc(name()) + ' is thinking · ♪ ' + esc(b.track) + '</small>' +
    '<div class="lt-line">“' + esc(b.line) + '”</div><div class="lt-t">' + esc(b.thought) + '</div></div></div>' +
    '<i class="lt-d1"></i><i class="lt-d2"></i></div>';
}
// called by renderLog after message i, so a re-render keeps each bubble where it was
function after(convId, i) { const a = store.get(convId); return a ? a.filter(b => b.anchor === i).map(bubbleHtml).join('') : ''; }

function show(c, b) {
  const log = $('log'); if (!log) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 140; // only follow the chat down if he is already at the bottom
  log.insertAdjacentHTML('beforeend', bubbleHtml(b));
  if (near) log.scrollTop = log.scrollHeight;
}

// ---------- the thought ----------
function sysPrompt() {
  return 'You are ' + name() + ', a sharp, warm companion who loves music. A song is playing on his phone right now. You are having a private, passing thought about the lyric line below. It is an inner thought, NOT a message to him.\n' +
    'Rules: ONE sentence, 22 words at most. First person, casual, specific to that line and the mood of the song. Do not repeat the lyric back, do not quote any other lyric, no emojis, no questions, no hashtags, never mention being an AI. Reply with only the thought.';
}
function tidyThought(t) {
  t = String(t || '').replace(/^[\s"“”'`*_>-]+|[\s"“”'`*_]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!t || /\b(as an ai|language model|i cannot|i can't help)\b/i.test(t)) return '';
  const s = t.split(/(?<=[.!?…])\s+/)[0] || t;                 // one sentence only
  return clip(s, 170);
}
async function think(track, line) {
  const P = window.Prov; if (!P || !P.run) return '';
  const call = P.run('util', { system: sysPrompt(), messages: [{ role: 'user', content: 'Song: "' + track + '"\nLine: "' + line + '"' }], temp: 0.9, max: 90 });
  const r = await Promise.race([call, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), GEN_TIMEOUT_MS))]);
  return tidyThought(r && r.text);
}

// ---------- picking the line ----------
function pickLine(rec, pos) {
  const L = window.EmberLyrics; if (!L || !rec || rec.state !== 'ok' || rec.instrumental) return '';
  let cand = [];
  if (rec.synced && rec.synced.length) { const p = L.preview(rec, pos); if (p && p[0]) cand = [p[0]]; }
  else cand = (rec.plain || []).filter(x => x.length >= 12 && x.length <= 140);
  cand = cand.filter(x => !used.has(x.toLowerCase()));
  if (!cand.length) return '';
  const line = clip(cand[Math.floor(Math.random() * cand.length)], 140);
  return line.length >= 6 ? line : '';
}

// ---------- the scheduler ----------
function panelOpen() { return !!document.querySelector('#drawer.show, .sheet.show, #dlg.show'); }
function calm() {
  if (document.hidden || panelOpen()) return false;
  if (window.Safety && window.Safety.lastLevel && window.Safety.lastLevel() >= 3) return false;
  if (window.Prov && window.Prov.pending && window.Prov.pending()) return false;      // a chat reply is running
  const st = window.EmberChatState; if (st && st.busy && st.busy()) return false;
  return true;
}
async function tick() {
  if (busyGen) return;
  const P = window.EmberPlayer, L = window.EmberLyrics; if (!P || !L || !L.isOn()) return;
  let snap; try { snap = P.snapshot(); } catch (e) { return; }
  const t = snap && snap.track;
  if (!t || !snap.playing) return;
  const k = (t.id || '') + '|' + (t.title || '') + '|' + (t.artist || '');
  if (k !== songKey) { songKey = k; count = 0; used = new Set(); nextAt = Date.now() + rnd(30000, 70000); return; }
  if (Date.now() < nextAt || count >= MAX_PER_SONG) return;
  const c = chat(); if (!c || !c.msgs || !c.msgs.length || !calm()) return;
  if ((store.get(c.id) || []).length >= MAX_PER_CHAT) return;
  busyGen = true;
  try {
    const rec = await L.get(t);
    if (k !== songKey) return;                                                         // the song changed while the lyrics loaded
    const line = pickLine(rec, snap.positionSec || 0);
    if (!line) { nextAt = Date.now() + 60000; return; }
    used.add(line.toLowerCase());
    if (window.Safety && window.Safety.detect && window.Safety.detect(line).level > 0) { nextAt = Date.now() + 30000; return; } // heavy lyric: stay quiet
    const track = clip((t.artist ? t.artist + ' – ' : '') + t.title, 70);
    const thought = await think(clip(t.title, 80) + (t.artist ? ' by ' + clip(t.artist, 60) : ''), line);
    // the world may have moved while the model answered: re-check before anything is shown
    const snap2 = P.snapshot(); const c2 = chat();
    if (!thought || k !== songKey || !snap2.playing || !c2 || c2.id !== c.id || !calm()) { nextAt = Date.now() + 45000; return; }
    const b = { anchor: c2.msgs.length - 1, track, line, thought, ts: Date.now() };
    const arr = store.get(c2.id) || []; arr.push(b); store.set(c2.id, arr.slice(-MAX_PER_CHAT));
    lastThought = { convId: c2.id, track, line, thought, ts: b.ts };
    count++; nextAt = Date.now() + rnd(80000, 200000);
    show(c2, b);
  } catch (e) { nextAt = Date.now() + 90000; }                                         // offline, rate limited or timed out: try again later, silently
  finally { busyGen = false; }
}

// ---------- context for the AI ----------
// The last thought, for ten minutes, in the chat it appeared in. Lets him reply to it.
function contextBlock() {
  const c = chat(), t = lastThought; if (!c || !t || t.convId !== c.id || Date.now() - t.ts > CONTEXT_MS) return '';
  const safe = s => String(s || '').replace(/[<>]/g, '');
  return '<music_thought>While "' + safe(t.track) + '" was playing you had this passing thought about the line "' + safe(t.line) + '": ' + safe(t.thought) + ' It showed in the chat as a thought bubble. If he refers to it, you know what it was. Do not bring it up yourself.</music_thought>';
}

function start() { setInterval(() => { tick().catch(() => { /* never break the app for a bubble */ }); }, TICK_MS); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

window.EmberLyricThoughts = { after, contextBlock, _tidy: tidyThought, _pick: pickLine };
})();
