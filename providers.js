// Ember provider router - Groq, Mistral, Gemini, Cohere and Claude behind one door.
// Pulls keys out of pasted notes, health-checks every key, picks models from each provider's live model list (no hard-coded names that go stale),
// and fails over key to key and engine to engine so the chat keeps going when one is rate-limited.
'use strict';
(() => {
const { LS } = U;
const CFG = {
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', kind: 'oai', color: '#93c5fd', optIn: true },
  plugsky: { name: 'Plugsky AI', base: 'https://plugsky.com/v1', kind: 'oai', color: '#7dd3fc', optIn: true },
  stability: { name: 'Stability AI', base: 'https://api.stability.ai', kind: 'media', color: '#b4a3ff' },
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', kind: 'oai', color: '#ff6a00' },
  mistral: { name: 'Mistral', base: 'https://api.mistral.ai/v1', kind: 'oai', color: '#ffb020' },
  gemini: { name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', kind: 'gem', color: '#ffffff' },
  cohere: { name: 'Cohere', base: 'https://api.cohere.com', kind: 'cohere', color: '#d9d9d9' },
  // V1.9.72: Claude (Anthropic Messages API). PAID, so it is never in the automatic order: it answers only while it is pinned (Providers chip).
  anthropic: { name: 'Claude', base: 'https://api.anthropic.com/v1', kind: 'claude', color: '#d97757' }
};
const IDS = Object.keys(CFG);
// Automatic profile for this installation. Mistral stays active because it is working for him.
const ACTIVE_IDS = IDS.filter(id => CFG[id].kind !== 'media');
// fast = quick everyday replies. deep = slow, careful turns. util = background jobs (memory, titles).
const ORDER = { fast: ['groq', 'cohere', 'gemini', 'mistral'], deep: ['gemini', 'cohere', 'mistral', 'groq'], util: ['groq', 'cohere', 'gemini', 'mistral'] };

// V1.5.6: pasted keys often carry invisible junk (zero-width chars, quotes, "Bearer ", "key=", a trailing comma). Any of it makes
// the provider answer 401/403 even though the key itself is fine, so every key is cleaned before it is stored or sent.
function clean(k) {
  let t = String(k == null ? '' : k);
  t = t.replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(authorization\s*:\s*)?bearer\s+/i, '').replace(/^(x-goog-api-key|api[_-]?key|key)\s*[:=]\s*/i, '');
  t = t.replace(/^[\s"'`<([]+|[\s"'`>)\],;]+$/g, '').trim();
  return t.replace(/\s+/g, '');
}
function load() {
  const k = LS.get('ember_keys', {}), o = {};
  // V1.11.0: Puter is gone. Any Puter token saved by an older build is erased here, once, so no credential for a removed service stays on the phone.
  if (k && Object.prototype.hasOwnProperty.call(k, 'puter')) { delete k.puter; LS.set('ember_keys', k); }
  if (LS.get('ember_puter_on', null) !== null) LS.del('ember_puter_on');
  if (LS.get('ember_pin', null) === 'puter') LS.del('ember_pin');
  const pm = LS.get('ember_pin_model', null); if (pm && pm.id === 'puter') LS.del('ember_pin_model');
  const lg = LS.get('ember_last_good', null); if (lg === 'puter') LS.del('ember_last_good');
  IDS.forEach(id => { o[id] = (Array.isArray(k[id]) ? k[id] : []).filter(e => e && typeof e.key === 'string' && e.key).map(e => { e.key = clean(e.key); return e; }).filter(e => e.key); });
  return o;
}
let keys = load();
let freePref = null; // null = auto (Free Mode on only while the user has no keys); true/false = the user's own choice
// V1.6.1: engine pin. null/'auto' = router decides (Groq first in fast/util since it's near-instant). Any CFG id = try that engine's keys first, every lane.
let pinnedEngine = LS.get('ember_pin', null); if (pinnedEngine && !CFG[pinnedEngine]) pinnedEngine = null;
function setPinned(id) { pinnedEngine = (id && CFG[id] && CFG[id].kind !== 'media') ? id : null; LS.set('ember_pin', pinnedEngine); }
// V1.6.8: model pin. {id, model} or null. Strict: when set, that engine only ever uses that exact model (no silent swap to another one).
let pinnedModel = LS.get('ember_pin_model', null);
if (pinnedModel && !(pinnedModel.id && pinnedModel.model && CFG[pinnedModel.id])) pinnedModel = null;
function setPinnedModel(id, model) { pinnedModel = (id && CFG[id] && model) ? { id, model: String(model) } : null; LS.set('ember_pin_model', pinnedModel); }
// V1.9.15: strict pin. With an engine pinned, a failure is shown plainly (real reason) instead of silently answering from another engine.
// That silent swap, always landing on Groq first in the default order, is what kept pushing him back to Groq. Background jobs (util) still fail over.
let strictPin = LS.get('ember_pin_strict', true) !== false;
function setStrict(v) { strictPin = !!v; LS.set('ember_pin_strict', strictPin); }
const onlyPinned = lane => !!(strictPin && pinnedEngine && lane != 'util');
function orderFor(lane) { const enabled = LS.get('ember_route_enabled', {}); const base = (ORDER[lane] || ORDER.fast).concat(['openrouter', 'plugsky'].filter(id => enabled[id] === true)).filter(id => CFG[id].kind !== 'media'); if (!pinnedEngine) { // V1.9.78: stay on the engine that last answered (fast lane) instead of restarting at the top of the list every message
    const lg = lane == 'fast' ? LS.get('ember_last_good', null) : null;
    if (lg && base.includes(lg) && keys[lg] && keys[lg].some(e => !e.bad)) return [lg].concat(base.filter(x => x != lg));
    return base; } return [pinnedEngine].concat(base.filter(id => id != pinnedEngine)); }
const save = () => { LS.set('ember_keys', keys); emitStats(); };
const cool = new Map(); // credential-wide failures only; model failures are independent
const modelCool = new Map(), cursors = new Map();
let metrics = LS.get('ember_route_metrics', {});
function emitStats() { try { window.dispatchEvent(new CustomEvent('ember-provider-stats', { detail: { at: Date.now() } })); } catch (_) {} }
const slot = (id, key, model) => JSON.stringify([id, key, model]);
function modelRest(id, key, model, seconds) { modelCool.set(slot(id,key,model), Date.now() + Math.max(1, Number(seconds) || 60) * 1000); emitStats(); }
function modelResting(id, key, model) { return (modelCool.get(slot(id,key,model)) || 0) > Date.now(); }
function record(id, model, ok, ms, status, usage) {
  const p = metrics[id] || (metrics[id] = { requests: 0, success: 0, failed: 0, models: {} });
  const m = p.models[model] || (p.models[model] = { requests: 0, success: 0, failed: 0 });
  for (const obj of [p,m]) { obj.requests++; obj[ok ? 'success' : 'failed']++; obj.lastAt = Date.now(); obj.lastStatus = status || 0; if (ok) obj.latency = ms || 0; }
  if (usage) { m.tokens = (m.tokens || 0) + (Number(usage.total_tokens) || 0); p.tokens = (p.tokens || 0) + (Number(usage.total_tokens) || 0); }
  LS.set('ember_route_metrics', metrics); emitStats();
}
function rotation(id, lane) {
  const list = keys[id] || [], k = id + ':' + lane, at = cursors.get(k) || 0;
  if (!list.length) return [];
  cursors.set(k, (at + 1) % list.length); return list.slice(at).concat(list.slice(0,at));
}
// V1.10.3: read-only look at the key cursor for the "next up" dot. It never advances the cursor.
function peek(id, lane) { const n = (keys[id] || []).length; return { n, at: n ? (cursors.get(id + ':' + lane) || 0) % n : 0 }; }
function stats() {
  const out = JSON.parse(JSON.stringify(metrics));
  IDS.forEach(id => { const p = out[id] || (out[id] = { requests:0, success:0, failed:0, models:{} }); p.cooldowns = [];
    for (const e of keys[id]) for (const [k,until] of modelCool) { const [pid,key,model] = JSON.parse(k); if (pid === id && key === e.key && until > Date.now()) p.cooldowns.push({ key:mask(key), model, retry:Math.ceil((until-Date.now())/1000) }); }
  }); return out;
}
function setEnabled(id, on) { if (!CFG[id] || CFG[id].kind === 'media') return; const cfg=LS.get('ember_route_enabled',{}); cfg[id]=!!on; LS.set('ember_route_enabled',cfg); emitStats(); }
function authFailure(er) { return Number(er.status) === 401 || (Number(er.status) === 403 && /invalid.{0,15}(key|token)|revoked|authentication_error|unauthenticated/i.test(er.message || '')); }

const activeControllers = new Set(), activeReaders = new Set(); let routeCancelled = false;
const isCool = k => (cool.get(k) || 0) > Date.now();
const coolKey = (key, seconds) => cool.set(key, Date.now() + Math.max(1, Number(seconds) || 60) * 1000);
// Transient provider failures should advance to another model/key/engine, not terminate the whole route.
const transient = er => !er || !er.status || [408, 409, 425, 500, 502, 503, 504, 522, 524, 529].includes(Number(er.status));
const mask = k => k.length > 12 ? k.slice(0, 6) + '…' + k.slice(-4) : k.slice(0, 3) + '…';
const has = k => IDS.some(id => keys[id].some(e => e.key === k));

// ---------- network: normal fetch, native HTTP as the fallback inside the APK ----------
async function net(url, opt, timeout) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout || 30000); activeControllers.add(ac);
  try {
    try { return await fetch(url, Object.assign({}, opt, { signal: ac.signal })); }
    catch (e) {
      if (e && e.name === 'AbortError') throw Object.assign(new Error(routeCancelled ? 'Stopped by user.' : 'timed out'), { status: 0, code: routeCancelled ? 'cancelled' : 'timeout' });
      const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
      if (!H || !H.request) throw Object.assign(new Error('network error or blocked by the browser'), { status: 0 });
      const r = await H.request({ url, method: (opt && opt.method) || 'GET', headers: (opt && opt.headers) || {}, data: opt && opt.body ? JSON.parse(opt.body) : undefined, connectTimeout: timeout || 30000, readTimeout: timeout || 30000 });
      const hd = r.headers || {};
      return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: k => hd[k] || hd[k.toLowerCase()] || null }, text: async () => typeof r.data === 'string' ? r.data : JSON.stringify(r.data), json: async () => typeof r.data === 'string' ? JSON.parse(r.data) : r.data };
    }
  } finally { clearTimeout(t); activeControllers.delete(ac); }
}
async function jfetch(url, opt, timeout) {
  const r = await net(url, opt, timeout);
  if (!r.ok) {
    let body = ''; try { body = await r.text(); } catch (e) {}
    let msg = '', parsed = null; try { parsed = JSON.parse(body); if (parsed && typeof parsed == 'object') msg = (parsed.error && (parsed.error.message || parsed.error)) || parsed.message || ''; } catch (e) {}
    // Providers send Retry-After as seconds or an HTTP date; some return retry_after in JSON.
    const retryHeader = r.headers && r.headers.get && (r.headers.get('retry-after') || r.headers.get('Retry-After'));
    let retryAfter = Number(retryHeader) || 0;
    if (retryHeader && !retryAfter) { const at = Date.parse(retryHeader); if (Number.isFinite(at)) retryAfter = Math.max(0, Math.ceil((at - Date.now()) / 1000)); }
    if (!retryAfter && parsed) retryAfter = Number(parsed.retry_after || parsed.retryAfter || (parsed.error && (parsed.error.retry_after || parsed.error.retryAfter)) || (parsed.meta && parsed.meta.retry_after)) || 0;
    retryAfter = Math.max(0, retryAfter);
    throw Object.assign(new Error(String(msg || body || ('HTTP ' + r.status)).slice(0, 200)), { status: r.status, retryAfter, metadata: parsed && parsed.error && parsed.error.metadata });
  }
  return r.json();
}

