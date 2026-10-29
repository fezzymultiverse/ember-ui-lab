# Ember V1.9.59 — real Thinking duties

Thinking now links to actual work instead of being only a visual progress indicator. At the start of a turn it identifies the message, lane, memory/context and safety checks, enabled capabilities, and provider/fallback selection. Provider attempts and provider switches are already emitted by the router and now appear in the same live stream.

Every dispatched tool contributes its real label and completion state, including web search, page reading/scraping, YouTube search, native NewPipe downloads, document and RAG operations, Knowledge Graph mapping, image work, tasks, music, and device actions. Native NewPipe lifecycle events are also linked into Thinking: the stream shows a real download percentage, a saved-to-Music/Ember completion, or a failure only when the native bridge emits that state.

The open stream remains capped and scrollable, keeps the stable spinner/status header, and can still be collapsed from its header. No provider, tool, download, or completion status is invented by the new integration.
