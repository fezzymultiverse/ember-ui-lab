// Ember V1.6.7 - ember_term.js: EMBER TERMUX, the terminal panel docked at the bottom of Settings > Hacking.
// It talks to a plain `ttyd` the person starts in their own Termux (127.0.0.1 only, private path). Ember never runs or sources any of their
// scripts: the shell is a bare `bash`. The terminal emulator below is written here (no CDN, works offline from the first run).
// "Ask Ember" reads the last lines of the screen (secrets masked) and hands back commands with an Insert button: nothing runs until the person taps.
'use strict';
(() => {
// =====================================================================================================================
// 1. Terminal core: a small VT100/xterm-style screen. No DOM in here, so it can be tested in Node.
// =====================================================================================================================
const PAL16 = ['#1a1b26', '#ff3b30', '#5fff00', '#ffb800', '#3d8bff', '#af5fff', '#00e5ff', '#cfd8dc', '#4b5063', '#ff5f87', '#7dff4d', '#ffd25a', '#6aa5ff', '#c68bff', '#5ff3ff', '#ffffff'];
const hx = v => v.toString(16).padStart(2, '0');
function color256(n) {
  if (n < 16) return PAL16[n];
  if (n < 232) { n -= 16; const f = v => v ? 55 + v * 40 : 0; return '#' + hx(f(Math.floor(n / 36))) + hx(f(Math.floor(n / 6) % 6)) + hx(f(n % 6)); }
  const v = 8 + (n - 232) * 10; return '#' + hx(v) + hx(v) + hx(v);
}
const DEC = { q: '─', x: '│', l: '┌', k: '┐', m: '└', j: '┘', t: '├', u: '┤', v: '┴', w: '┬', n: '┼', a: '▒', '`': '◆', f: '°', g: '±', o: '⎺', s: '⎽', '~': '·' };
const F_BOLD = 1, F_DIM = 2, F_ITAL = 4, F_UL = 8, F_REV = 16, F_STRIKE = 32, F_HID = 64;

class TermCore {
  constructor(cols, rows, opts) {
    this.cols = cols; this.rows = rows; this.sbMax = (opts && opts.sbMax) || 1000;
    this.attrs = [{ fg: null, bg: null, f: 0 }]; this.amap = { 'n|n|0': 0 };
    this.cur = { fg: null, bg: null, f: 0 }; this.curId = 0;
    this.onData = () => {}; this.onScrollback = () => {}; this.onTitle = () => {};
    this.sbText = []; this.title = '';
    this.reset();
  }
  reset() {
    this.screen = []; for (let i = 0; i < this.rows; i++) this.screen.push(this.mkRow());
    this.x = 0; this.y = 0; this.top = 0; this.bot = this.rows - 1; this.saved = { x: 0, y: 0, a: 0 };
    this.alt = false; this.mainSave = null; this.wrapPending = false; this.curVis = true; this.appCursor = false; this.bracketed = false; this.autowrap = true;
    this.st = 'g'; this.buf = ''; this.g0 = 'B'; this.dirty = new Set(); this.allDirty();
  }
  mkRow(id) { return { ch: new Array(this.cols).fill(' '), at: new Array(this.cols).fill(id || 0) }; }
  allDirty() { for (let i = 0; i < this.rows; i++) this.dirty.add(i); }
  attrId() {
    const c = this.cur, k = (c.fg || 'n') + '|' + (c.bg || 'n') + '|' + c.f;
    if (this.amap[k] === undefined) { this.amap[k] = this.attrs.length; this.attrs.push({ fg: c.fg, bg: c.bg, f: c.f }); }
    return this.amap[k];
  }
  eraseId() {
    const k = 'n|' + (this.cur.bg || 'n') + '|0';
    if (this.amap[k] === undefined) { this.amap[k] = this.attrs.length; this.attrs.push({ fg: null, bg: this.cur.bg, f: 0 }); }
    return this.amap[k];
  }
  // ---- output parser ----
  write(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s[i], code = c.charCodeAt(0);
      switch (this.st) {
        case 'g':
          if (code === 0x1b) this.st = 'e';
          else if (code >= 0x20 && code !== 0x7f) this.put(c);
          else this.ctl(code);
          break;
        case 'e':
          this.st = 'g';
          if (c === '[') { this.st = 'c'; this.buf = ''; }
          else if (c === ']') { this.st = 'o'; this.buf = ''; }
          else if (c === '(' || c === ')' || c === '*' || c === '+') { this.st = 's'; this.cs = c; }
          else if (c === '7') this.saveCur();
          else if (c === '8') this.restoreCur();
          else if (c === 'M') this.ri();
          else if (c === 'D') this.lf();
          else if (c === 'E') { this.x = 0; this.lf(); }
          else if (c === 'c') { this.reset(); }
          else if (c === 'P' || c === '_' || c === '^' || c === 'X') { this.st = 'o'; this.buf = ''; }
          break;
        case 's': if (this.cs === '(') this.g0 = c; this.st = 'g'; break;
        case 'c':
          if (code >= 0x40 && code <= 0x7e) { this.st = 'g'; this.csi(this.buf, c); }
          else if (this.buf.length < 64) this.buf += c;
          else this.st = 'g';
          break;
        case 'o':
          if (code === 7) { this.osc(this.buf); this.st = 'g'; }
          else if (code === 0x1b) this.st = 'x';
          else if (this.buf.length < 512) this.buf += c;
          break;
        case 'x': this.osc(this.buf); this.st = (c === '\\') ? 'g' : 'g'; break;
      }
    }
  }
  osc(b) {
    const m = /^([012]);(.*)$/.exec(b); if (m) { this.title = m[2]; this.onTitle(m[2]); }
  }
  ctl(code) {
    if (code === 10 || code === 11 || code === 12) this.lf();
    else if (code === 13) { this.x = 0; this.wrapPending = false; }
    else if (code === 8) { if (this.x > 0) this.x--; this.wrapPending = false; }
    else if (code === 9) { this.x = Math.min(this.cols - 1, (this.x + 8) & ~7); this.wrapPending = false; }
  }
  put(ch) {
    if (this.wrapPending) { if (this.autowrap) { this.x = 0; this.lf(); } this.wrapPending = false; }
    if (this.g0 === '0' && DEC[ch]) ch = DEC[ch];
    const r = this.screen[this.y]; r.ch[this.x] = ch; r.at[this.x] = this.curId; this.dirty.add(this.y);
    if (this.x >= this.cols - 1) this.wrapPending = true; else this.x++;
  }
  lf() { if (this.y === this.bot) this.scrollUp(1); else if (this.y < this.rows - 1) this.y++; }
  ri() { if (this.y === this.top) this.scrollDown(1); else if (this.y > 0) this.y--; }
  markRegion() { for (let i = this.top; i <= this.bot; i++) this.dirty.add(i); }
  scrollUp(n) {
    n = Math.min(n, this.bot - this.top + 1);
    for (let i = 0; i < n; i++) {
      const gone = this.screen.splice(this.top, 1)[0];
      this.screen.splice(this.bot, 0, this.mkRow(this.eraseId()));
      if (!this.alt && this.top === 0 && this.bot === this.rows - 1) this.pushSb(gone);
    }
    this.markRegion();
  }
  scrollDown(n) {
    n = Math.min(n, this.bot - this.top + 1);
    for (let i = 0; i < n; i++) { this.screen.splice(this.bot, 1); this.screen.splice(this.top, 0, this.mkRow(this.eraseId())); }
    this.markRegion();
  }
  pushSb(row) {
    const t = row.ch.join('').replace(/\s+$/, ''); this.sbText.push(t);
    if (this.sbText.length > this.sbMax) this.sbText.shift();
    this.onScrollback(row, t);
  }
  saveCur() { this.saved = { x: this.x, y: this.y, a: this.curId, c: Object.assign({}, this.cur) }; }
  restoreCur() { this.x = Math.min(this.saved.x, this.cols - 1); this.y = Math.min(this.saved.y, this.rows - 1); if (this.saved.c) { this.cur = Object.assign({}, this.saved.c); this.curId = this.attrId(); } this.wrapPending = false; }
  eraseCells(y, a, b) { const r = this.screen[y], id = this.eraseId(); for (let i = a; i <= b && i < this.cols; i++) { r.ch[i] = ' '; r.at[i] = id; } this.dirty.add(y); }
  csi(raw, f) {
    let priv = ''; if (raw && '?<>=!'.indexOf(raw[0]) >= 0) { priv = raw[0]; raw = raw.slice(1); }
    const ps = raw.split(/[;:]/).map(v => v === '' ? NaN : parseInt(v, 10));
    const p = (i, d) => (ps[i] === undefined || isNaN(ps[i])) ? d : ps[i];
    const one = (i) => Math.max(1, p(i, 1));
    if (priv === '?' && (f === 'h' || f === 'l')) { this.setModes(ps.filter(v => !isNaN(v)), f === 'h'); return; }
    if (priv) { if (priv === '>' && f === 'c') this.onData('\x1b[>0;0;0c'); return; }
    this.wrapPending = false;
    switch (f) {
      case 'A': this.y = Math.max(this.top > this.y ? 0 : this.top, this.y - one(0)); break;
      case 'B': this.y = Math.min(this.y >= this.top && this.y <= this.bot ? this.bot : this.rows - 1, this.y + one(0)); break;
      case 'C': this.x = Math.min(this.cols - 1, this.x + one(0)); break;
      case 'D': this.x = Math.max(0, this.x - one(0)); break;
      case 'E': this.x = 0; this.y = Math.min(this.rows - 1, this.y + one(0)); break;
      case 'F': this.x = 0; this.y = Math.max(0, this.y - one(0)); break;
      case 'G': case '`': this.x = Math.min(this.cols - 1, one(0) - 1); break;
      case 'H': case 'f': this.y = Math.min(this.rows - 1, one(0) - 1); this.x = Math.min(this.cols - 1, one(1) - 1); break;
      case 'd': this.y = Math.min(this.rows - 1, one(0) - 1); break;
      case 'J': {
        const m = p(0, 0);
        if (m === 0) { this.eraseCells(this.y, this.x, this.cols - 1); for (let i = this.y + 1; i < this.rows; i++) this.eraseCells(i, 0, this.cols - 1); }
        else if (m === 1) { for (let i = 0; i < this.y; i++) this.eraseCells(i, 0, this.cols - 1); this.eraseCells(this.y, 0, this.x); }
        else if (m === 2 || m === 3) { for (let i = 0; i < this.rows; i++) this.eraseCells(i, 0, this.cols - 1); if (m === 3) { this.sbText = []; this.onScrollback(null, null); } }
        break;
      }
      case 'K': { const m = p(0, 0); if (m === 0) this.eraseCells(this.y, this.x, this.cols - 1); else if (m === 1) this.eraseCells(this.y, 0, this.x); else if (m === 2) this.eraseCells(this.y, 0, this.cols - 1); break; }
      case 'L': if (this.y >= this.top && this.y <= this.bot) { const n = Math.min(one(0), this.bot - this.y + 1); for (let i = 0; i < n; i++) { this.screen.splice(this.bot, 1); this.screen.splice(this.y, 0, this.mkRow(this.eraseId())); } for (let i = this.y; i <= this.bot; i++) this.dirty.add(i); } break;
      case 'M': if (this.y >= this.top && this.y <= this.bot) { const n = Math.min(one(0), this.bot - this.y + 1); for (let i = 0; i < n; i++) { this.screen.splice(this.y, 1); this.screen.splice(this.bot, 0, this.mkRow(this.eraseId())); } for (let i = this.y; i <= this.bot; i++) this.dirty.add(i); } break;
      case 'P': { const r = this.screen[this.y], n = Math.min(one(0), this.cols - this.x); r.ch.splice(this.x, n); r.at.splice(this.x, n); const id = this.eraseId(); for (let i = 0; i < n; i++) { r.ch.push(' '); r.at.push(id); } this.dirty.add(this.y); break; }
      case '@': { const r = this.screen[this.y], n = Math.min(one(0), this.cols - this.x), id = this.eraseId(); for (let i = 0; i < n; i++) { r.ch.splice(this.x, 0, ' '); r.at.splice(this.x, 0, id); r.ch.pop(); r.at.pop(); } this.dirty.add(this.y); break; }
      case 'X': this.eraseCells(this.y, this.x, this.x + one(0) - 1); break;
      case 'S': this.scrollUp(one(0)); break;
      case 'T': this.scrollDown(one(0)); break;
      case 'm': this.sgr(ps); break;
      case 'r': { const t = one(0) - 1, b = Math.min(this.rows - 1, (isNaN(p(1, NaN)) ? this.rows : p(1, this.rows)) - 1); if (t < b) { this.top = t; this.bot = b; } this.x = 0; this.y = 0; break; }
      case 's': this.saveCur(); break;
      case 'u': this.restoreCur(); break;
      case 'n': if (p(0, 0) === 6) this.onData('\x1b[' + (this.y + 1) + ';' + (this.x + 1) + 'R'); else if (p(0, 0) === 5) this.onData('\x1b[0n'); break;
      case 'c': if (p(0, 0) === 0) this.onData('\x1b[?1;2c'); break;
      default: break;
    }
  }
  setModes(list, on) {
    for (const m of list) {
      if (m === 25) this.curVis = on;
      else if (m === 1) this.appCursor = on;
      else if (m === 7) this.autowrap = on;
      else if (m === 2004) this.bracketed = on;
      else if (m === 1049 || m === 1047 || m === 47) this.setAlt(on, m === 1049);
    }
  }
  setAlt(on, saveCursor) {
    if (on && !this.alt) {
      this.mainSave = { screen: this.screen, x: this.x, y: this.y, top: this.top, bot: this.bot };
      this.screen = []; for (let i = 0; i < this.rows; i++) this.screen.push(this.mkRow());
      this.alt = true; this.top = 0; this.bot = this.rows - 1; if (saveCursor) { this.x = 0; this.y = 0; }
    } else if (!on && this.alt) {
      const s = this.mainSave; this.alt = false;
      if (s) { this.screen = s.screen; this.x = Math.min(s.x, this.cols - 1); this.y = Math.min(s.y, this.rows - 1); this.top = 0; this.bot = this.rows - 1; }
      this.mainSave = null;
    }
    this.wrapPending = false; this.allDirty();
  }
  sgr(ps) {
    if (!ps.length) ps = [0];
    const c = this.cur;
    for (let i = 0; i < ps.length; i++) {
      const v = isNaN(ps[i]) ? 0 : ps[i];
      if (v === 0) { c.fg = null; c.bg = null; c.f = 0; }
      else if (v === 1) c.f |= F_BOLD; else if (v === 2) c.f |= F_DIM; else if (v === 3) c.f |= F_ITAL; else if (v === 4) c.f |= F_UL;
      else if (v === 7) c.f |= F_REV; else if (v === 8) c.f |= F_HID; else if (v === 9) c.f |= F_STRIKE;
      else if (v === 22) c.f &= ~(F_BOLD | F_DIM); else if (v === 23) c.f &= ~F_ITAL; else if (v === 24) c.f &= ~F_UL;
      else if (v === 27) c.f &= ~F_REV; else if (v === 28) c.f &= ~F_HID; else if (v === 29) c.f &= ~F_STRIKE;
      else if (v >= 30 && v <= 37) c.fg = PAL16[v - 30]; else if (v === 39) c.fg = null;
      else if (v >= 40 && v <= 47) c.bg = PAL16[v - 40]; else if (v === 49) c.bg = null;
      else if (v >= 90 && v <= 97) c.fg = PAL16[v - 90 + 8]; else if (v >= 100 && v <= 107) c.bg = PAL16[v - 100 + 8];
      else if (v === 38 || v === 48) {
        const key = v === 38 ? 'fg' : 'bg';
        if (ps[i + 1] === 5 && !isNaN(ps[i + 2])) { c[key] = color256(Math.max(0, Math.min(255, ps[i + 2]))); i += 2; }
        else if (ps[i + 1] === 2 && !isNaN(ps[i + 4])) { const cl = n => Math.max(0, Math.min(255, n || 0)); c[key] = '#' + hx(cl(ps[i + 2])) + hx(cl(ps[i + 3])) + hx(cl(ps[i + 4])); i += 4; }
      }
    }
    this.curId = this.attrId();
  }
  resize(cols, rows) {
    cols = Math.max(2, cols); rows = Math.max(2, rows);
    const fitCols = arr => arr.forEach(r => { while (r.ch.length < cols) { r.ch.push(' '); r.at.push(0); } if (r.ch.length > cols) { r.ch.length = cols; r.at.length = cols; } });
    this.cols = cols; fitCols(this.screen); if (this.mainSave) fitCols(this.mainSave.screen);
    while (this.screen.length < rows) this.screen.push(this.mkRow());
    while (this.screen.length > rows) { if (this.y > 0) { const g = this.screen.shift(); if (!this.alt) this.pushSb(g); this.y--; } else this.screen.pop(); }
    if (this.mainSave) { while (this.mainSave.screen.length < rows) this.mainSave.screen.push(this.mkRow()); while (this.mainSave.screen.length > rows) this.mainSave.screen.pop(); }
    this.rows = rows; this.x = Math.min(this.x, cols - 1); this.y = Math.min(this.y, rows - 1); this.top = 0; this.bot = rows - 1; this.wrapPending = false; this.allDirty();
  }
  // Last n lines of text (scrollback first, then the screen without its empty tail).
  getText(n) {
    const scr = this.screen.map(r => r.ch.join('').replace(/\s+$/, ''));
    while (scr.length && scr[scr.length - 1] === '') scr.pop();
    const all = (this.alt ? [] : this.sbText).concat(scr);
    return all.slice(-(n || 60));
  }
}

// =====================================================================================================================
// 2. Helpers that do not need the page (also tested in Node)
// =====================================================================================================================
// Mask things that look like keys or passwords before the screen is shown to an AI engine.
function redact(line) {
  return String(line)
    .replace(/\b(gsk_|sk-|sk_|AIza|ghp_|gho_|glpat-|xox[bap]-|pk_live_|rk_live_)[A-Za-z0-9_\-]{12,}/g, '[hidden key]')
    .replace(/\b(pass(word|wd)?|token|secret|api[_-]?key|auth|bearer)(\s*[=:]\s*|\s+)\S+/gi, (m, a) => a + '=[hidden]')
    .replace(/\b[A-Za-z0-9+\/_\-]{40,}={0,2}/g, '[hidden]');
}
const DANGER = /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*\s+(-[a-z]*\s+)*(\/|~|\$HOME|\*)(\s|$)|\bdd\s+[^\n]*of=\/dev|\bmkfs|:\(\)\s*\{|chmod\s+-R\s+7?77\s+\/|\|\s*(ba)?sh\b|>\s*\/dev\/(sd|mmcblk)/;
const isDanger = c => DANGER.test(c);
// Split an AI reply into text and fenced code parts.
function splitReply(t) {
  const out = [], re = /```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g; let last = 0, m;
  t = String(t || '');
  while ((m = re.exec(t))) { if (m.index > last) out.push({ k: 't', v: t.slice(last, m.index) }); const code = m[1].replace(/\s+$/, ''); if (code.trim()) out.push({ k: 'c', v: code }); last = re.lastIndex; }
  if (last < t.length) out.push({ k: 't', v: t.slice(last) });
  return out;
}
function genBase() {
  const a = new Uint8Array(9); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  const cs = '0123456789abcdefghijklmnopqrstuvwxyz'; let s = ''; a.forEach(b => { s += cs[b % cs.length]; }); return '/e' + s;
}
const PORT_DEF = 7682;
const cmdFor = (port, base) => 'termux-wake-lock; pkg install -y ttyd && ttyd -i lo -p ' + port + ' -b ' + base + ' -W /data/data/com.termux/files/usr/bin/bash';
const HOSTS = ['127.0.0.1', 'localhost'];
const wsUrl = (port, base, h) => 'ws://' + (h || HOSTS[0]) + ':' + port + base + '/ws';
const DEFAULT_PRESETS = [
  { n: 'update', c: 'pkg update -y && pkg upgrade -y' }, { n: 'ls', c: 'ls -la' }, { n: 'pwd', c: 'pwd' },
  { n: 'storage', c: 'df -h' }, { n: 'memory', c: 'free -h' }, { n: 'my IP', c: 'ip -br addr' },
  { n: 'ping', c: 'ping -c 4 1.1.1.1' }, { n: 'ports', c: 'ss -tulpn' }, { n: 'python', c: 'python3 --version' },
  { n: 'nmap', c: 'pkg install -y nmap' }, { n: 'clear', c: 'clear' }
];
const core = { TermCore, redact, isDanger, splitReply, genBase, cmdFor, wsUrl, DEFAULT_PRESETS, color256 };
if (typeof module !== 'undefined' && module.exports) module.exports = core;
if (typeof document === 'undefined') return;
window.EmberTermCore = core;

// =====================================================================================================================
// 3. The panel
// =====================================================================================================================
const $ = id => document.getElementById(id);
const settings = $('settings'); if (!settings) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); };
const LSget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the panel still works for this session */ } };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* fall through */ }
  try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (e) { return false; }
}

const cfg = Object.assign({ port: PORT_DEF, base: '', enter: true, share: true, auto: false, state: 'bar', fs: 10.5, hist: [], presets: null }, LSget('ember_term', {}));
if (!cfg.base || !/^\/[a-z0-9]{6,}$/.test(cfg.base)) cfg.base = genBase();
if (!Array.isArray(cfg.presets) || !cfg.presets.length) cfg.presets = DEFAULT_PRESETS.map(p => Object.assign({}, p));
if (['full', 'half', 'bar'].indexOf(cfg.state) < 0) cfg.state = 'bar';
if (typeof cfg.kb !== 'boolean') cfg.kb = true;
cfg.fs = Math.max(8, Math.min(16, +cfg.fs || 10.5)); if (!Array.isArray(cfg.hist)) cfg.hist = [];
cfg.port = parseInt(cfg.port, 10) || PORT_DEF;
const save = () => LSset('ember_term', cfg);
save();

// ---- markup ----
const panel = document.createElement('div');
panel.id = 'etPanel'; panel.className = 'etp hidden';
panel.innerHTML =
  '<div class="eth" id="etHead">' +
    '<img class="etlogo" src="ember-icon.svg" alt="Ember">' +
    '<div class="ettt"><span class="etname"><b>EMBER</b> <b class="ettx">TERMUX</b></span><small id="etSub">disconnected</small></div>' +
    '<span class="etled off" id="etLed" title="Connection light"></span>' +
    '<button class="etib" id="etKbT" aria-label="Ember keyboard on or off" title="Ember keyboard">⌨</button>' +
    '<button class="etib" id="etExp" aria-label="Expand or collapse the terminal">⤢</button>' +
    '<button class="etib" id="etMin" aria-label="Collapse to the bar">▾</button>' +
  '</div>' +
  '<div class="etbody">' +
    '<div class="ettabs" id="etTabs"><button class="on" data-v="term">Terminal</button><button data-v="chat">Ask Ember</button><button data-v="setup">Setup</button></div>' +
    '<div class="etview" id="etvTerm">' +
      '<div class="etv" id="etV"><div class="etsb" id="etSb"></div><div class="etscr" id="etScr"></div></div>' +
      '<div class="etcl" id="etCl"><span class="etps">$</span><input id="etCli" type="text" inputmode="text" enterkeyhint="send" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="command, then ⏎ to run in Termux" aria-label="Command line"><button id="etCmdGo" aria-label="Run command">⏎</button></div>' +
      '<textarea id="etIn" class="etin" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Terminal input"></textarea>' +
      '<div class="etoff" id="etOff"><div class="etoffbox"><b id="etOffT">Not connected</b><p id="etOffP">Start the bridge in Termux (Setup tab), then tap Connect.</p><div class="etrow"><button class="etbtn on" id="etOffGo">Connect</button><button class="etbtn" id="etOffSet">Setup</button></div></div></div>' +
    '</div>' +
    '<div class="etview hidden" id="etvChat">' +
      '<div class="etlog" id="etLog"></div>' +
      '<div class="etchips" id="etChips"><button data-q="Explain the last error on my screen and tell me the fix.">Explain last error</button><button data-q="What just happened on my screen?">What happened?</button><button data-q="Give me the next command to run.">Next command</button><button class="etshare" id="etShare">👁 screen</button><button id="etClr">Clear</button></div>' +
      '<div class="etask"><textarea id="etQ" rows="1" placeholder="Ask Ember…" spellcheck="false"></textarea><button id="etSend" class="etbtn on" aria-label="Send">➤</button></div>' +
    '</div>' +
    '<div class="etview hidden" id="etvSetup"><div class="etsetup" id="etSetup"></div></div>' +
    '<div class="etkeys" id="etKeys"></div>' +
    '<div class="etkb" id="etKb"></div>' +
    '<div class="etpre" id="etPre"></div>' +
  '</div>';
settings.appendChild(panel);

const ledEl = $('etLed'), subEl = $('etSub'), hostV = $('etV'), scrEl = $('etScr'), sbEl = $('etSb'), inEl = $('etIn');

// ---- terminal view ----
let tc = new TermCore(80, 24, { sbMax: 500 }), cw = 7.6, lh = 16, rowEls = [], stick = true, view = 'term';
const FG = '#d7e8ee';
function cssFor(a) {
  if (a._css !== undefined) return a._css;
  let fg = a.fg, bg = a.bg;
  if (a.f & F_REV) { const t = fg; fg = bg || '#05060a'; bg = t || FG; }
  const s = [];
  if (fg) s.push('color:' + fg); if (bg) s.push('background:' + bg);
  if (a.f & F_BOLD) s.push('font-weight:700'); if (a.f & F_DIM) s.push('opacity:.6'); if (a.f & F_ITAL) s.push('font-style:italic');
  const dec = []; if (a.f & F_UL) dec.push('underline'); if (a.f & F_STRIKE) dec.push('line-through'); if (dec.length) s.push('text-decoration:' + dec.join(' '));
  if (a.f & F_HID) s.push('color:transparent');
  a._css = s.join(';'); return a._css;
}
function rowHTML(t, row, cx) {
  let out = '', run = '', rid = -1;
  const flush = () => { if (run === '') return; const st = cssFor(t.attrs[rid]); out += st ? '<span style="' + st + '">' + run + '</span>' : run; run = ''; };
  for (let i = 0; i < t.cols; i++) {
    const id = row.at[i];
    if (i === cx) { flush(); const st = cssFor(t.attrs[id]); out += '<span class="cur"' + (st ? ' style="' + st + '"' : '') + '>' + esc(row.ch[i]) + '</span>'; rid = -1; continue; }
    if (id !== rid) { flush(); rid = id; }
    run += esc(row.ch[i]);
  }
  flush(); return out;
}
function applyFs() { hostV.style.fontSize = cfg.fs + 'px'; measure(); tc.allDirty(); schedule(); fit(); }
function buildRows() {
  scrEl.innerHTML = ''; rowEls = [];
  for (let i = 0; i < tc.rows; i++) { const d = document.createElement('div'); d.className = 'etr'; scrEl.appendChild(d); rowEls.push(d); }
  tc.allDirty(); schedule();
}
let raf = 0, lastCur = -1;
function schedule() { if (!raf) raf = requestAnimationFrame(render); }
function render() {
  raf = 0;
  const cy = tc.curVis ? tc.y : -1;
  if (lastCur !== cy && lastCur >= 0) tc.dirty.add(lastCur);
  if (cy >= 0) tc.dirty.add(cy);
  lastCur = cy;
  tc.dirty.forEach(y => { const el = rowEls[y], r = tc.screen[y]; if (el && r) el.innerHTML = rowHTML(tc, r, y === cy ? tc.x : -1) || ' '; });
  tc.dirty.clear();
  if (stick) hostV.scrollTop = hostV.scrollHeight;
}
tc.onScrollback = (row, text) => {
  if (!row) { sbEl.innerHTML = ''; return; }
  const d = document.createElement('div'); d.className = 'etr'; d.innerHTML = rowHTML(tc, row, -1) || ' '; sbEl.appendChild(d);
  while (sbEl.childNodes.length > tc.sbMax) sbEl.removeChild(sbEl.firstChild);
};
hostV.addEventListener('scroll', () => { stick = hostV.scrollTop + hostV.clientHeight >= hostV.scrollHeight - 6; }, { passive: true });
function measure() {
  const p = document.createElement('span'); p.className = 'etr'; p.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'; p.textContent = 'M'.repeat(20);
  scrEl.appendChild(p); const r = p.getBoundingClientRect(); p.remove();
  if (r.width > 0) cw = r.width / 20; const l = rowEls[0] ? rowEls[0].getBoundingClientRect().height : 0; if (l > 4) lh = l;
}
let fitT = 0;
function fit() {
  clearTimeout(fitT); fitT = setTimeout(() => {
    if (panel.classList.contains('hidden') || view !== 'term') return;
    const w = hostV.clientWidth, h = hostV.clientHeight; if (w < 40 || h < 30) return;
    measure();
    const cols = Math.max(20, Math.floor((w - 10) / cw)), rows = Math.max(4, Math.floor(h / lh));
    if (cols === tc.cols && rows === tc.rows) return;
    tc.resize(cols, rows); buildRows(); sendResize();
  }, 120);
}
if (window.ResizeObserver) new ResizeObserver(fit).observe(hostV);
buildRows();

// ---- connection to ttyd ----
const enc = new TextEncoder();
let ws = null, state = 'off', dec = null, retryT = 0, tries = 0, wantOn = !!cfg.auto, userDown = false;
function setState(s, note) {
  state = s;
  ledEl.className = 'etled ' + (s === 'on' ? 'on' : s === 'connecting' ? 'wait' : 'off');
  subEl.textContent = s === 'on' ? 'connected · 127.0.0.1:' + cfg.port : s === 'connecting' ? 'connecting…' : (note || 'disconnected');
  $('etOff').classList.toggle('hidden', s === 'on');
  try { paintSetup(); } catch (e) { console.error('paintSetup', e); } // a paint error must never stop connect()
}
function sendRaw(u8) { if (ws && ws.readyState === 1) { try { ws.send(u8); return true; } catch (e) { return false; } } return false; }
function send(data) {
  if (state !== 'on') return false;
  const e = enc.encode(data), p = new Uint8Array(e.length + 1); p[0] = 48; p.set(e, 1); return sendRaw(p);
}
function sendResize() { if (state === 'on') sendRaw(enc.encode('1' + JSON.stringify({ columns: tc.cols, rows: tc.rows }))); }
tc.onData = d => send(d);
function closeWs() { if (ws) { const w = ws; ws = null; w.onopen = w.onmessage = w.onclose = w.onerror = null; try { w.close(); } catch (e) { /* already closed */ } } }
function connect(manual) {
  clearTimeout(retryT); closeWs();
  if (manual) { wantOn = true; userDown = false; tries = 0; cfg.auto = true; save(); }
  setState('connecting');
  let opened = false, sock;
  try { sock = new WebSocket(wsUrl(cfg.port, cfg.base, HOSTS[tries % 2 && tries > 1 ? 1 : 0]), ['tty']); } catch (e) { setState('off', 'could not start'); return; }
  sock.binaryType = 'arraybuffer'; ws = sock; dec = new TextDecoder('utf-8');
  sock.onopen = () => {
    opened = true; tries = 0; setState('on');
    fit(); measure();
    sendRaw(enc.encode(JSON.stringify({ AuthToken: '', columns: tc.cols, rows: tc.rows })));
    $('etOffT').textContent = 'Not connected';
    if (view === 'term') setTimeout(() => { try { inEl.focus({ preventScroll: true }); } catch (e) { /* no focus */ } }, 50);
  };
  sock.onmessage = ev => {
    let u8; if (typeof ev.data === 'string') u8 = enc.encode(ev.data); else u8 = new Uint8Array(ev.data); if (!u8.length) return;
    const cmd = u8[0];
    if (cmd === 48) { tc.write(dec.decode(u8.subarray(1), { stream: true })); schedule(); }
    else if (cmd === 49) { try { tc.title = new TextDecoder().decode(u8.subarray(1)); } catch (e) { /* ignore */ } }
  };
  sock.onclose = () => {
    if (ws !== sock) return; ws = null;
    $('etOffT').textContent = opened ? 'Termux session ended' : 'Could not reach Termux';
    $('etOffP').textContent = opened ? 'The bridge stopped or Termux was closed. Start it again from the Setup tab.' : 'Run the command from the Setup tab in Termux and leave it running, then tap Connect.';
    setState('off', opened ? 'session ended' : 'not reachable');
    tries++; if (wantOn && !userDown && !panel.classList.contains('hidden')) retryT = setTimeout(() => connect(false), Math.min(8000, 2000 + tries * 1000));
  };
  sock.onerror = () => { /* onclose follows and carries the state */ };
}
// V1.8.3: running a command no longer needs a manual Connect. If the bridge is up this connects and waits (up to 7 s) for the link; if Termux is not running it says so and the command is copied.
function ensureOn(ms) {
  if (state === 'on') return Promise.resolve(true);
  if (state !== 'connecting') connect(true);
  return new Promise(res => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const dt = Date.now() - t0;
      if (state === 'on') { clearInterval(iv); res(true); }
      else if (state === 'off' && dt > 300) { clearInterval(iv); res(false); }
      else if (dt > (ms || 7000)) { clearInterval(iv); res(false); }
    }, 100);
  });
}
function disconnect() { userDown = true; wantOn = false; cfg.auto = false; save(); clearTimeout(retryT); closeWs(); setState('off', 'disconnected'); }

// ---- keyboard input (works with Android keyboards: diff against a zero-width sentinel so backspace and autocorrect are seen) ----
const SENT = '​'.repeat(8);
let prev = SENT, ctrl = false;
function resetIn() { inEl.value = SENT; prev = SENT; try { inEl.setSelectionRange(SENT.length, SENT.length); } catch (e) { /* not focusable yet */ } }
resetIn();
function arrow(l) { return (tc.appCursor ? '\x1bO' : '\x1b[') + l; }
const KEYMAP = { Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b', ArrowUp: null, ArrowDown: null, ArrowRight: null, ArrowLeft: null, Home: '\x1b[H', End: '\x1b[F', PageUp: '\x1b[5~', PageDown: '\x1b[6~', Delete: '\x1b[3~', Insert: '\x1b[2~' };
const ARR = { ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D' };
function ctrlOf(ch) { const c = ch.toUpperCase().charCodeAt(0); if (c >= 64 && c <= 95) return String.fromCharCode(c - 64); if (ch === ' ') return '\x00'; return ch; }
function setCtrl(on) { ctrl = on; const b = document.querySelector('#etKeys [data-k="ctrl"]'); if (b) b.classList.toggle('on', on); }
inEl.addEventListener('keydown', e => {
  if (e.isComposing) return;
  const k = e.key;
  if (e.ctrlKey && k.length === 1 && !e.altKey) { e.preventDefault(); send(ctrlOf(k)); return; }
  if (ARR[k]) { e.preventDefault(); send(arrow(ARR[k])); return; }
  if (Object.prototype.hasOwnProperty.call(KEYMAP, k) && KEYMAP[k] !== null) {
    if (k === 'Backspace') return; // handled by the input diff so the sentinel stays in step
    e.preventDefault(); send(KEYMAP[k]); if (k === 'Enter') resetIn();
  }
});
inEl.addEventListener('input', () => {
  const v = inEl.value; let p = 0; const m = Math.min(prev.length, v.length);
  while (p < m && prev.charCodeAt(p) === v.charCodeAt(p)) p++;
  const del = prev.length - p; let add = v.slice(p).replace(/​/g, '');
  let out = '\x7f'.repeat(del);
  if (ctrl && add) { out += add.split('').map(ctrlOf).join(''); setCtrl(false); } else out += add;
  if (out) send(out);
  prev = v; if (v.length < SENT.length - 3 || v.length > 160) resetIn();
});
inEl.addEventListener('paste', e => {
  const t = (e.clipboardData && e.clipboardData.getData('text')) || ''; if (!t) return; e.preventDefault();
  send(tc.bracketed ? '\x1b[200~' + t + '\x1b[201~' : t.replace(/\r?\n/g, '\r'));
});
inEl.addEventListener('focus', () => hostV.classList.add('foc'));
inEl.addEventListener('blur', () => hostV.classList.remove('foc'));
let tapY = 0, tapMoved = false;
hostV.addEventListener('touchstart', e => { tapY = e.touches[0].clientY; tapMoved = false; }, { passive: true });
hostV.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientY - tapY) > 8) tapMoved = true; }, { passive: true });
hostV.addEventListener('click', () => {
  const sel = window.getSelection && window.getSelection().toString(); if (tapMoved || sel) return;
  if (state === 'on') { try { inEl.focus({ preventScroll: true }); } catch (e) { /* no focus */ } }
});

// ---- extra keys ----
const KEYS = [['Ctrl', 'ctrl'], ['Esc', 'esc'], ['Tab', 'tab'], ['^C', 'c-c'], ['^D', 'c-d'], ['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['/', '/'], ['-', '-'], ['~', '~'], ['|', '|'], ['$', '$'], ['A−', 'fs-'], ['A+', 'fs+'], ['Copy', 'copy'], ['Paste', 'paste']];
$('etKeys').innerHTML = KEYS.map(k => '<button data-k="' + esc(k[1]) + '">' + esc(k[0]) + '</button>').join('');
$('etKeys').addEventListener('mousedown', e => e.preventDefault());
$('etKeys').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
  if (k === 'ctrl') { setCtrl(!ctrl); return; }
  if (k === 'fs-' || k === 'fs+') { cfg.fs = Math.max(8, Math.min(16, +(cfg.fs + (k === 'fs+' ? 0.5 : -0.5)).toFixed(1))); save(); applyFs(); toast('Text ' + cfg.fs + 'px'); return; }
  if (k === 'copy') {
    const sel = window.getSelection ? window.getSelection().toString() : '';
    const t = sel || tc.getText(tc.rows).join('\n'); toast((await copyText(t)) ? (sel ? 'Selection copied' : 'Screen copied') : 'Copy blocked'); return;
  }
  if (k === 'paste') { try { const t = await navigator.clipboard.readText(); if (t) send(tc.bracketed ? '\x1b[200~' + t + '\x1b[201~' : t.replace(/\r?\n/g, '\r')); } catch (er) { toast('Long-press the terminal and paste'); } return; }
  if (state !== 'on') { toast('Connecting to Termux…'); if (!(await ensureOn())) { toast('Termux is not reachable. Start the bridge in Termux (Setup tab).'); return; } }
  const map = { esc: '\x1b', tab: '\t', 'c-c': '\x03', 'c-d': '\x04', left: arrow('D'), up: arrow('A'), down: arrow('B'), right: arrow('C') };
  let out = map[k] !== undefined ? map[k] : k;
  if (ctrl && out.length === 1) { out = ctrlOf(out); setCtrl(false); }
  send(out);
});

// ---- command line (V1.9.8): a plain input that runs real commands in Termux ----
const cmdEl = $('etCli'); let hi = -1, armed = '';
const pushHist = c => { cfg.hist = cfg.hist.filter(x => x !== c); cfg.hist.push(c); if (cfg.hist.length > 50) cfg.hist.shift(); save(); };
async function runLine() {
  const c = cmdEl.value.trim(); if (!c) return;
  if (isDanger(c) && armed !== c) { armed = c; $('etCmdGo').classList.add('arm'); toast('Looks destructive. Tap ⏎ again to run.'); setTimeout(() => { armed = ''; $('etCmdGo').classList.remove('arm'); }, 3000); return; }
  armed = ''; $('etCmdGo').classList.remove('arm');
  pushHist(c); hi = -1; cmdEl.value = '';
  await runCmd(c, true);
}
$('etCmdGo').onclick = runLine;
cmdEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); runLine(); return; }
  if (e.key === 'ArrowUp' && cfg.hist.length) { e.preventDefault(); hi = hi < 0 ? cfg.hist.length - 1 : Math.max(0, hi - 1); cmdEl.value = cfg.hist[hi]; }
  else if (e.key === 'ArrowDown' && hi >= 0) { e.preventDefault(); hi++; if (hi >= cfg.hist.length) { hi = -1; cmdEl.value = ''; } else cmdEl.value = cfg.hist[hi]; }
});

// ---- presets ----
let editPre = false;
function paintPre() {
  const el = $('etPre');
  el.innerHTML = '<button class="etp0 ' + (cfg.enter ? 'on' : '') + '" data-a="enter" title="Run the command as soon as you tap it">⏎ ' + (cfg.enter ? 'run' : 'type') + '</button>' +
    cfg.presets.map((p, i) => '<button class="etpc' + (editPre ? ' ed' : '') + '" data-i="' + i + '" title="' + esc(p.c) + '">' + esc(p.n || p.c) + (editPre ? ' <i>✕</i>' : '') + '</button>').join('') +
    '<button class="etp0" data-a="add">＋</button><button class="etp0' + (editPre ? ' on' : '') + '" data-a="edit">✎</button>';
}
async function runCmd(c, run) {
  if (state !== 'on') { toast('Connecting to Termux…'); if (!(await ensureOn())) { copyText(c); toast('Termux is not reachable. Command copied. Start the bridge (Setup tab).'); return; } }
  setView('term'); send(c + (run ? '\r' : ''));
  if (run === false) { try { inEl.focus({ preventScroll: true }); } catch (e) { /* no focus */ } }
}
$('etPre').addEventListener('mousedown', e => e.preventDefault());
$('etPre').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'enter') { cfg.enter = !cfg.enter; save(); paintPre(); return; }
  if (a === 'edit') { editPre = !editPre; paintPre(); return; }
  if (a === 'add') { presetEditor(); return; }
  const i = parseInt(b.dataset.i, 10); const p = cfg.presets[i]; if (!p) return;
  if (editPre) { cfg.presets.splice(i, 1); if (!cfg.presets.length) cfg.presets = DEFAULT_PRESETS.map(x => Object.assign({}, x)); save(); paintPre(); return; }
  if (isDanger(p.c) && !b.classList.contains('arm')) { b.classList.add('arm'); toast('Looks destructive. Tap again to run.'); setTimeout(() => b.classList.remove('arm'), 3000); return; }
  runCmd(p.c, cfg.enter);
});
function presetEditor() {
  if ($('etEd')) { $('etEd').remove(); return; }
  const d = document.createElement('div'); d.id = 'etEd'; d.className = 'eted';
  d.innerHTML = '<input id="etEdN" placeholder="Name (optional)" maxlength="14" autocomplete="off"><input id="etEdC" placeholder="Command, e.g. nmap -sn 192.168.0.0/24" maxlength="300" autocomplete="off" spellcheck="false"><button class="etbtn on" id="etEdS">Save</button><button class="etbtn" id="etEdX">✕</button>';
  $('etPre').parentNode.insertBefore(d, $('etPre'));
  $('etEdX').onclick = () => d.remove();
  $('etEdS').onclick = () => { const c = $('etEdC').value.trim(); if (!c) { toast('Type a command first'); return; } cfg.presets.push({ n: $('etEdN').value.trim().slice(0, 14), c }); save(); paintPre(); d.remove(); };
  $('etEdC').focus();
}

// ---- views ----
function setView(v) {
  view = v;
  document.querySelectorAll('#etTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('etvTerm').classList.toggle('hidden', v !== 'term'); $('etvChat').classList.toggle('hidden', v !== 'chat'); $('etvSetup').classList.toggle('hidden', v !== 'setup');
  $('etKeys').classList.toggle('hidden', v !== 'term'); $('etCl').classList.toggle('hidden', v !== 'term');
  if (v === 'term') { fit(); schedule(); } if (v === 'chat') { paintChat(); setTimeout(() => { const l = $('etLog'); l.scrollTop = l.scrollHeight; }, 30); }
  if (v === 'setup') paintSetup();
  applyKb();
}
$('etTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
$('etOffGo').onclick = () => connect(true);
$('etOffSet').onclick = () => setView('setup');

// ---- V1.9.11: Ember's own keyboard (the phone keyboard no longer pops up and no longer eats half the terminal) ----
const KB_ABC = [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['\u21e7','z','x','c','v','b','n','m','\u232b'], ['?123','-','/','SPACE','.','\u23ce']];
const KB_SYM = [['1','2','3','4','5','6','7','8','9','0'], ['!','@','#','$','%','^','&','*','(',')'], ['_','=','+','[',']','{','}','\\','|','\u232b'], ['abc','~','`',';',':','SPACE','"',"'",'\u23ce']];
let kbLayer = 'abc', kbShift = false, kbRep = 0, kbRepT = 0;
const kbEl = $('etKb');
function paintKb() {
  const rows = kbLayer === 'abc' ? KB_ABC : KB_SYM;
  kbEl.innerHTML = rows.map(r => '<div class="etkr">' + r.map(k => {
    const lab = k === 'SPACE' ? 'space' : (kbLayer === 'abc' && kbShift && k.length === 1 && /[a-z]/.test(k) ? k.toUpperCase() : k);
    const cls = (k === 'SPACE' ? ' sp' : '') + (k === '\u21e7' && kbShift ? ' on' : '') + (k.length > 1 && k !== 'SPACE' ? ' fn' : '');
    return '<button class="etkk' + cls + '" data-c="' + esc(k) + '">' + esc(lab) + '</button>';
  }).join('') + '</div>').join('');
}
function kbPress(k) {
  if (k === '?123') { kbLayer = 'sym'; paintKb(); return; }
  if (k === 'abc') { kbLayer = 'abc'; paintKb(); return; }
  if (k === '\u21e7') { kbShift = !kbShift; paintKb(); return; }
  if (k === '\u232b') { send('\x7f'); return; }
  if (k === '\u23ce') { send('\r'); resetIn(); return; }
  let ch = k === 'SPACE' ? ' ' : k;
  if (kbShift && /^[a-z]$/.test(ch)) { ch = ch.toUpperCase(); kbShift = false; paintKb(); }
  if (ctrl) { send(ctrlOf(ch)); setCtrl(false); return; }
  send(ch);
}
function kbStop() { clearTimeout(kbRep); clearInterval(kbRepT); kbRep = 0; kbRepT = 0; }
kbEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('.etkk'); if (!b) return; e.preventDefault();
  const k = b.dataset.c; kbPress(k);
  if (k === '\u232b') { kbStop(); kbRep = setTimeout(() => { kbRepT = setInterval(() => kbPress('\u232b'), 55); }, 380); }
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => kbEl.addEventListener(ev, kbStop));
kbEl.addEventListener('contextmenu', e => e.preventDefault());
kbEl.addEventListener('mousedown', e => e.preventDefault());
function applyKb() {
  inEl.setAttribute('inputmode', cfg.kb ? 'none' : 'text');
  const show = !!cfg.kb && cfg.state === 'full' && view === 'term';
  kbEl.classList.toggle('show', show); $('etKbT').classList.toggle('on', !!cfg.kb);
  if (show && !kbEl.firstChild) paintKb();
  setTimeout(fit, 60);
}
$('etKbT').onclick = e => {
  e.stopPropagation(); cfg.kb = !cfg.kb; save();
  if (cfg.kb && cfg.state !== 'full') setPanel('full'); else applyKb();
  toast(cfg.kb ? 'Ember keyboard on' : 'Phone keyboard on: tap the terminal to type');
};

// ---- panel states: full / half / bar ----
const S_CLASSES = ['et-full', 'et-half', 'et-bar'];
let autoCol = [];
function foldCards(on) {
  const cs = Array.from(document.querySelectorAll('#settings .card[data-tab="hacking"]'));
  if (on) cs.forEach(c => { if (!c.classList.contains('collapsed')) { c.classList.add('collapsed'); autoCol.push(c); } });
  else { autoCol.forEach(c => c.classList.remove('collapsed')); autoCol = []; }
}
function applyState(noFit) {
  const s = cfg.state;
  foldCards(s !== 'bar'); applyKb();
  panel.dataset.st = s; panel.classList.toggle('col', s !== 'full');
  S_CLASSES.forEach(c => settings.classList.toggle(c, c === 'et-' + s));
  $('etExp').textContent = s === 'full' ? '⤡' : '⤢'; $('etExp').title = s === 'full' ? 'Collapse to half' : 'Expand';
  $('etMin').textContent = s === 'bar' ? '▴' : '▾';
  if (!noFit) { setTimeout(fit, 380); setTimeout(() => { if (stick) hostV.scrollTop = hostV.scrollHeight; }, 400); }
}
function setPanel(s) { cfg.state = s; save(); applyState(); }
$('etExp').onclick = e => { e.stopPropagation(); setPanel(cfg.state === 'full' ? 'half' : 'full'); };
$('etMin').onclick = e => { e.stopPropagation(); setPanel(cfg.state === 'bar' ? 'half' : 'bar'); };
$('etHead').addEventListener('click', e => { if (e.target.closest('button')) return; setPanel(cfg.state === 'bar' ? 'half' : cfg.state === 'half' ? 'full' : 'half'); });
// drag the header up or down to slide the panel (up: bigger, down: half, then bar)
(() => {
  let y0 = null;
  const h = $('etHead');
  h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  h.addEventListener('touchend', e => {
    if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (Math.abs(dy) < 36) return;
    const order = ['bar', 'half', 'full'], i = order.indexOf(cfg.state), n = Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)));
    if (n !== i) { setPanel(order[n]); h._swiped = Date.now(); }
  });
  h.addEventListener('click', e => { if (h._swiped && Date.now() - h._swiped < 400) e.stopImmediatePropagation(); }, true);
})();

