# Threat model · V1.4.0

*For reviewers.*

Scope: a client-only app with no server. The assets are the person's chat history, their API keys, and the quality of Ember's response when the person is in danger. Residual risk is stated plainly; "none" is never claimed.

| Threat | Mitigation | Residual risk |
|---|---|---|
| **Prompt injection through pasted notes** | Pasted notes are parsed locally by regex for key shapes and never sent to any model or saved. Only candidate keys are extracted | Low. A pasted 32-character string that is not a Mistral key is still sent once to Mistral as a credential during the test |
| **Prompt injection through chat text, the About or Persona boxes, or learned memory lines** | The HARD RULES sit first and a FINAL CHECK closes the prompt. Memory lines are cut to 140 characters and run through a secret filter. The crisis block is appended last | Medium. A model can still follow hostile text. A learned line can carry a hostile instruction into later prompts |
| **Key exfiltration via backup export** | Keys are left out of the export unless the person ticks the switch. The toast warns when they are included | Medium. A backup with keys is a plain-text file. The app cannot control where the person saves or shares it. Keys are also plain text in localStorage |
| **Model produces medical or clinical advice** | The prompt forbids advice and diagnosis, and calls Ember "not a therapist". The crisis block repeats it | Medium. Behaviour depends on the provider's model and can drift. Nothing checks the output |
| **Crisis message missed by `Safety.detect` (false negative)** | Broad level 2 lists, curly-apostrophe handling, prompt rule 10 as a second layer, and the crisis wording written for the model | **High, and unavoidable with regex.** Indirect, sarcastic, coded, slang or non-English wording is missed. Only the latest message is read, so a crisis followed by "ok" returns to normal tone next turn |
| **False positive that triggers crisis mode** | Idiom guard; means and timing count only next to ideation; tests for everyday phrases | Low to medium. "I don't want to live in this city" style phrases can still trip a level 2 match, and "I'm not suicidal" scores as level 2. The cost is a card the person did not need, and the safe side was chosen on purpose |
| **False positive that mutes features** | Level 1 changes tone only. Level 2 and above drops Spark / Go deeper for that one turn | Low. Level resets on the next message that scores below 2 |
| **Old save missing new memory keys** | `migrateMem` fills every key from `MEM_DEF` and keeps facts, threads and any extra keys. It runs on load, on clear and on import | Low. Only the memory object is versioned. Chat and settings objects have no migration |
| **Backup import overwriting existing data** | Memory is merged, not replaced, with duplicates skipped. Chats with the same id are replaced after a confirm dialog | Medium. Settings are replaced wholesale. Imported memory lines skip the secret filter. A crafted backup can inject settings (including the Persona text) and memory lines |
| **Third-party provider logs chat content** | The person chooses the provider. Free Mode shows a warning and a badge. Background jobs never use Pollinations | **High and outside our control.** Every reply sends the system prompt and recent messages to the provider. Retention is the provider's policy |
| **Free Mode GET fallback loses the safety wording** | The local crisis card still shows | Medium. In that route the app sends a fixed short prompt instead of the full system prompt, so the crisis block and numbers are not sent. See [LIMITATIONS.md](LIMITATIONS.md) |
| **Device theft or an unlocked phone** | None in the app. No lock, no encryption at rest | **High.** Anyone holding the unlocked phone can read the chats and the keys. Crisis chat titles are visible in the history list |
| **Crisis text reaching memory or summaries** | Learning is skipped for 14 messages after a level 2 or 3 message; extractor prompt bans crises | Medium. The rolling summary is not gated on the safety level |
| **Crisis flag leaking into a backup** | The flag is a JS integer and is never stored. CI fails on `conv.flagged` | Low. Possible regression if a future change persists it |
| **XSS from stored text** | Messages go through `esc()` before rendering. The crisis card has no user text | Low |

Out of scope: a compromised device or browser, a malicious browser extension, attacks on the providers.
