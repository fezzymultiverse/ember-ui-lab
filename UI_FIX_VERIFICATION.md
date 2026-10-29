# UI fix verification — Ember V1.9.50 source ZIP

The focused JavaScript syntax check passed for every file under `www/`. The focused regressions passed: V1.9.45 motion, V1.9.42 timeline, V1.9.41/42 additive thinking display, V1.9.40 UI, and V1.9.30 plus-menu behavior.

The final browser UI stability regression passed at 320, 360, 390, 430, and 760 CSS pixels. It checks the rotating-first display, expansion into the dots/icons timeline, fixed status geometry, stable DOM identity, no vertical transform or replayed status animation, plus alignment for empty/single/multiline input, menu rotation and dismissal, error-state updates, history caps, rerender preservation, style cycling, and reduced motion.

A before/after Chromium probe confirms the supplied version created two overlapping status nodes and `matrix3d` vertical transforms during updates; long text changed the header from 30px to about 69px. The fixed version keeps one status node, `transform: none`, and a 30px header while long text is ellipsized. The plus control is fixed at 38×38px and aligned with the other composer controls.

The full legacy `npm test` suite was not used as a release gate because its existing provider test has environment-sensitive failures in both the supplied baseline and the modified project (including rewrite/provider-tag/fallback assertions and a later hidden `#bDeep` click timeout). Those failures are outside this UI patch. No Android device/WebView render or native APK build was performed.
