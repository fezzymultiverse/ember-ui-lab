# Ember V1.10.11 HANDOVER
Status: Settings menu rebuild (UI only). (1) ember_menu.js builds, for the open Settings section, a list of rows (one per .card, name/description/icon from a META table by title or id) and shows one card at a time as a page (.mnu-open); a section with one card opens straight to it. Cards and every id inside them are untouched. (2) Header: new .mnu-bar (back, logo, title, crumb) replaces .sh-t / .sh-logo and the .acc-backbar / .acc-card-backbar are hidden. Back = close the page, or back to the Hub when on the list (same toHub as ember_v108). (3) ember_hub.js rewritten: view stack root > keys > prov, and cc; no drop-downs; ember_hub.css rewritten. (4) app.js: old card-subpage code removed; kList provider drill keeps keyDetailId, window.emberKeysReset() resets it; Core Memory groups are rows (memGrpOpen) instead of <details class="mg">. (5) ember_menu.css (loaded last): shared .mgrp/.mrow/.em-tile, tokens --m-h 42px / --m-act 34px (override of the --row-h/--act-h tokens from ember_v96.css), flat pages, slim controls, permission rows regrouped by tidyPerm() into .prow-act. (6) ember_icons.js: one icon set (EmberIcons.svg/tile).
Verification: node --check on ember_menu.js, ember_icons.js, ember_hub.js, app.js, sw.js. NOT run: any test (tests/v1999-ui-refinement-test.js assertion was repointed to ember_menu.js, tests/v1996-memgroups-test.js and settings-right-panel-test.js still expect the old <details>/card-subpage markup and were not updated), a browser pass, the APK build, a device check. FILE_INTEGRITY_1_9_95.json not regenerated.

