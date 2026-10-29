# Ember V1.9.53 — real download Thinking status

Ember's download status is now event-backed. The Thinking timeline does not display a download stage merely because the model mentions downloading. For a single track it appears only after `youtube_download` returns a real native `jobId`; for a playlist it appears only after real job IDs are returned by `playlist_download`.

Progress and completion are updated from the existing `ember-dl` lifecycle events. Running jobs show the real title and percentage when available; completed jobs show `Saved to Music/Ember`; failed jobs show `Download failed` and the native failure detail. The existing chat download cards remain unchanged.

The Thinking panel also received a restrained graphite/grey polish. Download permissions, URL provenance checks, and the native APK requirement remain enforced by the existing agent code.
