// Ember V1.6.0 test (extended V1.9.12, V1.9.13: search failover chain through scraper keys, search_and_read): Agent & API tools (Tavily web search with a DuckDuckGo fallback, YouTube search/download via a mocked native plugin, image links).
// Run: node tests/agent-test.js   (needs Playwright; set PW=/path/to/playwright if it is not resolvable)
const { chromium } = require(process.env.PW || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW || path.join(__dirname, '..', 'www');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra === undefined ? '' : JSON.stringify(extra))); };

const srv = http.createServer((q, r) => {
  const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0];
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    const t = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    r.writeHead(200, { 'content-type': t }); r.end(d);
  });
});

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::|favicon/.test(m.text())) errs.push(m.text()); });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

  // ---------- mocked services ----------
  const SEEN = { tavily: [], ddg: [], poll: [], groq: [] }, MODE = { tavily: 200, ddg: 'ok', poll: 200, first: '' };
  await pg.route('https://api.tavily.com/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    SEEN.tavily.push({ auth: req.headers()['authorization'], body: JSON.parse(req.postData() || '{}') });
    if (MODE.tavily != 200) return route.fulfill({ status: MODE.tavily, headers: cors, contentType: 'application/json', body: '{"detail":"no"}' });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ answer: 'Mock answer.', results: [{ title: 'T1', url: 'https://a.example/1', content: 'c1' }, { title: 'T2', url: 'https://b.example/2', content: 'c2' }] }) });
  });
  // V1.9.24: keyless fallbacks (DuckDuckGo web results, Wikipedia). Default: down, so the older checks behave as before.
  MODE.html = 'down'; MODE.wiki = 'down';
  await pg.route('https://html.duckduckgo.com/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (MODE.html != 'ok') return route.fulfill({ status: 500, headers: cors, body: 'x' });
    route.fulfill({ status: 200, headers: cors, contentType: 'text/html', body: '<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=' + encodeURIComponent('https://example.org/jane-doe') + '&rut=1">Jane Doe - Cape Town</a><a class="result__snippet">Jane Doe is a designer in Cape Town.</a></div><div class="result"><a class="result__a" href="https://example.net/2">Second</a><a class="result__snippet">More.</a></div>' });
  });
  await pg.route('https://en.wikipedia.org/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (MODE.wiki != 'ok') return route.fulfill({ status: 500, headers: cors, body: 'x' });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Jane Doe', snippet: 'An <span class="searchmatch">unknown</span> person' }] } }) });
  });
  await pg.route('https://api.duckduckgo.com/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    SEEN.ddg.push(req.url());
    if (MODE.ddg == 'http') return route.fulfill({ status: 500, headers: cors, body: 'x' });
    if (MODE.ddg == 'empty') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ Heading: '', AbstractText: '', AbstractURL: '', Answer: '', RelatedTopics: [] }) });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ Heading: 'Apple', AbstractText: 'An apple is a fruit.', AbstractURL: 'https://en.wikipedia.org/wiki/Apple', Answer: '', RelatedTopics: [{ Text: 'Apple Inc - A tech company', FirstURL: 'https://duckduckgo.com/Apple_Inc' }, { Name: 'Varieties', Topics: [{ Text: 'Granny Smith - a green apple', FirstURL: 'https://duckduckgo.com/Granny_Smith' }] }] }) });
  });
  await pg.route('https://text.pollinations.ai/openai', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    SEEN.poll.push(JSON.parse(req.postData() || '{}'));
    if (MODE.poll != 200) return route.fulfill({ status: MODE.poll, headers: cors, body: 'x' });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'A red square on white.' } }] }) });
  });
  await pg.route('https://api.groq.com/**', async route => {
    const req = route.request(), u = req.url(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const J = o => route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (/\/models(\?|$)/.test(u)) return J({ data: [{ id: 'llama-3.3-70b-versatile' }] });
    const body = JSON.parse(req.postData() || '{}'), sys = body.messages[0].content, last = body.messages[body.messages.length - 1].content;
    if (/Reply with the single word OK/.test(sys)) return J({ choices: [{ message: { content: 'OK' } }] });
    if (/maintain a small memory|compress a chat/.test(sys)) return J({ choices: [{ message: { content: '{"title":"t","summary":"s","facts":[],"threads":[]}' } }] });
    SEEN.groq.push({ sys, last });
    J({ choices: [{ message: { content: /^\[TOOL RESULTS/.test(last) ? 'Here is what I found.' : (MODE.first || 'Plain reply.') } }] });
  });


  // V1.9.13 mocks: SerpApi search, Firecrawl search + scrape (what the failover chain and search_and_read call)
  const SEEN2 = { serp: [], fcSearch: [], fcScrape: [] }, MODE2 = { serp: 200, fcSearch: 200, fcScrape: 200 };
  await pg.route('https://serpapi.com/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    SEEN2.serp.push(req.url());
    if (MODE2.serp != 200) return route.fulfill({ status: MODE2.serp, headers: cors, contentType: 'application/json', body: '{"error":"Invalid API key"}' });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ answer_box: { answer: 'Serp answer.' }, organic_results: [{ title: 'S1', link: 'https://one.example/a', snippet: 'serp one' }, { title: 'S1 dup', link: 'https://www.one.example/a/', snippet: 'dup of one' }, { title: 'S2', link: 'https://two.example/b', snippet: 'serp two' }, { title: 'S3', link: 'https://three.example/c', snippet: 'serp three' }] }) });
  });
  await pg.route('https://api.firecrawl.dev/**', async route => {
    const req = route.request(); if (req.method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() || '{}'), u = req.url();
    if (/\/v1\/search/.test(u)) { SEEN2.fcSearch.push(body); if (MODE2.fcSearch != 200) return route.fulfill({ status: MODE2.fcSearch, headers: cors, contentType: 'application/json', body: '{}' }); return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ url: 'https://fc.example/x', title: 'FC1', description: 'firecrawl result' }] }) }); }
    SEEN2.fcScrape.push(body.url);
    if (MODE2.fcScrape != 200) return route.fulfill({ status: MODE2.fcScrape, headers: cors, contentType: 'application/json', body: '{}' });
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data: { markdown: '# Page ' + body.url + '\n\n' + ('Body text for the page that is long enough to count. needle-' + body.url.length + '. ').repeat(400) } }) });
  });

  // fake Capacitor + native EmberYoutube plugin (what the APK provides)
  await pg.addInitScript(() => {
    window.__yt = { search: [], dl: [] };
    window.Capacitor = { Plugins: {}, isNativePlatform: () => true, isPluginAvailable: n => n == 'EmberYoutube', registerPlugin: n => n != 'EmberYoutube' ? undefined : ({
      search: async o => { window.__yt.search.push(o); return { results: [{ title: 'Song A', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA', channel: 'Ch', durationSec: 200 }] }; },
      downloadVideo: async o => { window.__yt.dl.push(o); return { jobId: 'job-1' }; },
      status: async () => ({ state: 'done', title: 'Song A', detail: 'Music/Ember/Song A.m4a', at: 1 }) }) };
    if (!localStorage.getItem('ember_keys')) localStorage.setItem('ember_keys', JSON.stringify({ groq: [{ key: 'gsk_TESTgroqKEY1234567890abcdefGHIJ', st: null }] }));
    if (!localStorage.getItem('ember_set')) localStorage.setItem('ember_set', JSON.stringify({ freeMode: false, name: 'Fezzy', defaultsV1924: true }));
  });
  await pg.goto(url); await pg.waitForFunction(() => window.__ember && window.__ember.ready); await pg.waitForTimeout(400);
  const ev = f => pg.evaluate(f), A = (n, a) => pg.evaluate(([n, a]) => window.EmberAgentAddon.dispatch(n, a), [n, a]);
  const intent = (t, p) => pg.evaluate(([t, p]) => window.EmberAgentAddon.setIntent(t, p), [t, p || '']);

  // ---------- 1. tool lists follow the switches ----------
  const names = S => pg.evaluate(S => window.EmberAgentAddon.toolsFor(S).map(t => t.name).join(','), S);
  ok('no switch on = no agent tools', await names({}) == '');
  ok('Web Search on = web_search only', await names({ agentAddon: true }) == 'web_search');
  ok('web_search tool text names the DuckDuckGo fallback', /DuckDuckGo/.test(await pg.evaluate(() => window.EmberAgentAddon.toolsFor({ agentAddon: true })[0].description)));
  ok('YouTube on = youtube_search + youtube_download', await names({ youtubeAddon: true }) == 'youtube_search,youtube_download,playlist_list,playlist_download');
  ok('Vision on = see_image only', await names({ visionAddon: true }) == 'see_image');

  // ---------- 2. Tavily ----------
  // no Tavily key: DuckDuckGo answers, Tavily is never called
  let r = await A('web_search', { query: 'apple pie', max_results: 3 });
  ok('web_search without a key falls back to DuckDuckGo and makes no Tavily request', !r.error && r.source == 'DuckDuckGo' && SEEN.tavily.length == 0 && SEEN.ddg.length == 1, { r, ddg: SEEN.ddg });
  ok('DuckDuckGo request is the Instant Answer JSON URL with the encoded query', /^https:\/\/api\.duckduckgo\.com\/\?q=apple%20pie&format=json&no_html=1/.test(SEEN.ddg[0] || ''), SEEN.ddg);
  ok('DuckDuckGo result: abstract answer, abstract link first, nested topics flattened, capped by max_results', r.answer == 'An apple is a fruit.' && r.results.length == 3 && r.results[0].url == 'https://en.wikipedia.org/wiki/Apple' && r.results[2].url == 'https://duckduckgo.com/Granny_Smith' && /untrusted/.test(r.note), r);
  MODE.ddg = 'empty'; r = await A('web_search', { query: 'news today' });
  ok('DuckDuckGo with nothing to say is an honest empty result, not an error', !r.error && r.results.length == 0 && r.source == 'DuckDuckGo' && /not news/.test(r.note), r);
  MODE.ddg = 'http'; r = await A('web_search', { query: 'x' });
  ok('no key and DuckDuckGo down -> one clear error naming both', /^No Tavily key, and DuckDuckGo answered HTTP 500/.test(r.error || ''), r);
  // V1.9.24: an ordinary name: Instant Answer is empty, the web-results fallback finds the page
  MODE.ddg = 'empty'; MODE.html = 'ok'; r = await A('web_search', { query: 'Jane Doe Cape Town' });
  ok('name search: empty Instant Answer falls through to DuckDuckGo web results', !r.error && r.source == 'DuckDuckGo web' && r.results.length == 2 && r.results[0].url == 'https://example.org/jane-doe' && /Cape Town/.test(r.results[0].snippet), r);
  ok('name search: the note tells the AI not to invent facts about a person', /Never invent facts about a person/.test(r.note || ''), r);
  MODE.html = 'down'; MODE.wiki = 'ok'; r = await A('web_search', { query: 'Jane Doe' });
  ok('name search: web results down -> Wikipedia answers', !r.error && r.source == 'Wikipedia' && r.results[0].title == 'Jane Doe' && !/<span/.test(r.results[0].snippet), r);
  MODE.wiki = 'down'; MODE.html = 'down';
  MODE.ddg = 'ok';
  ok('no key: the AI state text says DuckDuckGo, not "will fail"', await pg.evaluate(() => { const t = window.EmberAgentAddon.stateBlock({ agentAddon: true }); return /DuckDuckGo/.test(t) && !/will fail/.test(t); }));
  ok('no key: the app block says search is ON through DuckDuckGo', await pg.evaluate(() => /Live web search is ON through DuckDuckGo only/.test(window.EmberKnow.block({ agentAddon: true }, {}))));
  ok('Agent switch off: the app block says OFF and that no key is needed', await pg.evaluate(() => /Live web search is OFF \(switch it on[^)]*no key is needed/.test(window.EmberKnow.block({}, {}))));
  await ev(() => window.EmberAgentAddon.setTavilyKey('  "Bearer tvly-TESTKEY123"  '));
  r = await A('web_search', { query: 'latest news', max_results: 2 });
  ok('web_search sends the cleaned key as Bearer and the query', SEEN.tavily.length == 1 && SEEN.tavily[0].auth == 'Bearer tvly-TESTKEY123' && SEEN.tavily[0].body.query == 'latest news' && SEEN.tavily[0].body.max_results == 2, SEEN.tavily);
  ok('web_search returns the answer plus results with url and snippet', r.answer == 'Mock answer.' && r.results.length == 2 && r.results[0].url == 'https://a.example/1' && r.results[0].snippet == 'c1', r);
  ok('with a key: the app block says Tavily with DuckDuckGo as backup', await pg.evaluate(() => /Tavily, DuckDuckGo as backup/.test(window.EmberKnow.block({ agentAddon: true }, {}))));
  // Tavily fails and DuckDuckGo has nothing: the original Tavily error comes back unchanged
  MODE.ddg = 'empty'; MODE.tavily = 401; r = await A('web_search', { query: 'x' });
  ok('web_search 401 -> clear key-rejected error', /rejected the key/.test(r.error || ''), r);
  MODE.tavily = 429; r = await A('web_search', { query: 'x' });
  ok('web_search 429 -> limit message', /limit/.test(r.error || ''), r);
  // Tavily fails but DuckDuckGo answers: fall back and say why
  MODE.ddg = 'ok'; MODE.tavily = 401; r = await A('web_search', { query: 'apple' });
  ok('Tavily 401 falls back to DuckDuckGo and the note says why', !r.error && r.source == 'DuckDuckGo' && /Tavily failed/.test(r.note) && /rejected the key/.test(r.note), r);
  MODE.tavily = 200; const ddgBefore = SEEN.ddg.length; r = await A('web_search', { query: 'apple' });
  ok('Tavily working = DuckDuckGo is not called and the source says Tavily', r.source == 'Tavily' && SEEN.ddg.length == ddgBefore, r);
  ok('web_search empty query is refused', !!(await A('web_search', { query: '   ' })).error);
  ok('the key is not in the backup-able settings', !(await ev(() => localStorage.getItem('ember_set') || '')).includes('TESTKEY123'));


  // ---------- 2b. V1.9.13: web_search failover through scraper keys, and search_and_read ----------
  await ev(() => window.EmberAgentAddon.setTavilyKey(''));
  await ev(() => { const S = window.EmberScraper; S.setKey('serpapi', 'SERPSECRETKEY0123456789abcdef'); S.setKey('firecrawl', 'fc-FIRESECRET0123456789abcdef'); S.setReader(false); });
  ok('chain: no Tavily key + SerpApi key = SerpApi answers, DuckDuckGo not called', await (async () => { const d0 = SEEN.ddg.length; const x = await A('web_search', { query: 'chain one', max_results: 3 }); return !x.error && x.source == 'SerpApi' && x.answer == 'Serp answer.' && x.results[0].url == 'https://one.example/a' && SEEN.ddg.length == d0 && SEEN.tavily.length == SEEN.tavily.length; })());
  ok('chain: the SerpApi request carries the key and the query', /q=chain%20one/.test(SEEN2.serp[0] || '') && /api_key=SERPSECRETKEY0123456789abcdef/.test(SEEN2.serp[0] || ''), SEEN2.serp);
  ok('chain: the AI state text names the engine order', await ev(() => /SerpApi > Firecrawl > DuckDuckGo/.test(window.EmberAgentAddon.stateBlock({ agentAddon: true }))));
  ok('chain: the app block lists the engines', await ev(() => /Live web search is ON \(SerpApi > Firecrawl > DuckDuckGo\)/.test(window.EmberKnow.block({ agentAddon: true }, {}))));
  MODE2.serp = 401; r = await A('web_search', { query: 'chain two' });
  ok('chain: a rejected SerpApi key falls to Firecrawl search and the result says why', !r.error && r.source == 'Firecrawl' && r.tried && /SerpApi: key rejected/.test(r.tried[0]) && /Skipped/.test(r.note), r);
  ok('chain: the SerpApi key is not echoed anywhere in that result', !JSON.stringify(r).includes('SERPSECRETKEY'), r);
  const serpN = SEEN2.serp.length; r = await A('web_search', { query: 'chain three' });
  ok('chain: a rejected key is not retried right away (no repeat call, no double billing)', SEEN2.serp.length == serpN && r.source == 'Firecrawl', { serpN, now: SEEN2.serp.length });
  MODE2.fcSearch = 500; MODE.ddg = 'ok'; r = await A('web_search', { query: 'apple' });
  ok('chain: every keyed engine down -> DuckDuckGo answers and the note lists what was skipped', !r.error && r.source == 'DuckDuckGo' && /Skipped:/.test(r.note) && /Firecrawl/.test(r.note), r);
  MODE.ddg = 'http'; r = await A('web_search', { query: 'x' });
  ok('chain: everything down -> one error naming every engine, no key text', /^Every search engine failed\./.test(r.error || '') && /DuckDuckGo/.test(r.error) && !/FIRESECRET|SERPSECRET/.test(r.error), r);
  MODE.ddg = 'ok'; MODE2.fcSearch = 200; MODE2.serp = 200;
  await ev(() => { window.EmberScraper._dead['s:serpapi'] = 0; window.EmberScraper._dead['s:firecrawl'] = 0; });
  await ev(() => window.EmberScraper.setOn(false)); // 1.9.91: keys-only installs are auto-enabled; OFF must now be explicit.
  ok('search_and_read is not offered while Web Scraping is off', await names({ agentAddon: true }) == 'web_search');
  await ev(() => window.EmberScraper.setOn(true));
  ok('search_and_read is offered with both switches on', await names({ agentAddon: true }) == 'web_search,search_and_read');
  ok('search_and_read is not offered when Web Search is off', await names({}) == '');
  r = await A('search_and_read', { query: 'needle topic', count: 2 });
  const jlen = JSON.stringify(r).length;
  ok('search_and_read opens two different pages (a duplicate of the first is skipped)', !r.error && r.pages.length == 2 && r.pages[0].url == 'https://one.example/a' && r.pages[1].url == 'https://two.example/b' && SEEN2.fcScrape.length == 2, { r: r.error || r.pages.map(x => x.url), seen: SEEN2.fcScrape });
  ok('search_and_read result fits under the 9000-character tool-result limit', jlen < 9000, jlen);
  ok('search_and_read trims each page to its share of the budget and says which engine searched', r.pages.every(x => x.markdown.length <= 3000 && x.trimmed === true) && r.search_source == 'SerpApi', r.pages.map(x => x.markdown.length));
  ok('search_and_read reports the unopened results and the untrusted-content warning', r.also_found.length >= 1 && /untrusted/.test(r.note), r.also_found);
  const f0 = SEEN2.fcScrape.length; MODE2.fcScrape = 500; r = await A('search_and_read', { query: 'needle topic two', count: 1 });
  ok('search_and_read: when only SerpApi snippets could be had, the page is flagged degraded (not passed off as the page)', !r.error && r.pages.length == 1 && r.pages[0].degraded === true && /NOT the page/.test(r.pages[0].markdown) && /degraded/.test(r.note), r);
  await ev(() => { window.EmberScraper.setKey('serpapi', ''); });
  r = await A('search_and_read', { query: 'needle topic three', count: 1 });
  ok('search_and_read: a page that cannot be opened is reported as an error entry, not hidden', !r.error && r.pages.length == 1 && /Every provider failed/.test(r.pages[0].error || '') && SEEN2.fcScrape.length > f0, r);
  MODE2.fcScrape = 200;
  await ev(() => window.EmberScraper.setOn(false));
  ok('search_and_read refuses with a clear message when Web Scraping is off', /Web Scraping is off/.test((await A('search_and_read', { query: 'x' })).error || ''));
  ok('search_and_read refuses an empty query', !!(await A('search_and_read', { query: ' ' })).error);
  await ev(() => { const S = window.EmberScraper; S.setKey('serpapi', ''); S.setKey('firecrawl', ''); S.setReader(true); });
  ok('chain: with no scraper keys left, web_search is back to Tavily/DuckDuckGo only', await ev(() => window.EmberAgentAddon.searchChain().join('>') == 'DuckDuckGo'));
  await ev(() => window.EmberAgentAddon.setTavilyKey('  "Bearer tvly-TESTKEY123"  '));

  // ---------- 3. Vision ----------
  ok('see_image refuses http and javascript: links', !!(await A('see_image', { image_url: 'http://x.example/a.png' })).error && !!(await A('see_image', { image_url: 'javascript:alert(1)' })).error && SEEN.poll.length == 0);
  r = await A('see_image', { image_url: 'https://x.example/a.png', prompt: 'what colour?' });
  const sent = SEEN.poll[0] || {}, parts = sent.messages && sent.messages[0].content || [];
  ok('see_image posts text + image_url parts', parts.length == 2 && parts[0].text == 'what colour?' && parts[1].image_url.url == 'https://x.example/a.png', sent);
  ok('see_image returns the real description', r.description == 'A red square on white.', r);
  MODE.poll = 500; r = await A('see_image', { image_url: 'https://x.example/b.png' });
  ok('see_image failure is an error, never an invented description', !!r.error && !r.description && /do not guess/i.test(r.error), r); MODE.poll = 200;

  // ---------- 4. YouTube gate ----------
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('download refused when he did not ask', /did not ask/.test(r.error || '') && (await ev(() => window.__yt.dl.length)) == 0, r);
  await intent('download this https://youtu.be/BBBBBBBBBBB?si=zz', '');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ' });
  ok('download refused for a link that never came from him or the search', /did not come from/.test(r.error || '') && (await ev(() => window.__yt.dl.length)) == 0, r);
  r = await A('youtube_download', { url: 'https://evil.example/watch?v=BBBBBBBBBBB' });
  ok('download refused for non-YouTube hosts', /youtube\.com or youtu\.be/.test(r.error || '') && (await ev(() => window.__yt.dl.length)) == 0, r);
  r = await A('youtube_download', { url: 'https://youtu.be/BBBBBBBBBBB?si=zz&list=PLx', title: 'My: song/1' });
  const dl = await ev(() => window.__yt.dl);
  ok('download of his own link starts and sends a clean watch URL', r.ok === true && dl.length == 1 && dl[0].url == 'https://www.youtube.com/watch?v=BBBBBBBBBBB' && dl[0].title == 'My: song/1', { r, dl });
  await intent('find me Song A on youtube', '');
  r = await A('youtube_search', { query: 'Song A' });
  ok('youtube_search returns results from the native plugin', r.results && r.results[0].title == 'Song A' && (await ev(() => window.__yt.search[0].limit)) == 5, r);
  await intent('yes', 'download it');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('a short "yes" after he asked to download counts, for a link from the search', r.ok === true, r);
  await intent('how are you doing today', 'download it');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('an unrelated question after a download request does not authorise one', /did not ask/.test(r.error || ''), r);

  // V1.9.21: plain-talk requests open the gate
  await intent('get me Song A', '');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('"get me Song A" authorises a download (natural talk)', r.ok === true, r);
  await intent('can you put Song A on my phone', '');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('"put Song A on my phone" authorises a download', r.ok === true, r);
  await intent('yes the first one', 'get me Song A');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('a short follow-up after a plain "get me" request counts', r.ok === true, r);
  await intent('what is the weather like', '');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
  ok('an unrelated message still does not authorise one', /did not ask/.test(r.error || ''), r);
  await intent('get me Song A', '');
  r = await A('youtube_download', { url: 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ' });
  ok('natural talk still cannot download a video id that was never seen', /did not come from him/.test(r.error || ''), r);

  // ---------- 5. settings UI + prompt ----------
  await pg.click('#bSet').catch(() => {}); await pg.waitForTimeout(200);
  const hasUi = await ev(() => ['swAgent', 'swYoutube', 'swVision', 'keyTavily', 'agentStatus'].every(i => !!document.getElementById(i)));
  ok('Agent & API Tools card exists with its switches and key box', hasUi);
  ok('settings card names DuckDuckGo and says the Tavily key is optional', await ev(() => { const c = document.getElementById('swAgent').parentElement.parentElement.textContent; return /Tavily \+ DuckDuckGo/.test(c) && /Tavily API key \(optional\)/.test(c) && /Check search/.test(c); }));
  const checkOut = async () => { await ev(() => { document.getElementById('tavilyOut').textContent = ''; document.getElementById('bTavilyTest').click(); }); await pg.waitForFunction(() => /Works|Failed|Reached/.test(document.getElementById('tavilyOut').textContent), null, { timeout: 8000 }); return ev(() => document.getElementById('tavilyOut').textContent); };
  ok('Check search with a Tavily key says Works via Tavily', /Works via Tavily/.test(await checkOut()));
  await ev(() => window.EmberAgentAddon.setTavilyKey(''));
  const noKeyOut = await checkOut();
  ok('Check search with no key says Works via DuckDuckGo', /Works via DuckDuckGo/.test(noKeyOut), noKeyOut);
  await ev(() => window.EmberAgentAddon.setTavilyKey('  "Bearer tvly-TESTKEY123"  '));
  await ev(() => { document.getElementById('swAgent').click(); document.getElementById('swYoutube').click(); document.getElementById('swVision').click(); });
  const st = await ev(() => JSON.parse(localStorage.getItem('ember_set')));
  ok('switches save agentAddon / youtubeAddon / visionAddon', st.agentAddon && st.youtubeAddon && st.visionAddon, st);
  ok('switch classes follow the state', await ev(() => ['swAgent', 'swYoutube', 'swVision'].every(i => document.getElementById(i).classList.contains('on'))));
  await pg.waitForTimeout(300);
  ok('status line shows the native downloader and the last download', /ready/.test(await ev(() => document.getElementById('agentStatus').textContent)) && /Song A/.test(await ev(() => document.getElementById('agentStatus').textContent)), await ev(() => document.getElementById('agentStatus').textContent));
  const sys = await ev(() => Persona.buildSystem({ S: JSON.parse(localStorage.getItem('ember_set')), mem: { facts: [], threads: [], callbacks: [], patterns: {}, moodLog: [], futureLetters: [], deck: [] }, conv: { msgs: [] }, deep: false, lane: 'fast' }));
  ok('prompt lists web_search, youtube_download and see_image with the state line', /web_search/.test(sys) && /youtube_download/.test(sys) && /see_image/.test(sys) && /AGENT TOOLS STATE/.test(sys));
  const sysOff = await ev(() => Persona.buildSystem({ S: {}, mem: { facts: [], threads: [], callbacks: [], patterns: {}, moodLog: [], futureLetters: [], deck: [] }, conv: { msgs: [] }, deep: false, lane: 'fast' }));
  ok('prompt has none of them when the switches are off', !/web_search|youtube_download|see_image/.test(sysOff));

  // ---------- 6. through the chat ----------
  await pg.evaluate(() => { const b = document.getElementById('bSetX') || document.querySelector('#settings .x, #bSx'); if (b) b.click(); });
  await ev(() => { const s = document.getElementById('settings'); if (s) s.classList.add('hidden'); });
  const send = async t => { await pg.fill('#inp', t); await pg.click('#bSend'); await pg.waitForFunction(() => !document.getElementById('typ') && !document.getElementById('bSend').disabled, null, { timeout: 20000 }); await pg.waitForTimeout(400); };
  const before = SEEN.tavily.length;
  MODE.first = '<tool_call>{"tool":"web_search","args":{"query":"mars news"}}</tool_call>';
  await send('search the web for mars news');
  ok('chat: the model asked for web_search and Tavily was called', SEEN.tavily.length == before + 1 && SEEN.tavily[before].body.query == 'mars news', SEEN.tavily.length);
  ok('chat: the model saw the tool result and its answer is shown', /Mock answer\./.test((SEEN.groq[SEEN.groq.length - 1] || {}).last || '') && /Here is what I found/.test(await pg.locator('#log').innerText()));
  const dls = (await ev(() => window.__yt.dl.length));
  MODE.first = '<tool_call>{"tool":"youtube_download","args":{"url":"https://www.youtube.com/watch?v=AAAAAAAAAAA"}}</tool_call>';
  await send('what is the weather like');
  ok('chat: an unprompted youtube_download from the model does nothing', (await ev(() => window.__yt.dl.length)) == dls);
  MODE.first = '';

  ok('no page errors during the whole run', errs.length == 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message); process.exit(1); });
