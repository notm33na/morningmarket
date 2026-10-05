# tools/

Local Node scripts (Node 18+, no dependencies, read `.env`). They cost 0 Make credits.

- `preview-digest.mjs` – builds the digest exactly as the Make scenario will:
  - `node tools/preview-digest.mjs --sample` uses `samples/` only (no network); add `--variant=no-crypto` or `--variant=one-headline` for the degraded paths.
  - `node tools/preview-digest.mjs` (live) calls GDELT, CoinGecko and Gemini with keys from `.env`.
  - Both write `tests/previews/<date>[.sample].html` and `.input.json`; then run the **digest-qa** agent.
  - `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt` writes the raw Gemini body to paste into Make module 4.
  - It evaluates the same Make expressions as the template (`if`, `ifempty`, `get`, `map`, `join`, `replace`, `length`, `escapeHTML`, `formatNumber`, `formatDate`, `parseDate`), so a template error shows up locally first.
- `scrub-blueprint.mjs` (planned) – copies `blueprints/raw/*.json` to `blueprints/` with emails, sheet IDs, keychain IDs and model names replaced by placeholders.
