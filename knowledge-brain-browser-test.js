// Full app smoke test with mocked GitHub and mocked chat engines; no real credentials.
'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.join(__dirname, '../www'), REPO = 'fezzymultiverse/ember-brain', TOKEN = 'ghp_' + 'a'.repeat(36);
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(data); });
});
let passed = 0;
const check = (name, condition) => { assert(condition, name); console.log('PASS ' + name); passed++; };
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' }), errors = [], requests = [];
    let chats = 0, deny = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.hostname === 'api.github.com') {
        requests.push({ url: request.url(), auth: request.headers().authorization, method: request.method() });
        if (deny) return json({ message: 'access denied' }, 403);
        if (url.pathname === '/user') return json({ login: 'mock-user' });
        if (url.pathname === '/repos/' + REPO) return json({ full_name: REPO, default_branch: 'main', permissions: { push: true } });
        if (url.pathname === '/repos/' + REPO + '/git/trees/main') return json({ sha: 'tree', truncated: false, tree: [{ path: 'README.md', type: 'blob', size: 35, sha: 'sha-readme' }, { path: 'www/app.js', type: 'blob', size: 50, sha: 'sha-code' }] });
        if (url.pathname === '/repos/' + REPO + '/contents') return json([{ name: 'README.md', type: 'file', size: 35 }, { name: 'www', type: 'dir' }]);
        if (url.pathname === '/repos/' + REPO + '/contents/www') return json([{ name: 'app.js', type: 'file', size: 50 }]);
        if (url.pathname.startsWith('/repos/' + REPO + '/contents/')) {
          const p = url.pathname.split('/contents/')[1], text = p === 'www/app.js' ? 'function renderAnswer() { return "verified"; }' : '# Knowledge Brain\nVerified project information.';
          return json({ type: 'file', content: Buffer.from(text).toString('base64'), size: text.length, sha: p === 'www/app.js' ? 'sha-code' : 'sha-readme' });
        }
        return json({ message: 'Not Found' }, 404);
      }
      if (/pollinations|api.groq.com|api.mistral.ai|generativelanguage/.test(url.hostname)) {
        if (/models/.test(url.pathname)) return json({ data: [{ id: 'llama-3.3-70b-versatile' }] });
        chats++;
        return json({ choices: [{ message: { content: 'I read www/app.js. The renderAnswer function returns the verified string.' } }] });
      }
      return json({});
    });
    await page.addInitScript(() => localStorage.setItem('ember_github', JSON.stringify({ cfg: { auto: false, sync: false }, slots: [{ id: 'old', repo: 'other/legacy' }] })));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__ember && window.__ember.ready);
    await page.click('#bSet'); await page.click('#acc_h_github');
    check('Settings GitHub shows exactly one defaulted Knowledge Brain Repo field', await page.locator('#ghBrainRepo').count() === 1 && await page.inputValue('#ghBrainRepo') === REPO);
    check('repository slot controls are absent', !/repo slots|Slot 1|Pin \(keep connected\)|Add a repo to slot/.test(await page.locator('#ghHub').innerText()));
    check('Runner controls are outside GitHub settings', await page.locator('#ghHub #ghRunnerEnabled').count() === 0);
    await page.click('#acc_h_advanced');
    check('Runner appears under Advanced and is off by default', await page.locator('#ghRunnerEnabled').isVisible() && !(await page.locator('#ghRunnerEnabled').isChecked()));
    await page.click('#acc_h_github');
    await page.fill('#ghTok', TOKEN); await page.click('[data-gh-action="save-token"]');
    check('token saves without exposing its value in the UI', await page.inputValue('#ghTok') === '' && /saved/.test(await page.innerText('#ghTokenStatus')));
    await page.click('[data-gh-action="check-token"]'); await page.waitForFunction(() => /Token works/.test(document.getElementById('ghTokenStatus').textContent));
    check('access check succeeds against the sole Super Repo', /mock-user/.test(await page.innerText('#ghTokenStatus')));
    await page.locator('summary').filter({ hasText: 'Files · live GitHub API' }).click();
    await page.click('[data-gh-action="root"]'); await page.waitForFunction(() => !!document.querySelector('[data-path="README.md"]'));
    await page.click('[data-path="www"]'); await page.click('[data-path="www/app.js"]');
    await page.waitForFunction(() => /renderAnswer/.test(document.getElementById('ghFileText').textContent));
    check('file browsing reads live without sync or Runner', /renderAnswer/.test(await page.innerText('#ghFileText')));
    await page.screenshot({ path: process.env.GH_SHOT || path.join(require('node:os').tmpdir(), 'ember-github-settings.png'), fullPage: true });
    await page.click('#bSx');
    const send = async text => { const stamp = await page.evaluate(() => window.EmberGithub.lastRead().at); await page.fill('#inp', text); await page.click('#bSend'); await page.waitForFunction(({ text, stamp }) => { const r = window.EmberGithub.lastRead(); return r.at !== stamp && r.q === text && !document.getElementById('typ') && !document.getElementById('bSend').disabled && !!document.querySelector('.msg.a:not(.typing), .msg.e'); }, { text, stamp }, { timeout: 20000 }); };
    await send('Explain www/app.js');
    if (!(await page.locator('.gh-last-read').count())) console.log('DIAGNOSTICS', await page.locator('#log').innerText(), 'runtime errors', errors, 'chat calls', chats, 'read', await page.evaluate(() => window.EmberGithub.lastRead()));
    check('code answer has real Last Read chip', await page.locator('.gh-last-read').count() === 1 && /www\/app.js/.test(await page.innerText('.gh-last-read')));
    check('chip carries revision and read timestamp', /sha-code/.test(await page.getAttribute('.gh-last-read', 'title')));
    check('all GitHub requests use saved token and the sole repository', requests.every(x => x.auth === 'Bearer ' + TOKEN && !x.url.includes('/repos/other/')));
    check('reading never triggered Actions or workflow requests', requests.every(x => !/\/actions\/|\/workflows\//.test(x.url) && x.method === 'GET'));
    await page.screenshot({ path: process.env.ANSWER_SHOT || path.join(require('node:os').tmpdir(), 'ember-answer-last-read.png'), fullPage: true });
    deny = true; const before = chats; await send('Explain the Python code');
    check('failed GitHub read blocks code before contacting any model', chats === before && /Read-First blocked/.test(await page.locator('.msg.e').innerText()));
    check('failed read does not add a forged Last Read chip', await page.locator('.gh-last-read').count() === 1);
    deny = false; await page.click('#bSet'); await page.click('#acc_h_github'); await page.click('[data-gh-action="remove-token"]'); await page.click('#bSx');
    const beforeMissing = chats; await send('Write a JavaScript function');
    check('missing token fails closed and leaves Send usable', chats === beforeMissing && /Read-First blocked/.test(await page.locator('.msg.e').innerText()) && await page.locator('#bSend').isEnabled());
    check('full app has no JavaScript runtime errors', errors.length === 0);
    console.log('\n' + passed + ' Chromium integration checks passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