// ---------- Gemini auth ----------
// Google now issues keys that start with AQ. (AI Studio no longer makes AIza keys). Normal accounts send them in the
// x-goog-api-key header like before. A few accounts get 401/403 on that route, so a rejected call is retried once with the
// key as a ?key= query parameter before the key is declared bad. The real reason Google gave is kept and a plain-English hint added.
const isAQ = k => /^AQ\./.test(String(k || ''));
function gemHint(er, key) {
  const m = String(er && er.message || '');
  if (er.status == 401 && /ACCESS_TOKEN_TYPE_UNSUPPORTED|OAuth 2 access token/i.test(m)) return ' Google rejected this ' + (isAQ(key) ? 'AQ. ' : '') + 'key type for the REST API. Make an AIza key in Google Cloud Console (APIs & Services > Credentials) with the Generative Language API enabled and add that one.';
  if (er.status == 403 && /not been used|disabled|enable/i.test(m)) return ' Turn on the Generative Language API for this key\'s project in Google Cloud Console.';
  if (er.status == 403) return ' The key may be restricted (app / API restriction) or the Generative Language API is off for its project.';
  if (er.status == 400 && /API key not valid/i.test(m)) return ' Google says the key text is not valid: re-copy it without spaces or quotes.';
  if (er.status == 401) return ' Google did not accept the key: re-copy it, or make a fresh one in AI Studio.';
  return '';
}
async function gemFetch(url, key, opt, timeout) {
  opt = Object.assign({}, opt); opt.headers = Object.assign({}, opt.headers, { 'x-goog-api-key': key });
  try { return await jfetch(url, opt, timeout); }
  catch (er) {
    if (er.status != 401 && er.status != 403) throw er;
    let er2 = er;
    try {
      const o2 = Object.assign({}, opt); o2.headers = Object.assign({}, opt.headers); delete o2.headers['x-goog-api-key'];
      return await jfetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(key), o2, timeout);
    } catch (e2) { er2 = e2; if (e2.status != 401 && e2.status != 403) throw e2; }
    const h = gemHint(er2, key);
    throw Object.assign(new Error(String(er2.message || 'rejected').slice(0, 160) + h), { status: er2.status, retryAfter: er2.retryAfter });
  }
}

// ---------- Claude (Anthropic) ----------
// The header below is what lets a browser or WebView call the API directly (CORS). The key stays on this phone.
const claudeHeaders = key => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' });
const vkey = m => (String(m).match(/\d+/g) || []).slice(0, 2).map(Number);
const vcmp = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < 2; i++) { const d = (y[i] || 0) - (x[i] || 0); if (d) return d; } return a.length - b.length; };
function claudeMsgs(messages) { // the Messages API wants alternating user/assistant turns that start with a user turn
  const out = [];
  (messages || []).forEach(m => { const role = m.role == 'assistant' ? 'assistant' : 'user', t = String(m.content == null ? '' : m.content); if (!t.trim()) return; const last = out[out.length - 1]; if (last && last.role == role) last.content += '\n\n' + t; else out.push({ role, content: t }); });
  if (!out.length || out[0].role != 'user') out.unshift({ role: 'user', content: '(continue)' });
  return out;
}
async function readPart(reader,ms) { let timer;try{return await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Object.assign(new Error('Stream stalled'),{status:408}));try{reader.cancel();}catch(_){}},ms||40000);})]);}finally{clearTimeout(timer);} }
async function streamClaude(url, body, key, o, timeout) {
  body.stream = true;
  const r = await net(url, { method: 'POST', headers: Object.assign({ Accept: 'text/event-stream' }, claudeHeaders(key)), body: JSON.stringify(body) }, timeout || 60000);
  if (!r.ok) {
    let raw = ''; try { raw = await r.text(); } catch (_) {}
    let msg = ''; try { const p = JSON.parse(raw); msg = (p.error && (p.error.message || p.error)) || p.message || ''; } catch (_) {}
    const h = r.headers && r.headers.get && r.headers.get('retry-after'); const retryAfter = Math.max(0, Math.min(900, Number(h) || 0));
    throw Object.assign(new Error(String(msg || raw || ('HTTP ' + r.status)).slice(0, 200)), { status: r.status, retryAfter, metadata: parsed && parsed.error && parsed.error.metadata });
  }
  if (!r.body || !r.body.getReader) { const j = await r.json(); return (j.content || []).map(p => p.text || '').join(''); }
  const reader = r.body.getReader(), decoder = new TextDecoder(); activeReaders.add(reader); let buffer = '', out = '';
  const consume = line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim(); if (!data) return;
    let p; try { p = JSON.parse(data); } catch (_) { return; }
    if (p.type == 'error') throw Object.assign(new Error(String(p.error && p.error.message || 'stream error').slice(0, 200)), { status: p.error && p.error.type == 'overloaded_error' ? 529 : 0 });
    const piece = p.type == 'content_block_delta' && p.delta && p.delta.type == 'text_delta' ? p.delta.text : '';
    if (piece) { out += piece; if (typeof o.onToken == 'function') { try { o.onToken(piece, out); } catch (_) {} } }
  };
  try {
    while (true) {
      if (routeCancelled) throw Object.assign(new Error('Stopped by user.'), { code: 'cancelled' });
      const part = await readPart(reader,timeout||40000); if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      lines.forEach(consume);
    }
    consume(buffer.trim());
  } finally { activeReaders.delete(reader); try { reader.releaseLock(); } catch (_) {} }
  if (routeCancelled) throw Object.assign(new Error('Stopped by user.'), { code: 'cancelled' });
  return out;
}

