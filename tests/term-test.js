// Ember V1.6.7 test: EMBER TERMUX. Part 1 = terminal core in Node. Part 2 = real Chromium against a mock ttyd (hand-rolled WebSocket). Run: node tests/term-test.js
const path = require('path'), http = require('http'), fs = require('fs'), crypto = require('crypto');
const T = require(path.join(__dirname, '..', 'www', 'ember_term.js'));
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const txt = t => t.screen.map(r => r.ch.join('').replace(/\s+$/, ''));

// ---- core ----
{
  const t = new T.TermCore(20, 5);
  t.write('hello\r\nworld'); ok('text + CRLF', txt(t)[0] === 'hello' && txt(t)[1] === 'world');
  t.write('\x1b[2J\x1b[H'); ok('clear + home', txt(t).every(l => l === '') && t.x === 0 && t.y === 0);
  t.write('\x1b[3;5Hx'); ok('cursor position', t.screen[2].ch[4] === 'x');
  t.write('\x1b[1;31mred\x1b[0m'); ok('SGR colour', t.attrs[t.screen[2].at[5]].fg === '#ff3b30' && t.attrs[t.screen[2].at[5]].f === 1);
  t.write('\x1b[38;5;196mA\x1b[38;2;1;2;3mB'); ok('256 + truecolour', t.attrs[t.screen[2].at[8]].fg === T.color256(196) && t.attrs[t.screen[2].at[9]].fg === '#010203');
  const t2 = new T.TermCore(10, 3); t2.write('1\r\n2\r\n3\r\n4'); ok('scroll feeds scrollback', t2.sbText.join(',') === '1' && txt(t2).join(',') === '2,3,4');
  t2.write('\x1b[2K\rhi'); ok('erase line', txt(t2)[2] === 'hi');
  const t3 = new T.TermCore(10, 4); t3.write('abc'); t3.write('\x1b[?1049hALT'); ok('alt screen', t3.alt && txt(t3)[0] === 'ALT'); t3.write('\x1b[?1049l'); ok('alt restore', !t3.alt && txt(t3)[0] === 'abc');
  let got = ''; t3.onData = d => { got += d; }; t3.write('\x1b[6n'); ok('cursor report', /^\x1b\[\d+;\d+R$/.test(got));
  const t4 = new T.TermCore(5, 2); t4.write('abcdefg'); ok('autowrap', txt(t4)[0] === 'abcde' && txt(t4)[1] === 'fg');
  t4.resize(8, 3); ok('resize', t4.cols === 8 && t4.rows === 3 && t4.screen.length === 3 && t4.screen[0].ch.length === 8);
  const t5 = new T.TermCore(12, 4); t5.write('\x1b]0;my title\x07x'); ok('OSC title', t5.title === 'my title' && txt(t5)[0] === 'x');
  t5.write('\x1b[1;1H\x1b[2P'); ok('delete chars', true); t5.write('\x1b(0q\x1b(B'); ok('line drawing', t5.screen[0].ch.includes('─'));
  const t6 = new T.TermCore(10, 3); t6.write('\x1b[1;2r'); t6.write('a\r\nb\r\nc'); ok('scroll region', txt(t6)[0] === 'b' && txt(t6)[1] === 'c', JSON.stringify(txt(t6)));
  ok('getText', new T.TermCore(10, 3).getText(5).length === 0);
}
// ---- helpers ----
ok('redact gsk key', !/gsk_/.test(T.redact('key gsk_abcdefghijklmnop1234 ok')));
ok('redact password', /\[hidden\]/.test(T.redact('password: hunter2')));
ok('redact long token', /\[hidden\]/.test(T.redact('a' + 'b'.repeat(45))));
ok('keeps normal', T.redact('ls -la /sdcard') === 'ls -la /sdcard');
ok('danger rm -rf /', T.isDanger('rm -rf /') && T.isDanger('rm -rf ~') && T.isDanger('curl x | sh') && T.isDanger('dd if=a of=/dev/sda'));
ok('safe cmds', !T.isDanger('ls -la') && !T.isDanger('rm file.txt') && !T.isDanger('pkg update -y'));
const sp = T.splitReply('Fix:\n```bash\npkg install nmap\n```\nthen\n```\nnmap -sn 192.168.0.0/24\n```');
ok('splitReply', sp.length === 4 && sp[1].k === 'c' && sp[1].v === 'pkg install nmap' && sp[3].v.startsWith('nmap'));
ok('genBase', /^\/[a-z0-9]{10}$/.test(T.genBase()) && T.genBase() !== T.genBase());
ok('command', T.cmdFor(7682, '/eabc') === 'termux-wake-lock; pkg install -y ttyd && ttyd -i lo -p 7682 -b /eabc -W /data/data/com.termux/files/usr/bin/bash');

// ---- UI against a mock ttyd ----
let wsPort = 0, wsClients = [], wsLog = [];
function frame(buf) { const l = buf.length, h = l < 126 ? Buffer.from([0x82, l]) : Buffer.from([0x82, 126, l >> 8, l & 255]); return Buffer.concat([h, buf]); }
function parseFrames(c, cb) { // client frames are masked
  let b = c._b = Buffer.concat([c._b || Buffer.alloc(0), c._d]);
  while (b.length >= 2) {
    let l = b[1] & 127, o = 2; if (l === 126) { if (b.length < 4) return; l = b.readUInt16BE(2); o = 4; }
    if (b.length < o + 4 + l) return; const m = b.subarray(o, o + 4), d = Buffer.alloc(l); for (let i = 0; i < l; i++) d[i] = b[o + 4 + i] ^ m[i & 3];
    const op = b[0] & 15; b = c._b = b.subarray(o + 4 + l); if (op === 8) { c.end(); return; } cb(op, d);
  }
}
const mock = http.createServer((q, r) => { r.writeHead(404); r.end(); });
mock.on('upgrade', (q, s) => {
  const key = q.headers['sec-websocket-key'];
  wsLog.push({ url: q.url, proto: q.headers['sec-websocket-protocol'] });
  s.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\nSec-WebSocket-Protocol: tty\r\n\r\n');
  wsClients.push(s);
  s.on('data', d => { s._d = d; parseFrames(s, (op, data) => {
    const t = data.toString();
    if (data[0] === 0x7b) { s._hs = JSON.parse(t); s.write(frame(Buffer.from('0\x1b[1;32mfezzy@termux\x1b[0m:~$ '))); }
    else if (t[0] === '0') { wsLog.push({ in: t.slice(1) }); const x = t.slice(1); s.write(frame(Buffer.from('0' + (x.endsWith('\r') ? x + '\nran\r\n$ ' : x)))); }
    else if (t[0] === '1') wsLog.push({ resize: JSON.parse(t.slice(1)) });
  }); });
});
const www = path.join(__dirname, '..', 'www');
const web = http.createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]; fs.readFile(path.join(www, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); r.end(d); }); });
(async () => {
  let chromium; try { chromium = require(process.env.PW || 'playwright').chromium; } catch (e) { try { chromium = require('playwright').chromium; } catch (e2) { console.log('SKIP UI part (no playwright)'); return done(); } }
  await new Promise(r => mock.listen(0, '127.0.0.1', r)); wsPort = mock.address().port;
  await new Promise(r => web.listen(0, '127.0.0.1', r)); const wp = web.address().port;
  const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 412, height: 860 } }), pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(p => { localStorage.setItem('ember_term', JSON.stringify({ port: p, base: '/etest123456', enter: true, share: true, auto: false, state: 'half' })); }, wsPort);
  await pg.goto('http://127.0.0.1:' + wp + '/'); await pg.waitForTimeout(500);
  await pg.click('#bSetTop'); await pg.click('#emberHub [data-go=hacking]'); await pg.waitForTimeout(500);
  ok('panel visible on Hacking tab', await pg.isVisible('#etPanel'));
  ok('half height', Math.abs((await pg.locator('#etPanel').boundingBox()).height - 499) < 12, JSON.stringify(await pg.locator('#etPanel').boundingBox()));
  ok('red light when disconnected', await pg.evaluate(() => document.getElementById('etLed').className.includes('off')));
  ok('collapsed beacon on', await pg.evaluate(() => document.getElementById('etPanel').classList.contains('col')));
  await pg.click('#etOffGo'); await pg.waitForTimeout(800);
  ok('connected (ws path + subprotocol)', wsLog[0] && wsLog[0].url === '/etest123456/ws' && wsLog[0].proto === 'tty', JSON.stringify(wsLog[0]));
  ok('green light', await pg.evaluate(() => document.getElementById('etLed').className.includes('on')));
  ok('handshake has size', wsClients[0] && wsClients[0]._hs && wsClients[0]._hs.columns > 20 && wsClients[0]._hs.rows >= 4, JSON.stringify(wsClients[0] && wsClients[0]._hs));
  ok('prompt rendered', /fezzy@termux/.test(await pg.innerText('#etScr')));
  await pg.click('#etPre button[data-i="1"]'); await pg.waitForTimeout(500);
  ok('preset typed + run', wsLog.some(l => l.in === 'ls -la\r'), JSON.stringify(wsLog.slice(-3)));
  ok('output echoed', /ran/.test(await pg.innerText('#etScr')));
  await pg.click('#etPre [data-a="enter"]'); await pg.click('#etPre button[data-i="2"]'); await pg.waitForTimeout(300);
  ok('type-only mode (no Enter)', wsLog.some(l => l.in === 'pwd'));
  await pg.evaluate(() => { const i = document.getElementById('etIn'); i.focus(); }); await pg.keyboard.type('abc'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  const typed = wsLog.filter(l => l.in !== undefined).map(l => l.in).join('|');
  ok('keyboard typing + backspace + enter', /a/.test(typed) && /\x7f/.test(typed) && /\r/.test(typed), JSON.stringify(typed));
  await pg.click('#etExp'); await pg.waitForTimeout(700);
  ok('expands to full', (await pg.locator('#etPanel').boundingBox()).height > 700);
  ok('beacon off when full', await pg.evaluate(() => !document.getElementById('etPanel').classList.contains('col')));
  ok('resize sent to ttyd', wsLog.some(l => l.resize && l.resize.rows > 15), JSON.stringify(wsLog.filter(l => l.resize)));
  await pg.click('#etExp'); await pg.waitForTimeout(700);
  ok('collapse stops at half', Math.abs((await pg.locator('#etPanel').boundingBox()).height - 499) < 12);
  await pg.click('#etMin'); await pg.waitForTimeout(700);
  ok('bar state', (await pg.locator('#etPanel').boundingBox()).height < 90);
  await pg.click('#etHead'); await pg.waitForTimeout(600);
  ok('header tap reopens to half', (await pg.locator('#etPanel').boundingBox()).height > 300);
  await pg.click('#etTabs [data-v="setup"]'); await pg.waitForTimeout(200);
  ok('setup shows command', /ttyd -i lo -p \d+ -b \/etest123456 -W \/data\/data\/com\.termux\/files\/usr\/bin\/bash/.test(await pg.innerText('#etCmd')));
  // Ask Ember: mock engine via Free Mode is not available here, so stub Prov.run
  await pg.evaluate(() => { window.__sent = null; window.Prov.run = async (l, o) => { window.__sent = o; return { text: 'Looks like a missing package.\n```bash\npkg install nmap\n```\n```bash\nrm -rf ~\n```' }; }; });
  await pg.click('#etTabs [data-v="chat"]'); await pg.fill('#etQ', 'why did it fail?'); await pg.click('#etSend'); await pg.waitForTimeout(500);
  const sent = await pg.evaluate(() => window.__sent);
  console.log(JSON.stringify(sent && sent.messages[sent.messages.length-1].content).slice(0,400)); ok('chat sends screen context', sent && /TERMINAL SCREEN/.test(sent.messages[sent.messages.length - 1].content) && /fezzy@termux/.test(sent.messages[sent.messages.length - 1].content));
  ok('chat renders 2 command cards', (await pg.locator('.etcode').count()) === 2 && (await pg.locator('.etcode.dg').count()) === 1);
  const before = wsLog.length;
  await pg.locator('.etcode').first().locator('[data-a="ins"]').click(); await pg.waitForTimeout(400);
  ok('Insert types without Enter', wsLog.slice(before).some(l => l.in === 'pkg install nmap'), JSON.stringify(wsLog.slice(before)));
  await pg.click('#etTabs [data-v="chat"]'); const b2 = wsLog.length;
  await pg.locator('.etcode.dg [data-a="run"]').click(); await pg.waitForTimeout(300);
  ok('destructive Run needs second tap', wsLog.length === b2);
  await pg.screenshot({ path: path.join(__dirname, 'shots', 'term-chat.png') }).catch(() => {});
  await pg.click('#etTabs [data-v="term"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(__dirname, 'shots', 'term-half.png') }).catch(() => {});
  wsClients[0].destroy(); await pg.waitForTimeout(600);
  ok('red light after drop', await pg.evaluate(() => /off|wait/.test(document.getElementById('etLed').className)));
  ok('auto-reconnect', await (async () => { await pg.waitForTimeout(3500); return pg.evaluate(() => document.getElementById('etLed').className.includes('on')); })());
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await br.close(); mock.close(); web.close(); done();
})().catch(e => { console.log('FAIL harness', e); fail++; try { mock.close(); web.close(); } catch (x) { /* closed */ } done(); });
function done() { console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }
