## V1.9.89
- Routing: a permanent 4xx from one model or key (400, 402, 404, 413, 422) no longer aborts the whole route. The router records it and moves to the next model, key and engine, with Free Mode last. A pinned engine is still strict and shows its real error.
- Puter: provider-prefixed model ids (openai/gpt-5-nano and similar) are also tried; a rejected token now says where to copy it (puter.com/dashboard > Account > Auth Token).
- The toast ("Switched to ...", saved, copied) now floats just above the message box instead of on top of the header and the orange engine pill; long text wraps to three lines.

## V1.9.88
- GitHub: repo slots can be pinned; a full set replaces the oldest unpinned repo after you confirm (Add is never greyed out).
- GitHub: Ember reads the files your message points at before she answers (Read first), shown in the thinking card.
- GitHub: cloud runner wording only appears in Setup > Advanced.
- Add-ons sheet removed (Settings: Music; Media engines moved to Engine Keys). GitHub pill removed; repos work in chat once linked (switch in GitHub Hub > Home).

## V1.9.86
- Download card ("Saved to your phone") is no longer clipped to its header row: the chat column used to squeeze it. It now keeps its full height (file name, bar, status).
- A finished download gets a green Play button, in the chat card and in the Music > Get jobs list. It finds the track in the library (scanning Music/Ember if it is not listed yet) and plays it in Ember's player.

## V1.9.85
- Left menu: the tabs now read Prompts, Chats, Projects (Prompts first, Chats second).
- Left menu: Usage removed. It is now a Usage card in Settings > General (replies per engine, today and this week).
- Left menu: Notes removed. Notes is now the first row in Browser > Documents and opens the same Notes sheet.
- Settings > Keys > Provider names: the "tap to rename" line, the rename boxes and Reset names are gone. The card is just the engine names in padded rows. Names saved by the old rename boxes are cleared so every engine shows its real name.

