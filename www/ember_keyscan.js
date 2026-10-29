// Ember V1.9.14 - ember_keyscan.js: ONE key finder for every paste box in the app (Keys notes, Keys notepad, Scraping paste).
// Before V1.9.14 the chat engines (providers.js) and the API/web providers (ai_scraper.js) each had their own, different extractor, and both
// dropped keys that were really there. This module replaces both. It is pure text in, plain object out: no DOM, no storage, no network.
//
// How a key is recognised, strongest evidence first:
//   1. its own prefix, anywhere in the text (gsk_, AIza, AQ., fc-, tvly-, op_sk_, ev_)
//   2. an explicit assignment (GROQ_API_KEY=..., "zenrows_api_key": "...", export MISTRAL_KEYS=("a" "b"))
//   3. a provider NAME (or its domain) on the same line, or on one of the next two lines (blank lines do not count), and the key-shaped
//      token that follows it. Several providers on one line each get the tokens after their own name. A key that sits BEFORE the name on
//      its line ("key  <- mistral", "| key | ZenRows |") belongs to that name unless the line above is still waiting for its key.
//   4. several keys in a row under one name (bullets, one per line) all belong to that name
// Far from its name (2 lines away) a token must also have the right SHAPE for that provider (32 hex = ScraperAPI, 40 hex = ZenRows,
// 64 hex = SerpApi / Bright Data, 32 letters+digits = Mistral, 40 = Cohere, 80 upper-case = ScrapingBee ...).
// A key-like string with no name near it is never saved by guesswork: 32 / 40 character ones are handed back as `probes` so the caller can
// test them live against Mistral / Cohere, everything else is only counted in `unlabelled` so the UI can tell the user to label it.
// Placeholders (your_api_key_here, xxxx, 0000), variable names (FIRECRAWL_API_KEY), url paths and over-long blobs (> 128 characters, which
// is rejected whole, never sliced) are never keys. Key VALUES never leave this module except in the `keys` / `probes` it returns to its caller.
'use strict';
(() => {
const MAX_TEXT = 400000, MAX_KEYS = 24, MAX_TOK = 128, MAX_STRONG = 1600;
const HEX = n => new RegExp('^[0-9a-f]{' + n + '}$', 'i');
const GENERIC = /^[A-Za-z0-9_-]{16,128}$/;

// ---------- catalogue ----------
// rx = names/domains that are unmistakably this provider; weak = words that are only a hint (used only when no strong name is on the line)
// shape = what a real key looks like (needed when the token is far from its name); strict = the shape is needed even next to the name
const CAT = {
  openrouter: { kind:'chat', label:'OpenRouter', rx:'open[\\s_-]?router', prefixed:true },
  plugsky: { kind:'chat', label:'Plugsky AI', rx:'plug[\\s_-]?sky', prefixed:true },
  stability: { kind:'chat', label:'Stability AI', rx:'stability(?:[\\s_-]?ai)?', prefixed:true },
  groq:        { kind: 'chat',   label: 'Groq',         rx: 'groq', prefixed: true },
  gemini:      { kind: 'chat',   label: 'Gemini',       rx: 'gemini|genai|ai[\\s_-]?studio|generativelanguage', weak: 'google', prefixed: true },
  mistral:     { kind: 'chat',   label: 'Mistral',      rx: 'mistral', shape: /^[A-Za-z0-9]{32}$/, strict: true, noHex: true },
  cohere:      { kind: 'chat',   label: 'Cohere',       rx: 'cohere', weak: 'co(?=[_-](?:api[_-]?)?(?:key|token))', shape: /^[A-Za-z0-9]{40}$/, strict: true, noHex: true },
  anthropic:   { kind: 'chat',   label: 'Claude',       rx: 'anthropic|claude', prefixed: true },
  firecrawl:   { kind: 'scrape', label: 'Firecrawl',    rx: 'firecrawl', prefixed: true },
  browserless: { kind: 'scrape', label: 'Browserless',  rx: 'browserless', shape: /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9]{20,64})$/i },
  scraperapi:  { kind: 'scrape', label: 'ScraperAPI',   rx: 'scraper[\\s_-]?api', shape: HEX(32) },
  scraperbee:  { kind: 'scrape', label: 'ScraperBee',   rx: 'scraper[\\s_-]?bee|scraping[\\s_-]?bee', shape: /^[A-Z0-9]{60,100}$/ },
  sting:       { kind: 'scrape', label: 'Sting',        rx: 'sting' },
  zenrows:     { kind: 'scrape', label: 'ZenRows',      rx: 'zen[\\s_-]?rows', shape: HEX(40) },
  tavily:      { kind: 'scrape', label: 'Tavily',       rx: 'tavily', prefixed: true },
  serpapi:     { kind: 'scrape', label: 'SerpApi',      rx: 'serp[\\s_-]?api', shape: HEX(64) },
  brightdata:  { kind: 'scrape', label: 'Bright Data',  rx: 'bright[\\s_-]?data|bright[\\s_-]?serpa?|brd[\\s_-]?(?:api|customer|superproxy)|luminati', weak: 'bright|brd', shape: HEX(64) },
  octoparse:   { kind: 'scrape', label: 'Octoparse',    rx: 'octoparse' },
  audd:        { kind: 'misc',   label: 'Audd.io',      rx: 'audd(?:[\\s.]?io)?', shape: /^[A-Za-z0-9]{16,64}$/ },
  easyvoice:   { kind: 'misc',   label: 'EasyVoice',    rx: 'easy[\\s_-]?voice', prefixed: true }
};
const IDS = Object.keys(CAT);
const CHAT_IDS = IDS.filter(id => CAT[id].kind == 'chat'), SCRAPE_IDS = IDS.filter(id => CAT[id].kind == 'scrape');
// services Ember has no slot for: their NAME is still a boundary, so a key under "OpenAI" is not handed to the provider above it
const OTHER_RX = 'open[\\s_-]?ai|chat[\\s_-]?gpt|deep[\\s_-]?seek|anthropic|claude|together[\\s_-]?ai|x[\\s_-]?ai|perplexity|cerebras|samba[\\s_-]?nova|nvidia|replicate|github|gitlab|aws|azure|stripe|twilio|eleven[\\s_-]?labs|deepgram|assembly[\\s_-]?ai|bing|serper|search[\\s_-]?api|data[\\s_-]?for[\\s_-]?seo|crawlbase|apify|scraping[\\s_-]?dog|scrapfly|oxylabs|smartproxy|decodo|zyte|scraping[\\s_-]?ant|jina|exa[\\s_-]?ai|brave';
const NAME_RX = {}; IDS.forEach(id => { NAME_RX[id] = [[new RegExp(CAT[id].rx, 'ig'), false]]; if (CAT[id].weak) NAME_RX[id].push([new RegExp(CAT[id].weak, 'ig'), true]); });
const OTHER_RE = new RegExp(OTHER_RX, 'ig');

