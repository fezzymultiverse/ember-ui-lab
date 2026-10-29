// Ember V1.10.4 - ember_v104.js: feeds the Live Terminal with what Ember is really doing (tools, engine tries, picture/PDF steps, web reads, GitHub brain).
'use strict';
(() => {
  const W = window, seenStep = new Map(), last = {};
  const out = (tag, source, text, stream, ms) => { try { if (W.EmberCommandCenter) W.EmberCommandCenter.write({ tag, source, text, stream: stream || 'status', ms }); } catch (_) { /* terminal optional */ } };
  const brief = v => { try { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 110 ? s.slice(0, 107) + '...' : s; } catch (_) { return ''; } };
  const sum = r => { if (!r || typeof r !== 'object') return brief(r); if (r.error) return 'error: ' + brief(r.error); const k = Object.keys(r).slice(0, 4).map(x => x + '=' + brief(r[x]).slice(0, 28)).join(' '); return k || 'ok'; };
  W.addEventListener('ember-turn-start', () => out('TURN', 'Ember', 'New turn started'));
  W.addEventListener('ember-tool-log', e => {
    const d = e.detail || {}; if (!d.tool) return;
    if (d.phase === 'start') return out('TOOL', 'Tool', '> ' + d.tool + '(' + brief(d.args || {}) + ')');
    const bad = !!(d.res && (d.res.error || d.res.ok === false));
    out(/scrape|search|read_url|web/i.test(d.tool) ? 'WEB' : /github|repo|brain/i.test(d.tool) ? 'GIT' : 'TOOL', 'Tool', (bad ? 'x ' : 'ok ') + d.tool + ' -> ' + sum(d.res), bad ? 'stderr' : 'status', d.ms);
  });
  W.addEventListener('ember-try', e => { const d = e.detail || {}; out('ROUTE', 'Router', 'Trying ' + (d.name || 'engine') + (d.model ? ' / ' + d.model : '')); });
  W.addEventListener('ember-skip', e => { const d = e.detail || {}; out('ROUTE', 'Router', 'Skipped ' + (d.id || 'engine') + ': ' + (d.why || 'unavailable')); });
  W.addEventListener('ember-switch', e => { const d = e.detail || {}; out('ROUTE', 'Router', 'Switched ' + (d.from || '?') + ' -> ' + (d.to || '?') + (d.status ? ' (HTTP ' + d.status + ')' : ''), 'stderr'); });
  W.addEventListener('ember-provider-stats', () => {
    try {
      const st = W.Prov && Prov.stats && Prov.stats(); if (!st) return;
      for (const id of Object.keys(st)) {
        const s = st[id], p = last[id] || { success: 0, failed: 0 }; last[id] = { success: s.success, failed: s.failed };
        if (s.success > p.success) out('ROUTE', id, 'reply ok' + (s.tokens ? ' - ' + s.tokens + ' tokens so far' : ''), 'status', s.latency || undefined);
        if (s.failed > p.failed) out('ROUTE', id, 'request failed (' + s.failed + ' total)', 'stderr');
      }
    } catch (_) { /* stats not ready */ }
  });
  W.addEventListener('ember-create-log', e => out('CREATE', (e.detail && e.detail.kind) || 'Create', (e.detail && e.detail.text) || ''));
  W.addEventListener('ember-media-update', () => { try { (EmberMedia.jobs() || []).slice(-1).forEach(j => out('CREATE', j.provider, j.kind + ' job ' + j.state + (j.error ? ': ' + j.error : ''), j.state === 'failed' ? 'stderr' : 'status')); } catch (_) { /* media optional */ } });
  W.addEventListener('ember-git-state', () => { try { const s = W.EmberGit && EmberGit.summary && EmberGit.summary(); if (s && s.ready) out('GIT', 'Brain', s.brain + ' - ' + s.files + ' files' + (s.running ? ' - syncing' : '')); } catch (_) { /* git optional */ } });
  // every thinking step (image/PDF/web/GitHub) is mirrored once per change
  const hook = () => {
    const T = W.EmberTimeline; if (!T || T._v104) return !!T;
    const step = T.step; T._v104 = true;
    T.step = function (ic, text, key, opt) {
      try { const k = String(key || ''), sig = k + '|' + text; if (seenStep.get(k) !== sig) { seenStep.set(k, sig); if (seenStep.size > 300) seenStep.delete(seenStep.keys().next().value);
        out(/^(im|fg|pdf)/.test(k) ? 'CREATE' : /web/.test(k) ? 'WEB' : /git|brain|read/i.test(k) ? 'GIT' : 'THINK', 'Ember', String(text)); } } catch (_) { /* view only */ }
      return step.apply(this, arguments);
    };
    return true;
  };
  if (!hook()) { let n = 0; const t = setInterval(() => { if (hook() || ++n > 40) clearInterval(t); }, 250); }
})();
