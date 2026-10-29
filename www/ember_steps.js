// Ember V1.9.78 - ember_steps.js: the thinking card shows what Ember is really doing, live.
// Every line here comes from a real event: the turn starting, an engine being tried or skipped, the first words coming back,
// the reply growing as it streams, and the model's own reasoning when its engine sends it. Nothing is scripted or guessed.
'use strict';
(() => {
  const TL = () => window.EmberTimeline, clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? '…' + s.slice(-n) : s; };
  const words = t => (String(t || '').trim().match(/\S+/g) || []).length;
  let t0 = 0, first = false, lastPaint = 0, lastThink = 0, lastWords = 0, skipSeen = {};
  const lab = id => { try { return window.Prov.label(id); } catch (_) { return String(id || 'engine'); } };
  window.addEventListener('ember-turn-start', () => { t0 = Date.now(); first = false; lastPaint = 0; lastThink = 0; lastWords = 0; skipSeen = {}; });
  window.addEventListener('ember-skip', e => {
    const d = e.detail || {}; if (!TL() || skipSeen[d.id]) return; skipSeen[d.id] = 1;
    TL().step('key', lab(d.id) + ' skipped: ' + (d.why || 'not available'), 'skip-' + d.id);
  });
  window.addEventListener('ember-thought', e => { // the model's own reasoning, updated in place
    const d = e.detail || {}; if (!TL() || !d.text) return;
    const now = Date.now(); if (now - lastThink < 250) return; lastThink = now;
    TL().step('brain', clip(d.text, 150), 'model-thought', { max: 160 });
  });
  window.addEventListener('ember-token', e => { // first words, then the reply growing
    const d = e.detail || {}, T = TL(); if (!T || !d.text) return;
    const now = Date.now();
    if (!first) { first = true; if (t0) T.step('bolt', 'First words came back after ' + ((now - t0) / 1000).toFixed(1) + 's', 'first-token'); }
    const w = words(d.text); if (now - lastPaint < 400 && w - lastWords < 12) return;
    lastPaint = now; lastWords = w; T.step('pen', 'Writing the reply · ' + w + ' word' + (w == 1 ? '' : 's'), 'stream');
  });
  window.addEventListener('ember-turn-end', e => { // settle the writing line with the real final numbers
    const d = e.detail || {}, T = TL(); if (!T || !t0) return;
    if (d.words) T.step('pen', 'Wrote ' + d.words + ' word' + (d.words == 1 ? '' : 's') + ' in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's' + (d.engine ? ' · ' + d.engine : ''), 'stream');
  });
})();
