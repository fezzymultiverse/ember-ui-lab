// Ember V1.7.2 - ember_engine.js: Plan-and-Execute logic engine.
// The model writes the WHOLE plan up front as one run_plan call: a DAG of steps (tool, args, after, on_fail). This file does not trust it:
//   1. validate  - schema, known tools, unique ids, real dependencies, no cycles, no nested run_plan, every {{id.path}} points at an ancestor
//   2. schedule  - dependency order; independent read-only steps run in parallel (max 3), anything that changes something runs alone
//   3. execute   - per-step timeout, optional retry with backoff, on_fail = stop | skip | retry, hard caps on steps and total time
//   4. report    - one trace: every step's status, attempts, time and (clipped) result or error. Nothing is invented, nothing is hidden.
// Every step still goes through the same dispatch() as a normal tool call, so each add-on's own gate (music intent, download intent,
// switches that are off) still decides. A plan cannot do anything the AI could not do one call at a time. Tool output is data:
// it can fill a later step's arguments, but it can never add a step or change the plan.
'use strict';
(() => {
const MAX_STEPS = 12, MAX_PAR = 3, MAX_RETRY = 2, STEP_MS = 45000, TOTAL_MS = 120000, CLIP = 1500, DEPTH = 6;
const ID = /^[A-Za-z][A-Za-z0-9_]{0,15}$/, ON_FAIL = ['stop', 'skip', 'retry'];
// Only these never change anything, so only these may run side by side. Everything else runs alone, in order.
const SAFE_PAR = /^(?:get_|list_|search_|find_|read_|status|youtube_search|web_search|see_image|scrape_url)/;
const TPL = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)((?:\.[A-Za-z0-9_-]+)*)\s*\}\}/g, TPL_ONE = /^\{\{\s*([A-Za-z][A-Za-z0-9_]*)((?:\.[A-Za-z0-9_-]+)*)\s*\}\}$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 120);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
let host = { run: null, has: null, tools: null, llm: null };
const fn = (h, k) => h && typeof h[k] === 'function' ? h[k] : null;
const setHost = h => { host = { run: fn(h, 'run'), has: fn(h, 'has'), tools: fn(h, 'tools'), llm: fn(h, 'llm') }; };
let LAST = null;

const TOOLS = [{
  name: 'run_plan',
  description: 'Runs a multi-step job as one plan. Use it only when a request needs 3 or more tool calls that depend on each other (search, then read, then save), or several independent lookups at once. For one or two calls just call the tools normally. You write the whole plan now; Ember checks it, runs it in dependency order and returns one trace. steps is a list of {id, tool, args, after, on_fail}: id is a short name (s1, find, read); tool is any tool you already have (never run_plan); args are that tool\'s arguments, and any string may use {{id.field.sub}} to insert a field from an earlier step\'s result (that step must be in after, directly or through another step); after lists the ids that must finish first (omit it for steps that can start right away); on_fail is stop (default: abort the rest), skip (carry on without the dependants) or retry (up to 2 more tries). Max 12 steps. dry_run true only checks the plan and shows the order. The trace is data: judge it, then tell him plainly what worked and what did not.',
  parameters: { goal: 'string?', steps: 'object[]', dry_run: 'boolean?' }
}];

