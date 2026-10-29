// Ember V1.6.6 - ember_device.js: the Device panel (network, AI details, storage and RAM, uptime, battery integrity),
// the rotating quote banner, and the Privacy / About tabs. Reads the phone through EmberNative.sys (EmberDevicePlugin.kt)
// and falls back to what a browser can see. Nothing here is saved except the person's own added quotes.
'use strict';
(() => {
const $ = id => document.getElementById(id);
if (!$('device')) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3000); };
const open = () => $('device').classList.contains('show');
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };

// ---------- quotes: short excerpts from public interviews, never lyrics. One per publication, each under 15 words. ----------
const QUOTES = [
  { t: 'turning it into something positive to push yourself forward', pre: 1, s: 'Juice WRLD on what 999 means · MTV TRL, 2018 (via TIDAL)' },
  { t: 'when you\'re stuck in your house, you start thinking too much', pre: 1, s: 'Juice WRLD · Interview Magazine, 2019' },
  { t: 'when people get caught up, they can get lost', pre: 1, s: 'Juice WRLD on sudden success · Chicago Tribune, 2018 (via Legacy.com)' },
  { t: 'My music is like my therapy sessions, but there\'s no confidentiality.', s: 'Juice WRLD · Billboard, 2019' },
  { t: 'Just listening to it was therapy, an escape from everything.', s: 'Juice WRLD on music · Rolling Stone, "The First Time"' },
  { t: 'I don\'t even write, I\'m freestyle everything.', s: 'Juice WRLD · Clash' }
];
const mine = () => (lsGet('ember_quotes', []) || []).filter(q => q && q.t);
const all = () => QUOTES.concat(mine().map(q => ({ t: q.t, s: q.s || 'Added by you', own: 1 })));
let qi = Math.floor(Math.random() * QUOTES.length), qTimer = null;
function showQuote(step) {
  const a = all(); if (!a.length) return;
  qi = (qi + (step || 0) + a.length) % a.length; const q = a[qi], ban = $('qBan');
  ban.classList.add('fade');
  setTimeout(() => {
    $('qTxt').textContent = (q.pre ? '…' : '') + '“' + q.t + '”'; $('qSrc').textContent = q.s;
    ban.classList.remove('fade');
  }, step === 0 ? 0 : 420);
}
function startQuotes() { stopQuotes(); showQuote(0); qTimer = setInterval(() => { if (!document.hidden) showQuote(1); }, 9000); }
function stopQuotes() { clearInterval(qTimer); qTimer = null; }
$('qBan').addEventListener('click', () => { showQuote(1); startQuotesTimerOnly(); });
$('qBan').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showQuote(1); } });
function startQuotesTimerOnly() { clearInterval(qTimer); qTimer = setInterval(() => { if (!document.hidden) showQuote(1); }, 9000); }

function renderMine() {
  const a = mine();
  $('qMine').innerHTML = a.length ? a.map((q, i) => '<div class="qi"><span>“' + esc(q.t) + '”<small>' + esc(q.s || 'Added by you') + '</small></span><button data-i="' + i + '" aria-label="Remove this quote">✕</button></div>').join('') : '<p class="hint">Nothing added yet.</p>';
}
$('qAdd').onclick = () => {
  const t = $('qNew').value.replace(/\s+/g, ' ').trim().slice(0, 200); if (t.length < 4) { toast('Type a quote first'); return; }
  const a = mine(); if (a.length >= 40) { toast('40 quotes is the limit'); return; }
  a.push({ t, s: $('qNewSrc').value.trim().slice(0, 80) });
  try { localStorage.setItem('ember_quotes', JSON.stringify(a)); } catch (e) { toast('Storage is blocked'); return; }
  $('qNew').value = ''; $('qNewSrc').value = ''; renderMine(); toast('Added to the rotation');
};
$('qMine').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const a = mine(); a.splice(+b.dataset.i, 1);
  try { localStorage.setItem('ember_quotes', JSON.stringify(a)); } catch (er) { /* blocked */ }
  renderMine();
});

