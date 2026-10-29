// Diagnostic: load the two extractors from a given www dir and throw nasty pastes at them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const www = process.argv[2];
function mkStore() { const mem = {}; return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, mem }; }
function loadProv() {
  const ls = mkStore();
  const LS = { get: (k, d) => { try { const v = JSON.parse(ls.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => ls.setItem(k, JSON.stringify(v)) };
  const ctx = { U: { LS }, window: {}, localStorage: ls, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent, performance, fetch: async () => { throw new Error('no net'); } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(www, 'providers.js'), 'utf8'), ctx); return ctx.window.Prov;
}
function loadScr() {
  const ls = mkStore();
  const ctx = { localStorage: ls, window: {}, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent, fetch: async () => { throw new Error('no net'); } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(www, 'ai_scraper.js'), 'utf8'), ctx); return ctx.window.EmberScraper;
}
const crypto = require('crypto');
const rnd = (alpha, n, seed) => { let o = '', c = 0; while (o.length < n) { const h = crypto.createHash('sha256').update(seed + ':' + (c++)).digest(); for (const b of h) { if (o.length < n && b < 256 - (256 % alpha.length)) o += alpha[b % alpha.length]; } } return o; };
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', HEX = '0123456789abcdef', UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const K = {
  groq: 'gsk_' + rnd(B62, 52, 1), gemini: 'AIza' + rnd(B62 + '_-', 35, 2), geminiAQ: 'AQ.Ab8' + rnd(B62 + '_-', 40, 3), mistral: rnd(B62, 32, 4), mistral2: rnd(B62, 32, 44),
  hf: 'hf_' + rnd(B62, 34, 6), cohere: rnd(B62, 40, 7),
  firecrawl: 'fc-' + rnd(HEX, 32, 8), tavily: 'tvly-dev-' + rnd(B62, 32, 9), serpapi: rnd(HEX, 64, 10), scraperapi: rnd(HEX, 32, 11),
  scraperbee: rnd(UP, 80, 12), zenrows: rnd(HEX, 40, 13), browserless: rnd(B62, 36, 14), bright: rnd(HEX, 64, 15), octo: 'op_sk_' + rnd(B62, 30, 16)
};
module.exports = { loadProv, loadScr, K, rnd, B62, HEX };
if (require.main === module) {
  const P = loadProv(), S = loadScr();
  const cases = {
    'AI: Mistral label then blank lines then key': 'Mistral\n\n\n' + K.mistral,
    'AI: Mistral+Gemini on one line': 'Mistral: ' + K.mistral + '  Gemini: ' + K.gemini,
    'AI: JSON one line': JSON.stringify({ mistral: K.mistral, cohere: K.cohere, groq: K.groq }),
    'AI: Cohere label on line above': 'Cohere key:\n' + K.cohere,
    'AI: Mistral key BEFORE label': K.mistral + ' <- mistral',
    'AI: Mistral table': '| Mistral | ' + K.mistral + ' |',
    'AI: two groq keys glued with comma': K.groq + ',' + 'gsk_' + rnd(B62, 52, 77),
    'AI: Gemini in URL ?key=': 'curl "https://generativelanguage.googleapis.com/v1beta/models?key=' + K.gemini + '"',
    'AI: Mistral key all letters': 'Mistral: ' + rnd('abcdefghijklmnopqrstuvwxyzABCDEFGH', 32, 9),
    'AI: Mistral 4 line gap': 'Mistral API\nurl: x\nplan: free\nowner: me\nkey: ' + K.mistral,
    'AI: env export Mistral arr': 'export MISTRAL_KEYS=("' + K.mistral + '" "' + K.mistral2 + '")',
    'AI: escaped JSON': JSON.stringify(JSON.stringify({ gemini_api_key: K.gemini, mistral_key: K.mistral })),
    'AI: hex mistral key': 'Mistral ' + rnd(HEX, 32, 3),
    'AI: Gemini key w/ spaces inside (wrapped)': K.gemini.slice(0, 20) + ' ' + K.gemini.slice(20),
    'AI: HF token uppercase env': 'HF_TOKEN=' + K.hf,
    'AI: groq key 2 line wrap': K.groq.slice(0, 30) + '\n' + K.groq.slice(30),
  };
  for (const [n, t] of Object.entries(cases)) { const o = P.extract(t); const f = Object.entries(o).filter(([k, v]) => v.length).map(([k, v]) => k + ':' + v.length).join(' ') || '(nothing)'; console.log(n.padEnd(46), f); }
  console.log('---- scraper');
  const sc = {
    'S: SerpApi label, key next line after 3 blanks': 'SerpApi\n\n\n\n' + K.serpapi,
    'S: Bright Data label': 'Bright Data API key: ' + K.bright,
    'S: ScrapingBee uppercase 80': 'ScrapingBee: ' + K.scraperbee,
    'S: browserless uuid': 'Browserless token: 2f9d3c1e-8a4b-4c7d-9e21-5b6a7c8d9e0f',
    'S: zenrows 40 hex': 'ZenRows ' + K.zenrows,
    'S: key BEFORE label': K.serpapi + ' (serpapi)',
    'S: label in heading, keys in bullets': '## ZenRows\n- ' + K.zenrows + '\n- ' + K.zenrows.replace(/^./, 'b'),
    'S: scraperapi after 3 other lines': 'ScraperAPI\nplan: hobby\ncredits: 1000\nrenew: monthly\n' + K.scraperapi,
    'S: key with dot': 'ZenRows: ab12.cd34.ef56.gh78.ij90.kl12',
    'S: env style': 'SCRAPERAPI_KEY=' + K.scraperapi + '\nZENROWS_API_KEY=' + K.zenrows + '\nSERPAPI_API_KEY=' + K.serpapi,
    'S: serpapi 64 hex in table': '| SerpApi | ' + K.serpapi + ' |',
    'S: tavily key w/ underscore': 'Tavily: tvly-' + rnd(B62 + '_', 40, 3),
    'S: octoparse': 'Octoparse ' + K.octo,
    'S: Firecrawl key no label': 'my key ' + K.firecrawl,
    'S: label+key same line, key then no digit': 'ZenRows ' + rnd('abcdefABCDEF', 40, 3),
    'S: 2 keys in a row same provider': 'SerpApi: ' + K.serpapi + ' ' + K.serpapi.replace(/^./, 'e'),
    'S: 7 keys of same provider (cap 6?)': 'ZenRows\n' + [1,2,3,4,5,6,7,8].map(i => rnd(HEX, 40, 100 + i)).join('\n'),
  };
  for (const [n, t] of Object.entries(sc)) { const o = S.extractKeys(t); const f = Object.entries(o).filter(([k, v]) => k != '_endpoints' && v.length).map(([k, v]) => k + ':' + v.length).join(' ') || '(nothing)'; console.log(n.padEnd(46), f); }
}
