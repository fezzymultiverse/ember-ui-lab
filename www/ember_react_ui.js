// Ember V1.7.2 - ember_react_ui.js: the Reasoning panel (🧠 pill). Shows every Thought, Action and Observation of a run_react job live,
// and lets him change what it is analysing: approve or edit each action, edit what it sees, steer it with a note, or stop it.
// Talks only to EmberEngine.react (ember_react.js). The chat code (app.js) is not involved.
'use strict';
(() => {
const E = window.EmberEngine, $ = id => document.getElementById(id);
if (!E || !E.react || !$('react')) return;
const RX = E.react;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3000); };
const open = () => { render(); $('react').classList.add('show'); };
const close = () => $('react').classList.remove('show');
const isOpen = () => $('react').classList.contains('show');
const pretty = o => { try { return JSON.stringify(o, null, 2); } catch (e) { return '{}'; } };
const CHIP = { thinking: ['Thinking', 'b'], awaiting: ['Waiting for you', 'a'], running: ['Running', 'b'], done: ['Done', 'g'], failed: ['Failed', 'r'], skipped: ['Skipped by you', 'a'], repeat: ['Repeat, not run', 'a'], format: ['Bad format', 'r'], final: ['Final answer', 'g'], stopped: ['Stopped', 'r'] };

function paintCfg() {
  const c = RX.cfg.get();
  $('rxApprove').classList.toggle('on', c.approve); $('rxObserve').classList.toggle('on', c.observe);
}
const CTXT = ['search_in_document', 'read_document_chunk', 'get_document_outline'];
function ctxChips(en) {
  if (!CTXT.includes(en.tool)) return '';
  const o = [], a = en.args || {};
  if (en.tool === 'search_in_document' && a.query) o.push('🔎 ' + esc(String(a.query).slice(0, 40)));
  if (en.tool === 'read_document_chunk' && a.chunk) o.push('⌖ chunk #' + esc(String(a.chunk)));
  if (en.tool === 'get_document_outline') o.push('🗂 outline');
  let r = null; try { r = JSON.parse(en.observation); } catch (e) { r = null; }
  if (r && r.match) o.push('match: ' + esc(r.match)); if (r && r.hits) o.push(esc(String(r.total)) + ' hits'); if (r && r.of) o.push('of ' + esc(String(r.of)));
  return o.length ? '<div class="rxchips">' + o.map(x => '<span class="lcb">' + x + '</span>').join('') + '</div>' : '';
}
function entryHtml(en, s) {
  if (en.type === 'note') return '<p class="rxn">📝 You steered it: ' + esc(en.text) + '</p>';
  const w = s.waiting && s.waiting.n === en.n ? s.waiting.kind : '', ch = CHIP[en.status] || [en.status, 'c'];
  let h = '<div class="rxs' + (w ? ' wait' : '') + '"><h4>Step ' + en.n + ' <span class="pill ' + ch[1] + '">' + esc(ch[0]) + '</span>' + (en.edited ? ' <span class="pill p">edited</span>' : '') + '</h4>';
  h += '<div class="rxl">THOUGHT</div>' + (w === 'action' ? '<textarea class="rxt" rows="3">' + esc(en.thought) + '</textarea>' : '<p class="hint" style="margin:0">' + esc(en.thought || '(none)') + '</p>');
  if (en.final) return h + '<div class="rxl">FINAL</div><div class="rxf">' + esc(en.final) + '</div></div>';
  if (en.tool) {
    const act = pretty({ tool: en.tool, args: en.args });
    h += '<div class="rxl">ACTION</div>' + (w === 'action' ? '<textarea class="rxa" rows="' + Math.min(8, act.split('\n').length + 1) + '" spellcheck="false">' + esc(act) + '</textarea>' : '<pre>' + esc(act) + '</pre>');
  }
  h += ctxChips(en);
  if (w === 'action') h += '<div class="btnrow" style="margin-top:8px"><button class="btn" data-act="run">Run this action</button><button class="btn g" data-act="skip">Skip it</button><button class="btn g" data-act="stop">Stop</button></div>';
  if (en.observation) {
    h += '<div class="rxl">OBSERVATION' + (en.obsEdited ? ' (edited by you)' : '') + '</div>' + (w === 'observe' ? '<textarea class="rxo" rows="6" spellcheck="false">' + esc(en.observation) + '</textarea>' : '<pre>' + esc(en.observation.length > 1200 ? en.observation.slice(0, 1200) + '…' : en.observation) + '</pre>');
  }
  if (w === 'observe') h += '<div class="btnrow" style="margin-top:8px"><button class="btn" data-act="go">Continue with this</button><button class="btn g" data-act="stop">Stop</button></div>';
  return h + '</div>';
}
function render() {
  const s = RX.state(), box = $('rxTrace');
  if (!s) { $('rxStatus').textContent = 'Nothing has run yet. Ask Ember to work something out step by step, or to look into something, and the run shows up here.'; $('rxGoal').textContent = ''; $('rxStop').classList.add('hidden'); box.innerHTML = ''; paintCfg(); return; }
  $('rxStatus').textContent = s.status === 'running' ? (s.waiting ? 'Paused: waiting for you.' : 'Working…') : s.status === 'done' ? 'Finished with an answer.' : s.status === 'stopped' ? 'Stopped.' : 'Did not reach an answer' + (s.why ? ' (' + s.why + ').' : '.');
  $('rxGoal').textContent = 'Goal: ' + s.goal + (s.mode === 'document' ? ' · Local Context' : '') + (s.approve ? ' · approval on' : '') + (s.observe ? ' · observation edit on' : '');
  $('rxStop').classList.toggle('hidden', s.status !== 'running');
  box.innerHTML = s.entries.map(en => entryHtml(en, s)).join('');
  paintCfg();
  const w = box.querySelector('.rxs.wait'); if (w && isOpen()) w.scrollIntoView({ block: 'nearest' });
}

