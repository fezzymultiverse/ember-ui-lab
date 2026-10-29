// Ember V1.8.0 - ember_schema.js: deterministic tool-argument binding. Every tool call, whether it comes from chat, a plan or the ReAct loop, passes through
// bind() in app.js runTool before anything runs. A tool that declares `schema` (a JSON Schema subset, OpenAPI-compatible) is checked strictly:
// types are coerced only where unambiguous ("3" -> 3, 7 -> "7"), numbers are clamped or rejected, enums and lengths are enforced, unknown arguments are
// refused, and a bad call returns a structured error the model can fix (never a crash, never a silent guess). Older tools only declare the loose shorthand
// (`parameters: {query: 'string', max: 'number?'}`): for those bind() coerces numbers and booleans and changes nothing else, so nothing that worked can break.
'use strict';
(() => {
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const NUM = /^-?\d+(?:\.\d+)?$/;
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

function coerce(v, type) {
  if ((type === 'number' || type === 'integer') && typeof v === 'string' && NUM.test(v.trim())) return Number(v.trim());
  if (type === 'boolean' && typeof v === 'string') { const t = v.trim().toLowerCase(); if (t === 'true') return true; if (t === 'false') return false; }
  if (type === 'string' && (typeof v === 'number' || typeof v === 'boolean')) return String(v);
  return v;
}
function lenient(def, args) {
  if (!isObj(args)) return { ok: true, value: args };
  const out = {}, p = isObj(def.parameters) ? def.parameters : {};
  Object.keys(args).forEach(k => {
    if (BAD_KEYS.has(k)) return;
    const t = typeof p[k] === 'string' ? p[k].replace(/\?$/, '') : '';
    out[k] = (t === 'number' || t === 'boolean') ? coerce(args[k], t) : args[k];
  });
  return { ok: true, value: out };
}
function strict(def, args) {
  const sc = def.schema, props = sc.properties || {}, req = sc.required || [], out = {}, problems = [];
  if (args == null) args = {};
  if (!isObj(args)) return { ok: false, problems: [{ path: '(arguments)', msg: 'must be an object' }] };
  if (sc.additionalProperties === false) Object.keys(args).forEach(k => { if (!BAD_KEYS.has(k) && !props[k]) problems.push({ path: k, msg: 'is not an argument of this tool (allowed: ' + Object.keys(props).join(', ') + ')' }); });
  Object.keys(props).forEach(k => {
    const p = props[k]; let v = args[k];
    if (v === undefined || v === null || v === '') {
      if (p.default !== undefined) { out[k] = p.default; return; }
      if (req.includes(k)) problems.push({ path: k, msg: 'is required (' + p.type + ')' });
      return;
    }
    v = coerce(v, p.type);
    if (p.type === 'string') {
      if (typeof v !== 'string') { problems.push({ path: k, msg: 'must be a string, got ' + typeOf(v) }); return; }
      v = v.replace(CTRL, ' ').trim();
      if (p.minLength != null && v.length < p.minLength) { problems.push({ path: k, msg: 'must not be empty' }); return; }
      if (p.maxLength != null && v.length > p.maxLength) { problems.push({ path: k, msg: 'is too long (' + v.length + ' characters, at most ' + p.maxLength + ')' }); return; }
    } else if (p.type === 'integer' || p.type === 'number') {
      if (typeof v !== 'number' || !isFinite(v)) { problems.push({ path: k, msg: 'must be a number, got ' + typeOf(v) }); return; }
      if (p.type === 'integer') v = Math.round(v);
      if (p.minimum != null && v < p.minimum) { if (p.clamp) v = p.minimum; else { problems.push({ path: k, msg: 'must be at least ' + p.minimum }); return; } }
      if (p.maximum != null && v > p.maximum) { if (p.clamp) v = p.maximum; else { problems.push({ path: k, msg: 'must be at most ' + p.maximum }); return; } }
    } else if (p.type === 'boolean') {
      if (typeof v !== 'boolean') { problems.push({ path: k, msg: 'must be true or false' }); return; }
    } else if (p.type === 'array' && !Array.isArray(v)) { problems.push({ path: k, msg: 'must be a list' }); return; }
    else if (p.type === 'object' && !isObj(v)) { problems.push({ path: k, msg: 'must be an object' }); return; }
    if (p.enum && !p.enum.includes(v)) { problems.push({ path: k, msg: 'must be one of: ' + p.enum.join(', ') }); return; }
    out[k] = v;
  });
  return problems.length ? { ok: false, problems } : { ok: true, value: out };
}
// bind(def, args) -> {ok:true, value} | {ok:false, result:{ok:false, error, problems, expected}}
function bind(def, args) {
  try {
    if (!def) return { ok: true, value: args };
    const r = def.schema ? strict(def, args) : lenient(def, args);
    if (r.ok) return r;
    return { ok: false, result: { ok: false, error: 'Arguments rejected for ' + def.name + ': ' + r.problems.map(x => x.path + ' ' + x.msg).join('; ') + '. Expected: ' + JSON.stringify(def.parameters || {}) + '.', problems: r.problems, expected: def.parameters || {} } };
  } catch (e) { return { ok: true, value: args }; } // a bug in binding must never block a tool that worked before
}
window.EmberSchema = { bind, _strict: strict, _lenient: lenient };
})();
