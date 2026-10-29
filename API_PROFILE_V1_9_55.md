# Ember V1.9.55 — API profile and scraper routing

## Active AI route

Ember’s automatic route is now **Groq → Cohere → OpenRouter → Gemini → Mistral**. Hugging Face remains readable in old saved-key data and diagnostics, but is excluded from automatic selection. A pinned provider is accepted only from the active profile. Existing Mistral support remains enabled.

OpenRouter remains conservative by default: its model ranking only selects models with a `:free` suffix, so the app does not spend OpenRouter credits without an explicit model-routing change. OpenRouter’s official limits page says free variants are limited to 20 requests per minute and 50 requests per day for accounts with fewer than 10 credits purchased, or 1,000 per day after the threshold. Cohere’s official rate-limit page says evaluation keys are free but limited and that trial keys are limited to 1,000 API calls per month, with per-model request limits. Groq’s official model page exposes live model IDs and current developer-plan limits through its models endpoint.

## Scraper routing

Scraper keys remain first-class. Ready keyed page providers are placed before the Free reader, provider keys rotate per provider, rejected/rate-limited keys are temporarily parked, and the next provider is tried when a keyed provider fails. Search-capable scraper keys are separately tried by `web_search` before DuckDuckGo and Wikipedia fallbacks. The app reports the provider that actually answered and retains the `tried` reasons; it does not claim a scrape succeeded when it did not.

For people and topic searches, the prompt now tells Ember to use all available keyed search engines first, then the keyless fallbacks, and to ask for more identifying detail if every source returns no reliable result. It must not invent names, identities, topics or scraped facts.

## Official sources

- Groq models and current model/rate information: https://console.groq.com/docs/models
- Cohere API key types and rate limits: https://docs.cohere.com/docs/rate-limits
- OpenRouter credit and free-model limits: https://openrouter.ai/docs/api_reference/limits
- OpenRouter live model catalog: https://openrouter.ai/docs/api-reference/models/get-models
