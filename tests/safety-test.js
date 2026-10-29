// Ember V1.4.0 safety test (pure node, no browser). Run: node tests/safety-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'www', 'safety.js'), 'utf8'), ctx);
const S = ctx.window.Safety;
let pass = 0, fail = 0;
const eq = (t, want) => { const got = S.detect(t).level; (got === want ? pass++ : fail++); console.log(got === want ? 'PASS' : 'FAIL', want, JSON.stringify(t), got === want ? '' : '-> got ' + got); };
// level 0: idioms and everyday words must stay silent
['I am dying laughing', 'I could kill for a coffee', 'dead tired today', 'killing time at the mall', 'I have a plan for the weekend', 'I have a knife set for cooking', 'my phone is dying', 'bored to death', 'tonight is the night, the party starts at 9', 'the project is a mess but fine', 'I want to end things at the gym early', 'ready to go', 'at the end of the day it works', 'my fridge is empty'].forEach(t => eq(t, 0));
// level 1: heavy distress, tone only
['I feel hopeless', 'everything is falling apart', 'I am so overwhelmed', 'I hate myself', 'I am done with everything', 'having a panic attack'].forEach(t => eq(t, 1));
// level 2: ideation
['I want to die', 'i wanna die', 'I’m thinking about killing myself', 'nobody would miss me', 'I don’t want to be here anymore', 'wish I was dead', 'I want to end my life', 'dying laughing but honestly I want to die', 'I am suicidal', 'I want to kill myself', 'I don’t want to live'].forEach(t => eq(t, 2));
// level 3: plan, means or goodbye
['I want to die and I have a plan', 'I want to kill myself tonight', 'I have pills and I want to die', 'this is my last message', 'goodbye forever'].forEach(t => eq(t, 3));
eq('', 0);
// prompt wrapping
const w = (l) => S.wrapSystem('SYS', l);
const chk = (n, c) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n); };
chk('wrap level 0 unchanged', w(0) === 'SYS');
chk('wrap level 1 presence, no hotline', w(1).includes('PRESENCE MODE') && !w(1).includes('0800 567 567'));
chk('wrap level 2 presence + ideation, no hotline', w(2).includes('PRESENCE MODE') && !w(2).includes('0800 567 567') && !w(2).includes('CRISIS MODE'));
chk('wrap level 3 crisis block with 112 and SADAG', w(3).includes('CRISIS MODE') && w(3).includes('112') && w(3).includes('0800 567 567'));
chk('killSwitch only 3+', !S.killSwitch(0) && !S.killSwitch(1) && !S.killSwitch(2) && S.killSwitch(3));
chk('crisis card has tel links, no scripts', /tel:0800567567/.test(S.crisisCard()) && /tel:112/.test(S.crisisCard()) && !/<script/i.test(S.crisisCard()));
S.mark(2); chk('mark/lastLevel', S.lastLevel() === 2); S.mark(0);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
