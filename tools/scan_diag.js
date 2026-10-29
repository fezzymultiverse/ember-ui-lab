const fs = require('fs'), vm = require('vm'), path = require('path');
const { K, rnd, B62, HEX } = require('./diag.js');
const www = process.argv[2];
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(www, 'ember_keyscan.js'), 'utf8'), ctx);
const KS = ctx.window.EmberKeyScan;
const show = (n, t) => { const o = KS.scan(t); const f = Object.entries(o.keys).filter(([k, v]) => v.length).map(([k, v]) => k + ':' + v.length).join(' '); const p = [o.probes.mistral.length && 'probeM:' + o.probes.mistral.length, o.probes.cohere.length && 'probeC:' + o.probes.cohere.length, o.unlabelled.length && 'unl:' + o.unlabelled.length, o.foreign.length && 'foreign:' + JSON.stringify(o.foreign), Object.keys(o.zones).length && 'zones:' + JSON.stringify(o.zones)].filter(Boolean).join(' '); console.log(n.padEnd(48), (f || '(nothing)') + (p ? '  | ' + p : '')); };
const cases = {
  'Mistral label then blank lines then key': 'Mistral\n\n\n' + K.mistral,
  'Mistral+Gemini on one line': 'Mistral: ' + K.mistral + '  Gemini: ' + K.gemini,
  'JSON one line (3 providers)': JSON.stringify({ mistral: K.mistral, cohere: K.cohere, groq: K.groq }),
  'Cohere label on line above': 'Cohere key:\n' + K.cohere,
  'Mistral key BEFORE label': K.mistral + ' <- mistral',
  'Mistral table': '| Mistral | ' + K.mistral + ' |',
  'table: key | provider rows': '| ' + K.mistral + ' | Mistral |\n| ' + K.cohere + ' | Cohere |',
  'two groq glued by comma': K.groq + ',' + 'gsk_' + rnd(B62, 52, 77),
  'Gemini in URL ?key=': 'curl "https://generativelanguage.googleapis.com/v1beta/models?key=' + K.gemini + '"',
  'Mistral 3 line gap': 'Mistral API\nurl: x\nplan: free\nkey: ' + K.mistral,
  'env export Mistral arr': 'export MISTRAL_KEYS=("' + K.mistral + '" "' + K.mistral2 + '")',
  'escaped JSON': JSON.stringify(JSON.stringify({ gemini_api_key: K.gemini, mistral_key: K.mistral })),
  'hex-looking Mistral key under label': 'Mistral ' + rnd(HEX, 32, 3),
  'CO_API_KEY (Cohere env name)': 'CO_API_KEY=' + K.cohere,
  'HF_TOKEN env': 'HF_TOKEN=' + K.hf,
  'unlabelled 40 alnum (cohere probe)': 'my token ' + K.cohere,
  'unlabelled 32 alnum (mistral probe)': 'token ' + K.mistral,
  'S: SerpApi label, 4 blank lines, key': 'SerpApi\n\n\n\n' + K.serpapi,
  'S: Bright Data label': 'Bright Data API key: ' + K.bright,
  'S: "Bright serpa" label': 'Bright serpa\n' + K.bright,
  'S: Bright curl w/ zone': 'curl https://api.brightdata.com/request -H "Authorization: Bearer ' + K.bright + '" -d \'{"zone":"serp_api1","url":"https://www.google.com/search?q=x&brd_json=1","format":"raw"}\'',
  'S: Bright proxy string': 'brd-customer-hl_abc12345-zone-serp_api2:pw9x8y7z6w5v@brd.superproxy.io:33335',
  'S: ScrapingBee uppercase 80': 'ScrapingBee: ' + K.scraperbee,
  'S: browserless uuid': 'Browserless token: 2f9d3c1e-8a4b-4c7d-9e21-5b6a7c8d9e0f',
  'S: zenrows 40 hex': 'ZenRows ' + K.zenrows,
  'S: key BEFORE label': K.serpapi + ' (serpapi)',
  'S: heading + bullet keys (2)': '## ZenRows\n- ' + K.zenrows + '\n- ' + K.zenrows.replace(/^./, 'b'),
  'S: scraperapi 3 lines after label': 'ScraperAPI\nplan: hobby\ncredits: 1000\n' + K.scraperapi,
  'S: env style 3 providers': 'SCRAPERAPI_KEY=' + K.scraperapi + '\nZENROWS_API_KEY=' + K.zenrows + '\nSERPAPI_API_KEY=' + K.serpapi,
  'S: serpapi curl w/ engine=google': 'curl "https://serpapi.com/search.json?engine=google&q=coffee&api_key=' + K.serpapi + '"',
  'S: two providers one line': 'ZenRows: ' + K.zenrows + '  SerpApi: ' + K.serpapi,
  'S: 8 keys one provider list': 'ZenRows\n' + [1,2,3,4,5,6,7,8].map(i => rnd(HEX, 40, 100 + i)).join('\n'),
  'S: OpenAI key block + openai name': 'OpenAI\nsk-proj-' + rnd(B62, 60, 5) + '\nZenRows ' + K.zenrows,
  'S: key under unsupported service not stolen': 'ZenRows ' + K.zenrows + '\nSerper\n' + K.scraperapi,
  'S: audd label': 'Audd.io token: ' + K.scraperapi,
  'S: easyvoice': 'EasyVoice key ev_' + rnd(B62, 28, 8),
  'S: Octoparse': 'Octoparse ' + K.octo,
  'S: Tavily 2 keys': K.tavily + '\n' + 'tvly-prod-' + rnd(B62, 32, 99),
  'S: 160 blob rejected': 'ZenRows ' + 'a1'.repeat(80),
  'S: placeholders': 'ZenRows: your_api_key_here\nSerpApi: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1\nFirecrawl: YOUR-API-KEY-GOES-HERE-123456',
};
Object.entries(cases).forEach(([n, t]) => show(n, t));