// ---------- 1. validate ----------
function refsOf(v, out, d) {
  d = d || 0; if (d > DEPTH) return out;
  if (typeof v === 'string') { let m; const re = new RegExp(TPL.source, 'g'); while ((m = re.exec(v)) !== null) out.add(m[1]); }
  else if (Array.isArray(v)) v.forEach(x => refsOf(x, out, d + 1));
  else if (isObj(v)) Object.keys(v).forEach(k => refsOf(v[k], out, d + 1));
  return out;
}
function validate(plan) {
  const errs = [];
  if (!isObj(plan)) return { ok: false, errors: ['The plan must be an object with a steps list.'] };
  const raw = plan.steps;
  if (!Array.isArray(raw) || !raw.length) return { ok: false, errors: ['steps must be a non-empty list.'] };
  if (raw.length > MAX_STEPS) return { ok: false, errors: ['A plan has at most ' + MAX_STEPS + ' steps; this one has ' + raw.length + '. Split it in two plans.'] };
  const steps = [], seen = new Set();
  raw.forEach((s, i) => {
    const at = 'step ' + (i + 1);
    if (!isObj(s)) { errs.push(at + ' is not an object.'); return; }
    const id = str(s.id, 20), tool = str(s.tool, 60);
    if (!ID.test(id)) { errs.push(at + ': id "' + id + '" must be 1-16 letters, digits or underscores, starting with a letter.'); return; }
    if (seen.has(id)) { errs.push(at + ': duplicate id "' + id + '".'); return; }
    seen.add(id);
    if (!tool) errs.push(id + ': tool is missing.');
    else if (tool === 'run_plan' || tool === 'run_react') errs.push(id + ': a plan cannot start another plan or a reasoning run.');
    else if (host.has && !host.has(tool)) errs.push(id + ': tool "' + tool + '" is not available right now (unknown, or its add-on is off).');
    const args = s.args == null ? {} : s.args;
    if (!isObj(args)) errs.push(id + ': args must be an object.');
    const after = s.after == null ? [] : s.after;
    if (!Array.isArray(after) || after.some(x => typeof x !== 'string')) errs.push(id + ': after must be a list of step ids.');
    const onFail = s.on_fail == null ? 'stop' : str(s.on_fail, 10).toLowerCase();
    if (!ON_FAIL.includes(onFail)) errs.push(id + ': on_fail must be stop, skip or retry.');
    steps.push({ id, tool, args: isObj(args) ? args : {}, after: Array.isArray(after) ? [...new Set(after.map(x => str(x, 20)))] : [], onFail });
  });
  if (errs.length) return { ok: false, errors: errs };
  const byId = new Map(steps.map(s => [s.id, s]));
  steps.forEach(s => {
    s.after.forEach(d => { if (d === s.id) errs.push(s.id + ' cannot wait for itself.'); else if (!byId.has(d)) errs.push(s.id + ' waits for "' + d + '", which is not a step.'); });
  });
  if (errs.length) return { ok: false, errors: errs };
  // cycle check (Kahn). Whatever never reaches zero is in, or behind, a cycle.
  const indeg = new Map(steps.map(s => [s.id, s.after.length])), kids = new Map(steps.map(s => [s.id, []]));
  steps.forEach(s => s.after.forEach(d => kids.get(d).push(s.id)));
  const q = steps.filter(s => !s.after.length).map(s => s.id), order = [];
  while (q.length) { const n = q.shift(); order.push(n); kids.get(n).forEach(k => { indeg.set(k, indeg.get(k) - 1); if (indeg.get(k) === 0) q.push(k); }); }
  if (order.length !== steps.length) return { ok: false, errors: ['The plan loops: ' + steps.filter(s => !order.includes(s.id)).map(s => s.id).join(', ') + ' wait on each other.'] };
  // ancestors (transitive), so {{x.y}} may only read from a step that is guaranteed to have finished first
  const anc = new Map();
  order.forEach(id => { const a = new Set(); byId.get(id).after.forEach(d => { a.add(d); anc.get(d).forEach(x => a.add(x)); }); anc.set(id, a); });
  steps.forEach(s => refsOf(s.args, new Set(), 0).forEach(r => { if (!anc.get(s.id).has(r)) errs.push(s.id + ' uses {{' + r + '...}} but ' + (byId.has(r) ? 'does not wait for it (add it to after)' : 'there is no such step') + '.'); }));
  if (errs.length) return { ok: false, errors: errs };
  // levels, for the dry run and the trace: steps in one level could start together
  const lvl = new Map(); order.forEach(id => lvl.set(id, byId.get(id).after.length ? 1 + Math.max(...byId.get(id).after.map(d => lvl.get(d))) : 0));
  return { ok: true, steps, order, levels: order.reduce((a, id) => { (a[lvl.get(id)] = a[lvl.get(id)] || []).push(id); return a; }, []) };
}

