# Ember V1.9.51 — Thinking stability and plus alignment

This is a focused update to the supplied V1.9.49 thinking-dropdown patch. The app retains its existing dark/orange design, provider routing, tools, attachments, native patches, and build workflow. The package/cache release identity is V1.9.50 for this source ZIP.

## Thinking text

The live spinner display now updates one existing text node rather than overlapping outgoing and incoming text with a vertical 3D flip. Its status row has a fixed height and uses a single line with ellipsis for long provider/model names. The full progress text remains available in the saved “Thought for…” history.

The spinner continues to rotate normally. Compact-dropdown rows no longer replay drop animations on every update, and new Summary rows fade in without translating vertically. Progress scrolling is immediate rather than repeatedly restarting smooth-scroll animations; timeline paints do not force a reader of older messages to the bottom. The live card does not shrink in the chat’s flex layout and survives unrelated chat/download rerenders without restarting its spinner.

The rotating status is the first view. Tapping the row or its chevron now expands the dots-and-icons timeline in the same card; tapping it again collapses the details. The switch control remains available for the compact alternative, and the expanded control also supports Enter and Space keyboard activation.

The previous 250px scrollable-history cap and provider/model retry deduplication remain intact. Reduced-motion preferences disable the spinner and entry animations.

## Plus control

The add button now has the same 38×38px size as the Talk, Mic, Stop, and Send controls. Its two-bar cross remains geometrically centered, including when it rotates into an × for the open menu. Alignment stays centered when the message input expands to multiple lines. Menu actions, attachments, chips, and keyboard dismissal are unchanged.

## Version and build

Package metadata, the in-app version label, and the service-worker cache are updated to V1.9.50 so a PWA update uses the new asset cache. This ZIP contains the full source project, not a compiled APK. Use the existing README and Android build instructions to rebuild/sync the app; replace the project files rather than installing this ZIP directly as an APK.

## Regression checks

A new `tests/v1950-ui-stability-test.js` browser regression checks text/node stability, header geometry, rotating-first expansion into the dots/icons timeline, plus alignment for empty/single-line/multiline input, menu rotation and dismissal, same-label tool failure/recovery, rapid updates, escaped text, history caps, style cycling, retained live DOM across chat rerenders, and reduced motion at viewport widths 320, 360, 390, 430, and 760px.

Run it with Playwright available using `npm run test:ui-stability`, or set `PW` to an existing Playwright module path. `CHROME` optionally selects a Chromium executable; `WWW` optionally selects a different source web folder.

Verification results and limitations are recorded in `UI_FIX_VERIFICATION.md` after testing. Android hardware/WebView verification and a native APK build are not performed in this source repair.