// ---------- formatting ----------
const GB = 1024 ** 3, MB = 1024 ** 2;
const fmtB = n => n >= GB ? (n / GB).toFixed(n >= 10 * GB ? 0 : 1) + ' GB' : Math.round(n / MB) + ' MB';
const pct = (a, b) => b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0;
const row = (l, v) => '<div class="dvrow"><span>' + esc(l) + '</span><span>' + v + '</span></div>';
const pill = (t, c) => '<span class="pill ' + (c || '') + '">' + esc(t) + '</span>';
const bar = (p, c) => '<div class="bar ' + c + '"><i style="--w:' + p + '%"></i></div>';
function fmtUp(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return (d ? d + 'd ' : '') + (h || d ? h + 'h ' : '') + m + 'm';
}

// ---------- readings ----------
async function readSys() {
  const NS = window.EmberNative && window.EmberNative.sys;
  if (NS) { const r = await NS.info(); r.native = !r.error; return r; }
  const o = { native: false, net: {}, mem: {}, battery: {}, uptimeMs: null };
  const c = navigator.connection;
  o.net = { online: navigator.onLine, effectiveType: c && c.effectiveType, downlink: c && c.downlink, type: c && c.type };
  if (navigator.deviceMemory) o.mem.ramApprox = navigator.deviceMemory * GB;
  try { const e = await navigator.storage.estimate(); o.mem.appUsage = e.usage; o.mem.appQuota = e.quota; } catch (e) { /* not available */ }
  try { const b = await navigator.getBattery(); o.battery = { level: Math.round(b.level * 100), charging: b.charging }; } catch (e) { /* not available */ }
  return o;
}
let ipCache = { t: 0, v: null };
async function ipArea(force) {
  if (!force && ipCache.v && Date.now() - ipCache.t < 300000) return ipCache.v;
  const c = new AbortController(), h = setTimeout(() => c.abort(), 7000);
  try {
    const r = await fetch('https://ipwho.is/', { signal: c.signal }), j = await r.json();
    ipCache = { t: Date.now(), v: j && j.success !== false ? j : { error: (j && j.message) || 'Lookup failed.' } };
  } catch (e) { ipCache = { t: Date.now(), v: { error: 'Could not reach the lookup service. Check the connection.' } }; }
  finally { clearTimeout(h); }
  return ipCache.v;
}
const areaOf = j => [j.city, j.region, j.country].filter(Boolean).join(', ') + (j.postal ? ' ' + j.postal : '');

