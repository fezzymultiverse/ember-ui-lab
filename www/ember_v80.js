// Ember V1.9.80 - ember_v80.js: layout glue (keyboard-open dock, music bar mirrors the track and gets a play button).
'use strict';
(() => {
  const $ = id => document.getElementById(id), body = document.body;
  // keyboard open: hide the modes row and chips so the box is the only thing that grows
  const vv = window.visualViewport;
  if (vv) {
    const full = Math.max(window.innerHeight, screen.height * 0.5);
    const chk = () => body.classList.toggle('kb-open', vv.height < Math.min(full, window.innerHeight) - 140);
    vv.addEventListener('resize', chk); chk();
  }
  // key groups: add a "N working" summary to each group header so a folded list still tells the truth
  const kl = $('kList');
  if (kl && window.MutationObserver) {
    const sum = () => kl.querySelectorAll('.kgrp').forEach(g => {
      const h = g.querySelector('.kghead'); if (!h) return; const rows = g.querySelectorAll('.kr'); if (!rows.length) return;
      let ok = 0, bad = 0; rows.forEach(r => { const t = (r.querySelector('small') || {}).textContent || ''; if (t.charAt(0) == '✓') ok++; else if (t.charAt(0) == '✗') bad++; });
      let sp = h.querySelector('.kg-sum'); if (!sp) { sp = document.createElement('span'); sp.className = 'kg-sum'; const c = h.querySelector('.chev'); if (c) h.insertBefore(sp, c); else h.appendChild(sp); }
      const t = ok + ' working' + (bad ? ' · ' + bad + ' rejected' : ''); if (sp.textContent != t) { sp.textContent = t; sp.className = 'kg-sum' + (bad && !ok ? ' b' : bad ? ' w' : ''); }
    });
    let lock = false; new MutationObserver(() => { if (lock) return; lock = true; try { sum(); } finally { setTimeout(() => { lock = false; }, 0); } }).observe(kl, { childList: true, subtree: true }); sum();
  }
  // music bar: show the track name under the label and add a play/pause button
  const btn = $('dmConsoleBtn'); if (!btn) return;
  const lab = btn.querySelector('.dm-label');
  if (lab && !lab.dataset.v80) {
    lab.dataset.v80 = '1'; lab.innerHTML = 'Music Console<small id="dmBarSub">Tap to open</small>';
    const mini = document.createElement('span'); mini.className = 'dm-mini'; mini.setAttribute('role', 'button'); mini.setAttribute('aria-label', 'Play or pause'); mini.textContent = '▶';
    const chev = btn.querySelector('.dm-chevron'); btn.insertBefore(mini, chev);
    mini.addEventListener('click', e => { e.stopPropagation(); const p = $('dmPlay'); if (p) p.click(); });
    const sync = () => {
      const n = $('dmTrackName'), s = $('dmBarSub'), p = $('dmPlay'); if (!n || !s) return;
      const t = (n.textContent || '').trim(); s.textContent = t && t != 'Nothing playing' ? t : 'Tap to open';
      if (p) mini.textContent = (p.textContent || '').includes('⏸') || /pause|■/i.test(p.textContent || '') ? '⏸' : '▶';
    };
    const t = $('dmTrackName'), p = $('dmPlay');
    [t, p].forEach(el => { if (el && window.MutationObserver) new MutationObserver(sync).observe(el, { childList: true, characterData: true, subtree: true }); });
    sync(); setInterval(sync, 2500);
  }
})();