$('bReact').onclick = open; $('bRx').onclick = close;
$('rxStop').onclick = () => { if (RX.stop()) toast('Stopping…'); };
$('rxApprove').onclick = () => { RX.cfg.set({ approve: !RX.cfg.get().approve }); paintCfg(); toast(RX.cfg.get().approve ? 'It will ask before each action' : 'It runs actions on its own'); };
$('rxObserve').onclick = () => { RX.cfg.set({ observe: !RX.cfg.get().observe }); paintCfg(); toast(RX.cfg.get().observe ? 'You can edit what it sees after each action' : 'It reads results as they come'); };
$('rxSteerGo').onclick = () => { const v = $('rxSteerTxt').value.trim(); if (!v) return; RX.steer(v); $('rxSteerTxt').value = ''; const s = RX.state(); toast(s && s.status === 'running' ? 'Note sent: it goes in with the next step' : 'Saved. It goes into the next run'); };
$('rxTrace').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const card = b.closest('.rxs'), a = b.dataset.act;
  if (a === 'stop') { RX.stop(); return; }
  if (a === 'skip') { RX.decide({ skip: true }); return; }
  if (a === 'go') { RX.decide({ observation: card.querySelector('.rxo').value }); return; }
  if (a === 'run') {
    let act; try { act = JSON.parse(card.querySelector('.rxa').value); } catch (er) { toast('The action is not valid JSON'); return; }
    if (!act || typeof act.tool !== 'string' || !act.tool.trim()) { toast('The action needs a "tool"'); return; }
    if (act.args != null && (typeof act.args !== 'object' || Array.isArray(act.args))) { toast('"args" must be an object'); return; }
    RX.decide({ thought: card.querySelector('.rxt').value, action: { tool: act.tool.trim(), args: act.args || {} } });
  }
});
window.addEventListener('ember-react', e => {
  const t = (e.detail || {}).type;
  if (t === 'cfg' || t === 'steer') { paintCfg(); return; }
  render();
  const s = RX.state();
  if (t === 'start' && s && (s.approve || s.observe) && !isOpen()) open();
  else if (t === 'start' && !isOpen()) { const p = $('bReact'); p.classList.add('on'); }
  if (t === 'end') { const p = $('bReact'); p.classList.remove('on'); p.classList.add('fire'); setTimeout(() => p.classList.remove('fire'), 600); }
  if (t === 'wait' && !isOpen()) { open(); toast('Ember is waiting for you in Reasoning'); }
});
render();
})();
