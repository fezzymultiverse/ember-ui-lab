// V1.9.73 checks: OpenRouter gone, Bojack egg gone, Sting generic endpoint, console artwork, Projects workspace, lyric thought bubbles.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const W = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n); } };

// ---- 1. OpenRouter removed everywhere in the app ----
const files = fs.readdirSync(path.join(__dirname, '..', 'www')).filter(f => /\.(js|html|css)$/.test(f));
ok('no OpenRouter reference left in www/', files.every(f => !/openrouter|sk-or-v1/i.test(W(f))));
ok('provider router has no openrouter', !/openrouter/.test(W('providers.js')) && /ACTIVE_IDS = \['groq', 'cohere', 'gemini', 'mistral', 'anthropic', 'puter'\]/.test(W('providers.js')));
ok('Settings dropdown has no OpenRouter option', !/value="openrouter"/.test(W('index.html')));

// ---- 2. Bojack easter egg removed ----
ok('Bojack egg gone from app, persona and nine_nine', !/BOJACK_EGG|BOJACK_REPLY|msg-egg-icon/.test(W('app.js') + W('persona.js') + W('nine_nine.js') + W('style.css')));

// ---- 3. Sting: generic https endpoint ----
const sc = W('ai_scraper.js');
ok('Sting appends ?url= to a plain endpoint and still honours old placeholders', /ep \+= \(ep\.indexOf\('\?'\) < 0/.test(sc) && /\\\{key\\\}\|\\\{url\\\}/.test(sc));
ok('Sting field asks for a generic https URL', /Sting endpoint \(generic https:\/\/ URL\)/.test(W('index.html')) && !/use \{key\} and \{url\}/.test(W('index.html')));

// ---- 4. Music console artwork ----
const html = W('index.html');
ok('console has an artwork image and a placeholder', /id="dmArt"/.test(html) && /id="dmArtPh"/.test(html) && /function syncArt\(\)/.test(html));
ok('console artwork css exists', /\.dm-art\{/.test(W('style.css')));

// ---- 5. Projects ----
function boot(file, extra) {
  const store = {}; const events = [];
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, addEventListener() {}, style: {}, setAttribute() {}, querySelector: () => null });
  const win = Object.assign({ localStorage: ls, addEventListener() {}, setTimeout, setInterval: () => 0, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; } }, extra || {});
  const doc = { readyState: 'complete', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent: e => { events.push(e); return true; }, hidden: false };
  win.window = win; win.document = doc; win.localStorage = ls;
  vm.runInNewContext(W(file), Object.assign(win, { localStorage: ls, document: doc, CustomEvent: win.CustomEvent, Date, Math, JSON, String, Object, Array, Set, Map, Promise, Error, RegExp }), { filename: file });
  return { win, store, events };
}
const P = boot('ember_projects.js'); const EP = P.win.EmberProjects;
ok('promptBlock is empty with no project open', EP.promptBlock() === '');
ok('repo link is validated and normalised', EP.cleanRepo('github.com/Fezzy/ember.git').url === 'https://github.com/Fezzy/ember' && EP.cleanRepo('Fezzy/ember').ok && !EP.cleanRepo('https://example.com/x').ok && EP.cleanRepo('').ok);
ok('project needs a name', EP.create({ name: '  ', goal: 'x', repo: '' }).ok === false);
ok('bad repo is rejected and nothing is saved', EP.create({ name: 'A', goal: 'g', repo: 'not a repo' }).ok === false && EP.list().length === 0);
const made = EP.create({ name: 'Ember V2', goal: 'Ship the workspace <b>fast</b>', repo: 'https://github.com/Fezzy/ember' });
ok('create saves to localStorage and opens it', made.ok && EP.active().name === 'Ember V2' && /ember_projects/.test(Object.keys(P.store).join()) && JSON.parse(P.store.ember_projects).active === made.project.id);
const blk = EP.promptBlock();
ok('system block carries name, goal and repo, angle brackets stripped', /^<project>/.test(blk) && /Project name: Ember V2/.test(blk) && /Project goal: Ship the workspace bfast\/b/.test(blk) && /Project repo: https:\/\/github\.com\/Fezzy\/ember/.test(blk) && (blk.match(/</g) || []).length === 2);
ok('update works', EP.update(made.project.id, { name: 'Ember V3', goal: 'g2', repo: '' }).ok && EP.active().name === 'Ember V3' && !/Project repo/.test(EP.promptBlock()));
const second = EP.create({ name: 'Other', goal: '', repo: '' });
ok('opening another switches the active project', EP.open(made.project.id) && EP.active().id === made.project.id && second.ok);
ok('close leaves no project context', EP.close() && EP.promptBlock() === '');
ok('delete removes it and clears active', EP.open(second.project.id) && EP.remove(second.project.id) && EP.active() === null && EP.list().length === 1);
ok('corrupt storage does not crash', (() => { try { const x = boot('ember_projects.js'); x.win.localStorage.setItem('ember_projects', '{not json'); return !!x.win.EmberProjects && x.win.EmberProjects.list().length === 0; } catch (e) { return false; } })());
const persona = W('persona.js');
ok('persona injects the project block, skipped during crisis', /EmberProjects\.promptBlock\(\)/.test(persona) && /noAmbient: crisis/.test(persona));
ok('drawer has the Projects tab and form', /data-d="projects"/.test(html) && /id="dp_projects"/.test(html) && /id="pjName"/.test(html) && /id="pjGoal"/.test(html) && /id="pjRepo"/.test(html));
ok('index and sw load the new scripts', /ember_projects\.js/.test(html) && /ember_lyric_thoughts\.js/.test(html) && /ember_projects\.js/.test(W('sw.js')) && /ember_lyric_thoughts\.js/.test(W('sw.js')));

// ---- 6. Lyric thought bubbles ----
const LT = boot('ember_lyric_thoughts.js', { EmberLyrics: { preview: (r, pos) => (r.synced || []).map(x => x.s) } }).win.EmberLyricThoughts;
ok('thought is cut to one clean sentence', LT._tidy('"This hits different. I keep replaying it."') === 'This hits different.');
ok('AI boilerplate is rejected', LT._tidy('As an AI, I cannot feel music.') === '');
ok('synced lyrics: uses the current line', LT._pick({ state: 'ok', instrumental: false, synced: [{ t: 1, s: 'the current line here' }], plain: [] }, 1) === 'the current line here');
ok('plain lyrics: picks a long enough line', LT._pick({ state: 'ok', instrumental: false, synced: [], plain: ['hi', 'I keep running back to you every night'] }, 0) === 'I keep running back to you every night');
ok('no lyrics or instrumental gives no line', LT._pick({ state: 'none' }, 0) === '' && LT._pick({ state: 'ok', instrumental: true }, 0) === '');
ok('renderLog places bubbles and app exposes chat state', /EmberLyricThoughts\.after\(conv\.id, i\)/.test(W('app.js')) && /window\.EmberChatState/.test(W('app.js')));
ok('bubble is not stored in the chat (no conv.msgs push in the module)', !/msgs\.push/.test(W('ember_lyric_thoughts.js')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
