# EMBER TERMUX panel (V1.6.7)

Settings > Hacking > bottom panel. Bridge: `ttyd` in your own Termux, plain bash, loopback only.

## First run
1. Setup tab > Copy command, paste in Termux, leave it running:
   `termux-wake-lock; pkg install -y ttyd && ttyd -i lo -p 7682 -b /<private path> -W /data/data/com.termux/files/usr/bin/bash`
2. Tap Connect. The light turns green. It reconnects on its own if Termux restarts (re-run the command).

## Notes
- The private path is random per install; "New private path" rotates it. Port 7682 so it never clashes with Prodigy (7681).
- If Termux is running and Connect always fails, Android may be blocking `ws://127.0.0.1` from the https app page. Fix: `"allowMixedContent": true` under `android` in capacitor.config.json, `npx cap sync`, rebuild.
- Ask Ember sends the last 60 terminal lines (keys/passwords masked) to your AI engine when 👁 is on. Turn it off to send only your question.
- Open Termux needs the new APK (EmberDevicePlugin.openApp and the `<queries>` package line in AndroidManifest.additions.xml).

## V1.9.8
- The panel starts as a bar. Tap ▴ to open it. A command line under the screen runs real commands; A−/A+ change the text size.
- Open Termux folds the panel by itself and it stays folded when you come back.
