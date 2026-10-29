// Ember V1.6.8 - ember_tasks.js: timers and reminders the AI can set ("play music for an hour", "remind me in 20 minutes").
// Honest limit: timers are checked while Ember is running (playing music keeps it alive). If Android closes the app, an overdue
// timer fires the moment Ember opens again and says it was late. Nothing here wakes a dead app.
'use strict';
(() => {
const LSK = 'ember_timers';
const load = () => { try { const a = JSON.parse(localStorage.getItem(LSK) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.id && x.at) : []; } catch (e) { return []; } };
const save = a => { try { localStorage.setItem(LSK, JSON.stringify(a.slice(-30))); } catch (e) { /* storage blocked */ } };
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 120);
const hm = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const TOOLS = [
  { name: 'set_timer', description: 'Sets a timer or reminder inside Ember that fires after N minutes (1 to 720). note = what to tell him when it fires. stop_music = true also stops the music then ("play music for an hour" = start the music, then set_timer 60 with stop_music true). Only when he asks for a timer, a reminder or a time-limited task.', parameters: { minutes: 'number', note: 'string?', stop_music: 'boolean?' } },
  { name: 'list_timers', description: 'Lists his active timers and reminders with the time each fires.', parameters: {} },
  { name: 'cancel_timer', description: 'Cancels one timer by id (from list_timers).', parameters: { id: 'string' } }
];
const INTENT = /\b(timers?|remind(?:er|ers| me)?|alarm|in \d+ ?(?:min|mins|minutes?|hours?|hrs?)|for (?:an?|one|\d+) ?(?:hours?|hrs?|min|mins|minutes?)|after \d+|half an hour|an hour|cancel (?:it|that|the))\b/i;
let intent = '', prev = '';
const setIntent = (u, p) => { intent = String(u == null ? '' : u).slice(0, 2000); prev = String(p == null ? '' : p).slice(0, 2000); };
const allowed = () => INTENT.test(intent) || (intent.length <= 60 && INTENT.test(prev));

function fire(t, late) {
  const text = '⏰ ' + (t.note || 'Timer is up.') + (late ? ' (this was due at ' + hm(t.at) + '; Ember was closed)' : '');
  if (t.stopMusic) { try { const P = window.EmberPlayer; if (P && P.control) Promise.resolve(P.control('stop', {})).catch(() => {}); } catch (e) { /* player not there */ } }
  try { window.dispatchEvent(new CustomEvent('ember-timer', { detail: { text, id: t.id } })); } catch (e) { /* no listener */ }
  try { const N = window.EmberNative; if (N && N.notifyReply) N.notifyReply(text); } catch (e) { /* no notification permission */ }
}
function tick(first) {
  const a = load(), now = Date.now(), due = a.filter(t => t.at <= now);
  if (!due.length) return;
  save(a.filter(t => t.at > now));
  due.forEach(t => fire(t, first || now - t.at > 90000));
}
setInterval(() => tick(false), 10000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(false); });
window.addEventListener('load', () => setTimeout(() => tick(true), 1500));

async function set_timer(a) {
  const m = Math.round(+a.minutes);
  if (!isFinite(m) || m < 1 || m > 720) return { error: 'minutes must be a number from 1 to 720.' };
  const t = { id: Math.random().toString(36).slice(2, 8), at: Date.now() + m * 60000, note: str(a.note, 160), stopMusic: !!a.stop_music };
  const list = load(); list.push(t); save(list);
  return { ok: true, id: t.id, firesAt: hm(t.at), minutes: m, stopsMusic: t.stopMusic, note: 'It fires only while Ember is running. Tell him that in a short clause.' };
}
async function list_timers() { const a = load(); return a.length ? { timers: a.map(t => ({ id: t.id, firesAt: hm(t.at), note: t.note, stopsMusic: t.stopMusic })) } : { timers: [], note: 'No active timers.' }; }
async function cancel_timer(a) { const id = str(a.id, 20), l = load(); if (!l.some(t => t.id == id)) return { error: 'No timer with that id.' }; save(l.filter(t => t.id != id)); return { ok: true }; }
const HANDLERS = { set_timer, list_timers, cancel_timer };
async function dispatch(name, args) {
  if (!Object.prototype.hasOwnProperty.call(HANDLERS, name)) return { error: 'Unknown timer tool: ' + name };
  if (!allowed()) return { error: 'He did not ask for a timer or reminder in his latest message, so none was set.' };
  try { return await HANDLERS[name](args && typeof args == 'object' && !Array.isArray(args) ? args : {}); }
  catch (e) { return { error: (e && e.message) || 'Timer tool failed.' }; }
}
function stateBlock() {
  const a = load();
  return 'TIMERS (true now): ' + (a.length ? a.length + ' active: ' + a.map(t => (t.note || 'timer') + ' at ' + hm(t.at)).join('; ') : 'none active') + '. They fire only while Ember is running; if Android closes the app they fire when it reopens, marked late. Never promise more than that.';
}
window.EmberTasks = { TOOLS, dispatch, setIntent, stateBlock, count: () => load().length, _tick: tick };
})();