// ---------- cards ----------
async function renderNet(d) {
  const n = d.net || {}; let h = '';
  const kind = n.wifi ? pill('Wi-Fi', 'b') : n.cellular ? pill('Mobile data', 'p') : n.ethernet ? pill('Ethernet', 'b') : (d.native ? pill('Offline', 'r') : (navigator.onLine ? pill('Online', 'g') : pill('Offline', 'r')));
  h += row('Connection', kind + (n.vpn ? ' ' + pill('+ VPN', 'g') : ''));
  if (d.native) {
    if (n.wifi) {
      if (n.ssid) h += row('Wi-Fi name', '<b>' + esc(n.ssid) + '</b>');
      else if (!n.wifiNameAllowed) h += row('Wi-Fi name', '<button class="btn g" id="dvWifi" style="width:auto;padding:6px 12px;font-size:12px">Show Wi-Fi name</button>');
      else h += row('Wi-Fi name', pill('Hidden by Android', 'a'));
      if (n.signalLevel != null) h += row('Signal', pill(['None', 'Weak', 'Fair', 'Good', 'Excellent'][n.signalLevel] || '?', n.signalLevel >= 3 ? 'g' : n.signalLevel === 2 ? 'a' : 'r') + (n.linkMbps ? ' ' + n.linkMbps + ' Mbps' : ''));
      if (!n.ssid && !n.wifiNameAllowed) h += '<p class="dvnote">Android hides the Wi-Fi name unless Location permission is on. Ember never reads where you are; it only needs the permission to be allowed to see the name.</p>';
      if (n.wifiNameAllowed && !n.ssid) h += '<p class="dvnote">Turn Location on in the phone\'s quick settings, then refresh. Android needs it to share the network name.</p>';
    }
    h += row('VPN', n.vpn ? pill('On', 'g') : pill('Off', ''));
    if (n.vpn) {
      const j = await ipArea();
      if (j && !j.error) h += row('VPN exit area', '<b>' + esc(areaOf(j)) + '</b>') + row('Provider', esc((j.connection && (j.connection.org || j.connection.isp)) || '—')) + row('Public IP', esc(j.ip || '—'));
      else h += row('VPN exit area', pill('Unknown', 'a')) + '<p class="dvnote">' + esc((j && j.error) || 'Lookup failed.') + '</p>';
    } else h += '<div class="btnrow"><button class="btn g" id="dvIp">Look up my public IP area</button></div><p class="dvnote">With a VPN on, this shows automatically. Looking it up sends your public IP to ipwho.is.</p>';
  } else {
    h += row('Speed class', esc(n.effectiveType || 'unknown') + (n.downlink ? ' · ~' + n.downlink + ' Mbps' : ''));
    h += '<p class="dvnote">The Wi-Fi name and VPN detection only work in the installed app (update to the V1.6.6 APK).</p><div class="btnrow"><button class="btn g" id="dvIp">Look up my public IP area</button></div>';
  }
  $('dvNet').innerHTML = h + '<div id="dvIpOut"></div>';
  if ($('dvWifi')) $('dvWifi').onclick = async () => { const ok = await window.EmberNative.sys.requestWifiName(); toast(ok ? 'Allowed. Reading the name…' : 'Not allowed, so the name stays hidden'); refresh(); };
  if ($('dvIp')) $('dvIp').onclick = async () => {
    $('dvIpOut').innerHTML = '<p class="hint">Looking up…</p>'; const j = await ipArea(true);
    $('dvIpOut').innerHTML = j && !j.error ? row('Public IP area', '<b>' + esc(areaOf(j)) + '</b>') + row('Provider', esc((j.connection && (j.connection.org || j.connection.isp)) || '—')) + row('Public IP', esc(j.ip || '—')) : '<p class="dvnote">' + esc((j && j.error) || 'Lookup failed.') + '</p>';
  };
}

