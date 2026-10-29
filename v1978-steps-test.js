// Ember V1.9.78: the thinking card is fed only by real events. Pure Node.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x || '')); };
const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'ember_steps.js'), 'utf8');
const calls = [], win = new EventTarget();
win.EmberTimeline = { step: (ic, text, key) => calls.push({ ic, text, key }) }; win.Prov = { label: id => id.toUpperCase() };
vm.createContext({ window: win, CustomEvent, Date, console }); vm.runInContext(src, { window: win, CustomEvent, Date, console }.constructor === Object ? vm.createContext({ window: win, CustomEvent, Date, console }) : null);
const ev = (n, d) => win.dispatchEvent(new CustomEvent(n, { detail: d }));
ev('ember-turn-start', {}); ev('ember-skip', { id: 'groq', why: 'resting after a rate limit' }); ev('ember-skip', { id: 'groq', why: 'again' });
ok('skipped engine is a keyed step with the key icon', calls.length == 1 && calls[0].ic == 'key' && /GROQ skipped: resting after a rate limit/.test(calls[0].text), JSON.stringify(calls));
ev('ember-token', { piece: 'Hi', text: 'Hi there friend' });
ok('first words step appears once with real timing', calls.some(c => c.key == 'first-token' && /First words came back after \d+\.\ds/.test(c.text)));
ok('writing line shows the real word count', calls.some(c => c.key == 'stream' && /Writing the reply · 3 words/.test(c.text)), JSON.stringify(calls.slice(-1)));
ev('ember-thought', { piece: 'x', text: 'Checking the repo map before I answer' });
ok('model reasoning updates its own line with the brain icon', calls.some(c => c.key == 'model-thought' && c.ic == 'brain' && /repo map/.test(c.text)));
ev('ember-turn-end', { words: 42, engine: 'Groq' });
ok('turn end settles the writing line with final numbers', calls.slice(-1)[0].key == 'stream' && /Wrote 42 words in \d+\.\ds · Groq/.test(calls.slice(-1)[0].text), JSON.stringify(calls.slice(-1)));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
