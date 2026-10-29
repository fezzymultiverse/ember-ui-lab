# Android build (V1.5.1)

*For the person building the APK.*

## How the APK is built

`.github/workflows/build.yml` runs on every push to `main` and on manual dispatch:

1. `npm install` (Capacitor 6, keep-awake, speech-recognition).
2. `npx cap add android` (skipped quietly if `android/` already exists).
3. `python3 scripts/apply_android_patch.py android android_patch` copies the Kotlin plugins, merges the manifest, enables Kotlin in Gradle and adds release signing. It exits non-zero if a permission is missing, so a bad build never ships.
4. `npx cap sync android`.
5. Android SDK 34 install, keystore decode, `./gradlew assembleRelease`, upload `signed-app`.

## GitHub secrets required (Settings > Secrets and variables > Actions)

| Secret | Meaning |
|---|---|
| `KEYSTORE_BASE64` | your release keystore, base64 encoded (`base64 -w0 release.keystore`) |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias inside the keystore |
| `KEY_PASSWORD` | optional; defaults to `KEYSTORE_PASSWORD` |

## Plugin versions must match Capacitor 6

Every Capacitor plugin declares a peer range on `@capacitor/core`. On Capacitor 6.2.x use `keep-awake` ^5.0.0 and `speech-recognition` ^6.0.1. `keep-awake` 7.x needs Capacitor 7 and makes `npm install` fail with ERESOLVE. Do not "fix" that with `--force` or `--legacy-peer-deps`; pin the plugin instead.

## Java version

Capacitor 6 ships Gradle 8.2.x, which does not run on Java 21. CI uses Temurin 17. If you move to Capacitor 7, move to Java 21 at the same time.

## Device checklist (do this on the phone after installing)

1. Settings > Permissions > tap **Microphone** and **Notifications**: both should say granted.
2. Tap the mic in chat, say a sentence: text appears live; tap again to stop.
3. Tap a reply's speaker button: it reads aloud.
4. Background the app during a reply: a notification with a Reply box appears.
5. Turn on Music Control and allow audio access: the on-device library loads.

If step 2 says "No speech service on this phone", install or enable the Google app / Speech Services from the Play Store.

## Honest status

The Kotlin plugins and the patch script have been checked for structure and idempotency, but not compiled against the real Android toolchain in the environment that wrote them. The first CI run is the real test; read its log if it fails.
