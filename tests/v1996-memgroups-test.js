// Ember V1.9.96: Core Memory grouping keeps every fact and its original index. Run: node tests/v1996-memgroups-test.js
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'www', 'app.js'), 'utf8');
const a = s.indexOf('const MEM_GROUPS'), b = s.indexOf('function renderMem()');
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
global.localStorage = { getItem: () => null, setItem() {} };
eval(s.slice(a, b) + ';global.G = memGroupHtml;');
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n); };
const facts = ['User\'s name is Fezzy', 'Interest in ransomware gang OSINT', 'Downloading music from YouTube', 'Scraping and Termux setup', 'Provided a clear example for the user', 'something random'].map(t => ({ t }));
const item = (k, f, i) => '<div class="mi" data-i="' + i + '">' + esc(f.t) + '</div>';
const html = global.G(facts, item);
ok('every fact is drawn once', (html.match(/class="mi"/g) || []).length === facts.length);
ok('original indexes kept', [0, 1, 2, 3, 4, 5].every(i => html.includes('data-i="' + i + '"')));
ok('groups are details.mg with counts', /<details class="mg"[^>]*><summary><span>About you<\/span><b>1<\/b>/.test(html));
ok('unmatched facts fall into Other', /<span>Other<\/span><b>1<\/b>/.test(html));
ok('empty list says Nothing yet', /Nothing yet/.test(global.G([], item)));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
