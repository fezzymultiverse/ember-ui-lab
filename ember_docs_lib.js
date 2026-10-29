// Ember V1.6.4 - ember_docs_lib.js: the Documents library. Files live on this phone (IndexedDB) and window.EmberDocs is the bridge
// ai_docs.js calls (list / search / read), so the AI's document tools have something real behind them. Plain-text files only.
'use strict';
(() => {
const DBN = 'ember_docs', STN = 'docs', MAX = 2 * 1024 * 1024;
let db = null, cache = [];
const mem = new Map();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function open() {
  return new Promise(res => {
    try { const q = indexedDB.open(DBN, 1); q.onupgradeneeded = () => q.result.createObjectStore(STN, { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => res(null); q.onblocked = () => res(null); }
    catch (e) { res(null); }
  });
}
const ready = (async () => {
  db = await open();
  try { cache = db ? await rq(db.transaction(STN).objectStore(STN).getAll()) : []; } catch (e) { cache = []; }
  cache.forEach(d => mem.set(d.id, d));
})();
function tx(mode, fn) {
  return new Promise((res, rej) => { try { const t = db.transaction(STN, mode); fn(t.objectStore(STN)); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch (e) { rej(e); } });
}
async function persist(d) { mem.set(d.id, d); if (!db) return false; try { await tx('readwrite', s => s.put(d)); return true; } catch (e) { return false; } }
const extOf = n => (String(n).match(/\.([A-Za-z0-9]{1,8})$/) || [0, 'txt'])[1].toLowerCase();
const meta = d => ({ name: d.name, fileId: d.id, type: d.type, size: d.size });
const terms = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
function changed() { try { window.dispatchEvent(new Event('ember-docs-changed')); } catch (e) { /* no listeners */ } }

async function addText(name, text, src) {
  await ready;
  text = String(text == null ? '' : text);
  if (text.length > MAX) return { error: 'That is over 2 MB of text.' };
  const now = Date.now(), nm = String(name || 'Untitled').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'Untitled';
  const d = { id: uid(), name: nm, type: extOf(nm), size: text.length, text, src: src || '', added: now, updated: now };
  const saved = await persist(d);
  cache.push(d); changed();
  return { ok: true, doc: d, saved };
}
async function addFile(file) {
  if (!file) return { error: 'No file.' };
  if (file.size > MAX) return { error: file.name + ' is over 2 MB.' };
  let text; try { text = await file.text(); } catch (e) { return { error: 'Could not read ' + file.name + '.' }; }
  if (text.indexOf('\u0000') >= 0 || /\uFFFD{3,}/.test(text)) return { error: file.name + ' is not a plain text file (PDF and Word files are not supported).' };
  return addText(file.name, text, 'file');
}
async function update(id, patch) {
  await ready;
  const d = cache.find(x => x.id === id); if (!d) return { error: 'Document not found.' };
  if (patch && patch.name != null) d.name = String(patch.name).trim().slice(0, 120) || d.name;
  if (patch && patch.text != null) { d.text = String(patch.text).slice(0, MAX); d.size = d.text.length; }
  d.type = extOf(d.name); d.updated = Date.now();
  const saved = await persist(d); changed();
  return { ok: true, saved };
}
async function remove(id) {
  await ready;
  cache = cache.filter(x => x.id !== id); mem.delete(id);
  if (db) { try { await tx('readwrite', s => s.delete(id)); } catch (e) { /* gone from this session anyway */ } }
  changed(); return { ok: true };
}
// ---- the bridge ai_docs.js calls ----
async function listDocuments() { await ready; return { documents: cache.slice().sort((a, b) => b.updated - a.updated).map(meta) }; }
async function searchDocuments(a) {
  await ready;
  const t = terms(a && a.query); if (!t.length) return { results: [] };
  const results = [];
  for (const d of cache) {
    const hay = (d.name + '\n' + d.text).toLowerCase();
    if (!t.every(x => hay.includes(x))) continue;
    const i = d.text.toLowerCase().indexOf(t[0]);
    results.push(Object.assign(meta(d), { snippet: i < 0 ? '' : d.text.slice(Math.max(0, i - 60), i + 140).replace(/\s+/g, ' ') }));
    if (results.length >= 12) break;
  }
  return { results };
}
async function readDocument(a) {
  await ready;
  const d = cache.find(x => x.id === (a && a.fileId));
  return d ? { name: d.name, fileId: d.id, type: d.type, content: d.text } : { error: 'No document with that fileId. Use list_documents or search_documents first.' };
}
window.EmberDocs = { listDocuments, searchDocuments, readDocument, addText, addFile, update, remove, all: async () => { await ready; return cache.slice(); }, count: () => cache.length, ready: () => ready };
})();
