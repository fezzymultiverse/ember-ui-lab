# Ember V1.9.92

Current release: whole-repository brain search and Features > Repo Runner, on top of the existing web routing and bundled document exports. Previous V1.9.91 release notes remain historical.

## Whole brain, not selected files

Keep Settings > GitHub > Knowledge Brain Repo set to your FEZZY Super Brain's exact owner/name. The existing default is preserved: `fezzymultiverse/ember-brain`. This release does not guess a different FEZZY repository name. Save your GitHub token there. No file-selection step is required.

`github_grep` searches current tracked text blobs across the entire brain, including vendor folders and nonstandard filename extensions. It bypasses GitHub's code-search index and the optional ranked preview cache. Literal case-insensitive search is the default; the tool also supports case-sensitive matching and optional path scope. Each search pins a tree/blob snapshot; continuation cursors process the remaining files. A NEW search sees later commits. Start over after a cursor expires (30 minutes/device restart). Binary files and protected secret paths are disclosed skips; text blobs above 8 MiB and submodules prevent a full-coverage claim. It is not possible or necessary to put the entire repository into one model prompt. Ember searches, then reads relevant exact paths. File reads remain live, read-first, secret-redacted and paginated. Do not infer absence from an unfinished grep.

If GitHub truncates its recursive tree response, Ember walks every subtree instead. A failed traversal is an error, not proof that a file is absent. The optional small preview cache is NOT the brain and does not restrict grep scope.

## Features > Repo Runner

Open Settings > Features. Search GitHub repos, add whole repositories, or paste owner/name. The configured brain is always included. Choose YOUR EXISTING output/build repository separately; adding dependencies never redirects brain reads. The runner does not create/fork an additional GitHub repository.

Set the existing build workflow filename (default `build.yml`), then use **Install / update + sync + build**. Installation writes `scripts/ember-repo-runner.cjs`, `ember-repos.json`, and `.github/workflows/ember-repo-sync.yml` in a single Git tree commit on the output's default branch. Your token is sealed-box encrypted locally using the bundled libsodium library, then stored as the output repo's encrypted `EMBER_REPO_TOKEN` Actions secret. It is not embedded in files, exposed to the model, or put into Git remote URLs. This secret intentionally gives the installed runner access to the selected source/output repositories; use a narrowly scoped, revocable token and trust the people who can edit workflows in your output repo.

The sync job clones complete CURRENT tracked snapshots (not Git history) into:

- `external/fezzy-super-brain/` for the brain;
- `external/repos/<owner>/<repo>/` for additional sources.

It records upstream SHAs in `ember-repos.lock.json`, pushes normal fast-forward commits, and dispatches your selected build. No source package install scripts are executed. Future additions, changes and deletions are synced within runner-owned paths. Unchanged snapshots create no new commit/build. Existing app files outside managed paths are preserved. Source code is INCLUDED IN THE REPOSITORY before the build; it is NOT automatically wired into application imports or included inside an APK bundle. Make application-specific imports/packaging changes separately if required.

After changing source/build settings, use Install / update again to commit the new manifest. **Sync & push now** refuses unpublished settings rather than silently running an old configuration. Run status reports actual Actions state, not a fabricated completed build. Existing push-triggered build workflows may ALSO run from the runner's PAT commit; disable the explicit dispatch checkbox if your push-triggered build is sufficient and you want to avoid duplicate builds.

Optional upstream polling is disabled by default. Enable the automatic-sync checkbox and install/update to allow the scheduled GitHub Actions job to run every ~15 minutes; GitHub scheduling can be delayed. The installed workflow still has a lightweight scheduled check when autoSync is false, but exits without clone/push/build. Remove/disable that workflow in GitHub if you want no scheduled job at all.

**Add runner to output** creates a standalone downloadable `ember-repo-runner.cjs` artifact containing only your configuration. It can be copied alongside generated project output. For the local installer, use Node 20+, git and the GitHub CLI (`gh`) on Linux/macOS/Termux. Set `GH_TOKEN` securely in your local environment (never commit it), then run `node ember-repo-runner.cjs install`. For later updates use `node ember-repo-runner.cjs sync`. The in-app installer does not require local Node/git/gh: it uses GitHub's API and the runner executes on GitHub Actions.