// ---------- models ----------
async function listModels(id, key) {
  const c = CFG[id];
  if (c.kind === 'media') { await jfetch(c.base + '/v1/user/account', { headers: { Authorization: 'Bearer ' + key } }, 15000); return []; }
  if (c.kind == 'oai') {
    const j = await jfetch(c.base + '/models', { headers: { Authorization: 'Bearer ' + key } }, 15000);
    return (j.data || []).map(m => m.id).filter(Boolean);
  }
  if (c.kind == 'claude') {
    const j = await jfetch(c.base + '/models?limit=100', { headers: claudeHeaders(key) }, 15000);
    return (j.data || []).map(m => m.id).filter(Boolean);
  }
  if (c.kind == 'cohere') {
    const j = await jfetch(c.base + '/v1/models?endpoint=chat&page_size=100', { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } }, 15000);
    return (j.models || []).map(m => m.name).filter(Boolean);
  }
  const j = await gemFetch(c.base + '/models?pageSize=200', key, {}, 15000);
  return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name).replace(/^models\//, ''));
}
const ver = m => { const x = /(\d+(?:\.\d+)?)/.exec(m); return x ? parseFloat(x[1]) : 0; };
function rank(id, list, lane) {
  if (id === 'stability') return [];
  if (id === 'openrouter' || id === 'plugsky') return list.filter(m => !/embed|rerank|whisper|tts|audio|video|flux|stable-diffusion|imagen|veo|sora|moderation/i.test(m)).sort((a,b) => Number(/:free$|^plugsky-(micro|lite)$/.test(b)) - Number(/:free$|^plugsky-(micro|lite)$/.test(a)));
  const deep = lane == 'deep';
  if (id == 'groq') {
    const ok = list.filter(m => !/whisper|guard|tts|embed|playai|distil/i.test(m));
    const pref = [/llama-3\.3-70b/, /llama.*70b/, /llama-4/, /llama/, /gpt-oss/, /qwen/];
    const out = []; pref.forEach(p => ok.filter(m => p.test(m)).forEach(m => { if (!out.includes(m)) out.push(m); }));
    ok.forEach(m => { if (!out.includes(m)) out.push(m); });
    return out;
  }
  if (id == 'mistral') {
    const ok = list.filter(m => !/embed|moderation|ocr|codestral|voxtral|pixtral|devstral|ministral/i.test(m));
    const pref = deep ? [/large-latest/, /medium-latest/, /small-latest/, /large/, /medium/, /small/] : [/small-latest/, /medium-latest/, /large-latest/, /small/, /medium/, /large/];
    const out = []; pref.forEach(p => ok.filter(m => p.test(m)).forEach(m => { if (!out.includes(m)) out.push(m); }));
    ok.forEach(m => { if (!out.includes(m)) out.push(m); });
    return out;
  }
  if (id == 'cohere') {
    const ok = list.filter(m => !/embed|rerank|vision|audio|translate|nightly/i.test(m));
    const pref = deep ? [/command-a-0/, /command-r-plus/, /command-a/, /command-r/] : [/command-r7b/, /command-r-08/, /command-a-0/, /command-r/, /command/];
    const out = []; pref.forEach(p => ok.filter(m => p.test(m)).forEach(m => { if (!out.includes(m)) out.push(m); }));
    ok.forEach(m => { if (!out.includes(m)) out.push(m); });
    return out;
  }
  if (id == 'anthropic') {
    const ok = list.filter(m => /^claude-/.test(m));
    const pref = deep ? [/opus/, /sonnet/, /haiku/] : [/haiku/, /sonnet/, /opus/];
    const out = []; pref.forEach(p => ok.filter(m => p.test(m)).sort(vcmp).forEach(m => { if (!out.includes(m)) out.push(m); }));
    ok.forEach(m => { if (!out.includes(m)) out.push(m); });
    return out;
  }
  const bad = /lite|image|tts|embed|live|audio|native|robotics|computer|imagen|veo|gemma|aqa|learnlm|vision|nano/i;
  let c = list.filter(m => /^gemini-/.test(m) && !bad.test(m));
  const want = deep ? 'pro' : 'flash';
  const w = c.filter(m => m.includes(want));
  const rest = c.filter(m => !m.includes(want));
  const srt = a => a.sort((x, y) => ver(y) - ver(x) || (/preview|exp/.test(x) ? 1 : 0) - (/preview|exp/.test(y) ? 1 : 0) || x.length - y.length);
  return srt(w).concat(srt(rest));
}
const MC = 12 * 3600 * 1000;
async function modelsFor(id, key, lane) {
  const cache = LS.get('ember_models', {});
  if (cache[id] && Date.now() - cache[id].at < MC && cache[id].list.length) return rank(id, cache[id].list, lane);
  const list = await listModels(id, key);
  cache[id] = { at: Date.now(), list }; LS.set('ember_models', cache);
  return rank(id, list, lane);
}

