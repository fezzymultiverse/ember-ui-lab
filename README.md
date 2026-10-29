# Ember docs · V1.4.0

*For reviewers and anyone new to the repo.*

Ember is a text-only companion app (PWA, APK-ready through Capacitor). It is plain HTML and JavaScript in `www/`, with no build step and no server. The person talks to it about anything. It keeps a small local memory, leads the conversation, and calls Groq, Mistral or Gemini with the user's own keys, or Pollinations.ai in Free Mode.

V1.3.0 is the safety release. It adds `www/safety.js`, an offline distress and self-harm check that runs before every reply, plus a local crisis card and a memory-format migration. The fun features drafted for it are deferred to V1.4.0 (see [CHANGELOG.md](CHANGELOG.md)).

## What Ember is NOT

- **Not a therapist.** It gives no diagnosis, treatment or clinical advice.
- **Not a crisis line.** It cannot call anyone, alert anyone, or know whether a person is safe. See [CRISIS_PROTOCOL.md](CRISIS_PROTOCOL.md).
- **Not a medical device.** No clinical validation has been done. See [LIMITATIONS.md](LIMITATIONS.md).

If you are in danger in South Africa: SADAG suicide crisis line 0800 567 567, Lifeline South Africa 0861 322 322, or 112 from a mobile.

## Start here (reviewer order)

1. [LIMITATIONS.md](LIMITATIONS.md): what the app does not do. Read this first.
2. [ARCHITECTURE.md](ARCHITECTURE.md): files, request flow, invariants.
3. [SAFETY.md](SAFETY.md) and [CRISIS_PROTOCOL.md](CRISIS_PROTOCOL.md): the safety layer and what the person sees.
4. [DATA_FLOW.md](DATA_FLOW.md) and [PRIVACY.md](PRIVACY.md): what is stored, what leaves the phone.
5. [THREAT_MODEL.md](THREAT_MODEL.md): risks, mitigations, what is left over.
6. [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md): the pass/fail list for this version.

## Index

| Doc | Audience | What it covers |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | reviewer, contributor | File map, request flow, lanes, state, invariants |
| [SAFETY.md](SAFETY.md) | reviewer, contributor | `Safety.detect` levels, idiom guard, prompt wrapping, the transient flag |
| [CRISIS_PROTOCOL.md](CRISIS_PROTOCOL.md) | maintainer | What happens at level 2 and 3, the numbers shown, triage |
| [PRIVACY.md](PRIVACY.md) | user, reviewer | Every stored key, everything that leaves the device |
| [THREAT_MODEL.md](THREAT_MODEL.md) | reviewer | Threat, mitigation, residual risk |
| [DATA_FLOW.md](DATA_FLOW.md) | reviewer | One message round-trip, with the device boundary marked |
| [MEMORY.md](MEMORY.md) | contributor, reviewer | The `mem` shape, what is learned and refused, migration |
| [CONTRIBUTING.md](CONTRIBUTING.md) | contributor | Running locally, style, the PR invariants |
| [CHANGELOG.md](CHANGELOG.md) | everyone | V1.3.0 and V1.2.0 |
| [TESTING.md](TESTING.md) | contributor, reviewer | Commands, the detect table, manual checks, coverage gaps |
| [LIMITATIONS.md](LIMITATIONS.md) | everyone | Known gaps, stated plainly |
| [LICENSE_NOTES.md](LICENSE_NOTES.md) | maintainer | License status and third-party services |
| [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) | reviewer | Checkbox list for V1.3.0 |
| [FEATURES.md](FEATURES.md) | user | The feature notes from the old root README |
