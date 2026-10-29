# Memory · V1.4.0

*For contributors and reviewers.*

Core Memory is one object, `mem`, stored in IndexedDB under the `kv` store, key `mem`. The person sees and edits it in Settings > Memory & Context.

## Shape

```js
{
  facts: [],          // [{t, ts, u?}]  durable facts. max 60
  threads: [],        // [{t, ts, u?}]  unfinished topics. max 12
  callbacks: [],      // reserved for V1.4.0
  patterns: {},       // reserved for V1.4.0
  moodLog: [],        // reserved for V1.4.0
  futureLetters: [],  // reserved for V1.4.0
  deck: []            // reserved for V1.4.0
}
```

`t` is the text (cut to 140 characters), `ts` the time it was learned, and `u` is true when the person edited the line by hand. Edited lines survive trimming.

**In V1.3.0 only `facts` and `threads` are written.** The five other keys exist so that V1.4.0 can add features without another migration, and they stay empty. Nothing reads them and nothing sends them to a model.

## What `learn()` writes

After a chat reaches two person messages, and then every sixth, `Persona.learn` sends the last 14 messages to the util lane with the instruction below. It asks for a JSON object with a chat title, a short summary, up to 5 new facts and up to 3 new threads. New lines are merged without duplicates (case-insensitive), then trimmed to the caps, dropping the oldest line the person did not edit.

## What it refuses to write

The extractor is told, verbatim:

> NEVER record: how he copes or what he does to feel better, health or mental-health details, crises, secrets, passwords, API keys, or private details about other people. Max 5 facts and 3 threads. Only include things not already in KNOWN. Use empty arrays when there is nothing new.

The rolling-summary prompt carries the same ban: *"LEAVE OUT how he copes or what he does to feel better, health or mental-health details, secrets, passwords and API keys."*

This is an instruction to a model, not an enforced rule. The code backs it up with the secret filter below.

## The secret filter

`SECRET = /password|passcode|api[ -]?key|gsk_|AIza|secret|token/i`

A learned line matching it is dropped. A line the person edits by hand is checked the same way and refused. **Imported** memory lines are not checked.

## When learning is skipped

`after()` returns without learning if any of these is true:

- The chat is **private** (🔒).
- **Persistent Memory** is switched off.
- The latest message is **level 2 or higher**, or any of the last 14 messages in the learning window is level 2 or higher.
- There is nothing to learn from yet (fewer than two person messages, or not on the every-sixth schedule).

Free Mode chats are also never learned from: the util lane does not use Pollinations, so with no key the background job fails quietly.

## Migration

`migrateMem(m)` runs on load, on "Clear memory" (as `MEM_DEF()`), and on import. Rules:

1. Start from `MEM_DEF()` (all seven keys, empty).
2. Copy every key from the saved object, so unknown extra keys survive.
3. Replace any of the seven keys with the right empty type if it is missing or the wrong type.
4. **Facts and threads from an old save are never dropped.** A V1.2.0 save (`{facts, threads}`) loads with the other five keys added empty.

Import merges instead of replacing: lines are added only if no existing line matches (case-insensitive), mood entries by timestamp, and pattern keys only if new. The `__proto__` and `constructor` keys are skipped.

## Rules for adding a key

A new `mem` key needs an entry in `MEM_DEF` and `migrateMem`, a line in the import merge, a line here, and a statement of whether it may ever reach a prompt. Anything about mood, coping or health must not be put in a prompt without a safety review.
