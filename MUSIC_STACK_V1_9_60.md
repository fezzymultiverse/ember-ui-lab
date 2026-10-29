# Ember V1.9.60 — three-part music stack

The Music panel now uses Deezer's public keyless search endpoint for discovery, artwork, track, artist and album metadata. Selecting a Deezer result opens a prominent metadata preview with artwork and an About area; the preview can hand the exact artist/title query to the native YouTube/NewPipe search surface.

MusicBrainz remains the enrichment source for artist biographies, release context and deeper metadata. The existing player metadata pipeline caches this information and `get_current_track` exposes title, artist, album, artwork URL and a combined About text to Ember.

YouTube/NewPipe remains the audio search and download path. The old SoundCloud search control and any Spotify surface are removed from the panel. Native download lifecycle progress continues to appear in Thinking and in the Music downloads area.

The color hierarchy is now cyan/purple for primary identity and actions, green for success, and red for danger, with the premium treatment applied to the main app and Music surfaces.
