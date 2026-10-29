// Ember V1.10.3 - ember_prov_next.js
// 1) The 🌐 button in the top bar opens the same Browser as the menu row.
// 2) The Providers button (bottom-left of the chat) carries a blue "next up" dot: which engine answers your next
//    message and which of its keys is up. It reads the live router (order, key health, pin, Free Mode) and never
//    changes routing. The ring turns while idle and spins fast while Ember is working.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const LANE = 'fast';

  // ---- 1) Browser in the top panel ----
  const top = $('bBrowserTop');
  if (top) top.addEventListener('click', () => { const g = $('bGlobe'); if (g) g.click(); });

  // ---- 2) next-up dot on Providers ----
  function nextUp() {
    const P = window.Prov; if (!P || !P.route) return null;
    let pinned = ''; try { pinned = P.getPinned ? P.getPinned() || '' : ''; } catch (e) { /* no pin */ }
    try { if (!pinned && P.freeOn && P.freeOn()) return { id: 'free', name: 'Free Mode', n: 0, at: 0, pinned: false }; } catch (e) { /* ignore */ }
    let order = []; try { order = P.route(LANE) || []; } catch (e) { /* ignore */ }
    for (const id of order) {
      let st = 'none'; try { st = P.stateOf(id); } catch (e) { /* ignore */ }
      if (st !== 'ok' && st !== 'unknown') continue;
      const pk = P.peek ? P.peek(id, LANE) : { n: 0, at: 0 };
      return { id, name: (P.CFG[id] && P.CFG[id].name) || id, n: pk.n, at: pk.at, pinned: pinned === id };
    }
    return null;
  }

  let el = null, last = '', busy = false;
  function mount() {
    const b = document.querySelector('#chatProviderBar #bProv'); if (!b) return false;
    if (b.querySelector('#provNext')) { el = b.querySelector('#provNext'); return true; }
    el = document.createElement('span'); el.id = 'provNext'; el.className = 'pn';
    el.innerHTML = '<i class="pn-dot" aria-hidden="true"></i><span class="pn-t"></span>';
    b.appendChild(el); return true;
  }
  function paint() {
    if (!el && !mount()) return;
    const info = nextUp(), t = el.querySelector('.pn-t'), b = el.parentElement;
    let text, cls, title;
    if (!info) { text = 'No engine ready'; cls = 'idle'; title = 'Providers: no engine with a working key right now'; }
    else {
      const key = info.n > 1 ? ' · key ' + (info.at + 1) + '/' + info.n : '';
      text = (info.pinned ? 'Pinned ' : 'Next ') + info.name + key;
      cls = busy ? 'busy' : 'live';
      title = 'Providers · ' + (info.pinned ? 'pinned engine: ' : 'next up: ') + info.name + (info.n > 1 ? ' (key ' + (info.at + 1) + ' of ' + info.n + ', rotates after each reply)' : '');
    }
    el.className = 'pn ' + cls;
    if (busy && info) el.classList.add('busy');
    b.title = title;
    if (t.textContent !== text) {
      t.textContent = text;
      if (last && last !== text) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); }
      last = text;
    }
  }

  function start() {
    let tries = 0;
    const iv = setInterval(() => { tries++; if (mount() || tries > 40) { clearInterval(iv); paint(); } }, 250);
    ['ember-provider-stats', 'ember-names', 'ember-git-state'].forEach(n => window.addEventListener(n, paint));
    window.addEventListener('ember-activity', e => { busy = !!(e.detail && e.detail.active); paint(); });
    setInterval(paint, 3000); // cooldowns and key checks change without an event
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
