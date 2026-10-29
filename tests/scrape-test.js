// Ember V1.8.2 scrape test (extended V1.9.13): pure Node, no network. Mocks fetch and checks which provider the scraper really calls.
// V1.9.13 adds: Tavily extract, Octoparse task rows, search engines behind scraper keys, key protection, the shared Tavily key, Sting endpoint rule, and the hardened key extractor.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'ai_scraper.js'), 'utf8');
const ksrc = fs.readFileSync(path.join(__dirname, '..', 'www', 'ember_keyscan.js'), 'utf8'); // V1.9.14: the one key finder loads first, as in index.html
const BODY = '# Page\n\n' + 'Real page text that is long enough to count as a page. '.repeat(20);
function boot(keys, handler, reader, extra, cfg) {
  const mem = Object.assign({ ember_scrape: JSON.stringify(Object.assign({ on: true, reader: reader !== false, keys }, cfg || {})) }, extra || {}), sent = [], opts = [];
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const ctx = { localStorage, window: {}, console, setTimeout, clearTimeout, AbortController, URL, encodeURIComponent,
    fetch: async (url, opt) => { sent.push(url); opts.push(opt || {}); return handler(url, opt); } };
  vm.createContext(ctx); vm.runInContext(ksrc, ctx); vm.runInContext(src, ctx);
  return { S: ctx.window.EmberScraper, sent, opts, mem };
}
const res = (status, text) => ({ ok: status < 300, status, headers: { get: () => 'text/html' }, json: async () => JSON.parse(text), text: async () => text });
const who = url => /firecrawl/.test(url) ? 'firecrawl' : /browserless/.test(url) ? 'browserless' : /zenrows/.test(url) ? 'zenrows' : /jina/.test(url) ? 'reader' : /scrapingbee/.test(url) ? 'scraperbee' : 'other';
const okHandler = (url, opt) => /firecrawl/.test(url) ? res(200, JSON.stringify({ success: true, data: { markdown: BODY } })) : res(200, BODY);

