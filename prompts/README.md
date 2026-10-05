# prompts/

- `digest.system.md` – Gemini system instruction.
- `digest.schema.json` – `generationConfig.responseJsonSchema`.
- `gemini-user.make.txt` – the user message as a Make template (module refs: 3 = CoinGecko, 17 = parsed Fed speeches RSS, 18 = BLS match `$1`…`$4`).
- `bls-pattern.make.txt` – the regex for Make module 18 (Text parser › Match pattern); the preview tool uses the same file.
- `gemini-body.make.txt` – **generated** paste-ready raw body for Make module 4: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`. Do not edit by hand.

Model names are never written here; they come from `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`.
