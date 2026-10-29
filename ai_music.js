// Ember V1.7.0 - ai_music.js: what the AI is allowed to do with music, and the code that enforces it.
// Everything here runs on the real player (ember_player.js) and, for naming a song, real Audd.io (ember_audd.js). No stubs, no "bridge", no simulated results.
// The AI gets exactly the tools below, told exactly what is true right now, and the code refuses anything he did not ask for.
'use strict';
(() => {
const P = () => window.EmberPlayer, AU = () => window.EmberAudd;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 120);

// ---------- tool schemas (the AI only ever sees these) ----------
const LOCAL_TOOLS = [
  { name: 'get_current_track', description: 'What is playing right now: title, artist, album, year, genre, artworkUrl, an "about" text (artist bio, song and album background from Deezer and MusicBrainz), source (ember), playing or paused, position. Use it whenever he asks what is playing, or wants to talk about the song or the artist. Base what you say on this data and say so when a field is empty.', parameters: {} },
  { name: 'get_library', description: 'Searches his uploaded music. query matches title or artist (optional), limit defaults to 20. Returns song ids to use with control_player or create_playlist.', parameters: { query: 'string?', limit: 'number?' } },
  { name: 'control_player', description: 'Controls playback. action: play | pause | toggle | next | prev | stop | seek | volume | shuffle | repeat. "play" with songId plays that library song, "play" alone resumes. seek needs value in seconds, volume needs value 0-100.', parameters: { action: 'string', songId: 'string?', value: 'number?' } },
  { name: 'play_playlist', description: 'Plays one of his local playlists by name.', parameters: { name: 'string' } },
  { name: 'create_playlist', description: 'Saves a local playlist from library song ids (from get_library).', parameters: { name: 'string', song_ids: 'string[]' } }
];
const AUDD_TOOLS = [
  { name: 'identify_song', description: 'Names a song with Audd.io audio fingerprinting. With no arguments it identifies the song playing in Ember\'s player (a clip of about 12 seconds is sent to Audd.io). With url it identifies a direct https audio link he gave. It only reports what was found: title, artist, album, year, label. It never changes the library; he applies a result himself in the Music panel. Use it when he asks what a song is, or a library track has no real title or artist.', parameters: { url: 'string?' } }
];

// ---------- the hard gate: no music tool runs unless his latest message is about music ----------
const NOUNS = 'music|song|songs|track|tracks|tune|tunes|playlist|playlists|album|artist|identify|shazam|what song|which song|name this|play|playing|put on|listen|listening|lyrics|library|queue|what\'?s this|what is this|who sings|who is this';
const VERBS = 'skip|next (?:song|track|one|tune)|prev(?:ious)? (?:song|track|one)|last (?:song|track|one)|go back a (?:song|track)|rewind|replay|pause|resume|unpause|stop (?:the |this |that )?(?:music|song|track|playing|it)|turn (?:it |the music |this |that |the volume )?(?:up|down|off)|louder|quieter|volume|mute|unmute|shuffle|repeat|loop';
const INTENT = new RegExp('\\b(?:' + NOUNS + '|' + VERBS + ')\\b', 'i');
// Patterns that look like a question about Claude/the day — not a music follow-up even when short.
const NOT_FOLLOW = /\b(how (are|is|was|do|did|have)|how'?s (your|it going)|what do you think|tell me (a joke|something)|your day|you doing|you been)\b/i;
let intent = null, prevIntent = '', free = false;
// V1.6.8: with the "small freedoms" switch on, a few low-impact moves (next/prev, volume, shuffle, play a library song or playlist, reading what is playing) need no music request. Pause and stop never do.
const FREE_OK = (name, a) => name === 'get_current_track' || name === 'get_library' || name === 'play_playlist' || (name === 'control_player' && (['next', 'prev', 'volume', 'shuffle'].includes(String((a && a.action) || '').toLowerCase()) || (String((a && a.action) || '').toLowerCase() === 'play' && !!(a && a.songId))));
// His latest message must be about music. A short follow-up ("the second one", "yes") also counts when his
// message before it was about music — but only if the current message doesn't look like a clearly unrelated question.
function setIntent(userText, prevText) { intent = String(userText == null ? '' : userText).slice(0, 2000); prevIntent = String(prevText == null ? '' : prevText).slice(0, 2000); }
const allowed = () => intent !== null && (INTENT.test(intent) || (intent.length <= 60 && !NOT_FOLLOW.test(intent) && INTENT.test(prevIntent)));

// ---------- visible record of everything the AI did to the player ----------
const LOG = [];
function note(text) {
  LOG.unshift({ t: Date.now(), text }); if (LOG.length > 15) LOG.pop();
  try { window.dispatchEvent(new CustomEvent('ember-music-ai', { detail: text })); } catch (e) { /* no listeners */ }
}

// ---------- helpers ----------
function summarize(np) {
  if (!np || !np.track) return { playing: false, track: null };
  return { source: 'ember', playing: !!np.playing, title: np.track.title, artist: np.track.artist, album: np.track.album, positionSec: np.positionSec || 0, durationSec: np.track.durationSec || 0, volume: np.volume == null ? undefined : np.volume };
}
async function nowAfter() {
  await sleep(80);
  try { return summarize(await P().nowPlaying()); } catch (e) { return undefined; }
}
const noPlayer = () => P() ? null : { error: 'The music player did not load. Reload the app.' };
const needAu = () => (AU() && AU().hasKey()) ? null : { error: 'Song identification is off. He pastes his Audd.io API token in Settings > Music to turn it on.' };

// ---------- handlers ----------
async function get_current_track() {
  const np = await P().nowPlaying(), s = summarize(np), cap = P().capabilities();
  if (np && np.error && !s.title) return { playing: false, track: null, note: np.error };
  if (!s.title) return { playing: false, track: null, note: 'Nothing is playing in Ember. Music playing in other apps cannot be seen.' };
  try {
    const m = await Promise.race([P().meta(np.track, np.source), sleep(9000).then(() => null)]);
    if (m) {
      s.album = s.album || m.album || undefined; s.artist = s.artist || m.artist || undefined;
      if (m.year) s.year = m.year; if (m.genre) s.genre = m.genre;
      const http = /^https?:/.test(m.art || '');
      s.artworkUrl = http ? m.art : undefined; if (m.art && !http) s.artwork = 'embedded in the file (shown in the player, no link)';
      const about = [m.aboutSong && 'SONG: ' + m.aboutSong, m.aboutAlbum && 'ALBUM: ' + m.aboutAlbum, m.aboutArtist && 'ARTIST: ' + m.aboutArtist].filter(Boolean).join('\n');
      s.about = about ? str(about, 1600) : undefined;
      if (!about) s.note = 'No bio or song background was found online. Say so instead of guessing details.';
    } else s.note = 'Extra details (artwork, bio) are still loading or offline. Use only what is here.';
  } catch (e) { /* metadata is a bonus */ }
  return s;
}
async function get_library(a) {
  const lim = Math.max(1, Math.min(+a.limit || 20, 50)), q = str(a.query, 80), all = P().list(q);
  if (!P().count()) return { tracks: [], total: 0, note: 'The library is empty. He adds music with Upload in the Music panel.' };
  return { tracks: all.slice(0, lim).map(P().brief), total: all.length, note: all.length ? undefined : 'No match for "' + q + '".' };
}
async function control_player(a) {
  const VALID = ['play', 'pause', 'toggle', 'next', 'prev', 'stop', 'seek', 'volume', 'shuffle', 'repeat'];
  const action = str(a.action, 20).toLowerCase();
  if (!VALID.includes(action)) return { error: 'Unknown action: ' + action + '. Allowed: ' + VALID.join(', ') + '.' };
  if ((action === 'seek' || action === 'volume') && !isFinite(parseFloat(a.value))) return { error: action + ' needs a number in value.' };
  const o = { value: (action === 'shuffle' || action === 'repeat') ? (a.value == null ? undefined : !!a.value) : parseFloat(a.value) };
  if (action === 'play' && a.songId) o.songId = str(a.songId, 60);
  const r = await P().control(action, o);
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'The player did not do that.' };
  note('Ember: ' + action + (o.songId ? ' (' + ((P().get(o.songId) || {}).title || o.songId) + ')' : '') + (o.value != null && action !== 'play' ? ' ' + o.value : ''));
  const out = { ok: true, action };
  if (['play', 'next', 'prev', 'toggle'].includes(action)) out.now = await nowAfter();
  return out;
}
async function play_playlist(a) {
  const r = await P().playPlaylist(str(a.name, 40));
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Could not play that playlist.' };
  note('Ember: playing playlist "' + str(a.name, 40) + '"'); return { ok: true, now: await nowAfter() };
}
async function create_playlist(a) {
  const ids = Array.isArray(a.song_ids) ? a.song_ids.slice(0, 200).map(x => str(x, 60)) : [];
  const r = P().savePlaylist(str(a.name, 40), ids);
  if (r.error) return { ok: false, error: r.error };
  note('Ember: saved playlist "' + r.name + '" (' + r.count + ' songs)'); return r;
}
async function identify_song(a) {
  const e = needAu(); if (e) return e;
  const url = str(a.url, 500);
  let r;
  if (url) r = await AU().identifyUrl(url);
  else {
    const snap = P().snapshot(), t = snap && snap.track;
    if (!t || !t.id) return { ok: false, error: 'Nothing is loaded in Ember\'s player to identify. Play a song first, or give a direct audio link.' };
    r = await AU().identifyTrack(t.id);
  }
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Identification failed.' };
  note('Ember: identified a song with Audd.io' + (r.found ? ' (' + r.title + ')' : ' (no match)'));
  if (!r.found) return { ok: true, found: false, note: r.note };
  return { ok: true, found: true, title: r.title, artist: r.artist, album: r.album || undefined, year: r.year || undefined, label: r.label || undefined, note: 'From Audd.io audio fingerprinting. It gives no confidence score, so say it is the best match. Nothing in the library was changed.' };
}

const HANDLERS = { get_current_track, get_library, control_player, play_playlist, create_playlist, identify_song };
async function dispatch(name, args) {
  if (!Object.prototype.hasOwnProperty.call(HANDLERS, name)) return { error: 'Unknown music tool: ' + name };
  if (!allowed() && !(free && FREE_OK(name, args))) return { error: 'He did not ask about music in his latest message, so nothing was touched. Do not use music tools unless he asks.' };
  const e = noPlayer(); if (e) return e;
  if (AUDD_TOOLS.some(t => t.name === name) && !(AU() && AU().hasKey())) return needAu();
  try { return await HANDLERS[name](args && typeof args === 'object' ? args : {}); }
  catch (err) { return { error: (err && err.message) || 'Music tool failed.' }; }
}

// ---------- what the prompt tells the AI (built from the real state, every time) ----------
function stateBlock() {
  const p = P(); if (!p) return '';
  const c = p.capabilities(), pl = c.playlists.map(x => x.name + ' (' + x.count + ')').join(', ') || 'none';
  return 'MUSIC STATE (live, this is true right now): his library has ' + c.library + ' uploaded track' + (c.library === 1 ? '' : 's') + '; local playlists: ' + pl + '; song identification (Audd.io) ' + (c.audd ? 'is on' : 'is OFF') + '.\n' +
    'YOU CAN: ' + c.can.join('; ') + '.\n' +
    'YOU CANNOT: ' + c.cannot.join('; ') + '.\n' +
    nowLine() + (free ? 'SMALL FREEDOMS ARE ON: he lets you make small moves on your own when it fits the moment (skip a song that clashes with the mood, nudge the volume, put on another song from his library). One move at a time, say what you did in a few words, never pause or stop his music unasked. ' : '') +
    'MUSIC RULES: ' + (free ? 'beyond those small freedoms, ' : '') + 'you only touch the player when his latest message asks for it. You may always remark on what is playing (one short line, a real reaction, not a recital) when it fits. ' + (free ? '' : 'Never start, stop, skip, change the volume or make a playlist on his own, not to match a mood, not as a surprise.') + ' Never stop, pause or make a playlist unasked. If he asks for something not in YOU CAN, say plainly that you cannot and what he could do instead. If a tool result says something is missing (empty library, song identification off), tell him in one line what to do. Never mention bridges, Prodigy or other apps. When he tells you to look something up or scrape something online (lyrics, an artist, a release, a song id), do exactly that with the web tools if they are on.';
}

function nowLine() {
  try { const s = P().snapshot(), t = s && s.track; if (t && t.title) return 'NOW PLAYING (live): "' + t.title + '"' + (t.artist ? ' by ' + t.artist : '') + ' (' + (s.playing ? 'playing' : 'paused') + '). Notice it: react to it now and then the way a friend in the room would.\n'; } catch (e) { /* player not ready */ }
  return '';
}
const setFree = v => { free = !!v; };
const addon = { setFree, dispatch, setIntent, stateBlock, log: () => LOG.slice(), INTENT_TEST: t => INTENT.test(String(t || '')) };
Object.defineProperty(addon, 'TOOLS', { enumerable: true, get: () => LOCAL_TOOLS.concat(AU() && AU().hasKey() ? AUDD_TOOLS : []) });
window.EmberMusicAddon = addon;
})();
