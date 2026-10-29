// Ember V1.4.0 - storage + small helpers. Chats live in IndexedDB (falls back to memory if the browser blocks it). Settings and keys live in localStorage.
'use strict';
(() => {
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};
const U = {
  LS,
  $: id => document.getElementById(id),
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  time: ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  day: ts => {
    const d = new Date(ts), n = new Date(), y = new Date(Date.now() - 864e5);
    if (d.toDateString() === n.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
};
window.U = U;

const mem = { convs: new Map(), kv: new Map() };
let db = null;
const open = () => new Promise(res => {
  try {
    const r = indexedDB.open('ember', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('convs')) d.createObjectStore('convs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
    r.onblocked = () => res(null);
  } catch (e) { res(null); }
});
const rq = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const os = (n, m) => db.transaction(n, m).objectStore(n);

window.Store = {
  persistent: () => !!db,
  async init() { db = await open(); return !!db; },
  async all() {
    if (!db) return [...mem.convs.values()];
    try { return await rq(os('convs').getAll()); } catch (e) { return [...mem.convs.values()]; }
  },
  async get(id) {
    if (!db) return mem.convs.get(id) || null;
    try { return (await rq(os('convs').get(id))) || null; } catch (e) { return mem.convs.get(id) || null; }
  },
  async put(c) {
    mem.convs.set(c.id, c);
    if (!db) return true;
    try { await rq(os('convs', 'readwrite').put(c)); return true; } catch (e) { return false; }
  },
  async del(id) {
    mem.convs.delete(id);
    if (!db) return;
    try { await rq(os('convs', 'readwrite').delete(id)); } catch (e) {}
  },
  async getKV(k, d) {
    if (!db) return mem.kv.has(k) ? mem.kv.get(k) : d;
    try { const r = await rq(os('kv').get(k)); return r ? r.v : d; } catch (e) { return d; }
  },
  async setKV(k, v) {
    mem.kv.set(k, v);
    if (!db) return;
    try { await rq(os('kv', 'readwrite').put({ k, v })); } catch (e) {}
  },
  async wipe() {
    mem.convs.clear(); mem.kv.clear();
    if (!db) return;
    try { await rq(os('convs', 'readwrite').clear()); await rq(os('kv', 'readwrite').clear()); } catch (e) {}
  }
};
})();