### Permissions and safety

A fine-grained token needs Contents READ access to each private source and Contents, Workflows, Actions and Secrets WRITE access on the output. For a classic PAT, use repo/workflow scopes and an account that can manage Actions secrets on the output. Organization policy and branch protection still apply. The existing build workflow must exist and accept `workflow_dispatch` for explicit build dispatch. Installation requires the output default branch so GitHub can register the new workflow. Keep your build signing secrets configured as before; this patch does not contain a signing key.

Private sources into a public output are blocked. Check licenses before redistributing ANY source snapshot. Binary files are copied as tracked, but Git LFS payloads are not explicitly hydrated by this runner. Symlinks and submodules fail closed with an actionable message instead of pushing a partial snapshot. GitHub size, rate and Actions limits still apply. No force-push, silent conflict resolution, or automatic dependency execution is performed. This is source code, not a prebuilt/signed APK.

### Verification

Run `npm run test:brain` and `npm run test:repo-runner` for deterministic tests; the latter uses real local bare Git repositories with mocked HTTP. Browser tests: `npm run test:brain:browser` and `npm run test:repo-runner:browser`, with Playwright/Chromium available (or PW set to its installed module path). Tests use dummy credentials and never contact or mutate a real GitHub repository. The existing V1.9.91 deliverable tests remain applicable.

The broad legacy `npm test` command has an existing `tests/app-test.js` failure: it clicks a hidden legacy Settings tab after the accordion redesign. The same failure was reproduced on the UNMODIFIED uploaded V1.9.91 archive; the new dedicated browser tests use the visible accordion and pass. No live GitHub push/build, Android SDK build, or signed APK installation was performed here.

Ember is a text-only companion app (web app, APK-ready) that you can talk to about anything. It keeps a small memory on your own device, leads the conversation, and uses your own Groq, Mistral or Gemini keys, or a free third-party service in Free Mode.

Docs live in /docs. Start with /docs/README.md. Android build and permissions: /docs/ANDROID_BUILD.md and /docs/ANDROID_PERMISSIONS.md.

Ember is not a therapist or a crisis line. If you are in danger, call SADAG 0800 567 567, Lifeline SA 0861 322 322, or 112 from a mobile.

Historical changes through V1.9.41 (V1.9.41: added a third Claude-like animated status-line thinking display while preserving both existing thinking styles; V1.9.40: black composer restored, composer tools consolidated under +, neutral white/grey thinking accents and softer orange balance; V1.9.18: wiring audit locked in by tests; V1.9.17: document hard rule + document tools proven wired end to end; V1.9.16: Ember knows its own reasoning, planning and long-document abilities; V1.9.15: strict engine pin with real error text, one Ember voice per engine, automatic document retrieval, long answers on request; V1.9.14: one key finder for every paste box (nothing missed, several keys per provider with failover), Bright Data SERP, Audd.io and EasyVoice keys picked up from pastes; V1.9.13: web search falls through your SerpApi, Firecrawl, ScraperAPI and ScrapingBee keys before DuckDuckGo, new search_and_read tool, Tavily reads pages too, real Octoparse task reading, keys hidden from every error, hardened key extractor, Delete everything now removes scraper and Tavily keys; V1.9.12: web search works with no key through a DuckDuckGo fallback, Tavily stays first; V1.9.11: the mic works again through Gemini, ElevenLabs removed, all 30 Gemini voices; V1.9.10: three-line lyrics preview from LRCLIB; V1.9.9: Ember Voice, a real voice through Gemini or ElevenLabs with the phone voice as fallback; V1.9.8: Providers chip with live dots, Ember name centred, Termux command line and auto-fold, one 📎 for Documents, honest engine identity, no restart after exit; V1.8.3: real in-app browser, Termux connects by itself when you run a command, no double billing on background replies; V1.8.2: scraping keys take turns and go first, the free reader is only the fallback; see docs/CHANGELOG.md). License: TBD (see docs/LICENSE_NOTES.md).
