# samples/

Synthetic data only: invented values in the real feeds' shapes. Subscriber emails are always `{{TEST_EMAIL+tag}}` placeholders.

- `bls-api.sample.json` – BLS Public Data API v2 response (4 series, latest, with calculations).
- `fed-speeches.sample.xml` – Fed speeches RSS (invented links).
- `coingecko.sample.json` – CoinGecko `/simple/price` response.
- `gemini-output*.sample.json` – Gemini outputs that follow the prompt rules, one per `--variant` (`ai-fallback` uses the Feed fallback JSON).
