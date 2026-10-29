// Ember V1.10.12 - ember_apis.js: small free APIs Ember can call from chat.
// No key: ipify (public IP), LanguageTool (grammar). Own key: Unsplash (photos), WhoisJSON (domain whois), WordsAPI via RapidAPI (word info).
// ChartLyrics (lyrics, no key) is written from memory of its public endpoint and NOT verified live.
// Everything is OFF until the master switch in "+" > Free APIs is turned on. Keys stay in this app's storage; key values are never shown to the AI.
'use strict';
(() => {
const W = window, D = document, STORE = 'ember_apis';
const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const cfg = () => { const c = ls.get(STORE) || {}; return { on: c.on === true, keys: (c.keys && typeof c.keys === 'object') ? c.keys : {} }; };
const save = c => ls.set(STORE, c);
const enabled = () => cfg().on;
const cleanKey = v => String(v == null ? '' : v).replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, '').replace(/^(authorization\s*:\s*)?token\s*=\s*/i, '').replace(/^[\s"'`<([]+|[\s"'`>)\],;]+$/g, '').replace(/\s+/g, '').slice(0, 200);
const getKey = id => String(cfg().keys[id] || '');
const hasKey = id => getKey(id).length >= 8;
function setKey(id, v) { const c = cfg(), k = cleanKey(v); if (k) c.keys[id] = k; else delete c.keys[id]; save(c); return hasKey(id); }
function setOn(v) { const c = cfg(); c.on = !!v; save(c); try { W.dispatchEvent(new CustomEvent('ember-apis-change')); } catch (e) { /* listeners optional */ } }
const need = (id, label) => { if (!hasKey(id)) throw new Error(label + ' needs a key. Add it in + > Free APIs.'); return getKey(id); };

// ---------- http ----------
async function http(url, opt, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 20000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctl.signal }, opt || {}));
    const txt = await r.text();
    if (!r.ok) {
      let m = ''; try { const j = JSON.parse(txt); m = j.message || j.error || (j.errors && [].concat(j.errors).join('; ')) || ''; } catch (e) { /* not json */ }
      const er = new Error(String(m || ('HTTP ' + r.status)).slice(0, 200)); er.status = r.status; throw er;
    }
    return txt;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('The service took too long to answer.');
    throw e;
  } finally { clearTimeout(t); }
}
async function jget(url, opt, ms) { const t = await http(url, opt, ms); try { return JSON.parse(t); } catch (e) { throw new Error('The service did not return JSON.'); } }
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

// ---------- services ----------
async function ip() {
  const j = await jget('https://api64.ipify.org?format=json');
  if (!j || !j.ip) throw new Error('ipify returned no address.');
  return { ip: j.ip, note: 'This is the public address the internet sees for this phone right now (a VPN or the mobile carrier address if one is active).' };
}

