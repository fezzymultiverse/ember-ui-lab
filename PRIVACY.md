# Privacy · V1.4.0

*For users and reviewers.*

Ember has no server and no account. Everything it stores stays on the person's device. The person is the controller of their own data. Under POPIA (South Africa) and GDPR terms, the maintainer does not receive, hold or process the person's data. The third-party AI services the person chooses do (see below).

## Stored on the device

**localStorage**

| Key | Contents |
|---|---|
| `ember_set` | Settings: their name, the "About you" text, Ember's name and curiosities, style choices, the Persona box text, mode, context size, accent colour, Free Mode choice |
| `ember_keys` | API keys for Groq, Mistral and Gemini, with the last health-check result. Stored in plain text on the device |
| `ember_models` | Cached lists of model names from each provider (12 hours) |
| `ember_voice` | Ember Voice choices: engine, voice, and the EasyVoice key if one was pasted (plain text on the device). Cleared by Wipe |
| `ember_voice_gm` | Which Gemini speech model last worked |

**IndexedDB** (database `ember`, version 1)

| Store | Contents |
|---|---|
| `convs` | Every chat: messages, title, short summary, rolling summary, private flag |
| `kv` | One record, key `mem`: Core Memory (see [MEMORY.md](MEMORY.md)) |

**Cache Storage**: `ember-v1.4.0` holds the app's own files for offline use. No chat content.

If the browser blocks IndexedDB, chats and memory live in memory only and are lost on reload.

## What leaves the device

Nothing leaves except calls to the AI provider that answers.

| Call | What is sent | To |
|---|---|---|
| Every reply | The system prompt (character rules, the "About you" text, Core Memory facts and threads, the Persona box, the rolling summary) plus the recent messages, up to 5, 15 or 50 depending on the setting | The engine that answers (Groq, Mistral, Gemini or Pollinations) |
| Memory learning, titles, rolling summaries | The last 14 messages (memory) or older messages (summary) | A key-based engine only. Never Pollinations |
| Key checks and model lists | The key itself, as the provider's own credential | That key's own provider |
| Reading a reply aloud with Ember Voice | The text of that one reply (links and code removed) plus a short tone instruction. Only when the Gemini or ElevenLabs voice is selected; "Phone voice only" sends nothing | Google (Gemini speech, with the Gemini key) or ElevenLabs (with its key) |
| Lyrics preview | Title, artist, album and length of the song that is playing. Only while Settings > Music > Lyrics preview is on | lrclib.net (no key, no account) |
| Key extraction from pasted notes | Nothing, except: each unlabeled 32-character string that passes the filters is tried as a Mistral key, so it is sent to `api.mistral.ai` as a credential | Mistral |

The pasted notes themselves are never sent anywhere and never saved. They are parsed locally.

### Free Mode

Free Mode sends the chat to **Pollinations.ai** (`text.pollinations.ai`), a free third-party service with no uptime promise, no privacy commitment this project can vouch for, and anonymous rate limits. It is on by default while there are no keys. In its fallback route the app builds a short URL from the last four messages (400 characters each) plus a fixed line of safety wording, so message text appears in the request URL. Free Mode is never used for background memory work, so Free Mode chats are not learned from.

## Never stored, by design

- **A crisis flag.** The safety level is a JS variable. It is not in any chat, memory, setting or backup. See [SAFETY.md](SAFETY.md).
- **Health details, how the person copes, crises, secrets, passwords and API keys in Core Memory.** The memory extractor is told never to record them, and a filter drops lines that look like secrets. The model can still get this wrong, so the filter is a net, not a guarantee.
- **Learning from private chats.** A chat marked 🔒 Private is never learned from.
- **Learning from a crisis.** Learning stops while any of the last 14 messages is level 2 or higher.

## Stored anyway, and worth knowing

- The **text of every message** is saved in the chat, including a message that triggered the crisis card.
- The **first message of a chat becomes its title** (cut to 38 characters), which shows in the history list and is searchable. The memory extractor may rename it, but a crisis chat is not learned from, so the first-message title stays.
- The **rolling summary** is written by a model that is told to leave out health details. Nothing enforces that.
- Anyone with the unlocked phone can open the app and read it. There is no app lock in V1.3.0.

## Export, import and delete

**Export** writes one JSON file: the settings (`ember_set`, including the About text and Persona box), Core Memory, every chat, and, only if the person ticks "Include keys in backup", the API keys. A backup without keys still holds the person's whole chat history. Treat it as private. It contains no crisis flag.

