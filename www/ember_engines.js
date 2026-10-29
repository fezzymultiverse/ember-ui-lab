// Ember V1.9.87 - ember_engines.js: media engine router. Two keyless integrations behind one switchboard.
//   IMAGE  Pollinations stays the default. "Forge" (AI Horde, anonymous key 0000000000) is the second engine: it takes over when Pollinations fails (Auto) or runs alone (Forge only).
//   PDF    Bundled pdfmake and docx provide private, no-account exports; basic EmberPDF is the fallback.
//   Plain-English routing: "draw a husky in neon Cape Town" goes to the image route without opening the + menu. PDFs already arrive as artifacts from the chat; saving them goes through here.
// Nothing leaves the phone until a picture is asked for or a PDF is saved. Cloud PDF asks once before the first send (the text of the document leaves the phone).
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'ember_engines';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const toast = m => { try { if (window.emberToast) return window.emberToast(m); } catch (e) { /* fall through */ } const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- settings + activity log ----------
  const DEF = { image: 'auto', pdf: 'local', nl: true, pdfConsent: false, log: [] };
  const IMAGE_MODES = ['auto', 'pollinations', 'forge'], PDF_MODES = ['auto', 'cloud', 'local'];
  const cfg = () => { const c = Object.assign({}, DEF, lsGet(KEY, {})); if (!IMAGE_MODES.includes(c.image)) c.image = 'auto'; if (!PDF_MODES.includes(c.pdf)) c.pdf = 'auto'; if (!Array.isArray(c.log)) c.log = []; return c; };
  const put = c => lsSet(KEY, c);
  function note(engine, ok, detail, ms) {
    const c = cfg(); c.log.unshift({ t: Date.now(), e: engine, ok: !!ok, d: String(detail || '').slice(0, 120), ms: ms || 0 }); c.log.length = Math.min(c.log.length, 14); put(c);
    try { if (sheet.classList.contains('show')) paint(); } catch (e) { /* sheet not built yet */ }
  }
  const lastOf = engine => cfg().log.find(x => x.e === engine) || null;

  // ---------- network ----------
  async function net(url, opt, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) { /* already done */ } }, ms || 20000);
    try { return await fetch(url, Object.assign({}, opt || {}, ctl ? { signal: ctl.signal } : {})); }
    finally { clearTimeout(t); }
  }
  const why = e => e && e.name === 'AbortError' ? 'timed out' : String((e && e.message) || e || 'failed').slice(0, 100);
  const jsonOf = async r => { try { return await r.json(); } catch (e) { return null; } };

  // ---------- plain-English intent ----------
  const CODEY = /\b(html|css|svg|react|vue|component|code|script|function|python|bash|javascript|json|csv|pdf|docx|word doc|slide|slides|deck|page|website|web ?app|app|template|ascii|upload|caption|classif\w*|resize|compress|convert|optimi[sz]e|alt text|dataset|model|api|endpoint|url|link|tag|format|diagram|chart|graph|flowchart|map|spreadsheet|excel|file)\b/i;
  const IDIOM = /^\s*(?:(?:an?|the|my|some)\s+)?(?:conclusion|comparison|parallel|distinction|line|attention|breath|blood|card|lesson|inspiration|strength|energy|power|salary|pension|water|fire|curtain|gun|sword|weapon|bath|lots|straws)\b/i;
  const LEAD = '^\\s*(?:hey\\s+\\w+[,!]?\\s*)?(?:please\\s+)?(?:(?:can|could|would|will)\\s+you\\s+)?(?:please\\s+)?(?:i\\s+(?:want|need)\\s+(?:you\\s+to\\s+)?)?';
  const R_NOUN = new RegExp(LEAD + '(?:make|create|generate|imagine|design|render|produce|paint|draw|sketch|illustrate)\\b[^.?!\\n]{0,40}?\\b(?:image|images|picture|pictures|pic|photo|photograph|illustration|artwork|wallpaper|poster|portrait|painting|drawing|avatar|logo|album cover|cover art)\\b', 'i');
  const R_DRAW = new RegExp(LEAD + '(?:draw|sketch|paint|illustrate)\\s+(?:me\\s+)?((?:an?|the|my|some)\\s+\\w+.*)$', 'i');
  function intent(text) {
    if (!cfg().nl) return null;
    const t = String(text || '').trim(); if (!t || t.length > 500 || t.split('\n').length > 3) return null;
    if (CODEY.test(t)) return null;
    if (/^\s*(?:please\s+)?(?:can|could|would|will)?\s*(?:you\s+)?imagine\s+(?:you|if|that|we|how|what|being|living|there)\b/i.test(t)) return null;
    if (R_NOUN.test(t)) return 'image';
    const m = R_DRAW.exec(t); if (m && !IDIOM.test(m[1])) return 'image';
    return null;
  }

  // ---------- Forge: AI Horde, anonymous ----------
  const HORDE = 'https://aihorde.net/api/v2', HKEY = '0000000000';
  const hHead = () => ({ 'Content-Type': 'application/json', apikey: HKEY, 'Client-Agent': 'Ember:1.9.87:philfesters' });
  const STYLES = { None: '', Photo: ', photorealistic, natural light, sharp detail', Anime: ', anime style, clean line art, vivid colour', Neon: ', neon cyberpunk, glowing orange and purple, dark background', Pixel: ', pixel art, 16-bit', Sketch: ', pencil sketch, hand drawn, high contrast' };
  const KW = [[/\b(photo|photograph|photoreal\w*|realistic|dslr|portrait photo)\b/i, 'Photo'], [/\b(anime|manga)\b/i, 'Anime'], [/\b(neon|cyberpunk|synthwave)\b/i, 'Neon'], [/\b(pixel art|pixel|8-bit|16-bit)\b/i, 'Pixel'], [/\b(sketch|pencil|hand drawn|line drawing)\b/i, 'Sketch']];
  const SIZES = { Square: [512, 512], Portrait: [512, 768], Landscape: [768, 512] };
  const pickStyle = p => { for (const [rx, k] of KW) if (rx.test(p)) return k; return 'None'; };
  const pickSize = p => /\b(portrait|vertical|tall|poster|phone wallpaper)\b/i.test(p) ? 'Portrait' : /\b(landscape|wide|banner|widescreen|horizontal|desktop wallpaper|cover)\b/i.test(p) ? 'Landscape' : 'Square';
  const cleanAsk = p => String(p || '').replace(/^\s*(?:hey\s+\w+[,!]?\s*)?(please\s+)?((can|could|would|will) you\s+)?(i\s+(want|need)\s+(you\s+to\s+)?)?(make|create|draw|generate|imagine|paint|design|render|produce|sketch|illustrate)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|pic|photo|drawing|illustration)?\s*(of|showing|with|:)?\s*/i, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();

  function shrink(src, maxSide, q) {
    return new Promise(res => {
      const im = new Image(); let done = false; const fin = v => { if (done) return; done = true; clearTimeout(tm); im.onload = im.onerror = null; res(v); };
      const tm = setTimeout(() => fin(null), 30000);
      im.onload = () => {
        const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!w0 || !h0) return fin(null);
        try {
          const s = Math.min(1, maxSide / Math.max(w0, h0)), w = Math.round(w0 * s), h = Math.round(h0 * s), c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
          fin({ url: c.toDataURL('image/jpeg', q || 0.86), w, h });
        } catch (e) { fin({ url: src, w: w0, h: h0 }); } // canvas blocked: keep the original
      };
      im.onerror = () => fin(null);
      im.src = src;
    });
  }

  async function hordeSubmit(full, w, h, seed) {
    const body = { prompt: full + ' ### blurry, low quality, deformed, watermark, signature, text', params: { sampler_name: 'k_euler_a', cfg_scale: 7, width: w, height: h, steps: 25, n: 1, seed: String(seed) }, nsfw: false, censor_nsfw: true, trusted_workers: false, slow_workers: true, r2: false, shared: false };
    const r = await net(HORDE + '/generate/async', { method: 'POST', headers: hHead(), body: JSON.stringify(body) }, 25000);
    const j = await jsonOf(r);
    if (r.status === 429) throw Object.assign(new Error('Forge says too many requests right now. Wait a minute.'), { soft: true });
    if (r.status === 503) throw new Error('Forge is in maintenance.');
    if (!r.ok || !j || !j.id) throw Object.assign(new Error('Forge refused it: ' + String((j && (j.message || (j.errors && JSON.stringify(j.errors)))) || ('HTTP ' + r.status)).slice(0, 140)), { size: /resolution|size|kudos|dimension|pixel/i.test(JSON.stringify(j || {})) });
    return j.id;
  }
  async function hordeCancel(id) { try { await net(HORDE + '/generate/status/' + id, { method: 'DELETE', headers: hHead() }, 8000); } catch (e) { /* best effort */ } }

  async function forgeImage(full, w, h, seed, onQueue, maxWait) {
    let id; const t0 = Date.now();
    try { id = await hordeSubmit(full, w, h, seed); }
    catch (e) { if (e && e.size && (w !== 512 || h !== 512)) { w = 512; h = 512; id = await hordeSubmit(full, w, h, seed); } else throw e; }
    let bad = 0;
    for (;;) {
      if (Date.now() - t0 > (maxWait || 240000)) { hordeCancel(id); throw new Error('Forge queue took longer than ' + Math.round((maxWait || 240000) / 60000) + ' minutes. Try again in a bit.'); }
      await sleep(3000);
      let c; try { const r = await net(HORDE + '/generate/check/' + id, { headers: hHead() }, 15000); c = await jsonOf(r); if (!r.ok || !c) throw new Error('check HTTP ' + r.status); bad = 0; }
      catch (e) { if (++bad >= 4) { hordeCancel(id); throw new Error('Lost contact with Forge (' + why(e) + ').'); } continue; }
      if (c.faulted) throw new Error('Forge faulted while drawing it.');
      if (c.is_possible === false) { hordeCancel(id); throw new Error('No Forge worker can draw that size right now.'); }
      if (c.done) break;
      try { if (onQueue) onQueue(c, Math.round((Date.now() - t0) / 1000)); } catch (e) { /* view only */ }
    }
    const r = await net(HORDE + '/generate/status/' + id, { headers: hHead() }, 30000), j = await jsonOf(r);
    const g = j && j.generations && j.generations[0];
    if (!r.ok || !g || !g.img) throw new Error('Forge finished but sent no image.');
    if (g.censored) throw new Error('Forge\'s safety filter blanked that picture. Reword it and try again.');
    let src = g.img;
    if (!/^data:|^https?:/i.test(src)) src = 'data:image/webp;base64,' + src;
    const s = await shrink(src, 768, 0.86);
    if (!s) throw new Error('Forge sent something that is not an image.');
    return { dataUrl: s.url, w: s.w, h: s.h, model: g.model || 'unknown', worker: g.worker_name || '', seed: g.seed || String(seed), reqW: w, reqH: h };
  }

  function detailsPage(d) {
    const row = (k, v) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(d.title) + '</title><style>' +
      'html,body{margin:0;background:#050506;color:#ececee;font:15px/1.55 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:18px 16px 32px}' +
      '.badge{display:inline-block;font:800 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:#1a0800;background:linear-gradient(135deg,#ff6a00,#ff9a4d);padding:6px 10px;border-radius:99px}' +
      'h1{font-size:19px;margin:14px 0 4px}h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#ff9a4d;margin:24px 0 8px}p{margin:0 0 8px;color:#bdbdc4}' +
      'ol{margin:0;padding:0;list-style:none}li{display:flex;gap:10px;padding:9px 0;border-top:1px solid #1d1d22}li:first-child{border-top:0}li i{flex:0 0 22px;height:22px;border-radius:50%;background:#2a1405;color:#ff9a4d;font:700 11px/22px system-ui;text-align:center;font-style:normal}li span{flex:1}li small{color:#8d8d94;white-space:nowrap}' +
      'table{width:100%;border-collapse:collapse}td{padding:7px 0;border-top:1px solid #1d1d22;vertical-align:top}td:first-child{color:#8d8d94;width:36%}code{display:block;white-space:pre-wrap;word-break:break-word;background:#0e0e11;border:1px solid #232328;border-radius:10px;padding:10px 12px;color:#d7d7dc;font:13px/1.5 ui-monospace,monospace}' +
      'footer{margin-top:28px;padding-top:12px;border-top:1px solid #1d1d22;color:#6c6c73;font-size:12px;letter-spacing:.06em}' +
      '</style></head><body><main><span class="badge">Forge</span><h1>' + esc(d.ask.slice(0, 90)) + '</h1><p>Drawn on community GPUs through the AI Horde. The picture itself is the other card (Save PNG there).</p>' +
      '<h2>Thought process</h2><ol>' + d.steps.map((s, i) => '<li><i>' + (i + 1) + '</i><span>' + esc(s[0]) + '</span><small>' + esc(s[1]) + '</small></li>').join('') + '</ol>' +
      '<h2>Prompt sent</h2><code>' + esc(d.full) + '</code><h2>Settings</h2><table>' + row('Service', 'aihorde.net (anonymous)') + row('Model', d.model) + row('Style', d.style) + row('Size', d.size + ' · ' + d.w + ' x ' + d.h) + row('Seed', String(d.seed)) + row('Total time', d.secs + 's') + '</table>' +
      '<footer>S.O.I × BOJACK · 999</footer></main></body></html>';
  }
  const slug = (s, n) => String(s || '').replace(/[^\w\s-]/g, '').trim().slice(0, n || 38).trim().replace(/\s+/g, ' ') || 'image';
  const imageSvg = d => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + d.w + ' ' + d.h + '" width="' + d.w + '" height="' + d.h + '"><image href="' + d.dataUrl + '" x="0" y="0" width="' + d.w + '" height="' + d.h + '" preserveAspectRatio="xMidYMid slice"/></svg>';

  async function forgeRoute(prompt, hk) {
    hk = hk || {};
    const step = (ic, text, key) => { try { if (hk.step) hk.step(ic, text, key); } catch (e) { /* the card is a view only */ } };
    const raw = String(prompt || '').trim().slice(0, 600), ask = cleanAsk(raw).slice(0, 400);
    if (!ask) return { ok: false, error: 'Describe the picture first.' };
    const t0 = Date.now(), steps = [], lap = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
    const words = (ask.match(/\S+/g) || []).length;
    step('msg', 'Reading your picture request · ' + words + ' word' + (words == 1 ? '' : 's'), 'fg1'); steps.push(['Read your request (' + words + ' word' + (words == 1 ? '' : 's') + ')', lap()]);
    const style = pickStyle(raw), size = pickSize(raw), [w, h] = SIZES[size] || SIZES.Square;
    step('files', 'Style: ' + (style == 'None' ? 'as written' : style) + ' · Size: ' + size + ' (' + w + ' x ' + h + ')', 'fg2'); steps.push(['Picked style ' + (style == 'None' ? 'as written' : style) + ' and size ' + size, lap()]);
    const full = ask + (STYLES[style] || ''), seed = Math.floor(Math.random() * 1e9);
    step('globe', 'Routing to Forge (AI Horde, anonymous). No chat engine used', 'fg3'); steps.push(['Routed to Forge (AI Horde), seed ' + seed, lap()]);
    step('bolt', 'Joining the Forge queue…', 'fg4');
    let r;
    try {
      r = await forgeImage(full, w, h, seed, (c, secs) => step('bolt', c.processing ? 'Forge is drawing it · ' + secs + 's' : 'Queue position ' + (c.queue_position != null ? c.queue_position : '?') + (c.wait_time ? ' · about ' + c.wait_time + 's' : '') + ' · ' + secs + 's waited', 'fg4'));
    } catch (e) {
      step('bolt', 'Forge failed: ' + why(e), 'fg4'); note('forge', false, why(e), Date.now() - t0);
      return { ok: false, error: why(e) };
    }
    step('bolt', 'Drawn in ' + lap(), 'fg4'); steps.push(['Forge drew it on ' + (r.worker || 'a community GPU'), lap()]); note('forge', true, (r.model || 'model') + ' · ' + lap(), Date.now() - t0);
    step('files', 'Wrapping the picture as an artifact', 'fg5'); steps.push(['Wrapped it as artifacts for you to open and save', lap()]);
    const sty = style == 'None' ? 'As written' : style, base = slug(ask, 34);
    const svg = imageSvg(r);
    const html = detailsPage({ title: 'Forge details', ask, full, style: sty, size, w: r.w, h: r.h, seed: r.seed, model: r.model, steps, secs: ((Date.now() - t0) / 1000).toFixed(1) });
    const intro = 'Done. Open the picture to save it as a PNG. The second card shows how I made it. Say what to change and I will draw another.';
    return { ok: true, engine: 'forge', text: intro + '\n<artifact type="svg" title="Forge - ' + base + '.svg">\n' + svg + '\n</artifact>\n<artifact type="html" title="Forge - ' + base + ' (details).html">\n' + html + '\n</artifact>' };
  }

  async function imageRoute(prompt, hk) {
    hk = hk || {}; const c = cfg(), EC = window.EmberCreate;
    const order = c.image == 'forge' ? ['forge'] : c.image == 'pollinations' ? ['pollinations'] : ['pollinations', 'forge'];
    const step = (ic, text, key) => { try { if (hk.step) hk.step(ic, text, key); } catch (e) { /* view only */ } };
    let last = '';
    for (const eng of order) {
      if (eng === 'pollinations') {
        if (!EC || !EC.route) { last = 'Image creation did not load. Restart Ember and try again.'; continue; }
        const t0 = Date.now(); let r; try { r = await EC.route(prompt, hk); } catch (e) { r = { ok: false, error: why(e) }; }
        if (r && r.ok) { note('pollinations', true, 'drawn in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's', Date.now() - t0); return r; }
        last = (r && r.error) || 'Pollinations did not answer.';
        if (/^Describe the picture/.test(last)) return r;
        note('pollinations', false, last, Date.now() - t0);
        if (order.length > 1) step('globe', 'Pollinations did not answer. Switching to Forge (slower, queue based)', 'fg0');
      } else {
        const r = await forgeRoute(prompt, hk);
        if (r.ok) return r;
        last = (order.length > 1 ? 'Pollinations and Forge both failed. Forge said: ' : 'Forge said: ') + r.error;
      }
    }
    return { ok: false, error: last || 'No image engine could draw that.' };
  }

  async function forgeCheck() {
    const t0 = Date.now();
    try { const r = await net(HORDE + '/status/heartbeat', { headers: { 'Client-Agent': 'Ember:1.9.87:philfesters' } }, 12000); if (!r.ok) throw new Error('HTTP ' + r.status); note('forge', true, 'heartbeat ok · ' + (Date.now() - t0) + 'ms', Date.now() - t0); return { ok: true, ms: Date.now() - t0 }; }
    catch (e) { note('forge', false, 'heartbeat: ' + why(e), Date.now() - t0); return { ok: false, why: why(e) }; }
  }

  // ---------- Cloud PDF ----------
  // No verified anonymous hosted PDF provider is configured. Private bundled providers are used instead.
  const PDF_PROVIDERS = [];
  const isPdf = u8 => {
    if (!u8 || u8.length < 400) return false;
    const head = String.fromCharCode.apply(null, Array.prototype.slice.call(u8, 0, 5));
    const tail = String.fromCharCode.apply(null, Array.prototype.slice.call(u8, Math.max(0, u8.length - 1100)));
    return head === '%PDF-' && tail.indexOf('%%EOF') >= 0;
  };
  const b64Bytes = b => { const bin = atob(String(b).replace(/^data:[^,]*,/, '').replace(/\s+/g, '')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  async function readPdf(res) {
    const h = res.headers && res.headers.get ? n => res.headers.get(n) || '' : () => '';
    const ct = h('content-type').toLowerCase();
    if (/json/.test(ct)) {
      const j = await res.json(), b64 = j && (j.pdf_base64 || j.pdf || j.data);
      if (b64) { const u = b64Bytes(b64); if (isPdf(u)) return u; throw new Error('bad PDF in JSON'); }
      if (j && j.url) { const r2 = await net(j.url, {}, 25000); if (!r2.ok) throw new Error('link HTTP ' + r2.status); const u = new Uint8Array(await r2.arrayBuffer()); if (isPdf(u)) return u; throw new Error('bad PDF from link'); }
      throw new Error((j && (j.error || j.message)) ? String(j.error || j.message).slice(0, 90) : 'unexpected JSON');
    }
    const buf = await res.arrayBuffer(), u = new Uint8Array(buf), len = Number(h('content-length')) || 0;
    if (len && !h('content-encoding') && buf.byteLength !== len) throw new Error('PDF came back truncated (' + buf.byteLength + ' of ' + len + ' bytes)');
    if (!isPdf(u)) throw new Error('reply was not a valid PDF');
    return u;
  }
  const PDF_CSS = '@page{size:A4;margin:18mm 16mm 20mm;@bottom-center{content:counter(page);font:9pt Helvetica,Arial,sans-serif;color:#888}}' +
    'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:11pt/1.5 Helvetica,Arial,sans-serif;color:#141416;margin:0}' +
    'h1{font-size:23pt;line-height:1.2;margin:0 0 10pt;padding-bottom:6pt;border-bottom:2.5pt solid #ff6a00}h2{font-size:15pt;margin:18pt 0 6pt;color:#111}h3{font-size:12.5pt;margin:14pt 0 4pt}p{margin:0 0 8pt}' +
    'ul,ol{margin:0 0 8pt;padding-left:18pt}li{margin:2pt 0}a{color:#c2410c}blockquote{margin:8pt 0;padding:4pt 0 4pt 10pt;border-left:3pt solid #ff6a00;color:#44444a}' +
    'table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:10pt}th,td{border:.6pt solid #c9c9cf;padding:4pt 6pt;text-align:left;vertical-align:top}th{background:#fff0e3}tr{page-break-inside:avoid}' +
    'pre,code{font-family:Courier,"Courier New",monospace;font-size:9.5pt;background:#f4f4f6}pre{padding:8pt;border-radius:4pt;white-space:pre-wrap;word-break:break-word;page-break-inside:avoid}code{padding:0 2pt}hr{border:0;border-top:.6pt solid #cfcfd5;margin:12pt 0}';
  function pdfHtml(md, title) {
    const A = window.EmberArtifacts; if (!A || !A.markdownHtml) return null;
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PDF_CSS + '</style></head><body>' + A.markdownHtml(md) + '</body></html>';
  }
  async function cloudPdf(html, title, onTry) {
    const errs = [];
    for (const p of PDF_PROVIDERS) {
      const t0 = Date.now();
      try {
        if (onTry) { try { onTry(p); } catch (e) { /* view only */ } }
        const r = await net(p.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/pdf, application/json' }, body: JSON.stringify(p.body(html)) }, 30000);
        if (r.status === 429) throw new Error('daily limit reached');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const u8 = await readPdf(r);
        note('pdf:' + p.id, true, Math.round(u8.length / 1024) + ' KB · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's', Date.now() - t0);
        return { ok: true, blob: new Blob([u8], { type: 'application/pdf' }), engine: p.name };
      } catch (e) { errs.push(p.name + ': ' + why(e)); note('pdf:' + p.id, false, why(e), Date.now() - t0); }
    }
    return { ok: false, why: errs.join(' · ') };
  }
  // Called by ember_artifacts.js exportPdf(). ok:false means "build it on this phone".
  async function cloudPdfFor(md, title) {
    return { ok: false, why: 'Cloud PDF disabled: no verified hosted provider. Ember uses bundled offline engines.' };
  }

  async function pdfCheck() {
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{font:12pt Helvetica,sans-serif;padding:20pt}h1{color:#ff6a00}</style></head><body><h1>Ember engine check</h1><p>If you can read this, the cloud PDF engine works. ' + new Date().toISOString() + '</p>' + '<p>' + 'The quick brown fox jumps over the lazy dog. '.repeat(12) + '</p></body></html>';
    const r = await cloudPdf(html, 'check'); return r.ok ? { ok: true, engine: r.engine } : { ok: false, why: r.why };
  }

  // ---------- Media engines sheet ----------
  const sheet = document.createElement('section'); sheet.id = 'xengines'; sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Media engines');
  sheet.innerHTML = '<div class="sh"><b>Media engines</b><button class="hb" id="egX" aria-label="Close">✕</button></div><div class="sb eg" id="egBody"></div>';
  const mount = $('app') ? $('app').parentNode : document.body; mount.appendChild(sheet);
  const dot = (e, alt) => { const l = lastOf(e) || (alt && lastOf(alt)); return l ? (l.ok ? 'ok' : 'bad') : 'idle'; };
  const ago = t => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 90 ? s + 's ago' : s < 5400 ? Math.round(s / 60) + 'm ago' : Math.round(s / 3600) + 'h ago'; };
  const seg = (name, val, opts) => '<div class="eg-seg" role="group" aria-label="' + name + '">' + opts.map(o => '<button type="button" class="eg-opt' + (o[0] === val ? ' on' : '') + '" data-seg="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + o[1] + '</button>').join('') + '</div>';
  const eng = (name, tag, line, e, alt) => { const l = lastOf(e) || (alt && lastOf(alt)); return '<div class="eg-eng"><i class="eg-dot ' + dot(e, alt) + '" aria-hidden="true"></i><div><b>' + name + ' <em>' + tag + '</em></b><small>' + line + '</small>' + (l ? '<small class="eg-last">' + (l.ok ? 'Last: worked' : 'Last: failed') + ' · ' + esc(l.d) + ' · ' + ago(l.t) + '</small>' : '<small class="eg-last">Not used yet</small>') + '</div></div>'; };
  function paint() {
    const c = cfg(), b = $('egBody'); if (!b) return;
    b.innerHTML =
      '<div class="eg-hero"><span class="eg-brand">S.O.I × BOJACK · 999</span><h2>Keyless engines</h2><p>Ask in plain English. Ember picks the engine, makes the artifact, and you open and save it. Pollinations stays the default for pictures.</p></div>' +
      '<div class="eg-card"><div class="eg-h">🎨 Pictures</div>' + seg('image', c.image, [['auto', 'Auto'], ['pollinations', 'Pollinations'], ['forge', 'Forge only']]) +
      '<p class="hint">Auto tries Pollinations first and falls back to Forge if it fails. Forge is the AI Horde: free community GPUs, no key, a queue of 30 seconds to a few minutes, 512 px pictures.</p>' +
      eng('Pollinations', 'flux · fast', 'image.pollinations.ai, about one picture per 15 s anonymous', 'pollinations') + eng('Forge', 'AI Horde · queue', 'aihorde.net anonymous key, drawn on volunteer GPUs', 'forge') +
      '<div class="eg-row"><button type="button" class="btn g" id="egTestF">Check Forge</button></div></div>' +
      '<div class="eg-card"><div class="eg-h">📄 PDFs</div>' + seg('pdf', c.pdf, [['local', 'Private / no account']]) +
      '<p class="hint">Ember PDF uses bundled pdfmake with embedded Roboto fonts. Ember Documents exports genuine DOCX through the bundled docx engine. Both are free software, run on this device and need no provider account. Font coverage is not universal. Basic PDF is the fallback.</p>' +
      '<div class="eg-eng"><i class="eg-dot ok" aria-hidden="true"></i><div><b>Ember PDF &amp; Documents <em>offline · no signup</em></b><small>pdfmake 0.2.20 + docx 9.5.1 (MIT). Documents stay on your device during export.</small></div></div></div>' +
      '<div class="eg-card"><div class="eg-h">💬 Plain English</div><button type="button" class="eg-sw' + (c.nl ? ' on' : '') + '" id="egNl" role="switch" aria-checked="' + c.nl + '"><span>Route requests like “draw a husky in neon” to the picture engines</span><i></i></button><p class="hint">Off means pictures only start from + > Create image.</p></div>' +
      '<div class="eg-card"><div class="eg-h">🧾 Recent activity</div>' + (c.log.length ? '<ul class="eg-log">' + c.log.slice(0, 8).map(l => '<li class="' + (l.ok ? 'ok' : 'bad') + '"><b>' + esc(l.e.replace('pdf:', 'pdf · ')) + '</b><span>' + esc(l.d) + '</span><small>' + ago(l.t) + '</small></li>').join('') + '</ul>' : '<p class="hint">Nothing yet. Ask for a picture or save a PDF.</p>') + '</div>' +
      '<p class="eg-foot">Keyless first. Pictures leave the phone only when you ask for one. Pollinations audio and its newer endpoints need a key, so they are not used here.</p>';
  }
  function show(v) { sheet.classList.toggle('show', !!v); if (v) { paint(); const b = $('egBody'); if (b) b.scrollTop = 0; } }
  $('egX').onclick = () => show(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('show')) show(false); });
  sheet.addEventListener('click', async e => {
    const s = e.target.closest('[data-seg]');
    if (s) { const c = cfg(); c[s.dataset.seg] = s.dataset.v; if (s.dataset.seg === 'pdf' && s.dataset.v === 'cloud') c.pdfConsent = true; if (s.dataset.seg === 'pdf' && s.dataset.v === 'auto') c.pdfConsent = false; put(c); paint(); return; }
    if (e.target.closest('#egNl')) { const c = cfg(); c.nl = !c.nl; put(c); paint(); toast(c.nl ? 'Plain-English picture routing on' : 'Plain-English picture routing off'); return; }
    const f = e.target.closest('#egTestF'), p = e.target.closest('#egTestP');
    if (f) { f.disabled = true; f.textContent = 'Checking…'; const r = await forgeCheck(); toast(r.ok ? 'Forge is up (' + r.ms + ' ms)' : 'Forge did not answer: ' + r.why); paint(); }
    if (p) { p.disabled = true; p.textContent = 'Rendering…'; const r = await pdfCheck(); toast(r.ok ? 'Cloud PDF works (' + r.engine + ')' : 'Cloud PDF failed: ' + String(r.why).slice(0, 80)); paint(); }
  });

  window.EmberEngines = { open: () => show(true), close: () => show(false), intent, imageRoute, forgeRoute, forgeImage, forgeCheck, cloudPdf, cloudPdfFor, pdfCheck, pdfHtml, readPdf, isPdf, config: cfg, _note: note };
})();