async function grammar(text, lang) {
  text = clip(text, 18000); if (!text.trim()) throw new Error('Give me some text to check.');
  const body = new URLSearchParams({ text, language: String(lang || 'auto').slice(0, 12) });
  const j = await jget('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString() }, 30000);
  const all = (j.matches || []).slice(0, 60);
  const matches = all.slice(0, 40).map(m => ({ message: clip(m.message, 160), rule: m.rule && m.rule.id, found: text.substr(m.offset, m.length), offset: m.offset, length: m.length, suggestions: (m.replacements || []).slice(0, 3).map(r => r.value) }));
  // apply the first suggestion of each match from the end of the text backwards, skipping overlaps
  let fixed = text, limit = Infinity;
  all.slice().sort((a, b) => b.offset - a.offset).forEach(m => {
    const r = m.replacements && m.replacements[0]; if (!r || m.offset + m.length > limit) return;
    fixed = fixed.slice(0, m.offset) + r.value + fixed.slice(m.offset + m.length); limit = m.offset;
  });
  const lang2 = j.language && ((j.language.detectedLanguage && j.language.detectedLanguage.name) || j.language.name);
  return { language: lang2 || 'unknown', issues: all.length, matches, corrected: fixed !== text ? fixed : undefined, note: 'Checked by the public LanguageTool service (the text was sent to it). Suggestions are automatic: read them before accepting.' };
}

async function photos(query, count) {
  const key = need('unsplash', 'Unsplash'); query = clip(query, 120).trim(); if (!query) throw new Error('Say what photo to search for.');
  const n = Math.max(1, Math.min(10, Number(count) || 5));
  const j = await jget('https://api.unsplash.com/search/photos?' + new URLSearchParams({ query, per_page: String(n), content_filter: 'high' }), { headers: { Authorization: 'Client-ID ' + key, 'Accept-Version': 'v1' } });
  return {
    total: j.total, photos: (j.results || []).map(p => ({ description: clip(p.description || p.alt_description, 140), photographer: p.user && p.user.name, photographer_page: p.user && p.user.links && p.user.links.html, page: p.links && p.links.html, small: p.urls && p.urls.small, regular: p.urls && p.urls.regular })),
    note: 'Credit the photographer and Unsplash when you show these. A demo key allows about 50 requests an hour.'
  };
}

async function whois(domain) {
  const key = need('whoisjson', 'WhoisJSON');
  const d = clip(domain, 253).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new Error('That does not look like a domain name.');
  const j = await jget('https://whoisjson.com/api/v1/whois?domain=' + encodeURIComponent(d), { headers: { Authorization: 'TOKEN=' + key } });
  const s = JSON.stringify(j);
  return s.length <= 4000 ? { domain: d, whois: j } : { domain: d, truncated: true, whois: s.slice(0, 4000) };
}

async function word(w) {
  const key = need('wordsapi', 'WordsAPI'); w = clip(w, 40).trim().toLowerCase();
  if (!/^[a-z][a-z' -]*$/.test(w)) throw new Error('Give me one English word.');
  const j = await jget('https://wordsapiv1.p.rapidapi.com/words/' + encodeURIComponent(w), { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com' } });
  const lst = a => Array.isArray(a) ? a.slice(0, 8) : undefined;
  return {
    word: j.word, pronunciation: j.pronunciation, syllables: j.syllables && j.syllables.list,
    senses: (j.results || []).slice(0, 8).map(r => ({ definition: r.definition, partOfSpeech: r.partOfSpeech, synonyms: lst(r.synonyms), antonyms: lst(r.antonyms), typeOf: lst(r.typeOf), examples: Array.isArray(r.examples) ? r.examples.slice(0, 2) : undefined }))
  };
}

// ChartLyrics: endpoint written from memory, not checked live. It is plain http; the app allows cleartext.
async function lyrics(artist, song) {
  artist = clip(artist, 100).trim(); song = clip(song, 100).trim(); if (!artist || !song) throw new Error('I need both the artist and the song title.');
  const t = await http('http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?' + new URLSearchParams({ artist, song }), {}, 25000);
  const x = new DOMParser().parseFromString(t, 'text/xml'); const g = n => { const e = x.getElementsByTagName(n)[0]; return e ? String(e.textContent || '').trim() : ''; };
  const text = g('Lyric'); if (!text) throw new Error('ChartLyrics has no lyrics for that artist and song.');
  return { artist: g('LyricArtist') || artist, song: g('LyricSong') || song, source: g('LyricUrl') || 'chartlyrics.com', lyrics: text.slice(0, 4000), truncated: text.length > 4000 };
}

// ---------- agent tools ----------
const TOOL_DEFS = [
  { id: null, name: 'get_public_ip', description: 'Returns this phone\'s public IP address (ipify). Use when he asks what his IP is.', parameters: {} },
  { id: null, name: 'check_grammar', description: 'Checks spelling and grammar of text he gave you with LanguageTool (the text is sent to that public service). Returns issues, suggestions and a corrected version. language is optional (en-US, de-DE ... default auto).', parameters: { text: 'string', language: 'string?' } },
  { id: 'unsplash', name: 'search_photos', description: 'Searches Unsplash for free photos. Returns links, photographer names and pages. Always credit the photographer and Unsplash.', parameters: { query: 'string', count: 'number?' } },
  { id: 'whoisjson', name: 'get_whois', description: 'Looks up domain registration (whois) data for a domain he names, through WhoisJSON.', parameters: { domain: 'string' } },
  { id: 'wordsapi', name: 'get_word_info', description: 'Looks up one English word: definitions, part of speech, synonyms, antonyms, examples (WordsAPI).', parameters: { word: 'string' } },
  { id: null, name: 'get_lyrics', description: 'Fetches song lyrics from ChartLyrics for an artist and song he names. Do not paste the whole lyric back: quote a few lines at most, summarise the rest and say where it came from. Not verified live, so report any failure exactly.', parameters: { artist: 'string', song: 'string' } }
];
const tools = () => !enabled() ? [] : TOOL_DEFS.filter(t => !t.id || hasKey(t.id)).map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
const handlers = {
  get_public_ip: () => ip(),
  check_grammar: a => grammar(a.text, a.language),
  search_photos: a => photos(a.query, a.count),
  get_whois: a => whois(a.domain),
  get_word_info: a => word(a.word),
  get_lyrics: a => lyrics(a.artist, a.song)
};
const promptLine = () => 'FREE API TOOLS ON: ' + tools().map(t => t.name).join(', ') + '. They call small public services; say which one answered and report any failure exactly. Never invent results. Missing keys are added by him in + > Free APIs.';

// ---------- key map entries (names and status only) ----------
function inventory() {
  const row = (id, name, kind, use) => ({ id, name, kind, saved: hasKey(id) ? 1 : 0, usable: hasKey(id) ? 1 : 0, use, where: '+ > Free APIs' });
  return [
    row('unsplash', 'Unsplash', 'free photos', 'search_photos tool. Needs the master switch in + > Free APIs.'),
    row('whoisjson', 'WhoisJSON', 'domain whois', 'get_whois tool. Needs the master switch in + > Free APIs.'),
    row('wordsapi', 'WordsAPI (RapidAPI)', 'dictionary', 'get_word_info tool. Needs the master switch in + > Free APIs.')
  ];
}

// ---------- panel ----------
const SERVICES = [
  { id: 'ipify', name: 'ipify', desc: 'Your public IP address. No key.', test: async () => (await ip()).ip },
  { id: 'lt', name: 'LanguageTool', desc: 'Grammar and spelling. No key. Text is sent to the public service.', test: async () => { const r = await grammar('Ths is a tset of the gramar checker.'); return r.issues + ' issue(s) found'; } },
  { id: 'unsplash', name: 'Unsplash', desc: 'Free photos. Key = your Access Key from unsplash.com/developers.', key: true, test: async () => (await photos('mountain', 3)).photos.length + ' photo(s) found' },
  { id: 'whoisjson', name: 'WhoisJSON', desc: 'Domain whois. Key = your API token from whoisjson.com.', key: true, test: async () => { const r = await whois('example.com'); return 'Answered for ' + r.domain; } },
  { id: 'wordsapi', name: 'WordsAPI', desc: 'Dictionary. Key = your RapidAPI key with WordsAPI subscribed.', key: true, test: async () => { const r = await word('ember'); return (r.senses || []).length + ' sense(s) for "ember"'; } },
  { id: 'chartlyrics', name: 'ChartLyrics', desc: 'Lyrics. No key. Not verified live: the test tells you if it works.', test: async () => { const r = await lyrics('Queen', 'Bohemian Rhapsody'); return 'Answered (' + r.lyrics.length + ' characters, not shown)'; } }
];
const CSS = '#emberApis{position:fixed;inset:0;z-index:9500;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.72)}#emberApis.open{display:flex}' +
  '#emberApis .ea-card{width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#0b0d12;border:1px solid #1d2433;border-radius:18px 18px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom,0px));color:#e7eaf2;font:14px/1.45 system-ui,sans-serif}' +
  '#emberApis .ea-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}#emberApis .ea-h b{font-size:17px}' +
  '#emberApis button{font:inherit;color:#e7eaf2;background:#141a26;border:1px solid #26314a;border-radius:11px;min-height:36px;padding:0 12px}' +
  '#emberApis .ea-x{width:38px;padding:0}#emberApis .ea-sw{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:8px 0 12px;background:#10141d;border:1px solid #1d2433;border-radius:12px}' +
  '#emberApis .ea-sw input{width:20px;height:20px}#emberApis .ea-row{padding:11px 0;border-top:1px solid #161c2a}#emberApis .ea-row b{display:block}#emberApis .ea-row small{display:block;color:#8e97ab}' +
  '#emberApis .ea-line{display:flex;gap:8px;margin-top:8px}#emberApis input[type=password],#emberApis input[type=text]{flex:1;min-width:0;min-height:38px;background:#0d1017;border:1px solid #26314a;border-radius:10px;color:#e7eaf2;padding:0 10px;font:inherit}' +
  '#emberApis .ea-st{margin-top:6px;font-size:12.5px;color:#8e97ab;min-height:16px}#emberApis .ea-st.ok{color:#7dd3a8}#emberApis .ea-st.bad{color:#ff9b8a}';
function mount() {
  if (D.getElementById('emberApis')) return;
  const st = D.createElement('style'); st.textContent = CSS; D.head.append(st);
  const ov = D.createElement('div'); ov.id = 'emberApis'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Free APIs');
  const card = D.createElement('div'); card.className = 'ea-card';
  const head = D.createElement('div'); head.className = 'ea-h';
  const title = D.createElement('b'); title.textContent = 'Free APIs';
  const x = D.createElement('button'); x.id = 'emberApisClose'; x.className = 'ea-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  head.append(title, x);
  const sw = D.createElement('label'); sw.className = 'ea-sw';
  const cb = D.createElement('input'); cb.type = 'checkbox'; cb.checked = enabled();
  const sp = D.createElement('span'); sp.textContent = 'Let Ember use these in chat. Off = nothing is ever sent to them.';
  sw.append(cb, sp); cb.onchange = () => setOn(cb.checked);
  card.append(head, sw);
  SERVICES.forEach(s => {
    const row = D.createElement('div'); row.className = 'ea-row';
    const nm = D.createElement('b'); nm.textContent = s.name; const ds = D.createElement('small'); ds.textContent = s.desc;
    const line = D.createElement('div'); line.className = 'ea-line'; const status = D.createElement('div'); status.className = 'ea-st';
    let inp = null;
    if (s.key) {
      inp = D.createElement('input'); inp.type = 'password'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = hasKey(s.id) ? 'Saved (paste a new one to replace)' : 'Paste key';
      const sv = D.createElement('button'); sv.type = 'button'; sv.textContent = 'Save';
      sv.onclick = () => { if (!inp.value.trim()) { status.className = 'ea-st bad'; status.textContent = 'Paste a key first.'; return; } const ok = setKey(s.id, inp.value); inp.value = ''; inp.placeholder = ok ? 'Saved (paste a new one to replace)' : 'Paste key'; status.className = 'ea-st ' + (ok ? 'ok' : 'bad'); status.textContent = ok ? 'Key saved on this phone.' : 'That key looks too short.'; };
      const rm = D.createElement('button'); rm.type = 'button'; rm.textContent = 'Remove'; rm.onclick = () => { setKey(s.id, ''); inp.placeholder = 'Paste key'; status.className = 'ea-st'; status.textContent = 'Key removed.'; };
      line.append(inp, sv, rm);
    }
    const tb = D.createElement('button'); tb.type = 'button'; tb.textContent = 'Test';
    tb.onclick = async () => {
      status.className = 'ea-st'; status.textContent = 'Testing…'; tb.disabled = true;
      try { status.textContent = 'Works: ' + await s.test(); status.className = 'ea-st ok'; }
      catch (e) { status.textContent = 'Failed: ' + String((e && e.message) || e).slice(0, 180); status.className = 'ea-st bad'; }
      finally { tb.disabled = false; }
    };
    line.append(tb); row.append(nm, ds, line, status); card.append(row);
  });
  ov.append(card); D.body.append(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  x.onclick = () => ov.classList.remove('open');
  D.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('open')) ov.classList.remove('open'); });
  const opener = D.createElement('button'); opener.id = 'bApis'; opener.type = 'button'; opener.hidden = true; opener.setAttribute('aria-hidden', 'true');
  opener.onclick = () => { cb.checked = enabled(); ov.classList.add('open'); };
  D.body.append(opener);
}
if (D.body) mount(); else D.addEventListener('DOMContentLoaded', mount);

W.EmberApis = { enabled, setOn, hasKey, setKey, tools, handlers, promptLine, inventory, ip, grammar, photos, whois, word, lyrics };
})();