// ---- show only on the Hacking tab ----
let lastKey = '';
function sync() {
  const tab = document.querySelector('#stabs .stab.on');
  const vis = settings.classList.contains('show') && !!tab && tab.dataset.st === 'hacking';
  const key = vis + '|' + cfg.state; if (key === lastKey) return; lastKey = key;
  panel.classList.toggle('hidden', !vis); settings.classList.toggle('hk', vis);
  if (vis) { applyState(); fit(); if (wantOn && state === 'off' && !userDown) connect(false); }
  else { clearTimeout(retryT); foldCards(false); }
}
new MutationObserver(sync).observe(settings, { attributes: true, attributeFilter: ['class'] });
const stabs = $('stabs'); if (stabs) new MutationObserver(sync).observe(stabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
panel.addEventListener('transitionend', e => { if (e.propertyName === 'height') fit(); });


// V1.9.0: after the command is copied, Ember keeps knocking on the bridge by itself (every 2.5 s for 5 minutes, and again when you come back from Termux)
// and jumps to the terminal the moment it answers. No Connect tap needed.
let watchT = 0, watchUntil = 0;
function stopWatch() { clearInterval(watchT); watchT = 0; }
function startWatch() {
  stopWatch(); wantOn = true; userDown = false; watchUntil = Date.now() + 300000;
  if (state === 'on') return;
  connect(true);
  watchT = setInterval(() => {
    if (state === 'on') { stopWatch(); toast('Termux connected'); setView('term'); return; }
    if (Date.now() > watchUntil) { stopWatch(); return; }
    if (state === 'off') connect(false);
  }, 2500);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (cfg.state !== 'bar') setPanel('bar'); stopWatch(); clearTimeout(retryT); return; }
  if (state !== 'on' && watchUntil > Date.now() - 600000 && !userDown) startWatch();
});
// ---- Setup view ----
function paintSetup() {
  const el = $('etSetup'); if (!el || $('etvSetup').classList.contains('hidden')) return;
  const cmd = cmdFor(cfg.port, cfg.base);
  el.innerHTML =
    '<div class="etstep">STEP 1 · RUN ONCE IN TERMUX (LEAVE IT RUNNING)</div>' +
    '<div class="etcmd" id="etCmd">' + esc(cmd) + '</div>' +
    '<div class="etrow"><button class="etbtn" id="etCopy">Copy command</button><button class="etbtn" id="etOpen">Open Termux</button></div>' +
    '<div class="etstep">STEP 2</div>' +
    '<div class="etrow">' + (state === 'on' ? '<button class="etbtn red" id="etDis">Disconnect</button>' : '<button class="etbtn on" id="etCon">' + (state === 'connecting' ? 'Connecting…' : 'Connect') + '</button>') + '<button class="etbtn" id="etToTerm">Terminal</button></div>' +
    '<p class="etnote ' + (state === 'on' ? 'ok' : '') + '">' + (state === 'on' ? 'Connected. Ember is talking to your own Termux over this phone only.' : 'Waiting for Termux. Paste the command there and press Enter. Ember connects by itself the moment it answers.') + '</p>' +
    '<div class="etstep">SETTINGS</div>' +
    '<div class="etrow"><label class="etlab">Port</label><input id="etPort" inputmode="numeric" value="' + cfg.port + '" maxlength="5"><button class="etbtn" id="etNew">New private path</button></div>' +
    '<p class="etnote">It only listens on this phone (127.0.0.1) behind a private random path. Press Ctrl+C in Termux to stop it. It starts a plain <b>bash</b>: Ember never runs or sources your scripts. <b>termux-wake-lock</b> keeps Termux alive while Ember is in front.</p>' +
    '<p class="etnote">If Termux is running and Connect still fails, this APK may be blocking local connections: set <b>allowMixedContent</b> to true in capacitor.config.json and rebuild (see docs/TERMUX_PANEL.md).</p>' +
    '<div class="etrow"><button class="etbtn" id="etPreReset">Reset presets</button></div>';
  if ($('etCopy')) $('etCopy').onclick = async () => { toast((await copyText(cmd)) ? 'Command copied' : 'Copy blocked'); startWatch(); };
  $('etOpen').onclick = async () => { const okc = await copyText(cmd); toast(okc ? 'Command copied. Paste it in Termux.' : 'Copy blocked'); startWatch(); setTimeout(openTermux, 350); };
  if ($('etCon')) $('etCon').onclick = () => connect(true);
  if ($('etDis')) $('etDis').onclick = disconnect;
  $('etToTerm').onclick = () => setView('term');
  $('etPort').onchange = () => { const v = parseInt($('etPort').value, 10); if (v >= 1024 && v <= 65535) { cfg.port = v; save(); if (state !== 'off') disconnect(); paintSetup(); toast('Port saved. Copy the new command.'); } else { $('etPort').value = cfg.port; toast('Use a port from 1024 to 65535'); } };
  $('etNew').onclick = () => { cfg.base = genBase(); save(); if (state !== 'off') disconnect(); paintSetup(); toast('New private path. Run the new command in Termux.'); };
  $('etPreReset').onclick = () => { cfg.presets = DEFAULT_PRESETS.map(x => Object.assign({}, x)); save(); paintPre(); toast('Presets reset'); };
}
async function openTermux() {
  setPanel('bar'); // V1.9.8: Ember's panel folds itself away so it never sits over Termux; the arrow reopens it
  const N = window.EmberNative;
  try { if (N && N.openTermux) { const r = await N.openTermux(); if (r && r.ok) return; } } catch (e) { /* fall back */ }
  toast('Could not open Termux. Open it from your home screen; Ember keeps trying to connect.');
}

