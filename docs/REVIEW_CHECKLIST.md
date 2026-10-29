# Review checklist · V1.4.0

*For reviewers.* Tick each box against the code, not against these docs.

- [ ] `safety.js` is loaded before `persona.js` in `index.html`, and is listed in `sw.js`
- [ ] `Safety.detect` is called before `buildSystem` in `Persona.respond`
- [ ] `killSwitch` forces the deep lane, nulls the directive, and skips the anti-echo rewrite
- [ ] `wrapSystem` wraps the final system prompt (after `buildSystem`)
- [ ] `after()` returns at level 2 or higher, and when a level 2+ message is in the last 14
- [ ] No `flagged` field exists: `grep -rn "flagged" www tests` returns nothing
- [ ] The safety level is not written to `conv`, `mem`, `ember_set` or the export
- [ ] `MEM_DEF` and `migrateMem` are used in `init`, "Clear memory" and import
- [ ] An old `{facts, threads}` save loads with all facts and threads intact
- [ ] The crisis card is static markup with no fetch, no delay and no user text
- [ ] The card is drawn on send, before any engine answers, and survives `renderLog`
- [ ] Card and dot reset on "New chat" and when opening an old chat
- [ ] The numbers (0800 567 567, 0861 322 322, 112) match in `crisisCard()` and `CRISIS_BLOCK`, and are re-checked
- [ ] The footer version in `index.html` reads V1.4.0, matching `package.json` and `sw.js`
- [ ] `node --check` passes on every `.js` file
- [ ] `node tests/safety-test.js` passes
- [ ] `.gitlab-ci.yml` has no secrets and the `audit` job passes
- [ ] `LICENSE_NOTES.md` TBDs are resolved before the repo goes public