**Import** adds chats (same id: replaced), merges memory lines without duplicates, and **replaces the settings** with the backup's. Imported memory lines are not run through the secret filter.

**Delete everything** (Settings > Your data) clears every chat and memory record, removes `ember_set`, `ember_keys` and `ember_models`, and reloads. It does not delete files the person already exported, or anything a provider kept.

## Third parties

Each provider has its own terms and retention. This project controls none of them. See [LICENSE_NOTES.md](LICENSE_NOTES.md) and [LIMITATIONS.md](LIMITATIONS.md).

## V1.5.8 · Proactive AI pings and music notification

- **Proactive AI pings (off by default).** When switched on, the app stores your Groq key and up to 600 characters of open-thread topics in the app's private Android SharedPreferences (`EmberPrefs`) so a background task can run while the app is closed. Every few hours the task sends those topics to Groq (api.groq.com) and shows the one-line reply as a notification. Switching pings off cancels the task and deletes the key and topics from that store. The lock screen shows only a generic line.
- **Music notification.** Track title and artist from Ember's own player are shown in the Android notification and lock screen. Nothing is sent anywhere.

## V1.5.9 · Background replies

When "Keep replying in the background" is on and you leave Ember mid-reply, the request (system prompt, recent messages, and the API keys of the engines to try) is written to a file in the app's private storage (`files/ember_bg/`) and run by a background task. The file is deleted as soon as the task finishes or is cancelled. The finished reply is kept in private SharedPreferences (`EmberBg`) until the page collects it. The request goes only to the same engine providers the app would have used. The notification's lock-screen version only says "New reply".

## V1.6.0 · Agent & API tools

- **Web Search (Tavily, with DuckDuckGo as the fallback):** when on, the words the AI searches for are sent to Tavily (`api.tavily.com`) with your Tavily key. If you have no Tavily key, or Tavily fails, the same words are sent to DuckDuckGo (`api.duckduckgo.com`) instead, with no key and no account. Results come back into the chat. The key is stored in this phone's `localStorage` (`ember_agent`) and is not included in backups.
- **YouTube:** searching and downloading go from the phone straight to YouTube/Google servers, like any browser or app would. Nothing goes through an Ember server. The last download's title and result are kept in the app's private storage. Saved audio lands in `Music/Ember`, where other music apps can see it.
- **Vision:** the image link you paste (and your question about it) is sent to Pollinations (`text.pollinations.ai`), which fetches the picture. Leave it off for private images.
- Search results and image descriptions are passed to whichever chat engine answers (including Free Mode), like other tool results.

## V1.6.5 · Song info lookups

When a song plays in the Music panel, Ember looks up artwork, album, year and a short bio. The song **title and artist name** (never audio, never the library) are sent to `api.deezer.com` (Deezer), `musicbrainz.org` (MusicBrainz) and `en.wikipedia.org` / `www.wikidata.org` (the page MusicBrainz links to). Embedded tags and cover art in an MP3 are read on the phone. Results are cached in localStorage (`ember_meta2`, up to 150 songs). The `get_current_track` tool gives the AI the same artwork link and About text.

## V1.6.6 · Device panel

- Wi-Fi, VPN, RAM, storage, uptime and battery readings are read on the phone and shown on screen only. They are not stored and not sent anywhere.
- **Public IP area:** while a VPN is detected, or when the person taps "Look up my public IP area", the app requests `https://ipwho.is/`, which sees the phone's public IP address. The result (city, region, country, provider) is shown and kept in memory for 5 minutes.
- **Permissions added:** `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` (normal, no prompt) and `ACCESS_FINE_LOCATION`, which is requested only when the person taps "Show Wi-Fi name". Android will not reveal a Wi-Fi network's name without it. Ember does not read the phone's location.
- Added quotes are stored in localStorage (`ember_quotes`) and are not included in backups.
- The rotating quotes are short credited excerpts from public interviews, not lyrics.


## Song identification (Audd.io, optional)
Off until you paste an Audd.io API token (stored on the phone as `ember_audd`, removed by Remove token or Delete everything). Only when you tap Identify, press Identify link, or ask Ember in chat, a clip of about 12 seconds of the song (small WAV) or the https link you typed is sent to `api.audd.io` with your token. Audd.io's own terms and retention apply.