## V1.9.84
- Settings is a vertical accordion: 7 slim rows with longer names and a one-line description each; tap one to open its cards under it (one open at a time, plain Settings opens folded). Header: close button, "Ember" (the AI's own name) over "Settings", the app icon on the right edge. Neutral grey controls, thin hairlines, no coloured top bars, slimmer buttons and fields. The old tab strip is hidden but still drives the sections, so every shortcut into Settings still lands on the right one.
- Reply actions: Save, Save .md and Note removed. Copy is grey, Again is orange.
- GitHub pill by the message box: off by default; on = Ember's GitHub tools (read, and write where a repo slot allows) reach the AI.
- Blue accent #3d8bff on switches, text fields, the composer focus ring, chips and selections.
- Puter has a real token slot (Settings > Keys > Puter): paste, Save token, Check, Remove. No email, no sign-in window, nothing opens in a browser.
- Settings > Keys > Provider names: the name, a "Tap the box below to rename" line and the box each sit on their own line, so nothing is squeezed or cut off.
- Left menu: Imagine removed. "+" > Create image routes the next message to Pollinations (flux, no chat engine) and Ember answers with an HTML artifact: the picture, her thought process (live in the thinking card and saved in the artifact), the prompt sent and the settings. One-shot: it switches itself off after the picture.
- "+" menu: Paste, Copy and Device tools removed (Device tools now live in Settings > General). New Think group in this order: Reasoning, Go deeper, Learn, Spark.
- Modes pill by the box (shows the current mode): Chill, Sharp and Deep sit inside it.

## V1.9.83
- Add-ons sheet: 25 more tiles (46 total) across Create, Research, Connect, Automate, Modes. New tile kind Runs for one-tap actions (Spark, Go deeper).

## V1.9.82
- Settings is more spacious: bigger gaps between cards and rows, roomier tabs, taller inputs, buttons and switch rows, easier-to-read hint text. CSS only.

## V1.9.81
- Egg on the empty screen = the Ember app icon (inline SVG, breathes slowly). The old orange orb styles no longer apply to it.
- Flashing blue dot beside Thinking in every thinking style, the live row and the top engine pill; live status text defaults to "Thinking…".
- "+" menu: new top row More add-ons opens a Manus-style Add-ons sheet (search, categories, Recent, Opens / Mode / Starter tiles). Modes: Web Search, Reasoning, Code Mode, Device Access. Starters: Make a PDF, Build a page, Slide deck, Wide Research, Timer / Reminder.

## V1.9.80
- Puter: auth token as the key via https://api.puter.com/puterai/openai/v1 (OpenAI-compatible). Removed the puter.js sign-in path. Paste & detect files a bare Puter JWT under Puter; Puter is in the manual provider list; Get-key button opens the Puter dashboard. Chat models only (embedding, image, audio models skipped); no temperature sent.
- Fixed: pinned Puter said "no Puter key is saved" because the old build never stored a real key.
- UI: user bubbles compact (text and time on one line); Ember reply actions are one row of equal pills with the time above; left panel rows compact and the Music Console bar is raised, brighter, shows the track and has a play button; composer is one slim dock (chips scroll sideways, modes row hides while the keyboard is open); the empty-state egg is the Ember logo SVG; key groups show "N working" and wrap long text.
- GitHub: EmberGithub.stateBlock() always describes the GitHub Hub (before: nothing was sent until a token and a slot existed) and persona.js includes it even when no tool set is on.

# Ember V1.9.77
- Interface pass, Manus-style: calmer black canvas, wider gutters, softer cards, pill buttons, one orange accent. Pure CSS (final layer at the end of style.css), no logic changed.
- Chat box is black again (an old white-composer rule was winning). Header buttons are an even 38px round set: the Termux icon is no longer squeezed and the engine name is never cut.
- Replies: clean sans text, 1.75 line height, real spacing between paragraphs, lists and code; bullets no longer hang off the edge; action row wraps into thumb-sized buttons. Your own messages are a soft right-aligned bubble.
- Music > Get: the three tabs stay on one row, Track / List playlist / Whole playlist and the Downloads and Saved cards no longer crush; sections have room.
- Drawer, Prompts, Projects, Settings tabs and cards: roomier padding and consistent radii.

# Ember V1.9.76
- Learn add-on (www/ember_learn.js): teach Ember from links. Plus menu > Learn, or just ask in chat. Pages are read through the existing scraper (your keys and provider order apply) and saved into Documents, so the normal document search finds them. Nothing is trained.
- Learn from a document: pick a saved document (e.g. a research .md) and Ember learns every link in it. GitHub repo links become Reference repo slots (needs your GitHub token, then sync in Settings > GitHub); without a token the repo page is read as a plain page. github.com/.../blob/... links are fetched as the raw file.
- New tools: learn_url, learn_from_document, list_learned, refresh_learned, forget_learned. Learned documents start with an untrusted-content header. Re-learning a link updates its document instead of duplicating it. Refresh all / Forget in the panel.
- Wired with one line each in app.js (tool catalog + dispatcher), persona.js (tool list), ember_plus.js (menu), index.html and sw.js. Nothing existing was changed.

# Ember V1.9.75
- GitHub Hub: new Settings > GitHub tab with Home, Repos, Sync, Files, Activity and Setup views (www/ember_github_ui.js). The old GitHub card in Keys now points to it.
- Repo SLOTS (12): add owner/name or a github.com link, or pick from your own account. Per slot: nickname, branch, Mine (read+write) or Reference (read-only), write switch, sync switch, depth (Map only / Key files / Deep read).
- Sync runs straight from the token, no runner: branch head check, full file tree (the index), only changed files re-read, then a repo profile built by code (stack, folders, key files). Master sync switch, auto-sync with interval, Sync all, Stop, Re-read all, Clear cache.
- Live view: per-repo progress and a live feed of every file indexed, read, new, changed or removed, with filters and recent sync history.
- Files view: browse the synced index, search paths or code, open a file, copy it, open it as an artifact. "Open report as artifact" on Home.
- AI knowledge: the repo profiles and hard rules go into her instructions (ground truth, read before explaining or editing, no invented paths, no placeholder pushes, say only what tool results say, professional report style, deliver as artifacts).
- New tools: github_repos, github_sync, github_repo_map, github_find. github_read_file / list_files / write_file take a repo and pick the slot from his words. Writes refuse files not read this session, files changed since, truncated or placeholder content, and big accidental shrinks.
- Activity tab logs every GitHub call the AI makes. Thinking card shows live labels for the new tools.
- The Actions runner is now OPTIONAL and off by default (Settings > GitHub > Setup).
- Secrets in cached file text are masked; .env and key files are never read.
- Not run or device-tested in this build (syntax check only).

# Ember V1.9.74
- Repo reading: Ember now has to read a file after repo_search. New hard rule in the system prompt (persona.js, only when a repo is linked and repo_read_file is available): if repo_search returns a list of files it MUST use repo_read_file on the most relevant one before answering, and it never writes code based on assumptions. Same rule in the repo state block and in the repo_search / repo_read_file tool descriptions.
- repo_search results now say, in the result itself, that they are paths only and a repo_read_file call must follow.
- repo_read_file uses the path exactly as given. If the path does not exist it now fails with a clear reason plus `did_you_mean` (real paths this repo returned earlier, else a file-name search), so a guessed path like lib/scrapy/... gets corrected instead of ending the attempt.
- Test: tests/v1974-test.js.

# Ember V1.9.73
- OpenRouter removed entirely: provider entry, router order, key scanner / sorter, Settings dropdown and hints. A saved OpenRouter key or pin is ignored.
- Bojack easter egg card removed (chat reply, icon card and its CSS).
- Sting scraper: the endpoint is now a plain generic `https://` URL. Ember calls it with `?url=<page>` and sends the key as a Bearer / x-api-key header. Endpoints saved with the old `{key}` / `{url}` placeholders still work.
- Left-panel Music Console now shows the cover art (same artwork as the full player, 🎵 fallback).
- Lyric thought bubbles (`www/ember_lyric_thoughts.js`): while a song plays and lyrics are found, the persona sometimes has a passing thought about the current line. Shown as a thought bubble in the chat, not saved in the conversation. Uses the existing Lyrics switch. First thought 30-70 s into a song, then every 80-200 s, max 5 per song; paused in the background, with a panel open, during a reply or a crisis state. The last thought is given to the AI for 10 minutes so he can reply to it.
- Project Workspace (`www/ember_projects.js`): new Projects tab in the left drawer. Create a project (Name, Goal, GitHub repo link), open, edit, delete. The open project's name, goal and repo are added to the system prompt on every message (not during a crisis reply). Saved in localStorage `ember_projects`. A chip under the header shows the open project.
- Tests: `tests/v1973-test.js`; OpenRouter references removed from older tests and tools/diag.js.
- Not device-tested.

# Ember V1.9.72
- GitHub Classic token: new card in Settings > Keys (token + owner/name repo, Check token, Install runner). Stored in localStorage `ember_github`, never in backups, never shown to the AI.
- New `www/ember_github.js` tools (appear only while a token is saved): github_status, github_list_files, github_read_file, github_write_file, github_run, github_run_status, github_install_runner.
- Cloud runs: github_run dispatches the installed `Ember Run` workflow (Ubuntu, Node 20, Python 3.12, Java 17). The log is committed to the `ember-results` branch, files copied to `$EMBER_OUT` become a Release, and Ember reads both back. Live progress shows as one row in Thinking (GitHub icon, step name, % bar).
- Gates: writes need a push/save/commit message that mentions GitHub or the repo; runs need a run/build/test/compile message; the runner is only installed when asked (or by the Install runner button). Writes under `.github/` and content that looks like a secret are refused.
- UI pass (closer to Claude and Manus): warm near-black surface, neutral soft user bubble (was bright orange), Ember's replies as plain book-style text, calmer action row, blue flashing light beside the Thinking status, a steps counter (done/total) and a green tick on every finished step. Artifacts were already supported (<artifact> blocks: markdown, document, PDF, SVG, HTML, code, JSON, CSV).
- Reference repos: link up to 8 GitHub repos (Settings > Keys > GitHub > Reference repos, with one-tap suggestions: SWE-agent, Aider, OpenHands, github-mcp-server, MCP servers and SDK). Nothing is cloned. Tools repo_overview, repo_list_files, repo_read_file and repo_search read them live; public repos need no token (a saved token only raises the rate limit; repo_search needs it).
- Claude engine: new provider `anthropic` (Messages API, direct from the phone with the browser-access header). Model list comes live from /v1/models; replies stream; native tool calls work. It is PAID, so it is never in the automatic order: it answers only while pinned in the Providers chip. Pasting an `sk-ant-` key anywhere now files it as a Claude key.
- Version label, service-worker cache and package.json now agree (1.9.72).
- Not device-tested. Needs a Classic token with `repo` + `workflow` scopes. A public repo makes logs and Release files public.

# Ember V1.9.70
- UI: white on black with orange highlights everywhere (blue/cyan/purple accents removed).
- Thinking: no card, border or grid. The egg is the app icon (ember-icon.svg) with an orange arc orbiting it; it spins, then each step drops in one by one. Real icons per step: YouTube, Files, Termux, Globe (plus music, image, graph, egg for engines). Finished turns collapse to "Thought for Xs" with the same icon rows.
- Artifacts: real PDF files (new ember_pdf.js, offline, no libraries), Word (.doc) export, SVG preview + PNG export, documents shown as paper pages, dark Markdown viewer. Ember's prompt now creates pdf / document / svg / markdown artifacts.
- Bojack egg uses ember-icon.svg instead of the PNG.

## V1.9.69
- Removed the warm multicolor glow from the main chat canvas, made the textarea itself explicitly white, and changed composer focus/send accents to blue so the reply surface no longer reads orange.

## V1.9.68
- The live header now shows the current activity label directly, and the Thinking timeline gets a visibly pulsing blue light immediately beside its label (reduced-motion respected).

## V1.9.67
- Unified the Termux tab family with the same single active accent as other tabs and desaturated the music-tab emoji glyphs.
- Updated the chat easter egg to use the exact 512px launcher app icon asset.

## V1.9.66
- Extended the single-color active state to the Chill/Sharp/Deep lane selector as well as settings and navigation tabs.

## V1.9.65
- Unified tab styling to a single solid accent color, removing multicolor active gradients.
- Refined Ember’s actual Thinking timeline with a soft rounded dark panel, subtle orange accent, dashed connector, clearer activity nodes, and reduced-motion-aware active pulse.

## V1.9.64
- Restored the white reply composer against Ember’s dark canvas, with dark text, legible placeholder, cyan focus ring, and higher-contrast composer controls.

## V1.9.63
- Added structured artifact cards for assistant <artifact> blocks, safe downloads, sandboxed HTML Live Preview, a per-chat Artifact shelf, and Save .md for ordinary assistant replies.
- Markdown artifacts render headings, lists, inline links, tables and code; code artifacts include syntax coloring, Copy, and an Android-only Open in Termux action that copies code but never runs it.
- Added Save PDF via the browser print dialog for Markdown/HTML artifacts, chat context badges, filename-aware Writing activity status, and a reduced-motion-aware completion pulse. Existing Copy/Regenerate/Read-aloud actions remain.
- Added artifact-generation guidance to the assistant prompt for explicit deliverables. PDF export depends on the device/browser print-to-PDF facility; PDF-tagged output itself remains source content.
- Ember already offers Gemini and EasyVoice TTS voices with voice audition controls; no cloned/custom voice was generated or added.
- Added artifact regression tests, service-worker cache entry and app version bump.

## V1.9.61
- Added a blue live activity indicator/status in the header and a STOP control in both live thinking-card layouts. The control routes to Ember’s existing current-turn cancellation flow; it does not claim per-tool remote cancellation.
- Limitation: no Manus task-control endpoint is configured in this source project, so Pause and remote per-action stop are not implemented.
- Validation: JavaScript syntax checks pass. Existing checks requiring Playwright could not run because Playwright is absent in the supplied environment; no Android-device verification performed.

## V1.9.42
- **Fixed: "Thinking..." title losing letters ("Thi king...").** The animated gradient text (background-clip:text) rendered as a grey box on some Android WebViews. The title is now plain text with a colour pulse; reduced-motion respected.
- **One thinking card for every run.** The ReAct "Summary" card (ember_think_inline.js) used to be a second card that was wiped by every chat re-render and never saved. It now feeds the main card (EmberTimeline): thoughts, skipped / repeat / blocked actions, approval waits and the final step. Real tool calls still arrive through runTool(). The old card remains only as a fallback when no live timeline exists.
- **Dropdown behaviour.** Open while working, collapses 0.8s after a ReAct run ends and when the reply lands (saved "Thought for Xs" row, tap to re-open). Bigger header tap target and chevron button, soft open/close, accent sweep on the top edge while running.
- ReAct steps now persist in the saved row, including SKIPPED / REPEAT / BLOCKED pills and error text.
- Tests: `tests/v1942-thought-test.js` added, `tests/v1941-thought-test.js` made version-agnostic, `tests/v1928-test.js` still passes (20/20). Not tested on a device.

## V1.9.41
- Added a third optional Claude-like thinking display: animated three-dot indicator, live status line, expandable progress log, and a completed “Thought for Xs” summary.
- Preserved the existing Summary timeline and compact dropdown; the switch cycles through all three styles and saves the selected style.
- Uses observable progress notes and real tool events only; does not display or claim access to hidden internal reasoning. Reduced-motion preferences are respected.
- Added `tests/v1941-thought-test.js`. JavaScript syntax and targeted regression checks pass; Android-device verification not performed.

## V1.9.40
- Restored a dark composer with readable light text; removed the white input-pill regression.
- Moved Paste, Copy, Device, Reasoning, Spark, Go deeper and Normal mode into the + menu to reduce composer clutter.
- Rebalanced thinking-card accents toward neutral grey/white while retaining Ember orange as a secondary accent.
- Kept YouTube search/download tool labels in the timeline so real tool calls show search followed by download when both run.

# Changelog

# Ember V1.9.71
- Composer: + button inset and aligned with send; flat mic/talk icons; wider text column (Talk hides while typing).
- Knowledge Graph: Unicode-aware words (no broken fragments), no code/links/ids, English+Afrikaans filler skipped, only topics shared by 2+ sources, cleaner layout.
- Downloads: playlist jobs returned to Thinking; one row per download with live % bar; row keeps updating inside the saved "Thought for Xs" after the turn ends; direct NewPipe route only fires on real download requests.
- Thinking labels/icons now match the real action (play, pause, skip, library, timers, etc.).
- New tool play_song: library first, else NewPipe search -> save to Music/Ember -> play in Ember's player.
- Not device-tested.


## V1.9.45
- **Spinner style (the first card) now spins and rotates instead of dropping down.** The status-line display is a turning two-ring spinner with ONE status line. When the status changes, the old line rotates away and the next one rotates in (3D flip). The dropdown body, chevron and tap-to-open are gone from this style; the full list still shows in the saved "Thought for Xs" row after the reply. The DOM is kept between updates so the spinner never restarts or jitters. Reduced-motion: slow spinner + plain fade.
- **Summary card (the second card) drops down thought by thought.** Events that arrive in a burst (Reading your message, Quick lane, Loading the chat, Choosing the best engine, Asking ..., tool calls) used to land on screen all at once. New reveal queue in `ember_timeline.js`: the first thought shows at once, every next one drops in after its own beat (about 0.5s, faster when a backlog builds), the tool row shows RUNNING then flips to SUCCESS / FAILED in place, and "Thinking..." stays pinned at the bottom. Same queue feeds the compact dropdown. Nothing is lost: lines still waiting when the reply lands are kept in the saved row.
- A repaint in the middle of a drop (for example RUNNING -> SUCCESS) carries on the animation instead of snapping.
- Files: `www/ember_timeline.js`, `www/style.css` (appended CSS), `www/sw.js` (cache `ember-v1.9.45`), `package.json`, `www/index.html` version text.
- Tests: new `tests/v1945-motion-test.js`; `v1941` and `v1942` thought tests made version-agnostic and brought up to date with the V1.9.43 default style. NOT tested on a device.

## V1.9.39
- **Thinking card now follows the mockup.** While Ember works the card glows orange, the header shows a spark and shimmering "Thinking…", which switches to "Executing Tool…" while a tool runs. Rows drop in one by one. When the reply lands the header becomes a muted "Thought for Xs" and the card stays above the reply, collapsed (tap to open). Same look for the ReAct card (`ember_think_inline.js`), which now collapses 0.8 s after the run ends. Files: `ember_timeline.js`, `ember_think_inline.js`, CSS appended to `style.css`. Cache `ember-v1.9.39`.
- **Bug fixed:** the RUNNING pill and "Executing Tool…" never showed while a tool ran (the line was marked running after the repaint). `tool()` now repaints.
- Test `tests/v1928-test.js` updated for the new header text. NOT tested on a device.

## V1.9.38
- **White message box.** The reply box pill is white with dark text, grey placeholder and a light "+" circle; the orange ring shows on focus (`www/style.css`, appended CSS only). Cache `ember-v1.9.38`. NOT tested on a device.

## V1.9.37
- **Modifier bar shows every pill.** Paste, Copy, Device, Reasoning, Spark, Go deeper and Normal now wrap onto a second line instead of scrolling sideways, so Spark / Go deeper / Normal are no longer cut off at the screen edge (`www/style.css`, appended CSS only; same buttons, same behaviour). Cache `ember-v1.9.37`. NOT tested on a device.
- Checked against the UI concept in a real browser: Summary timeline (grey dot, terminal icon + pill, orange radar), orange tool card, provider rows (status dot, model, latency, Rate limited / Retry in Ns) and pills with orange glow all render as drawn. Cost per 1k tokens is still not shown: Ember has no real price data.

## V1.9.36
- **Two thinking styles.** Tap the arrows button on the thinking card to switch between the Summary timeline (dots, terminal icons, pills, radar) and the dropdown (shimmer "Thinking..." with text lines). Your pick is kept. The saved row above a reply follows the same style.
- **Richer steps on every reply** (`app.js`): Reading your message, Deep or Quick lane, Loading the chat and settings, Choosing the best engine, then "Asking <engine>", then "Got a reply from <engine> (model) in Ns", then the existing results note. Cache `ember-v1.9.36`. NOT tested.

## V1.9.35
- **Message box:** the "+" is now drawn with two bars (CSS), so it is centred in its circle instead of sitting skewed; it still turns into an x when open. Message box text 15px to 16px. Cache `ember-v1.9.35`. NOT tested.

## V1.9.34
- **Summary timeline design restored** in `www/ember_timeline.js` (grey dot = thought, terminal icon = tool call with RUNNING / SUCCESS / FAILED pill, orange radar = "Thinking..."). It had been replaced by a shimmer text panel. Saved row reads "Worked through N actions". CSS appended to `style.css`. Cache `ember-v1.9.34`. NOT tested.

## V1.9.33
- **A reply can no longer freeze on "Thinking…".** Cause found in the code: in Auto mode the router tries Free Mode, then every engine, key and up to 3 models in turn, each with its own 15 to 60 second wait, and the panel showed nothing while it did. Deep lane, Reasoning and long "step by step" asks make that worst. Now: (1) `app.js` gives every reply 100 seconds (`REPLY_MS`), then stops trying engines (`Prov.abortInflight`, new in `providers.js`) and shows "No reply after 100 seconds ... Tap resend, or pin a different engine"; (2) the thinking panel says which engine it is asking ("Asking Groq (model)…") through a new `ember-try` event, so a stuck engine is visible.
- Not changed: the engines' own timeouts, and the handoff to the background worker (it only runs when the app is in the background).
- Tests: new `tests/v1933-test.js` (4). NOT tested on a phone; I could not reproduce the freeze here, so the deadline is a safety net and the "Asking ..." line will show you which engine is slow.

## V1.9.32
- **Paste keys card (Settings > Keys, top)** (`www/ember_pastekeys.js`, markup in `index.html`, `.pk-*` in `style.css`). **Paste & detect** reads the clipboard (or use the box and **Detect** if the phone blocks it), the one key finder (`EmberKeyScan`) works out which key belongs to which provider, and only keys not saved yet are filed (chat engines are tested live, scraper keys join the rotation, Audd.io and EasyVoice go to their own settings). The result is a named list: provider, masked key, **NEW · saved** / **already added** / slot already has a different key.
- Key-like strings with no provider name beside them are never guessed. Each is listed with a provider picker and a Save button that files it under the one you pick.
- **Copy named list** copies every saved key as `Provider: key`, one per line, only when you tap it.
- `app.js`: exposes `window.emberToast` and `window.emberRenderKeys` for the card. Cache `ember-v1.9.32`, `ember_pastekeys.js` added to the service worker list. Existing paste boxes (Keys notes, Notepad, Scraping) are unchanged.
- Tests: new `tests/v1932-test.js` (13, Node, real key finder and stores, no network). `tests/v1930-test.js` no longer hard-codes the cache version. NOT tested: on a phone or in a real browser (clipboard permission, layout).

## V1.9.31
- **Thinking timeline for every reply** (`www/ember_timeline.js`, new add-on, classes `.et-*`). Until now the "Summary" card (`ember_think_inline.js`) only appeared during a `run_react` job. Now, while Ember works on any reply, a card replaces the three typing dots: grey dot = a thought or step, square terminal icon = a tool call with SUCCESS / FAILED, orange radar = "Thinking…". The × collapses it. Tool rows come from `runTool` (chat, plan and ReAct calls).
- During a `run_react` job the older Summary card stays in charge and the new live card hides, so there is never a double card. When the reply lands, the timeline is saved on that message as a collapsed "Worked through N actions" row; plain answers keep none.
- `app.js`: `runTool` now wraps `runToolRaw`; `typing()`, `renderLog`, `bub` and `reply` hook the timeline. `index.html`, `sw.js`, `style.css` updated. Version 1.9.31.
- NOT tested: nothing was run for this change (no Node suites, no browser, no device).

## V1.9.30
- **"+" button on the left of the message box** (`www/ember_plus.js`, markup in `index.html`, `.plus` / `.pmenu` / `.pchip` in `style.css`). Opens a menu above the box. Toggles stay on and show a removable orange chip above the box (remembered between launches): **Device Access** (turns the Documents tools on and tells the model it may use them and the Termux panel), **Web Search** (the model must search before answering anything factual), **Reasoning** (always the deep lane, step-by-step instruction), **Code Mode** (code first, fenced and complete). The prompt text is added in `uiStateBlock()`, the lane in `laneFor()`, the Documents switch in `toolCatalog()` and `runTool()` (`app.js`).
- **Do-it-now items** put their result in the message box as a block he can edit before sending: **Upload File** (text files: first 20,000 characters; images: read by the image reader; audio: song ID), **Camera / Vision** (opens the camera, shrinks the photo to a JPEG, describes it and copies out any text), **Audio Context** (records 10 s from the mic and identifies the song through Audd.io).
- Photos go to Pollinations' free image reader (the same one `see_image` already used), so they only work while Settings > Vision is on. The Vision hint text says so. Song ID needs the Audd.io token already in Settings > Music.
- Docs and the Chill / Sharp / Deep pills stay where they were.
- `CAMERA` permission added to `apply_android_patch.py` and `AndroidManifest.additions.xml` (rebuild the APK; without it the camera picker cannot open).
- Cache name `ember-v1.9.30`, `ember_plus.js` added to the service worker list. Tests: new `tests/v1930-test.js`.
- NOT tested: on a phone (camera, microphone, real Audd.io and Pollinations calls). The Privacy table's Vision row now says photos from the + menu go to Pollinations.

## V1.9.29
- **Tool-execution card (no raw JSON).** The download card in the chat (`cardHtml` in `www/ai_agent.js`, `.act-*` in `www/style.css`) is now a card with an orange border: music note, "Downloading Audio", the file name, a glowing progress bar and a "Saving to Music/Ember" + percent line. Done = green "Saved to your phone", failed = red with the reason. Same `dl-<id>` element id, so the live updater in `app.js` still replaces it in place. The Music > Get tab keeps its own step timeline.
- **Provider dashboard.** Each engine in the header Providers dropdown (`www/ember_prov_ui.js`) is a card: status dot, name, the model the best key uses, and on the right the real latency of the last reply or check (`⚡ 120ms`) plus the key count. A resting engine is dimmed and says "Rate limited / Retry in 30s", counting down every second while the dropdown is open. A rejected key says "Rejected" and why; no key says "No key". New `Prov.detail(id)` in `www/providers.js` (model, latency, keys, retry seconds) and every successful reply and health check now stores its latency (`lat`) and model on the key.
- **No prices.** The mockup showed a cost per 1k tokens. Ember has no real cost data (free tiers, keys of different plans), so no number is shown; inventing one would be wrong. Say if you want a per-engine price you type in yourself.
- **Pill modifier bar.** Chill / Sharp / Deep and the Device, Reasoning, Spark, Go deeper toggles above the message box are now rounded pills; an active pill gets the dim orange fill, orange border and glow (CSS only, same buttons and behaviour).
- **Thinking timeline reads as sentences.** Tool steps show "Searching YouTube: “gunna”" instead of a tool name, no raw arguments; the active line says "Synthesizing final answer" once the model has answered.
- Tests: new `tests/v1929-test.js` (12), `tests/v1928-test.js` updated (20). NOT tested: on a device or in a real browser (layout, glow, countdown), real latency numbers from live engines, `Prov.detail()` against a real key list.

## V1.9.28
- **"Summary" thinking timeline in the chat** (`www/ember_think_inline.js`, styles `.tl-*` in `www/style.css`). While a reasoning run (`run_react`) is active, a card follows the new design: grey dot = a thought, square terminal icon = a tool call with a SUCCESS / FAILED / SKIPPED / REPEAT / WAITING pill, orange radar ping = the active "Thinking..." step (says "Running <tool>" while a tool runs, "Waiting for your approval" at the gate). Dashed line joins the steps. Header "Summary" shows steps and elapsed time (ticks every second). Card collapses 1.8 s after the run ends; tap the header to open it again; the x dismisses it for that run. All text is escaped; the final reply is not duplicated in the card. The older `.atk-*` card style is removed.
- `ember_think_inline.js` added to the service worker file list (it was missing), cache name `ember-v1.9.28`.
- Tests: new `tests/v1928-test.js` (20, fake DOM, in `npm test`). NOT tested: on a device or in a real browser (layout, radar animation), a real `run_react` run.
- **One key finder for every paste box** (`www/ember_keyscan.js`, loads before `providers.js`). Replaces the two old extractors. Fixes: `Name: key  Name2: key2` on one line, blank lines after a label, Cohere key under its label, `CO_API_KEY`, key before its name, hex-only labelled Mistral keys, Audd.io and EasyVoice keys, Bright Data key and zones.
- **Several keys per provider** (`ai_scraper.js`): first = primary, rest = extras (max 8), never overwritten. Extras take turns and cover for a key that is rejected, out of credits or rate limited (401/402/403/429/432/433). A 5xx stops at once (no double billing). Tavily extras also cover web search (`ai_agent.js`). Health checks every key.
- **Bright Data** (10th provider, after SerpApi): SERP search backup; Web Unlocker zone makes it a page fetcher, with only a SERP zone it returns snippets flagged degraded. NOT tested against the live service.
- UI: Bright key, SERP zone, Web Unlocker zone, extra-keys list with remove (Settings > Scraping). All three paste handlers use `EmberKeyScan.ingestAll`.
- Tests: new `tests/keyscan-test.js` (44 checks), `scrape-test.js` and `v168-test.js` updated. Version 1.9.14.

# Changelog

## V1.9.27
- **Native function calling.** When a message looks like it needs a tool (search, find, download, get, play, link, music words...), the engine now gets the tool list through its own tool API: OpenAI-style `tools` for Groq/Mistral/OpenRouter/HuggingFace, v2 `tools` for Cohere, `functionDeclarations` for Gemini (`call()` in `www/providers.js`). A native call comes back as the same `<tool_call>` text the app already runs, so the router, schema binding and ReAct loop are untouched. If an engine rejects the tools (400/422) the call is repeated once without them. Loose text calls (V1.9.26) and the tag still work. Tool results follow-up calls carry the tools too, so search -> download can chain. JSON-mode calls never carry tools.
- **Downloads are tagged.** `DownloadWorker.kt` writes TITLE, ARTIST, ALBUM and TRACK into MediaStore: title and artist from "Artist - Title (Official Video)" with the noise removed (else the channel name without "- Topic"), the playlist name as the album, the playlist position as the track number.
- **Whole playlist.** Up to 100 tracks (was 30), read across all pages (`PlaylistInfo.getMoreItems`), queued one after another in a unique work queue per playlist (a failed track does not block the next). Button now says "Whole playlist". The AI tools `playlist_list` and `playlist_download` use the same 100 limit.
- **Covers.** Search and playlist results show the YouTube thumbnail. What you download is remembered (`ember_dlmeta`: thumbnail, artist, album) and the library uses it as the cover when the file has no embedded picture and the online lookup (Deezer/MusicBrainz) finds none.
- NOT done: cover art or tags written INSIDE the m4a file (needs an MP4 atom writer, not safe to ship uncompiled). Other music apps read the MediaStore tags, not the cover.
- Tests: new `tests/v1927-test.js` (11, mocked Groq/Cohere/Gemini) and `tests/v1927b-test.js` (7). NOT tested: real engine tool calls, any Kotlin (never compiled here; uses `Image.url`/`height`, `PlaylistInfo.getMoreItems`, `ExistingWorkPolicy.APPEND_OR_REPLACE`), a device or APK.

## V1.9.26
- **Tool calls written as plain text now run.** Weaker engines (Cohere command-r7b in your screenshots) wrote `youtube_search {"query":"..."}` in a code box instead of the `<tool_call>` tag, so the app showed it as chat text and nothing ever ran (this is why "download" did nothing, regardless of the switch). `canon()` in `www/app.js` now accepts `name {json}`, `name({json})`, a fenced or bare `{"tool"/"name": ..., "args"/"arguments"/"parameters": ...}`, only for tools that exist right now, and removes the code box from the shown reply. A plain mention of a tool name, or an unknown name, is not a call.
- Tests: new `tests/v1925-test.js` (9). NOT tested: a real Cohere reply, a real YouTube download on the phone. The download itself still needs an APK built with the native NewPipe patch.

## V1.9.25
- **Name search no longer says "no info".** Cause: with no Tavily/scraper key the only search was DuckDuckGo's Instant Answer API, which only knows encyclopedia topics, so any ordinary name came back empty. `web_search` now falls through DuckDuckGo Instant Answer -> DuckDuckGo web results (`html.duckduckgo.com`, works in the APK because CapacitorHttp has no CORS limit) -> Wikipedia search. If all of them find nothing, the tool note tells the AI to say so plainly, ask for a city/employer/username, and never invent facts about a person. A Tavily key is still the best option.
- **Web Search and YouTube/SoundCloud download are switched ON once** (they were OFF by default, so "download it" never reached the downloader and lookups never ran). Migration flag `defaultsV1924`; turning a switch off afterwards is kept.
- **📋 Paste and ⧉ Copy buttons above the message box.** Paste inserts at the cursor (clipboard fallback message if the webview blocks it); Copy copies the selection, or the whole box when nothing is selected.
- Tests: new `tests/v1924-test.js` (6), `tests/agent-test.js` 75 (3 new name-search checks, mocks for the new endpoints). NOT tested: real DuckDuckGo/Wikipedia responses from a phone, real YouTube downloads, any device or APK. If downloads still fail after this, the installed APK was built without the native downloader (CI never confirmed green past V1.9.23-1).

## V1.9.23-1
- **CI fix.** `android-actions/setup-android@v3` runs `sdkmanager tools` by default and that package no longer exists ("Failed to find package 'tools'", run #50 failed at that step). Both workflows now pass `packages: ''` so that default install is skipped; the runner already has the SDK and the next step installs platform 34 and build-tools 34.0.0. Later steps (cap add, patch, Gradle) have not been seen to pass yet.

## V1.9.23
- **Phone voices load fully.** The voice list was cached even when the phone's speech engine answered empty (it is often still starting on the first call), so the picker could stay on "Default" with few or no voices. Now an empty answer is never cached, the call is retried (6 x 0.7 s), duplicate voice names get unique ids, and a chosen voice speaks in its own language. New **Reload voices** and **Hear it** buttons plus a count line under Phone voice. If it still says 0, the phone has no TTS engine/voice data installed (Android Settings > Text-to-speech). NOT tested on a device.

## V1.9.22
- **Copy buttons.** Every chat bubble (yours and Ember's) has a `⧉ Copy` button; code in triple backticks now renders in its own box with `⧉ Copy code` that copies only the code. Clipboard fallback for webviews that block `navigator.clipboard`.
- **Music > Get tab (`www/ember_getmusic.js`).** Search YouTube or SoundCloud, paste a track or playlist link, list a playlist, download one track or up to 30, with live progress bars. Uses the existing native `EmberYoutube` plugin (NewPipe extractor). Works without the YouTube AI switch. Finished tracks trigger a phone scan so they appear in the Library. Downloads started here do not post cards or messages into the chat (`silent` flag in `trackJob`).
- **More natural voice.** New "How it speaks" setting (Natural, Lively, Chill, Storyteller). Text sent to the voice now drops markdown, links and code (says "The code is in the chat"), turns headings, list items and line ends into pauses, and expands e.g./i.e.
- **Talk mode (new 🗣 button by the mic).** Hands free: listens, sends when you stop talking (1.5 s of quiet), reads the reply aloud, listens again. Stops after 3 empty listens, on a failed reply, or when you tap 🗣 or 🎤. Needs a Gemini key and mic permission.
- **Music sleep timer.** 15 to 90 minutes, fades volume over 10 s, then pauses and restores the volume.
- Tested headless (Chromium, mocked native plugin): copy of message and code, Get tab search, download, playlist listing, job progress, sleep timer: pass. Existing Node suites pass except `router-test` (same Gemini AQ-key failure as V1.9.21). NOT tested: real YouTube downloads, Talk mode with a real mic, the voice styles against live Gemini, Kotlin. APK rebuild needed.

## V1.9.21
- **Natural-talk downloads.** The download gate (`DL_INTENT` in `www/ai_agent.js`) only opened for download/save/grab/rip/keep/store or a pasted link, so "get me X", "put X on my phone", "add X", "I want X" were refused with "He did not ask to download". Widened to also accept get/fetch/pull/put/add/want/need/newpipe and -ing/-ed forms. The seen-link guard is unchanged: the AI still cannot download a video id that did not come from him or from `youtube_search`.
- **Ember is told it can download.** The agent state block (`stateBlock`) and the TOOLS line in `www/persona.js` now say plain requests count and give the flow: youtube_search, pick best match, youtube_download.
- Tests: 5 new checks in `tests/agent-test.js`. Not run on a device. Reminder: the YouTube switch is OFF by default. Version 1.9.21.

## V1.9.20
- **Download path audited, nothing removed from the code.** `youtube_download`, `playlist_download`, `EmberYoutubePlugin.kt`, `DownloadWorker.kt`, `EmberYtCore.kt` and the NewPipe/OkHttp/desugaring/JitPack patch are all present. `tests/agent-test.js` passes 67/67 (gate, link checks, job start, progress cards). `scripts/apply_android_patch.py` was run against a fresh `npx cap add android` project and wires NewPipe v0.26.5 correctly.
- **Restored the missing CI files.** The V1.9.19 zip had no `.github/` folder, so no workflow could build an APK carrying the native downloader (the app then says the native downloader is missing). Added `.github/workflows/build.yml` (signed release APK, steps as in `docs/ANDROID_BUILD.md`) and `.github/workflows/newpipe-update.yml` (Monday NewPipe bump, commits only if the build passes). `.gitlab-ci.yml` is not restored.
- Reminder: Settings > Music > Ember add-ons > YouTube search & audio download is OFF by default. Kotlin was still never compiled or run on a device. Version 1.9.20.

## V1.9.18
- **Wiring audit, no app code changed.** Checked the three layers for the document tools, `scrape_url`, the router and the ReAct loop, and locked each one in with tests so a future edit cannot silently disconnect them: schema shown to the model (`persona.js` toolsBlock), dispatcher (`app.js` runTool), the ReAct host (`setHost({ run: runTool ... })`), and strict engine pin (a pinned Gemini calls only the Gemini API; if Google rejects it you see Gemini's error, never a Groq answer). The ReAct test drives a scripted model through `run_react` and checks every Action reached the real document tools in order and that the model saw the real result.
- Tests: `tests/v1915-test.js` now 45 checks, all passing. Not run on a device; Playwright suites not run here. Version 1.9.18.

## V1.9.17
- **Document tools checked end to end (tested in Node).** `get_document_outline(fileId)`, `search_in_document(query, fileId?, page?, limit?)` and `read_document_chunk(fileId, chunk, span?)` were already in the tool list the model is shown (via `ai_docs.js`) and already routed to `ember_context.js` by the dispatcher in `app.js`; a new test proves the model sees the real argument names and that each tool really runs. The chunk argument is `chunk`, not `chunkId` (renaming would break the schema and 63 context tests).
- **Hard rule added to the persona (implemented):** with documents in the library, Ember must look in them (use the FROM HIS DOCUMENTS block, else `search_in_document`), never say it cannot read his local files, never guess, and never claim to have read a document it only saw part of. Added only when the library has files and the tool is in the prompt, so it can never promise what is not there.
- Tests: `tests/v1915-test.js` now 34 checks. Not run on a device; Playwright suites not run here. Version 1.9.17.

## V1.9.16
- **Ember knows how it thinks (implemented, tested in Node).** The "about the app" block (`ember_find.js`) now tells every engine, live, what it can do on big jobs: `run_react` (Thought/Action/Observation, 8 default / 10 hard steps, 4 minutes, exact repeats blocked, the 🧠 Reasoning panel with "Approve each action first" and "Edit what it sees"), `run_plan` (up to 12 steps, validated first, 3 read-only steps in parallel, 45 s per step / 120 s total), schema-checked tool calls, the three long-document tools, the 8000-character cut on `read_document` (never claim to have read the rest), automatic document retrieval and the strict engine pin. A test reads the real limits out of the source files so the text cannot drift from the code.
- Tests: `tests/v1915-test.js` now 27 checks. Not run on a device. Playwright suites not run here. Version 1.9.16.

## V1.9.15
- **Strict pin (implemented, tested in Node).** With an engine pinned, a failure now shows the real reason (for example the HuggingFace 403 text) and Ember does NOT silently answer from another engine. Before, the default order put Groq first, so every failed pin landed on Groq. Auto mode and background jobs (titles, memory) still fail over. Unpin = Auto. `Prov.setStrict(false)` turns it off (no Settings switch yet).
- **Free Mode no longer goes first when an engine is pinned** (it failed, cost seconds and fired a "Switched to Groq" toast while already on Groq). The background task (`handoff`) obeys the same rule.
- **"Switched to X" toast** is not shown when the pinned engine itself answered; when it does show, it carries the real reason and stays 6 s.
- **HuggingFace / OpenRouter prototypes:** a 400/402/403/422 on one model tries the next model (5 instead of 3) and no longer marks the key rejected. Only a 401 does.
- **One Ember on every engine (implemented; NOT checked against live replies).** The "you are only the model named above" line is replaced by an IDENTITY line (always Ember, same voice) and each engine gets a one-line voice note (Groq: not terse; Gemini: no assistant prose, headings or bullets; Mistral: casual).
- **Long answers on request (implemented; not run on a device).** If he asks to explain, write, script, break down, or pastes 600+ characters, the sentence limits are lifted for that reply and the cap goes from 350/650 to 1600 tokens.
- **Documents are searched automatically (implemented, tested in Node).** `EmberContext.autoBlock(message)` ranks chunks of his library for every message and puts the best 2-3 into the system prompt for every engine, labelled as data. Nothing is added for greetings, no match, or safety level 2+. Before, the model had to choose to call a tool, so engines that did not call it showed no document knowledge. Plain-text documents only (PDF/Word still unsupported). Keyword ranking, not embeddings.
- **Engine and model name shown under every reply** (Settings > show engine is switched on once; he can switch it off again).
- Tests: new `tests/v1915-test.js` (24 checks). Router, context, handoff, keyscan, scrape, agent, safety, term re-run: pass. Playwright suites (app, v198...) NOT run in this build environment. Version 1.9.15.

## V1.9.13
- **Web search fails over through your scraper keys.** `web_search` order: Tavily (if a key is saved) -> SerpApi -> Firecrawl -> ScraperAPI -> ScrapingBee (each only if its key is saved) -> DuckDuckGo. An engine that errors or returns nothing is skipped and named in the result's `tried` list; `source` says which one answered. A rejected or out-of-credit key is not retried for 10 minutes. With no extra scraper keys it behaves exactly as V1.9.12.
- **New tool `search_and_read(query, objective?, count?)`.** Searches, then opens the top 1-3 distinct pages and returns their text trimmed to a 6000-character budget (whole result stays under the 9000-character tool-result cap). Needs Web Search and Web Scraping both on. A page that only came back as SerpApi snippets is flagged `degraded`; a page that cannot be opened is an error entry.
- **Nine providers take a key.** Tavily Extract joins the url rotation (same key as web search, stored once in `ember_agent`). Octoparse is real: `scrape_url` with `via:"octoparse"` reads the rows of your saved task (Task ID box in Settings > Scraping, or pass the id as the url) from `openapi.octoparse.com/data/all`; `op_sk_` keys go in `x-api-key`. It never joins the url rotation. The Octoparse API needs a Standard plan or higher.
- **Keys never leak.** Every error, tried list, test result, health line and page text passes through a scrubber (all saved keys, `?api_key=` values, Bearer tokens, `x-api-key`). Health shows keys masked.
- **Fix: Delete everything now also removes the scraper keys, the Tavily key and the notepad** (they were left behind before). Backups still never contain them.
- **Fix: Get-a-key buttons** showed lowercase ids; they now show proper names, and Tavily is added.
- **Key extractor hardened**: JSON dumps, escaped JSON, CRLF, Markdown tables, quotes and backticks, several keys per provider, curl lines, two providers on one line, labelless `fc-`/`tvly-`/`op_sk_` keys, placeholders, variable names, url paths, chat-engine keys. A 160-character blob is rejected whole, not cut into 128+32. "testing" no longer counts as the Sting provider. A pasted Sting https endpoint is saved with `{key}` and `{url}` filled in; the https-only rule is unchanged.
- **Tests.** `tests/scrape-test.js` (73 checks) and `tests/agent-test.js` (67) extended and passing against mocked services. The rest of `npm test` was not re-run for this version. Not run against the live services or on a device. APK rebuild needed.
- Version 1.9.13.

## V1.9.13
- **Web search fails over through your scraper keys.** `web_search` order: Tavily (if a key is saved) -> SerpApi -> Firecrawl -> ScraperAPI -> ScrapingBee (each only if its key is saved) -> DuckDuckGo. An engine that errors or returns nothing is skipped and named in the result's `tried` list; `source` says which one answered. A rejected or out-of-credit key is not retried for 10 minutes. With no extra scraper keys it behaves exactly as V1.9.12.
- **New tool `search_and_read(query, objective?, count?)`.** Searches, then opens the top 1-3 distinct pages and returns their text trimmed to a 6000-character budget (the whole result stays under the 9000-character tool-result cap). Needs Web Search and Web Scraping both on. A page that only came back as SerpApi snippets is flagged `degraded`; a page that cannot be opened is an error entry, not hidden.
- **Nine providers take a key.** Tavily Extract joins the url rotation (same key as web search, stored once in `ember_agent`). Octoparse is real: `scrape_url` with `via:"octoparse"` reads the rows of your saved task (Task ID box in Settings > Scraping, or pass the id as the url) from `openapi.octoparse.com/data/all`; `op_sk_` keys go in `x-api-key`. It never joins the url rotation. Octoparse API needs a Standard plan or higher.
- **Keys never leak.** Every error, tried list, test result, health line and page text passes through a scrubber that removes all saved keys, `?api_key=` values, Bearer tokens and `x-api-key` values. Health shows keys masked (first and last four characters).
- **Fix: Delete everything now also removes the scraper keys, the Tavily key, and the notepad** (they were left behind before). Backups still never contain them.
- **Fix: Get-a-key buttons** showed lowercase ids (`firecrawl`); they show proper names and Tavily is added.
- **Key extractor hardened** (Paste & extract, Keys notepad): JSON dumps, escaped JSON, CRLF, Markdown tables, quotes and backticks, several keys per provider, curl lines with the key in the url or a header, two providers on one line, labelless `fc-`/`tvly-`/`op_sk_` keys, placeholders, variable names, url paths and chat-engine keys are handled. A 160-character blob is rejected whole instead of being cut into 128+32. The word "testing" no longer counts as the Sting provider. A Sting https endpoint pasted with its key is saved with `{key}` and `{url}` filled in; the https-only rule is unchanged.
- **Wording:** AI state text, key map, app block, Settings hints and the Test dropdown (Tavily, Octoparse) updated.
- **Tests.** `tests/scrape-test.js` (73 checks) and `tests/agent-test.js` (67) extended; mocked services only. Not run against the live Tavily, SerpApi, Firecrawl, ScraperAPI, ScrapingBee or Octoparse services, and not on a device. APK rebuild needed.
- Version 1.9.13 (`package.json`, service worker cache `ember-v1.9.13`).

## V1.9.12
- **Web search works without a key.** `web_search` still tries **Tavily first** when a Tavily key is saved. With no key, or when Tavily errors out (bad key, plan or rate limit used up, network, not JSON), it now falls back to the **DuckDuckGo Instant Answer API** (`api.duckduckgo.com`, `format=json`, `no_html=1`, `skip_disambig=1`). No key, no account. Before this, search with no Tavily key just returned an error.
- **What DuckDuckGo gives, honestly.** It is an instant-answer service, not a full search engine: an encyclopedia-style abstract (with its link) plus related topics (nested groups are flattened), mapped into the same `{answer, results[title,url,snippet], note}` shape Tavily uses, with `source: 'DuckDuckGo'`. For news and current events it often returns nothing; that comes back as an honest empty result with a note telling the AI to say so and not invent results, not as an error.
- **Which engine answered.** Every `web_search` result now carries `source` (`Tavily` or `DuckDuckGo`). When Tavily failed and DuckDuckGo answered instead, the note says why (for example "Tavily failed (Tavily rejected the key...) so this came from DuckDuckGo."). If both fail, the original Tavily error is returned unchanged; with no key and DuckDuckGo down you get "No Tavily key, and DuckDuckGo ...".
- **Where it is wired in (all of it, not just the handler).** `www/ai_agent.js` (new `ddg_search`, new `web_search` wrapper over the renamed `web_search_tavily`, tool description, the AGENT TOOLS STATE text the AI reads, the settings test button, `EmberAgentAddon.searchEngine()`); `www/ember_find.js` (the live app block no longer says search is OFF without a Tavily key: it says ON through DuckDuckGo only, ON with Tavily plus DuckDuckGo backup, or OFF with "no key is needed"); `www/ember_keys.js` (key map and key-map tool text: the Tavily key is optional); `www/index.html` (Settings > Music > Agent & API Tools: "Web Search (Tavily + DuckDuckGo)", key box marked optional, button renamed **Check search**, privacy table row).
- **Check search button.** With a Tavily key it still spends 1 Tavily credit and says "Works via Tavily". With no key it tests DuckDuckGo with a query it can answer and says "Works via DuckDuckGo"; if the service answers but has nothing it says so instead of claiming success.
- **Privacy.** With no key (or after a Tavily failure) the words the AI searches for go to `api.duckduckgo.com`, with no key and no account. See `docs/PRIVACY.md` and `docs/LICENSE_NOTES.md`.
- **No change** to the Tavily request itself, the stored key (`ember_agent`, still never in backups), the Web Search switch (`agentAddon`, still off by default), or any other tool.
- **CORS.** In the APK `CapacitorHttp` is on, so the call skips browser CORS rules. In the plain web version the DuckDuckGo call depends on `api.duckduckgo.com` allowing browser requests: not tested against the live service from here (the tests mock it).
- **Tests.** `tests/agent-test.js` extended: no-key fallback, request URL, result mapping and flattening, honest empty result, both-down error, Tavily 401/429 with an empty DuckDuckGo (original error preserved), Tavily 401 with DuckDuckGo answering (falls back and says why), Tavily healthy (DuckDuckGo not called), the AI state text, the app block in all three states, the settings card wording and both Check search outcomes. Run against mocked services only; not run on a device. APK rebuild needed for the APK to carry it.
- **Fix: white box in Settings > Scraping.** The "Paste & extract scraping keys" box (`#swPad`) was missing the `pad` class, so it skipped the dark input style and showed white with grey text. It now uses the same dark style as the Keys notepad.
- Version bumped to 1.9.12 (`package.json` drives `versionCode` and `versionName` in `scripts/apply_android_patch.py`; service worker cache renamed `ember-v1.9.12`).

## V1.9.11
- **Header unchanged from V1.9.10.** The Providers chip (the chip icon that drops down every AI engine with live dots) stays.
- **Mic is back, and it no longer needs the phone's speech service.** The 🎤 button sits left of 📎 Docs. Tap, talk, tap again: the phone records, the audio is sent to Gemini (your saved Gemini key) and the words are typed into the message box. Only the recording is sent, only when you tap the mic. Without a Gemini key the old route (Android speech recogniser, then the "Speak now" dialog) is used. Not run on a device: the first tap asks for the microphone permission; if it is refused the toast says where to allow it.
- **ElevenLabs removed** from Ember Voice (settings rows, code, stored key is ignored). Engines are now Gemini voice and Phone voice only.
- **All 30 Gemini prebuilt voices** in the picker (was 18).
- **Termux "process exited with code 254" fixed.** ttyd could not find `bash` in its own PATH (exit 254 is "no such file"). The Setup command now starts `/data/data/com.termux/files/usr/bin/bash`. **Copy the new command from Setup and run it again in Termux** (Ctrl+C the old one first).
- **Ember keyboard for Termux.** ⌨ button in the panel header. The terminal no longer opens the phone keyboard (the hidden input is `inputmode=none`); Ember's own keys (letters, ?123 symbols, shift, backspace with hold-repeat, space, enter, plus the Ctrl/Esc/Tab/arrow row) sit inside the panel, so nothing is pushed up or cut in half. Shown in the full panel; tapping ⌨ in half opens full. Turn it off to get the phone keyboard back. The command line box still uses the phone keyboard.
- **Hacking-tab cards fold by themselves** when the Termux panel is half or full and open again when you minimise it to the bar (only the ones it folded).
- **Termux panel is taller at half** (58% of the screen, was 50%).
- **Screen locked to portrait** (`screenOrientation` added in `scripts/apply_android_patch.py`; needs a rebuild).
- **EasyVoice as a third voice** (Settings > Perms > Voice > Ember Voice > EasyVoice). Paste your free EasyVoice key (easyvoice.ae/account/keys), tap **Test key** (shows plan and characters left) and **Load my voices** (fills the picker with the voices your key may use). Free key: 12 voices, 5,000 characters a day. Uses its MCP endpoint `text_to_speech`, then downloads the mp3. A failure (bad key, daily limit, offline) falls back to the phone voice like the others. Tested against a mock server only: the real service has not been called yet.
- **Mic moved into the message box**, left of Send, round.
- **Settings > Scraping: its own "Paste & extract scraping keys" box** (Paste, Extract keys, Clear), the same idea as the Keys notepad but for the scraping providers.

## V1.9.10
- **Lyrics preview (3 lines).** New `ember_lyrics.js`. A Lyrics card under the now-playing card shows at most 3 lines from LRCLIB (free, no key). With timed lyrics the first line is the one being sung and the next two follow it as the song plays; with plain lyrics the opening lines show. Long-press or hover the song title to see the same lines as a tooltip. The lookup tries exact (artist, title, album, length), then a search, and cleans tags like "(Official Video)" and "- Topic" first. Settings > Music has a **Lyrics preview** switch (on by default).
- **Privacy.** Only the title, artist, album and length of the playing song go to lrclib.net, only while the switch is on. The full lyric text is held in memory for the last 12 songs and is never saved or shown beyond 3 lines. Not sent to any AI.
- Tests: `tests/lyrics-test.js` (LRCLIB mocked, no network). Not run on a device: LRCLIB match rate for your files is untested. APK rebuild needed.

## V1.9.9
- **Ember Voice: a real voice instead of the Android default.** New `ember_voice.js`. Settings > Perms > Voice has an **Ember Voice** picker: **Gemini voice** (on by default, uses the Gemini key already saved in Settings > Keys, 18 voices such as Puck, Charon, Fenrir, Aoede, Sulafat, Algenib) or **ElevenLabs** (your own key, 7 premade voices or any voice ID) or **Phone voice only**. The 🔊 button, auto-read and Test this voice all use it, and the red Stop button stops it. Speed slider applies (0.8 to 1.4); the phone-voice Pitch and Lively sliders only affect the fallback.
- **Gemini voice details.** Models are tried in order and the one that works is remembered (`gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-3.8-flash-tts`); each saved Gemini key is tried in turn on 401/403/429. Delivery asks for a warm, quick-witted tone; when the safety layer has flagged the conversation (level 1 or higher) it asks for a slow, soft, calm tone with no jokes.
- **Never silent.** If the cloud voice fails (no key, rate limit, offline, model has no audio, audio blocked until a first tap) the unread text is read by the phone voice and a short toast says why. Long replies: first 6 chunks go to the cloud voice, the rest to the phone voice. Chunk N+1 is fetched while chunk N plays.
- **Privacy.** Reply text goes to Google (Gemini) or ElevenLabs only when a reply is read aloud and only if that engine is selected; Settings says so. The ElevenLabs key is stored in `ember_voice` on the device and is cleared by Wipe.
- Tests: `tests/voice-cloud-test.js` (fetch and audio mocked, nothing is heard, no network). Not run on a device: voice quality, model names and free-tier limits are untested against the live services. APK rebuild needed.

## V1.9.8
- **Providers chip (header).** A chipset icon left of Ember's name opens a dropdown of every engine (Groq, Mistral, Gemini, OpenRouter, Cohere, HuggingFace, Free Mode) with a live dot: green working, amber rate limited, red rejected/unreachable, hollow grey no key. Opening it lists each key's models (no chat call, no credit). `ember_prov_ui.js`, `Prov.stateOf / ping / pingAll` in `providers.js`.
- **Fix: Gemini showed green with no Gemini key / the AI said it was Gemini.** Health was never re-checked and the picker's first option was a hard-coded green dot. State now comes from `stateOf()`: no key = never green; keys not checked in 30 min = grey "unknown"; real replies and live checks refresh it. The runtime facts told to every model now list the engines with NO key and, in Free Mode, forbid claiming to be Gemini or any named model.
- **Ember's name sits in the true middle of the header** (left group and right group take equal width).
- **Termux:** a command line (`$` input + ⏎, history with the arrow keys, destructive commands need a second tap) runs real commands over the bridge; terminal text is smaller (A− / A+ keys, default 10.5 px, scrollback 500 lines); the panel starts as a bar. **Open Termux folds Ember's panel by itself**, it folds when the app goes to the background, and it never expands again on its own (the ▾/▴ arrow still toggles). The Hacking page no longer slides up to make room.
- **Documents:** the `＋ Files` / `＋ Note` text buttons are one 📎; tap it for two icons (file, note).
- **Dictation button removed** (did not work on this phone); a 📎 Docs button sits in its place. The mic code is guarded so nothing breaks without the button.
- **Fix: app kept restarting after exit.** `EmberKeepAliveService` returned `START_STICKY` so Android recreated it (and its notification) after the app was closed; now `START_NOT_STICKY` plus `onTaskRemoved` stops it. APK rebuild needed. Not run on a device.

## V1.9.7
- **No more fake actions.** If a reply says it searched, looked up, read, downloaded or saved something but no tool ran that turn, `resolveAddonCalls` (`app.js`) now makes one corrective call (do it for real with a tool_call, or say plainly what is off); if it still claims, the reply is replaced with an honest "nothing was done" line. Tool-result synthesis is told to claim only what the result says. A "NO FAKE ACTIONS" rule is in the system prompt.
- **YouTube switch off is now stated.** The prompt tells the model the YouTube tools are off (and where the switch is) instead of letting it pretend to download.
- **Your rules get the last word.** Settings > Persona text is repeated at the very end of the system prompt (it was buried mid-prompt under the tools list).
- **Download notification:** the app asks for notification permission before starting a download (`ai_agent.js`), so the device notification can appear on Android 13+. The chat progress card and "saved" message already existed; they only show when the tool actually runs. Not run on a device.

## V1.9.6
- **Scraper honesty + tool choice.** `scrape_url`'s description now tells the model to use it (not `web_search`) for any scrape/read/open request or link, that it rotates all saved keys itself, and to read its `tried` list instead of giving up. `via` now lists Sting. The SCRAPER STATE prompt block says the AI has live web access when scraping is on, and names saved keys that cannot run (Sting with no endpoint, Octoparse: no fetcher exists). No change to the rotation code. Not run on a device.

## V1.9.5
- **Fix: Termux panel dead (Connect, Terminal, Port, New path did nothing).** `paintSetup()` bound `$('etGo')`, a button V1.9.0 removed, so it threw "Cannot set properties of null" before binding every other Setup button, and because `setState()` called it, `connect()` threw before it opened the WebSocket. Removed the dead line; **Open Termux** now copies the command and opens Termux; `setState` can no longer be broken by a paint error. Found by `tests/term-test.js` (was 51/52).

## V1.9.4
- **Composer box:** removed the brown inner rectangle (the old focus ring drawn inside the pill) and the spellcheck underline; the whole pill glows on focus instead.
- **Hero vs music widget:** the "Evening. Talk to me." block no longer sits under the mini music widget; it now measures the widget + composer height live (`--dock`, `ember_ui.js`). Not run on a device.

## V1.9.3
- **Browser buttons restyled.** The stock white Android buttons in the native browser are now dark rounded pills with a thin border; Ask Ember is orange; the address box is a matching pill (`mkButton` in `EmberWebPlugin.kt`). Kotlin not compiled or run; APK rebuild needed.

## V1.9.2
- **Browser opens as a medium sheet.** The native browser (globe button) now opens as a bottom sheet about 62% of the screen high instead of full screen (`EmberWebPlugin.kt`). Same address bar, progress line, Ask Ember / Save to Documents / Open in Chrome buttons. **Kotlin not compiled or run: first CI build is its first compile.** APK rebuild needed.

## V1.9.1
- Settings > Keys: "Get a key" and "Notepad" cards start folded. Get-a-key buttons are one sideways-scrolling row (also in Scraping). Engine picker shows key health dots (🟢 working, 🟡 rate-limited, 🔴 failing, ⚪ no key / unchecked) and refreshes after a key check. Not run on a device.

## V1.8.3
- **Real browser.** The globe button's Browser sheet now opens pages in a real full-screen Android browser inside Ember (`EmberWebPlugin.kt`: WebView with JavaScript, cookies/logins, back, forward, reload, address bar, progress line, blocks non-web links like intent: and file:). Typing a site opens it with https://; typing words searches DuckDuckGo. Its bottom buttons: **Ask Ember** and **Save to Documents** send the visible text of the page you are on (only when you tap them), **Open in Chrome** hands it to the phone's browser; the Back key walks back through pages and then closes. The sheet's switch (**Real browser: on / Reader view**) goes back to the clean-text reader that uses your scraping keys; if the native browser cannot open, Ember falls back to the Reader view by itself. Real browsing spends no scraping credits. (Written and wired in `ember_native.js` / `ember_browser.js` / `MainActivity.kt` / `apply_android_patch.py`. The JS side is tested with the plugin mocked. **The Kotlin file has NOT been compiled or run: the first CI build is its first compile, and the browser itself has not been seen on a phone.**)
- **Termux connects by itself.** Running a command (a preset, Run on a code block from Ask Ember, or an extra key) while disconnected now connects and waits up to 7 s, then sends it. If Termux is not running or the bridge is down, it says so and copies the command instead. `EmberTerm.ensureOn()` is exported. It cannot START the bridge inside Termux; that still needs the Setup-tab command once per Termux session. (Implemented, tested with a mocked WebSocket.)
- **No more double billing on background replies.** When the app goes to the background mid-reply the request is handed to the native worker. Before, the page kept going too, so one reply was billed twice. Now, if the app is already hidden when the reply starts, the page waits for the worker to accept and then makes no call at all; if it is hidden mid-reply, the call already in flight finishes but no failover call follows. If the worker cannot take it, the page answers itself as before. If the worker's reply never arrives, the chat is freed after 3 minutes with a "tap resend" note. (`Prov.holdInflight` / `Prov.stopInflight` in `providers.js`, `handoff()` in `app.js`.) (Implemented, tested in Node with mocked fetch. The native worker side itself is unchanged and not run on a device.)
- Tests: `tests/handoff-test.js` (6), `tests/v183-test.js` (18, Chromium, native browser plugin and WebSocket mocked). Not run on a device. The APK has to be rebuilt.

## V1.8.2
- **Scraping keys go first and take turns.** Before, the Free reader was tried first, so Firecrawl, Browserless, ZenRows and the others never ran unless the AI passed `via`, while the AI could still say it used them. Now `plan()` in `ai_scraper.js` puts your keyed providers first and rotates the starting one on every page (round-robin, counter kept in `ember_scrape_rot`) so every key's credits are used evenly. The Free reader is only the fallback after them; SerpApi snippets stay last. Naming a provider (`via`) still runs only that one. (Implemented, tested with mocked fetch.)
- **Honest reporting.** Every scrape result now carries `tried`: which providers were skipped or failed and why ("Firecrawl: key rejected (HTTP 401)"). The Browser's note line shows the provider that fetched the page, "(cached)" when it came from cache, and what was skipped. The AI's SCRAPER STATE text no longer says the reader goes first. Settings > Scraping shows the real order. (Implemented, tested.)
- **Credit savers (what could be eating the paid scraping keys).** (1) A 5xx or network error was retried on the same paid key, billed twice; scraping calls now try once and the rotation moves to the next provider. (2) ScrapingBee and ZenRows always rendered JavaScript, which they bill several times over; the first pass is now plain and the rendered pass only runs if the page came back thin (under 400 characters). (3) The same page within 3 minutes is served from memory (20 pages); Reload in the Browser bypasses it. (4) A key that answers 429 rests for 60 s, as 401/402/403 already rested for 10 minutes. (Implemented, tested.)
- **Browser.** Works with keys only: the enable panel now says "Turn on Web Scraping" and only switches the Free reader on when you have no key. A failed page says the reason and points to the open-outside button. (Implemented. Not run on a device.)
- Not changed, found while tracing the chat keys (Groq, Gemini, Mistral...): with Background replies on, the request is handed to the native worker when the app goes to the background while the page's own request may still run, so one reply can be billed twice. Memory learning and chat summaries also make their own small calls (user message 2, then every 6th; and when older messages are condensed). Settings can turn each off (Background replies, Persistent Memory, summaries). Planned: stop the page-side request once the worker has it.
- Tests: `tests/scrape-test.js` (17 checks, fetch mocked, no network, no credits). The HTML-to-Markdown and key-cleaner checks inside `selfTest()` need a browser DOM and already failed in plain Node before V1.8.2; they run in the Chromium suites. Not run on a device. The APK has to be rebuilt.

## V1.8.1
- **The 🔊 on a reply turns red and says "■ Stop" while Ember is reading it.** Tap it to stop; it goes back to 🔊 when the voice finishes or is stopped. It stays red if the chat redraws mid-sentence. (`setSay` / `paintSay` in `app.js`; `.talking` in `style.css`.)
- **Voice is no longer stuck on the Android default.** The Voice picker in Settings > Perms now lists the voices the phone's own speech engine has (own language first, online ones marked) and the choice is actually used by the installed app. Before V1.8.1 the picker only worked in a browser, never in the APK. New Speed and Pitch sliders, a **Test this voice** button, and **Lively delivery** (on by default): per sentence, questions lift in pitch, exclamations speed up a little, trailing "..." slows down; everything is clamped to 0.5-2. (`tts.voices()` and `tts.speak(text, lang, {voice, rate, pitch})` in `ember_native.js`.)
- **The 🎤 is explained.** It is dictation: tap, talk, your words are typed into the message box, tap again to stop. The button's label and tooltip say so, and Settings > Perms explains it.
- **Fix: the left-panel Music Console's "Open Full Music Panel" now draws the panel.** With the composer pill gone it only added the `show` class, so the library, playlists and now-playing were not rendered. It now calls `EmberMusicUI.open()` and closes the menu behind it. The stale "Music pill" wording is gone.
- Tests: `tests/speaker-test.js` (26 checks, native text-to-speech mocked). `music-test` now expects Music in the left panel and not in the composer (48/48; its V1.8.0 timeout was only the removed pill). `voice-native-test` now accepts the deliberate Android "Speak now" popup fallback (16/16).
- Not run on a device. The APK has to be rebuilt. Voice quality, the red button and the sliders are tested against a mock engine only.

## V1.8.0
- **Local Context** (`ember_context.js`). Long documents are never read whole. They are cut into ~1,500-character chunks on the phone (paragraph and heading aware, 150 characters of overlap) and searched by plain string matching, so only the few relevant sections reach the model. No vector database, no embeddings, no new dependency, no new stored data: the chunk index lives in memory and is rebuilt from the text when it changes. Three tools join the document set: `get_document_outline` (size, chunk count, headings or landmarks), `search_in_document` (ranked snippets; ladder exact phrase > all words > most words > any word, the level is reported; `page` and `limit`; omit `fileId` to search every document) and `read_document_chunk` (one chunk, `span` 2 adds the next if it fits, next and previous chunk numbers returned). Every result is sized to fit one ReAct observation. Chunk numbers start at 1. Nothing runs at safety level 2 or higher.
- **`read_document` and `summarize_document` stop hiding truncation.** Long files now come back with `truncated` / `partial`, the real `total_chars` and a hint to use the Local Context tools. Before, a summary of a long file silently covered only its first 6,000 characters.
- **ReAct is now an explicit state graph** (`GRAPH` in `ember_react.js`): THINK, PARSE, FORMAT_FIX, GATE_ACTION, ACT, GATE_OBS, OBSERVE, FORCE_FINAL, DONE, FAILED, STOPPED. Every move goes through `go(event)`, which throws on an edge that is not in the table; the trail is kept in `E.react.state().graph`. Recovery edges: a bad reply goes to FORMAT_FIX and back (twice at most); a failed, repeated or blocked tool call still returns an Observation; running out of steps, time, or three failures in a row forces FORCE_FINAL (answer with what you have). New: an exact repeat of a call that already failed is not run again, and a tool that fails three times in a row is switched off for the rest of the run.
- **`run_react` mode `document`**: only the document tools are offered, plus retrieval rules and an evidence ledger (searches tried, chunks read) kept in the system prompt, because older observations shrink and the chunks already read are what the answer needs.
- **Typed tool binding** (`ember_schema.js`). `runTool` in `app.js` is the one choke point for chat, plans and ReAct, and every call is bound there before anything runs. Tools that declare `schema` (JSON Schema subset, OpenAPI-compatible) are strict: unambiguous coercion only, numbers clamped or refused, enums and lengths enforced, unknown arguments refused, `__proto__` dropped, and a bad call returns a structured error (`problems`, `expected`). Older tools keep their loose `parameters` and are only coerced (numbers, booleans), never rejected, so nothing that worked can break. The three new tools are strict.
- **Fix:** `ember_music_ui.js` assigned `$('bMusic').onclick` but `#bMusic` is no longer in `index.html`, so the file threw on load and everything after that line never ran. Guarded. This was what failed term-test, voice-native-test and agent-test on "no page errors".
- Documents tab: a LOCAL CONTEXT badge with the chunk count on documents over 8,000 characters. Reasoning panel: chips for search words, chunk number, match level and hit count.
- Tests: `tests/context-test.js` (63 checks: chunking, search ladder, read, outline, binding, graph shape and illegal edges, document mode end to end with a scripted model, breaker, format recovery, and the real app in Chromium). Not run on a device. Needs an APK rebuild for the web files to ship.

## V1.7.2
- **ReAct loop** (`ember_react.js`, tool `run_react`). One step per model reply: `Thought:` then `Action: {"tool","args"}`, or `Final:`. Ember runs the action through the normal tool dispatch and returns the result as an Observation. Guards: 10-step hard cap (default 8), 4-minute cap, 45 s model and tool timeouts, repeat detection (the same action is not run twice), 2 format-error recoveries, unknown or banned tools reported not crashed (no `run_plan` or `run_react` inside), the model's own invented Observation is cut, observations are labelled data and older ones shrink, plain-prose replies count as the Final. On the last step it is told to answer with what it has.
- **🧠 Reasoning panel** (`ember_react_ui.js`): live Thought / Action / Observation for every step. Change what it analyses: **Approve each action** (edit the Thought, the tool or its JSON arguments, run, skip or stop), **Edit what it sees** (edit the Observation before the model reads it), **Steer** (a note added to its next step), and Stop. Opens by itself when a run needs you. Two settings kept in `ember_engine`; the trace is in memory only.
- `app.js`: `toolCatalog()` and an `llm` host call (same safety wrapper and router as chat). `run_plan` now also refuses `run_react` steps.
- Not run, not tested.

## V1.7.1
- **Plan-and-Execute logic engine** (`ember_engine.js`, tool `run_plan`). The AI writes a whole plan up front as a DAG of steps `{id, tool, args, after, on_fail}`. The engine validates it before anything runs (schema, tool available, unique ids, real dependencies, no cycles, no nested plan, `{{id.field}}` only from steps it waits for, max 12 steps), runs it in dependency order, runs independent read-only steps in parallel (max 3) and anything that changes something alone, with a 45 s step timeout, 120 s total, `on_fail` stop / skip / retry (2 retries, backoff), and returns one trace of every step (status, attempts, time, clipped result or error). `dry_run` checks and shows the order only.
- Every step goes through the normal tool dispatch, so each add-on's own gate (music intent, download intent, switches) still decides. Tool output can fill later arguments but cannot add steps.
- Wired in `app.js` (`toolOn`, `setHost`) and `persona.js` (MULTI-STEP PLANS). Not run, not tested.

## V1.7.0
- **Spotify removed completely.** Deleted `ember_spotify.js`, the Spotify settings card, Spotify tab, sign-in, app link (`com.fezzy.ember://spotify` intent-filter and `handleLink` in MainActivity), the six Spotify AI tools, credits/privacy rows and the Spotify tests. Reason: Spotify's developer terms (Premium for dev accounts, 5 users, no AI control of playback).
- **Song info now Deezer + MusicBrainz.** Deezer (keyless) gives artwork, album, year, genre; MusicBrainz gives artist and album background, following its link to the Wikipedia page. iTunes and TheAudioDB are gone. New "album" section in About. Cache key bumped to `ember_meta2`.
- **Audd.io song identification** (`ember_audd.js`): paste your API token in Settings > Music. 🎧 Identify this song in the Music panel, Identify link in settings, and an `identify_song` AI tool (off until a token exists). A ~12 s WAV clip or your link goes to Audd.io only when you tap or ask. Result never changes the library until you tap Use these tags.
- Not built: identifying music inside web pages and blocking copyrighted tracks (needs audio capture from the browser).
- Not run: nothing in this version has been tested or compiled. Needs an APK rebuild (`apply_android_patch.py` no longer adds the app link).

## V1.6.8
- **Router tells the truth.** The system prompt now gets RUNTIME FACTS added at send time, after the router picks the engine: real engine, real model id, how many keys he saved, pinned-engine state, "no bundled/placeholder key exists", and "never claim tool results without a [TOOL RESULTS] block". Background replies get the same facts without naming an engine.
- **Pin is honest.** If the pinned engine cannot answer (rejected key, rate limit, none saved), the reply bubble says "<Engine> pin failed" and Settings shows why in plain words (`Prov.pinNote`).
- **Model picker.** Settings > Keys: pin an engine, tap Load models from my key, pick any model that key can see (OpenRouter `:free` models listed first, HuggingFace and the rest too). A pinned model is strict: only that model is requested.
- **Scraper keys obeyed.** `scrape_url` takes `via` (firecrawl, browserless, ...): only that provider runs and failures are reported, no silent swap to the free reader. The prompt states whether the Web Scraping switch is ON/OFF and which scraper keys are saved.
- Tests: tests/router-test.js (16 checks, no network).
- **Key scripts import properly.** Settings > Keys "Extract + check keys" now also saves scraper keys (Firecrawl, Browserless, ZenRows...) and Tavily, not just chat engines. Shell lines like `GROQ_API_KEY="..."` and `MISTRAL_KEYS=("a" "b")` are read by variable name, and a variable name is never saved as the key (it was, for scraper keys).
- **Prompts:** the white text boxes in the drawer are dark; new fields per prompt: Don't (constraints), Remind me on, Task. They are added as labelled lines when the prompt is used or copied, and included in export/import.
- **Timers and reminders** (ember_tasks.js): the AI can set a timer, e.g. "play music for an hour" = play, then set_timer 60 with stop_music. Fires while Ember is running; if Android closed it, it fires on reopen marked late.
- **Music:** the AI is told what is playing and may remark on it. New switch "Small freedoms": skip, volume, shuffle, play a library song on her own; pause/stop still need him to ask.
- **Humour rule:** quick simple jokes, callbacks, and short human reactions when he is funny.
- Reply bubbles show the model id after the engine name (needs Settings > Show which engine answered ON).
- Tests: tests/v168-test.js (25 checks).

## V1.6.7
- **EMBER TERMUX** panel docked at the bottom of Settings > Hacking: Ember logo, status light (green flashing = connected, red flashing = not), three tabs: Terminal, Ask Ember, Setup.
- Slides full ⇄ half (collapse stops halfway), ▾ drops it to a bar, drag or tap the header. While collapsed a red console beacon sweeps the top edge.
- Terminal engine written inside Ember (VT100/xterm subset: colours, cursor, scrollback, alt screen for nano/vim, line drawing). No CDN, works offline. Talks to a plain `ttyd ... bash` you start in your own Termux (127.0.0.1, random private path, port 7682). Ember never runs or sources your scripts.
- Extra key row (Ctrl, Esc, Tab, ^C, ^D, arrows, / - ~ | $, Copy, Paste) and a preset bar at the bottom (tap = type + Enter, or type only; add, edit, delete, reset).
- Ask Ember replaces Ask Termux: reads the last 60 screen lines (keys and passwords masked, 👁 toggle), answers with command cards (Insert / Run / Copy). Nothing runs until you tap; destructive commands need a second tap.
- Open Termux button (needs the V1.6.7 APK: EmberDevicePlugin.openApp + `<queries>` entry for com.termux).
- Tests: tests/term-test.js (core + real Chromium against a mock ttyd).

## V1.6.6
- **Fix (V1.6.5 bug):** the saved accent colour (old default pink) was overriding the new cyan at startup. New default accent is cyan; anyone still on the old pink or purple default moves to it once. Text on the accent now switches between dark and white automatically.
- New 📟 Device panel (pill above the message box): network (Wi-Fi name, signal, VPN on/off and, with a VPN on, the exit area), AI details (engine mode, key health per provider, persona, add-ons, chat and memory counts), storage and RAM with colour bars, uptime, battery integrity (health, temperature, voltage, cycles, a 0-100 guide score).
- Rotating Juice WRLD interview quotes (not lyrics, credited, under 15 words each) on top, plus "Add your own quote".
- Privacy tab (what is stored, what leaves the phone, permissions, your control) and About tab (disclaimers, crisis numbers, music/copyright, trademarks, no-warranty) with a credits grid: YouTube, AI, web scraping, GitHub, GitLab, Spotify.
- Android: new EmberDevicePlugin.kt (read-only). New permissions ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE and ACCESS_FINE_LOCATION (location is requested only when the person taps Show Wi-Fi name; Android needs it to reveal a Wi-Fi name). Needs a new APK build.

## V1.6.5
- New colour system: deep #0a0a10 background, cyan #00e5ff primary, purple glow, blue info, green good, amber warning, red #ff3b30 danger. Delete/Clear buttons are red; Save/active are cyan; cards are colour-coded by Settings tab.
- Glowing borders on the playing music card, widget and the latest chat bubble.
- Permission/system rows: coloured icons and green / amber / red status pills.
- Music panel: album artwork, Artist/Album/Year/Genre chips, scrollable About section (song + artist), timeline bar pinned at the bottom.
- ember_player.js: metadata fetcher (MP3 tags + embedded cover first, then iTunes for art/album/year, Wikipedia and TheAudioDB for the About text). Cached on the phone.
- get_current_track now returns album, year, genre, artworkUrl and about so Ember can talk about the song and artist.

*For everyone.* Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## V1.6.4
- Browser: the globe button opens a Browser (search or paste a link, clean reader view, tap links to keep browsing, back/forward/reload, saved sites). Send a page to Ember or save it to Documents.
- Documents: a real library on the phone (add text files, make notes, save pages). The AI's list/search/read/summarize tools now have it behind them; the bridge they called did not exist before.
- Left prompt box: fixed the save crash (the input shared the header's id), then added search, tags, pin, edit, copy, export/import and a starter pack.
- AI knowledge: the system prompt now carries a live map of the app (what is ON/OFF and the exact switch), a find_in_app tool (chats, prompts, sites, memory, notepad, documents, masked keys), and a log of actions it already took so it stops forgetting them. Tools no longer switch off for ordinary distress, only for a crisis.

## V1.6.3
- Termux: the top-right Termux button now opens the existing Termux (Hacking) tab in Settings, where the mode switch and Ask Termux live.
- Engine label: every reply shows the engine that answered it (ms stays behind the Show engine switch), and the header chip of the engine that answered last is marked.
- Notifications: every Ember notification (replies, pings, downloads, media, keep-alive) uses the Ember flame as its status-bar icon. Needs an APK rebuild.
- Permissions: Settings shows the real notification status and remembers the microphone answer instead of "tap to check".

## V1.6.2
- Safety: ordinary distress (levels 1-2) no longer shows a hotline card or injects numbers. Ember stays present and lifts instead of pitying. Tools stay on. Only a plan, means or goodbye (level 3) switches to crisis mode with 112 and SADAG.
- Chat: live download progress cards (title, percent bar) and a "saved to Music/Ember" message when each track lands. The AI is told the last result.
- SoundCloud: track download, set/playlist listing (playlist_list), whole-playlist download (playlist_download), SoundCloud search. YouTube playlists use the same tools.
- Native: EmberYoutubePlugin gains playlist, downloadPlaylist, per-job status. DownloadWorker picks the service and saves per-job progress. Not compiled on a phone yet.

## [V1.6.0] - 2026-10-24

### Added (not tested on a phone, the Kotlin and Gradle parts never compiled; the web part has a Playwright test, `tests/agent-test.js`)
- **Agent & API Tools card** (Settings > Music): three switches, each off by default.
  - **Web Search (Tavily)** (`www/ai_agent.js`): tool `web_search` returns Tavily's short answer plus the top results (title, url, snippet). The key is stored in `localStorage` `ember_agent`, never in backups. A Check key button spends 1 credit.
  - **YouTube search + audio download** (`EmberYoutubePlugin.kt`, `EmberYtCore.kt`, `DownloadWorker.kt`): tools `youtube_search` and `youtube_download`. NewPipe Extractor finds the audio stream, a WorkManager task downloads it in 4 MB ranged chunks with a progress notification, and the file is saved to `Music/Ember` through MediaStore (app music folder on failure). Needs an APK rebuild.
  - **Vision** (`see_image`): describes an https image link through Pollinations' free OpenAI-style endpoint.
- `apply_android_patch.py` adds NewPipe Extractor (version from `scripts/newpipe.version`, `v0.26.5`), OkHttp, `desugar_jdk_libs_nio` 2.1.5, a `META-INF` packaging exclude, the JitPack repository, the `FOREGROUND_SERVICE_DATA_SYNC` permission and a `dataSync` type on WorkManager's foreground service (needed on Android 14). Checked against a mock Capacitor project, twice, to confirm it is safe to re-run.

### Taken from Prodigy Syncing (it already builds and downloads)
- NewPipe version `v0.26.5` (the plan named `v0.24.1`), `desugar_jdk_libs_nio:2.1.5`, the `META-INF` packaging excludes, the `en`/`US` locale in `NewPipe.init`, the search call chain, 1 MB ranged chunks, 416 as end-of-file, and the weekly `newpipe-update.yml`. A `.gitlab-ci.yml` mirrors `build.yml` (untested).

### Changed from the plan this was built from
- **NewPipe was never initialised.** `NewPipe.init(downloader)` must run first or every lookup throws, and the plan had no `Downloader`. Added `EmberYtCore` (OkHttp).
- **Download worker:** the plan saved every stream as `.m4a` (it could be WebM), called `setForeground` on every 8 KB, deleted the progress notification when the job ended (so "complete" was never visible), used the raw video title as a filename, and never handled Android 14's foreground-service type. Now: M4A preferred and the real extension used, updates throttled, a separate result notification, sanitised names, `dataSync` type, and a fallback to a plain notification if foreground is refused.
- **`see_image` was a stub** that returned "Image analyzed" without looking at anything. It now makes a real request and returns an error (never an invented description) when the service fails.
- **Tavily:** the plan read `window.S`, which does not exist (`S` is private to `app.js`), and put the key in `S.keys` (the engine key store). The key now has its own store. It also crashed if Tavily returned no `results`.
- **Tool routing:** the plan's `resolveAddonCalls` snippet overwrote the result of every tool with the agent dispatch, checked a `window.EmberYoutubePlugin` that never exists, and tied YouTube to the Music switch. Tools are now listed and run per switch, like the other add-ons.
- **Guard rails:** `youtube_download` only runs if your latest message asks to download or save, and only for a link you pasted or that `youtube_search` returned (the AI cannot invent a video id).
- The plan's hint promised "camera upload" for vision; there is no image upload in the chat, so vision works on pasted https links only.

### Limits
- NewPipe breaks when YouTube changes. `.github/workflows/newpipe-update.yml` builds with the newest release every Monday and commits `scripts/newpipe.version` only if the build passes; you can also set `NEWPIPE_VERSION` for one build.
- Audio only, progressive streams only (no DASH/HLS manifests), no playlists.
- Like the other add-ons, these tools do not run in the background reply task.
- Pollinations' free image endpoint may change or start requiring a token; the tool then reports an error.
- Downloading from YouTube is against YouTube's Terms of Service, and copyright can apply to what you save. See `LICENSE_NOTES.md` for the NewPipe licence.

## [V1.5.9] - 2026-10-24

### Added (not tested on a phone, never compiled)
- **Background chat replies** (`EmberAiPlugin.kt`, `EmberAiWorker.kt`, `ember_native.js`, `app.js`, `providers.js`): if you leave Ember while a reply is still being written, the request the page already built (persona, memory, safety wrapper, history, the engines it would try) is handed to a WorkManager task. It finishes the reply even if the WebView is frozen or the process is killed, stores it, and posts a notification with the inline reply box (the existing `ReplyReceiver`). The page picks the stored reply up on return and adds it to its chat once. If the app finishes first, the background copy is cancelled. Settings > Permissions > System integrations > Keep replying in the background (on by default). Needs an APK rebuild.
- `Prov.pending()` / `Prov.nativePlan(lane)`: expose the in-flight request and the OpenAI-style engines to try (cached model lists only, no extra network).

### Limits
- Add-on tools (music, documents, web) do not run in the background; tool tags are removed from the reply. The same-opener rewrite check (`flaw` / `echoScore`) only runs in the page.
- Only OpenAI-style engines (Groq, Mistral, OpenRouter, HuggingFace) and the free engine run natively; Gemini and Cohere do not.
- The request file holds the API keys in app-private storage until the task finishes, then is deleted.

### Changed from the plan this was built from
- The plan pushed the AI's answer through `ember-bg-reply`, which the app treats as something *you* typed (it would have started a second reply). Results now go through a separate stored-results queue.
- The plan replaced `reply()` with a stub and sent only the last prompt (no persona, history or safety). The real request is now handed over unchanged.
- The plan called a `showBackgroundNotification` method on the plugin instance and used the retired `llama3-8b-8192`; the worker posts the notification itself and uses the page's own model choice.
- Plain thread replaced by WorkManager, so the work survives the process dying.

## [V1.5.8] - 2026-10-24

### Added (not tested on a phone, never compiled)
- **Native music notification** (`EmberMediaSession.kt`, `EmberMediaPlugin.updateNotification` / `clearNotification`): Ember's own player now owns a real Android MediaSession and media notification with previous, play/pause, next, on the shade and lock screen. Buttons are real PendingIntents and come back into the page as the `ember-media-cmd` event. Follows the local player only, not Spotify. Settings > Permissions > System integrations > Native music widget. Needs an APK rebuild.
- **Proactive AI pings** (`EmberPingWorker.kt`, `EmberNotifyPlugin.saveNativeConfig` / `setProactivePings` / `pingNow`): opt-in WorkManager task, about every 4 hours, asks Groq for one short check-in about your open threads. Off by default. Quiet 22:00 to 08:00 and for 30 minutes after you last used the app. Lock screen shows only "Ember pinged you". Switching it off cancels the task and wipes the Groq key and topics held by the native side. Includes a Send test ping button. Needs an APK rebuild.
- `apply_android_patch.py` adds `androidx.work:work-runtime-ktx:2.9.0` and checks all 7 Kotlin files.

### Changed from the plan this was built from
- Notification buttons were `null` actions (dead); now real broadcasts. The WebView was reached through a `context as MainActivity` cast that always failed; now a weak WebView reference set by the plugin. The shade style used a framework token with a compat style (would not compile); now framework `Notification.MediaStyle` throughout, so no extra media dependency.
- The Groq key was only written to `localStorage`, which the background worker cannot read; now saved natively via `saveNativeConfig`. Model changed from the retired `llama3-8b-8192` to `llama-3.1-8b-instant`. Added timeouts, quiet hours, retry cap, and a private lock-screen version.

## [V1.5.7] - 2026-10-24

### Added (not fully tested)
- **Ember's own music player** (`ember_player.js`): upload songs (stored in the app) or scan the phone (APK only), playlists, shuffle/repeat, lock-screen controls. No bridge, no other app.
- **Now-playing widget** above the message box and a **Music panel** (🎵 pill): Library, Spotify, Ember tabs.
- **Spotify connect** (`ember_spotify.js`): PKCE sign-in with your own Client ID (Settings > Music), what is playing, play/pause/skip/seek/volume, search, playlists. Needs Premium for control.
- **AI music rules** (`ai_music.js`): real tools only, told live state and limits, code refuses any music tool unless your latest message is about music, every AI action is logged in the Ember tab. If web lookup is off the AI says so.
- Native: `readChunk` in `EmberMediaPlugin.kt`, app link `com.fezzy.ember://spotify` in `MainActivity.kt` and the patch script. Needs APK rebuild, never compiled.

### Known
- `tests/music-test.js`: 74 pass, 4 fail (get_current_track after pause, rogue-pause chat case, Spotify get_current_track, one prompt-text check). Not investigated yet. `tests/app-test.js` was already failing before this version.

## [V1.5.6] - 2026-10-24

Batch 2 of 3. Status labels: **implemented** = written into this zip; **not tested** = nothing here has been run on a phone or built with Gradle; **needs APK rebuild** = needs `npm install`, `cap sync`, the patch script and a new APK.

### Fixed
- **Gemini AQ. keys.** The key finder only matched one literal prefix (`AQ.Ab8RN6LW`). It now matches any `AQ.` key as well as `AIza`. (implemented, not tested)
- **401/403 on keys.** Pasted keys are cleaned before they are stored or sent: zero-width characters, quotes, a leading `Bearer ` / `key=`, trailing commas. Stored keys are cleaned on load. (implemented, not tested)
- **Gemini rejections now explain themselves.** A 401/403 is retried once with the key as a `?key=` query parameter before the key is marked bad, and the real Google reason is kept with a plain hint (for example `ACCESS_TOKEN_TYPE_UNSUPPORTED`: some accounts get AQ. keys that the REST API refuses, and an AIza key made in Google Cloud Console is the workaround). Engine-switch errors and Check all now show the provider and HTTP code. (implemented, not tested)
- **Browserless 401/403.** The token is tried against the sfo, lon and ams regions in turn. (implemented, not tested)
- **Plugins not found inside the APK.** `ember_native.js` read plugins from `Capacitor.Plugins.X`, which is empty for plugins this no-bundler app never registered in JS. It now asks Capacitor for the native plugin by name. This is the most likely reason the mic, wake lock and notifications did nothing. (implemented, needs APK rebuild, not tested)
- **Saved wake lock was not re-applied** after reopening the app. It is now restored on launch. (implemented, not tested)

### Added
- **Free reader (no key).** New first provider in Web Scraping: fetches the page straight from the phone, then r.jina.ai, then allorigins. Own on/off switch, health row and Test option. `scrape_url` accepts `format: "text"` for plain text with no Markdown. (implemented, not tested)
- **Voice playback.** Native text-to-speech via `@capacitor-community/text-to-speech` (^5.0.0, the Capacitor 6 line), used first inside the APK, with the browser voice as fallback and an en-US retry. The patch script adds the Android 11+ `TTS_SERVICE` query that the engine needs to be visible. (implemented, needs APK rebuild, not tested)
- **Mic fallback.** If the quiet recogniser cannot start, Android's "Speak now" dialog is tried before an error is shown. Adds the `RECOGNIZE_SPEECH` query. (implemented, needs APK rebuild, not tested)
- **Background keep-alive.** New Permissions row backed by `EmberKeepAliveService` (foreground service, `specialUse` type for Android 14, CPU wake lock, ongoing notification with a Turn off action). New permissions: `WAKE_LOCK`, `FOREGROUND_SERVICE_SPECIAL_USE`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. (implemented, needs APK rebuild, not tested)
- **Battery exemption** is now a real native call (`hasBatteryExemption`, `requestBatteryExemption`) and an **Open app battery & launch settings** button was added, because Honor/MagicOS has its own battery manager on top of the Android one. (implemented, needs APK rebuild, not tested)
- **App icon.** `www/ember-icon.svg` (the file `index.html` already pointed at) plus the manifest and service-worker entries, and an adaptive launcher icon (`android_patch/res/`) that the patch script copies in. (implemented, needs APK rebuild, not tested)
- **Termux Mode label.** The header button reads `💻 Termux Mode` instead of `💻 TX`. (implemented)
- **Chat menu tabs.** The ☰ menu has Chats and Prompts tabs; Prompts is a saved-prompt list (add, tap to put it in the message box, delete), stored on the phone. (implemented, not tested)

### Not done yet (Batch 3)
- Tests were not run or updated for this batch; `tests/voice-native-test.js` still expects the old behaviour when no speech service exists and `tests/app-test.js` may reference the old drawer title.
- Wake lock and keep-alive behaviour on the real phone, and whether the AQ. key works against your Google account.

### Files touched
`www/providers.js`, `www/ai_scraper.js`, `www/ai.js`, `www/app.js`, `www/ember_native.js`, `www/index.html`, `www/style.css`, `www/sw.js`, `www/manifest.webmanifest`, `www/ember-icon.svg` (new), `package.json`, `README.md`, `scripts/apply_android_patch.py`, `android_patch/` (new `EmberKeepAliveService.kt`, `res/`, updated plugin and manifest additions).

## [V1.5.5] - 2026-10-24

### Changed (Batch 1 of 3 — UI declutter + Settings restructure)
- **Header decluttered.** Chill/Sharp/Deep mode switcher moved out of the header and down into the composer footer, above the Spark/Go deeper/Normal row. The header now only has History, Termux toggle, title/engine dots, and Settings.
- **999 moved out of the header.** The `🔥 999` button is gone from the top bar; 999 (Quote/Playlist/Lyrics) now opens from a "🔥 Open 999" button next to Lucid Dreams Mode in Settings → General → Voice & pacing, where it's thematically grouped.
- **Settings is now tabbed.** Instead of one 13-card scroll, Settings opens with a tab bar: **General, Keys, Scraping, Hacking, Music, Permissions.** Each existing card moved under the tab it belongs to with no content changes. Every card's header (`.ct`) is now also a collapse/expand toggle, so any section can be folded to save scroll space.
- **Permissions tab rebuilt.** Was two buttons (Notifications, Microphone) and a "Checking…" label. Now five rows with live status: Notifications, Microphone, **Keep screen awake (wake lock)** — a real toggle, not just a during-reply hold — **Battery optimization** exemption request, and **File/media access**. The wake-lock toggle is wired end to end in `ember_native.js` (`setWakeLock`/`wakeLockAvailable`); battery exemption and the native file-access prompt call into `EmberNotify`/`EmberMedia` and report plainly when the native method isn't built into this APK yet (that native half lands in V1.5.6, see docs/ANDROID_PERMISSIONS.md).

### Files touched
`www/index.html`, `www/style.css`, `www/app.js`, `www/ember_native.js`, `www/sw.js` (cache bump), `package.json`, `README.md`, `scripts/apply_android_patch.py`.

## [V1.5.4] - 2026-10-23

### Fixed
- **CI `npm install` ERESOLVE failure.** `package.json` pinned `@capacitor-community/keep-awake@^7.0.0`, whose peer dependency is `@capacitor/core >=7.0.0`, but this repo is on Capacitor 6.2.x. Pinned to `^5.0.0`, the line that pairs with Capacitor 6 (the plugin maintainer's own demo app pairs `keep-awake 5.0.0` with `@capacitor/core 6.0.0`). The plugin's majors do not track Capacitor's one-to-one: 4.0.0 already requires Capacitor 5 and 7.x requires Capacitor 7. The JS API used in `www/ember_native.js` (`keepAwake()` / `allowSleep()`) is unchanged across these versions. Upgrade `keep-awake` to 7.x only together with the whole Capacitor 7 move (and Java 21, see `docs/ANDROID_BUILD.md`). Versions bumped everywhere: `package.json`, `www/sw.js` (cache `ember-v1.5.4`), `index.html`, README, `apply_android_patch.py`.

## [V1.5.3] - 2026-10-23

### Fixed
- **CI install failure.** `package.json` depended on `@capacitor-community/wakelock`, which has never existed on npm (404 on install). The real package is `@capacitor-community/keep-awake`. Swapped the dependency and fixed the usage in `www/ember_native.js`, which was also wrong in two more ways that would have surfaced only after install succeeded: it looked up the plugin as `Capacitor.Plugins.Wakelock` (the plugin actually registers as `KeepAwake`) and called `.acquire()`/`.release()` (the real API is `.keepAwake()`/`.allowSleep()`). All three are fixed together so the hold-screen-awake-during-a-reply feature will actually work once the correct package installs. Docs (`ANDROID_PERMISSIONS.md`, `ANDROID_BUILD.md`) and the manifest comment updated to match. No test covered this path, so it only surfaced via a real `npm install` in CI, not the test suite.

## [V1.5.2] - 2026-10-23

### Fixed
- `index.html` footer still read "Ember V1.5.0" after the V1.5.1 bump touched every other file. Now V1.5.2 everywhere: `index.html`, `package.json`, `www/sw.js` (cache `ember-v1.5.2`), README.

## [V1.5.1] - 2026-10-23

The voice and permissions fix. Android WebView has no `SpeechRecognition`, so the mic button could never work in the installed APK.

### Fixed
- **Voice input in the APK.** `app.js` now uses the native Android recogniser (`@capacitor-community/speech-recognition`) when running inside the app, and keeps the Web Speech API in browsers and the PWA. Live partial results fill the message box; tapping the mic again stops it; a 60 s guard stops a stuck session.
- **Missing permissions.** The merge of `android_patch/` was manual and never ran in CI, so the APK shipped without `RECORD_AUDIO`, `POST_NOTIFICATIONS` and the reply receiver. `scripts/apply_android_patch.py` now merges them on every build and fails the build if any is missing.
- Added `MODIFY_AUDIO_SETTINGS` (WebView mic) and the Android 11+ `<queries>` entry for `android.speech.RecognitionService`, without which the speech engine is invisible to the app.
- Kotlin plugins could not compile: Capacitor 6's template has no Kotlin Gradle plugin, and `MainActivity.java` clashed with `MainActivity.kt`. The patch script enables Kotlin and removes the template `MainActivity`.
- `EmberNotifyPlugin.kt`: wrong `RemoteInput` class for `NotificationCompat` (now `androidx.core.app.RemoteInput`), nullable launch intent, and a notification channel call that needed an API 26 guard.
- Release signing: `assembleRelease` produced an unsigned APK, so the upload step found nothing. The patch adds a `signingConfig` driven by the CI secrets.
- CI uses Java 17 (Capacitor 6 / Gradle 8.2 do not run on Java 21).
- Two stale tests updated (persona rule 9 wording, V1.5.0 session restore).

### Added
- `docs/ANDROID_BUILD.md`: CI setup, required GitHub secrets, and a device checklist.
- `.github/workflows/build.yml` and `scripts/apply_android_patch.py` in the repo.

## [V1.4.0] - 2026-10-23

The add-ons release. Both add-ons are off by default.

### Added
- `www/ai_music.js` (Music Control) and `www/ai_docs.js` (Document Reading): tool schemas plus handlers that call the `EmberMedia` and `EmberDocs` bridges when a host app provides them, and fall back gracefully when it does not.
- Settings > **Add-Ons** card with two switches (`musicAddon`, `docsAddon`, saved in settings).
- `resolveAddonCalls` in `app.js`: finds `<tool_call>` blocks in a reply, runs the matching tool (max 3), then asks the AI to turn the result into a normal reply. Tool results are passed as data, not instructions.
- `toolsBlock` in `persona.js`: tool instructions are added to the system prompt only while an add-on is on.

- `www/ai_scraper.js` (`scrape_url(url, objective)`; Firecrawl, Browserless, ScraperAPI, ScraperBee, Sting, ZenRows in that order), `www/ai_sites.js` (`save_site`, `list_sites`) and `www/ai.js` (Settings > Web Scraping keys card, Saved Sites list in the drawer). Keys also accepted for SerpApi and Octoparse (stored only). Tool calls now chain for up to 3 rounds.

- **Prototype engines:** OpenRouter (free models only), Cohere (v2 chat) and HuggingFace (router) added to `providers.js` with `status: 'prototype'` and a Prototype badge. They sit last in every lane. New Gemini key format `AQ.Ab8RN6LW…` is recognised. Engine switches fire an `ember-switch` event and `ai.js` shows a toast.
- Scraper chain extended with SerpApi (snippets only) and Octoparse (not supported, skipped). `scrape_url` accepts a saved site name.

- **Voice:** 🎤 button (Web Speech API, red pulsing while recording, fills the message box, never auto-sends), 🔊 on every reply, and an auto-read switch under Settings > Voice.
- **Globe:** 🌐 button reads a pasted link (or a saved site name) with `scrape_url` and adds the page to the chat as marked, untrusted context. Anything typed in the message box becomes the objective.
- **History:** the chat list is a collapsible "Recent Chats (N)" section; open/closed state is remembered. Searching opens it temporarily.

### Safety
- No tool instructions are sent and no tool is run at crisis level 2 or higher (`noTools` plus a `Safety.lastLevel()` check).

### Changed
- Version bumped to V1.4.0. `ai_music.js` and `ai_docs.js` are added to the service-worker file list (cache `ember-v1.4.0`).
- Tools are routed by tool name, so document tools are no longer swallowed by the music handler.
- Privacy note: with Document Reading on, document text is sent to whichever engine answers, including Free Mode (Pollinations).

## [V1.3.0] - 2026-10-22

The safety release. No new chat features.

### Added
- `www/safety.js`: offline `Safety.detect` (levels 0 to 3), `wrapSystem`, `killSwitch`, `crisisCard`, and a transient level (`mark`, `lastLevel`). See [SAFETY.md](SAFETY.md).
- Wiring in `Persona.respond`: the safety check runs first. At level 2 or higher it forces the deep lane, drops directives, skips the anti-echo rewrite, and appends the crisis block to the system prompt. Level 1 appends a tone override.
- A local **crisis card** (SADAG 0800 567 567, Lifeline SA 0861 322 322, 112) shown the moment the message is sent, plus a red support dot beside Ember's name.
- `after()` skips memory learning at level 2 or higher and for 14 messages after one.
- Memory migration: `MEM_DEF` and `migrateMem`, used on load, on "Clear memory" and on import. Seven keys, five reserved for V1.4.0. Old V1.2.0 saves keep all facts and threads.
- `tests/safety-test.js` (43 checks), and these docs.

### Changed
- Version bumped to V1.3.0 in `index.html`, `package.json`, `sw.js` (cache `ember-v1.3.0`), the README and file headers. `safety.js` is added to the service-worker file list.
- The root README is now a short pointer. The old feature notes moved to [FEATURES.md](FEATURES.md).
- `.gitlab-ci.yml` gains a `lint` job (`node --check`) and an `audit` job (forbidden-pattern grep) ahead of the existing Pages deploy.

### Fixed (audit items closed)
- The crisis card could be wiped by the next re-render. It is now drawn inside the render function.
- A directive could be sent to the model before the kill switch cleared it. The check now runs before the message list is built.
- "I have a plan" or "I have a knife" alone could score level 3. Means and timing now count only next to ideation.
- An idiom anywhere in a message could cancel a real crisis phrase in the same message. Idioms are now removed before matching.
- Curly apostrophes from Android keyboards broke every `don't` / `can't` pattern. Text is normalised first.
- The first draft's support-dot style would have turned the whole name into a red dot. It is now a small `::after` dot.
- Import dropped future memory items that use `text` or `name` instead of `t`, and accepted a `__proto__` key. Both fixed.
- README feature tags for Free Mode, Voice & pacing and Memory & Context read V1.3.0 after a bulk version bump. They are back to V1.2.0.

### Not shipped (deferred to V1.4.0)
Vibe check, mood weather, pattern spotting, running bits, character modes, Thought Courtroom, Surprise button, coping deck, letters to future self, debate mode, micro-surprises, easter eggs. Open decisions: the coping deck conflicts with HARD RULE 9 and debate mode with HARD RULE 4, so both need a redesign before they are built. Also open: making crisis mode last for a few messages after a trigger.

## [V1.2.0]
The state of the code before the safety layer: Free Mode, voice and pacing settings, memory and context settings. No tag exists in this repo; see the commit history.

## V1.9.0
See docs/V1_9_0_PLAN.md. Not run on a device. APK must be rebuilt (run `npm run patch:android` again for the network security config).
