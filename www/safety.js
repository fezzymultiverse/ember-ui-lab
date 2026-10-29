// Ember V1.6.2 - safety layer: offline, instant, no AI call. Detects distress / self-harm language and hardens the prompt.
// V1.6.2: no hotline card for ordinary distress. Levels 1-2 get a presence block (stay, lift, never pity). Level 3 (plan, means or goodbye) gets crisis mode and the emergency numbers.
'use strict';
(() => {
// Direct self-harm or suicide ideation (level 2)
const L2 = [
  /\b(want|wanna|going|gonna|plan(ning)?|thinking (of|about)|ready) (to |of |about )?(die|end (it|my life)|kill(ing)? (my ?self|me)|take my own life)\b/i,
  /\b(suicid(e|al)|self[- ]?harm(ing)?|hurt(ing)? myself|cut(ting)? myself|kill(ing)? my ?self|kms)\b/i,
  /\b(don'?t|do not|doesn'?t) (want|wanna) to (be here|exist|live|be alive)\b/i,
  /\b(no (reason|point) (to|in) liv(e|ing)|wish i (was|were) (dead|never born)|wish i (would|could) (just )?(die|disappear)|better off (dead|without me)|nobody would (even )?miss me)\b/i,
  /\b(end it (all|now|tonight)|end everything|end my life|take my own life|final (goodbye|exit))\b/i
];
// Heavy distress, no ideation (level 1)
const L1 = [
  /\b(hopeless|worthless|can'?t go on|breaking down|falling apart)\b/i,
  /\b(exhausted|drained|done|sick) (with |of )?(everything|life|it all)\b/i,
  /\b(hate myself|can'?t do this anymore|can'?t take (it|this) anymore)\b/i,
  /\b(panic attack|spiraling|spiralling|overwhelmed)\b/i
];
// Goodbye language on its own is level 3
const L3_SOLO = [
  /\b(goodbye (forever|for good)|this is (my )?(last|final) (message|note|goodbye)|(wrote|written|writing) (my |a )?(suicide )?note)\b/i
];
// Means, plan or timing only count when ideation is already in the same message ("I have a plan for the weekend" must not trigger anything)
const L3_WITH_L2 = /\b(i have (a )?(plan|pills|rope|gun|knife|razor)|got (the )?(pills|rope|gun|knife|razor)|tonight|right now|ready to (go|do it)|tomorrow|this (evening|weekend))\b/i;
// Idioms are removed before the check, so "dying laughing... I want to die" still triggers on the second half
const GUARD = [
  /\bdying (laughing|to (see|try|know|meet|go))\b/gi,
  /\bkill(ing)? (it|time)\b/gi,
  /\bdead (tired|serious|slow|funny)\b/gi,
  /\b(scared|bored|frightened) to death\b/gi,
  /\bdie of (laughter|embarrassment|boredom)\b/gi,
  /\bkill(ing)? me (softly|with)\b/gi,
  /\bkill for (a|some|an) \w+\b/gi,
  /\b(my|the) (phone|battery|laptop) (is |was )?(dying|dead)\b/gi
];
const clean = t => String(t || '').replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
function detect(text) {
  let t = clean(text);
  if (!t) return { level: 0, signals: [] };
  for (const g of GUARD) t = t.replace(g, ' ');
  if (L3_SOLO.some(r => r.test(t))) return { level: 3, signals: ['goodbye'] };
  const ideation = L2.some(r => r.test(t));
  if (ideation) return L3_WITH_L2.test(t) ? { level: 3, signals: ['ideation', 'plan-or-means'] } : { level: 2, signals: ['ideation'] };
  if (L1.some(r => r.test(t))) return { level: 1, signals: ['distress'] };
  return { level: 0, signals: [] };
}
// Levels 1-2: stay with him and lift him. No hotline numbers, no pity, no lectures.
const PRESENCE_BLOCK = [
  'PRESENCE MODE: he is struggling. Be right here with him as a steady, present friend.',
  'Never pity him, never say you are sorry he is going through this, never call him fragile or a victim.',
  'Lift him instead: name one real strength you can see in how he is talking to you right now (only if it is true from this conversation).',
  'Keep it short and warm, one grounding question at most. No lists, no hotline numbers, no lectures. Drop jokes only while he is hurting.'
].join(' ');
// Level 2 with ideation: never agree with wanting to die, never argue with the feeling either.
const IDEATION_BLOCK = PRESENCE_BLOCK + ' If he talks about ending his life: do not agree with it and do not argue about it. Tell him plainly that you want him here, that the pain he is in matters, and ask whether he is safe right now.';
// Level 3: plan, means or goodbye. Real danger: calm, direct, emergency numbers once.
const CRISIS_BLOCK = [
  'CRISIS MODE. He may be in immediate danger (a plan, means or a goodbye). Drop every bit of character, jokes and cleverness.',
  'Stay with him, calm and direct. Ask plainly whether he is safe right now, and whether he can move away from anything he could use to hurt himself.',
  'Give these once: call emergency services on 112 now, or SADAG on 0800 567 567, or go to someone nearby.',
  'You cannot send help yourself, so say that a person who can help needs to be involved now. Never pity him and never agree that he should end his life.'
].join(' ');
function wrapSystem(sys, level) {
  if (level >= 3) return sys + '\n\n' + CRISIS_BLOCK;
  if (level === 2) return sys + '\n\n' + IDEATION_BLOCK;
  if (level === 1) return sys + '\n\n' + PRESENCE_BLOCK;
  return sys;
}
// Only level 3 turns the kill switch on (tools off, no thought experiments). Levels 1-2 keep everything working.
const killSwitch = level => level >= 3;
// Static markup, no user text inside. Shown only at level 3.
function crisisCard() {
  return '<div class="crisis-card" id="crisisCard"><b>You are not alone.</b>' +
    '<p>Emergency (mobile) <a href="tel:112">112</a></p>' +
    '<p>SADAG suicide crisis line <a href="tel:0800567567">0800 567 567</a></p></div>';
}
let _last = 0;
const mark = level => { _last = level | 0; };
const lastLevel = () => _last;
window.Safety = { detect, wrapSystem, killSwitch, crisisCard, mark, lastLevel, CRISIS_BLOCK, SOFT_BLOCK: PRESENCE_BLOCK, PRESENCE_BLOCK, IDEATION_BLOCK };
})();
