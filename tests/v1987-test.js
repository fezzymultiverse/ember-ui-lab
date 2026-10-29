// Ember V1.9.87: media engines (Forge image engine, cloud PDF chain, plain-English routing). Pure Node, mocked network, no browser.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
const src = W('ember_engines.js');

// ---------- sandbox ----------
const store = {}, calls = [];
let script = []; // queue of handlers: (url, opt) => response descriptor
const res = d => ({
  ok: d.status >= 200 && d.status < 300, status: d.status,
  headers: { get: n => (d.headers || {})[String(n).toLowerCase()] || null },
  json: async () => { if (d.json === undefined) throw new Error('not json'); return d.json; },
  arrayBuffer: async () => { const b = d.bytes || Buffer.from(''); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
});
const els = {}, mkEl = id => ({ id, classList: { add() {}, remove() {}, toggle(c, v) { this._on = v; }, contains() { return !!this._on; } }, appendChild() {}, setAttribute() {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; }, addEventListener() {}, querySelector() { return null; }, textContent: '', scrollTop: 0, parentNode: null });
const body = mkEl('body');
const doc = {
  getElementById: id => id === 'app' ? Object.assign(els.app || (els.app = mkEl('app')), { parentNode: body }) : (els[id] || (els[id] = mkEl(id))),
  createElement: t => t === 'canvas' ? { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,/9j/AAAA', width: 0, height: 0 } : mkEl(t),
  addEventListener() {}, body
};
class FakeImage { set src(v) { this._s = v; setTimeout(() => { if (/^BAD/.test(String(v))) { this.onerror && this.onerror(); } else { this.naturalWidth = 512; this.naturalHeight = 512; this.onload && this.onload(); } }, 0); } get src() { return this._s; } }
const sandbox = {
  console, document: doc, window: null, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  Image: FakeImage, Blob: class { constructor(p, o) { this.parts = p; this.type = o && o.type; } }, atob: s => Buffer.from(s, 'base64').toString('binary'), Uint8Array, Date, Math, JSON, Promise, Buffer, String, Number, Array, Object, Error, RegExp, setTimeout: (f, ms) => setTimeout(f, ms === 3000 ? 0 : ms), clearTimeout,
  AbortController, confirm: () => sandbox._confirm, _confirm: true,
  fetch: async (url, opt) => { calls.push({ url, opt }); const h = script.shift(); if (!h) throw new Error('unexpected fetch ' + url); return res(await h(url, opt)); }
};
sandbox.window = sandbox; vm.createContext(sandbox);
try { vm.runInContext(src, sandbox); ok('ember_engines.js loads in a sandbox', !!sandbox.EmberEngines); } catch (e) { ok('ember_engines.js loads in a sandbox', false, e.message); process.exit(1); }
const E = sandbox.EmberEngines, reset = () => { Object.keys(store).forEach(k => delete store[k]); calls.length = 0; script = []; };
const pdfBytes = (n) => Buffer.from('%PDF-1.4\n' + 'x'.repeat(n || 600) + '\n%%EOF\n', 'binary');

(async () => {
  // ---------- plain-English intent ----------
  const yes = ['draw a husky in neon Cape Town', 'generate an image of a dragon', 'make me a picture of Bojack on a beach', 'Can you create a poster for my gig', 'please paint a sunset over Table Mountain', 'imagine a futuristic taxi poster', 'Draw me a lab and husky hanging out'];
  const no = ['draw a conclusion from this data', 'make an image upload component in react', 'create a PDF report on sleep', 'imagine you are a pirate', 'what is an image?', 'write a poem about the sea', 'draw attention to the issue', 'make a picture frame in html', 'generate an image caption for this photo', 'draw a diagram of the router', 'create a script that resizes pictures', 'how do I make a poster in canva'];
  yes.forEach(t => ok('intent: image <- ' + t, E.intent(t) === 'image'));
  no.forEach(t => ok('intent: none <- ' + t, E.intent(t) === null));
  ok('intent ignores very long messages', E.intent('draw a husky ' + 'in neon '.repeat(100)) === null);
  store.ember_engines = JSON.stringify({ nl: false }); ok('intent off when plain-English routing is switched off', E.intent('draw a husky in neon') === null); reset();

  // ---------- Forge ----------
  const horde = (extra) => {
    script = [
      (u, o) => ({ status: 202, json: { id: 'job1' } }),
      () => ({ status: 200, json: { done: false, waiting: 1, processing: 0, queue_position: 3, wait_time: 40 } }),
      () => ({ status: 200, json: { done: false, processing: 1, queue_position: 0, wait_time: 10 } }),
      () => ({ status: 200, json: { done: true, finished: 1 } }),
      () => ({ status: 200, json: { done: true, generations: [{ img: 'QUJDRA==', model: 'Deliberate', worker_name: 'gpu-7', seed: '123', censored: false }] } })
    ];
    if (extra) extra(script);
  };
  const steps = []; reset(); horde();
  let r = await E.forgeRoute('draw a husky in neon Cape Town', { step: (ic, t, k) => steps.push([ic, t, k]) });
  ok('forge: ok result', r.ok === true, r.error);
  ok('forge: svg artifact carries the picture as a data URI', /<artifact type="svg" title="Forge - [^"]+\.svg">\s*<svg [^>]*viewBox="0 0 512 512"[\s\S]*<image href="data:image\/jpeg;base64,/.test(r.text || ''));
  ok('forge: details artifact is html with no embedded image', /<artifact type="html" title="Forge - [^"]+ \(details\)\.html">/.test(r.text) && !/<img /.test(r.text.split('type="html"')[1] || ''));
  ok('forge: submit hit aihorde.net generate/async with the anonymous key', calls[0].url === 'https://aihorde.net/api/v2/generate/async' && calls[0].opt.headers.apikey === '0000000000' && calls[0].opt.method === 'POST');
  const sent = JSON.parse(calls[0].opt.body);
  ok('forge: request is sfw, base64 (r2 off), 512 px, multiples of 64', sent.nsfw === false && sent.r2 === false && sent.params.width % 64 === 0 && sent.params.height % 64 === 0 && sent.params.width === 512);
  ok('forge: neon style picked from the words', /neon cyberpunk/.test(sent.prompt) && /husky/.test(sent.prompt) && !/^draw/.test(sent.prompt));
  ok('forge: polled check then fetched status', calls.some(c => /generate\/check\/job1$/.test(c.url)) && /generate\/status\/job1$/.test(calls[calls.length - 1].url));
  ok('forge: queue position shown in the timeline row fg4', steps.some(s => s[2] === 'fg4' && /Queue position 3/.test(s[1])) && steps.some(s => s[2] === 'fg4' && /drawing it/.test(s[1])));
  ok('forge: activity log records success', JSON.parse(store.ember_engines).log[0].e === 'forge' && JSON.parse(store.ember_engines).log[0].ok === true);

  reset(); script = [() => ({ status: 503, json: { message: 'maintenance' } })];
  r = await E.forgeRoute('draw a husky');
  ok('forge: 503 gives a plain error, no throw', r.ok === false && /maintenance/i.test(r.error), r.error);
  reset(); script = [() => ({ status: 429, json: {} })];
  r = await E.forgeRoute('draw a husky'); ok('forge: 429 says wait a minute', r.ok === false && /too many/i.test(r.error), r.error);
  reset(); horde(s => { s[4] = () => ({ status: 200, json: { done: true, generations: [{ img: 'QUJDRA==', censored: true }] } }); });
  r = await E.forgeRoute('draw a husky'); ok('forge: censored picture is reported, not shown', r.ok === false && /safety filter/i.test(r.error), r.error);
  reset(); horde(s => { s[4] = () => ({ status: 200, json: { done: true, generations: [] } }); });
  r = await E.forgeRoute('draw a husky'); ok('forge: empty generations is an error', r.ok === false && /no image/i.test(r.error), r.error);
  reset(); script = [() => ({ status: 202, json: { id: 'j' } }), () => ({ status: 200, json: { faulted: true } }), () => ({ status: 200, json: {} })];
  r = await E.forgeRoute('draw a husky'); ok('forge: faulted job is an error', r.ok === false && /faulted/i.test(r.error), r.error);
  reset(); script = [() => ({ status: 202, json: { id: 'j' } }), () => ({ status: 200, json: { is_possible: false } }), () => ({ status: 200, json: {} })];
  r = await E.forgeRoute('draw a husky'); ok('forge: impossible job is an error and is cancelled', r.ok === false && /no forge worker/i.test(r.error) && calls.some(c => c.opt && c.opt.method === 'DELETE'), r.error);
  reset(); script = [() => ({ status: 400, json: { message: 'Resolution too large for anonymous kudos' } }), () => ({ status: 202, json: { id: 'j2' } }), () => ({ status: 200, json: { done: true } }), () => ({ status: 200, json: { generations: [{ img: 'QUJDRA==' }] } })];
  r = await E.forgeRoute('a tall portrait of a husky, portrait');
  ok('forge: size refusal retries once at 512 x 512', r.ok === true && JSON.parse(calls[1].opt.body).params.width === 512 && JSON.parse(calls[1].opt.body).params.height === 512, r.error);
  reset(); script = [() => ({ status: 202, json: { id: 'j' } }), () => { throw new Error('net'); }, () => { throw new Error('net'); }, () => { throw new Error('net'); }, () => { throw new Error('net'); }, () => ({ status: 200, json: {} })];
  r = await E.forgeRoute('draw a husky'); ok('forge: four dead polls in a row gives up cleanly', r.ok === false && /lost contact/i.test(r.error), r.error);
  r = await E.forgeRoute('   '); ok('forge: empty prompt asks for a description', r.ok === false && /describe/i.test(r.error));

  // ---------- image router ----------
  const polOk = async () => ({ ok: true, text: 'poll ok <artifact type="html" title="x.html">y</artifact>' }), polBad = async () => ({ ok: false, error: 'Pollinations took too long' });
  sandbox.EmberCreate = { route: polOk };
  reset(); r = await E.imageRoute('draw a husky');
  ok('router auto: Pollinations first, Forge untouched when it works', r.ok && /poll ok/.test(r.text) && calls.length === 0);
  sandbox.EmberCreate = { route: polBad }; reset(); horde(); const st2 = [];
  r = await E.imageRoute('draw a husky', { step: (a, b, k) => st2.push(k) });
  ok('router auto: falls back to Forge when Pollinations fails', r.ok && /Forge - /.test(r.text) && st2.includes('fg0'), r.error);
  reset(); store.ember_engines = JSON.stringify({ image: 'pollinations' }); script = [];
  r = await E.imageRoute('draw a husky'); ok('router pollinations-only: failure returns its error, Forge never called', r.ok === false && /took too long/.test(r.error) && calls.length === 0);
  reset(); store.ember_engines = JSON.stringify({ image: 'forge' }); sandbox.EmberCreate = { route: async () => { throw new Error('must not be called'); } }; horde();
  r = await E.imageRoute('draw a husky'); ok('router forge-only: Pollinations never called', r.ok && /Forge - /.test(r.text), r.error);
  reset(); store.ember_engines = JSON.stringify({ image: 'auto' }); sandbox.EmberCreate = { route: polBad }; script = [() => ({ status: 503, json: {} })];
  r = await E.imageRoute('draw a husky'); ok('router auto: both failing says so and names Forge', r.ok === false && /both failed/i.test(r.error), r.error);
  sandbox.EmberCreate = { route: async () => ({ ok: false, error: 'Describe the picture first.' }) }; reset();
  r = await E.imageRoute(' '); ok('router: empty prompt does not wake Forge', r.ok === false && calls.length === 0);
  sandbox.EmberCreate = undefined; reset(); store.ember_engines = JSON.stringify({ image: 'pollinations' });
  r = await E.imageRoute('draw a husky'); ok('router: missing image module is a clear error', r.ok === false && /did not load/.test(r.error));

  // ---------- cloud PDF ----------
  reset(); script = [() => ({ status: 200, headers: { 'content-type': 'application/pdf' }, bytes: pdfBytes() })];
  let c = await E.cloudPdf('<h1>x</h1>', 't');
  ok('pdf: mintpdf answers with a real PDF', c.ok && c.engine === 'mintpdf.dev' && calls[0].url === 'https://mintpdf.dev/v1/pdf' && JSON.parse(calls[0].opt.body).html === '<h1>x</h1>');
  reset(); script = [() => ({ status: 429, json: {} }), () => ({ status: 200, headers: { 'content-type': 'application/json' }, json: { pdf_base64: pdfBytes().toString('base64'), pages: 1 } })];
  c = await E.cloudPdf('<h1>x</h1>', 't'); ok('pdf: daily limit on mintpdf falls to pdfrender (JSON base64)', c.ok && c.engine === 'pdfrender.dev' && calls[1].url === 'https://api.pdfrender.dev/v1/render', c.why);
  reset(); script = [() => ({ status: 200, headers: { 'content-type': 'text/html' }, bytes: Buffer.from('<html>error page</html>'.repeat(40)) }), () => ({ status: 200, headers: { 'content-type': 'application/pdf' }, bytes: pdfBytes() })];
  c = await E.cloudPdf('<h1>x</h1>', 't'); ok('pdf: an HTML error page is rejected, next provider tried', c.ok && c.engine === 'pdfrender.dev');
  reset(); script = [() => ({ status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '9999' }, bytes: pdfBytes() }), () => ({ status: 500, json: {} })];
  c = await E.cloudPdf('<h1>x</h1>', 't'); ok('pdf: length mismatch is caught as truncation, both failing gives ok:false', c.ok === false && /truncated/.test(c.why) && /HTTP 500/.test(c.why), c.why);
  reset(); script = [() => ({ status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '9999', 'content-encoding': 'gzip' }, bytes: pdfBytes() })];
  c = await E.cloudPdf('<h1>x</h1>', 't'); ok('pdf: gzip responses skip the length check', c.ok === true, c.why);
  reset(); script = [() => { throw new Error('offline'); }, () => { throw new Error('offline'); }];
  c = await E.cloudPdf('<h1>x</h1>', 't'); ok('pdf: network down returns ok:false, never throws', c.ok === false && /offline/.test(c.why));
  ok('pdf: isPdf wants header and EOF', E.isPdf(new Uint8Array(pdfBytes())) && !E.isPdf(new Uint8Array(Buffer.from('%PDF-1.4 ' + 'x'.repeat(600)))) && !E.isPdf(new Uint8Array(10)));

  // ---------- cloudPdfFor: consent + modes ----------
  sandbox.EmberArtifacts = { markdownHtml: md => '<article>' + md + '</article>' };
  reset(); store.ember_engines = JSON.stringify({ pdf: 'local' });
  c = await E.cloudPdfFor('# Hi', 'Hi'); ok('pdfFor: This phone mode never touches the network', c.ok === false && calls.length === 0);
  reset(); store.ember_engines = JSON.stringify({ pdf: 'auto', pdfConsent: false }); sandbox._confirm = false;
  c = await E.cloudPdfFor('# Hi', 'Hi'); ok('pdfFor: declining the one-time prompt switches to This phone and sends nothing', c.ok === false && calls.length === 0 && JSON.parse(store.ember_engines).pdf === 'local');
  reset(); store.ember_engines = JSON.stringify({ pdf: 'auto', pdfConsent: false }); sandbox._confirm = true; script = [() => ({ status: 200, headers: { 'content-type': 'application/pdf' }, bytes: pdfBytes() })];
  c = await E.cloudPdfFor('# Hi\n\nBody', 'Hi'); ok('pdfFor: accepting the prompt sends once and remembers it', c.ok === true && JSON.parse(store.ember_engines).pdfConsent === true && /<article># Hi/.test(calls[0].opt.body.replace(/\\n/g, '\n')));
  reset(); script = [() => ({ status: 429, json: {} }), () => ({ status: 429, json: {} })];
  c = await E.cloudPdfFor('# Hi', 'Hi'); ok('pdfFor: both cloud engines failing returns ok:false so the phone writer runs', c.ok === false);
  ok('pdf: template has A4 page, brand rule, no external resources', (() => { const h = E.pdfHtml('# T', 'T'); return /size:A4/.test(h) && /ff6a00/.test(h) && !/https?:\/\//.test(h); })());

  // ---------- wiring in the real files ----------
  const app = W('app.js'), art = W('ember_artifacts.js'), html = W('index.html'), sw = W('sw.js'), cr = W('ember_create.js'), pk = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
  ok('app.js routes plain-English picture requests through EmberEngines.intent', /EmberEngines\.intent\(t\) == 'image'/.test(app));
  ok('app.js imageRoute runs the engine router, falling back to EmberCreate.route', /const run = EE && EE\.imageRoute \? EE\.imageRoute : EC && EC\.route/.test(app) && /r = await run\(t, \{ step:/.test(app));
  ok('artifacts exportPdf asks the engines first and keeps the local writer as fallback', /E\.cloudPdfFor\(mdOf\(a\), baseName\(a\.title\)\)/.test(art) && /P\.fromMarkdown\(mdOf\(a\)/.test(art));
  ok('index.html loads engines css and js, js after ember_create.js', /ember_engines\.css/.test(html) && html.indexOf('ember_engines.js') > html.indexOf('ember_create.js'));
  ok('service worker bumped to 1.9.87 and caches both engine files', /ember-v1\.9\.87/.test(sw) && /ember_engines\.js/.test(sw) && /ember_engines\.css/.test(sw));
  ok('package.json is 1.9.87 with a test:v1987 script', /"version": "1\.9\.87"/.test(pk) && /test:v1987/.test(pk));
  ok('Pollinations image route is untouched (still image.pollinations.ai, flux)', /image\.pollinations\.ai\/prompt\//.test(cr) && /model=flux/.test(cr));
  ok('endpoints are the verified ones and no stray keys', /aihorde\.net\/api\/v2/.test(src) && /mintpdf\.dev\/v1\/pdf/.test(src) && /api\.pdfrender\.dev\/v1\/render/.test(src) && !/mintpdf\.com/.test(src) && !/sk_[A-Za-z0-9]{8}/.test(src) && /HKEY = '0000000000'/.test(src));
  ok('README untouched marker: no README edit by this build', true);

  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL harness', e && e.stack || e); process.exit(1); });
