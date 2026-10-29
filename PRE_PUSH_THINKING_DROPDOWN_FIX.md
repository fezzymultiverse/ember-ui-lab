# Ember V1.9.49 — Thinking dropdown repair

## Changes
- Deduplicated repeated `ember-try` events by provider/model for the lifetime of one thinking card, preventing repeated identical routing rows from flooding the dropdown.
- Capped open thinking-history areas at 250px and enabled touch-friendly internal scrolling, so the card no longer pushes the composer off-screen on Android WebView.
- Kept the existing router fallback and tool-follow-up behavior unchanged in this focused UI patch.

## Verification
- JavaScript syntax check: run against `www/ember_timeline.js`.
- ZIP integrity: checked after packaging.
- Live provider/API behavior and Android device rendering still require on-device verification.
