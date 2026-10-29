# Contributing · V1.4.0

*For contributors.*

## Run it locally

There is no build step and no dependency to install for the app itself. Serve `www/` over HTTP:

```
cd www && python3 -m http.server 8080
```

Open `http://localhost:8080`. Opening `index.html` straight from disk is not supported: the service worker only registers over http(s), and API calls from a `file://` page can be blocked by the browser. The APK route (Capacitor) is described in [FEATURES.md](FEATURES.md).

## Code style

Match the existing files:

- `'use strict'` at the top, everything inside an IIFE, globals only through `window`.
- Semicolons are used. Indent two spaces. Prefer short single-line helpers over classes.
- Existing helpers first: `U.$`, `U.esc`, `U.LS`, `Store.*`, `Prov.*`. Escape every piece of stored text with `esc()` before it goes into HTML.
- File headers start with `// Ember V<version> - <what this file does>`. Version numbers use a capital V.
- No new external dependency, script, font or network call without review.

## Invariants every PR must keep

1. `Safety.detect` runs first in `Persona.respond`, before lane, directive and prompt.
2. No feature bypasses `Safety.killSwitch`. At level 2 or higher, no feature fires.
3. `Safety.wrapSystem` wraps the final system prompt.
4. The safety level is never persisted: no `conv.flagged`, nothing in `mem`, settings or backups.
5. The crisis card stays local: no fetch, no delay, no user text inside it.
6. No new persistent state without a migration (`MEM_DEF`, `migrateMem`, import merge, [MEMORY.md](MEMORY.md)).
7. No new external dependency without review.
8. Anything about coping, health or mood stays out of prompts unless the person raised it in the message being answered (HARD RULE 9).

[REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) is the reviewer's version of this list.

## Add a Safety pattern

Propose it (phrase, level, reason), add a test in `tests/safety-test.js`, run the full table including the everyday-phrase cases, then update the level table in [SAFETY.md](SAFETY.md). A pattern without a test is rejected.

## Add a feature

1. **Spec**: what it does, which prompt line it adds (one line, mind the 350-token fast lane), what new state it needs.
2. **Safety review**: what it does at level 1, 2 and 3, and confirm it is off at level 2 and above. Check it against HARD RULES 4 (no debating) and 9 (no mentioning coping).
3. **Tests**: unit or UI, in `tests/`.
4. **Docs**: update [ARCHITECTURE.md](ARCHITECTURE.md), [PRIVACY.md](PRIVACY.md), [MEMORY.md](MEMORY.md) and [CHANGELOG.md](CHANGELOG.md) as needed. Bump the version in `index.html`, `package.json`, `sw.js` and the file headers.

## CI

`.gitlab-ci.yml` runs `node --check` on every `.js` file, greps for forbidden patterns, then deploys `www/` to GitLab Pages on the default branch. Keep CI cheap: no builds, no container work.
