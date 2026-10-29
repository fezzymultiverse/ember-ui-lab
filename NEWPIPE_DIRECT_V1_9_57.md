# Ember V1.9.57 — direct NewPipe downloads

When YouTube or SoundCloud is enabled and the user explicitly asks to download/save/grab something, Ember now checks for a direct media link or a usable title before starting the normal AI reply.

- A direct video or SoundCloud link is sent straight to the native `EmberYoutube`/NewPipe bridge.
- A playlist link is listed and then sent straight to native playlist download.
- A title without a link is searched by the native YouTube add-on, then the first native result is downloaded.
- The turn does not call `Prov.run`, `resolveAddonCalls` or the normal `reply()` provider route.
- The native result is posted in the chat and native progress cards continue to update below it.
- If the YouTube add-on is off or the native bridge is missing, the ordinary chat route is preserved so Ember can explain what is unavailable.
