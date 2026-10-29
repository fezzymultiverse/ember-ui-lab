# Data flow · V1.4.0

*For reviewers.*

One message, from the keyboard to the screen. `[DEVICE]` marks what stays on the phone. `[NETWORK]` marks what crosses the device boundary.

```
[DEVICE]  person types a message
   |
[DEVICE]  app.js send()
   |        conv.msgs.push({r:'u', t, ts})
   |        Safety.mark( Safety.detect(t).level )   // regex, no network
   |        title = first 38 chars (new chat only)
   |        Store.put(conv)                          // IndexedDB 'convs'
   |        renderLog()  -> crisis card + dot if level >= 2
   v
[DEVICE]  app.js reply()  -> laneFor()  ('fast' | 'deep')
   v
[DEVICE]  Persona.respond()
   |        Safety.detect(last user msg)  -> level
   |        level >= 2: lane = 'deep', directive = null, no echo rewrite
   |        condense()  -- may call util lane for a rolling summary --+
   |        messages = last 5 / 15 / 50 (+ up to a few unsummarised)  |
   |        buildSystem()  ->  Safety.wrapSystem(sys, level)          |
   v                                                                   |
[DEVICE]  Prov.run(lane, {system, messages, temp, max})              |
   |                                                                   |
   |   Free Mode ON  : Pollinations first, then keys                   |
   |   Free Mode OFF: keys first, Pollinations last                    |
   v                                                                   |
[NETWORK] ONE of:                                                      |
   |   Groq     POST api.groq.com/openai/v1/chat/completions          |
   |   Mistral  POST api.mistral.ai/v1/chat/completions               |
   |   Gemini   POST generativelanguage.googleapis.com/v1beta/         |
   |              models/<model>:generateContent                       |
   |   Pollinations  POST text.pollinations.ai/openai                  |
   |              (fallback: GET text.pollinations.ai/<short text>)    |
   |   payload: system prompt + recent messages + temperature + cap   |
   |   credential: the person's own key (Pollinations: none)           |
   v                                                                   |
[DEVICE]  reply text                                                   |
   |        conv.msgs.push({r:'a', t, ts, eng})                        |
   |        Store.put(conv)                                            |
   |        renderLog()  (card stays while level >= 2)                 |
   v                                                                   |
[DEVICE]  app.js after()                                               |
            skip if: private chat, memory off, level >= 2 now,         |
                     or a level >= 2 message in the last 14            |
            else (message 2, then every 6th): Persona.learn()          |
               [NETWORK] util lane: last 14 messages -> a key engine   |
               [DEVICE]  merge into mem, Store.setKV('mem')            |
                                                                       |
[NETWORK] <- the rolling-summary call above: older messages -> a key engine
```

## What crosses the boundary

| Item | Leaves the device? | Where |
|---|---|---|
| The person's message and recent chat | Yes, on every reply | The answering engine |
| The system prompt, including About text, Core Memory, Persona text, summary, safety wording | Yes, on every reply (in Pollinations' GET fallback, only a short fixed prompt and the last four messages) | The answering engine |
| API keys | Yes, as the credential, to their own provider only | Groq, Mistral or Gemini |
| Safety level | **No** | Stays in JS memory |
| Crisis card | **No** | Drawn locally |
| Core Memory, settings, chat history on disk | **No** | Local storage only |
| Pasted notes | **No** (candidate keys may be tested at Mistral) | Parsed locally |
| Backup file | Only if the person shares it | The person's own action |

The app does not send analytics, error reports or telemetry.
