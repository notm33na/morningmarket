# samples/

Synthetic data only: fictional headlines on example.* domains and invented prices. Subscriber emails are always `{{TEST_EMAIL+tag}}` placeholders.

- `news.csv` – News tab seed (GDELT query terms).
- `gdelt.sample.json` – GDELT DOC `artlist` response (one title has `"` and one has `\` to test escaping).
- `coingecko.sample.json` – CoinGecko `/simple/price` response.
- `gemini-output.sample.json` – a Gemini output that follows the prompt rules.
- `fed-speeches.sample.xml` – Fed speeches RSS in the real feed's shape (invented links).
- `gemini-output.no-crypto.sample.json`, `gemini-output.one-headline.sample.json`, `gemini-output.fed-only.sample.json` – outputs for the degraded `--variant` runs (`ai-fallback` uses the Feed fallback JSON).
