'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
const staticExtensions = new Set([
  '.html', '.js', '.css', '.json', '.svg', '.png', '.ico', '.webmanifest',
  '.cjs', '.txt', '.webp', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.ttf', '.otf'
]);
const excludedFiles = new Set(['package.json', 'diag.js', 'scan_diag.js', 'download-bridge.cjs']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedFiles.has(entry.name) || /(?:^|[-.])test(?:[-.]|$)/i.test(entry.name)) continue;
  if (staticExtensions.has(path.extname(entry.name).toLowerCase())) {
    fs.copyFileSync(path.join(root, entry.name), path.join(out, entry.name));
  }
}
for (const dir of ['provider-icons', 'vendor']) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, dir), { recursive: true });
}

// Fail the build early if the app shell references an asset that was not copied.
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const missing = [];
for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
  const ref = match[1].split(/[?#]/, 1)[0];
  if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
  if (!fs.existsSync(path.join(out, ref))) missing.push(ref);
}
if (missing.length) {
  fs.rmSync(out, { recursive: true, force: true });
  console.error('Web build is missing referenced assets:', [...new Set(missing)].join(', '));
  process.exit(1);
}
console.log(`Built web app into ${path.relative(root, out)}.`);