// ---- Ask Ember (chat inside the panel) ----
const HKEY = 'ember_term_chat';
let hist = LSget(HKEY, []).filter(m => m && (m.r === 'u' || m.r === 'a') && typeof m.t === 'string').slice(-30), busy = false;
const SYS = 'You are Ember inside EMBER TERMUX, a terminal panel on his Android phone (rootless Termux, no sudo). You are a senior Termux, Linux and networking specialist and a calm peer, not a lecturer. ' +
  'He may attach the last lines of his terminal screen. Read them: if there is an error, name the cause in one line, then the fix. ' +
  'Rules: (1) Every command goes in its own fenced code block, one command (or one short && chain) per block, real syntax, no placeholders unless unavoidable. ' +
  '(2) You cannot run anything. He taps Insert. Never say you ran or will run something. (3) Use pkg, not apt/sudo. Mark anything needing root with [ROOT REQUIRED]. ' +
  '(4) Be brief: under 120 words unless he asks for depth. (5) Techniques are for his own devices, labs and authorised testing; if a target looks like someone else\'s system, say so once, briefly, then still answer. ' +
  '(6) If the screen is empty or not shared, just answer the question.';
function paintChat() {
  const l = $('etLog'); $('etShare').classList.toggle('on', !!cfg.share);
  if (!hist.length) { l.innerHTML = '<div class="etempty"><b>Ask Ember</b><p>Ask anything about Termux, Linux or networking. With 👁 screen on, Ember reads the last lines of your terminal (keys and passwords masked) so you can ask “why did that fail?”. Commands come back with <b>Insert</b> and <b>Run</b> buttons. Nothing runs until you tap.</p></div>'; return; }
  l.innerHTML = hist.map(m => m.r === 'u' ? '<div class="etm u">' + esc(m.t) + '</div>' : '<div class="etm a">' + renderReply(m.t) + '</div>').join('') + (busy ? '<div class="etm a typing"><i></i><i></i><i></i></div>' : '');
  l.scrollTop = l.scrollHeight;
}
function inline(t) { return esc(t).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function renderReply(t) {
  return splitReply(t).map(p => {
    if (p.k === 't') { const s = p.v.trim(); return s ? '<div class="ett">' + inline(s) + '</div>' : ''; }
    const dg = isDanger(p.v);
    return '<div class="etcode' + (dg ? ' dg' : '') + '"><pre>' + esc(p.v) + '</pre><div class="etrow"><button class="etbtn on" data-a="ins">Insert</button><button class="etbtn" data-a="run" data-dg="' + (dg ? 1 : 0) + '">Run ⏎</button><button class="etbtn" data-a="cp">Copy</button>' + (dg ? '<span class="etwarn">⚠ destructive</span>' : '') + '</div></div>';
  }).join('');
}
$('etLog').addEventListener('click', async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const code = b.closest('.etcode').querySelector('pre').textContent, a = b.dataset.a;
  if (a === 'cp') { toast((await copyText(code)) ? 'Copied' : 'Copy blocked'); return; }
  if (a === 'run' && b.dataset.dg === '1' && !b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Tap again to run'; setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Run ⏎'; }, 3000); return; }
  if (state !== 'on') { toast('Connecting to Termux…'); if (!(await ensureOn())) { copyText(code); toast('Termux is not reachable. Copied instead.'); return; } }
  const oneLine = code.replace(/\n+$/, '');
  if (a === 'ins') { setView('term'); send(oneLine.replace(/\n/g, ' ')); try { inEl.focus({ preventScroll: true }); } catch (er) { /* no focus */ } }
  else { setView('term'); send(oneLine.split('\n').join('\r') + '\r'); }
});
async function ask(q) {
  q = (q || '').trim(); if (!q || busy) return;
  const P = window.Prov; if (!P) { toast('Engines not loaded yet'); return; }
  busy = true; hist.push({ r: 'u', t: q }); hist = hist.slice(-30); LSset(HKEY, hist); $('etQ').value = ''; paintChat(); $('etSend').disabled = true;
  let reply;
  try {
    const screen = cfg.share ? tc.getText(60).map(redact).join('\n').trim() : '';
    const msgs = hist.slice(-9, -1).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));
    msgs.push({ role: 'user', content: q + (screen ? '\n\n[TERMINAL SCREEN, last lines, keys masked]\n' + screen : (cfg.share ? '\n\n[TERMINAL SCREEN: empty or not connected]' : '')) });
    const r = await P.run('util', { system: SYS, messages: msgs, temp: 0.4, max: 700 });
    reply = (r && r.text) ? r.text.trim() : 'No answer came back. Try again.';
  } catch (e) { reply = 'Failed: ' + ((e && e.message) || 'no engine answered'); }
  busy = false; hist.push({ r: 'a', t: reply }); hist = hist.slice(-30); LSset(HKEY, hist); $('etSend').disabled = false; paintChat();
}
$('etSend').onclick = () => ask($('etQ').value);
$('etQ').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask($('etQ').value); } });
$('etChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'etShare') { cfg.share = !cfg.share; save(); paintChat(); toast(cfg.share ? 'Ember can read the last lines of your screen' : 'Screen is NOT shared'); return; }
  if (b.id === 'etClr') { hist = []; LSset(HKEY, hist); paintChat(); return; }
  if (b.dataset.q) { if (!cfg.share) { cfg.share = true; save(); } ask(b.dataset.q); }
});

// ---- boot ----
paintPre(); setView('term'); setState('off'); applyFs();
window.EmberTerm = { ensureOn, startWatch, stopWatch, connect: () => connect(true), disconnect, send, state: () => state, getText: n => tc.getText(n), setPanel, cfg, ask };
})();
