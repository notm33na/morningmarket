# samples/

Synthetic data only: invented values in the real feeds' shapes. Subscriber emails are always `{{TEST_EMAIL+tag}}` placeholders.

- `bls-latest.sample.rss` – BLS "latest numbers" RSS (matched by `prompts/bls-pattern.make.txt`).
- `fed-speeches.sample.xml` – Fed speeches RSS (invented links).
- `coingecko.sample.json` – CoinGecko `/simple/price` response.
- `gemini-output*.sample.json` – Gemini outputs that follow the prompt rules, one per `--variant` (`ai-fallback` uses the Feed fallback JSON).
