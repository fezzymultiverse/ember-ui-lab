# Crisis protocol · V1.4.0

*For maintainers.*

This is what the app does when `Safety.detect` scores a message level 2 or 3, and what a maintainer should do when it did not work. It describes behaviour. It is not a promise that anyone is kept safe. See [SAFETY.md](SAFETY.md) for the detection rules and [LIMITATIONS.md](LIMITATIONS.md) for what is missed.

## Level 2 (self-harm or suicide ideation)

In this order, on send:

1. `app.js send()` marks the level. The **crisis card** and the red **support dot** are drawn at once, before any engine answers.
2. `Persona.respond` re-checks the message, then forces the **deep lane**, discards any **directive**, and skips the **anti-echo rewrite**.
3. The system prompt gets the **crisis block** appended last: steady and warm, no jokes, no diagnosis, no advice, say plainly it is bigger than a chat, give the numbers, ask one grounding question, stay in the conversation.
4. The reply is shown. The card stays under it.
5. `after()` **does not learn** from this chat, now or for the next 14 messages.

The card and dot clear on "New chat", on opening another chat, or on the next message that scores below level 2. A page reload clears them.

## Level 3 (plan, means or timing, or a goodbye)

The same as level 2. In V1.3.0 there is no extra behaviour at level 3. The signal is only recorded.

## Level 1 (heavy distress)

No card, no dot. The tone override is appended: no jokes, no cleverness, steady and warm. Lane and directives are unchanged.

## The numbers shown

| Service | Number |
|---|---|
| SADAG suicide crisis line | 0800 567 567 |
| Lifeline South Africa | 0861 322 322 |
| Emergency services, from a mobile | 112 |

They are hardcoded in `Safety.crisisCard()` and the crisis block, in the card, as `tel:` links. A draft of this release listed "Emergency 10111"; the code uses 112 because 10111 is the police line, not a general emergency number. Review these numbers before every release (see the date in [LIMITATIONS.md](LIMITATIONS.md)).

## If a user reports the card did not appear

Do not ask for the person's transcript. Ask what they typed only if they volunteer it, and treat it as private.

1. **Was the message a miss?** Check it against the patterns by running it through `Safety.detect`. If it scores 0 or 1, this is a detection gap, not a rendering fault. Follow the "add a Safety pattern" steps in [CONTRIBUTING.md](CONTRIBUTING.md).
2. **Was the card cleared?** A later message below level 2, "New chat", opening another chat or a reload clears it. This is by design, and the question of making it last longer is open.
3. **Is `safety.js` loading?** It must be in `index.html` before `persona.js` and listed in `sw.js`. A stale service-worker cache is possible after an update; the cache name changes with each version.
4. **Was the message sent?** The card is drawn on send from `app.js`. If the chat is blocked (busy state), nothing was sent.
5. Record the finding in [CHANGELOG.md](CHANGELOG.md) without including the person's words.

## What NOT to do

- **Do not describe the app as a safety net**, a monitoring tool, or a substitute for a crisis line or a professional.
- **Do not add a "report this user" feature or any alerting.** There is no server and no authority behind the app, so a report would go nowhere and would break the privacy promise.
- **Do not store the crisis level or log crisis messages**, even for debugging.
- **Do not send the person's text anywhere** to improve detection.
- **Do not shorten the card or hide the numbers behind a tap** to make the UI tidier.