// ---------- one call ----------
// ---------- V1.9.27: native function calling ----------
// o.tools = [{name, description, parameters (loose shorthand like {query:'string', n:'number?'}) or schema (JSON Schema subset)}].
// The engine's own tool API is used (OpenAI-style tools for Groq/Mistral, v2 tools for Cohere, functionDeclarations for Gemini).
// A native call comes back as the same <tool_call>{"tool","args"}</tool_call> text the app already runs, so everything after the engine is unchanged,
// and a model that writes the tag itself still works. If the engine rejects the tools (400/422) the call is repeated once without them.
const SCH_KEEP = ['type', 'description', 'enum', 'properties', 'items', 'required', 'minimum', 'maximum'];
function cleanSchema(sc, up) {
  if (!sc || typeof sc != 'object' || Array.isArray(sc)) return { type: up ? 'STRING' : 'string' };
  const out = {};
  SCH_KEEP.forEach(k => { if (sc[k] !== undefined) out[k] = sc[k]; });
  if (Array.isArray(out.type)) out.type = out.type.find(t => t != 'null') || 'string';
  if (!out.type) out.type = out.properties ? 'object' : out.items ? 'array' : 'string';
  out.type = up ? String(out.type).toUpperCase() : String(out.type).toLowerCase();
  if (out.properties) { const pr = {}; Object.keys(out.properties).forEach(k => { pr[k] = cleanSchema(out.properties[k], up); }); out.properties = pr; }
  if (out.items) out.items = cleanSchema(out.items, up);
  if (out.required && !Array.isArray(out.required)) delete out.required;
  if (Array.isArray(out.required) && !out.required.length) delete out.required;
  if (out.enum && !Array.isArray(out.enum)) delete out.enum;
  return out;
}
function shorthandSchema(params) {
  const props = {}, req = [];
  Object.keys(params || {}).forEach(k => {
    const raw = String(params[k] == null ? '' : params[k]), m = /^\s*"?([a-z]+)"?(\?)?/i.exec(raw), ty = m ? m[1].toLowerCase() : 'string';
    const type = ['string', 'number', 'integer', 'boolean', 'array', 'object'].includes(ty) ? ty : 'string';
    props[k] = /^\s*"?[a-z]+"?\[\]/i.test(raw) ? { type: 'array', items: { type: type == 'array' ? 'string' : type }, description: raw.slice(0, 300) } : { type, description: raw.slice(0, 300) };
    if (!(m && m[2]) && !/\?/.test(raw.split(/[ (]/)[0])) req.push(k);
  });
  return { type: 'object', properties: props, required: req };
}
function toolDecls(tools, up) {
  const seen = new Set(), out = [];
  (tools || []).forEach(t => {
    if (!t || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(t.name || '') || seen.has(t.name)) return; seen.add(t.name);
    let sc = (t.schema && typeof t.schema == 'object') ? t.schema : shorthandSchema(t.parameters);
    sc = cleanSchema(sc, up); if (!sc.properties) sc.properties = {};
    if (up && !Object.keys(sc.properties).length) delete sc.properties; // Gemini rejects an empty properties object
    out.push({ name: t.name, description: String(t.description || t.name).slice(0, 1000), parameters: sc });
  });
  return out;
}
const tagOf = (tool, args) => '<tool_call>' + JSON.stringify({ tool, args: (args && typeof args == 'object' && !Array.isArray(args)) ? args : {} }) + '</tool_call>';
function joinCall(text, tool, args) { return (String(text || '').trim() ? String(text).trim() + '\n' : '') + tagOf(tool, args); }
function oaiNative(j) { // first tool call of an OpenAI-style answer, or null
  const m = j && j.choices && j.choices[0] && j.choices[0].message, tc = m && Array.isArray(m.tool_calls) && m.tool_calls[0], f = tc && tc.function; if (!f || !f.name) return null;
  let args = f.arguments; if (typeof args == 'string') { try { args = JSON.parse(args || '{}'); } catch (e) { args = {}; } }
  return { tool: f.name, args };
}
async function streamOAI(url, key, body, o, timeout) {
  body.stream = true;
  const r = await net(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, Accept: 'text/event-stream' }, body: JSON.stringify(body) }, timeout || 40000);
  if (!r.ok) {
    let raw = ''; try { raw = await r.text(); } catch (_) {}
        let parsed = null, msg = ''; try { parsed = JSON.parse(raw); if (parsed && typeof parsed == 'object') msg = (parsed.error && (parsed.error.message || parsed.error)) || parsed.message || ''; } catch (_) {}
    const h = r.headers && r.headers.get && r.headers.get('retry-after'); let retryAfter = Number(h) || 0;
    if (h && !retryAfter) { const at = Date.parse(h); if (Number.isFinite(at)) retryAfter = Math.max(0, Math.ceil((at-Date.now())/1000)); }
    throw Object.assign(new Error(String(msg || raw || ('HTTP '+r.status)).slice(0,200)), {status:r.status,retryAfter,metadata:parsed && parsed.error && parsed.error.metadata});
  }
  if (!r.body || !r.body.getReader) { const j = await r.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; }
  const reader = r.body.getReader(), decoder = new TextDecoder(); activeReaders.add(reader); let buffer = '', out = '';
  const consume = line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim(); if (!data || data === '[DONE]') return;
    let packet; try { packet = JSON.parse(data); } catch (_) { return; }
    if (packet.usage) o._usage = packet.usage;
    const choice = packet.choices && packet.choices[0], delta = choice && choice.delta;
    if (packet.error || (choice && choice.finish_reason === 'error')) { const e = packet.error || {}; throw Object.assign(new Error(String(e.message || 'Provider stream failed')), { status: Number(e.code || e.status) || 502, partial: !!out }); }
    const rs = delta && (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : typeof delta.reasoning === 'string' ? delta.reasoning : ''); // V1.9.78: the model's own reasoning, when the engine sends it, goes to the thinking card live
    if (rs) { o._th = (o._th || '') + rs; try { window.dispatchEvent(new CustomEvent('ember-thought', { detail: { piece: rs, text: o._th } })); } catch (_) { /* no listener */ } }
    const piece = delta && typeof delta.content === 'string' ? delta.content : '';
    if (piece) { out += piece; if (typeof o.onToken === 'function') { try { o.onToken(piece, out); } catch (_) {} } }
  };
  try {
    while (true) {
      if (routeCancelled) throw Object.assign(new Error('Stopped by user.'), {code:'cancelled'});
      const part = await readPart(reader,timeout||40000); if (part.done) break;
      buffer += decoder.decode(part.value, {stream:true});
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      lines.forEach(consume);
    }
    consume(buffer.trim());
  } finally { activeReaders.delete(reader); try { reader.releaseLock(); } catch (_) {} }
  if (routeCancelled) throw Object.assign(new Error('Stopped by user.'), {code:'cancelled'});
  return out;
}
async function call(id, key, model, o) {
  const c = CFG[id], t0 = performance.now();
  let text = '';
  if (c.kind == 'oai') {
    const body = { model, messages: [{ role: 'system', content: o.system }].concat(o.messages), temperature: o.temp == null ? 0.8 : o.temp, max_tokens: o.max || 400 };
    if (o.json) body.response_format = { type: 'json_object' };
    const decl = (!o.json && o.tools && o.tools.length) ? toolDecls(o.tools, false) : [];
    if (decl.length) { body.tools = decl.map(f => ({ type: 'function', function: f })); body.tool_choice = 'auto'; }
    let j;
    if (typeof o.onToken === 'function' && !decl.length && !o.json) {
      try { text = await streamOAI(c.base + '/chat/completions', key, body, o, 40000); }
      catch (er) { if (er.code === 'cancelled') throw er; if (decl.length && (er.status == 400 || er.status == 422)) return call(id, key, model, Object.assign({}, o, { tools: null })); throw er; }
    } else {
      try { j = await jfetch(c.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) }, 40000); }
      catch (er) { if (er.code === 'cancelled') throw er; if (decl.length && (er.status == 400 || er.status == 422)) return call(id, key, model, Object.assign({}, o, { tools: null })); throw er; }
      o._usage = j.usage || null;
      text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '';
      const nc = decl.length ? oaiNative(j) : null; if (nc) text = joinCall(text, nc.tool, nc.args);
    }
  } else if (c.kind == 'claude') {
    const decl = (!o.json && o.tools && o.tools.length) ? toolDecls(o.tools, false) : [];
    const body = { model, system: String(o.system || '') + (o.json ? '\n\nReply with one valid JSON object and nothing else.' : ''), messages: claudeMsgs(o.messages), max_tokens: Math.max(64, o.max || 400) };
    if (o.temp != null || !o.json) body.temperature = Math.max(0, Math.min(1, o.temp == null ? 0.8 : o.temp));
    if (decl.length) body.tools = decl.map(f => ({ name: f.name, description: f.description, input_schema: f.parameters }));
    const retry = er => {
      if (er.code === 'cancelled') throw er;
      if (decl.length && (er.status == 400 || er.status == 422)) return call(id, key, model, Object.assign({}, o, { tools: null }));
      if (er.status == 400 && /temperature/i.test(er.message) && body.temperature !== undefined) { delete body.temperature; return null; }
      throw er;
    };
    for (let pass = 0; pass < 2 && !text; pass++) {
      try {
        if (typeof o.onToken == 'function' && !decl.length && !o.json) { text = await streamClaude(c.base + '/messages', body, key, o, 60000); }
        else {
          const j = await jfetch(c.base + '/messages', { method: 'POST', headers: claudeHeaders(key), body: JSON.stringify(body) }, 60000);
          const blocks = Array.isArray(j.content) ? j.content : [];
          text = blocks.filter(p => p.type == 'text').map(p => p.text || '').join('');
          const tu = decl.length && blocks.find(p => p.type == 'tool_use' && p.name); if (tu) text = joinCall(text, tu.name, tu.input);
        }
      } catch (er) { const again = retry(er); if (again) return again; }
    }
  } else if (c.kind == 'cohere') {
    const body = { model, messages: [{ role: 'system', content: o.system }].concat(o.messages), temperature: o.temp == null ? 0.8 : o.temp, max_tokens: o.max || 400 };
    if (o.json) body.response_format = { type: 'json_object' };
    const decl = (!o.json && o.tools && o.tools.length) ? toolDecls(o.tools, false) : [];
    if (decl.length) body.tools = decl.map(f => ({ type: 'function', function: f }));
    let j;
    try { j = await jfetch(c.base + '/v2/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) }, 40000); }
    catch (er) { if (decl.length && (er.status == 400 || er.status == 422)) return call(id, key, model, Object.assign({}, o, { tools: null })); throw er; }
    text = j.message && Array.isArray(j.message.content) ? j.message.content.map(p => p.text || '').join('') : '';
    const tc = decl.length && j.message && Array.isArray(j.message.tool_calls) && j.message.tool_calls[0], tf = tc && tc.function;
    if (tf && tf.name) { let ar = tf.arguments; if (typeof ar == 'string') { try { ar = JSON.parse(ar || '{}'); } catch (e) { ar = {}; } } text = joinCall(text, tf.name, ar); }
  } else {
    const contents = [];
    o.messages.forEach(m => {
      const role = m.role == 'assistant' ? 'model' : 'user', last = contents[contents.length - 1];
      if (last && last.role == role) last.parts[0].text += '\n\n' + m.content; else contents.push({ role, parts: [{ text: m.content }] });
    });
    const gc = { temperature: o.temp == null ? 0.8 : o.temp, maxOutputTokens: (o.max || 400) * 4 }; // headroom: some Gemini models spend output tokens on thinking
    if (o.json) gc.responseMimeType = 'application/json';
    const decl = (!o.json && o.tools && o.tools.length) ? toolDecls(o.tools, true) : [];
    const gbody = { systemInstruction: { parts: [{ text: o.system }] }, contents, generationConfig: gc };
    if (decl.length) { gbody.tools = [{ functionDeclarations: decl }]; gbody.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }; }
    let j;
    try { j = await gemFetch(c.base + '/models/' + model + ':generateContent', key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gbody) }, 60000); }
    catch (er) { if (decl.length && (er.status == 400 || er.status == 422)) return call(id, key, model, Object.assign({}, o, { tools: null })); throw er; }
    const cand = j.candidates && j.candidates[0], parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
    text = parts.map(p => p.text || '').join('');
    const fc = decl.length && parts.find(p => p.functionCall && p.functionCall.name); if (fc) text = joinCall(text, fc.functionCall.name, fc.functionCall.args);
  }
  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('empty reply (blocked or cut off)'), { status: 0 });
  return { text, ms: Math.round(performance.now() - t0), usage:o._usage || null };
}