// keys that announce themselves
const B = '(?<![A-Za-z0-9_-])';
const STRONG = [
  ['openrouter', new RegExp(B + 'sk-or-v1-[A-Za-z0-9_-]{16,}', 'g')],
  ['plugsky', new RegExp(B + 'sk-live-[A-Za-z0-9_-]{16,}', 'g')],
  ['groq', new RegExp(B + 'gsk_[A-Za-z0-9]{20,}', 'g')],
  ['gemini', new RegExp(B + 'AIza[0-9A-Za-z_-]{30,}', 'g')],
  ['gemini', new RegExp(B + 'AQ\\.[0-9A-Za-z_.-]{20,}', 'g')],
  ['firecrawl', new RegExp(B + 'fc-[A-Za-z0-9]{16,}', 'g')],
  ['tavily', new RegExp(B + 'tvly-[A-Za-z0-9_-]{16,}', 'g')],
  ['octoparse', new RegExp(B + 'op_sk_[A-Za-z0-9_-]{8,}', 'g')],
  ['anthropic', new RegExp(B + 'sk-ant-[A-Za-z0-9_-]{20,}', 'g')],
  ['easyvoice', new RegExp(B + 'ev_[A-Za-z0-9_-]{12,}', 'g')]
];
// keys of services Ember cannot use: only counted (by service name), never stored
const OTHER_KEYS = [
  ['OpenAI', new RegExp(B + 'sk-(?!ant-|or-v1-|live-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}', 'g')],
  ['xAI', new RegExp(B + 'xai-[A-Za-z0-9]{20,}', 'g')],
  ['Perplexity', new RegExp(B + 'pplx-[A-Za-z0-9]{20,}', 'g')],
  ['Cerebras', new RegExp(B + 'csk-[A-Za-z0-9]{20,}', 'g')],
  ['NVIDIA', new RegExp(B + 'nvapi-[A-Za-z0-9_-]{20,}', 'g')],
  ['Replicate', new RegExp(B + 'r8_[A-Za-z0-9]{20,}', 'g')],
  ['GitHub', new RegExp(B + '(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})', 'g')],
  ['AWS', new RegExp(B + 'AKIA[0-9A-Z]{16}(?![A-Za-z0-9])', 'g')]
];
const OTHER_PFX = /^(gsk_|AIza|AQ\.|sk-|fc-|tvly-|op_sk_|ev_|xai-|pplx-|csk-|nvapi-|r8_|gh[pousr]_|github_pat_|AKIA)/;
const KEYSTOP = /^(https?|www|firecrawl|browserless|scraperapi|scraperbee|scrapingbee|zenrows|serpapi|octoparse|tavily|brightdata|authorization|bearer|api|key|token)$/i;
const PLACEHOLDER = /^(your|my|the|an?|example|sample|test|demo|dummy|fake|placeholder|insert|paste|enter|replace|put|api|key|token|secret|none|null|undefined|changeme|todo|xxx+|redacted)([_-]|$)/i;

