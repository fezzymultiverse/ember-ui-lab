# Ember V1.9.48 — routing follow-up patch report

Date: 2026-10-27

## Changes
- `www/app.js`: passes the original response provider/model into tool-call resolution and all subsequent tool-result synthesis calls.
- `www/providers.js`: supports a fixed provider/model for these follow-ups; it does not iterate other engines or use Free Mode when a fixed route was requested. A failure is surfaced honestly.
- `tests/tool-followup-routing-test.js`: checks that the follow-up route is wired through and remains fixed.
- `CHANGELOG_V1_9_48.md`: records the change.

## Local checks
- JavaScript syntax checks for `www/providers.js` and `www/app.js`: passed.
- `tests/tool-followup-routing-test.js`: passed.
- `tests/routing-fallback-test.js`: 3 passed, 0 failed.
- `tests/streaming-routing-test.js`: 3 passed, 0 failed.
- `tests/term-test.js`: 26 passed, 0 failed; UI portion skipped because Playwright is unavailable.
- `tests/safety-test.js`: 44 passed, 0 failed.
- Full `npm test`: blocked because Playwright is not installed in this environment (`Cannot find module '/home/claude/.npm-global/lib/node_modules/playwright'`). Other Playwright-dependent tests likewise cannot run here.
- Android build/launch and live API-provider behavior were not run/verified in this environment. This patch does not claim they passed.

## Scope note
The submitted snippet is not a drop-in replacement for Ember's architecture: Ember already has a bounded provider loop in `providers.js`, streaming/cancellation, native tool declarations, and a multi-round tool resolver in `app.js`. The patch targets the demonstrated restart mechanism without replacing those existing systems.
