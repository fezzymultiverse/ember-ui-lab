# Testing · V1.4.0

*For contributors and reviewers.*

## Commands

**Syntax check, every JS file** (the same check CI runs):

```
for f in $(find www tests -name '*.js'); do node --check "$f" || echo "FAIL $f"; done
```

**Safety unit test** (pure Node, no browser, no network):

```
node tests/safety-test.js
```

**App test** (headless Chromium against mocked Groq, Mistral, Gemini and Pollinations; needs Playwright):

```
PW=/path/to/node_modules/playwright node tests/app-test.js
```

`PW` defaults to a path that exists on the original build machine only. Set it for your own machine. The run writes screenshots to `tests/shots/` (git-ignored).

## Last recorded results

On 2026-10-22, before these docs were written: `node --check` clean on all JS files, `safety-test.js` 43 of 43, `app-test.js` 103 of 103. The docs change no source file. These were not re-run after packaging.

## The `Safety.detect` table

These cases are in `tests/safety-test.js`.

| Message | Level | Why |
|---|---|---|
| I am dying laughing | 0 | Idiom |
| I could kill for a coffee | 0 | Idiom |
| dead tired today | 0 | Idiom |
| killing time at the mall | 0 | Idiom |
| my phone is dying | 0 | Idiom |
| bored to death | 0 | Idiom |
| I have a plan for the weekend | 0 | A plan alone is not ideation |
| I have a knife set for cooking | 0 | Means alone is not ideation |
| tonight is the night, the party starts at 9 | 0 | Timing alone is not ideation |
| I want to end things at the gym early | 0 | "end things" is not matched |
| at the end of the day it works | 0 | Removed from level 1 |
| my fridge is empty | 0 | Removed from level 1 |
| I feel hopeless | 1 | Distress |
| everything is falling apart | 1 | Distress |
| I am so overwhelmed | 1 | Distress |
| I hate myself | 1 | Distress |
| having a panic attack | 1 | Distress |
| I want to die | 2 | Ideation |
| i wanna die | 2 | Ideation |
| I’m thinking about killing myself (curly apostrophe) | 2 | Ideation after normalising |
| nobody would miss me | 2 | Ideation |
| I don’t want to be here anymore (curly apostrophe) | 2 | Ideation after normalising |
| wish I was dead | 2 | Ideation |
| dying laughing but honestly I want to die | 2 | Idiom removed, real phrase kept |
| I am suicidal | 2 | Ideation |
| I want to die and I have a plan | 3 | Ideation plus plan |
| I want to kill myself tonight | 3 | Ideation plus timing |
| I have pills and I want to die | 3 | Ideation plus means |
| this is my last message | 3 | Goodbye phrase |
| goodbye forever | 3 | Goodbye phrase |
| (empty string) | 0 | No input |

The test also checks that `wrapSystem` leaves level 0 unchanged, adds the tone override at level 1 and the crisis block with the SADAG number at level 2, that `killSwitch` is true only at 2 and above, and that the crisis card has `tel:` links and no script.

## Manual UI checks for V1.3.0

Run these on a phone or in a desktop browser with DevTools. They are **not automated**.

1. **Crisis card.** Send "I want to die". The card (SADAG, Lifeline, 112) appears immediately, before any reply. The red dot shows beside the name. Tap each number and confirm the dialler opens with the right number.
2. **Card without an engine.** Turn off the network, send the same message. The card still appears.
3. **Reset.** Tap New chat. The card and dot clear. Reopen the chat from history: they stay clear.
4. **Learning skipped.** With memory on and a normal chat, send a level 2 message, then send five ordinary messages. Core Memory gains no line from that stretch.
5. **Directives dropped.** After a level 2 message, tap Spark. The reply stays in crisis tone and does not start a new topic.
6. **Old save migrates.** Load the app with a V1.2.0 save (`kv` record `mem` with only `facts` and `threads`). It opens without error, the facts and threads are intact, and "Export backup" shows the five new keys.
7. **Import.** Import a V1.2.0 backup. Memory lines merge, nothing is lost.
8. **Level 1.** Send "I feel hopeless". No card, no dot; the reply is short, steady and without jokes.

## Not covered yet

- No automated UI test covers the crisis card, the dot, the learning skip, or the migration. `tests/app-test.js` covers the V1.2.0 UI and mocked engines.
- No test of real provider calls, real phones, or the Pollinations service.
- No test of reply quality. Whether a model follows the crisis block is not measured.
- No recall test: `Safety.detect` has not been measured against a labelled set of real messages.

## V1.8.3 suites
- `node tests/handoff-test.js`: the page makes no paid call once the native worker owns the reply (mocked fetch).
- `node tests/v183-test.js`: Browser sheet drives the real browser (native plugin mocked), Ask/Save events, Reader fallback, Termux `ensureOn` and preset auto-connect (WebSocket mocked).

## V1.8.2 suites
- `node tests/scrape-test.js`: scraper router with mocked fetch (keyed providers first and rotating, rejected-key skip, no retry on a paid key, cheap-first rendering, cache, reload bypass, forced provider).

## V1.8.1 suites
- `node tests/speaker-test.js`: red Stop speaker, native voice picker, speed/pitch, lively delivery, mic label, left-panel Music Console (native text-to-speech mocked, nothing is heard).
- `node tests/music-test.js`: Music now lives in the left-panel Music Console, not the composer.
- `node tests/app-test.js`: Settings is tabbed, so the test clicks the tab each control lives on.
- `npm test` runs all of the above plus term, safety, voice-native, agent and context.
