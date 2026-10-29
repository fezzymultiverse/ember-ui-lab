'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.join(__dirname, '../www'), read = f => fs.readFileSync(path.join(root,f),'utf8');
let passed=0; const check = (name, value) => { assert(value,name); console.log('PASS '+name); passed++; };
const html = read('index.html'), js=read('ember_command_center.js'), css=read('ember_command_center.css'), prompt=read('persona.js');
check('separate component markup outside chat log', html.includes('<main id="log"></main>') && html.includes('id="emberCommandCenter"') && html.includes('id="emberTerminal"'));
check('timeline script still included',html.includes('src="ember_timeline.js"'));
check('inspector has no timeline side effects', !/EmberTimeline|ember-react'|ember-agent-note'/.test(js));
check('no raw hidden-reasoning fields inspected',!js.includes('reasoning_content') && !js.includes('.reasoning'));
check('public three-phase contract has exact required headings', ['Phase 1: Architecture/Constraint Check.','Phase 2: Tactical Execution Plan.','Phase 3: Edge-Case Mitigation.'].every(h=>prompt.includes(h)));
check('tool-only formats explicitly preserved',prompt.includes('do not prepend phases to a tool-only call'));
check('bounded output and explicit backend adapter', js.includes('MAX_LINES = 1000') && js.includes('connectStream') && js.includes('new EventSource'));
check('no innerHTML sinks in new components',!js.includes('innerHTML'));
check('same-origin streams without credentials in query',js.includes('u.origin !== location.origin') && js.includes('u.search'));
check('styles isolated and reduced-motion accessible',css.includes('@media(prefers-reduced-motion:reduce)') && !css.includes('.tl-'));
check('new assets included in offline shell',read('sw.js').includes("'ember_command_center.css', 'ember_command_center.js'"));
check('timeline event emitters remain present',read('app.js').includes("new CustomEvent('ember-turn-start'") && read('ai_agent.js').includes("emitEv('ember-dl', j)"));
const preserved = require('./command-center-preservation.json');
for (const [file,hash] of Object.entries(preserved)) {
 if (['ember_timeline.js','ember_think_inline.js'].includes(file)) {
   check('requested in-row Stop added to '+file,read(file).includes(file==='ember_timeline.js' ? "+ STOP + SW" : "data-react-stop"));
   continue; // v1.9.95 deliberately changes stop placement; not an unchanged-file claim.
 }
 check('unchanged uploaded V1.9.94 '+file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')===hash);
}
console.log(passed+' Command Center static checks passed.');