// V1.9.0: replaces the long "Engine Status" list. Everything that already lives in the left menu or Settings (keys per provider, persona,
// add-ons, chat counts) is gone from here. Only a live check stays: who answered last and how fast, and whether anything can answer right now.
async function renderAi() {
  const S = lsGet('ember_set', {}) || {}, P = window.Prov; let h = '';
  const ids = (P && P.IDS) || [], st = P && P.status ? P.status() : {};
  const ready = ids.filter(id => st[id] == 'ok').length, lim = ids.filter(id => st[id] == 'limited').length;
  const free = P && P.freeOn ? P.freeOn() : !!S.freeMode;
  let last = null;
  try { const cs = (await window.Store.all()).filter(c => c && c.msgs && c.msgs.length).sort((a, b) => b.updated - a.updated); for (const c of cs) { for (let i = c.msgs.length - 1; i >= 0; i--) { const m = c.msgs[i]; if (m.r == 'a' && m.eng && m.eng.p) { last = m.eng; break; } } if (last) break; } } catch (e) { /* store not ready */ }
  const nm = id => (P && P.label ? P.label(id) : id);
  h += '<div class="dvhero ' + (ready ? 'ok' : free ? 'free' : 'bad') + '"><b>' + (ready ? 'Ready' : free ? 'Free Mode only' : 'Nothing can answer') + '</b><span>' + (ready ? ready + ' engine' + (ready > 1 ? 's' : '') + ' with a working key' + (lim ? ', ' + lim + ' rate limited' : '') : free ? 'No working key, Pollinations answers' : 'Add a key in Settings > Keys') + '</span></div>';
  h += row('Last answer', last ? '<b>' + esc(nm(last.p)) + '</b>' + (last.m ? ' · ' + esc(String(last.m).replace(/^.*\//, '').slice(0, 28)) : '') + (last.ms ? ' · ' + last.ms + ' ms' : '') : '—');
  $('dvAi').innerHTML = h;
}

function renderMem(d) {
  const m = d.mem || {}; let h = '';
  if (m.ramTotal) {
    const used = m.ramTotal - m.ramAvail, p = pct(used, m.ramTotal), c = p < 70 ? 'g' : p < 85 ? 'a' : 'r';
    h += '<div class="dvrow"><span>RAM</span><span>' + pill(m.ramLow ? 'Low memory' : c === 'g' ? 'Healthy' : c === 'a' ? 'Busy' : 'Tight', m.ramLow ? 'r' : c) + '</span></div>' + bar(p, c) + '<div class="barl"><span>' + fmtB(used) + ' used</span><span>' + fmtB(m.ramAvail) + ' free of ' + fmtB(m.ramTotal) + '</span></div>';
  } else if (m.ramApprox) h += row('RAM (approx.)', '~' + fmtB(m.ramApprox) + ' <small>(browsers cap this at 8 GB)</small>');
  if (m.storageTotal) {
    const used = m.storageTotal - m.storageFree, p = pct(used, m.storageTotal), fr = 100 - p, c = fr > 20 ? 'g' : fr > 10 ? 'a' : 'r';
    h += '<div class="dvrow" style="margin-top:10px"><span>Storage</span><span>' + pill(fr > 20 ? 'Plenty free' : fr > 10 ? 'Getting full' : 'Almost full', c) + '</span></div>' + bar(p, c) + '<div class="barl"><span>' + fmtB(used) + ' used</span><span>' + fmtB(m.storageFree) + ' free of ' + fmtB(m.storageTotal) + '</span></div>';
  }
  if (m.appUsage != null) h += row('Ember\'s own data', fmtB(m.appUsage) + (m.appQuota ? ' <small>of ' + fmtB(m.appQuota) + ' allowed</small>' : ''));
  if (!h) h = '<p class="hint">' + esc(d.error || 'No memory readings on this device.') + '</p>';
  $('dvMem').innerHTML = h;
}

function renderUp(d) {
  let h = '';
  if (d.uptimeMs != null) {
    const days = d.uptimeMs / 86400000;
    h += '<div class="dvbig">' + fmtUp(d.uptimeMs) + '</div><div class="dvnote" style="margin-top:2px">Phone up since ' + esc(new Date(Date.now() - d.uptimeMs).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</div>';
    if (days > 14) h += '<div class="verdict" style="--vc:var(--am)"><span>⚠️</span><span>Over two weeks without a restart. A reboot clears stuck apps and often frees RAM.</span></div>';
  } else h += '<p class="hint">Phone uptime needs the installed app.</p>';
  h += row('Ember open for', fmtUp(performance.now()));
  if (d.model) h += row('Phone', esc(d.model.trim()) + (d.android ? ' · Android ' + esc(d.android) : ''));
  $('dvUp').innerHTML = h;
}

// Battery integrity is a simple score from what Android reports. It is a guide, not a lab test.
function batteryVerdict(b) {
  let score = 100; const why = []; let signals = 0;
  if (b.health && b.health !== 'unknown') { signals++; if (b.health !== 'good') { score -= 45; why.push('Android reports the battery as ' + b.health.replace('_', ' ')); } }
  if (b.tempC != null) { signals++; if (b.tempC >= 45) { score -= 30; why.push('it is hot (' + b.tempC.toFixed(1) + '°C)'); } else if (b.tempC >= 40) { score -= 12; why.push('it is warm (' + b.tempC.toFixed(1) + '°C)'); } else if (b.tempC <= 0) { score -= 10; why.push('it is very cold'); } }
  if (b.cycles) { signals++; if (b.cycles > 800) { score -= 30; why.push(b.cycles + ' charge cycles is a lot'); } else if (b.cycles > 500) { score -= 15; why.push(b.cycles + ' charge cycles'); } }
  if (b.stateOfHealth) { signals++; if (b.stateOfHealth < 80) { score -= 25; why.push('capacity is down to ' + b.stateOfHealth + '%'); } else if (b.stateOfHealth < 90) { score -= 10; why.push('capacity is at ' + b.stateOfHealth + '%'); } }
  if (!signals) return { score: null, label: 'Not enough data', c: 'var(--m)', text: 'This phone is not reporting battery health, temperature or cycles.' };
  score = Math.max(0, score);
  const label = score >= 85 ? 'Healthy' : score >= 60 ? 'Keep an eye on it' : 'Needs attention', c = score >= 85 ? 'var(--gr)' : score >= 60 ? 'var(--am)' : 'var(--rd)';
  return { score, label, c, text: why.length ? 'Because ' + why.join(', and ') + '.' : 'Everything Android reports looks normal (' + signals + ' signal' + (signals === 1 ? '' : 's') + ' checked).' };
}
function renderBat(d) {
  const b = d.battery || {}; if (b.level == null) { $('dvBat').innerHTML = '<p class="hint">' + esc(d.batteryError || 'No battery reading on this device.') + '</p>'; return; }
  const c = b.level > 40 ? 'g' : b.level > 15 ? 'a' : 'r', v = batteryVerdict(b); let h = '';
  h += '<div class="dvrow"><span>Charge</span><span><b>' + b.level + '%</b> ' + (b.charging ? pill(b.full ? 'Full' : 'Charging', 'g') : pill('On battery', '')) + '</span></div>' + bar(b.level, c);
  if (b.health) h += row('Health', pill(b.health.replace('_', ' '), b.health === 'good' ? 'g' : b.health === 'unknown' ? '' : 'r'));
  if (b.tempC != null) h += row('Temperature', pill(b.tempC.toFixed(1) + '°C', b.tempC < 38 ? 'g' : b.tempC < 43 ? 'a' : 'r'));
  if (b.voltageMv) h += row('Voltage', (b.voltageMv / 1000).toFixed(2) + ' V');
  h += row('Charge cycles', b.cycles ? String(b.cycles) : '<small>not reported by this phone</small>');
  if (b.stateOfHealth) h += row('Capacity health', pill(b.stateOfHealth + '%', b.stateOfHealth >= 90 ? 'g' : b.stateOfHealth >= 80 ? 'a' : 'r'));
  if (b.technology) h += row('Chemistry', esc(b.technology));
  h += '<div class="verdict" style="--vc:' + v.c + '"><span style="font-size:22px">' + (v.score == null ? '❔' : v.score >= 85 ? '✅' : v.score >= 60 ? '⚠️' : '🛑') + '</span><span><b>Integrity: ' + esc(v.label) + (v.score != null ? ' · ' + v.score + '/100' : '') + '</b><br>' + esc(v.text) + '</span></div>';
  h += '<p class="dvnote">A guide built from what Android reports, not a lab test. Many phones do not report cycles or capacity.</p>';
  $('dvBat').innerHTML = h;
}

let busy = false;
async function refresh() {
  if (busy) return; busy = true;
  try { const d = await readSys(); renderMem(d); renderUp(d); renderBat(d); await Promise.all([renderNet(d), renderAi()]); }
  catch (e) { $('dvNet').innerHTML = '<p class="hint">Could not read the device: ' + esc(e && e.message) + '</p>'; }
  busy = false;
}

// ---------- open / close / tabs ----------
let refT = null;
function openDev() { $('device').classList.add('show'); renderMine(); startQuotes(); refresh(); clearInterval(refT); refT = setInterval(() => { if (open() && !document.hidden && $('dv_dev') && !$('dv_dev').classList.contains('hidden')) refresh(); }, 20000); }
function closeDev() { $('device').classList.remove('show'); stopQuotes(); clearInterval(refT); }
$('bDevice').onclick = openDev; $('bDvx').onclick = closeDev; $('dvRefresh').onclick = () => { refresh(); toast('Refreshed'); };
document.querySelectorAll('.dvtab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.dvtab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.dvpane').forEach(x => x.classList.toggle('hidden', x.id !== 'dv_' + b.dataset.dv));
  const sb = $('device').querySelector('.sb'); if (sb) sb.scrollTop = 0;
}));
document.addEventListener('visibilitychange', () => { if (!document.hidden && open()) refresh(); });
})();
