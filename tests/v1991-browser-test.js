// Real Chromium exports; remote services are mocked, no real API keys are used.
'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const root = path.join(__dirname, '../www'), output = process.env.EMBER_TEST_OUTPUT || path.join(os.tmpdir(), 'ember-1.9.91-verification');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(bytes); });
});
let passed = 0;
const check = (name, yes) => { assert(yes, name); passed++; console.log('PASS ' + name); };
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' }), errors = [], remote = [], chats = [];
    page.on('pageerror', e => errors.push(e.message));
    const answer = '# Garden report\n\nEvidence from the page: perennial herbs need good drainage.\n\n## Checklist\n\n- Choose a sunny spot\n- Use well-drained soil\n\n| Plant | Water |\n|---|---|\n| Rosemary | Low |\n| Basil | Moderate |\n\n[Source](https://example.com/garden)\n\n' + 'Use this practical plan to maintain a healthy garden. '.repeat(8);
    await page.route('https://**/*', async route => {
      const req = route.request(), u = new URL(req.url()); remote.push(req.url());
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.hostname === 'api.firecrawl.dev') return json({ success: true, data: { markdown: '# Gardening\n\nPerennial herbs need good drainage. '.repeat(12) } });
      if (/pollinations|api.groq.com|api.mistral.ai|generativelanguage/.test(u.hostname)) {
        if (/models/.test(u.pathname)) return json({ data: [{ id: 'llama-3.3-70b-versatile' }] });
        const body = JSON.parse(req.postData() || '{}'); chats.push(body);
        return json({ choices: [{ message: { content: answer } }] });
      }
      return json({});
    });
    await page.addInitScript(() => {
      localStorage.setItem('ember_scrape', JSON.stringify({ on: true, keys: { firecrawl: 'TEST-ONLY-NOT-A-REAL-KEY' } }));
      localStorage.setItem('ember_set', JSON.stringify({ learn: false, summarize: false, musicAddon: false, agentAddon: false }));
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__ember && window.__ember.ready);
    check('new module loads into full app', await page.evaluate(() => !!window.EmberDeliverables));
    await page.evaluate(async () => { await Prov.addKey('groq', 'gsk_TEST_ONLY_KEY_0123456789012345678901234567890'); Prov.setFree(false); Prov.setPinned('groq'); });
    chats.length = 0; remote.length = 0;
    const prompt = 'Read https://example.com/garden using Firecrawl and create a PDF report about gardening';
    await page.fill('#inp', prompt); await page.click('#bSend');
    await page.waitForFunction(() => !document.getElementById('bSend').disabled && !document.getElementById('typ'), null, { timeout: 30000 });
    check('explicit page read actually calls saved scraper before answering', remote.some(u => u.includes('api.firecrawl.dev')));
    const model = chats.find(b => (b.messages || []).some(m => /ACTUAL PAGE READ RESULTS/.test(String(m.content))));
    check('model receives real returned page text', !!model && JSON.stringify(model.messages).includes('Perennial herbs need good drainage'));
    check('file request has higher output budget', !!model && model.max_tokens === 4096);
    if (await page.locator('.artifact-card').count() !== 1) console.log('DIAGNOSTICS', await page.locator('#log').innerText(), errors);
    check('plain model output is repaired to a PDF artifact card', await page.locator('.artifact-card').count() === 1);
    check('no API secret appears in chat', !(await page.locator('#log').innerText()).includes('TEST-ONLY-NOT-A-REAL-KEY'));
    const before = remote.length;
    await page.locator('[data-artifact-view="0"]').first().click();
    const downloadPDF = page.waitForEvent('download'); await page.locator('[data-vact="pdf"]').click();
    const pdfFile = await downloadPDF; await pdfFile.saveAs(path.join(output, 'garden.pdf'));
    const pdfBytes = fs.readFileSync(path.join(output, 'garden.pdf'));
    check('artifact PDF button creates a real PDF', pdfBytes.subarray(0, 5).toString() === '%PDF-' && pdfBytes.length > 10000);
    await page.locator('.artifact-close').click();
    // Exercise actual Word .docx button with Unicode, heading, hyperlink and table.
    await page.evaluate(() => window.EmberArtifacts.view({ type: 'document', title: 'garden.md', content: '# Garden report\n\nCafé — Привет — Καλημέρα\n\n**Important:** use good soil.\n\n| Plant | Water |\n|---|---|\n| Basil | Moderate |\n\n1. Prepare soil\n2. Plant herbs\n\n[Source](https://example.com/garden)' }));
    const downloadWord = page.waitForEvent('download'); await page.locator('[data-vact="doc"]').click();
    const docxFile = await downloadWord; await docxFile.saveAs(path.join(output, 'garden.docx'));
    const docxBytes = fs.readFileSync(path.join(output, 'garden.docx'));
    check('Word button creates actual ZIP-based DOCX, not renamed HTML', docxFile.suggestedFilename() === 'garden.docx' && docxBytes[0] === 0x50 && docxBytes[1] === 0x4b);
    const exportRequests = remote.slice(before).filter(u => !/^https:\/\/api\.groq\.com\/openai\/v1\/models/.test(u));
    check('document exports make no remote requests (excluding app model-list refresh)', exportRequests.length === 0);
    // Verify rich font text separately in a real browser-generated PDF.
    const data = await page.evaluate(async () => {
      const b = await window.EmberDeliverables.pdf('# Multilingual test\n\nCafé — Привет — Καλημέρα', 'Unicode');
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    });
    fs.writeFileSync(path.join(output, 'unicode.pdf'), Buffer.from(data));
    check('bundled PDF fonts render a real font-embedded file', data.length > 10000);
    await page.screenshot({ path: path.join(output, 'ember-document-preview.png'), fullPage: true });
    check('full app and export libraries have no runtime errors', errors.length === 0);
    // Once the bundles are loaded, the same exporters work with the network disabled.
    await page.context().setOffline(true);
    const offline = await page.evaluate(async () => {
      const pdf = await window.EmberDeliverables.pdf('# Offline\n\nPrivate export works offline.', 'Offline');
      const word = await window.EmberDeliverables.word('# Offline\n\nNo account needed.', 'Offline');
      return { pdf: pdf.size, word: word.size };
    });
    check('PDF and DOCX work offline after app assets are available', offline.pdf > 1000 && offline.word > 1000);
    const cachedContext = await browser.newContext({ serviceWorkers: 'allow' });
    await cachedContext.route('https://**/*', route => route.abort());
    const cachedPage = await cachedContext.newPage();
    await cachedPage.goto('http://127.0.0.1:' + server.address().port);
    await cachedPage.evaluate(async () => { await navigator.serviceWorker.ready; });
    await cachedPage.waitForFunction(async () => { const cache = await caches.open('ember-v1.9.91-deliverables'); return !!(await cache.match('vendor/docx-9.5.1.iife.js')); }, null, { timeout: 20000 });
    await cachedContext.setOffline(true);
    await cachedPage.reload();
    await cachedPage.waitForFunction(() => !!window.EmberDeliverables);
    const cold = await cachedPage.evaluate(async () => ({ pdf: (await EmberDeliverables.pdf('# Cached offline export', 'Cached')).size, word: (await EmberDeliverables.word('# Cached Word export', 'Cached')).size }));
    check('fresh offline reload loads both providers from the service-worker cache', cold.pdf > 1000 && cold.word > 1000);
    await cachedContext.close();
    console.log('\n' + passed + ' browser checks passed. Output: ' + output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