// ---------- text clean-up ----------
// CRLF, zero-width junk, smart quotes, JSON / HTML escapes and Markdown marks turned into plain lines of text
function normText(text) {
  let t = String(text == null ? '' : text).slice(0, MAX_TEXT).replace(/[​-‍⁠﻿ ]/g, ' ').replace(/[“”„″]/g, '"').replace(/[‘’′]/g, "'");
  t = t.replace(/\{key\}/g, '\u0001K').replace(/\{url\}/g, '\u0001U');
  t = t.replace(/\\u0022|\\"|&quot;|&#34;/g, '"').replace(/\\u0027|&#39;|&apos;/g, "'").replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, ' ').replace(/\r\n?/g, '\n');
  return t.replace(/[`*|<>]/g, ' ').replace(/[{}\[\],;]/g, '\n');
}
// a name only counts as a whole word: "testing" is not Sting, "myZenrowsKey" and "FIRECRAWL_API_KEY" are
function boundaryOK(s, a, b) {
  const p = a > 0 ? s[a - 1] : '', n = b < s.length ? s[b] : '', f = s[a], l = s[b - 1];
  const before = !p || !/[A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(f));
  const after = !n || !/[A-Za-z]/.test(n) || (/[A-Z]/.test(n) && /[a-z]/.test(l));
  return before && after;
}
function spotsOf(line) {
  let sp = [];
  IDS.forEach(id => NAME_RX[id].forEach(([re, weak]) => { re.lastIndex = 0; let m; while ((m = re.exec(line)) !== null) { if (!m[0].length) { re.lastIndex++; continue; } if (boundaryOK(line, m.index, m.index + m[0].length)) sp.push({ i: m.index, end: m.index + m[0].length, id, weak }); } }));
  OTHER_RE.lastIndex = 0; { let m; while ((m = OTHER_RE.exec(line)) !== null) { if (!m[0].length) { OTHER_RE.lastIndex++; continue; } if (boundaryOK(line, m.index, m.index + m[0].length)) sp.push({ i: m.index, end: m.index + m[0].length, id: 'x', weak: false }); } }
  if (sp.some(s => !s.weak)) sp = sp.filter(s => !s.weak);                       // "engine=google" inside a SerpApi url must not become a Gemini label
  sp.sort((a, b) => a.i - b.i || (b.end - b.i) - (a.end - a.i));
  const out = []; sp.forEach(s => { const q = out[out.length - 1]; if (q && s.i < q.end) return; if (q && q.id == s.id) return; out.push(s); });
  return out;
}
const blank = (s, re) => s.replace(re, m => ' '.repeat(m.length));
// the page to fetch, hosts, paths, NAME= prefixes and %xx are never keys; the ?query=KEY part stays. Same length as the input so offsets still line up.
function maskLine(line) {
  let b = blank(line, /\b(?:url|u|uri|link|href|target|site|website|page)=[^&\s"']*/gi);
  b = blank(b, /https?:\/\/[^\s"'?#]*/gi); b = blank(b, /%[0-9A-Fa-f]{2}/g);
  return blank(b, /\b[A-Za-z_][A-Za-z0-9_.-]*["']?\s*[:=]\s*/g);
}
function tokensOf(masked) {
  const out = [], re = /[A-Za-z0-9_-]+/g; let m;
  while ((m = re.exec(masked)) !== null) { const t = m[0].replace(/^[-_]+|[-_]+$/g, ''); if (t.length >= 16) out.push({ i: m.index, t }); }
  return out;
}
// does this token look like a real key at all (before asking whose it is)?
function plausible(tok, c) {
  if (tok.length < 16 || tok.length > MAX_TOK) return false;                      // too long is rejected whole, never cut into 128 + the rest
  if ((OTHER_PFX.test(tok) && !(c && c.label === 'Stability AI' && /^sk-[A-Za-z0-9_-]{16,}$/.test(tok))) || KEYSTOP.test(tok) || PLACEHOLDER.test(tok)) return false;
  if (/^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(tok)) return false;                       // ALL_CAPS variable names (FIRECRAWL_API_KEY)
  if (/^\d+$/.test(tok)) return false;                                             // all-digit runs are ids, not keys
  if (!/\d/.test(tok) && !(c && c.strict && c.shape.test(tok) && /[a-z]/.test(tok) && /[A-Z]/.test(tok) && new Set(tok).size >= 14)) return false;
  if (/^(.{1,4})\1{3,}$/.test(tok)) return false;                                  // abababab..., 0000..., xxxx...
  const freq = {}; let top = 0; for (const ch of tok.toLowerCase()) { freq[ch] = (freq[ch] || 0) + 1; if (freq[ch] > top) top = freq[ch]; }
  return top / tok.length <= 0.6;                                                  // xxxxxxxxxxxxxxxxxxx1 style placeholders
}
function accepts(id, tok, far) {
  const c = CAT[id]; if (!c || !plausible(tok, c)) return false;
  if (c.noHex && /^[0-9a-f]+$/i.test(tok)) return false;                          // a 32/40 character hex string is a hash, not a Mistral/Cohere key
  if ((far || c.strict) && !(c.shape || GENERIC).test(tok)) return false;
  return true;
}
// NAME = value lines (env files, shell, JSON, code): the variable name says whose key it is, the value only has to be long enough
const ENV_LINE = /^\s*(?:export\s+|set\s+|\$env:|const\s+|let\s+|var\s+)?["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.*)$/;
function envOwner(name) {
  for (const id of IDS) { const m = new RegExp(CAT[id].rx, 'i').exec(name); if (m && boundaryOK(name, m.index, m.index + m[0].length)) return id; }
  for (const id of IDS) if (CAT[id].weak && new RegExp('(^|[_-])(?:' + CAT[id].weak + ')($|[_-])', 'i').test(name)) return id;
  return '';
}

// ---------- Bright Data zones (a zone name is not a secret, it picks which product the API key is billed to) ----------
function zonesOf(text) {
  const z = {}; if (!/bright|brd[-_ ]|luminati/i.test(text)) return z;
  const put = n => { n = String(n || '').trim(); if (!/^[A-Za-z][A-Za-z0-9_-]{2,39}$/.test(n)) return; const k = /unlock/i.test(n) ? 'unlocker' : /serp/i.test(n) ? 'serp' : ''; if (k && !z[k]) z[k] = n; };
  let m; const a = /brd-customer-[A-Za-z0-9_]+-zone-([A-Za-z0-9_]+)/gi; while ((m = a.exec(text)) !== null) put(m[1]);
  const b = /\bzone["']?\s*[:=]\s*["']?([A-Za-z][A-Za-z0-9_-]{2,39})/gi; while ((m = b.exec(text)) !== null) { const n = m[1]; if (/_|\d/.test(n) || /^(serp|unlock)/i.test(n)) put(n); }
  const c = /(?<![A-Za-z0-9_-])((?:serp_api|web_unlocker|mcp_unlocker|unlocker)\d*)(?![A-Za-z0-9_-])/gi; while ((m = c.exec(text)) !== null) put(m[1]);
  return z;
}

// ---------- the scan ----------
function scan(text) {
  const out = { keys: {}, probes: { mistral: [], cohere: [] }, unlabelled: [], foreign: [], endpoints: {}, zones: {} };
  IDS.forEach(id => { out.keys[id] = []; });
  const seen = new Set(), foreignN = {};
  const lines = normText(text).split('\n');
  const push = (id, tok) => { if (!tok || seen.has(tok) || out.keys[id].length >= MAX_KEYS) return false; seen.add(tok); out.keys[id].push(tok); return true; };
  const leftover = tok => {
    if (seen.has(tok) || !plausible(tok) || !/^[A-Za-z0-9]+$/.test(tok)) return; seen.add(tok);
    if (tok.length == 32 && /[A-Za-z]/.test(tok) && /\d/.test(tok) && !HEX(32).test(tok)) out.probes.mistral.push(tok);
    else if (tok.length == 40 && /[A-Za-z]/.test(tok) && /\d/.test(tok) && !HEX(40).test(tok)) out.probes.cohere.push(tok);
    else if (tok.length >= 24 && out.unlabelled.length < 40) out.unlabelled.push(tok);
  };
  let cur = '', win = 0, dist = 0, curHas = false;                                 // provider the last name line opened, lines still open, lines since it, did it get a key yet
  const take = (id, tok, far) => { if (id == 'x' || !accepts(id, tok, far)) return false; return push(id, tok) ? 'new' : 'dup'; };
  const sting = [];                                                                // lines that may hold a Sting endpoint
  for (const raw of lines) {
    if (!raw.trim()) continue;                                                     // blank lines never use up the window
    let work = raw; const strongIds = [];
    for (const [id, re] of STRONG) work = work.replace(re, m => { if (m.length <= MAX_STRONG) { push(id, id == 'gemini' ? m.replace(/[.]+$/, '') : m); strongIds.push(id); } return ' '.repeat(m.length); });
    if (spotsOf(work).some(s => s.id === 'stability')) work = work.replace(/(?<![A-Za-z0-9_-])sk-(?!ant-|or-v1-|live-)[A-Za-z0-9_-]{16,}/g,m => { push('stability',m); return ' '.repeat(m.length); });
    for (const [name, re] of OTHER_KEYS) work = work.replace(re, m => { foreignN[name] = (foreignN[name] || 0) + 1; return ' '.repeat(m.length); });
    const spots = spotsOf(work), toks = tokensOf(maskLine(work));
    // NAME = value (env file, shell, JSON, code): the variable name says whose key it is. Only for keys with no prefix of their own, and only when the line names one provider.
    let explicit = false;
    const env = ENV_LINE.exec(work), owner = env ? envOwner(env[1]) : '';
    if (owner && !CAT[owner].prefixed && new Set(spots.filter(s => s.id != 'x').map(s => s.id)).size <= 1) {
      env[2].split(/[\s,"'()\[\];]+/).filter(v => v.length >= 20 && v.length <= MAX_TOK && !/:\/\//.test(v) && !/^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(v) && !OTHER_PFX.test(v) && !PLACEHOLDER.test(v) && plausible(v, CAT[owner]) && !(CAT[owner].noHex && /^[0-9a-f]+$/i.test(v))).forEach(v => { push(owner, v.replace(/[.]+$/, '')); explicit = true; });
    }
    if (spots.length) {
      const first = spots[0], waiting = !!cur && cur != 'x' && win > 0 && !curHas, lastId = spots[spots.length - 1].id;
      let lastSeg = explicit;
      toks.forEach(tk => {
        let k = -1; for (let q = 0; q < spots.length; q++) if (spots[q].i <= tk.i) k = q;
        const id = k >= 0 ? spots[k].id : (waiting ? cur : first.id), far = k < 0 && waiting && dist + 1 >= 2;
        const r = take(id, tk.t, far);
        if (r) { if (id == lastId && (k == spots.length - 1 || k < 0 && spots.length == 1)) lastSeg = true; } else if (id != 'x') leftover(tk.t);
      });
      cur = lastId; dist = 0; curHas = lastSeg || strongIds.includes(lastId); win = curHas ? 1 : 2;
      if (spots.some(s => s.id == 'sting') || /^\s*https:\/\/[^\s]*sting/i.test(raw)) sting.push(raw);
    } else if (cur && win > 0) {
      dist++; let any = explicit;
      toks.forEach(tk => { if (cur == 'x') return; if (take(cur, tk.t, dist >= 2)) any = true; else leftover(tk.t); });
      if (any || strongIds.includes(cur)) { win = 1; dist = 0; curHas = true; } else win--;
    } else {
      toks.forEach(tk => leftover(tk.t));
      if (/^\s*https:\/\/[^\s]*sting/i.test(raw)) sting.push(raw);
    }
  }
  // an https endpoint on a Sting line: the key becomes {key}, a url= value becomes {url}; plain http is refused (original rule)
  for (const line of sting) {
    const m = /https:\/\/[^\s"'<>\u0001]*(?:\u0001[KU][^\s"'<>\u0001]*)*/.exec(line);
    if (m) { let ep = m[0].replace(/\u0001K/g, '{key}').replace(/\u0001U/g, '{url}'); out.keys.sting.concat(out.keys.sting).forEach(k => { ep = ep.split(k).join('{key}'); }); ep = ep.replace(/([?&]url=)(?:https?%3A%2F%2F|https?:\/\/)[^&\s]*/i, '$1{url}'); if (/^https:\/\/[^\s{}]+/.test(ep)) { out.endpoints.sting = ep; break; } }
  }
  out.zones = zonesOf(String(text == null ? '' : text).slice(0, MAX_TEXT));
  out.foreign = Object.keys(foreignN).map(k => ({ kind: k, n: foreignN[k] }));
  return out;
}

// ---------- one call that files every key in the right place ----------
// Chat engines go through Prov.ingest (each new key is tested live), API/web keys through EmberScraper.ingestKeys (several per provider, none
// overwritten), Audd.io and EasyVoice keys into their own settings. Returns a report; describe() turns it into lines for the screen.
async function ingestAll(text) {
  const sc = scan(text), P = window.Prov, S = window.EmberScraper, A = window.EmberAudd, V = window.EmberVoice;
  const rep = { scan: { foreign: sc.foreign, unlabelled: sc.unlabelled.length }, chat: { found: {}, added: [], dupes: 0, rejected: 0 }, scrape: { added: [], addedKeys: [], dupes: 0, endpointAdded: [], zonesAdded: [] }, audd: false, easyvoice: false, errors: [] };
  try { if (P && P.ingest) rep.chat = await P.ingest(text, sc); } catch (e) { rep.errors.push('Chat engine keys: ' + (e && e.message || 'failed')); }
  try { if (S && S.ingestKeys) rep.scrape = S.ingestKeys(text, sc); } catch (e) { rep.errors.push('API / web keys: ' + (e && e.message || 'failed')); }
  try { if (A && sc.keys.audd.length && !A.hasKey()) { A.setKey(sc.keys.audd[0]); rep.audd = !!A.hasKey(); } } catch (e) { rep.errors.push('Audd.io: ' + (e && e.message || 'failed')); }
  try { if (V && V.cfg && V.setCfg && sc.keys.easyvoice.length && !String((V.cfg() || {}).ezKey || '').trim()) { V.setCfg({ ezKey: sc.keys.easyvoice[0] }); rep.easyvoice = true; } } catch (e) { rep.errors.push('EasyVoice: ' + (e && e.message || 'failed')); }
  const mk = k => (k.length > 12 ? k.slice(0, 4) + '…' + k.slice(-4) : '••••');
  // how many key-like strings the paste held (chat keys + probes + API / web keys), for the "Found N possible keys" line
  rep.foundCount = Object.values(rep.chat.found || {}).reduce((n, v) => n + (v | 0), 0) + Object.keys(rep.scrape.found || {}).reduce((n, id) => n + ((rep.scrape.found[id] || []).length), 0) + sc.keys.audd.length + sc.keys.easyvoice.length;
  rep.total = rep.chat.added.length + ((rep.scrape.addedKeys || []).length) + (rep.audd ? 1 : 0) + (rep.easyvoice ? 1 : 0);
  rep.lines = describe(rep, mk);
  return rep;
}
// [{ t: 'ok' | 'warn' | 'info', text }]: plain text, the caller escapes it. Key values appear only masked.
function describe(rep, mk) {
  mk = mk || (k => k.slice(0, 4) + '…' + k.slice(-4));
  const L = [], ch = rep.chat || {}, sc = rep.scrape || {};
  (ch.added || []).forEach(a => L.push({ t: a.ok ? 'ok' : 'warn', text: ((CAT[a.id] || {}).label || a.id) + ' ' + mk(a.key) + (a.ok ? ' works' : ' was saved but the check failed (see Settings > Keys)') + (a.guess ? ' (no label: identified by testing it on ' + (a.guess === 'cohere' ? 'Cohere' : 'Mistral') + ')' : '') }));
  const byId = {}; (sc.addedKeys || []).forEach(k => { (byId[k.id] = byId[k.id] || []).push(k); });
  Object.keys(byId).forEach(id => L.push({ t: 'ok', text: ((CAT[id] || {}).label || id) + ': ' + byId[id].length + ' key' + (byId[id].length == 1 ? '' : 's') + ' saved (' + byId[id].map(k => mk(k.key) + (k.slot == 'extra' ? ' extra' : '')).join(', ') + ')' + (byId[id].some(k => k.slot == 'extra') ? '. Extra keys take turns with the first and cover for it when it runs out' : '') }));
  (sc.endpointAdded || []).forEach(() => L.push({ t: 'ok', text: 'Sting endpoint saved (https)' }));
  (sc.zonesAdded || []).forEach(z => L.push({ t: 'ok', text: 'Bright Data ' + (z.kind == 'unlocker' ? 'Web Unlocker' : 'SERP') + ' zone saved: ' + z.name }));
  if (rep.audd) L.push({ t: 'ok', text: 'Audd.io token saved (Settings > Music)' });
  if (rep.easyvoice) L.push({ t: 'ok', text: 'EasyVoice key saved (Settings > Perms > Voice)' });
  const dup = (ch.dupes || 0) + (sc.dupes || 0); if (dup) L.push({ t: 'info', text: dup + ' key' + (dup == 1 ? ' was' : 's were') + ' already saved' });
  const rj = ch.rejectedBy || { mistral: ch.rejected || 0, cohere: 0 };
  if (rj.mistral) L.push({ t: 'warn', text: rj.mistral + ' unlabeled 32-character string(s) were not a valid Mistral key and were ignored' });
  if (rj.cohere) L.push({ t: 'warn', text: rj.cohere + ' unlabeled 40-character string(s) were not a valid Cohere key and were ignored' });
  const fo = (rep.scan && rep.scan.foreign) || []; if (fo.length) L.push({ t: 'info', text: 'Not saved, Ember has no engine for them: ' + fo.map(f => f.n + ' ' + f.kind).join(', ') });
  const un = (rep.scan && rep.scan.unlabelled) || 0; if (un) L.push({ t: 'warn', text: un + ' key-like string' + (un == 1 ? ' has' : 's have') + ' no provider name next to ' + (un == 1 ? 'it' : 'them') + ' and ' + (un == 1 ? 'was' : 'were') + ' not saved. Put the name (ZenRows, SerpApi, Bright Data ...) on the line above or beside the key and extract again' });
  (rep.errors || []).forEach(e => L.push({ t: 'warn', text: e }));
  if (!L.length) L.push({ t: 'warn', text: 'No keys found. Prefixed keys are found on their own (gsk_, AIza or AQ., fc-, tvly-, op_sk_). Every other key needs the provider name on the same line or on the line above: Mistral, Cohere, ScraperAPI, ZenRows, SerpApi, Bright Data, Browserless, ScraperBee, Sting, Audd.' });
  return L;
}

window.EmberKeyScan = { scan, ingestAll, describe, normText, plausible, zonesOf, CAT, IDS, CHAT_IDS, SCRAPE_IDS, LABEL: Object.fromEntries(IDS.map(id => [id, CAT[id].label])) };
})();
