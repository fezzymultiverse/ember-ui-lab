// Ember V1.9.70 - ember_pdf.js: offline PDF writer, no libraries. Markdown (or simple HTML) in, a real PDF file out.
// Fonts are the PDF base-14 set (Helvetica, Courier) in WinAnsi, so text is Latin only; other scripts print as "?".
// Supports: headings, paragraphs, **bold**, *italic*, `code`, links (clickable), bullet/numbered lists (nested),
// task boxes, block quotes, fenced code, rules, tables (wrapped cells, header repeats on page break), page numbers.
'use strict';
(() => {
  const PW = 595.28, PH = 841.89, MX = 54, MT = 58, MB = 62, CW = PW - MX * 2;
  const ORANGE = '1 0.416 0', INK = '0.08 0.08 0.09', GREY = '0.42 0.42 0.45', LIGHT = '0.957 0.957 0.961', RULE = '0.83 0.83 0.85', LINK = '0.76 0.31 0';

  // ---- glyph widths (1/1000 em), chars 32..126 ----
  const HEL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HELB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXT = { 0x80: 556, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000 };
  const FONTS = { r: ['F1', 'Helvetica'], b: ['F2', 'Helvetica-Bold'], i: ['F3', 'Helvetica-Oblique'], bi: ['F4', 'Helvetica-BoldOblique'], c: ['F5', 'Courier'], cb: ['F6', 'Courier-Bold'] };

  const MAP = { 0x2018: 0x91, 0x2019: 0x92, 0x201A: 0x82, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2026: 0x85, 0x20AC: 0x80, 0x2122: 0x99, 0x2039: 0x8B, 0x203A: 0x9B, 0x0152: 0x8C, 0x0153: 0x9C, 0x0160: 0x8A, 0x0161: 0x9A, 0x017D: 0x8E, 0x017E: 0x9E, 0x0178: 0x9F, 0x2020: 0x86, 0x2021: 0x87, 0x2030: 0x89 };
  const REPL = { '\u2192': '->', '\u2190': '<-', '\u21d2': '=>', '\u2713': '[x]', '\u2714': '[x]', '\u2717': 'x', '\u2718': 'x', '\u2265': '>=', '\u2264': '<=', '\u2260': '!=', '\u2248': '~', '\u2212': '-', '\u2009': ' ', '\u202f': ' ', '\u2002': ' ', '\u2003': ' ', '\u200b': '', '\u200d': '', '\ufe0f': '', '\u25cf': '\u2022', '\u25aa': '\u2022', '\u2605': '*', '\u2606': '*' };
  function win(s) {
    let o = '';
    for (const ch of String(s == null ? '' : s)) {
      const c = ch.codePointAt(0);
      if (c === 9) o += '    ';
      else if (c < 32 || (c >= 127 && c < 160)) continue;
      else if (c < 127 || (c >= 160 && c <= 255)) o += ch;
      else if (MAP[c]) o += String.fromCharCode(MAP[c]);
      else if (REPL[ch] !== undefined) o += win(REPL[ch]);
      else if (c >= 0x1F000 || (c >= 0x2600 && c <= 0x27BF)) continue; // emoji and dingbats
      else o += '?';
    }
    return o;
  }
  const cw = (f, code) => {
    if (f === 'c' || f === 'cb') return 600;
    if (code >= 32 && code <= 126) return (f === 'b' || f === 'bi' ? HELB : HEL)[code - 32];
    return EXT[code] || (f === 'b' || f === 'bi' ? 611 : 556);
  };
  const tw = (f, s, size) => { let w = 0; for (let i = 0; i < s.length; i++) w += cw(f, s.charCodeAt(i)); return w * size / 1000; };
  const pstr = s => '(' + s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, m => '\\' + m.charCodeAt(0).toString(8).padStart(3, '0')) + ')';
  const n2 = n => (Math.round(n * 100) / 100).toString();

  // ---- inline markup -> runs ----
  function runsOf(src, b, i, link, out) {
    out = out || [];
    const re = /(`+)([^`]+?)\1|\*\*\*([^*]+?)\*\*\*|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|(?:^|\b)_([^_]+?)_(?=\b|$)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|~~([^~]+?)~~/g;
    let last = 0, m;
    const flag = (bb, ii) => (bb && ii ? 'bi' : bb ? 'b' : ii ? 'i' : 'r');
    const push = t => { if (t) out.push({ t: win(t), f: flag(b, i), link }); };
    while ((m = re.exec(src))) {
      push(src.slice(last, m.index));
      if (m[2] !== undefined) out.push({ t: win(m[2]), f: b ? 'cb' : 'c', code: true, link });
      else if (m[3] !== undefined) runsOf(m[3], true, true, link, out);
      else if (m[4] !== undefined) runsOf(m[4], true, i, link, out);
      else if (m[5] !== undefined) runsOf(m[5], true, i, link, out);
      else if (m[6] !== undefined) runsOf(m[6], b, true, link, out);
      else if (m[7] !== undefined) runsOf(m[7], b, true, link, out);
      else if (m[8] !== undefined) runsOf(m[8], b, i, /^https?:|^mailto:/i.test(m[9]) ? m[9] : link, out);
      else if (m[10] !== undefined) runsOf(m[10], b, i, link, out);
      last = re.lastIndex;
    }
    push(src.slice(last));
    return out;
  }

  // ---- wrap runs into lines of tokens ----
  function wrapRuns(runs, size, maxW, baseF) {
    const toks = [];
    runs.forEach(r => {
      const f = baseF && r.f === 'r' ? baseF : r.f;
      if (r.code) { r.t.split(/(\s+)/).forEach(p => { if (p) toks.push({ s: p, f, code: true, link: r.link, sp: /^\s+$/.test(p) }); }); return; }
      r.t.split(/(\s+)/).forEach(p => { if (p) toks.push({ s: p, f, link: r.link, sp: /^\s+$/.test(p) }); });
    });
    const lines = []; let cur = [], lw = 0;
    const width = t => tw(t.f, t.s, size) + (t.code && !t.sp ? 4 : 0);
    const flush = () => { while (cur.length && cur[cur.length - 1].sp) cur.pop(); lines.push(cur); cur = []; lw = 0; };
    toks.forEach(t => {
      let w = width(t);
      if (t.sp) { if (cur.length) { cur.push(t); lw += w; } return; }
      if (lw + w > maxW && cur.length) flush();
      if (w > maxW) { // a single token wider than the line: break it by characters
        let piece = '';
        for (const ch of t.s) {
          if (tw(t.f, piece + ch, size) > maxW && piece) { cur.push({ s: piece, f: t.f, code: t.code, link: t.link }); flush(); piece = ch; } else piece += ch;
        }
        t = { s: piece, f: t.f, code: t.code, link: t.link }; w = width(t);
      }
      cur.push(t); lw += w;
    });
    if (cur.length || !lines.length) flush();
    return lines;
  }
  const lineWidth = (line, size) => line.reduce((a, t) => a + tw(t.f, t.s, size) + (t.code && !t.sp ? 4 : 0), 0);

  // ---- markdown -> blocks ----
  function parseBlocks(md) {
    const L = String(md == null ? '' : md).replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '  \n').split('\n'), B = [];
    let para = [], i = 0;
    const flushPara = () => { if (para.length) { B.push({ k: 'p', t: para.join(' ') }); para = []; } };
    const isSep = s => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s) && s.includes('-');
    const cells = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
    while (i < L.length) {
      const line = L[i];
      let m;
      if ((m = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(line))) {
        flushPara(); const fence = m[1][0], code = []; i++;
        while (i < L.length && !new RegExp('^\\s*' + fence + '{3,}\\s*$').test(L[i])) code.push(L[i++]);
        i++; B.push({ k: 'code', lines: code }); continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); B.push({ k: 'hr' }); i++; continue; }
      if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) { flushPara(); B.push({ k: 'h', n: m[1].length, t: m[2] }); i++; continue; }
      if (line.includes('|') && i + 1 < L.length && isSep(L[i + 1]) && !isSep(line)) {
        flushPara(); const rows = [cells(line)]; i += 2;
        while (i < L.length && L[i].includes('|') && L[i].trim()) rows.push(cells(L[i++]));
        B.push({ k: 'table', rows }); continue;
      }
      if (/^\s*>/.test(line)) {
        flushPara(); const q = [];
        while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, ''));
        B.push({ k: 'quote', t: q.join(' ').trim() }); continue;
      }
      if ((m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line))) {
        flushPara();
        const ord = /\d/.test(m[2]) ? parseInt(m[2], 10) : null;
        let t = m[3], box = null;
        const cb = /^\[( |x|X)\]\s+(.*)$/.exec(t); if (cb) { box = cb[1] !== ' '; t = cb[2]; }
        const it = { k: 'li', lvl: Math.min(3, Math.floor(m[1].replace(/\t/g, '    ').length / 2)), ord, t, box };
        i++;
        while (i < L.length && L[i].trim() && /^\s{2,}\S/.test(L[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(L[i])) it.t += ' ' + L[i++].trim();
        B.push(it); continue;
      }
      if (!line.trim()) { flushPara(); i++; continue; }
      para.push(line.trim()); i++;
      if (/ {2,}$/.test(line) && L[i - 1] !== undefined) { /* hard break kept as a space; wrapping handles the rest */ }
    }
    flushPara();
    return B;
  }

  // ---- simple HTML -> markdown (for pdf artifacts that arrive as HTML) ----
  function htmlToMarkdown(html) {
    if (typeof DOMParser === 'undefined') return String(html).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    doc.querySelectorAll('script,style,noscript,template').forEach(n => n.remove());
    const out = [];
    const inline = n => {
      if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, ' ');
      if (n.nodeType !== 1) return '';
      const t = n.tagName.toLowerCase(), kids = () => Array.from(n.childNodes).map(inline).join('');
      if (t === 'br') return '  \n';
      if (t === 'b' || t === 'strong') return '**' + kids().trim() + '**';
      if (t === 'i' || t === 'em') return '*' + kids().trim() + '*';
      if (t === 'code') return '`' + n.textContent + '`';
      if (t === 'a' && n.getAttribute('href')) return '[' + kids().trim() + '](' + n.getAttribute('href') + ')';
      return kids();
    };
    const walk = (n, depth) => {
      Array.from(n.childNodes).forEach(c => {
        if (c.nodeType === 3) { const t = c.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(t, ''); return; }
        if (c.nodeType !== 1) return;
        const t = c.tagName.toLowerCase();
        if (/^h[1-6]$/.test(t)) out.push('#'.repeat(+t[1]) + ' ' + inline(c).trim(), '');
        else if (t === 'p' || t === 'div' && !c.querySelector('p,div,ul,ol,table,h1,h2,h3,pre,blockquote,section')) { const x = inline(c).trim(); if (x) out.push(x, ''); }
        else if (t === 'ul' || t === 'ol') {
          Array.from(c.children).forEach((li, k) => { if (li.tagName.toLowerCase() === 'li') { out.push('  '.repeat(depth) + (t === 'ol' ? (k + 1) + '. ' : '- ') + Array.from(li.childNodes).filter(x => !(x.nodeType === 1 && /^(ul|ol)$/i.test(x.tagName))).map(inline).join('').trim()); Array.from(li.children).filter(x => /^(ul|ol)$/i.test(x.tagName)).forEach(sub => walk({ childNodes: [sub] }, depth + 1)); } });
          out.push('');
        } else if (t === 'pre') out.push('```', c.textContent.replace(/\n$/, ''), '```', '');
        else if (t === 'blockquote') out.push('> ' + inline(c).trim(), '');
        else if (t === 'hr') out.push('---', '');
        else if (t === 'table') {
          const rows = Array.from(c.querySelectorAll('tr')).map(r => Array.from(r.children).map(x => inline(x).trim().replace(/\|/g, '\\|')));
          if (rows.length) { const w = Math.max(...rows.map(r => r.length)); const pad = r => '| ' + r.concat(Array(w - r.length).fill('')).join(' | ') + ' |'; out.push(pad(rows[0]), '|' + Array(w).fill(' --- ').join('|') + '|'); rows.slice(1).forEach(r => out.push(pad(r))); out.push(''); }
        } else walk(c, depth);
      });
    };
    walk(doc.body, 0);
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---- layout + assembly ----
  function build(md, opts) {
    opts = opts || {};
    const pages = []; let y = MT, cur = null;
    const newPage = () => { cur = { ops: [], links: [] }; pages.push(cur); y = MT; };
    newPage();
    const Y = v => PH - v;
    const need = h => { if (y + h > PH - MB) newPage(); };
    const text = (f, size, col, x, base, s) => { if (s) cur.ops.push('BT /' + FONTS[f][0] + ' ' + n2(size) + ' Tf ' + col + ' rg ' + n2(x) + ' ' + n2(Y(base)) + ' Td ' + pstr(s) + ' Tj ET'); };
    const rect = (col, x, top, w, h) => cur.ops.push(col + ' rg ' + n2(x) + ' ' + n2(Y(top + h)) + ' ' + n2(w) + ' ' + n2(h) + ' re f');
    const hline = (col, wd, x1, x2, at) => cur.ops.push(col + ' RG ' + n2(wd) + ' w ' + n2(x1) + ' ' + n2(Y(at)) + ' m ' + n2(x2) + ' ' + n2(Y(at)) + ' l S');
    const vline = (col, wd, x, t1, t2) => cur.ops.push(col + ' RG ' + n2(wd) + ' w ' + n2(x) + ' ' + n2(Y(t1)) + ' m ' + n2(x) + ' ' + n2(Y(t2)) + ' l S');

    // draw one wrapped line of tokens with its top edge at `top`
    function drawLine(line, x0, top, size, lead, col) {
      const base = top + (lead + size * 0.7) / 2;
      let x = x0;
      line.forEach(t => {
        const w = tw(t.f, t.s, size), cwid = w + (t.code && !t.sp ? 4 : 0);
        if (t.code && !t.sp) rect(LIGHT, x - 1, top + (lead - size * 1.25) / 2, cwid + 2, size * 1.25);
        if (!t.sp) {
          text(t.f, t.code ? size * 0.92 : size, t.link ? LINK : col, x + (t.code ? 2 : 0), base, t.s);
          if (t.link) { hline(LINK, 0.5, x, x + w, base + 1.5); cur.links.push({ x1: x, x2: x + w, top: top, bot: top + lead, url: t.link }); }
        }
        x += cwid;
      });
    }
    // paragraph-like block with page breaking; returns nothing, advances y
    function para(runs, x0, maxW, size, lead, col, baseF, after, deco) {
      const lines = wrapRuns(runs, size, maxW, baseF);
      lines.forEach(ln => { need(lead); if (deco) deco(y, lead); drawLine(ln, x0, y, size, lead, col); y += lead; });
      y += after;
    }

    const blocks = parseBlocks(md), toc = {};
    let first = true, ordCount = {};
    blocks.forEach((b, bi) => {
      const prevK = bi ? blocks[bi - 1].k : '';
      if (b.k !== 'li') ordCount = {};
      if (b.k === 'h') {
        const sz = [0, 22, 16.5, 13.5, 12, 11, 10.5][b.n], lead = sz * 1.3, before = first ? 0 : [0, 16, 13, 10, 8, 7, 6][b.n];
        need(before + lead + 44); if (y > MT) y += before;
        para(runsOf(b.t, true, false), MX, CW, sz, lead, INK, 'b', b.n <= 2 ? 3 : 4);
        if (b.n === 1) { hline(ORANGE, 1.6, MX, MX + CW, y - 1); y += 8; }
        else if (b.n === 2) { hline(RULE, 0.6, MX, MX + CW, y - 1); y += 6; }
      } else if (b.k === 'p') {
        para(runsOf(b.t, false, false), MX, CW, 10.5, 15, INK, 'r', 7);
      } else if (b.k === 'li') {
        const ind = MX + 6 + b.lvl * 16, tx = ind + 15, lead = 15, size = 10.5;
        let mark;
        if (b.box !== null) mark = b.box ? '[x]' : '[ ]';
        else if (b.ord !== null) { ordCount[b.lvl] = (ordCount[b.lvl] || b.ord - 1) + 1; mark = ordCount[b.lvl] + '.'; }
        else mark = b.lvl === 0 ? '\u2022' : b.lvl === 1 ? '\u2013' : '\u2022';
        const lines = wrapRuns(runsOf(b.t, false, false), size, CW - (tx - MX), 'r');
        lines.forEach((ln, k) => {
          need(lead);
          if (k === 0) text(b.box !== null ? 'c' : 'r', size, b.ord !== null ? INK : ORANGE, b.ord !== null || b.box !== null ? tx - 3 - tw('r', win(mark), size) : ind + 2, y + (lead + size * 0.7) / 2, win(mark));
          drawLine(ln, tx, y, size, lead, INK); y += lead;
        });
        y += 2.5; if (!blocks[bi + 1] || blocks[bi + 1].k !== 'li') y += 5;
      } else if (b.k === 'quote') {
        const x0 = MX + 14, lines = wrapRuns(runsOf(b.t, false, true), 10.5, CW - 14, 'i');
        lines.forEach(ln => { need(15); rect(ORANGE, MX + 2, y, 2.4, 15); drawLine(ln, x0, y, 10.5, 15, GREY); y += 15; });
        y += 8;
      } else if (b.k === 'code') {
        const size = 8.8, lead = 12.4, cwid = 0.6 * size, maxCh = Math.floor((CW - 18) / cwid);
        const rows = [];
        (b.lines.length ? b.lines : ['']).forEach(l => { const s = win(l); if (!s) { rows.push(''); return; } for (let k = 0; k < s.length; k += maxCh) rows.push(s.slice(k, k + maxCh)); });
        y += 2;
        rows.forEach((s, k) => {
          need(lead + 4);
          const topPad = k === 0 ? 5 : 0, botPad = k === rows.length - 1 ? 5 : 0;
          rect(LIGHT, MX, y, CW, lead + topPad + botPad + (k === rows.length - 1 ? 0 : 0.4));
          vline(RULE, 2, MX + 1, y, y + lead + topPad + botPad);
          text('c', size, INK, MX + 10, y + topPad + (lead + size * 0.7) / 2, s);
          y += lead + topPad + botPad;
        });
        y += 8;
      } else if (b.k === 'hr') {
        need(14); y += 5; hline(RULE, 0.8, MX, MX + CW, y); y += 9;
      } else if (b.k === 'table') {
        const rows = b.rows, nc = Math.max(...rows.map(r => r.length)), size = 9.5, lead = 13, pad = 5;
        const cellRuns = (r, c, hdr) => runsOf(r[c] || '', !!hdr, false);
        const want = Array(nc).fill(0), minw = Array(nc).fill(0);
        rows.forEach((r, ri) => { for (let c = 0; c < nc; c++) {
          const runs = cellRuns(r, c, ri === 0), line = wrapRuns(runs, size, 1e6, ri === 0 ? 'b' : 'r')[0] || [];
          want[c] = Math.max(want[c], lineWidth(line, size) + pad * 2);
          line.forEach(t => { if (!t.sp) minw[c] = Math.max(minw[c], tw(t.f, t.s, size) + pad * 2); });
        } });
        let cwids = want.slice(); const total = want.reduce((a, v) => a + v, 0);
        if (total > CW) {
          const mins = minw.map((v, c) => Math.min(v, want[c], CW / nc)), extra = CW - mins.reduce((a, v) => a + v, 0), room = want.reduce((a, v, c) => a + Math.max(0, v - mins[c]), 0) || 1;
          cwids = mins.map((v, c) => v + extra * Math.max(0, want[c] - v) / room);
        } else { const k = CW / total; cwids = want.map(v => v * k); }
        const xs = []; cwids.reduce((a, v) => { xs.push(a); return a + v; }, MX);
        const layoutRow = (r, ri) => { const cl = []; let h = 0; for (let c = 0; c < nc; c++) { const ls = wrapRuns(cellRuns(r, c, ri === 0), size, cwids[c] - pad * 2, ri === 0 ? 'b' : 'r'); cl.push(ls); h = Math.max(h, ls.length); } return { cl, h: h * lead + pad * 2 - 2 }; };
        const drawRow = (lr, ri) => {
          need(lr.h);
          if (ri === 0) rect('1 0.93 0.86', MX, y, CW, lr.h);
          lr.cl.forEach((ls, c) => ls.forEach((ln, k) => drawLine(ln, xs[c] + pad, y + pad - 1 + k * lead, size, lead, INK)));
          for (let c = 0; c <= nc; c++) vline(RULE, 0.5, c < nc ? xs[c] : MX + CW, y, y + lr.h);
          hline(RULE, 0.5, MX, MX + CW, y + lr.h);
          y += lr.h;
        };
        const hdr = layoutRow(rows[0], 0);
        need(hdr.h + 40); hline(RULE, 0.5, MX, MX + CW, y);
        drawRow(hdr, 0);
        rows.slice(1).forEach((r, ri) => {
          const lr = layoutRow(r, ri + 1);
          if (y + lr.h > PH - MB) { newPage(); hline(RULE, 0.5, MX, MX + CW, y); drawRow(hdr, 0); }
          drawRow(lr, ri + 1);
        });
        y += 10;
      }
      first = false;
    });

    // footers
    const total = pages.length, ttl = win(String(opts.title || 'Ember').replace(/\.(pdf|md|txt|html?)$/i, ''));
    pages.forEach((p, n) => {
      cur = p;
      hline(RULE, 0.5, MX, MX + CW, PH - MB + 14);
      let tt = ttl; while (tt.length > 3 && tw('r', tt, 8) > CW - 80) tt = tt.slice(0, -2);
      if (tt !== ttl) tt += '...';
      cur.ops.push('BT /F1 8 Tf ' + GREY + ' rg ' + n2(MX) + ' ' + n2(MB - 26) + ' Td ' + pstr(tt) + ' Tj ET');
      const pn = 'Page ' + (n + 1) + ' of ' + total;
      cur.ops.push('BT /F1 8 Tf ' + GREY + ' rg ' + n2(MX + CW - tw('r', pn, 8)) + ' ' + n2(MB - 26) + ' Td ' + pstr(pn) + ' Tj ET');
    });

    // objects: 1 catalog, 2 pages, 3..8 fonts, 9 info, then per page: page, content, annots
    const objs = [];
    const fontKeys = Object.keys(FONTS);
    const kids = [];
    let next = 10;
    const pageObjs = pages.map(p => { const po = next++, co = next++, an = p.links.map(() => next++); kids.push(po); return { po, co, an }; });
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    fontKeys.forEach((k, idx) => { objs[3 + idx] = '<< /Type /Font /Subtype /Type1 /BaseFont /' + FONTS[k][1] + ' /Encoding /WinAnsiEncoding >>'; });
    const d = new Date(), z = v => String(v).padStart(2, '0');
    objs[9] = '<< /Title ' + pstr(win(opts.title || 'Ember document')) + ' /Producer (Ember) /Creator (Ember) /CreationDate (D:' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()) + ') >>';
    const fontRes = '<< /Font << ' + fontKeys.map((k, idx) => '/' + FONTS[k][0] + ' ' + (3 + idx) + ' 0 R').join(' ') + ' >> >>';
    pages.forEach((p, n) => {
      const o = pageObjs[n], stream = p.ops.join('\n');
      objs[o.po] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(PW) + ' ' + n2(PH) + '] /Resources ' + fontRes + ' /Contents ' + o.co + ' 0 R' + (o.an.length ? ' /Annots [' + o.an.map(a => a + ' 0 R').join(' ') + ']' : '') + ' >>';
      objs[o.co] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
      p.links.forEach((l, k) => { objs[o.an[k]] = '<< /Type /Annot /Subtype /Link /Rect [' + [l.x1, Y(l.bot), l.x2, Y(l.top)].map(n2).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI ' + pstr(win(l.url)) + ' >> >>'; });
    });
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
    for (let k = 1; k < objs.length; k++) { offs[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    const xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let k = 1; k < objs.length; k++) out += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 9 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    const bytes = new Uint8Array(out.length);
    for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
    return { bytes, pages: total };
  }

  const fromMarkdown = (md, opts) => build(md, opts);
  const fromHtml = (html, opts) => build(htmlToMarkdown(html), opts);
  const toBlob = bytes => new Blob([bytes], { type: 'application/pdf' });
  window.EmberPDF = { fromMarkdown, fromHtml, htmlToMarkdown, toBlob, _win: win, _tw: tw, _parse: parseBlocks, _runs: runsOf };
})();