# Ember V1.9.95 + settings patch HANDOVER (memory groups, uniform rows)
Status: three Settings changes on top of V1.9.95, version number unchanged. (1) PROVIDER NAMES CARD OUT: ember_ui.js mountNames() no longer builds the card and removes any copy left in the page (paintNames/DEFAULTS kept, unused). The "Engine keys" title still lists the names after a dot (span #provNames); left alone. (2) GROUPED CORE MEMORY: app.js renderMem() now draws Core Memory as collapsible topic groups (Chat notes, About you, Security & OSINT, Music & media, Interests & habits, Projects & building, Other) with a count each. Grouping is keyword-based at draw time, nothing stored changes, every fact keeps its original index so Edit and the X still work. Open/closed per group is saved in localStorage key ember_memgrp_shut (default: all open). Threads list unchanged. (3) UNIFORM SIZES: new www/ember_v96.css, linked last in index.html and added to sw.js FILES. Option rows and full-width controls (switch rows, memory rows, key rows, permission rows, buttons, selects, text inputs) are all 56px; small actions inside a row (Edit, Request, Test, Check) are 44px. Textareas untouched.
Verification: node --check app.js, ember_ui.js, sw.js; grouping logic run in node on 14 sample memories (14 of 14 placed, indexes intact). NOT run: tests/app-test.js or any browser test (no Chromium here), APK build, device check. The 56/44px values are untested on a real screen. FILE_INTEGRITY_1_9_95.json not regenerated.

# Ember V1.9.89 HANDOVER
Status: routing repair + toast placement. (1) providers.js runInner: the two routeStop assignments that aborted the chain on a permanent 4xx are gone, so a 400/402/404/413/422 moves to the next model, key and engine, and Free Mode is still the last resort; strict pin unchanged. (2) PUTER_FALLBACK gains openai/-prefixed ids; ember_puter.js rejected-token text says where to copy the token. (3) ember_v89.css + ember_v89.js: #toast moves above footer.comp (measured, follows the keyboard via visualViewport), wraps to 3 lines.
Verification: node --check providers.js, ember_puter.js, ember_v89.js; tests/routing-fallback-test.js updated (cascade now asserted); tests/v1989-test.js. NOT run: live calls to Groq/Puter/Pollinations (no network here), a browser pass, the APK build.

# Ember V1.9.88 HANDOVER
Status: GitHub Hub rework. (1) PINNED SLOTS: each repo slot has a Pin switch; when all 12 slots are full, adding a repo offers to replace the oldest UNPINNED one (confirm first, new repo is verified before anything is removed, the old repo's cache is cleared). All pinned = clear message. (2) READ FIRST: with the GitHub pill ON, every message first runs EmberGithub.prefetch(): terms from the message (identifiers weigh most) are scored against the synced index paths and cached file text, the best 5 files are handed to the model as text (windows around the hits for big files), and the thinking card shows "Read first". No match is stated honestly. Local, 3.5 s cap, never blocks a reply. (3) The runner copy now lives only in Setup > Advanced (folded); the AI is not told about a runner unless he switches it on.
(4) ADD-ONS OUT: the "More add-ons" sheet (ember_v81.js, 39 tiles) and its row in the "+" menu are removed; the "+" menu items stay. Settings row "Music & Add-ons" is now "Music"; the "Ember add-ons" card is "Music control & documents" (switches unchanged). Media engines got its native place: Settings > Engine Keys > Media engines (button). tests/v1981-test.js (tested only the sheet) removed; v1987 sheet assertion removed. (5) GITHUB PILL OUT: no pill by the message box. Repos are used in chat by default once linked; one switch "Let Ember use my repos in chat" in Settings > GitHub Hub > Home (cfg.chat). Writes still need his explicit message.
(6) BLUE: www/ember_blue.css (loaded last) makes every toggle and selection blue (tinted pill + blue border + light-blue text; switches solid blue); terminal keeps its console colours.
Verification: node --check on ember_github.js, ember_github_ui.js, app.js; tests/v1988-test.js 44 of 44 (mocked GitHub). NOT run: the rest of the existing suite, a browser pass, the APK build.

# Ember V1.9.87 HANDOVER
Status: two keyless integrations behind one router, www/ember_engines.js (+ ember_engines.css, tests/v1987-test.js). (1) PICTURES: Pollinations stays the default; "Forge" (AI Horde, anonymous key, aihorde.net/api/v2) is the second engine: Auto = Pollinations then Forge on failure, or Forge only. Forge answers with an SVG artifact (Save PNG) plus an HTML details artifact. (2) PDF: saving a PDF artifact tries mintpdf.dev then pdfrender.dev (HTML to PDF, anonymous), then falls back to the offline EmberPDF writer. Cloud asks once before the first send. Plain-English routing: "draw a husky in neon" goes to the picture router without the + menu (switch in Add-ons > Media engines). New tile: Media engines (engine choice, status dots, Check buttons, activity log).
Findings: Pollinations audio/TTS and gen.pollinations.ai now need a key (not wired). mintpdf is mintpdf.dev (not .com); the 10/day limit is mintpdf's, not pdfrender's.
Verification: node --check on every www/*.js; tests/v1987-test.js with mocked network (68 of 69 before one assertion regex fix, the fix was not re-run). NOT done: full existing test suite, APK build, device check, any live call to aihorde.net, mintpdf.dev or pdfrender.dev (binary fetch through CapacitorHttp unverified; PDF length/magic checks guard it). NOT wired yet: keyless TTS (Puter txt2speech is the lead), Document engine, grammar check, Tavily keyless, Piston.

# Ember V1.9.83 HANDOVER
Status: 46 add-on tiles (was 21). New: Translate, Rewrite/Polish, Termux script, Summarise, Draft a message, Spark (Runs); Fact-check, Compare, Explain simply, Read a link, Go deeper (Runs); Music Console, Saved Sites, Keys, Scraping, Permissions, Upload a file, Camera/Vision, Paste; Plan my day, Checklist, Recent chats, Share this chat, Usage; Private chat (mode, drives the existing switch). New kind Runs (does one thing now). Verification: Playwright 360x780 (46 tiles, Private chat switch syncs, Keys/Music/Saved Sites/Recent chats/Share/Usage open their screens, no page errors); node --check; tests/v1981-test.js. NOT done: APK build, device check; Spark and Go deeper not run against a live engine.

# Ember V1.9.82 HANDOVER
Status: spacious Settings. New www/ember_v82.css (layout only): roomier tab row, 18px gutters, 18px between cards, 14px between rows inside a card, 50px inputs/buttons, 56px switch rows, hint text at 1.7 line height. Tab hiding (stab-show) kept intact. Verification: Playwright 360x780 before/after of General and Keys; node --check on all www/*.js; tests/v1981-test.js. NOT done: APK build, device check, other Settings tabs (GitHub, Scraping, Hacking, Music, Permissions) not screenshotted.

# Ember V1.9.81 HANDOVER
Status: egg + Thinking dot + More add-ons. (1) The empty-screen egg is now the app icon as an inline SVG (class ev-hero, no .flame orb rules can touch it). (2) A flashing blue dot sits beside every Thinking label: spin style (.et-led), dropdown and summary headers, the live row, and the top engine pill while Ember works; default live status reads "Thinking…". (3) "+" menu has a top row, More add-ons, opening a Manus-style sheet: search, category chips (Create, Research, Connect, Automate, Modes), Recent row, 21 tiles that are Opens / Mode / Starter (all wired to screens and modes that already exist; nothing is sent until he taps send). New files: www/ember_v81.css, www/ember_v81.js, tests/v1981-test.js.
Verification: node --check on every www/*.js; node tests/v1981-test.js (12/12); v1980 puter test 11/11; Playwright 360x780 check of the egg, + menu, sheet, a Mode tile, a Starter tile and the Thinking row (no page errors). tests/v1945-motion-test.js fails the same way on the untouched V1.9.80 zip (stale assertion), not caused by this build. NOT done: APK build, device check.

# Ember V1.9.80 HANDOVER
Status: Puter runs on its auth token (OpenAI-compatible endpoint, no sign-in window). Visual repair 2 in ember_v80.css / ember_v80.js: compact bubbles, tidy reply action pills, left panel vs music console, slim composer, egg = ember-icon.svg, readable key list. Ember is now always told the GitHub Hub exists. Verification: node --check on every www/*.js; node tests/v1980-puter-key-test.js (11/11); keyscan, routing, router, streaming, context, v1978-steps tests pass. NOT done: APK build, device check, Playwright UI tests, live call to api.puter.com. Plan for aifreeforever.com: AIFREEFOREVER_PLAN_V1_9_80.md.

# Ember V1.9.79 HANDOVER
Status: visual repair only. New www/ember_v79.css + ember_v79.js (loaded after style.css). Download cards rebuilt in ember_getmusic.js (.dj-*). Provider names fields get visible borders. Music tabs get a solid band. Free Mode banner no longer overlaps the empty state. Composer border/focus, jump-to-latest button. Not done yet: PDF engine, data box, song finder. APK not built or tested here.

# Ember V1.9.75 HANDOVER
Status: GitHub Hub (slots, token sync, live feed, files, activity). Verification: node --check on every www/*.js only. Run `node tests/v1974-test.js` first on the next machine; the Hub has no dedicated test yet.

# Ember V1.9.45 HANDOVER
Status: thinking motion. Spinner style = turning spinner + rotating status line (no dropdown). Summary card and compact dropdown reveal one thought at a time through a queue in ember_timeline.js (rv / rvAt flags, pump(), flush()).

## Verification
- `node tests/v1945-motion-test.js`, `v1942-thought-test.js`, `v1941-thought-test.js`, `v1928-test.js`, `v1933-test.js`, `v1940-ui-test.js`: passed.
- Android APK/device verification: not performed in this environment.

## Previous (V1.9.42)
Status: thinking-card repair. Title clipping fixed (no background-clip text), ReAct now feeds the single live card via EmberTimeline.upsert(), card collapses as a dropdown when the run/reply ends. README not touched.

## Previous (V1.9.41)
Status: added a third, optional Claude-like animated status-line thinking display. The existing Summary timeline and compact dropdown remain available and are cycled through using the switch icon. The new style shows observable progress/status updates already emitted by Ember, not private internal chain-of-thought. Existing tool actions and saved summaries remain wired to the same timeline data.

## Verification
- `node --check www/ember_timeline.js`: passed.
- `node tests/v1941-thought-test.js`: passed.
- Android APK/device verification: not performed in this environment.
- Full test suite: not claimed; several existing tests require Playwright and live provider services.

## Notes
- The display switch cycles Summary → compact dropdown → animated status line → Summary and persists the selection.
- The animation respects `prefers-reduced-motion`.
- Web search / download rows still come from actual tool events; no fake download completion is generated.
