// Ember V1.10.5 - ember_cc_widget.js: fills the Command Centre widget at the bottom of Settings (the expandable one from V1.9.6) with the real controls.
// Media (Stability) and the Live terminal. GitHub lives only in the Command Centre card (V1.10.13).
'use strict';
(() => {
  const W = window, D = document, $ = id => D.getElementById(id), G = W.EmberGithub, R = W.EmberRepoRunner;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* storage blocked */ } } };
  const say = (text, stream) => { try { if (W.EmberCommandCenter) W.EmberCommandCenter.write({ tag: 'GIT', source: 'Command Centre', stream: stream || 'status', text: String(text) }); } catch (_) { /* terminal optional */ } };
  let open = false, busy = false, msg = {}, urls = [];

  function mount() {
    const host = $('ccWidgetBody'); if (!host || $('cwxRoot')) return !!$('cwxRoot');
    const w = D.createElement('div'); w.id = 'cwxRoot'; w.className = 'cwx';
    w.innerHTML =
      '<div class="cwx-ticker" id="cwxTicker" aria-live="off">Live terminal: idle</div>' +
      '<div class="cwx-row"><button type="button" class="btn g" data-cw="term">Show live terminal</button><button type="button" class="btn g" data-cw="side">Context &amp; memory panel</button></div>' +

      '<h3 class="cwx-h"><span>1</span>Media</h3>' +
      '<div class="cwx-row"><button type="button" class="btn g" id="cwBridge" data-cw="bridge">Stability bridge: OFF</button><button type="button" class="btn g" data-cw="ai">All AI settings</button></div>' +
      '<div class="cwx-row"><select id="cwKind" aria-label="What to make"><option value="image">Image · Stability</option><option value="audio">Audio / music · Stability</option><option value="video">Video · Stability (images + music)</option></select></div>' +
      '<textarea id="cwPrompt" rows="2" placeholder="Describe it, then Make"></textarea>' +
      '<button type="button" class="btn cwx-wide" data-cw="make">Make it</button><p class="cwx-msg" id="cwMediaMsg" role="status"></p><div id="cwArt" class="cwx-art"></div>';
    host.appendChild(w);
    w.addEventListener('click', onClick);
    w.addEventListener('keydown', e => { if (e.key !== 'Enter' || busy) return; if (e.target.id === 'cwQ') { e.preventDefault(); act('search'); } else if (e.target.id === 'cwOne') { e.preventDefault(); act('one'); } });
    const tk = $('eccTerminalTicker'); if (tk && W.MutationObserver) new MutationObserver(paintTicker).observe(tk, { childList: true, characterData: true, subtree: true });
    // the widget itself (ember_v96_ui.js) owns expand / collapse; this follows it
    if (W.MutationObserver) new MutationObserver(() => syncOpen()).observe(host, { attributes: true, attributeFilter: ['hidden'] });
    ['ember-git-state', 'ember-repo-config', 'ember-brain-pushed'].forEach(n => W.addEventListener(n, paint));
    W.addEventListener('ember-media-update', paintMedia); W.addEventListener('ember-plus-change', paintMedia); W.addEventListener('ember-plus-change', paintMedia);
    if (G && G.sub) G.sub(ev => { if (ev && ev.type === 'state') paint(); });
    syncOpen(); paintTicker(); return true;
  }
  function syncOpen() { const h = $('ccWidgetBody'); open = !!(h && !h.hidden); if (open) { paint(); paintMedia(); } else paintChip(); }
  function setOpen(v) { const t = $('ccWidgetToggle'); if (t && (!!v !== open)) t.click(); }
  function paintChip() {
    const c = D.querySelector('#ccWidget .ecc-chip'); if (!c) return;
    const on = !!(G && G.on()); let chip = on ? 'READY' : 'NO TOKEN';
    try { const st = G.syncState(), dg = G.digestOf(G.knowledgeSources()[0]); chip = st.running ? 'SYNCING' : dg && dg.syncedAt ? 'LOADED' : chip; } catch (_) { /* state not ready */ }
    if (c.textContent !== chip) c.textContent = chip;
  }
  const setMsg = (id, t) => { const e = $(id); if (e && e.textContent !== t) e.textContent = t; };
  function paintTicker() { const t = $('eccTerminalTicker'); const e = $('cwxTicker'); if (e) e.textContent = 'Live terminal: ' + ((t && t.textContent.trim()) || 'idle'); }
  function paint() {
    if (!$('cwxRoot')) return;
    paintChip();
  }
  async function paintMedia() {
    if (!$('ccWidget') || !open || !W.EmberMedia) return;
    const mp = W.EmberMediaPlus, b = $('cwBridge'); if (b) { const v = !!(mp && mp.bridgeOn()); b.textContent = 'Stability bridge: ' + (v ? 'ON' : 'OFF'); b.classList.toggle('cwx-on', v); }
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    const box = $('cwArt'); if (!box) return; box.replaceChildren();
    for (const j of W.EmberMedia.jobs().filter(j => j.state === 'running')) { const p = D.createElement('p'); p.className = 'cwx-msg'; p.textContent = j.provider + ' ' + j.kind + ': running…'; const s = D.createElement('button'); s.type = 'button'; s.className = 'btn g'; s.textContent = 'Stop'; s.onclick = () => W.EmberMedia.cancel(j.id); p.append(' ', s); box.append(p); }
    try {
      for (const a of (await W.EmberMedia.list()).slice(0, 6)) {
        const card = D.createElement('div'); card.className = 'cwx-card'; const h = D.createElement('b'); h.textContent = a.name;
        const el = D.createElement(a.kind === 'image' ? 'img' : a.kind === 'video' ? 'video' : 'audio'), u = URL.createObjectURL(a.blob); urls.push(u); el.src = u; el.controls = true; el.preload = 'metadata'; el.alt = a.prompt || '';
        const dl = D.createElement('button'); dl.type = 'button'; dl.className = 'btn g'; dl.textContent = 'Download'; dl.onclick = () => W.EmberMedia.download(a);
        card.append(h, el, dl); box.append(card);
      }
    } catch (_) { /* artifact store unavailable */ }
  }
  function lockUI(v) { busy = v; const w = $('ccWidget'); if (!w) return; w.setAttribute('aria-busy', String(v)); w.querySelectorAll('button[data-cw]').forEach(b => { if (v) { b.dataset.was = b.disabled ? '1' : ''; b.disabled = true; } else { b.disabled = b.dataset.was === '1'; delete b.dataset.was; } }); }
  async function guard(fn, key) { if (busy) return; lockUI(true); try { await fn(); } catch (e) { msg[key] = String((e && e.message) || e); } finally { lockUI(false); paint(); paintMedia(); } }

  async function act(a) {
    if (a === 'term') { const bx = $('bSx'); if (bx) bx.click(); setTimeout(() => { const t = $('eccTerminalToggle'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); const s = $('emberTerminal'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' }); }, 200); return; }
    if (a === 'side') { const bx = $('bSx'); if (bx) bx.click(); setTimeout(() => { const b = $('bCommandCenter'); if (b) b.click(); }, 200); return; }
    if (a === 'ai') { if (W.EmberFeatures && W.EmberFeatures.open) { const acc = D.getElementById('acc_h_features'); if (acc) { acc.click(); setTimeout(() => { const e = $('efRouting'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 150); } else W.EmberFeatures.open(); } return; }
    if (a === 'bridge') { const P = W.EmberPlus; if (P && P._set) { P._set('stab', !P.isOn('stab')); if (P.isOn('stab') && W.EmberMediaPlus) W.EmberMediaPlus.enable(); paintMedia(); } return; }
    if (a === 'make') return guard(async () => {
      const MP = W.EmberMediaPlus; if (!MP) throw new Error('The media engine did not load.');
      const kind = $('cwKind').value, p = $('cwPrompt').value.trim(); if (!p) { msg.media = 'Describe it first.'; setMsg('cwMediaMsg', msg.media); return; }
      setMsg('cwMediaMsg', 'Making ' + kind + '… this can take a few minutes.');
      const r = await MP.make(kind, 'stability', p);
      msg.media = r.ok ? 'Saved ' + r.name + ' in ' + r.secs + 's.' : r.error; setMsg('cwMediaMsg', msg.media);
    }, 'media');
  }
  function onClick(e) {
    const b = e.target.closest('[data-cw]'); if (b && !b.disabled) act(b.getAttribute('data-cw'));
  }
  function start() {
    if (!G || !R) return;
    let n = 0; const t = setInterval(() => { if (mount() || ++n > 40) clearInterval(t); }, 150); // wait for the Settings widget to exist
    W.EmberCCWidget = { open: () => setOpen(true), close: () => setOpen(false), isOpen: () => open };
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
