# API audit sources

- Groq API reference: https://console.groq.com/docs/api-reference — official OpenAI-compatible chat endpoint is `POST https://api.groq.com/openai/v1/chat/completions`; current reference documents `max_completion_tokens`, `stream`, `tools`, `tool_choice`, and JSON response formats.
- Mistral Chat endpoint: https://docs.mistral.ai/api/endpoint/chat — official endpoint is `POST /v1/chat/completions`; current request supports `messages`, `model`, `max_tokens`, `stream`, `tools`, `tool_choice`, and JSON response formats.
- Gemini API reference: https://ai.google.dev/api — official REST authentication uses `x-goog-api-key`; standard `generateContent` and streaming `streamGenerateContent` are supported.
- Gemini models: https://ai.google.dev/gemini-api/docs/models — current model listings include Gemini 3.8 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash-Lite, Gemini 3.1 Pro preview, and older 2.5 models with access limitations. The app must continue selecting from the live `/models` response rather than assuming hard-coded names.
