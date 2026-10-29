# Plan: aifreeforever.com in Ember (V1.9.80)

## Facts (from the site's home page, read 2026-10-28)
- [CONFIRMED] Web app: chat (GPT, Claude Haiku, Gemini, Grok, DeepSeek, Kimi, Qwen, Llama), 23 image models, text to speech, transcription, background remover, upscaler, sticker maker, document skills (@Word @Excel @PPT @PDF).
- [CONFIRMED] No login or signup. Funded by ads. Users report watching a short ad or a robot check before use.
- [CONFIRMED] The page documents NO public API, no API key and no developer docs.
- [UNVERIFIED] Its terms of use on automated access (page could not be fetched). Read them before anything automated.

## What this means
Ember's engines need an HTTP API with a key. aifreeforever offers none, so it cannot join the engine route the way Groq or Puter does. Calling its private page endpoints would be fragile and may break its terms: not recommended.

## Options (pick one)
| Fix | What | Effort | Risk |
|---|---|---|---|
| Quick | Add it to Saved Sites (name "AI Free Forever", url https://aifreeforever.com/) and open it from the Browser tab. | 2 min, no code | none |
| Medium | A "Free tools" card in Settings with deep links: chat, image generators, text to speech, transcription, background remover, each opening in the in-app Browser. Ember can suggest the right link when he asks for an image, voice or transcription. | ~1 h, ember_extras.js + one list | low (links only) |
| Optimal | Use Puter for the same capabilities through documented endpoints: the token is already wired for chat; add Puter image and text-to-speech calls to the Imagine and Voice screens as the free fallback. Keep aifreeforever as the link-out for tools Puter lacks (background remover, upscaler, sticker maker). | ~3 h | low; needs one live test of each Puter endpoint |

Recommendation: Medium now, Optimal next. Reason: it is the only route that works without an API, and Puter is the only one with documented, keyed access.

## Next steps
1. Add the Saved Site today (Menu > Saved Sites).
2. Send the Puter models list result (Settings > Keys > Check all) so the default model can be set.
3. Decide Medium or Optimal; the build follows the chosen one.
