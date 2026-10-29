// Panel-only integration checks. External services are mocked; no keys or live writes.
'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.join(__dirname, '../www');
let checks = 0;
function check(name, value) { assert(value, name); console.log('PASS ' + name); checks++; }
const server = http.createServer((q, r) => {
  const file = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (e, data) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html'); r.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const url = 'http://127.0.0.1:' + server.address().port;
  const shots = process.env.PANEL_SHOTS || require('node:os').tmpdir(); fs.mkdirSync(shots, { recursive: true });
  try {
    for (const width of [320, 390, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', hasTouch: true, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('https://**/*', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
      await page.goto(url); await page.waitForFunction(() => window.__ember?.ready && window.EmberHub && window.EmberPanelLayout);
      await page.waitForTimeout(700);
      check(width + ' labeled Panel button visible', await page.locator('#bPanelTop').isVisible());
      check(width + ' header controls stay inside screen', await page.evaluate(() => [...document.querySelectorAll('#app > header .hr > button:not(#bActionMenu), #bHist')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })));
      const before = await page.locator('#app').boundingBox();
      await page.click('#bPanelTop'); await page.waitForTimeout(350);
      check(width + ' context drawer open without settings clutter', await page.locator('[data-view="workspace"]').isVisible() && !(await page.locator('[data-view="root"]').isVisible()));
      check(width + ' Android overlay preserves chat width', Math.abs((await page.locator('#app').boundingBox()).width - before.width) < 1 && !(await page.evaluate(() => document.body.classList.contains('ehub-docked'))));
      check(width + ' drawer fits viewport, exposes outside strip and composer', await page.evaluate(() => {
        const p = document.querySelector('#emberHub').getBoundingClientRect(), c = document.querySelector('footer.comp').getBoundingClientRect(), h = document.querySelector('#app > header').getBoundingClientRect();
        return p.left >= 23 && p.right <= innerWidth + 1 && p.top >= h.bottom - 1 && p.bottom <= c.top + 1 && p.height > 100;
      }));
      check(width + ' modal semantics and background inert', await page.evaluate(() => document.querySelector('#emberHub').getAttribute('aria-modal') === 'true' && document.querySelector('#app').inert));
      await page.keyboard.press('Shift+Tab');
      check(width + ' keyboard focus stays inside modal', await page.evaluate(() => document.querySelector('#emberHub').contains(document.activeElement)));
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      check(width + ' Escape restores opener and chat interaction', await page.evaluate(() => !window.EmberHub.isOpen() && !document.querySelector('#app').inert && document.activeElement.id === 'bPanelTop'));
      await page.click('#bPanelTop'); await page.waitForTimeout(160); await page.evaluate(() => history.back()); await page.waitForTimeout(350);
      check(width + ' Back closes drawer without leaving app', !await page.evaluate(() => window.EmberHub.isOpen()) && page.url() === url + '/');
      await page.click('#bPanelTop'); await page.waitForTimeout(250); await page.mouse.click(5, 150); await page.waitForTimeout(300);
      check(width + ' outside tap closes drawer', !await page.evaluate(() => window.EmberHub.isOpen()));
      await page.click('#bPanelTop'); await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(shots, 'panel-android-' + width + '.png') });
      await page.evaluate(() => {
        const li = document.createElement('li'); li.textContent = '<script>unsafe</script> source.txt'; document.querySelector('#eccMemory').replaceChildren(li);
      });
      await page.waitForTimeout(60);
      check(width + ' provenance updates as text, not executable markup', (await page.locator('#ehubSources').innerText()).includes('<script>unsafe</script>') && await page.locator('#ehubSources script').count() === 0);
      await page.click('[data-context-action="docs"]'); await page.waitForTimeout(400);
      check(width + ' Files action closes drawer and opens original Documents view', !await page.evaluate(() => window.EmberHub.isOpen()) && await page.locator('#browser').evaluate(e => e.classList.contains('show')) && await page.locator('#brDocs').isVisible());
      await page.evaluate(() => window.EmberBrowser.close()); await page.waitForTimeout(300);
      await page.click('#bSetTop'); await page.waitForTimeout(300);
      check(width + ' existing Settings root remains accessible', await page.locator('[data-view="root"]').isVisible());
      await page.click('#ehubKeysBtn');
      check(width + ' original providers view works', await page.locator('[data-view="keys"]').isVisible());
      await page.click('#ehubBack'); await page.click('#ehubClose'); await page.waitForTimeout(300);
      await page.evaluate(() => EmberCommandCenter.open()); await page.waitForTimeout(300);
      check(width + ' Command Centre remains Android overlay', await page.evaluate(() => !document.body.classList.contains('ecc-docked') && !document.querySelector('#eccBackdrop').hidden && document.querySelector('#app').inert));
      await page.evaluate(() => history.back()); await page.waitForTimeout(350);
      check(width + ' Back closes Command Centre too', !await page.locator('#emberCommandCenter').evaluate(e => e.classList.contains('ecc-open')));
      await page.click('#bPanelTop'); await page.waitForTimeout(300);
      // Simulate a keyboard-reduced VisualViewport independently from layout viewport.
      await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 390 }); visualViewport.dispatchEvent(new Event('resize')); }); await page.waitForTimeout(80);
      check(width + ' keyboard viewport bounds respected', await page.locator('#emberHub').evaluate(e => e.getBoundingClientRect().bottom <= 391));
      await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
      await page.click('#ehubClose'); await page.waitForTimeout(300);
      check(width + ' no runtime errors', errors.length === 0);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await page.route('https://**/*', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.goto(url); await page.waitForFunction(() => window.EmberHub && window.__ember?.ready);
    await page.click('#bPanelTop'); await page.waitForTimeout(350);
    check('desktop Workspace docks as complementary column', await page.evaluate(() => document.body.classList.contains('ehub-docked') && !document.querySelector('#app').inert && document.querySelector('#emberHub').getAttribute('role') === 'complementary' && document.querySelector('#ehubBackdrop').hidden));
    check('desktop column does not overlap main app', await page.evaluate(() => document.querySelector('#app').getBoundingClientRect().right <= document.querySelector('#emberHub').getBoundingClientRect().left + 1));
    check('chat and composer have identical horizontal margins', await page.evaluate(() => { const a = getComputedStyle(document.querySelector('#log')), b = getComputedStyle(document.querySelector('footer.comp')); return a.paddingLeft === b.paddingLeft && a.paddingRight === b.paddingRight; }));
    await page.screenshot({ path: path.join(shots, 'panel-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
    check('resize switches dock to modal with focus inside', await page.evaluate(() => !document.body.classList.contains('ehub-docked') && document.querySelector('#app').inert && document.querySelector('#emberHub').contains(document.activeElement)));
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(350);
    check('resize back releases modal and background inert', await page.evaluate(() => document.body.classList.contains('ehub-docked') && !document.querySelector('#app').inert && !document.querySelector('#emberHub').hasAttribute('aria-modal')));
    await page.click('#ehubClose'); await page.waitForTimeout(300);
    await page.evaluate(() => { document.querySelector('#bSet').click(); document.querySelector('#stabs [data-st="hacking"]').click(); }); await page.waitForTimeout(400);
    check('terminal header has Panel entry', await page.locator('#bPanelTerm').isVisible());
    await page.click('#bPanelTerm'); await page.waitForTimeout(300);
    check('terminal panel displays connection not chat files', await page.locator('#ehubTerminalContext').isVisible() && !(await page.locator('#ehubChatContext').isVisible()) && (await page.locator('#ehubConnection').innerText()).length > 0);
    await page.click('[data-context-action="setup"]'); await page.waitForTimeout(300);
    check('Setup selection closes drawer and uses existing terminal setup', !await page.evaluate(() => window.EmberHub.isOpen()) && await page.locator('#etvSetup').isVisible() && !await page.locator('#settings').evaluate(e => e.inert));
    await page.close();
    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const extraErrors = []; reduced.on('pageerror', e => extraErrors.push(e.message));
    await reduced.addInitScript(() => { window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => false, Plugins: {} }; });
    await reduced.route('https://**/*', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await reduced.goto(url); await reduced.waitForFunction(() => window.EmberHub && window.__ember?.ready);
    await reduced.click('#bPanelTop'); await reduced.waitForTimeout(100);
    check('reduced motion still places focus inside modal', await reduced.evaluate(() => document.querySelector('#emberHub').contains(document.activeElement)));
    await reduced.evaluate(() => {
      const out = document.querySelector('#eccMemory'); out.replaceChildren();
      for (let i = 0; i < 70; i++) { const li = document.createElement('li'); li.textContent = 'Observed source ' + i + '.txt'; out.append(li); }
    }); await reduced.waitForTimeout(100);
    check('long context scrolls inside drawer', await reduced.locator('#emberHub .ehub-body').evaluate(e => e.scrollHeight > e.clientHeight));
    await reduced.locator('#emberHub .ehub-body').evaluate(e => { e.scrollTop = e.scrollHeight; });
    check('close button stays visible after internal scroll', await reduced.locator('#ehubClose').isVisible());
    await reduced.click('#ehubClose'); await reduced.waitForTimeout(200);
    for (let i = 0; i < 5; i++) { await reduced.click('#bPanelTop'); await reduced.click('#ehubClose'); }
    await reduced.waitForTimeout(350);
    check('repeated open-close restores background and history marker', await reduced.evaluate(() => !EmberHub.isOpen() && !document.querySelector('#app').inert && !history.state?.emberBack));
    await reduced.setViewportSize({ width: 1280, height: 720 });
    await reduced.click('#bPanelTop'); await reduced.waitForTimeout(100);
    check('native Android platform overrides a desktop user-agent for docking', await reduced.evaluate(() => !EmberPanelLayout.canDock() && !document.body.classList.contains('ehub-docked') && !document.querySelector('#ehubBackdrop').hidden));
    await reduced.evaluate(() => { Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => 70 }); Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 350 }); visualViewport.dispatchEvent(new Event('scroll')); }); await reduced.waitForTimeout(100);
    check('panned keyboard viewport keeps drawer within visible bounds', await reduced.locator('#emberHub').evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 70 && r.bottom <= 421; }));
    await reduced.click('#ehubClose'); await reduced.waitForTimeout(200);
    check('extra scenarios have no runtime errors', extraErrors.length === 0);
    await reduced.close();
    const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    const offline = await offlineContext.newPage();
    await offline.route('https://**/*', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
    await offline.goto(url); await offline.evaluate(() => navigator.serviceWorker.ready);
    await offline.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline.reload(); await offline.waitForFunction(() => window.EmberHub && window.__ember?.ready);
    await offline.waitForFunction(async () => !!(await caches.match(new URL('ember_panel.css?v=1.10.12-panel1', location.href).href)) && !!(await caches.match(new URL('ember_panel_layout.js?v=1.10.12-panel1', location.href).href)));
    check('new panel modules cached for offline use', await offline.evaluate(async () => !!(await caches.match('ember_panel_layout.js')) && !!(await caches.match('ember_panel.css'))));
    await offlineContext.setOffline(true); await offline.reload();
    await offline.waitForFunction(() => window.EmberHub && window.__ember?.ready);
    await offline.click('#bPanelTop'); await offline.waitForTimeout(350);
    check('drawer works after warmed offline reload', await offline.locator('[data-view="workspace"]').isVisible());
    await offlineContext.close();
    console.log('\n' + checks + ' panel integration checks passed.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
