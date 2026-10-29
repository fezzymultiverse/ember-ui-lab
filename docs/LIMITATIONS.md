# Limitations · V1.4.0

*For everyone, including reviewers and users.*

## What Ember is not

Ember is **not a therapist**, **not a crisis line**, and **not a medical device**. It cannot call anyone, alert anyone, check on anyone, or know whether a person is safe.

## The safety check will miss things

`Safety.detect` is a list of regular expressions. It is fast, offline and predictable, and it **will miss real crises**. Specifically it does not understand:

- sarcasm, jokes that carry real feeling, or understatement ("might not be around much longer");
- indirect or implied ideation, and descriptions of a plan without any trigger word;
- slang, misspellings, spacing tricks, and coded language;
- any language other than English;
- context across messages. It reads only the person's latest message, so a heavy message followed by "ok" returns to normal tone on the next reply.

It will also fire when it should not. "I'm not suicidal" scores as level 2. The app chooses the false alarm over the miss, on purpose.

A second layer exists: HARD RULE 10 in the character prompt asks the model to notice danger by itself and point to a real person. It depends on the model.

## Other known gaps

- **Level 1 does not stop directives.** At level 1 the tone override is added, but Spark and Go deeper still go through. A Spark request ("bring something fresh, a thought experiment") can pull against a "no cleverness" override in the same prompt.
- **Level 3 is handled the same as level 2.** The distinction is recorded and unused.
- **Free Mode's fallback drops the safety wording.** If Pollinations' normal route fails and the app falls back to the short GET route, it sends a fixed short prompt and the last four messages. The crisis block and numbers are not in it. The local crisis card still shows.
- **Free Mode sends chats to a third party** (Pollinations.ai). It is slow, rate-limited for anonymous use, has no uptime promise, and may log messages. It is on by default while the person has no key.
- **Providers can log chat content.** Groq, Mistral and Gemini each have their own retention and training terms. The app does not control or verify them.
- **Model behaviour is provider-dependent and drifts.** Models are chosen from each provider's live list, so the model behind a reply can change without a code change. The same prompt can behave differently over time.
- **Crisis text can reach memory-adjacent places.** The first message of a chat becomes its title. The rolling summary is not gated on the safety level. The message text is stored in the chat like any other.
- **No app lock, no encryption at rest.** Anyone with the unlocked phone can read chats and API keys.
- **The numbers are South African.** SADAG 0800 567 567 and Lifeline 0861 322 322 were checked against a university national-helplines page on 2026-10-22. 112 as the mobile emergency number was not cross-checked. Numbers change; recheck them before each release. They are wrong for anyone outside South Africa.
- **No server, so no server-side safety net.** Nothing monitors usage, alerts a person, or notices a failure of the safety layer in the field.

## What has not been done

- **No clinical validation.** No clinician reviewed the detection lists, the crisis wording or the prompt.
- **No penetration test and no security audit** by a third party.
- **No labelled evaluation** of `Safety.detect` on real messages (recall and false-positive rate are unknown).
- **No accessibility audit.**
- **No testing on real phones** beyond the maintainer's own use, and no testing against live provider APIs in the automated suite.

See [CRISIS_PROTOCOL.md](CRISIS_PROTOCOL.md) for what the app does in a crisis and [TESTING.md](TESTING.md) for what is covered.
