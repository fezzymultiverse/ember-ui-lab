// Ember V1.9.54 — local Knowledge Graph: documents, notes, memory and chats stay on this phone.
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  // V1.9.71: real topics only. Unicode-aware (accents and other languages stay whole words instead of broken fragments),
  // no code / links / ids / numbers, English + Afrikaans filler words skipped, and a topic only becomes a node when it is shared by 2+ sources.
  const STOP = new Set(('about after again all also because before between could does each from have into just more most other over should some such than that their them then there these they this those through using very what when where which while with would your you ember chat message reply answer document documents note notes file files the and for are was were has had his her him our out not but can get how why who its will been being here like make made need want know think okay yeah yes please thanks thank hello tool tools memory thread ' +
    'const function return true false null undefined class import export default async await https http html json script string number object array error console div span href src style width height color background padding margin display flex font size line type value name data text list item items index test code line lines path file true false else while break continue switch case catch finally throw new typeof void this self super static public private protected ' +
    'die nie het vir van met sal kan wat dit ook was hy sy ons julle hulle een maar dan toe wel net nou soos hierdie daardie omdat dat aan uit tot jou haar hom hul daar hier moet wil gaan gaat jy ek my is by om te as'.split(/\s+/)));
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const strip = t => String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/<[^>]{1,200}>/g, ' ').replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, ' ').replace(/\S*\d\S*/g, ' ').replace(/[_*#>|~=+\\\/{}\[\]()<>@$%^&]/g, ' ');
  let WORD; try { WORD = new RegExp("\\p{L}[\\p{L}\\p{M}'\u2019-]*", 'gu'); } catch (e) { WORD = /[a-z][a-z'-]*/gi; }
  const words = text => {
    const a = strip(text).match(WORD) || [], c = new Map();
    a.forEach(raw => {
      const w = raw.replace(/^['\u2019-]+|['\u2019-]+$/g, '').toLocaleLowerCase();
      if (w.length < 4 || w.length > 22 || STOP.has(w) || /(.)\1{3,}/.test(w)) return;
      c.set(w, (c.get(w) || 0) + 1);
    });
    return [...c.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12).map(x => x[0]);
  };
  async function collect() {
    const sources = [];
    const add = (id, label, kind, text) => { const ts = words(text); if (ts.length) sources.push({ id, label: clean(label).slice(0, 26) || 'Untitled', kind, ts }); };
    try {
      const docs = window.EmberDocs ? await window.EmberDocs.all() : [];
      (docs || []).slice(-80).forEach(d => add('doc:' + d.id, d.name, d.src === 'note' ? 'note' : 'document', d.name + '\n' + d.text));
    } catch (e) {}
    try {
      const mem = window.EmberBridge && window.EmberBridge.getMem ? window.EmberBridge.getMem() : null;
      (mem && (mem.facts || []).slice(-30) || []).forEach((m, i) => add('memory:' + i, String(m.t || '').slice(0, 24), 'memory', m.t));
      (mem && (mem.threads || []).slice(-20) || []).forEach((m, i) => add('thread:' + i, String(m.t || '').slice(0, 24), 'memory', m.t));
    } catch (e) {}
    try {
      const cs = window.Store ? await window.Store.all() : [];
      (cs || []).slice(-30).forEach(c => { const text = (c.msgs || []).slice(-12).map(m => m.t || '').join('\n'); if (text) add('chat:' + c.id, c.title || 'Chat', 'chat', text); });
    } catch (e) {}
    // topics shared by 2+ sources; if nothing is shared yet, show the strongest few so the view is never empty
    const count = new Map(); sources.forEach(s => new Set(s.ts).forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    let keep = [...count.entries()].filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 24).map(x => x[0]);
    if (keep.length < 3) keep = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
    const kept = new Set(keep), nodes = [], edges = [], used = new Set();
    keep.forEach(t => nodes.push({ id: 'topic:' + t, label: t, kind: 'topic', w: count.get(t) }));
    sources.forEach(s => { const links = s.ts.filter(t => kept.has(t)); if (!links.length) return; used.add(s.id); nodes.push({ id: s.id, label: s.label, kind: s.kind, links: links.map(t => 'topic:' + t) }); links.forEach(t => edges.push({ a: s.id, b: 'topic:' + t })); });
    const srcCount = nodes.filter(n => n.kind !== 'topic').length;
    return { nodes, edges, topics: keep.length, sources: srcCount, total: sources.length };
  }
  function layout(g) {
    const W = 640, H = 640, cx = W / 2, cy = H / 2;
    const topics = g.nodes.filter(n => n.kind === 'topic'), src = g.nodes.filter(n => n.kind !== 'topic');
    const rt = topics.length > 1 ? 108 : 0, rs = 238;
    topics.forEach((n, i) => { const a = (i / Math.max(1, topics.length)) * Math.PI * 2 - Math.PI / 2; n.x = cx + Math.cos(a) * rt; n.y = cy + Math.sin(a) * rt; n.a = a; });
    const byId = new Map(topics.map(n => [n.id, n]));
    // each source sits on the outer ring in the direction of its topics, then the ring is spread so labels do not collide
    src.forEach(n => { let x = 0, y = 0; (n.links || []).forEach(l => { const t = byId.get(l); if (t) { x += Math.cos(t.a); y += Math.sin(t.a); } }); n.a = Math.atan2(y, x) || 0; });
    src.sort((p, q) => p.a - q.a);
    const gap = Math.max(0.2, Math.min(0.45, (Math.PI * 2) / Math.max(1, src.length)));
    for (let i = 1; i < src.length; i++) if (src[i].a - src[i - 1].a < gap) src[i].a = src[i - 1].a + gap;
    if (src.length > 1) { const over = src[src.length - 1].a - src[0].a - (Math.PI * 2 - gap); if (over > 0) { const k = (Math.PI * 2 - gap) / (src[src.length - 1].a - src[0].a); src.forEach(n => { n.a = src[0].a + (n.a - src[0].a) * k; }); } }
    src.forEach(n => { n.x = cx + Math.cos(n.a) * rs; n.y = cy + Math.sin(n.a) * rs; });
    return { W, H };
  }
  function paint(g) {
    const out = $('graphView'); if (!out) return;
    if (!g.sources) { out.innerHTML = '<div class="graph-empty"><b>No connections yet.</b><span>Add documents, notes or chat a bit more. Ember links the words and ideas that show up in more than one place.</span></div>'; $('graphStats').textContent = '0 sources · 0 topics'; return; }
    const d = layout(g), map = new Map(g.nodes.map(n => [n.id, n]));
    const lines = g.edges.map(e => { const a = map.get(e.a), b = map.get(e.b); return a && b ? '<line x1="' + Math.round(a.x) + '" y1="' + Math.round(a.y) + '" x2="' + Math.round(b.x) + '" y2="' + Math.round(b.y) + '" />' : ''; }).join('');
    const circles = g.nodes.map(n => '<g class="gn ' + n.kind + '" transform="translate(' + Math.round(n.x) + ' ' + Math.round(n.y) + ')"><circle r="' + (n.kind === 'topic' ? 9 + Math.min(7, (n.w || 2)) : 9) + '"></circle><text y="' + (n.kind === 'topic' ? 9 + Math.min(7, (n.w || 2)) + 15 : (n.y < 320 ? -16 : 25)) + '" text-anchor="middle"' + (n.kind === 'topic' ? ' class="gt"' : '') + '>' + esc(n.label) + '</text></g>').join('');
    out.innerHTML = '<svg viewBox="0 0 ' + d.W + ' ' + d.H + '" role="img" aria-label="Local knowledge graph"><g class="gedges">' + lines + '</g><g class="gnodes">' + circles + '</g></svg>';
    $('graphStats').textContent = g.sources + ' connected · ' + g.topics + ' topics';
  }
  async function build() { const g = await collect(); paint(g); return { ok: true, sources: g.sources, topics: g.topics, edges: g.edges.length, top: g.nodes.filter(n => n.kind === 'topic').slice(0, 12).map(n => n.label) }; }
  function open() { const s = $('graph'); if (!s) return; s.classList.add('show'); build(); }
  function close() { const s = $('graph'); if (s) s.classList.remove('show'); }
  $('bGraph') && ($('bGraph').onclick = open);
  $('graphX') && ($('graphX').onclick = close);
  $('graphRefresh') && ($('graphRefresh').onclick = build);
  window.addEventListener('ember-docs-changed', () => { if ($('graph') && $('graph').classList.contains('show')) build(); });
  window.EmberGraph = {
    TOOLS: [{ name: 'map_knowledge', description: 'Builds a local knowledge graph from saved documents, notes, memory and chats. It returns only counts and shared topics; content stays on the phone.', parameters: { query: 'string?' } }],
    dispatch: async name => name === 'map_knowledge' ? build() : { error: 'Unknown graph tool.' },
    open, build, collect
  };
})();
