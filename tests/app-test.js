'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'www');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'text/html; charset=utf-8' }).end(data);
  });
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.__ember?.ready);
    assert(await page.locator('#bSetTop').isVisible(), 'the supported Settings entry point is visible');

    await page.click('#bSetTop');
    await page.waitForSelector('#emberHub.ehub-open');
    assert(await page.locator('#emberHub [data-go="general"]').isVisible(), 'Hub exposes General settings');
    await page.click('#emberHub [data-go="general"]');
    await page.waitForFunction(() => document.getElementById('settings').classList.contains('show') && document.querySelector('#stabs .stab.on')?.dataset.st === 'general');
    await page.waitForSelector('#settings .mnu-list [data-mnu-open]');
    await page.click('#settings .mnu-list [data-mnu-open]');
    assert(await page.locator('#swFree').isVisible(), 'Free Mode controls are reachable through the current paged Settings UI');

    await page.click('#bSx');
    await page.waitForFunction(() => !document.getElementById('settings').classList.contains('show'));
    await page.click('#bSetTop');
    await page.waitForSelector('#emberHub.ehub-open');
    await page.click('#emberHub [data-go="hacking"]');
    await page.waitForFunction(() => document.getElementById('settings').classList.contains('show') && document.querySelector('#stabs .stab.on')?.dataset.st === 'hacking');
    assert(await page.locator('#etPanel').isVisible(), 'Termux panel is available from Hub > Termux & Hacking');
    assert.deepStrictEqual(pageErrors, [], 'app starts and navigates without uncaught page errors');
    console.log('PASS app startup, Hub settings, Free Mode card and Hacking/Termux navigation');
  } catch (err) {
    console.error('FAIL app smoke test:', err.stack || err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})();