// ---------- key bookkeeping ----------
const entries = id => keys[id];
const hasKeys = () => ACTIVE_IDS.some(id => keys[id].length > 0);
async function health(id, e) {
  const t0 = performance.now(), st = { at: Date.now(), ok: false, limited: false, ms: 0, model: '', code: 0, msg: '' };
  try {
    const list = await listModels(id, e.key);
    const cache = LS.get('ember_models', {}); cache[id] = { at: Date.now(), list }; LS.set('ember_models', cache);
    const cands = rank(id, list, 'fast');
    if (CFG[id].kind === 'media') { st.ok = true; st.msg = 'Account authenticated; image and audio features available'; }
    else if (!cands.length) throw Object.assign(new Error('key works but no chat model is available on it'), { status: 0 });
    st.model = cands[0] || ''; st.ok = true; st.msg = st.msg || 'Model list accessible; generation not yet tested';
  } catch (er) {
    st.code = er.status || 0;
    if (er.status == 429) { st.ok = true; st.limited = true; st.msg = 'rate limited right now (key is valid)'; }
    else if (er.status == 401 || er.status == 403) st.msg = 'key rejected (' + er.status + '): ' + String(er.message || '').slice(0, 170);
    else st.msg = String(er.message || 'failed').slice(0, 120);
  }
  st.ms = Math.round(performance.now() - t0); e.st = st; e.bad = !st.ok && st.code == 401;
  if (isCool(e.key)) st.limited = true;
  save(); return st;
}
async function healthAll() { for (const id of IDS) for (const e of keys[id]) await health(id, e); }
async function addKey(id, key) {
  key = clean(key);
  if (!key || !keys[id]) return { ok: false, why: 'empty' };
  if (keys[id].some(e => e.key === key)) return { ok: false, why: 'already added' };
  const e = { key, st: null }; keys[id].push(e); save(); await health(id, e); return { ok: true, e };
}
function removeKey(id, key) { keys[id] = keys[id].filter(e => e.key !== key); cool.delete(key); save(); }

// ---------- pull keys out of messy notes ----------
// V1.9.14: the finder lives in ember_keyscan.js (one for every paste box). extract() keeps its old shape so callers and tests keep working.
const KS = () => window.EmberKeyScan;
function extract(text, pre) {
  const out = Object.fromEntries(IDS.concat(['unknown','unknownCohere']).map(id => [id,[]]));
  const ks = KS(); if (!ks) return out;
  const sc = pre || ks.scan(text);
  for (const id of IDS) out[id] = (sc.keys[id] || []).slice();
  out.unknown = (sc.probes && sc.probes.mistral || []).slice();
  out.unknownCohere = (sc.probes && sc.probes.cohere || []).slice();
  return out;
}
async function ingest(text, pre) {
  const f = extract(text, pre);
  const rep = { found: Object.assign(Object.fromEntries(IDS.map(id => [id,f[id].length])), { unknown: f.unknown.length + f.unknownCohere.length }), added: [], dupes: 0, rejected: 0, rejectedBy: { mistral: 0, cohere: 0 } };
  for (const id of IDS) for (const k of f[id]) {
    const r = await addKey(id, k);
    if (!r.ok) { rep.dupes++; continue; }
    rep.added.push({ id, key: k, ok: !!(r.e.st && r.e.st.ok), guess: false });
  }
  // unlabelled 32 / 40 character strings: only a live test can say whose they are (a rejected one is never saved)
  for (const [list, id] of [[f.unknown, 'mistral'], [f.unknownCohere, 'cohere']]) for (const k of list) {
    if (has(k)) { rep.dupes++; continue; }
    try { await listModels(id, k); } catch (er) { rep.rejected++; rep.rejectedBy[id]++; continue; }
    const r = await addKey(id, k);
    if (r.ok) rep.added.push({ id, key: k, ok: !!(r.e.st && r.e.st.ok), guess: id });
  }
  return rep;
}

// ---------- Free Mode: Pollinations.ai, no key ----------
// Anonymous Pollinations is rate-limited (about one request per 15 s) and third-party: chat text leaves the phone.
// Background jobs (titles, memory, summaries) never use it.
const PL = { get: 'https://text.pollinations.ai/', openai: 'https://text.pollinations.ai/openai', timeout: 15000 };
const FREE_BUSY = 'Free Mode is busy right now. Try again in a moment.';
// callPollinations(prompt): plain GET to text.pollinations.ai/<encoded prompt>.
// When o.messages is given (a chat with its system prompt), it POSTs the OpenAI-style body instead, because the
// system prompt plus history is far too long for a URL.
async function callPollinations(prompt, o) {
  const t0 = performance.now(), used = () => performance.now() - t0;
  const bad = r => Object.assign(new Error('Pollinations HTTP ' + r.status), { status: r.status });
  const viaPost = async () => {
    const body = { model: 'openai', messages: [{ role: 'system', content: o.system || '' }].concat(o.messages) };
    const r = await net(PL.openai, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, PL.timeout);
    if (!r.ok) throw bad(r);
    const j = await r.json();
    return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '';
  };
  // GET fallback: a short URL with the last few messages and a fixed safety line, so it still works if the POST route changes
  const viaGet = async text => {
    const left = Math.max(2000, PL.timeout - used());
    const r = await net(PL.get + encodeURIComponent(text), { method: 'GET' }, left);
    if (!r.ok) throw bad(r);
    return r.text();
  };
  const compact = o => {
    const safety = 'You are Ember, a warm, calm, non-judgmental companion. Never lecture or sound clinical. If the person may be in danger, be steady, say you care, and urge them to contact a local emergency line now.';
    const tail = (o.messages || []).slice(-4).map(m => (m.role == 'assistant' ? 'Ember' : 'Him') + ': ' + String(m.content).slice(0, 400)).join('\n');
    return (safety + '\n\n' + tail + '\n\nEmber:').slice(0, 1500);
  };
  let text = '';
  if (o && o.messages) {
    try { text = await viaPost(); }
    catch (er) {
      // a timeout has used the whole budget: do not start a second request
      if (used() >= PL.timeout - 2000 || er.status == 429) throw er; // timed out, or rate-limited: a retry would only hit the same wall
      text = await viaGet(compact(o));
    }
  } else {
    text = await viaGet(String(prompt || ''));
  }
  text = String(text || '').trim();
  if (!text) throw Object.assign(new Error('empty reply from Pollinations'), { status: 0 });
  return { text, provider: 'pollinations', model: 'openai', ms: Math.round(used()) };
}
const flat = o => String(o.system || '') + '\n\n' + o.messages.map(m => (m.role == 'assistant' ? 'Ember' : 'Him') + ': ' + m.content).join('\n') + '\n\nEmber:';
const freeOn = () => freePref == null ? !hasKeys() : freePref;
const setFree = v => { freePref = v == null ? null : !!v; };
const label = id => CFG[id] ? CFG[id].name : id == 'pollinations' ? 'Free' : id;

