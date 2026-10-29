> Feature notes carried over from the root README up to V1.4.0. The root README is now a short pointer; start with [docs/README.md](README.md).

# Ember V1.3.0 - a companion to talk to about anything

Standalone web app (PWA). Text only. Plain HTML/JS in `www/`, no build step, no dependencies. APK-ready with Capacitor.

## What it does
- **One mind, three engines.** Groq answers fast, Gemini takes the slow "deep" turns, Mistral is the backup. One shared character, one shared memory. If a key is rate-limited the next key, then the next engine, takes over without you noticing. Models are read from each provider's live model list, so nothing breaks when a model name is retired.
- **Keys from your notes.** Settings > Keys: paste a messy notes dump. It pulls out Groq keys (`gsk_...`), Gemini keys (`AIza...`) and Mistral keys (no prefix, so it takes 32-character strings next to the word "Mistral", and tests unlabeled ones against Mistral). Every key gets a health check: key valid, model found, one real test message, response time. Notes are never saved. More than one key per engine is fine.
- **Free Mode (V1.2.0).** No key needed. Chats go to Pollinations.ai (free, third-party, no uptime promise, rate-limited without a key, 15 s timeout). Settings > Free Mode: ON by default while there are no keys. ON = Pollinations first, keys after. OFF = keys first. It is always the last resort, so a chat is never blocked by missing or rested keys. Background jobs (memory, titles, summaries) never use it, so Free Mode chats are not learned from. The orange badge at the top of the chat shows when it is on.
- **Voice & pacing (V1.2.0).** Settings: warmth, directness, humour, pacing (short check-ins or longer talks), and a box for how you like to be spoken to. These only change style. A locked baseline (calm, non-judgmental, never clinical or dismissive) and the safety rules always apply.
- **Never echoes you.** The character prompt forbids reflecting you back, and the app checks every reply: if it opens with "it sounds like...", repeats your own words, or opens like a recent reply, it is rewritten once before you see it.
- **Takes the lead.** Every reply adds something and ends with at most one specific question. **Spark** starts a conversation itself, using your open threads and its own curiosities.
- **No judging, no debating.** It wonders instead of arguing. It knows who you are (Settings > About you) and is told never to mention, suggest or point at what you do to feel better.
- **Chill / Sharp / Deep** modes. In Sharp it automatically takes a deep pass every 4th reply or when you write a long message. **Go deeper** forces one.
- **Memory you control.** It learns interests, projects, running jokes and open threads. It does not record coping habits, health details, secrets or keys. Everything is listed in Settings > Memory & Context as Core Memory, and each line can be edited or deleted. **Private** chats (🔒) are never learned from.
- **Memory & Context settings (V1.2.0).** Context window (Short 5 / Normal 15 / Long 50 messages), Auto-summarize old chats (older messages become a short summary instead of raw text), Persistent Memory master switch (OFF = it stops learning and stops using Core Memory; saved lines stay on the phone, paused), Core Memory manager (Edit / delete), and a System prompt / Persona box sent at the start of every chat.
- **The core never changes.** The purpose (a conversational companion he comes back to and relies on) and the HARD RULES are fixed in `persona.js` > `buildSystem`. The Persona box and every setting sit under them, and a FINAL CHECK line closes the prompt. Settings change how Ember remembers and sounds, not what it is.
- **Chat history.** Every chat saved on the phone, searchable by words inside the messages, renameable, deletable. Backup and restore as a JSON file (keys only if you tick the switch).

## Run it
**On the phone with Termux (test it first):**
```
cd www && python3 -m http.server 8080
```
Open `http://localhost:8080` in Chrome, menu > Add to Home screen. It installs like an app.

**On the web (GitLab Pages):** push this folder to a new GitLab project. `.gitlab-ci.yml` copies `www/` to Pages in a few seconds. Open the Pages URL in Chrome > Add to Home screen.

**As an APK later:** `npm install`, `npx cap add android`, `npx cap sync android`, build in Android Studio or any CI. `CapacitorHttp` is enabled so API calls skip browser CORS rules inside the APK. Do this only after you have used the web version and like it.

## Tests
`node tests/app-test.js` runs headless Chromium against mocked Groq, Mistral and Gemini: key extraction, health, failover, no-echo rewrite, memory, history, search, private chats, backup/restore, and the Memory & Context settings (window size, summaries, memory switch, edit/delete, persona + core order).

## NOT TESTED
- Real Groq, Mistral and Gemini calls (no internet to them from the build machine) and any real phone.
- Whether `api.mistral.ai` allows calls straight from a browser page (CORS). If Mistral shows "network error or blocked by the browser" on the web version, it will work in the APK, where CapacitorHttp bypasses CORS.
- Free-tier rate limits. The router backs off on 429 and moves on.
- The crisis line number in the prompt (South Africa SADAG 0800 567 567) is from memory. Check it.
- Pollinations Free Mode against the live service (the test suite mocks it; the 15 s timeout was checked with a route that never answers).
- Reply quality. Prompt wording is the main dial; tune it in `www/persona.js` > `buildSystem`.
