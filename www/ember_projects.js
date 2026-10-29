// Ember V1.9.73 - ember_projects.js: the Project Workspace.
// A project is a Name, a Goal and a GitHub repo link. Open one in the left drawer (Projects tab) and every message you send carries
// that context in the system prompt, so the AI keeps the thread of what you are building without being told again.
// Storage: localStorage 'ember_projects' = { v: 1, active: '<id>' | '', list: [{ id, name, goal, repo, created, updated }] }.
// Nothing here is sent anywhere by itself: the three fields only travel inside the system prompt of a message you send while a project is open.
'use strict';
(() => {
const KEY = 'ember_projects', MAX_PROJECTS = 40, MAX_NAME = 60, MAX_GOAL = 500;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const uid = () => 'pj' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- storage (every read and write is guarded: blocked or corrupt storage must never break the app) ----------
let mem = null; // in-memory copy, also the fallback when storage is blocked
function blank() { return { v: 1, active: '', list: [] }; }
function sane(o) {
  const out = blank(); if (!o || typeof o !== 'object') return out;
  const seen = {};
  (Array.isArray(o.list) ? o.list : []).forEach(p => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || seen[p.id]) return;
    const name = clip(p.name, MAX_NAME); if (!name) return;
    seen[p.id] = 1;
    out.list.push({ id: p.id, name, goal: clip(p.goal, MAX_GOAL), repo: typeof p.repo === 'string' ? p.repo.slice(0, 200) : '', created: +p.created || Date.now(), updated: +p.updated || +p.created || Date.now() });
  });
  out.list = out.list.slice(0, MAX_PROJECTS);
  out.active = out.list.some(p => p.id === o.active) ? o.active : '';
  return out;
}
function load() {
  if (mem) return mem;
  let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  mem = sane(raw); return mem;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); return true; } catch (e) { return false; } }