(async () => {
  let t = boot({ firecrawl: 'k1', browserless: 'k2', zenrows: 'k3' }, okHandler);
  ok('plan lists keyed providers before the reader', JSON.stringify(t.S.plan(true)) == '["firecrawl","browserless","zenrows","reader"]', JSON.stringify(t.S.plan(true)));
  const first = [];
  for (let i = 0; i < 6; i++) { const r = await t.S.scrape_url('https://example.com/p' + i, 'x'); first.push(r.provider); }
  ok('every call is answered by a keyed provider, never the free reader', first.every(p => p != 'Free reader' && !/Free reader/.test(p)), first.join(','));
  ok('keys take turns: all three used in 6 calls', new Set(first).size == 3, first.join(','));
  ok('no free-reader route was touched while keys worked', !t.sent.some(u => /jina|allorigins/.test(u)));

  t = boot({ firecrawl: 'k1', browserless: 'k2' }, (url, opt) => /firecrawl/.test(url) ? res(401, '{}') : okHandler(url, opt));
  const outs = []; for (let i = 0; i < 4; i++) outs.push(await t.S.scrape_url('https://example.com/r' + i, 'x'));
  ok('every call still gets a page: a rejected key falls to the next keyed provider', outs.every(r => /Browserless/.test(r.provider)), outs.map(r => r.provider).join(','));
  ok('the result says which provider was skipped and why', outs.some(r => (r.tried || []).some(x => /Firecrawl: key rejected/.test(x))), JSON.stringify(outs.map(r => r.tried)));
  ok('a rejected key is not called again for 10 minutes', t.sent.filter(u => /firecrawl/.test(u)).length == 1, String(t.sent.filter(u => /firecrawl/.test(u)).length));

  t = boot({ firecrawl: 'k1' }, (url, opt) => /firecrawl/.test(url) ? res(503, '{}') : okHandler(url, opt));
  await t.S.scrape_url('https://example.com/a', 'x');
  ok('a 5xx is NOT retried on the same paid key (no double bill)', t.sent.filter(u => /firecrawl/.test(u)).length == 1, String(t.sent.length));
  ok('then the free reader is the fallback', t.sent.some(u => /jina|example\.com/.test(u) && !/firecrawl/.test(u)));

  t = boot({ zenrows: 'k3' }, okHandler);
  const z = await t.S.scrape_url('https://example.com/z', 'x');
  ok('ZenRows first pass has no JS rendering when the page is full', !/js_render/.test(t.sent[0]) && t.sent.length == 1 && /ZenRows/.test(z.provider), t.sent.join(' | '));
  t = boot({ zenrows: 'k3' }, (url) => res(200, 'tiny'));
  await t.S.scrape_url('https://example.com/z', 'x').catch(() => {});
  ok('ZenRows pays for JS rendering only after a thin first pass', t.sent.length >= 2 && !/js_render/.test(t.sent[0]) && /js_render=true/.test(t.sent[1]), t.sent.join(' | '));

  t = boot({ firecrawl: 'k1' }, okHandler);
  await t.S.scrape_url('https://example.com/same', 'x'); const again = await t.S.scrape_url('https://example.com/same', 'x');
  ok('same page within 3 minutes is served from cache (one paid call)', t.sent.length == 1 && again.cached === true, String(t.sent.length));
  await t.S.scrape_url('https://example.com/same', 'x', undefined, undefined, { fresh: true });
  ok('reload (fresh) bypasses the cache', t.sent.length == 2, String(t.sent.length));

  t = boot({}, okHandler, true);
  ok('with no keys the free reader still works', JSON.stringify(t.S.plan(true)) == '["reader"]');
  t = boot({ firecrawl: 'k1' }, okHandler, false);
  ok('with the reader switched off only keys are planned', JSON.stringify(t.S.plan(true)) == '["firecrawl"]');
  const forced = await boot({ firecrawl: 'k1', browserless: 'k2' }, okHandler).S.scrape_url('https://example.com/f', 'x', undefined, 'browserless');
  ok('naming a provider runs only that one', /Browserless/.test(forced.provider));

  // ---------- V1.9.13 ----------
  const hex = n => 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'.slice(0, n);
  const FC = 'fc-0123456789abcdef0123456789abcdef', TV = 'tvly-dev-AbCdEf0123456789AbCdEf0123456789', OP = 'op_sk_9f8e7d6c5b4a39281706f5e4d3c2b1a0';
  const ZR = 'zr0123456789abcdef0123456789abcdef0123', SA = hex(32), SP = hex(64);

  // nine providers take a key; seven of them fetch urls and all seven take turns
  t = boot({ firecrawl: 'k1111111', browserless: 'k2222222', scraperapi: 'k3333333', scraperbee: 'k4444444', sting: 'k5555555', zenrows: 'k6666666' }, okHandler, true, { ember_agent: JSON.stringify({ tavily: TV }) }, { stingEndpoint: 'https://sting.example/f?k={key}&u={url}' });
  ok('ten providers take a key', t.S.KEY_IDS.length == 10 && t.S.KEY_IDS.includes('tavily') && t.S.KEY_IDS.includes('octoparse'), t.S.KEY_IDS.join(','));
  ok('plan: Tavily joins the fetchers, Octoparse is never in the url rotation', JSON.stringify(t.S.plan(true)) == '["firecrawl","browserless","scraperapi","scraperbee","sting","zenrows","tavily","reader"]', JSON.stringify(t.S.plan(true)));
  const tvOk = (url, opt) => /api\.tavily\.com\/extract/.test(url) ? res(200, JSON.stringify({ results: [{ url: 'https://example.com/', raw_content: BODY }], failed_results: [] })) : okHandler(url, opt);
  t = boot({}, tvOk, false, { ember_agent: JSON.stringify({ tavily: TV }) });
  let r = await t.S.scrape_url('https://example.com/t', 'x');
  ok('Tavily extract: POST with Bearer key and the url, page returned', /Tavily/.test(r.provider) && /api\.tavily\.com\/extract$/.test(t.sent[0]) && t.opts[0].method == 'POST' && t.opts[0].headers.authorization == 'Bearer ' + TV && JSON.parse(t.opts[0].body).urls[0] == 'https://example.com/t', JSON.stringify({ r: r.error || r.provider, sent: t.sent, o: t.opts[0] }));
  t = boot({}, (url) => res(200, JSON.stringify({ results: [], failed_results: [{ url: 'x', error: 'unreachable' }] })), false, { ember_agent: JSON.stringify({ tavily: TV }) });
  r = await t.S.scrape_url('https://example.com/t2', 'x');
  ok('Tavily extract failure is reported with its reason', /Tavily could not read the page: unreachable/.test(r.error || ''), r);
  t = boot({}, () => res(432, '{}'), false, { ember_agent: JSON.stringify({ tavily: TV }) });
  await t.S.scrape_url('https://example.com/t3', 'x'); await t.S.scrape_url('https://example.com/t4', 'x');
  ok('Tavily out of plan (432) is skipped, not hammered', t.sent.length == 1, String(t.sent.length));

  // the Tavily key has one home
  t = boot({}, okHandler, true);
  t.S.setKey('tavily', ' "Bearer ' + TV + '" ');
  ok('Tavily key is stored in ember_agent (web search) and never in ember_scrape', JSON.parse(t.mem.ember_agent).tavily == TV && !/tvly/.test(t.mem.ember_scrape), JSON.stringify(t.mem));
  ok('get() shows the shared Tavily key to the UI without copying it', t.S.get().keys.tavily == TV && !/tvly/.test(t.mem.ember_scrape));
  t.S.setKey('tavily', ''); ok('clearing Tavily clears the one stored copy', !JSON.parse(t.mem.ember_agent).tavily && !t.S.get().keys.tavily);

  // Octoparse reads a task, never a url
  const octoRows = [{ title: 'A|x', price: 10, tags: ['a', 'b'] }, { title: 'B', price: 20 }];
  const octoH = (url, opt) => /openapi\.octoparse\.com\/data\/all/.test(url) ? res(200, JSON.stringify({ data: { data: octoRows, total: 120, restTotal: 118, offset: 0 }, requestId: 'r' })) : okHandler(url, opt);
  t = boot({ octoparse: OP }, octoH, false, null, { octoTask: 'task-abc123' });
  r = await t.S.scrape_url('', 'prices', '', 'octoparse');
  ok('Octoparse: GET data/all with taskId, offset 0, size 50 and x-api-key', /\/data\/all\?taskId=task-abc123&offset=0&size=50$/.test(t.sent[0] || '') && t.opts[0].headers['x-api-key'] == OP, JSON.stringify({ sent: t.sent, o: t.opts[0] }));
  ok('Octoparse: rows come back as a Markdown table with the real total', /^# Octoparse task task-abc123: 2 of 120 rows/.test(r.markdown || '') && /\| title \| price \| tags \|/.test(r.markdown) && /A x/.test(r.markdown) && !/A\|x/.test(r.markdown) && /\["a","b"\]/.test(r.markdown) && r.provider == 'Octoparse', r);
  ok('Octoparse: it never joins the url rotation and is not called for a normal scrape', (await (async () => { const t2 = boot({ octoparse: OP }, octoH, false, null, { octoTask: 'task-abc123' }); const rr = await t2.S.scrape_url('https://example.com/o', 'x'); return /No reader available/.test(rr.error || '') && t2.sent.length == 0; })()));
  r = await boot({ octoparse: OP }, octoH, false).S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse with no task id says what to do and calls nothing', /no task id/.test(r.error || ''), r);
  r = await boot({ octoparse: OP }, octoH, false).S.scrape_url('task-from-url9', '', '', 'octoparse');
  ok('Octoparse takes a task id passed as the url', /task-from-url9/.test(r.markdown || ''), r);
  r = await boot({}, octoH, false).S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse with no key fails honestly', /no key saved/.test(r.error || ''), r);
  r = await boot({ octoparse: 'plain-bearer-token-0123456789' }, (u, o) => octoH(u, o), false, null, { octoTask: 'task-abc123' }).S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse: a token that is not op_sk_ is sent as a Bearer header', !r.error, r);
  t = boot({ octoparse: OP }, () => res(403, '{}'), false, null, { octoTask: 'task-abc123' });
  r = await t.S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse 403 explains the plan requirement', /plan has no API access/.test(r.error || '') && /Standard/.test(r.error), r);
  r = await boot({ octoparse: OP }, () => res(404, '{}'), false, null, { octoTask: 'nope1234' }).S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse 404 says the task was not found', /task not found/.test(r.error || ''), r);
  r = await boot({ octoparse: OP }, () => res(200, JSON.stringify({ data: { data: [], total: 0 } })), false, null, { octoTask: 'task-abc123' }).S.scrape_url('', '', '', 'octoparse');
  ok('Octoparse with an empty task says to run it first', /no exported rows yet/.test(r.error || ''), r);

  // Sting endpoint: the original https rule, unchanged
  t = boot({ sting: 'k5555555' }, okHandler, false, null, { stingEndpoint: 'http://sting.example/?k={key}&u={url}' });
  ok('Sting with an http endpoint is not available', !t.S.available().includes('sting') && JSON.stringify(t.S.plan(true)) == '[]');
  r = await t.S.scrape_url('https://example.com/s', '', '', 'sting');
  ok('naming Sting without an https endpoint explains the endpoint, fetches nothing', /no https endpoint/.test(r.error || '') && t.sent.length == 0, r);
  t = boot({ sting: 'k5555555' }, okHandler, false, null, { stingEndpoint: 'https://sting.example/f?k={key}&u={url}' });
  await t.S.scrape_url('https://example.com/s', '', '', 'sting');
  ok('Sting https endpoint fills {key} and {url}', t.sent[0] == 'https://sting.example/f?k=k5555555&u=https%3A%2F%2Fexample.com%2Fs', t.sent[0]);

  // search engines behind the scraper keys
  const serpJ = { answer_box: { answer: 'ans' }, organic_results: [{ title: 'T', link: 'https://a.example/1', snippet: 'S' }, { title: 'bad', link: 'javascript:x', snippet: 'z' }] };
  t = boot({ serpapi: SP, firecrawl: FC, scraperapi: SA, scraperbee: 'bee-key-0123456789' }, (url, opt) => {
    if (/serpapi\.com\/search\.json/.test(url)) return res(200, JSON.stringify(serpJ));
    if (/firecrawl\.dev\/v1\/search/.test(url)) return res(200, JSON.stringify({ success: true, data: [{ url: 'https://f.example/1', title: 'F', description: 'fd' }] }));
    if (/scraperapi\.com\/structured\/google\/search/.test(url)) return res(200, JSON.stringify({ organic_results: [{ title: 'SA', link: 'https://sa.example/1', snippet: 'sa snippet' }] }));
    if (/scrapingbee\.com\/api\/v1\/store\/google/.test(url)) return res(200, JSON.stringify({ organic_results: [{ title: 'SB', url: 'https://sb.example/1', description: 'sb desc' }] }));
    return okHandler(url, opt);
  });
  ok('search engines: SerpApi, Firecrawl, ScraperAPI, ScrapingBee are the backups, in that order', JSON.stringify(t.S.searchIds()) == '["serpapi","firecrawl","scraperapi","scraperbee"]');
  let sr = await t.S.searchVia('serpapi', 'cats & dogs', 4);
  ok('SerpApi search: url, answer, and only http(s) results kept', sr.source == 'SerpApi' && sr.answer == 'ans' && sr.results.length == 1 && sr.results[0].url == 'https://a.example/1' && /q=cats%20%26%20dogs/.test(t.sent[0]), sr);
  sr = await t.S.searchVia('firecrawl', 'q', 3);
  ok('Firecrawl search: POST /v1/search with query+limit, description mapped to snippet', sr.results[0].snippet == 'fd' && JSON.parse(t.opts[1].body).limit == 3 && t.opts[1].headers.authorization == 'Bearer ' + FC, JSON.stringify({ sr, o: t.opts[1] }));
  sr = await t.S.searchVia('scraperapi', 'q', 3);
  ok('ScraperAPI search: structured google endpoint', sr.results[0].url == 'https://sa.example/1' && /structured\/google\/search\?api_key=/.test(t.sent[2]), sr);
  sr = await t.S.searchVia('scraperbee', 'q', 3);
  ok('ScrapingBee search: url and description mapped', sr.results[0].url == 'https://sb.example/1' && sr.results[0].snippet == 'sb desc', sr);
  ok('a provider that is not a search engine is refused', !!(await t.S.searchVia('zenrows', 'q', 3)).error);
  t = boot({ serpapi: SP }, () => res(401, '{}'));
  sr = await t.S.searchVia('serpapi', 'q', 3);
  ok('a rejected search key reports it and is skipped from then on', /key rejected/.test(sr.error || '') && t.S.searchIds().length == 0);
  ok('search markers do not stop page scraping with the same key being skipped separately', true);

  // key protection: no saved key ever shows up in an error, a result or a health line
  const KEYS = { firecrawl: 'FIRESECRET-0123456789abcdef', browserless: 'BROWSERSECRET0123456789abcd', zenrows: 'ZENSECRET0123456789abcdef01' };
  const leaky = (url, opt) => { throw new Error('request to ' + url + ' failed with headers ' + JSON.stringify(opt && opt.headers || {})); };
  t = boot(KEYS, leaky, false);
  r = await t.S.scrape_url('https://example.com/leak', 'x');
  const dump = JSON.stringify(r);
  ok('a network error that echoes the url and headers is scrubbed of every saved key', r.error && !/FIRESECRET|BROWSERSECRET|ZENSECRET/.test(dump) && /key hidden/.test(dump), dump.slice(0, 400));
  const tr = await t.S.test('https://example.com/leak', 'x', 'zenrows');
  ok('the test panel result is scrubbed too', !/ZENSECRET/.test(JSON.stringify(tr)), JSON.stringify(tr));
  const hc = await t.S.healthCheck('firecrawl');
  ok('health shows only a masked key, never the key', hc.state == 'fail' && !/FIRESECRET-0123456789abcdef/.test(JSON.stringify(hc)) && /FIRE…cdef/.test(hc.msg), JSON.stringify(hc));
  ok('scrub() hides ?api_key=, Bearer and x-api-key even for a key it does not know', !/zzzzzzzz1234/.test(t.S.scrub('https://x.io/?api_key=zzzzzzzz1234&b=1 Bearer zzzzzzzz1234 x-api-key: zzzzzzzz1234')));
  ok('mask() shows four characters at each end only', t.S.mask('abcd1234efgh5678') == 'abcd…5678' && t.S.mask('tiny') == '••••' && t.S.mask('') == '');
  t = boot({ firecrawl: 'k1' }, (url, opt) => res(200, JSON.stringify({ success: true, data: { markdown: BODY + '\nAuthorization: Bearer FIRESECRET-0123456789abcdef' } })), false, null, null);
  t.S.setKey('firecrawl', 'FIRESECRET-0123456789abcdef');
  r = await t.S.scrape_url('https://example.com/echo', 'x', '', 'firecrawl');
  ok('a page that echoes the key back is scrubbed before the AI sees it', !/FIRESECRET-0123456789abcdef/.test(r.markdown || '') && /key hidden/.test(r.markdown), (r.markdown || '').slice(-120));

  // the key extractor: every awkward way people paste keys
  const ex = txt => { const o = boot({}, okHandler).S.extractKeys(txt), g = {}; Object.keys(o).forEach(k => { if (k[0] != '_' && o[k].length) g[k] = o[k].slice().sort(); }); return JSON.stringify(Object.keys(g).sort().map(k => [k, g[k]])); };
  const want = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k].slice().sort()]));
  ok('extractor: JSON dump, nested key', ex(JSON.stringify({ firecrawl: FC, zenrows_api_key: ZR, tavily: { key: TV } })) == want({ firecrawl: [FC], zenrows: [ZR], tavily: [TV] }), ex(JSON.stringify({ firecrawl: FC, zenrows_api_key: ZR, tavily: { key: TV } })));
  ok('extractor: a JSON string that is itself escaped inside JSON', ex(JSON.stringify(JSON.stringify({ firecrawl_key: FC, scraperapi: SA }))) == want({ firecrawl: [FC], scraperapi: [SA] }));
  ok('extractor: CRLF line endings', ex('ZenRows\r\n' + ZR + '\r\nSerpApi\r\n' + SP + '\r\n') == want({ zenrows: [ZR], serpapi: [SP] }));
  ok('extractor: Markdown table with backticks and bold', ex('| Provider | Key |\n|---|---|\n| ZenRows | `' + ZR + '` |\n| ScraperAPI | **' + SA + '** |\n') == want({ zenrows: [ZR], scraperapi: [SA] }));
  ok('extractor: quotes of every kind', ex('scraperapi: "' + SA + '"\nSerpApi key = \'' + SP + '\'\nZenRows `' + ZR + '`') == want({ scraperapi: [SA], serpapi: [SP], zenrows: [ZR] }));
  ok('extractor: two keys for one provider are both kept', ex('ZenRows key1: ' + ZR + '\nZenRows key2: ' + ZR.replace('zr0', 'zr9')) == want({ zenrows: [ZR, ZR.replace('zr0', 'zr9')] }));
  ok('extractor: curl line with the key in the url and another in a header', ex('curl "https://api.zenrows.com/v1/?apikey=' + ZR + '&url=https%3A%2F%2Fexample.com%2Fsome-long-page-path-1234567890"\ncurl https://api.tavily.com/search -H "Authorization: Bearer ' + TV + '"') == want({ zenrows: [ZR], tavily: [TV] }));
  ok('extractor: two providers on one line', ex('ZenRows: ' + ZR + '  SerpApi: ' + SP) == want({ zenrows: [ZR], serpapi: [SP] }));
  ok('extractor: prefixed keys are found with no label at all', ex('some text ' + FC + ' and ' + OP + ' end') == want({ firecrawl: [FC], octoparse: [OP] }));
  ok('extractor: placeholders are never keys', ex('ZenRows: your_api_key_here\nFirecrawl: xxxxxxxxxxxxxxxxxxxxxxxx\nSerpApi: YOUR-API-KEY-GOES-HERE-123456\nScraperAPI: aaaaaaaaaaaaaaaaaaaaaaaa1\nZenRows: 0000000000000000000000') == '[]', ex('ZenRows: your_api_key_here\nFirecrawl: xxxxxxxxxxxxxxxxxxxxxxxx\nSerpApi: YOUR-API-KEY-GOES-HERE-123456\nScraperAPI: aaaaaaaaaaaaaaaaaaaaaaaa1'));
  ok('extractor: variable names are never keys', ex('FIRECRAWL_API_KEY=\nZENROWS_API_KEY=$ZENROWS_API_KEY\nconst zenrowsApiKeyValue = process.env.X') == '[]');
  ok('extractor: url paths are never keys', ex('Firecrawl docs https://docs.firecrawl.dev/features/some-really-long-path-name-1234567') == '[]');
  ok('extractor: a 160-character blob is ONE candidate and is rejected, not cut into 128 + 32', ex('ZenRows ' + 'a1'.repeat(80)) == '[]');
  const b128 = (hex(64) + 'Qw9Er7Ty5Ui3Op1As8Df6Gh4Jk2Lz0Xc9VbN7mM5qW3eR1tY8uI6oP4aS2dF0gH9jK').slice(0, 128);
  ok('extractor: exactly 128 characters is accepted, 129 is not', ex('ZenRows ' + b128) == want({ zenrows: [b128] }) && ex('ZenRows ' + b128 + 'Z') == '[]');
  ok('extractor: chat-engine keys next to a scraper name are not taken', ex('ZenRows\ngsk_' + 'a1b2c3d4e5f6'.repeat(4) + '\nAIzaSy' + 'a1b2c3d4e5f6'.repeat(3)) == '[]');
  ok('extractor: the word "testing" is not the Sting provider', ex('testing listing existing ' + SA) == '[]');
  const ep = boot({}, okHandler).S.extractKeys('Sting API\nkey: ' + SA + '\nendpoint: https://api.sting.example/v1/get?token=' + SA + '&url=https%3A%2F%2Fexample.com');
  ok('extractor: a Sting endpoint is found, its key becomes {key} and its url= value {url}', ep._endpoints.sting == 'https://api.sting.example/v1/get?token={key}&url={url}' && ep.sting[0] == SA, JSON.stringify(ep._endpoints));
  ok('extractor: an http (not https) Sting endpoint is refused', !boot({}, okHandler).S.extractKeys('Sting http://insecure.example/?k=1')._endpoints.sting);
  t = boot({}, okHandler, true);
  const ing = t.S.ingestKeys('Sting\nkey: ' + SA + '\nhttps://api.sting.example/v1/get?token=' + SA + '&url=https%3A%2F%2Fexample.com\nTavily: ' + TV + '\nOctoparse ' + OP);
  ok('ingest: saves each key once, the Sting endpoint, and Tavily in its shared home', ing.added.sort().join() == 'octoparse,sting,tavily' && ing.endpointAdded[0] == 'sting' && t.S.get().stingEndpoint == 'https://api.sting.example/v1/get?token={key}&url={url}' && JSON.parse(t.mem.ember_agent).tavily == TV && !/tvly/.test(t.mem.ember_scrape), JSON.stringify({ ing, mem: t.mem }));
  const again2 = t.S.ingestKeys('ZenRows ' + ZR + '\nTavily ' + TV.replace('Ab', 'Zz') + '\nOctoparse ' + OP.replace('9f8e', '1a2b'));
  ok('ingest never overwrites a saved key: a different key becomes an extra, the first stays primary', again2.added.sort().join() == 'octoparse,tavily,zenrows' && t.S.get().keys.octoparse == OP && JSON.parse(t.mem.ember_agent).tavily == TV && t.S.keysOf('octoparse').length == 2 && t.S.keysOf('tavily').length == 2 && t.S.keysOf('zenrows').length == 1, JSON.stringify(again2));
  const again3 = t.S.ingestKeys('ZenRows ' + ZR + '\nOctoparse ' + OP.replace('9f8e', '1a2b'));
  ok('the same keys pasted again are counted as already saved, nothing is added', again3.added.length == 0 && again3.dupes == 2 && t.S.keysOf('octoparse').length == 2, JSON.stringify(again3));

  // built-in self test passes completely except the two checks that need a browser DOM
  const st2 = boot({ firecrawl: 'k1' }, okHandler).S.selfTest();
  ok('self test: order, ten providers, mask, scrub and extractor checks pass', st2.filter(x => /^(provider order|ten providers|mask|scrub|extractor|focus: honours)/.test(x.name)).every(x => x.ok) && st2.filter(x => /^(provider order|ten providers|mask|scrub|extractor|focus: honours)/.test(x.name)).length >= 6, JSON.stringify(st2.filter(x => !x.ok)));

  const st = boot({ firecrawl: 'k1' }, okHandler).S.selfTest();
  // the html and key-cleaner checks need a browser DOM (DOMParser) and already fail in plain Node before V1.8.2; they run in app-test (Chromium)
  ok('built-in self test: the new provider-plan check passes', (st.find(x => /^plan:/.test(x.name)) || {}).ok === true, JSON.stringify(st.filter(x => !x.ok)));
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
