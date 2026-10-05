# prompts/

- `digest.system.md` – Gemini system instruction.
- `digest.schema.json` – `generationConfig.responseJsonSchema`.
- `gemini-user.make.txt` – the user message as a Make template (module refs: 2 = GDELT, 3 = CoinGecko).
- `gemini-body.make.txt` – **generated** paste-ready raw body for Make module 4: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`. Do not edit by hand.

The model name is never written here; it comes from `GEMINI_MODEL`.
