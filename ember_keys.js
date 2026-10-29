// Ember V1.9.0 - ember_keys.js: tells the AI what API keys exist, WHERE each one is used and WHERE the user adds it.
// Names, counts and status only. A key value is never read into the prompt or a tool result.
'use strict';
(() => {
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };

// provider -> what it powers, which tool or screen uses it, where he pastes it
const CHAT = 'Chat engine. Used automatically for every reply (the router picks one, or the one he pinned). No tool call needed.';
const SCRAPE = id => 'Web page fetcher. Used by scrape_url (it takes turns with his other scraper keys; pass via:"' + id + '" to force this one). Only runs when Settings > Scraping is switched on.';
const USE = {
  openrouter: CHAT + ' Paid models possible; automatic fallback requires explicit opt-in in AI Features.', plugsky: CHAT + ' Automatic fallback requires opt-in in AI Features.', stability: 'Media generation only, never a chat fallback. Image and audio artifacts in AI Features; hosted Stability video API is retired.',
  groq: CHAT, mistral: CHAT, gemini: CHAT, cohere: CHAT + ' Prototype.', anthropic: 'Claude chat engine (paid). Never used automatically: it answers only while he pins Claude in the Providers chip.',
  firecrawl: SCRAPE('firecrawl') + ' Also backs up web_search after Tavily.', browserless: SCRAPE('browserless'), scraperapi: SCRAPE('scraperapi'), scraperbee: SCRAPE('scraperbee'), sting: SCRAPE('sting'), zenrows: SCRAPE('zenrows'),
  serpapi: 'Google search results. Backs up web_search after Tavily, and is the last resort inside scrape_url (snippets only, never the page itself).',
  brightdata: 'Bright Data. Google search results through its SERP zone (backs up web_search after SerpApi). With a Web Unlocker zone saved (Settings > Scraping) it also fetches pages inside scrape_url; with only a SERP zone it gives search snippets, never the page itself. Several keys can be saved: extras cover for the first.',
  octoparse: 'Reads the exported rows of an Octoparse task he built (task id in Settings > Scraping). Used only by scrape_url with via:"octoparse"; it cannot read a url, so it never joins the normal rotation. Needs a Standard plan or higher for API access.',
  tavily: 'Live web search with full results (web_search, needs Settings > Music > Agent & API Tools > Web search ON) and page reading (scrape_url, Extract, takes turns with his other scraper keys when Settings > Scraping is on). Optional: without it web_search still works through DuckDuckGo, but only for encyclopedia-style answers, not news.',
  github: 'GitHub Classic token. Used by the github_* tools: sync his Knowledge Brain Repo, read files, write files when he asks (and optionally run builds on GitHub Actions).',
  audd: 'Song identification. Used by the identify_song tool and the Identify button in the Music panel.'
};
const WHERE = id => (window.Prov && window.Prov.CFG && window.Prov.CFG[id]) ? 'Settings > Keys' : (id == 'tavily' ? 'Settings > Music > Agent & API Tools (or Settings > Scraping: same key)' : id == 'audd' ? 'Settings > Music' : 'Settings > Scraping');

function inventory() {
  const P = window.Prov, SC = window.EmberScraper, out = [];
  if (P && P.IDS) P.IDS.forEach(id => {
    const a = (P.entries && P.entries(id)) || [];
    out.push({ id, name: P.CFG[id].name, kind: P.CFG[id].kind === 'media' ? 'media artifacts' : 'chat engine', saved: a.length, usable: a.filter(e => e && !(e.st && e.st.ok === false) && !e.bad).length, use: USE[id] || CHAT, where: WHERE(id) });
  });
  if (SC && SC.KEY_IDS) { const k = (SC.get() || {}).keys || {}; const cnt = id => (SC.keysOf ? SC.keysOf(id).length : (k[id] ? 1 : 0)); SC.KEY_IDS.filter(id => id != 'tavily').forEach(id => out.push({ id, name: (SC.LABEL && SC.LABEL[id]) || id, kind: 'scraper', saved: cnt(id), usable: cnt(id), use: USE[id], where: WHERE(id) })); }
  const A = window.EmberAgentAddon, tn = SC && SC.keysOf ? SC.keysOf('tavily').length : (A && A.hasTavilyKey && A.hasTavilyKey() ? 1 : 0); out.push({ id: 'tavily', name: 'Tavily', kind: 'web search', saved: tn, usable: tn, use: USE.tavily, where: WHERE('tavily') });
  const GH = window.EmberGithub; out.push({ id: 'github', name: 'GitHub', kind: 'code host', saved: GH && GH.on() ? 1 : 0, usable: GH && GH.on() ? 1 : 0, use: USE.github, where: 'Command Centre > GitHub' });
  const D = window.EmberAudd; const hasAudd = !!(D && D.hasKey && D.hasKey()); out.push({ id: 'audd', name: 'Audd.io', kind: 'song id', saved: hasAudd ? 1 : 0, usable: hasAudd ? 1 : 0, use: USE.audd, where: WHERE('audd') });
  if (window.EmberApis && window.EmberApis.inventory) window.EmberApis.inventory().forEach(x => out.push(x));
  return out;
}
// one compact paragraph for the system prompt
function line() {
  try {
    const inv = inventory(), have = inv.filter(x => x.saved), miss = inv.filter(x => !x.saved && x.id != 'octoparse');
    const s = lsGet('ember_set', {}) || {};
    return 'KEY MAP (true now, names only, values are never shown to you): ' +
      (have.length ? have.map(x => x.name + ' [' + x.kind + (x.kind == 'chat engine' ? ', ' + x.usable + '/' + x.saved + ' usable' : '') + ']').join('; ') : 'no keys saved') +
      '. Every saved key is already wired: chat engine keys answer replies according to pin and opt-in routing; Stability keys are media-only and require user confirmation in AI Features; scraper keys run inside scrape_url (SerpApi, Bright Data, Firecrawl, ScraperAPI and ScraperBee keys also back up web_search; a provider with several keys switches to the next one when a key runs out); the Tavily key runs inside web_search and takes turns as a page reader (DuckDuckGo is the keyless fallback); an Octoparse key reads one saved task and only when named; the Audd token runs inside identify_song. You never receive or type a key. ' +
      'If he asks whether a key works or where it goes, call key_map and answer from its result. Missing: ' + (miss.map(x => x.name).join(', ') || 'none') + '. If a feature needs a missing key, say which one and which Settings tab takes it. ' +
      (s.agentAddon ? '' : 'Web search is switched off. ');
  } catch (e) { return ''; }
}
const TOOLS = [
  { name: 'key_map', description: 'Returns every API key type Ember knows (chat engines, scrapers, Tavily, Audd): whether he saved one, how many are usable, what uses it and which Settings tab takes it. Never returns key values. Call it when unsure which key to use or why a feature says a key is missing. Pass provider to look at one.', parameters: { provider: 'string (optional)' } }
];
async function dispatch(name, args) {
  if (name != 'key_map') return { error: 'Unknown tool' };
  const p = String((args && args.provider) || '').toLowerCase().trim();
  let inv = inventory(); if (p) inv = inv.filter(x => x.id == p || x.name.toLowerCase() == p);
  if (!inv.length) return { error: 'No provider named "' + p + '". Call key_map with no provider to list them all.' };
  return { keys: inv.map(x => ({ provider: x.name, id: x.id, kind: x.kind, saved: x.saved, usable: x.usable, used_by: x.use, add_it_in: x.where })), note: 'Values are never shown. A saved key is already used by the matching tool; you do not pass keys anywhere.' };
}
window.EmberKeys = { TOOLS, dispatch, line, inventory };
})();