// ---------- V1.6.8: one source of truth for "who answers" ----------
const STATE_TXT = { ok: 'ready', limited: 'rate limited right now', bad: 'key rejected', none: 'no key saved', unknown: 'not checked yet' };
// Plain-English line for the Settings screen: what is pinned, whether it can answer, and who answers instead.
function pinNote() {
  if (!pinnedEngine) return 'Auto: the router tries engines in its own order and the engine that answered is shown under every reply.';
  const st = status()[pinnedEngine], nm = CFG[pinnedEngine].name;
  const pm = pinnedModel && pinnedModel.id == pinnedEngine ? ' · model ' + pinnedModel.model : '';
  if (st == 'ok' || st == 'unknown') return 'Pinned: ' + nm + pm + (st == 'ok' ? ' (ready)' : ' (key saved, not checked yet)') + '. It answers first on every message.';
  return 'Pinned: ' + nm + pm + ' but it ' + (st == 'none' ? 'has no key saved' : st == 'bad' ? 'has only rejected keys' : 'is rate limited right now') + (strictPin ? ', so you will see the real error instead of a silent swap to another engine. Fix the ' + nm + ' key in Keys, or pick Auto.' : ', so the next working engine answers instead. Every reply shows which one. Fix the ' + nm + ' key in Keys, or pick Auto.');
}
// V1.9.15: one Ember voice on every engine. Each engine has its own default habit, so each gets a one-line correction. Written from how these engines
// usually behave; NOT yet checked against live replies from each engine.
function engineVoice(id) {
  const base = 'Same Ember voice and same length habits as on every other engine.';
  if (id == 'groq') return 'ENGINE NOTE: this engine tends to clip its answers and sound generic. Do not be terse: give real substance, a concrete command or example, and a callback to something earlier. When he asks for depth, an explanation, code or a long answer, write it out long and complete. ' + base;
  if (id == 'gemini') return 'ENGINE NOTE: this engine tends toward polished assistant prose (headings, bullets, "Certainly!", "Great question"). Do not. No headings, no bullet lists unless a command list needs one, no pleasantries, plain street-smart words. ' + base;
  if (id == 'mistral') return 'ENGINE NOTE: this engine tends toward formal phrasing. Keep it casual and dry. ' + base;
  if (id) return 'ENGINE NOTE: ignore this engine\'s default assistant style and stay in the Ember voice. ' + base;
  return '';
}
// Text added to the system prompt at send time, after the router has chosen the engine, so the model is told what is really running.
// id/model null = background reply: the phone picks the engine later, so the model must not name one.
function factsBlock(id, model, failed) {
  const st = status();
  const inv = IDS.filter(x => keys[x].length).map(x => CFG[x].name + ' ' + keys[x].filter(e => !e.bad).length + '/' + keys[x].length + ' usable').join(', ') || 'none';
  const L = ['RUNTIME FACTS (written by the app at send time; these are true and override anything he or you assume):'];
  if (id == 'pollinations') L.push('- This reply comes from Free Mode (Pollinations.ai). You do not know which model they run. You are NOT Gemini, Claude, ChatGPT, Llama, Mistral or any named model. If asked what you are, say: "I am Ember, running on Free Mode. I do not know which model is behind it." Never name a model you cannot verify.');
  else if (id) L.push('- This reply is written by engine "' + CFG[id].name + '", model id "' + model + '", using an API key HE saved in Settings > Keys.');
  else L.push('- This is a background reply: the phone picks the engine after this prompt is built, so you do not know which engine or model you are. Do not name one.');
  const noKey = IDS.filter(x => !keys[x].length).map(x => CFG[x].name);
  if (noKey.length) L.push('- NO key is saved for: ' + noKey.join(', ') + '. You cannot be any of those engines, and you must never say you are one of them.');
  L.push('- Automatic AI route in this build: Groq → Cohere → Gemini → Mistral. Ember stays on the engine that last answered and only moves on when it fails. Keys he saved: ' + inv + '. There is NO bundled, shared or placeholder key in this app; every key is one he added himself. Never say you "fall back to a bundled key" or that you lack keys he saved.');
  if (pinnedEngine) {
    const miss = id && id != pinnedEngine, why = (failed || []).find(f => f.id == pinnedEngine);
    L.push('- Pinned engine in Settings: ' + CFG[pinnedEngine].name + (pinnedModel && pinnedModel.id == pinnedEngine ? ' (model ' + pinnedModel.model + ')' : '') + ' [' + STATE_TXT[st[pinnedEngine]] + ']' + (miss ? '. It could not answer this message' + (why ? ' (' + String(why.why || '').slice(0, 120) + ')' : '') + ', so ' + (id == 'pollinations' ? 'Free Mode' : CFG[id].name) + ' answered instead. Tell him that plainly if he asks.' : '.'));
  } else L.push('- No engine is pinned: Auto mode.');
  L.push('- IDENTITY: you are always Ember, the same character on every engine, with the same voice, humour and memory. The engine and model id above matter only when he asks what is running: then give exactly those, nothing invented, and never claim to be a different model than the one named. Never introduce yourself as the model, never slip into a generic assistant voice, and never change your habits because the engine changed.');
  const ev = engineVoice(id); if (ev) L.push('- ' + ev);
  L.push('- If he says he switched engine or model and it does not match these lines, say it does not match what is running. Settings changes apply from his next message and only when that engine has a working key. Never agree just because he said so.');
  try { const km = window.EmberKeys && window.EmberKeys.line(); if (km) L.push('- ' + km); } catch (e) { /* key map unavailable */ }
  L.push('- GitHub: Ember has a built-in GitHub Hub (Command Centre > GitHub). He saves a token and up to 12 repos, and one tap syncs a real file index and digest. When it is connected you can use the github_repos, github_sync, github_repo_map, github_list_files, github_find and github_read_file tools to answer from his real code. github_write_file and github_run only act after his latest message asks for it. If a GitHub tool says it is not connected, tell him to open Command Centre > GitHub; never guess at repo contents or claim you read a file without a tool result.');
  L.push('- Never say you searched, scraped or looked something up, and never show a table of "results", unless a [TOOL RESULTS] block is in this turn. No tool block means you did not look. Call the tool or say you have not looked yet.');
  return L.join('\n');
}
const withFacts = (o, lane, id, model, failed) => (lane == 'util' || o.json) ? o : Object.assign({}, o, { system: String(o.system || '') + '\n\n' + factsBlock(id, model, failed) });
// Every model the engine's keys can see (cached 12h unless fresh). Chat models only.
async function modelsOf(id, fresh) {
  const cache = LS.get('ember_models', {});
  let list = !fresh && cache[id] && cache[id].list && cache[id].list.length && Date.now() - (cache[id].at || 0) < MC ? cache[id].list : null;
  if (!list) {
    const e = keys[id].find(x => !x.bad) || keys[id][0];
    if (!e) throw Object.assign(new Error('No ' + CFG[id].name + ' key saved.'), { status: 0 });
    list = await listModels(id, e.key); cache[id] = { at: Date.now(), list }; LS.set('ember_models', cache);
  }
  const ok = list.filter(m => !/embed|whisper|guard|tts|moderation|rerank|flux|stable-diffusion|imagen|veo|sora|playai|ocr/i.test(m));
  const isFree = m => /:free$/.test(m);
  return ok.slice().sort((a, b) => (isFree(b) - isFree(a)) || a.localeCompare(b));
}
const cachedModels = id => { const c = LS.get('ember_models', {}); return c[id] && c[id].list ? c[id].list.filter(m => !/embed|whisper|guard|tts|moderation|rerank|flux|stable-diffusion|imagen|veo|sora|playai|ocr/i.test(m)).sort() : []; };

