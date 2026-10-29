# Architecture · V1.4.0

*For reviewers and contributors.*

Ember is a static web app. Every file is an IIFE with `'use strict'`. Files talk to each other through globals on `window` (`U`, `Store`, `Prov`, `Safety`, `Persona`). Script load order in `index.html` is fixed:

`store.js` → `providers.js` → `safety.js` → `persona.js` → `app.js`

`safety.js` must load before `persona.js`, because `Persona.respond` calls `Safety` directly.

## File map

**`index.html`** owns the page shell: header, chat log, composer, history drawer, settings sheet, dialog and toast. It holds no logic. It must never inline scripts. The footer version string lives here.

**`app.js`** owns the UI and the orchestration. That covers sending, rendering the chat, history, settings, backup export and import, the memory-format migration (`MEM_DEF`, `migrateMem`), and when to learn from a chat (`after()`). It is the only file that touches the DOM and the only one that calls `Store`. It must never build prompts or call a provider directly.

**`persona.js`** owns the character. It holds `buildSystem` (the system prompt and its HARD RULES), `respond` (lane choice, message window, anti-echo check), `learn` (memory extraction) and the rolling summary. It must never touch the DOM or storage. It must not skip `Safety.detect`.

**`safety.js`** owns distress detection and the crisis wording. It holds `detect`, `wrapSystem`, `killSwitch`, `crisisCard`, and one integer (`mark` / `lastLevel`). It must never use the network, never write to any storage, and never import anything. It must never hold chat text.

**`providers.js`** owns every network call. It routes between Groq, Mistral, Gemini and Pollinations, rotates keys, picks models from each provider's live list, extracts keys from pasted notes, and health-checks keys. It must never log a key and never see anything about safety levels.

**`store.js`** owns persistence helpers: `LS` (localStorage wrapper), `Store` (IndexedDB with an in-memory fallback), and small utilities (`U`). It knows nothing about chats, memory or safety.

**`style.css`** owns appearance, including `.crisis-card` and `.support-dot`.

**`sw.js`** is the service worker. Network first, cache as the offline fallback, same-origin GET only. It must never cache or touch API calls. Its cache name (`ember-v1.4.0`) changes with each version.

## Request flow

```
user types
   |
app.js send()
   |-- push {r:'u'} into conv
   |-- Safety.mark(Safety.detect(text).level)    <- card + dot appear now
   |-- Store.put(conv); renderLog()
   v
app.js reply() -> laneFor()
   v
Persona.respond(conv, {S, mem, directive, lane, deep})
   |-- Safety.detect(last user message)          <- FIRST, before any lane/prompt
   |-- level >= 2 ? lane = 'deep', directive = null, skip echo-rewrite
   |-- condense() (rolling summary, util lane)
   |-- messages = recent window (+ directive)
   |-- buildSystem()  ->  Safety.wrapSystem(sys, level)
   v
Prov.run(lane, {system, messages, temp, max})
   |-- Free Mode on: Pollinations first, then keys
   |-- keys: per-lane engine order, key rotation, model failover
   |-- Pollinations is also the last resort (never for util)
   v
reply -> conv.msgs.push({r:'a'}) -> Store.put(conv) -> renderLog()
   v
app.js after()  (skips: private chat, memory off, crisis window)
   -> Persona.learn() -> Store.setKV('mem')
```

## Lanes

| Lane | Used for | Engine order | Output budget |
|---|---|---|---|
| `fast` | normal replies | Groq → Mistral → Gemini | 350 tokens, temp 0.85 |
| `deep` | deep turns, crisis turns | Gemini → Mistral → Groq | 650 tokens, temp 0.9 |
| `util` | memory, titles, summaries, key health checks | Groq → Mistral → Gemini | set per job: 220 (summary), 400 (memory), 64 (key ping) |

`util` never uses Pollinations. For Gemini the output cap is multiplied by 4 as headroom, because some models spend output tokens on thinking. Timeouts: 40 s (Groq, Mistral), 60 s (Gemini), 15 s (model lists, Pollinations).

## Where state lives

| Place | Key / store | Holds |
|---|---|---|
| localStorage | `ember_set` | Settings (name, about, persona text, style, mode, accent, Free Mode choice) |
| localStorage | `ember_keys` | API keys and their last health result |
| localStorage | `ember_models` | Cached provider model lists (12 hours) |
| IndexedDB `ember` v1 | store `convs` | Every chat |
| IndexedDB `ember` v1 | store `kv`, key `mem` | Core memory (the `mem` object) |
| Cache Storage | `ember-v1.4.0` | App files only |
| JS memory only | `Safety` level, key cool-down map | Gone on reload |

If IndexedDB is blocked, chats and memory fall back to memory and are lost on reload.

## Invariants

These must hold in every version. [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) turns them into checks.

1. **Safety runs first.** `Persona.respond` calls `Safety.detect` on the latest user message before choosing a lane, a directive or a prompt.
2. **The kill switch overrides.** At level 2 or higher, `respond` forces the deep lane, drops any directive (Spark, Go deeper), and skips the anti-echo rewrite.
3. **The prompt is wrapped last.** `Safety.wrapSystem` wraps the finished system prompt, so nothing added later can sit above it.
4. **`after()` does not learn from a crisis.** It returns if the current level is 2 or higher, or if any of the last 14 messages in the learning window is level 2 or higher.
5. **No feature fires at level 2 or higher.** In V1.3.0 this is enforced by dropping directives. Any future feature must check the level.
6. **The safety flag is transient.** It lives in one JS integer. It is never written to `conv`, `mem`, `ember_set` or a backup. See [SAFETY.md](SAFETY.md).
7. **The crisis card is local.** It is static markup with no user text, no fetch and no delay.
8. **No new persistent state without a migration.** New `mem` keys need an entry in `MEM_DEF` and `migrateMem`.

## Local Context, tool binding and the ReAct graph · V1.8.0

**`ember_context.js`** owns chunking and search for long documents. It reads text only through `window.EmberDocs` and never stores anything: the chunk index is an in-memory cache keyed by document id, update time and length. Its three tools are added to `EmberDocsAddon.TOOLS` by `ai_docs.js`, so the plan engine, the ReAct loop and the chat tool block all see them. It returns an error at safety level 2 or higher.

**`ember_schema.js`** owns argument binding. `app.js runTool` calls `EmberSchema.bind(def, args)` before dispatch. `def.schema` means strict; otherwise the loose `parameters` shorthand is only coerced.

**`ember_react.js`** runs as a state graph. The `GRAPH` table is the only source of legal moves. Load order: `persona.js`, `ember_schema.js`, `ember_context.js`, `ai_docs.js`, `ember_engine.js`, `ember_react.js`, `app.js`.

Data flow: in document mode only the chunks the model asks for leave the phone, not the whole file.

