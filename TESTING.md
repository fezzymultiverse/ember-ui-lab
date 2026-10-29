# Testing and local build

The web app source and `index.html` are at the repository root. `npm run build:web` copies the web shell and local assets into `www/`, the directory configured as Capacitor’s `webDir`; the build fails early if a local asset referenced by the HTML shell is missing. `npm run serve` builds the app and serves the generated output at `http://127.0.0.1:8080` (or the `PORT` you set).

## Commands

Install dependencies, build, and run the maintained suite:

```sh
npm install
npm run build:web
npm test
```

`npm test` runs the maintained Node and browser checks for artifact parsing, provider routing, streaming, terminal behavior, current Hub/Settings navigation, safety, Agent tools, document context, Music, scraping, key scanning, handoff, and the still-current feature regressions. The browser tests use the declared Playwright dependency and require Chromium; browser tests may be run individually with `node tests/<name>.js`.

The current `tests/app-test.js` is a focused browser smoke test for app startup and the supported Hub → General Settings → Free Mode and Hub → Termux & Hacking routes. Generated site output (`www/`) and test screenshots are ignored by Git.

## Historical tests

The root-level test files have been moved to `tests/` so their paths match the npm scripts and test imports. Older release-specific tests remain in that directory as historical regression material, but are not part of the maintained default suite where they still depend on controls removed or hidden by the current Hub and paged Settings interface. The former monolithic app browser test is retained as `tests/app-legacy-test.js`; its older settings assumptions have not been fully migrated. Known UI-era checks that need migration include `speaker-test.js`, `v183-test.js`, `v198-test.js`, and `v1924-test.js`. They should not be interpreted as current product behavior until their selectors and flows are updated.

## Safety checks

`tests/safety-test.js` validates the safety classifier and response wrapping without a browser or network. The table of idiom, distress, ideation, and crisis cases remains in this test. It also checks that crisis actions use telephone links, that the crisis block is included at the appropriate level, and that ordinary idioms are not misclassified.

Provider/browser tests use mocked requests; they do not establish that a real provider, handset, Android SDK build, or voice service works. Those require separate device or integration checks.
