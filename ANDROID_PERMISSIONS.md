# Android native additions · install steps (V1.5.1)

**V1.5.1:** steps 3-5 below are now automated by `scripts/apply_android_patch.py`, which the CI workflow runs on every build (`npm run patch:android` locally). The manual steps stay documented so you can see exactly what it does.

Everything under `android_patch/` in this zip is written against Capacitor 6 and
your `capacitor.config.json` appId (`com.fezzy.ember`) but has NEVER been
compiled -- no Android SDK, no Gradle, no network in the environment that wrote
it. Treat it as a draft to build and fix, not a finished artifact.

## Steps

1. If `android/` doesn't exist yet in this repo: `cap add android`. If it
   already exists (likely, since CI builds it): skip this.
2. `npm i` (pulls in `@capacitor-community/keep-awake` from package.json).
3. `cap sync android`.
4. Copy the plugin files in:
   ```
   cp android_patch/app/src/main/java/com/fezzy/ember/*.kt \
      android/app/src/main/java/com/fezzy/ember/
   ```
   If `MainActivity.kt` already has other code, do NOT overwrite it --
   merge in the two `registerPlugin(...)` lines and the `onCreate`/`onNewIntent`
   body from `android_patch/.../MainActivity.kt` by hand.
5. Merge `android_patch/AndroidManifest.additions.xml` into
   `android/app/src/main/AndroidManifest.xml` by hand (two separate insertion
   points, marked in the file).
6. `./gradlew assembleRelease` (or let CI do it). First build will surface
   whatever's wrong -- Capacitor plugin API shifts between minor versions,
   and this was written from the 6.x docs, not tested against your exact
   `@capacitor/android` patch version.

## What's real after this

- **Notifications with an inline reply box** (`RemoteInput`): typing a reply
  from the lock screen or notification shade sends it into the chat exactly
  like a typed message, app open or not.
- **Music notification and lock-screen controls** (V1.5.8, `EmberMediaSession`): a real `MediaSession` plus media notification for Ember's own player. Uses `POST_NOTIFICATIONS` for the shade card.
- **Proactive pings** (V1.5.8, `EmberPingWorker`): opt-in WorkManager task that calls Groq in the background and posts a notification. Needs a Groq key and `POST_NOTIFICATIONS`.
- **Background replies** (V1.5.9, `EmberAiWorker`): WorkManager task that finishes a chat reply when the app is backgrounded. Uses `INTERNET` and `POST_NOTIFICATIONS`.
- **YouTube audio download** (V1.6.0, `DownloadWorker`): WorkManager foreground task (`FOREGROUND_SERVICE_DATA_SYNC`, shown as a progress notification) that writes to `Music/Ember` through MediaStore on Android 10+ (no storage permission needed). Uses `INTERNET` and `POST_NOTIFICATIONS`.
- **On-device music library** (`EmberMedia.getLibrary()`): real
  `MediaStore.Audio` query, actual device tracks.
- **Keep-awake during a reply** (`@capacitor-community/keep-awake`): CPU
  stays awake only while the model call is in flight; releases right after.
  Not a persistent background service.
- **Voice input**: inside the APK the mic button uses the native Android
  recogniser via `@capacitor-community/speech-recognition` (the WebView has no
  `SpeechRecognition`). In a browser/PWA it still uses the Web Speech API.
  Needs `RECORD_AUDIO` (runtime prompt) and a speech service on the phone
  (the Google app / Speech Services). Without one, the app says so in a toast.
- **Read aloud**: `speechSynthesis` (WebView text-to-speech), no permission needed.

## V1.5.6 additions (written, never built or run)

- `EmberKeepAliveService` (foreground service, `specialUse`): the real fix for the app being killed and restarted. Toggle: Settings > Permissions > Background keep-alive.
- Battery exemption (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) and an Open app settings button. On Honor/MagicOS also set Battery > App launch > Ember to Manage manually (names vary by version).
- Native text-to-speech (`@capacitor-community/text-to-speech`) and the `TTS_SERVICE` / `RECOGNIZE_SPEECH` queries.
- Adaptive launcher icon from `android_patch/res/`.
- After pulling this version run `npm install`, `cap sync android`, then `npm run patch:android`, then build.

## What's still not built

- `get_current_track` / `control_player` tools in `ai_music.js`:
  need Prodigy's real API (MediaSession, content provider, whatever it
  exposes). Nothing here guesses at that.
- The keep-alive service above is written but unverified on a device.

## Permission table (V1.5.1)

| Permission | Why | Prompt at runtime |
|---|---|---|
| `INTERNET` | AI providers, web scraping | no |
| `RECORD_AUDIO` | voice input | yes, on first mic tap |
| `MODIFY_AUDIO_SETTINGS` | WebView microphone path | no |
| `POST_NOTIFICATIONS` | reply notifications (Android 13+) | yes |
| `READ_MEDIA_AUDIO` | on-device music library (Android 13+) | yes |
| `READ_EXTERNAL_STORAGE` (max SDK 32) | same, Android 12 and older | yes |
| `FOREGROUND_SERVICE` | reserved | no |
| `WAKE_LOCK` | added by the keep-awake plugin | no |
| `<queries>` RecognitionService | lets the app find the speech engine on Android 11+ | n/a |

Not requested: location, camera, contacts, SMS, call log, accessibility.
