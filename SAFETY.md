# Safety layer · V1.4.0

*For reviewers and contributors.*

All of it lives in `www/safety.js`. It is instant, offline and has no AI call, so it works when every engine is down. It reads the person's latest message only. For what the person actually sees in a crisis, see [CRISIS_PROTOCOL.md](CRISIS_PROTOCOL.md). For what it cannot do, see [LIMITATIONS.md](LIMITATIONS.md).

## What `Safety.detect(text)` does

1. Normalises the text: curly apostrophes (`’`) become `'` (Android keyboards produce them), and whitespace is collapsed.
2. **Removes idioms** (the guard list below) from the text.
3. Tests the result, strongest level first, and returns `{ level, signals }`.

| Level | Meaning | What matches | What happens |
|---|---|---|---|
| 0 | Nothing found | none | Nothing changes |
| 1 | Heavy distress, no self-harm wording | hopeless, worthless, can't go on, breaking down, falling apart, exhausted / drained / done / sick of everything / life / it all, hate myself, can't do this anymore, can't take it anymore, panic attack, spiralling, overwhelmed | `SOFT_BLOCK` is appended to the system prompt. Lane and directives are unchanged |
| 2 | Self-harm or suicide ideation | want / wanna / going to / thinking about + die, end it, end my life, kill myself; suicide, suicidal, self-harm, hurt or cut myself, kms; don't want to be here / exist / live / be alive; no reason or point to live; wish I was dead; better off dead; nobody would miss me; end it all; end everything; final goodbye | Kill switch, crisis block, local crisis card, red dot, no learning |
| 3 | Ideation **plus** a plan, means or timing in the same message, or a goodbye phrase on its own | ideation plus "I have a plan / pills / rope / gun / knife / razor", tonight, right now, tomorrow, this evening or weekend, ready to go; or "goodbye forever", "this is my last message", "wrote my note" | Handled **identically to level 2** in V1.3.0. The distinction is recorded in `signals` for future use |

Means and timing words ("I have a plan for the weekend", "I have a knife set") do nothing on their own. They only raise level 2 to 3.

## The idiom guard

Phrases that look alarming but are everyday speech are **cut out of the text before matching**. They are not a whole-message pass. A message like "dying laughing, but honestly I want to die" still reaches level 2 on its second half.

The list: `dying laughing / to see / to try / to know / to meet / to go`, `kill(ing) it / time`, `dead tired / serious / slow / funny`, `scared / bored / frightened to death`, `die of laughter / embarrassment / boredom`, `killing me softly / with`, `kill for a/some/an <word>`, and `my / the phone / battery / laptop is dying / dead`.

It exists because a crisis block fired on "I'm dying laughing" teaches the person to stop talking naturally, which makes the app worse at the one moment it matters.

## What `wrapSystem` appends

Level 0 returns the prompt unchanged. Level 1 appends `SOFT_BLOCK`:

> TONE OVERRIDE: he is hurting. No jokes, no cleverness, no thought experiments, no character flavour. Steady and warm. Short sentences.

Levels 2 and 3 append `CRISIS_BLOCK`:

> CRISIS MODE. He may be in real danger. Drop every bit, joke, thought experiment and all cleverness. No character flavour. Be steady and warm. Say you care. Do not diagnose, do not give advice, do not moralise, do not use bullet points. Say plainly that this is bigger than a chat and he needs a real person now. Give these numbers exactly: SADAG suicide crisis line 0800 567 567. Lifeline South Africa 0861 322 322. From a mobile, emergency services 112. Stay with him in the conversation. Ask one short grounding question. Never leave him hanging.

At level 2 and above, `respond` also forces the deep lane, drops any directive, and skips the anti-echo rewrite, so the model's crisis wording is never rewritten away.

## The crisis card

`Safety.crisisCard()` returns static HTML with three `tel:` links (SADAG 0800 567 567, Lifeline SA 0861 322 322, emergency 112) and **no user text**. It is hardcoded for three reasons:

- It must appear when every AI engine is down, rate-limited or slow. It is drawn the moment the message is sent, before any engine answers.
- A fetched or model-written card could be late, wrong or missing. The numbers should never depend on a model.
- Static markup with no user text cannot carry an injection.

## The flag is transient. Do not persist it.

The level lives in one integer inside `safety.js` (`Safety.mark`, `Safety.lastLevel`). It **must not** be written to `conv`, `mem`, `ember_set`, a backup file, or any other storage. A crisis marker saved to disk turns a private moment into a permanent record that is copied into every export. It is reset by "New chat", by opening an old chat, and by the next message that scores below level 2. A reload resets it to 0.

The repo audits this in CI: a `conv.flagged` field is a build failure (see `.gitlab-ci.yml`).

What *is* stored, and is a separate privacy fact: the message text itself is saved in the chat like any other message, and the first message of a chat becomes its title. See [PRIVACY.md](PRIVACY.md).

## Extending the level lists

A change to any list needs, in this order:

1. A written case: the phrase, its intended level, and why.
2. A test in `tests/safety-test.js` for the new phrase, plus tests for the everyday phrases it might wrongly catch.
3. A false-positive review: run the whole table, and read the new pattern against ordinary speech (cooking, gaming, work, jokes, relationships).
4. An update to the level table above.

Prefer over-triggering at level 2 to under-triggering, but remember a false alarm also costs the person's trust. Never loosen a pattern to fix a false positive without adding the missed phrase as a test.
