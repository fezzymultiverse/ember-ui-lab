'use strict';
// Ember 1.10.5 browser checks: "+" media items + Stability bridge, Command Centre widget under Settings, brain search -> write -> push.
// All GitHub traffic and media generation are mocked. No real provider, token or repo is touched.
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '../www'); let passed = 0;
function check(name, condition) { assert(condition, name); console.log('PASS ' + name); passed++; }
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0], file = path.join(root, p === '/' ? 'index.html' : decodeURIComponent(p));
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html'); res.end(b); });
});
const b64 = s => Buffer.from(s).toString('base64');
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', async route => {
      const u = new URL(route.request().url()), m = route.request().method(), p = u.pathname, json = (o, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.host !== 'api.github.com') return json({});
      if (p === '/user') return json({ login: 'tester' });
      if (p === '/search/repositories') return json({ total_count: 2, items: [{ full_name: 'octo/hello', description: 'hello repo', html_url: 'https://github.com/octo/hello', private: false, license: { spdx_id: 'MIT' }, permissions: { push: false } }, { full_name: 'octo/world', description: 'world repo', html_url: 'https://github.com/octo/world', private: false, permissions: { push: false } }] });
      if (m !== 'GET') { writes.push({ m, p, body: route.request().postData() }); }
      if (p === '/repos/me/brain' && m === 'GET') return json({ full_name: 'me/brain', default_branch: 'main', private: false, permissions: { push: true } });
      if (p === '/repos/me/brain/git/ref/heads/main') return json({ object: { sha: 'aaa111' } });
      if (p === '/repos/me/brain/git/commits/aaa111') return json({ tree: { sha: 'ttt111' } });
      if (p === '/repos/me/brain/git/trees' && m === 'POST') return json({ sha: 'tree222' });
      if (p === '/repos/me/brain/git/commits' && m === 'POST') return json({ sha: 'ccc1234567' });
      if (p === '/repos/me/brain/git/refs/heads/main' && m === 'PATCH') return json({ ref: 'refs/heads/main' });
      if (p === '/repos/me/brain/contents/ember-brain/INDEX.md') return json({ message: 'Not Found' }, 404);
      const mm = p.match(/^\/repos\/octo\/(hello|world)(\/.*)?$/);
      if (mm) {
        const tail = mm[2] || '';
        if (!tail) return json({ full_name: 'octo/' + mm[1], description: mm[1] + ' repo', html_url: 'https://github.com/octo/' + mm[1], default_branch: 'main', private: false, stargazers_count: 7, language: 'JavaScript', license: { spdx_id: 'MIT' }, topics: ['demo'], pushed_at: '2026-10-01T00:00:00Z', size: 12 });
        if (tail === '/readme') return json({ content: b64('# ' + mm[1] + '\nghp_' + 'B'.repeat(36) + ' leaked token in readme') });
        if (tail.startsWith('/git/trees/')) return json({ truncated: false, tree: [{ type: 'blob', path: 'package.json', size: 40 }, { type: 'blob', path: 'src/a.js', size: 10 }] });
        if (tail === '/languages') return json({ JavaScript: 100 });
        if (tail.startsWith('/contents/package.json')) return json({ content: b64('{"name":"' + mm[1] + '"}') });
      }
      return json({ message: 'Not Found' }, 404);
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__ember && window.__ember.ready && window.EmberCCWidget && document.getElementById('cwxRoot') && window.EmberBrainPush && window.EmberMediaPlus);

    // ---- widget placement + scrolling (the Command Centre widget sits at the bottom of Settings)
    check('Command Centre widget is the last thing in Settings and holds the new controls', await page.evaluate(() => { const sb = document.querySelector('#settings .sb'); return sb.lastElementChild.id === 'ccWidget' && !!document.querySelector('#ccWidgetBody #cwxRoot'); }));
    await page.evaluate(() => document.getElementById('bSet').click()); await page.waitForTimeout(150);
    check('widget starts collapsed', await page.getAttribute('#ccWidgetToggle', 'aria-expanded') === 'false' && await page.evaluate(() => document.getElementById('ccWidgetBody').hidden));
    await page.click('#ccWidgetToggle');
    check('widget expands on tap and shows the brain token field', await page.getAttribute('#ccWidgetToggle', 'aria-expanded') === 'true' && await page.locator('#cwTok').isVisible());
    const geo = await page.evaluate(() => { const b = document.getElementById('ccWidgetBody'), a = document.getElementById('accWrap'); return { oy: getComputedStyle(b).overflowY, bodyH: b.getBoundingClientRect().height, vh: innerHeight, accH: a.getBoundingClientRect().height }; });
    check('expanded widget is capped so the Settings list above it stays usable', geo.oy === 'auto' && geo.bodyH <= geo.vh * 0.6 && geo.accH > 100);
    await page.click('#ccWidgetToggle'); await page.waitForTimeout(50);
    const acc = await page.evaluate(() => { const a = document.getElementById('accWrap'); return { oy: getComputedStyle(a).overflowY, h: a.getBoundingClientRect().height }; });
    check('Settings sections still scroll with the widget collapsed', acc.oy === 'auto' && acc.h > 200);
    await page.click('#ccWidgetToggle');
    check('widget chip shows the GitHub state', /NO TOKEN|READY|LOADED|SYNCING/.test(await page.innerText('#ccWidget .ecc-chip')));

    // ---- brain: token, brain repo, search, write, push
    await page.fill('#cwTok', 'ghp_' + 'A'.repeat(36)); await page.click('[data-cw="tok"]');
    await page.waitForFunction(() => EmberGithub.on());
    check('token saves from the widget and the field is cleared', await page.inputValue('#cwTok') === '');
    await page.fill('#cwBrain', 'me/brain'); await page.click('[data-cw="load"]');
    await page.waitForFunction(() => EmberGithub.knowledgeRepo() === 'me/brain');
    check('brain repo is set from the widget', true);
    await page.fill('#cwQ', 'hello'); await page.click('[data-cw="search"]');
    await page.waitForSelector('.cwx-repo');
    check('search shows results with the top ones ticked', await page.locator('.cwx-repo').count() === 2 && await page.locator('.cwx-repo input:checked').count() === 2);
    await page.click('[data-cw="push"]');
    await page.waitForFunction(() => /Pushed/.test(document.getElementById('cwPushMsg').textContent), null, { timeout: 15000 });
    const tree = writes.find(w => w.p === '/repos/me/brain/git/trees'), commit = writes.find(w => w.p === '/repos/me/brain/git/commits'), ref = writes.find(w => w.m === 'PATCH');
    const paths = JSON.parse(tree.body).tree.map(t => t.path), allText = JSON.parse(tree.body).tree.map(t => t.content).join('\n');
    check('one tree holds both dossiers, INDEX and the search record', paths.includes('ember-brain/repos/octo__hello.md') && paths.includes('ember-brain/repos/octo__world.md') && paths.includes('ember-brain/INDEX.md') && paths.some(x => /^ember-brain\/searches\/.*hello\.md$/.test(x)));
    check('dossier carries README, file map and key manifest', /## README/.test(allText) && /src\/a\.js/.test(allText) && /## package\.json/.test(allText));
    check('tokens found in a README are redacted before pushing', !/ghp_B{10}/.test(allText));
    check('commit parents the current brain head and the ref update is not forced', JSON.parse(commit.body).parents[0] === 'aaa111' && JSON.parse(ref.body).force === false && JSON.parse(ref.body).sha === 'ccc1234567');
    check('push message links the commit', await page.evaluate(() => !!document.querySelector('#cwPushMsg a[href*="/commit/ccc1234567"]')));
    check('only the brain repo was written to', writes.every(w => w.p.startsWith('/repos/me/brain/')));
    check('brain may be a private-safe target: write to other repos is refused', await page.evaluate(async () => { const r = await EmberGithub.brainRequest('/repos/octo/hello/git/trees', { method: 'POST', body: {} }); return r.ok === false && /Brain/.test(r.error); }));
    check('arbitrary GitHub reads outside repo paths are refused', await page.evaluate(async () => { const r = await EmberGithub.brainRequest('/user/keys'); return r.ok === false; }));
    check('brain and output may now be the same repo', await page.evaluate(() => { try { EmberRepoRunner.setTarget('me/brain'); return EmberRepoRunner.config().target === 'me/brain'; } catch (e) { return false; } }));

    // ---- "+" menu
    await page.click('#bSx'); await page.waitForTimeout(150);
    await page.click('#bPlus');
    const menuText = await page.innerText('#plusMenu');
    check('+ menu has Create image / audio / video / PDF and the Stability bridge', ['Create image', 'Create audio', 'Create video', 'Create PDF', 'Stability bridge'].every(x => menuText.includes(x)));
    await page.click('[data-t="audio_gen"]');
    check('Create audio is a one-shot with a chip', await page.evaluate(() => EmberPlus.isOn('audio_gen')) && /Create audio/.test(await page.innerText('#plusChips')));
    await page.click('#bPlus'); await page.click('[data-t="video_gen"]');
    check('picking video turns audio off (one at a time)', await page.evaluate(() => EmberPlus.isOn('video_gen') && !EmberPlus.isOn('audio_gen')));
    await page.click('#bPlus'); await page.click('[data-t="stab"]');
    check('Stability bridge toggle stays on and shows a chip', await page.evaluate(() => EmberPlus.isOn('stab')) && /Stability bridge/.test(await page.innerText('#plusChips')));
    await page.evaluate(() => { EmberPlus._set('video_gen', false); });
    check('Stability bridge survives a reload of the saved state', await page.evaluate(() => JSON.parse(localStorage.getItem('ember_plus') || '{}').stab === true));

    // ---- media from chat (generation mocked)
    await page.evaluate(() => { window.__gen = []; EmberMedia.generate = async r => { window.__gen.push(r); return { id: 'm1', provider: r.provider, kind: r.kind, name: 'Ember-' + r.kind + '-test.' + (r.kind === 'audio' ? 'mp3' : r.kind === 'video' ? 'mp4' : 'png') }; }; EmberMedia.connectPuter = async () => true; });
    await page.evaluate(() => EmberPlus._set('audio_gen', true));
    await page.fill('#inp', 'a slow lofi beat with rain'); await page.click('#bSend');
    await page.waitForFunction(() => /Audio ready/.test(document.getElementById('log').innerText), null, { timeout: 8000 });
    const g1 = await page.evaluate(() => window.__gen[0]);
    check('+ Create audio sends the prompt to Stability audio and confirms in chat', g1.provider === 'stability' && g1.kind === 'audio' && g1.confirmed === true);
    await page.evaluate(() => EmberPlus._set('video_gen', true));
    await page.fill('#inp', 'a drone shot over mountains'); await page.click('#bSend');
    await page.waitForFunction(() => /Video ready/.test(document.getElementById('log').innerText), null, { timeout: 8000 });
    check('+ Create video goes to Puter (Stability video is retired)', (await page.evaluate(() => window.__gen[1])).provider === 'puter');
    await page.fill('#inp', 'please generate an image of a red fox'); await page.click('#bSend');
    await page.waitForFunction(() => /Image ready/.test(document.getElementById('log').innerText), null, { timeout: 8000 });
    check('bridge ON: plain chat request makes the image with Stability', (await page.evaluate(() => window.__gen[2])).provider === 'stability');
    check('media is switched on automatically by the bridge', await page.evaluate(() => EmberMedia.cfg().enabled === true));
    check('agent gets the media_generate tool only while the bridge is on', await page.evaluate(() => { const on = EmberAgentAddon.toolsFor ? EmberAgentAddon.toolsFor({}).some(t => t.name === 'media_generate') : null; EmberPlus._set('stab', false); const off = EmberAgentAddon.toolsFor({}).some(t => t.name === 'media_generate'); return on === true && off === false; }));

    // ---- widget media section
    await page.evaluate(() => document.getElementById('bSet').click()); await page.waitForTimeout(150);
        check('widget bridge button reflects the + toggle', /OFF/.test(await page.innerText('#cwBridge')));
    await page.click('#cwBridge');
    check('widget bridge button flips the same toggle', await page.evaluate(() => EmberPlus.isOn('stab')) && /ON/.test(await page.innerText('#cwBridge')));
    await page.selectOption('#cwKind', 'audio'); await page.fill('#cwPrompt', 'ocean waves'); await page.click('[data-cw="make"]');
    await page.waitForFunction(() => /Saved Ember-audio/.test(document.getElementById('cwMediaMsg').textContent), null, { timeout: 8000 });
    check('widget Make button runs the media router', (await page.evaluate(() => window.__gen.length)) === 4);
    check('no page errors', errors.length === 0 && (console.log(errors.join('\n')) || true));
    console.log('\n' + passed + ' checks passed');
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await browser.close(); server.close(); }
})();
