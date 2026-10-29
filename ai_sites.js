// Ember Add-On: Saved Sites (www/ai_sites.js)
// Tools: save_site(name, url), list_sites(). Stored in localStorage 'ember_sites'.
// "Check my GitHub": the AI calls list_sites, finds the url, then calls scrape_url.
'use strict';
(() => {
const LSK = 'ember_sites';
const TOOLS = [
  { name: 'save_site', description: 'Saves a site under a short name (e.g. GitHub, GitLab) so he can ask you to check it later.', parameters: { name: 'string', url: 'string' } },
  { name: 'list_sites', description: 'Returns his saved sites (name and url). Use this first when he asks to check a site, then call scrape_url with the matching url (scrape_url also accepts the saved name itself).', parameters: {} }
];
function load() { try { const a = JSON.parse(localStorage.getItem(LSK) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.name && x.url) : []; } catch (e) { return []; } }
function save(a) { try { localStorage.setItem(LSK, JSON.stringify(a)); } catch (e) { /* storage blocked */ } }
function cleanUrl(u) {
  u = String(u || '').trim(); if (u && !/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return (x.protocol == 'https:' || x.protocol == 'http:') ? x.href : ''; } catch (e) { return ''; }
}
function list() { return load(); }
function add(name, url) {
  name = String(name || '').trim().slice(0, 40); url = cleanUrl(url);
  if (!name) return { error: 'A name is required.' };
  if (!url) return { error: 'That is not a valid http(s) url.' };
  const a = load(), i = a.findIndex(x => x.name.toLowerCase() == name.toLowerCase());
  if (i >= 0) a[i] = { name: a[i].name, url }; else a.push({ name, url });
  if (a.length > 50) a.shift();
  save(a); return { ok: true, name, url };
}
function find(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return null;
  const a = load();
  return a.find(x => x.name.toLowerCase() == q) || a.find(x => q.includes(x.name.toLowerCase())) || a.find(x => x.name.toLowerCase().includes(q)) || null;
}
function remove(name) { const a = load().filter(x => x.name.toLowerCase() != String(name).toLowerCase()); save(a); return { ok: true }; }
async function dispatch(tool, args) {
  args = args || {};
  if (tool == 'save_site') return add(args.name, args.url);
  if (tool == 'list_sites') return { sites: load() };
  return { error: 'Unknown sites tool: ' + tool };
}
window.EmberSites = { TOOLS, dispatch, list, add, remove, find, cleanUrl };
})();
