// Full UI + real browser sealed-box encryption, mocked GitHub only.
'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '../www'), BRAIN = 'fezzymultiverse/ember-brain', OUT = 'me/output', TOKEN = 'ghp_' + 'a'.repeat(36);
let passed = 0; function check(name, value) { assert(value, name); console.log('PASS ' + name); passed++; }
const server = http.createServer((req, res) => {
  const p = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.png') ? 'image/png' : 'text/html'); res.end(b); });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' }), errors = [], calls = [], encrypted = [], trees = [];
    let publicOutput = false, committedManifest = null;
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept()); // v1.9.95 explicit install/sync confirmation.
    await page.route('https://**/*', async route => {
      const rq = route.request(), u = new URL(rq.url()), p = decodeURIComponent(u.pathname), method = rq.method();
      const json = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(x) });
      if (u.hostname !== 'api.github.com') return json({});
      calls.push({ path: p, method, body: rq.postData() });
      if (p === '/search/repositories') return json({ total_count: 1, items: [{ full_name: 'owner/addon', description: '<img src=x onerror="alert(1)">', license: { spdx_id: 'MIT' } }] });
      if (p === '/user/repos') return json([{ full_name: OUT, private: true, permissions: { push: true } }]);
      if (p === '/repos/' + BRAIN || p === '/repos/' + OUT || p === '/repos/owner/addon') return json({ full_name: p.slice(7), default_branch: 'main', private: p === '/repos/' + OUT ? !publicOutput : true, permissions: { push: true } });
      if (p === '/repos/' + OUT + '/actions/workflows/build.yml') return json({ id: 1, path: '.github/workflows/build.yml' });
      if (p.endsWith('/actions/secrets/public-key')) {
        const key = await page.evaluate(() => { window.__secretPair = sodium.crypto_box_keypair(); return sodium.to_base64(window.__secretPair.publicKey, sodium.base64_variants.ORIGINAL); });
        return json({ key_id: 'key-1', key });
      }
      if (p.endsWith('/actions/secrets/EMBER_REPO_TOKEN')) { encrypted.push(JSON.parse(rq.postData())); return json(null, 201); }
      if (p.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'head-old' } });
      if (p.endsWith('/git/commits/head-old')) return json({ tree: { sha: 'tree-old' } });
      if (p.endsWith('/git/trees') && method === 'POST') { const b = JSON.parse(rq.postData()); trees.push(b); committedManifest = JSON.parse(b.tree.find(x => x.path === 'ember-repos.json').content); return json({ sha: 'tree-new' }, 201); }
      if (p.endsWith('/git/commits') && method === 'POST') return json({ sha: 'head-new' }, 201);
      if (p.endsWith('/git/refs/heads/main')) return json({ object: { sha: 'head-new' } });
      if (p.endsWith('/contents/ember-repos.json')) return json({ content: Buffer.from(JSON.stringify(committedManifest)).toString('base64') });
      if (p.endsWith('/ember-repo-sync.yml/dispatches')) return json(null, 204);
      if (p.endsWith('/ember-repo-sync.yml/runs')) return json({ workflow_runs: [{ id: 99, status: 'completed', conclusion: 'success', html_url: 'https://github.com/me/output/actions/runs/99' }] });
      if (p.includes('/git/trees/')) return json({ sha: 'root', truncated: false, tree: [{ path: 'vendor/fresh.odd', sha: 'blob', type: 'blob', size: 30 }] });
      if (p.endsWith('/git/blobs/blob')) return json({ encoding: 'base64', content: Buffer.from('fresh needle example\nnew text').toString('base64') });
      return json({ message: 'Not Found' }, 404);
    });
    await page.addInitScript(({ token }) => localStorage.setItem('ember_github', JSON.stringify({ token, cfg: { auto: false, sync: false } })), { token: TOKEN });
    await page.goto('http://127.0.0.1:' + server.address().port); await page.waitForFunction(() => window.__ember && window.__ember.ready);
    await page.click('#bSet'); await page.click('#acc_h_features');
    check('Features accordion exposes Repo Runner controls', await page.locator('#rrTarget').isVisible());
    check('whole brain is always included without file-selection UI', (await page.innerText('#rrSources')).includes(BRAIN) && await page.locator('[data-rr-remove="' + BRAIN + '"]').count() === 0);
    await page.fill('#rrSearch', 'repo'); await page.click('[data-rr="search"]'); await page.waitForSelector('[data-rr-add="owner/addon"]');
    check('repo search renders untrusted description safely', await page.locator('#rrResults img').count() === 0 && (await page.innerText('#rrResults')).includes('<img'));
    await page.click('[data-rr-add="owner/addon"]'); check('adding a result includes its entire repo', (await page.innerText('#rrSources')).includes('owner/addon'));
    await page.click('[data-rr="owned"]'); await page.waitForSelector('[data-rr-target="me/output"]'); await page.click('[data-rr-target="me/output"]'); await page.click('[data-rr="save"]');
    check('output selection does not redirect brain reads', await page.evaluate(() => EmberGithub.knowledgeRepo()) === BRAIN && await page.inputValue('#rrTarget') === OUT);
    check('search, add and settings save make no GitHub writes', calls.every(x => x.method === 'GET'));
    const artifact = await page.evaluate(() => EmberRepoRunner.feature()); new vm.Script(artifact.content);
    check('Add runner to output generates a standalone valid script without token', artifact.title === 'ember-repo-runner.cjs' && !artifact.content.includes(TOKEN) && artifact.content.includes(OUT));
    await page.click('[data-rr="install"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('"installed": true'));
    check('install provisions an encrypted Actions secret with real libsodium', encrypted.length === 1 && !JSON.stringify(encrypted).includes(TOKEN));
    const decrypted = await page.evaluate(encryptedValue => sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(encryptedValue, sodium.base64_variants.ORIGINAL), __secretPair.publicKey, __secretPair.privateKey)), encrypted[0].encrypted_value);
    check('encrypted runner secret decrypts to the exact saved token', decrypted === TOKEN);
    check('install commits three managed files atomically on existing base tree', trees.length === 1 && trees[0].base_tree === 'tree-old' && trees[0].tree.length === 3);
    const workflow = trees[0].tree.find(x => x.path.endsWith('.yml')).content;
    check('workflow extraction preserves GitHub expressions exactly', workflow === require('../www/repo-runner-template.cjs').WORKFLOW);
    check('runner workflow is dispatched on the explicit default branch', calls.some(x => x.method === 'POST' && x.path.endsWith('/ember-repo-sync.yml/dispatches') && JSON.parse(x.body).ref === 'main'));
    check('install result does not pretend the remote build already succeeded', (await page.innerText('#rrStatus')).includes('check run status'));
    await page.click('[data-rr="sync"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('"dispatched": true'));
    check('sync uses the committed manifest', calls.some(x => x.path.endsWith('/contents/ember-repos.json')));
    await page.fill('#rrSource', 'owner/later'); await page.click('[data-rr="add"]'); await page.click('[data-rr="sync"]');
    await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('settings changed'));
    check('sync refuses unpublished source changes instead of silently syncing old repos', (await page.innerText('#rrStatus')).includes('Install / update first'));
    publicOutput = true; const before = calls.filter(x => x.method !== 'GET').length;
    await page.click('[data-rr="install"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('Private sources cannot'));
    check('private-to-public export is blocked before any secret or commit write', calls.filter(x => x.method !== 'GET').length === before);
    await page.click('#acc_h_github'); await page.locator('summary').filter({ hasText: 'Files · live GitHub API' }).click();
    await page.selectOption('#ghFindMode', 'grep'); await page.fill('#ghQuery', 'needle'); await page.click('[data-gh-action="find"]');
    await page.waitForFunction(() => document.querySelector('#ghFileList').textContent.includes('fresh needle'));
    check('whole-repo grep UI shows fresh nonstandard-extension content and line numbers', (await page.innerText('#ghFileList')).includes('vendor/fresh.odd') && (await page.innerText('#ghFileList')).includes('1: fresh needle'));
    check('browser has no runtime errors including encryption loader', errors.length === 0);
    console.log('\n' + passed + ' repo-runner Chromium checks passed.');
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