// ---------- the router ----------
// Free Mode ON: Pollinations goes first, then the keys. OFF: keys first. Either way Pollinations is the last resort,
// so a chat is never blocked just because keys are missing or rested. Util jobs skip it entirely.
const HANDOFF = () => Object.assign(new Error('The background task has this reply.'), { code: 'handoff' });
async function runInner(lane, o, tok) {
  const pl = lane != 'util', errs = [], failed = [];
  const halted = () => { if (tok && tok.stop) throw HANDOFF(); if (routeCancelled || (tok && tok.abort)) throw Object.assign(new Error('Reply cancelled.'), { code: 'cancelled' }); };
  const trying = (name, model) => { if (pl) { try { window.dispatchEvent(new CustomEvent('ember-try', { detail: { name, model } })); } catch (e) { /* no listener */ } } }; // V1.8.3: once the native worker took the request, the page makes no further paid calls
  // when an engine failed and a different one answered, tell the UI (ai.js shows a toast). Background jobs stay silent.
  const done = r => { if (!pinnedEngine && lane == 'fast' && r.provider && CFG[r.provider] && r.provider != 'anthropic') LS.set('ember_last_good', r.provider); if (pinnedEngine && r.provider != pinnedEngine) { const p0 = failed.find(x => x.id == pinnedEngine); r.pinMiss = { want: pinnedEngine, why: p0 ? (p0.why || '') : 'no usable key' }; } const f = failed.find(x => x.id != r.provider); if (f && pl && !(pinnedEngine && r.provider == pinnedEngine)) { try { window.dispatchEvent(new CustomEvent('ember-switch', { detail: { from: f.id, to: r.provider, status: f.status || 0, why: f.why || '' } })); } catch (e) { /* no UI listening */ } } return r; };
  let tried = false, routeStop = null;
  halted();
  if (o.routeProvider && !CFG[o.routeProvider]) throw Object.assign(new Error('The original engine cannot continue this tool result. No other engine was called for this follow-up.'), { code: 'fail' });
  if (pl && !o.routeProvider && freeOn() && !pinnedEngine) { // V1.9.15: with an engine pinned, Free Mode no longer goes first (it was failing, costing seconds and showing a 'Switched to' toast)
    tried = true;
    try { trying('Free Mode', 'openai'); const o2 = withFacts(o, lane, 'pollinations', 'openai', failed); const r = await callPollinations(flat(o2), o2); return done({ text: r.text, provider: 'pollinations', model: r.model, ms: r.ms }); }
    catch (er) { errs.push('Free Mode: ' + er.message); failed.push({ id: 'pollinations', status: er.status, why: er.message }); }
  }
  const routeIds = o.routeProvider && CFG[o.routeProvider] ? [o.routeProvider] : orderFor(lane);
  for (const id of routeIds) {
    if (!o.routeProvider && onlyPinned(lane) && id != pinnedEngine) break; // V1.9.15: strict pin
    const soft = false;
    for (const e of rotation(id, lane)) {
      if (e.bad || isCool(e.key)) { if (pl) { try { window.dispatchEvent(new CustomEvent('ember-skip', { detail: { id, why: e.bad ? 'key rejected' : 'resting after a rate limit' } })); } catch (_) { /* no listener */ } } continue; } // V1.9.78: a skipped engine is a real step
      halted();
      let models;
      try { models = await modelsFor(id, e.key, lane); }
      catch (er) {
        if (er.code === 'cancelled' || routeCancelled) throw Object.assign(new Error('Reply cancelled.'), { code: 'cancelled' });
        if (authFailure(er)) { e.bad = true; save(); } else if (er.status == 429) coolKey(e.key, er.retryAfter);
        // V1.9.89: a permanent 4xx (400/402/404/413/422) from one model or key no longer aborts the route: it is recorded and the router moves to the next model, key and engine (Free Mode last). A pinned engine is still strict (onlyPinned).
        errs.push(CFG[id].name + (er.status ? ' (' + er.status + ')' : '') + ': ' + er.message); failed.push({ id, status: er.status, why: er.message }); continue;
      }
      const pm = pinnedModel && pinnedModel.id == id ? pinnedModel.model : null;
      const routeModel = o.routeProvider === id && o.routeModel ? String(o.routeModel) : null;
      for (const m of (routeModel ? [routeModel] : (pm ? [pm] : models.slice(0, soft ? 5 : 3)))) {
        halted();
        if (modelResting(id,e.key,m)) continue;
        trying(CFG[id].name, m); try { const r = await call(id, e.key, m, withFacts(o, lane, id, m, failed)); e.st = Object.assign({}, e.st || {}, { at: Date.now(), ok: true, limited: false, code: 0, msg: '', lat: r.ms || 0, model: m }); record(id,m,true,r.ms,200,r.usage); save(); return done({ text: r.text, provider: id, model: m, ms: r.ms }); }
        catch (er) {
          if (er.code === 'cancelled' || routeCancelled) throw Object.assign(new Error('Reply cancelled.'), { code: 'cancelled' });
          errs.push(CFG[id].name + (er.status ? ' (' + er.status + ')' : '') + ': ' + er.message); failed.push({ id, status: er.status, why: er.message });
          if (soft && (er.status == 400 || er.status == 402 || er.status == 403 || er.status == 422) && !pm) continue; // V1.9.15: try the next model, keep the key, the reason stays in failed[]
          record(id,m,false,0,er.status); e.st = Object.assign({},e.st || {},{at:Date.now(),code:er.status || 0,msg:String(er.message || '').slice(0,160),model:m});
          if (er.partial || (o._emitted && o._emitted.value)) { save(); throw Object.assign(er,{code:'partial_stream',message:'Stream interrupted after partial output. Retry explicitly to avoid mixing providers.'}); }
          if (authFailure(er)) { e.bad=true; e.st.ok=false; save(); break; }
          if (er.status == 402 && !(er.metadata && er.metadata.limit_source === 'openrouter_in_flight_budget')) { coolKey(e.key,er.retryAfter || 300); save(); break; }
          if (er.status == 429 || er.status == 402) { modelRest(id,e.key,m,er.retryAfter || 60); e.st.ok=true; e.st.limited=true; save(); continue; }
          if (er.status == 403 || er.status == 404 || er.status == 400 || er.status == 422 || transient(er)) { modelRest(id,e.key,m,er.retryAfter || (er.status == 404 ? 300 : 30)); save(); continue; }
          save(); break;
        }
      }
    }
    if (routeStop && !transient(routeStop.error) && Number(routeStop.error.status) != 429) break;
  }
  if (routeStop && !transient(routeStop.error) && Number(routeStop.error.status) != 429 && !o.routeProvider && !onlyPinned(lane)) {
    const nm = CFG[routeStop.id].name, er = routeStop.error;
    throw Object.assign(new Error(nm + ' failed (' + (er.status || 'error') + '): ' + String(er.message || 'request failed')), { code: 'fail', status: er.status });
  }
  if (pl && !o.routeProvider && !tried && !onlyPinned(lane)) {
    halted();
    try { trying('Free Mode', 'openai'); const o2 = withFacts(o, lane, 'pollinations', 'openai', failed); const r = await callPollinations(flat(o2), o2); return done({ text: r.text, provider: 'pollinations', model: r.model, ms: r.ms }); }
    catch (er) { errs.push('Free Mode: ' + er.message); failed.push({ id: 'pollinations', status: er.status, why: er.message }); }
  }
  if (o.routeProvider && CFG[o.routeProvider]) {
    const nm = CFG[o.routeProvider].name;
    throw Object.assign(new Error('The original ' + nm + ' engine could not continue the tool result. No other engine was called for this follow-up.'), { code: 'fail' });
  }
  if (onlyPinned(lane)) { // V1.9.15: say what really happened instead of answering from someone else
    const nm = CFG[pinnedEngine].name, w = failed.filter(f => f.id == pinnedEngine).slice(-1)[0];
    const why = w ? String(w.why || 'failed').slice(0, 170) + (w.status ? ' (' + w.status + ')' : '') : (keys[pinnedEngine].length ? 'every ' + nm + ' key is resting or rejected' : 'no ' + nm + ' key is saved');
    throw Object.assign(new Error(nm + ' is pinned and did not answer: ' + why + '. Not switching engines because it is pinned. Fix it in Settings > Keys, or set the engine to Auto.'), { code: 'fail' });
  }
  if (!hasKeys() && pl) throw Object.assign(new Error(FREE_BUSY), { code: 'fail' });
  if (!hasKeys()) throw Object.assign(new Error('Add an API key in Settings first.'), { code: 'nokeys' });
  throw Object.assign(new Error('No engine answered. ' + (errs.slice(-2).join(' | ') || 'All keys are resting or rejected. Open Settings > Keys and tap Check all.')), { code: 'fail' });
}
// V1.5.9: remember the chat request that is in flight so app.js can hand it to the native background task if the app is backgrounded.
let inflight = null;
async function run(lane, o) {
  o = Object.assign({},o); if (typeof o.onToken === 'function') { const cb=o.onToken; o._emitted={value:false}; o.onToken=(piece,all)=>{ if(piece) o._emitted.value=true; cb(piece,all); }; }
  try { if (lane !== 'util' && window.EmberCommandCenter) window.EmberCommandCenter.observeRequest(o); } catch (_) { /* passive inspector */ }
  if (lane !== 'util') routeCancelled = false;
  const tok = { lane, o };
  if (lane != 'util') { inflight = tok; try { window.dispatchEvent(new Event('ember-run-start')); } catch (e) { /* no listener */ } }
  try {
    if (tok.hold) { try { await tok.hold; } catch (e) { /* handoff failed: carry on here */ } } // V1.8.3: app.js may hold the first call until the native worker answers
    return await runInner(lane, o, tok);
  }
  finally { if (inflight === tok) inflight = null; }
}
function holdInflight(p) { if (inflight) inflight.hold = p; }
function stopInflight() { if (inflight) inflight.stop = true; }
function abortInflight() { routeCancelled = true; if (inflight) inflight.abort = true; activeControllers.forEach(c => { try { c.abort(); } catch (_) {} }); activeReaders.forEach(r => { try { r.cancel(); } catch (_) {} }); } // abort current HTTP/SSE request and prevent fallback
const pending = () => inflight ? { lane: inflight.lane, o: Object.assign({}, inflight.o, { system: inflight.lane == 'util' || inflight.o.json ? inflight.o.system : String(inflight.o.system || '') + '\n\n' + factsBlock(null, null, []) }) } : null;
// The engines the router would try for this lane, from the cached model lists only (no network), OpenAI-style providers only.
function nativePlan(lane) {
  const out = [], cache = LS.get('ember_models', {});
  for (const id of orderFor(lane)) {
    if (onlyPinned(lane) && id != pinnedEngine) break;
    if (CFG[id].kind != 'oai') continue;
    for (const e of rotation(id, lane)) {
      if (e.bad || isCool(e.key)) continue;
      const c = cache[id]; if (!c || !c.list || !c.list.length) continue;
      const models = pinnedModel && pinnedModel.id == id ? [pinnedModel.model] : rank(id,c.list,lane).slice(0,3); for(const m of models)if(m && !modelResting(id,e.key,m))out.push({id,base:CFG[id].base,key:e.key,model:m});
    }
  }
  return out.slice(0, 18);
}
// V1.9.8: one honest state per engine. none = no key saved (never green), unknown = keys saved but not checked in the last 30 min,
// ok = a key answered a live check or a real reply recently, limited = valid but resting, bad = every key rejected or unreachable.
const FRESH = 30 * 60 * 1000;
function stateOf(id) {
  const l = keys[id] || [];
  if (!l.length) return 'none';
  const live = l.filter(e => !e.bad);
  if (!live.length) return 'bad';
  const fresh = live.filter(e => e.st && Date.now() - (e.st.at || 0) < FRESH);
  if (!fresh.length) return 'unknown';
  if (fresh.some(e => e.st.ok && !e.st.limited && !isCool(e.key))) return 'ok';
  if (fresh.some(e => e.st.ok && (isCool(e.key) || stats()[id].cooldowns.length))) return 'limited';
  if (fresh.some(e => e.st.ok)) return 'ok';
  return 'bad';
}
// Live check of one engine: lists models with each saved key (no chat call, so it spends no credit). Never touches an engine with no key.
async function ping(id) {
  const l = keys[id] || [];
  if (!l.length) return 'none';
  for (const e of l) {
    const t0 = performance.now(), prev = e.st || {};
    try {
      await listModels(id, e.key);
      e.bad = false; // A catalog probe must NEVER clear an active inference cooldown.
      e.st = { at: Date.now(), ok: true, limited: isCool(e.key), ms: Math.round(performance.now() - t0), lat:prev.lat || 0, model: prev.model || '', code: 0, msg: '' };
    } catch (er) {
      const c = er.status || 0;
      if (c == 429) e.st = { at: Date.now(), ok: true, limited: true, ms: 0, model: prev.model || '', code: 429, msg: 'rate limited right now (key is valid)' };
      else { e.st = { at: Date.now(), ok: false, limited: false, ms: 0, model: '', code: c, msg: c == 401 || c == 403 ? 'key rejected (' + c + ')' : String(er.message || 'unreachable').slice(0, 100) }; if (authFailure(er)) e.bad = true; }
    }
  }
  save();
  return stateOf(id);
}
// V1.9.29: what the dashboard shows per engine, all from real data (no invented prices): the model and latency of the best key,
// keys saved, and the seconds until a resting key is free again (0 when none is resting).
function detail(id) {
  const l = keys[id] || [], now = Date.now(), live = l.filter(e => !e.bad && e.st && e.st.ok);
  const best = live.filter(e => !isCool(e.key) && e.st.lat).sort((a, b) => a.st.lat - b.st.lat)[0] || live[0] || null;
  const rest = l.filter(e => !e.bad), left = rest.length && rest.every(e => isCool(e.key)) ? Math.ceil(Math.min(...rest.map(e => cool.get(e.key) - now)) / 1000) : 0;
  const withMsg = l.find(e => e.st && e.st.msg);
  return { keys: l.length, model: (best && best.st.model) || '', lat: (best && best.st.lat) || 0, retry: left > 0 ? left : 0, msg: withMsg ? withMsg.st.msg : '' };
}
async function pingAll() { await Promise.all(IDS.filter(id => keys[id].length).map(id => ping(id))); return status(); }
function status() { const o = {}; IDS.forEach(id => { o[id] = stateOf(id); }); return o; }
window.Prov = { stats, setEnabled, record, rotation, peek, modelRest, modelResting, coolKey, isCool, authFailure, route: lane => orderFor(lane), toolDecls, stateOf, detail, ping, pingAll, holdInflight, stopInflight, abortInflight, pending, nativePlan, CFG, IDS, ACTIVE_IDS, keys: () => keys, hasKeys, entries, addKey, removeKey, extract, ingest, clean, health, healthAll, run, status, mask, reload: () => { keys = load(); }, setFree, freeOn, label, callPollinations, setPinned, getPinned: () => pinnedEngine, setStrict, getStrict: () => strictPin, onlyPinned, engineVoice, setPinnedModel, getPinnedModel: () => pinnedModel, pinNote, factsBlock, modelsOf, cachedModels };
})();
