# prompts/

- `digest.system.md` – Gemini system instruction.
- `digest.schema.json` – `generationConfig.responseJsonSchema`.
- `gemini-user.make.txt` – the user message as a Make template (module refs: 3 = CoinGecko, 17 = parsed Fed speeches RSS, 3 = BLS API).
- `bls-request.make.json` – the JSON body for Make module 2 (BLS Public Data API v2). Type your BLS key over the placeholder in Make only; the preview tool fills it from `.env`.
- `gemini-body.make.txt` – **generated** paste-ready raw body for Make module 4: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`. Do not edit by hand.

Model names are never written here; they come from `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`.
