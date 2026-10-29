// Ember V1.6.4 - ember_find.js: what the AI knows about the app it lives in.
//  - block(): live capability map (what is ON / OFF and the exact switch to flip) + the actions it already took in this chat
//  - find_in_app: searches his chats, prompts, saved sites, memory, notepad, documents and stored keys (keys come back masked)
'use strict';
(() => {
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const mask = k => { k = String(k || ''); return k.length > 10 ? k.slice(0, 4) + '…' + k.slice(-4) : '••••'; };
const SECRET = /\b(?:gsk_|sk-|tvly-|AIza|AQ\.)[A-Za-z0-9_\-.]{8,}|[A-Za-z0-9_\-]{36,}/g;
const redact = s => String(s).replace(SECRET, m => mask(m));
const terms = q => clip(q, 200).toLowerCase().split(/\s+/).filter(Boolean);
const hit = (text, t) => t.every(x => text.includes(x));

const TOOLS = [{
  name: 'find_in_app',
  description: 'Searches everything he saved inside Ember: past chats, saved prompts, saved sites, what Ember learned about him, his notepad, the documents library, and stored engine keys (keys are returned masked). Use it when he cannot find something or asks what he has. scope is one of all, chats, prompts, sites, memory, notepad, documents, keys.',
  parameters: { query: 'string', scope: 'string?' }
}];

async function find_in_app(a) {
  const SCOPES = ['all', 'chats', 'prompts', 'sites', 'memory', 'notepad', 'documents', 'keys'];
  const scope = SCOPES.includes(a.scope) ? a.scope : 'all', q = clip(a.query, 200), t = terms(q);
  const want = s => scope == 'all' || scope == s;
  const out = []; let privateSkipped = 0;
  const push = (where, title, snippet, extra) => { if (out.length < 30) out.push(Object.assign({ where, title: clip(title, 90), snippet: redact(clip(snippet, 240)) }, extra || {})); };

  if (want('chats') && window.Store) {
    try {
      const all = (await window.Store.all()).filter(c => c.msgs && c.msgs.length).sort((x, y) => y.updated - x.updated);
      let n = 0;
      for (const c of all) {
        if (c.priv) { privateSkipped++; continue; }
        const last = c.msgs[c.msgs.length - 1], when = new Date(c.updated).toLocaleDateString();
        if (!t.length) { if (n < 8) { push('chat', c.title + ' · ' + when, last.t); n++; } continue; }
        const hits = c.msgs.filter(m => hit(String(m.t).toLowerCase(), t)).slice(0, 2);
        if (hits.length || hit(String(c.title).toLowerCase(), t)) { (hits.length ? hits : [last]).forEach(h => push('chat', c.title + ' · ' + when, h.t)); if (++n >= 8) break; }
      }
    } catch (e) { /* chats unreadable */ }
  }
  if (want('prompts')) {
    try {
      const ps = JSON.parse(lsGet('ember_prompts') || '[]');
      (Array.isArray(ps) ? ps : []).filter(p => p && p.n && p.t && (!t.length || hit((p.n + ' ' + p.t + ' ' + (p.tags || []).join(' ')).toLowerCase(), t))).slice(0, 8).forEach(p => push('prompt', p.n + ((p.tags || []).length ? ' [' + p.tags.join(', ') + ']' : ''), p.t));
    } catch (e) { /* bad prompt data */ }
  }
  if (want('sites') && window.EmberSites) {
    try { (window.EmberSites.list() || []).filter(s => !t.length || hit((s.name + ' ' + s.url).toLowerCase(), t)).slice(0, 8).forEach(s => push('site', s.name, s.url)); } catch (e) { /* no sites */ }
  }
  if (want('memory') && window.EmberBridge) {
    try {
      const m = window.EmberBridge.getMem();
      [['fact', m.facts], ['thread', m.threads], ['callback', m.callbacks]].forEach(([k, arr]) => (arr || []).filter(x => x && x.t && (!t.length || hit(String(x.t).toLowerCase(), t))).slice(-6).forEach(x => push('memory ' + k, k, x.t)));
    } catch (e) { /* no memory */ }
  }
  if (want('notepad')) {
    const lines = lsGet('ember_pad').split(/\n+/).map(x => x.trim()).filter(Boolean);
    lines.filter(l => !t.length || hit(l.toLowerCase(), t)).slice(0, 8).forEach(l => push('notepad', 'Notepad line', l));
  }
  if (want('documents') && window.EmberDocs) {
    try {
      if (t.length) (await window.EmberDocs.searchDocuments({ query: q })).results.slice(0, 8).forEach(d => push('document', d.name, d.snippet || '', { fileId: d.fileId }));
      else (await window.EmberDocs.listDocuments()).documents.slice(0, 8).forEach(d => push('document', d.name, d.type + ' · ' + d.size + ' chars', { fileId: d.fileId }));
    } catch (e) { /* docs unreadable */ }
  }
  const P = window.Prov, SC = window.EmberScraper, AG = window.EmberAgentAddon;
  const keyAsk = scope == 'keys' || /\b(keys?|api|tokens?|secrets?)\b/i.test(q) || (P && P.IDS.some(id => t.includes(P.CFG[id].name.toLowerCase())));
  if (keyAsk && (want('keys'))) {
    try {
      const st = P ? P.status() : {};
      if (P) P.IDS.forEach(id => (P.entries(id) || []).forEach(e => { if (e && e.key) push('key', P.CFG[id].name + ' key', 'saved ' + mask(e.key) + ' · engine ' + (e.bad ? 'rejected it' : (st[id] || 'unknown'))); }));
      if (SC) { const ks = (SC.get().keys) || {}; Object.keys(ks).filter(id => id != 'tavily').forEach(id => { if (ks[id]) push('key', (SC.LABEL[id] || id) + ' scraping key', 'saved ' + mask(ks[id])); }); }
      if (AG && AG.hasTavilyKey && AG.hasTavilyKey()) push('key', 'Tavily key', 'saved');
    } catch (e) { /* keys unreadable */ }
  }
  const note = (out.some(x => x.where == 'key') ? 'Keys are masked on purpose. He can see and copy the full keys in Settings > Keys. ' : '') + (privateSkipped ? privateSkipped + ' private chat(s) were not searched. ' : '') + (out.length ? '' : 'Nothing matched. Try one or two different words, or another scope.');
  return { matches: out, count: out.length, note: note.trim() };
}

async function dispatch(name, args) {
  if (name !== 'find_in_app') return { error: 'Unknown tool: ' + name };
  try { return await find_in_app(args && typeof args == 'object' ? args : {}); } catch (e) { return { error: e.message || 'Search failed.' }; }
}

// Actions only (lookups are not logged). The prompt replays these so the AI never forgets what it already did.
const READONLY = /^(get_|list_|search_|find_|read_|status|youtube_search|web_search|see_image|scrape_url)/;
function note(tool, args, res) {
  const a = args || {}, r = res || {};
  const arg = a.url || a.query || a.title || a.name || a.trackId || a.playlist || '';
  const out = r.track && r.track.title ? r.track.title : (r.title || r.status || r.message || '');
  const bad = r.error || r.ok === false;
  return String(tool).replace(/_/g, ' ') + (arg ? ' (' + clip(arg, 80) + ')' : '') + (out ? ' -> ' + clip(out, 80) : '') + (bad ? ' — FAILED: ' + clip(r.error || 'it did not work', 80) : ' — worked');
}
function log(conv, tool, args, res) {
  if (!conv || READONLY.test(String(tool))) return;
  conv.acts = Array.isArray(conv.acts) ? conv.acts : [];
  conv.acts.push({ ts: Date.now(), t: note(tool, args, res) });
  if (conv.acts.length > 30) conv.acts.splice(0, conv.acts.length - 30);
}

function block(S, conv) {
  S = S || {};
  const P = window.Prov, SCR = window.EmberScraper, AG = window.EmberAgentAddon, D = window.EmberDocs;
  const on = v => v ? 'ON' : 'OFF';
  const nKeys = P ? P.IDS.reduce((n, id) => n + (((P.entries && P.entries(id)) || []).length), 0) : 0;
  const ver = ((document.getElementById('ver') || {}).textContent || 'Ember').split(' · ')[0];
  const scrapeOn = !!(SCR && SCR.enabled()), readerOn = !!(SCR && SCR.readerOn && SCR.readerOn());
  const docs = D && D.count ? D.count() : 0;
  const native = !!(AG && AG.native && AG.native());
  const search = !!(AG && S.agentAddon), tav = !!(AG && AG.hasTavilyKey && AG.hasTavilyKey());
  const chain = (AG && AG.searchChain) ? AG.searchChain() : [];
  const L = [
    'ABOUT THE APP YOU LIVE IN (live, true right now). You are inside ' + ver + ' on his phone. Know it, so you never guess or claim you cannot when you can:',
    '- Chat: ' + nKeys + ' engine key' + (nKeys == 1 ? '' : 's') + ' saved, automatic failover between engines, Free Mode ' + on(P && P.freeOn && P.freeOn()) + '.',
    '- Browser (the globe button): reads any page as clean text, back and forward, saved sites. He can send a page to you or save it to Documents. Page reading is ' + (scrapeOn ? 'ON' + (readerOn ? ' (free reader on)' : '') : 'OFF until he taps Turn on the free reader in the Browser or in Settings > Scraping') + '.',
    '- Documents: ' + docs + ' file' + (docs == 1 ? '' : 's') + ' in his library (plain text only, no PDF or Word parsing). You can list, search, read and summarize them' + (docs ? '.' : ' once he adds some (globe button, Documents tab).'),
    '- Prompts: the Prompts tab in the left menu holds his saved prompts (search, tags, pin). Saved sites: the Chats tab of the left menu.',
    '- Music Control is ' + on(S.musicAddon) + (S.musicAddon ? '' : ': you cannot touch his player until he switches it on in Settings > Music > Ember add-ons') + '.',
    '- YouTube and SoundCloud search, playlists and audio download are ' + on(S.youtubeAddon) + (S.youtubeAddon ? (native ? '' : ' but the native downloader is missing from this build') : ' (switch: Settings > Music > Ember add-ons)') + '.',
    '- Live web search is ' + (search ? (chain.length > (tav ? 2 : 1) ? 'ON (' + chain.join(' > ') + ')' : tav ? 'ON (Tavily, DuckDuckGo as backup)' : 'ON through DuckDuckGo only (encyclopedia-style answers, no news; a Tavily key in Settings > Music > Agent & API Tools gives full results)') : 'OFF (switch it on in Settings > Music > Agent & API Tools; no key is needed)') + '. Image links are ' + on(S.visionAddon) + '.',
    '- Termux Mode is ' + on(S.termuxMode) + ' (the Termux button opens its tab). EMBER TERMUX (Terminal, Ask Ember, Setup) is docked at the bottom of Settings > Hacking.',
    'HOW TO USE THIS: he loses time hunting for things he saved (chats, keys, prompts, notes, ideas, documents). When he cannot find something or asks what he has, call find_in_app first instead of asking him questions. Keys come back masked; he copies the full ones in Settings > Keys. If a capability above is OFF, give him the exact switch to flip in one line instead of saying you have no access. For general knowledge, code, security, music, business and ideas, answer directly and fully from what you know; never hide behind tools, and when he wants ideas give several concrete ones.'
  ];
  // V1.9.16: what Ember can actually do when a job needs thinking, planning or long documents. Written from the code, so it stays true.
  L.push('HOW YOU THINK ON BIG JOBS (all real, in this app):');
  L.push('- run_react: when you do not know the path in advance, you reason in a loop of Thought, Action, Observation (default 8 steps, hard cap 10, 4 minutes in total). An exact action you already ran, or one that already failed, is blocked, so change the approach. The Reasoning panel (🧠) shows every step live. He can switch on "Approve each action first" (he can edit the tool or its arguments, skip it or stop it) and "Edit what it sees before it continues". If he edits something, use his version.');
  L.push('- run_plan: for 3 or more dependent tool calls you write the whole plan first (up to 12 steps). The app checks it before anything runs, runs independent read-only steps in parallel (3 at a time) and anything that changes something alone, with 45 s per step and 120 s in total. A step that fails is reported, never hidden.');
  L.push('- Every tool call is checked against its schema before it runs, so a malformed call comes back as an error you can fix, it cannot crash the app.');
  L.push('- Long documents: you never read them whole. Use get_document_outline, then search_in_document, then read_document_chunk (about 1,500 characters each). read_document returns only the first 8000 characters and says so when it was cut: never claim you read the rest. On top of that the app searches his library for every message and may add a FROM HIS DOCUMENTS block; use it when it answers him and name the document.');
  L.push('- Engines: he can pin one. A pinned engine that fails shows its real error, the app does not quietly use another one.');
  const acts = conv && Array.isArray(conv.acts) ? conv.acts.slice(-8) : [];
  if (acts.length) L.push('ACTIONS YOU ALREADY TOOK IN THIS CHAT (true, you did these; never say you cannot do them and never forget them): ' + acts.map(x => new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + x.t).join('; ') + '.');
  return L.join('\n');
}

window.EmberKnow = { TOOLS, dispatch, block, log };
})();