// ---------- repo link: accepts https://github.com/owner/repo, github.com/owner/repo, git@github.com:owner/repo.git or owner/repo ----------
function cleanRepo(v) {
  let t = String(v == null ? '' : v).trim(); if (!t) return { ok: true, url: '' };
  t = t.replace(/^git@github\.com:/i, '').replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '').replace(/[?#].*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})(?:\/.*)?$/.exec(t);
  if (!m) return { ok: false, error: 'Repo link must look like https://github.com/owner/repo' };
  return { ok: true, url: 'https://github.com/' + m[1] + '/' + m[2] };
}

// ---------- model ----------
const list = () => load().list.slice();
const get = id => load().list.find(p => p.id === id) || null;
const active = () => get(load().active);
function create({ name, goal, repo }) {
  const n = clip(name, MAX_NAME); if (!n) return { ok: false, error: 'Give the project a name.' };
  const r = cleanRepo(repo); if (!r.ok) return r;
  const o = load(); if (o.list.length >= MAX_PROJECTS) return { ok: false, error: 'Project limit reached (' + MAX_PROJECTS + '). Delete one first.' };
  const p = { id: uid(), name: n, goal: clip(goal, MAX_GOAL), repo: r.url, created: Date.now(), updated: Date.now() };
  o.list.unshift(p); o.active = p.id; // a new project opens straight away
  const saved = save(); changed(); return { ok: true, project: p, saved };
}
function update(id, { name, goal, repo }) {
  const o = load(), p = o.list.find(x => x.id === id); if (!p) return { ok: false, error: 'That project no longer exists.' };
  const n = clip(name, MAX_NAME); if (!n) return { ok: false, error: 'Give the project a name.' };
  const r = cleanRepo(repo); if (!r.ok) return r;
  p.name = n; p.goal = clip(goal, MAX_GOAL); p.repo = r.url; p.updated = Date.now();
  const saved = save(); changed(); return { ok: true, project: p, saved };
}
function open(id) { const o = load(); if (id && !o.list.some(p => p.id === id)) return false; o.active = id || ''; save(); changed(); return true; }
function close() { return open(''); }
function remove(id) { const o = load(), n = o.list.length; o.list = o.list.filter(p => p.id !== id); if (o.active === id) o.active = ''; if (o.list.length === n) return false; save(); changed(); return true; }

// ---------- the system-prompt block (called by persona.buildSystem on every message) ----------
// Angle brackets are stripped so a project field can never close the tag it sits in.
const safe = s => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
function promptBlock() {
  const p = active(); if (!p) return '';
  const L = ['ACTIVE PROJECT: he has this project open, so treat it as the standing context for this conversation. Use it to keep your answers relevant to what he is building; do not recite it back unless it helps.',
    'Project name: ' + safe(p.name)];
  if (p.goal) L.push('Project goal: ' + safe(p.goal));
  if (p.repo) L.push('Project repo: ' + safe(p.repo));
  return '<project>' + L.join('\n') + '</project>';
}

// ---------- UI ----------
let editId = '', armedDelete = '';
function paintBadge() {
  const b = $('projBadge'); if (!b) return;
  const p = active();
  b.classList.toggle('hidden', !p);
  if (p) { $('projBadgeName').textContent = p.name; b.title = (p.goal ? p.goal + ' · ' : '') + (p.repo || 'No repo linked'); }
}
function paintList() {
  const box = $('pjList'); if (!box) return;
  const a = load().active, items = list();
  const ban = $('pjActive');
  if (ban) { const p = active(); ban.classList.toggle('hidden', !p); if (p) $('pjActiveName').textContent = p.name; }
  box.innerHTML = items.length ? items.map(p => {
    const on = p.id === a, armed = armedDelete === p.id;
    return '<div class="pj' + (on ? ' on' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="pj-h"><b>' + esc(p.name) + '</b>' + (on ? '<span class="pj-pill">OPEN</span>' : '') + '</div>' +
      (p.goal ? '<p class="pj-g">' + esc(p.goal) + '</p>' : '') +
      (p.repo ? '<a class="pj-r" href="' + esc(p.repo) + '" target="_blank" rel="noopener noreferrer">' + esc(p.repo.replace(/^https:\/\/github\.com\//, '')) + '</a>' : '<span class="pj-r none">No repo linked</span>') +
      '<div class="pj-b"><button class="btn g" data-act="' + (on ? 'close' : 'open') + '">' + (on ? 'Close project' : 'Open') + '</button><button class="btn g" data-act="edit">Edit</button><button class="btn g' + (armed ? ' danger' : '') + '" data-act="del">' + (armed ? 'Tap again to delete' : 'Delete') + '</button></div></div>';
  }).join('') : '<p class="hint">No projects yet. Create one below and Ember keeps its name, goal and repo in mind on every message.</p>';
}
function setErr(m) { const e = $('pjErr'); if (e) { e.textContent = m || ''; e.classList.toggle('hidden', !m); } }
function resetForm() {
  editId = ''; ['pjName', 'pjGoal', 'pjRepo'].forEach(i => { const el = $(i); if (el) el.value = ''; });
  const a = $('pjSave'), c = $('pjCancel'), s = $('pjFormSum'); if (a) a.textContent = 'Save project'; if (c) c.classList.add('hidden'); if (s) s.textContent = '＋ New project'; setErr('');
}
function fillForm(p) {
  editId = p.id; $('pjName').value = p.name; $('pjGoal').value = p.goal; $('pjRepo').value = p.repo;
  $('pjSave').textContent = 'Update project'; $('pjCancel').classList.remove('hidden'); $('pjFormSum').textContent = '✎ Edit project'; setErr('');
  const d = $('pjFormBox'); if (d) { d.open = true; try { $('pjName').focus(); } catch (e) { /* cosmetic */ } }
}
function render() { try { paintList(); paintBadge(); } catch (e) { /* UI must never break chat */ } }
function changed() { render(); try { document.dispatchEvent(new CustomEvent('ember-project-changed', { detail: { active: active() } })); } catch (e) { /* old webview */ } }

function bind() {
  const box = $('pjList');
  if (box) box.addEventListener('click', ev => {
    const btn = ev.target.closest && ev.target.closest('button[data-act]'); if (!btn) return;
    const card = btn.closest('.pj'), id = card && card.dataset.id, p = get(id); if (!p) { render(); return; }
    const act = btn.dataset.act;
    if (act !== 'del') armedDelete = '';
    if (act === 'open') open(id);
    else if (act === 'close') close();
    else if (act === 'edit') { fillForm(p); paintList(); }
    else if (act === 'del') {
      if (armedDelete !== id) { armedDelete = id; paintList(); setTimeout(() => { if (armedDelete === id) { armedDelete = ''; paintList(); } }, 4000); return; }
      armedDelete = ''; if (editId === id) resetForm(); remove(id);
    }
  });
  const sv = $('pjSave');
  if (sv) sv.addEventListener('click', () => {
    const f = { name: $('pjName').value, goal: $('pjGoal').value, repo: $('pjRepo').value };
    const r = editId ? update(editId, f) : create(f);
    if (!r.ok) { setErr(r.error); return; }
    if (r.saved === false) { setErr('Saved for this session only: the phone blocked storage, so it will be gone after a restart.'); return; }
    resetForm(); const d = $('pjFormBox'); if (d) d.open = false;
  });
  const cn = $('pjCancel'); if (cn) cn.addEventListener('click', () => resetForm());
  const cl = $('pjClose'); if (cl) cl.addEventListener('click', () => close());
  const bx = $('projBadgeX'); if (bx) bx.addEventListener('click', ev => { ev.stopPropagation(); close(); });
  const bd = $('projBadgeOpen'); if (bd) bd.addEventListener('click', () => { // jump to the Projects tab
    const dr = $('drawer'), hist = $('bHist'); if (dr && !dr.classList.contains('show') && hist) hist.click();
    const t = document.querySelector('.dtab[data-d="projects"]'); if (t) t.click();
  });
  const tab = document.querySelector('.dtab[data-d="projects"]'); if (tab) tab.addEventListener('click', render);
  window.addEventListener('storage', ev => { if (ev.key === KEY) { mem = null; render(); } }); // another tab/webview changed it
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

window.EmberProjects = { list, get, active, create, update, open, close, remove, promptBlock, cleanRepo, render };
})();
