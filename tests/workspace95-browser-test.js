// Chromium integration: mocked GitHub, real DOM, encryption and cancellation. No live writes.
'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '../www'), TOKEN = 'ghp_' + 'a'.repeat(36), BRAIN = 'fezzymultiverse/ember-brain', OUT = 'me/Ember';
let checks = 0;
const check = (name, value) => { assert(value, name); console.log('PASS ' + name); checks++; };
const server = http.createServer((req, res) => {
 const file = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
 fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html'); res.end(b); });
});
(async () => {
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
 const screenshots = process.env.WORKSPACE_SHOTS || require('node:os').tmpdir();
 fs.mkdirSync(screenshots, { recursive: true });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const errors = [], calls = [], encrypted = [], trees = []; let manifest = null, deny = false, publicOutput = false, confirmation = true, delayedTree = false;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => confirmation ? d.accept() : d.dismiss());
  await page.route('https://**/*', async route => {
   const request = route.request(), u = new URL(request.url()), p = decodeURIComponent(u.pathname), method = request.method();
   const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data) });
   if (u.hostname !== 'api.github.com') return json({});
   calls.push({ path: p, search: u.search, method, body: request.postData(), auth: request.headers().authorization });
   if (deny) return json({ message: 'Bad credentials' }, 401);
   if (p === '/user') return json({ login: 'test-user' });
   if (p === '/search/repositories') return json({ total_count: 65, items: [{ full_name: Number(u.searchParams.get('page')) > 1 ? 'owner/page-two' : 'owner/addon', description: '<img src=x onerror="alert(1)"> long-description source', license: { spdx_id: 'MIT' }, permissions: { push: true } }] });
   if (p === '/user/repos') return json([{ full_name: OUT, private: true, permissions: { push: true } }, { full_name: 'owner/brain', private: true, permissions: { push: false } }]);
   if ([BRAIN, OUT, 'owner/addon', 'owner/brain', 'owner/page-two'].some(r => p === '/repos/' + r)) return json({ default_branch: 'main', private: p === '/repos/' + OUT ? !publicOutput : true, permissions: { push: true } });
   if (p.endsWith('/actions/secrets/public-key')) {
    const key = await page.evaluate(() => { window.__pair = sodium.crypto_box_keypair(); return sodium.to_base64(__pair.publicKey, sodium.base64_variants.ORIGINAL); });
    return json({ key, key_id: 'key-95' });
   }
   if (p.endsWith('/actions/secrets/EMBER_REPO_TOKEN')) { encrypted.push(JSON.parse(request.postData())); return json({}, 201); }
   if (p.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'head-old' } });
   if (p.endsWith('/git/commits/head-old')) return json({ tree: { sha: 'tree-old' } });
   if (p.endsWith('/git/trees') && method === 'POST') { const tree = JSON.parse(request.postData()); trees.push(tree); manifest = JSON.parse(tree.tree.find(x => x.path === 'ember-repos.json').content); return json({ sha: 'tree-new' }, 201); }
   if (p.endsWith('/git/commits') && method === 'POST') return json({ sha: 'head-new' }, 201);
   if (p.endsWith('/git/refs/heads/main')) return json({ object: { sha: 'head-new' } });
   if (p.endsWith('/contents/ember-repos.json')) return manifest ? json({ content: Buffer.from(JSON.stringify(manifest)).toString('base64') }) : json({ message: 'Not Found' }, 404);
   if (p.endsWith('/actions/workflows/build.yml')) return json({ path: '.github/workflows/build.yml' });
   if (p.endsWith('/dispatches')) return json(null, 204);
   if (p.endsWith('/runs')) return json({ workflow_runs: [{ id: 95, status: 'completed', conclusion: 'success', html_url: 'https://github.com/' + OUT + '/actions/runs/95' }] });
   if (p.includes('/git/trees/')) { if (delayedTree) await new Promise(r => setTimeout(r, 2500)); return json({ sha: 'root', truncated: false, tree: [{ type: 'blob', path: 'README.md', sha: 'blob', size: 25 }] }); }
   if (p.endsWith('/contents/README.md')) return json({ type: 'file', sha: 'blob', size: 25, content: Buffer.from('Ember live knowledge source').toString('base64') });
   return json({ message: 'Not Found' }, 404);
  });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.EmberWorkspace && window.__ember?.ready);
  check('provider status and menu live below chat, not in header', await page.evaluate(() => document.querySelector('#chatProviderBar').contains(document.querySelector('#engs')) && !document.querySelector('header').contains(document.querySelector('#bProv'))));
  check('floating jump-to-latest button removed', await page.locator('#jumpEnd').count() === 0);
  check('stop endpoint cannot float even when active', await page.evaluate(() => { const b = document.querySelector('#bStop'); b.classList.remove('hidden'); const hidden = getComputedStyle(b).display === 'none'; b.classList.add('hidden'); return hidden; }));
  await page.click('#bProv'); check('provider menu still works in relocated bar', await page.locator('#provDrop').isVisible());
  check('provider dropdown stays inside viewport and above its bar', await page.evaluate(() => { const d = document.querySelector('#provDrop').getBoundingClientRect(), b = document.querySelector('#chatProviderBar').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth + 1 && d.bottom <= b.top; }));
  await page.keyboard.press('Escape');
  await page.click('#bSet'); await page.click('#acc_h_features');
  await page.locator('#rrSearch').waitFor({ state: 'visible' });
  await page.fill('#rrSearch', 'ember'); await page.click('[data-rr="search"]');
  await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('token'));
  check('missing token gives actionable visible error', (await page.innerText('#rrStatus')).includes('token'));
  await page.fill('#ghTok', TOKEN); await page.click('[data-gh-action="save-token"]');
  check('saved token input cleared and shared with runner', await page.inputValue('#ghTok') === '' && (await page.innerText('#rrConnection')).includes('Saved GitHub token'));
  await page.click('[data-gh-action="check-token"]'); await page.waitForFunction(() => document.querySelector('#ghTokenStatus').textContent.includes('Token works'));
  await page.fill('#ghBrainRepo', 'https://github.com/owner/brain'); await page.click('[data-gh-action="save-repo"]');
  check('Apply Brain accepts repository URL and updates live scope plus runner sources', await page.evaluate(() => EmberGithub.knowledgeRepo() === 'owner/brain' && EmberRepoRunner.config().sources[0].repo === 'owner/brain' && document.querySelector('#ghBrainRepo').value === 'owner/brain'));
  await page.click('[data-rr="search"]'); await page.waitForSelector('[data-rr-add="owner/addon"]');
  check('search uses saved token and escapes repository descriptions', calls.at(-1).auth === 'Bearer ' + TOKEN && await page.locator('#rrResults img').count() === 0 && (await page.innerText('#rrResults')).includes('<img'));
  await page.click('[data-rr="next"]'); await page.waitForSelector('[data-rr-add="owner/page-two"]');
  check('search pagination requests actual next GitHub page', calls.some(x => x.path === '/search/repositories' && x.search.includes('page=2')));
  await page.click('[data-rr="prev"]'); await page.waitForSelector('[data-rr-add="owner/addon"]');
  await page.click('[data-rr-add="owner/addon"]');
  check('whole source appears in spaced cards', await page.evaluate(() => EmberRepoRunner.config().sources.length === 2 && document.querySelectorAll('#rrSources .rr-repo-card').length === 2));
  await page.click('[data-rr="owned"]'); await page.waitForSelector('[data-rr-target="me/Ember"]');
  await page.click('[data-rr-target="me/Ember"]');
  check('Ember repo selection saves output without redirecting Brain', await page.evaluate(() => EmberRepoRunner.config().target === 'me/Ember' && EmberGithub.knowledgeRepo() === 'owner/brain'));
  await page.fill('#ghBrainRepo', OUT); await page.click('[data-gh-action="save-repo"]');
  check('self-copy collision rejected without altering valid Brain', await page.evaluate(() => EmberGithub.knowledgeRepo() === 'owner/brain') && (await page.innerText('#ghRepoStatus')).includes('different repositories'));
  await page.fill('#ghBrainRepo', 'owner/brain');
  await page.click('#acc_h_github'); await page.locator('#rrTarget').waitFor({ state: 'visible' });
  check('GitHub and Features expose same single workspace nodes', await page.locator('#ghTok').count() === 1 && await page.locator('#rrTarget').count() === 1 && await page.inputValue('#rrTarget') === OUT && await page.evaluate(() => document.querySelector('#repoWorkspace').parentElement.id === 'acc_b_github'));
  check('discovery, Brain apply, staging and settings make no remote writes', calls.every(x => x.method === 'GET'));
  await page.click('[data-rr="save"]');
  confirmation = false; await page.click('[data-rr="install"]');
  check('cancelled install performs no GitHub writes', calls.every(x => x.method === 'GET') && (await page.innerText('#rrStatus')).includes('cancelled'));
  confirmation = true; await page.click('[data-rr="install"]');
  await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('"installed": true'));
  check('install atomically commits three managed files against existing tree', trees.length === 1 && trees[0].base_tree === 'tree-old' && trees[0].tree.length === 3);
  check('manifest contains whole Brain plus all staged sources', manifest.brain === 'owner/brain' && manifest.sources.length === 2 && manifest.target === OUT);
  check('token never embedded in managed code, config or encrypted payload', !JSON.stringify(trees).includes(TOKEN) && !JSON.stringify(encrypted).includes(TOKEN));
  const secret = await page.evaluate(value => sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(value, sodium.base64_variants.ORIGINAL), __pair.publicKey, __pair.privateKey)), encrypted[0].encrypted_value);
  check('real sealed-box encryption preserves exact Actions credential', secret === TOKEN);
  check('successful dispatch is not falsely reported as completed build', (await page.innerText('#rrStatus')).includes('check run status'));
  await page.click('[data-rr="sync"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('"dispatched": true'));
  check('sync checks installed manifest before dispatch', calls.some(x => x.path.endsWith('/contents/ember-repos.json')));
  await page.click('[data-rr="status"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('"conclusion": "success"'));
  check('Run status reads real-shaped workflow status API response', (await page.innerText('#rrStatus')).includes('"id": 95'));
  await page.fill('#rrSource', 'owner/page-two'); await page.click('[data-rr="add"]'); await page.click('[data-rr="sync"]');
  await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('settings changed'));
  check('unpublished source changes cannot silently dispatch stale manifest', (await page.innerText('#rrStatus')).includes('Install / update first'));
  publicOutput = true; const writesBefore = calls.filter(x => x.method !== 'GET').length;
  await page.click('[data-rr="install"]'); await page.waitForFunction(() => document.querySelector('#rrStatus').textContent.includes('Private sources cannot'));
  check('private Brain cannot be copied into public output', calls.filter(x => x.method !== 'GET').length === writesBefore); publicOutput = false;
  await page.locator('#rrSources').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(screenshots, 'repositories-mobile.png') });
  for (const width of [320, 390, 768]) {
   await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(80);
   check('repository workspace fits at ' + width + 'px', await page.evaluate(() => { const host = document.querySelector('#settings .sb'); return host.scrollWidth <= host.clientWidth + 1 && [...document.querySelectorAll('#rrSources .rr-repo-card')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }); }));
  }
  await page.click('#bSx');
  await page.setViewportSize({ width: 390, height: 844 }); await page.click('#bCommandCenter');
  check('mobile Command Centre is right-side modal with background inert', await page.evaluate(() => document.querySelector('#emberCommandCenter').getAttribute('aria-modal') === 'true' && document.querySelector('#app').inert));
  await page.click('#eccRunnerStatus'); await page.waitForFunction(() => document.querySelector('#eccActionStatus').textContent.includes('Run 95'));
  check('Command Centre runner status uses same saved output', (await page.innerText('#eccActionStatus')).includes('Run 95: completed / success'));
  await page.screenshot({ path: path.join(screenshots, 'command-centre-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(150);
  check('desktop Command Centre docks right without covering chat', await page.evaluate(() => { const a = document.querySelector('#app').getBoundingClientRect(), c = document.querySelector('#emberCommandCenter').getBoundingClientRect(); return a.right <= c.left + 1 && c.right <= innerWidth + 1 && !document.querySelector('#app').inert && document.querySelector('#eccBackdrop').hidden; }));
  await page.screenshot({ path: path.join(screenshots, 'command-centre-desktop.png') });
  await page.click('#eccClose'); await page.locator('#emberCommandCenter').waitFor({state:'hidden'}); await page.setViewportSize({ width: 390, height: 844 });
  for (const style of ['claude', 'dd', 'tl']) {
   await page.evaluate(style => { EmberTimeline.setStyle(style); EmberTimeline.begin(); EmberTimeline.note('Testing compact stop controls'); EmberTimeline.flush(); }, style);
   check('thinking style ' + style + ' has visible in-row Stop', await page.locator('#typ [data-et="stop"]').isVisible());
   if (style === 'claude') await page.screenshot({ path: path.join(screenshots, 'thinking-mobile.png') });
   check('thinking style ' + style + ' Stop does not overlap composer', await page.evaluate(() => { const s = document.querySelector('#typ [data-et="stop"]').getBoundingClientRect(), c = document.querySelector('footer.comp').getBoundingClientRect(); return s.right <= innerWidth && s.bottom <= c.top; }));
   await page.evaluate(() => EmberTimeline.drop());
  }
  await page.evaluate(() => { EmberTimeline.setStyle('claude'); window.__modelCalls = 0; Persona.respond = async () => { __modelCalls++; return { text: 'A live test answer', provider: 'test', model: 'test' }; }; });
  delayedTree = true;
  await page.fill('#inp', 'Explain README.md code'); await page.click('#bSend');
  await page.locator('#typ [data-et="stop"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(100); await page.click('#typ [data-et="stop"]');
  await page.locator('#bSend:not(.hidden):not(:disabled)').waitFor({ state: 'visible', timeout: 4000 });
  check('in-row Stop cancels pending Brain read before model call', await page.evaluate(() => __modelCalls === 0));
  check('cancelled turn resets thinking state and composer', await page.locator('#typ').count() === 0 && !(await page.innerText('#log')).includes('Reply stopped'));
  delayedTree = false;
  // No stale answer from a provider that resolves despite abort.
  await page.evaluate(() => { EmberGithub.prefetch = async () => ({ files: [] }); EmberGithub.assertReadFirst = () => {}; Persona.respond = () => new Promise(resolve => { window.__resolve = resolve; }); });
  await page.fill('#inp', 'hello'); await page.click('#bSend'); await page.waitForFunction(() => !!window.__resolve);
  await page.focus('#typ [data-et="stop"]'); await page.keyboard.press('Enter');
  await page.locator('#bSend:not(.hidden):not(:disabled)').waitFor({ timeout: 1500 });
  check('keyboard Stop releases composer even when provider ignores abort', await page.locator('#typ').count() === 0);
  await page.evaluate(() => __resolve({ text: 'SHOULD_NOT_BE_SAVED_AFTER_STOP', provider: 'test', model: 'test' }));
  await page.locator('#bSend:not(.hidden):not(:disabled)').waitFor();
  check('late provider response after Stop is discarded', !(await page.innerText('#log')).includes('SHOULD_NOT_BE_SAVED_AFTER_STOP'));
  await page.screenshot({ path: path.join(screenshots, 'chat-mobile.png') });
  await page.evaluate(() => {
   window.__realRX = { state: EmberEngine.react.state, stop: EmberEngine.react.stop };
   window.__rx = { id: 'fallback-test', status: 'running', entries: [], startedAt: Date.now() };
   window.__rxStopped = 0; EmberEngine.react.state = () => __rx;
   EmberEngine.react.stop = () => { __rxStopped++; __rx.status = 'stopped'; window.dispatchEvent(new CustomEvent('ember-react', { detail: { type: 'end' } })); return true; };
   window.dispatchEvent(new CustomEvent('ember-react', { detail: { type: 'start' } }));
  });
  await page.locator('#amber-think [data-react-stop]').waitFor({state:'visible'});
  await page.click('#amber-think [data-react-stop]');
  check('fallback reasoning Stop calls actual reasoning stop endpoint', await page.evaluate(() => __rxStopped === 1));
  await page.evaluate(() => { EmberEngine.react.state = __realRX.state; EmberEngine.react.stop = __realRX.stop; document.querySelector('#amber-think')?.remove(); });
  check('no browser runtime errors across all workflows', errors.length === 0);
  check('no live token leaked in rendered workspace', !(await page.locator('body').textContent()).includes(TOKEN));
  console.log('\n' + checks + ' unified workspace Chromium checks passed.');
 } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
