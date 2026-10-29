// V1.9.89: toast placement files are wired, cached by the service worker, and the version is bumped everywhere.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = R('www/index.html'), sw = R('www/sw.js'), css = R('www/ember_v89.css'), js = R('www/ember_v89.js');
ok('index.html loads ember_v89.css after ember_blue.css', html.indexOf('ember_blue.css') > 0 && html.indexOf('ember_v89.css') > html.indexOf('ember_blue.css'));
ok('index.html loads ember_v89.js', html.includes('<script src="ember_v89.js"></script>'));
ok('service worker caches both files and is V1.9.89', sw.includes("'ember_v89.css'") && sw.includes("'ember_v89.js'") && sw.includes('ember-v1.9.89'));
ok('package.json is 1.9.89', JSON.parse(R('package.json')).version === '1.9.89');
ok('toast is pinned above the composer, not under the header', /#toast\{top:auto!important;bottom:calc\(var\(--ember-toast-b/.test(css));
ok('toast may wrap (long Switched-to text)', /white-space:normal!important/.test(css) && /line-clamp:3/.test(css));
// run the placer against a fake DOM: the CSS variable must equal the gap between the screen bottom and the composer top
const props = {}; let obs = null;
const toast = { classList: { contains: () => false } };
const comp = { getBoundingClientRect: () => ({ top: 700 }) };
const doc = { readyState: 'complete', documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } }, querySelector: s => s == 'footer.comp' ? comp : null, getElementById: id => id == 'toast' ? toast : null, addEventListener() {} };
const ctx = { document: doc, window: { innerHeight: 800, addEventListener() {}, visualViewport: null }, MutationObserver: function () { this.observe = () => { obs = true; }; }, setInterval() {}, console };
ctx.window.MutationObserver = ctx.MutationObserver; vm.createContext(ctx); vm.runInContext(js, ctx);
ok('placer sets --ember-toast-b to the composer gap (800-700+10)', props['--ember-toast-b'] === '110px', JSON.stringify(props));
ok('placer watches the toast class', obs === true);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
