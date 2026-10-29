// Ember V1.9.50: computed-layout regression for Thinking jitter and the plus control.
// Install Playwright separately, then: PW=/path/to/playwright npm run test:ui-stability
// Optional: WWW=/path/to/www CHROME=/path/to/chromium
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const root = path.resolve(process.env.WWW || path.join(__dirname, '..', 'www'));
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
});
const near = (actual, expected, label, tolerance = 0.5) => assert(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' vs ' + expected);
const geometry = page => page.evaluate(() => {
  const rect = selector => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  };
  return { plus: rect('#bPlus'), send: rect('#bSend'), input: rect('#inp'), row: rect('.comp .row'),
    fontSize: getComputedStyle(document.getElementById('bPlus')).fontSize };
});
const statusGeometry = page => page.evaluate(() => {
  const status = document.querySelector('#typ .et-status');
  const stage = document.querySelector('#typ .et-stage');
  const header = document.querySelector('#typ .et-hdr');
  const r = status.getBoundingClientRect(), s = stage.getBoundingClientRect(), h = header.getBoundingClientRect();
  const css = getComputedStyle(status);
  return { y: r.y, height: r.height, stageHeight: s.height, headerY: h.y, headerHeight: h.height,
    count: stage.querySelectorAll('.et-status').length, transform: css.transform, animation: css.animationName,
    whiteSpace: css.whiteSpace, overflow: css.textOverflow, text: status.textContent,
    same: status === window.stableStatus, spinnerSame: document.querySelector('#typ .et-spinner') === window.stableSpinner };
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const width of [320, 360, 390, 430, 760]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin)
      ? route.continue() : route.fulfill({ status: 503, body: 'External network blocked by UI regression test.' }));
    await page.goto(origin);
    await page.waitForFunction(() => window.__ember && window.__ember.ready);
    assert(await page.locator('#bGraph').count(), 'Graph shortcut is present');
    assert(await page.evaluate(() => !!window.EmberGraph && window.EmberGraph.TOOLS.some(t => t.name === 'map_knowledge')), 'Knowledge Graph tool is loaded');
    assert.strictEqual(await page.evaluate(() => EmberTimeline.label('map_knowledge', {}).includes('Mapping connections')), true, 'graph tool has a Thinking label');
    await page.click('#bPlus');
    await page.click('#plusMenu [data-action="bGraph"]');
    await page.waitForTimeout(50);
    assert(await page.locator('#graph.show').count(), 'Graph panel opens');
    assert(/sources|No local connections/.test(await page.locator('#graphStats, #graphView').allTextContents().then(a => a.join(' '))), 'Graph panel renders local state');
    await page.click('#graphX');
    assert(!(await page.locator('#graph').evaluate(element => element.classList.contains('show'))), 'Graph panel closes');
    await page.evaluate(() => {
      document.getElementById('log').insertAdjacentHTML('beforeend', '<div class="msg a" id="replySkin"><div>Ember reply sample</div><div class="mt"><span>now</span><button data-act="say">🔊</button><button data-act="copy">⧉ Copy</button><button data-act="regen">↻ again</button></div></div>');
    });
    const replySkin = await page.evaluate(() => {
      const el = document.getElementById('replySkin'), css = getComputedStyle(el), mt = el.querySelector('.mt');
      return { background: css.backgroundColor, borderLeft: css.borderLeftWidth, radius: css.borderRadius, actionY: mt.getBoundingClientRect().y, textBottom: el.firstElementChild.getBoundingClientRect().bottom };
    });
    assert(replySkin.background === 'rgba(0, 0, 0, 0)' || replySkin.background === 'transparent', 'Ember reply has no bubble background');
    assert.strictEqual(replySkin.borderLeft, '0px', 'Ember reply has no bubble border');
    assert.strictEqual(replySkin.radius, '0px', 'Ember reply has no bubble radius');
    assert(replySkin.actionY > replySkin.textBottom, 'reply actions remain below Ember text');
    await page.locator('#replySkin').evaluate(element => element.remove());
    for (const text of ['', 'A short message', 'First line\nSecond line\nThird line\nFourth line']) {
      await page.fill('#inp', text);
      const g = await geometry(page);
      near(g.plus.width, 38, 'plus width at ' + width);
      near(g.plus.height, 38, 'plus height at ' + width);
      near(g.plus.cy, g.send.cy, 'plus/send alignment at ' + width);
      near(g.plus.cy, g.row.cy, 'plus/row alignment at ' + width);
      near(g.plus.cy, g.input.cy, 'plus/input alignment at ' + width);
      assert(g.plus.x <= g.row.x + 2, 'plus sits against the composer left edge at ' + width + ': ' + g.plus.x + ' vs ' + g.row.x);
      assert.strictEqual(g.fontSize, '0px', 'only the centered CSS cross is drawn');
    }
    const closed = await geometry(page);
    await page.click('#bPlus');
    await page.waitForTimeout(250);
    assert.strictEqual(await page.getAttribute('#bPlus', 'aria-expanded'), 'true');
    assert(await page.locator('#plusMenu').isVisible(), 'plus menu still opens');
    const open = await geometry(page);
    near(open.plus.cx, closed.plus.cx, 'rotation preserves cross center X');
    near(open.plus.cy, closed.plus.cy, 'rotation preserves cross center Y');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.getAttribute('#bPlus', 'aria-expanded'), 'false');
    assert(!(await page.locator('#plusMenu').isVisible()), 'Escape closes menu');

    await page.evaluate(() => {
      const log = document.getElementById('log');
      for (let i = 0; i < 35; i++) log.insertAdjacentHTML('beforeend', '<div class="msg u">Earlier message ' + i + '</div>');
      EmberTimeline.setStyle('claude'); EmberTimeline.begin();
      window.stableStatus = document.querySelector('#typ .et-status');
      window.stableSpinner = document.querySelector('#typ .et-spinner');
    });
    assert(await page.locator('#typ .et-drop-hint').count(), 'rotating view has an expand chevron');
    assert(await page.locator('#typ .et-body .tl-item').count(), 'rotating view contains the dots/icons timeline');
    assert(await page.locator('#typ .et-inner').evaluate(element => element.classList.contains('et-open')), 'timeline starts open');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ember-dl', { detail: { id: 'ui-job', title: 'Sample track', state: 'running', pct: 37 } })));
    assert(/Downloading/.test(await page.locator('#typ .et-status').textContent()), 'real download event shows Downloading');
    assert(/37%/.test(await page.locator('#typ .et-status').textContent()), 'real download event shows progress');
    assert(/Downloading.*Sample track/.test(await page.locator('#typ .et-lines').textContent()), 'real download lifecycle is linked into Thinking');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ember-dl', { detail: { id: 'ui-job', title: 'Sample track', state: 'done', pct: 100 } })));
    assert(/Saved to Music\/Ember/.test(await page.locator('#typ .et-status').textContent()), 'real download completion shows saved state');
    assert(/Saved to Music\/Ember/.test(await page.locator('#typ .et-lines').textContent()), 'download completion is linked into Thinking');
    await page.click('#typ .et-hdr');
    assert(!(await page.locator('#typ .et-inner').evaluate(element => element.classList.contains('et-open'))), 'tap collapses timeline in place');
    await page.click('#typ .et-hdr');
    assert(await page.locator('#typ .et-inner').evaluate(element => element.classList.contains('et-open')), 'tap expands timeline in place');
    await page.click('#typ .et-hdr');
    assert(!(await page.locator('#typ .et-inner').evaluate(element => element.classList.contains('et-open'))), 'second tap collapses timeline');
    const first = await statusGeometry(page);
    const statuses = ['Reading your message', 'Asking a provider with a very long model name and a long routing explanation that would previously wrap onto several lines on a small phone', 'Thinking', 'Writing the answer', '<img src=x onerror=alert(1)> & literal progress'];
    for (const text of statuses) {
      await page.evaluate(value => { EmberTimeline.note(value); EmberTimeline.flush(); }, text);
      for (const delay of [0, 40, 200, 450]) {
        if (delay) await page.waitForTimeout(delay);
        const current = await statusGeometry(page);
        assert.strictEqual(current.count, 1, 'exactly one status node, no overlapping flip text');
        assert(current.same && current.spinnerSame, 'DOM identity retained');
        assert.strictEqual(current.transform, 'none', 'status has no vertical or 3D transform');
        assert.strictEqual(current.animation, 'none', 'status has no replayed animation');
        assert.strictEqual(current.whiteSpace, 'nowrap');
        assert.strictEqual(current.overflow, 'ellipsis');
        // The open stream may change the page scroll position as its capped body fills;
        // internal status height/transform checks below are the anti-jitter contract.
        near(current.height, first.height, 'status height stays still at ' + width);
        near(current.headerHeight, 34, 'header has fixed height');
      }
    }
    assert.strictEqual(await page.locator('#typ .et-status img').count(), 0, 'status remains escaped plain text');
    // Rapid keyed updates do not create outgoing text or delayed cleanup callbacks.
    await page.evaluate(() => {
      for (let i = 0; i < 30; i++) { EmberTimeline.upsert('rapid', 'Progress ' + i, 't', ''); EmberTimeline.flush(); }
    });
    assert.strictEqual((await statusGeometry(page)).text, 'Progress 29');
    assert.strictEqual((await statusGeometry(page)).count, 1);
    await page.evaluate(() => { EmberTimeline.upsert('same-label', 'A tool', 'a', 'run'); EmberTimeline.flush(); EmberTimeline.upsert('same-label', 'A tool', 'a', 'bad'); });
    assert(await page.locator('#typ .et-status.et-bad').count(), 'same-label failure updates color');
    await page.evaluate(() => { EmberTimeline.upsert('same-label', 'A tool', 'a', 'ok'); });
    assert.strictEqual(await page.locator('#typ .et-status.et-bad').count(), 0, 'recovery removes error color');

    // Progress paints must not force the reader back to the bottom of old messages.
    await page.evaluate(() => { document.getElementById('log').scrollTop = 0; });
    await page.evaluate(() => { EmberTimeline.note('New progress while reading history'); EmberTimeline.flush(); });
    assert.strictEqual(await page.evaluate(() => document.getElementById('log').scrollTop), 0);
    // A real app rerender (background download completion) keeps the live card's DOM.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ember-dl-final', { detail: { text: 'A mocked local download finished.' } })));
    assert((await statusGeometry(page)).same, 'chat rerender preserves status node');
    assert((await statusGeometry(page)).spinnerSame, 'chat rerender preserves spinner node');

    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) EmberTimeline.note('History row ' + i + ': a long provider/model routing status for the scrollable progress log');
      EmberTimeline.flush();
    });
    for (const style of ['dd', 'tl']) {
      await page.evaluate(value => {
        EmberTimeline.setStyle(value); window.dispatchEvent(new CustomEvent('ember-react', { detail: { type: 'start' } }));
      }, style);
      assert.strictEqual(await page.locator('#typ').count(), 1, 'one live card for ' + style);
      const pane = style === 'dd' ? '#typ .et-lines' : '#typ .tl-body';
      const bounds = await page.locator(pane).evaluate(element => ({ height: element.clientHeight, scroll: element.scrollHeight }));
      assert(bounds.height <= 250 && bounds.scroll > bounds.height, style + ' history remains capped and scrollable: ' + JSON.stringify(bounds));
      if (style === 'dd') assert.strictEqual(await page.locator('#typ .et-line').first().evaluate(element => getComputedStyle(element).animationName), 'none');
      const toggle = style === 'dd' ? '#typ .et-hdr' : '#typ .tl-chev2';
      const selector = style === 'dd' ? '#typ .et-inner' : '#typ .tl-card';
      const openClass = style === 'dd' ? 'et-open' : 'tl-open';
      const beforeOpen = await page.locator(selector).evaluate((element, cls) => element.classList.contains(cls), openClass);
      await page.click(toggle);
      const afterOpen = await page.locator(selector).evaluate((element, cls) => element.classList.contains(cls), openClass);
      assert.notStrictEqual(afterOpen, beforeOpen, style + ' details control toggles');
      await page.click(toggle);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { EmberTimeline.setStyle('claude'); window.dispatchEvent(new CustomEvent('ember-react', { detail: { type: 'start' } })); });
    assert.strictEqual(await page.locator('.et-sp-arc').evaluate(element => getComputedStyle(element).animationName), 'none', 'reduced-motion disables spinner');
    await page.evaluate(() => EmberTimeline.drop());
    assert.strictEqual(await page.locator('#typ').count(), 0, 'dropping the turn removes its card');
    assert.deepStrictEqual(errors, [], 'no browser JS errors');
    console.log('PASS V1.9.50 UI stability at ' + width + 'px');
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.close();
});
