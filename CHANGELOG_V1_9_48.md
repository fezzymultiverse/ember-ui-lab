# Ember V1.9.48

## Included
- Restored the original charcoal/black and orange Ember visual palette; no global white-theme override was introduced.
- Refined the chat composer into a tighter rounded pill with clearer focus, send, and stop states.
- Added a live routing state to the provider pill while an engine/model is being attempted.
- Added OpenAI-compatible SSE token streaming for normal chat completions when the provider supports streaming and the request does not require JSON or native tool calls.
- Added a Stop control that aborts active fetch/SSE work and prevents routing from continuing to another provider after the user cancels.
- Preserved automatic provider fallback, rate-limit cooldowns, pinned-engine behavior, native background handoff, and existing chat history.
- Added `tests/streaming-routing-test.js` for streaming chunks and cancellation, and updated the abort regression test to expect explicit cancellation.

## Verification
- JavaScript syntax checks passed for `www/providers.js`, `www/persona.js`, and `www/app.js`.
- Passing focused tests: routing fallback, streaming/cancel, safety, key scan, handoff, scraping, and several regression tests.
- Full `npm test` cannot complete in this environment because Playwright is not installed. Some browser-based tests were therefore skipped. Live provider credentials and Android device behavior were not verified.

## Streaming scope
Streaming currently applies to OpenAI-compatible provider calls when there are no native tool declarations and the request is not JSON mode. Providers using different streaming protocols (such as Gemini/Cohere) continue to use their existing non-streaming response path, but can still use routing fallback. The Stop button cancels supported in-flight network/stream work.

### Follow-up routing correction (2026-10-27)
- Tool-result synthesis now carries the provider and model that issued the tool call, and the router keeps that follow-up on that same provider/model rather than restarting the general fallback order.
- If the original provider cannot continue the tool-result turn, Ember returns an explicit failure instead of silently starting another full routing chain.
- Added `tests/tool-followup-routing-test.js` as a regression check for the fixed-route handoff.