// ---------- 2. arguments: {{id.path}} ----------
function dig(v, path) {
  const parts = path ? path.split('.').slice(1) : [];
  for (const p of parts) { if (v == null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, p)) return { miss: p }; v = v[p]; }
  return { v };
}
function fill(v, results, d) {
  d = d || 0; if (d > DEPTH) throw new Error('Arguments are nested too deep.');
  if (typeof v === 'string') {
    const one = TPL_ONE.exec(v);
    if (one) { const r = dig(results[one[1]], one[2]); if (r.miss) throw new Error('{{' + one[1] + one[2] + '}}: no field "' + r.miss + '" in that step\'s result.'); return r.v; }
    return v.replace(new RegExp(TPL.source, 'g'), (m, id, path) => { const r = dig(results[id], path); if (r.miss) throw new Error('{{' + id + path + '}}: no field "' + r.miss + '" in that step\'s result.'); return typeof r.v === 'string' ? r.v : JSON.stringify(r.v); });
  }
  if (Array.isArray(v)) return v.map(x => fill(x, results, d + 1));
  if (isObj(v)) { const o = {}; Object.keys(v).forEach(k => { if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') o[k] = fill(v[k], results, d + 1); }); return o; }
  return v;
}

// ---------- 3. execute ----------
const failed = r => r == null ? 'The tool returned nothing.' : (typeof r === 'object' && (r.error || r.ok === false)) ? str(r.error || 'The tool reported a failure.', 300) : '';
const clip = r => { let t; try { t = JSON.stringify(r); } catch (e) { t = String(r); } if (t == null) return null; return t.length > CLIP ? t.slice(0, CLIP) + '…[clipped]' : r; };
function withTimeout(p, ms) { let h; return Promise.race([p, new Promise((_, no) => { h = setTimeout(() => no(new Error('The step took longer than ' + Math.round(ms / 1000) + ' s.')), ms); })]).finally(() => clearTimeout(h)); }

async function execute(v, goal) {
  const st = {}, full = {}, t0 = Date.now(); let stopped = '';
  v.steps.forEach(s => { st[s.id] = { id: s.id, tool: s.tool, status: 'pending', attempts: 0, ms: 0 }; });
  const skip = (s, why) => { st[s.id].status = 'skipped'; st[s.id].reason = why; };
  async function runStep(s) {
    const rec = st[s.id], t = Date.now(); rec.status = 'running';
    let args;
    try { args = fill(s.args, full); } catch (e) { rec.status = 'failed'; rec.error = e.message; rec.ms = Date.now() - t; return; }
    const tries = s.onFail === 'retry' ? 1 + MAX_RETRY : 1;
    for (let k = 1; k <= tries; k++) {
      rec.attempts = k; let res, why = '';
      try { res = await withTimeout(Promise.resolve(host.run(s.tool, args)), STEP_MS); why = failed(res); } catch (e) { why = str(e && e.message || 'The step crashed.', 300); }
      if (!why) { rec.status = 'done'; full[s.id] = res; rec.result = clip(res); delete rec.error; break; }
      rec.error = why; rec.status = 'failed';
      if (k < tries && Date.now() - t0 < TOTAL_MS) await sleep(400 * k); else break;
    }
    rec.ms = Date.now() - t;
  }
  for (;;) {
    const pending = v.steps.filter(s => st[s.id].status === 'pending');
    if (!pending.length) break;
    if (stopped) { pending.forEach(s => skip(s, stopped)); break; }
    if (Date.now() - t0 > TOTAL_MS) { pending.forEach(s => skip(s, 'The plan ran out of time (' + TOTAL_MS / 1000 + ' s).')); break; }
    // a step whose prerequisite failed or was skipped never runs
    pending.forEach(s => { const bad = s.after.find(d => st[d].status === 'failed' || st[d].status === 'skipped'); if (bad) skip(s, 'It needs "' + bad + '", which did not finish.'); });
    const ready = v.steps.filter(s => st[s.id].status === 'pending' && s.after.every(d => st[d].status === 'done'));
    if (!ready.length) { v.steps.filter(s => st[s.id].status === 'pending').forEach(s => skip(s, 'Nothing could start it.')); break; }
    const safe = ready.filter(s => SAFE_PAR.test(s.tool)), batch = safe.length ? safe.slice(0, MAX_PAR) : [ready[0]];
    await Promise.all(batch.map(runStep));
    batch.forEach(s => { if (st[s.id].status === 'failed' && s.onFail !== 'skip') stopped = 'Stopped after "' + s.id + '" failed (on_fail ' + (s.onFail === 'retry' ? 'retry, tries used up' : 'stop') + ').'; });
  }
  const list = v.order.map(id => st[id]), n = k => list.filter(x => x.status === k).length;
  const out = { ok: n('failed') === 0 && n('skipped') === 0, goal: goal || undefined, done: n('done'), failed: n('failed'), skipped: n('skipped'), ms: Date.now() - t0, steps: list };
  LAST = { at: Date.now(), goal: goal || '', done: out.done, failed: out.failed, skipped: out.skipped, steps: list.length };
  return out;
}

// ---------- 4. the tool ----------
let running = false;
async function dispatch(name, args) {
  if (name !== 'run_plan') return { error: 'Unknown engine tool: ' + name };
  if (!host.run) return { error: 'The plan engine is not connected to the tools yet. Reload the app.' };
  if (running) return { error: 'A plan is already running. Wait for it to finish.' };
  const a = isObj(args) ? args : {}, v = validate(a);
  if (!v.ok) return { ok: false, error: 'The plan was rejected before anything ran. Fix it and send the whole plan again.', problems: v.errors };
  const goal = str(a.goal, 160);
  if (a.dry_run === true) return { ok: true, dry_run: true, goal: goal || undefined, order: v.order, levels: v.levels.map((l, i) => 'wave ' + (i + 1) + ': ' + l.join(', ')), note: 'Valid. Nothing was run.' };
  running = true;
  try { return await execute(v, goal); } finally { running = false; }
}
function stateBlock() {
  return LAST ? 'LAST PLAN (' + new Date(LAST.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '): ' + LAST.done + ' done, ' + LAST.failed + ' failed, ' + LAST.skipped + ' skipped of ' + LAST.steps + ' steps' + (LAST.goal ? ' (' + LAST.goal + ')' : '') + '.' : '';
}
window.EmberEngine = { TOOLS, dispatch, setHost, stateBlock, validate, _host: () => host, limits: { MAX_STEPS, MAX_PAR, MAX_RETRY, STEP_MS, TOTAL_MS } };
})();
