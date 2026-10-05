# tools/

Local Node scripts (Node 18+, no dependencies, read `.env`). They cost 0 Make credits.

- `preview-digest.mjs` – builds the digest exactly as the Make scenario will:
  - `node tools/preview-digest.mjs --sample` uses `samples/` only (no network); add `--variant=no-crypto`, `one-headline`, `fed-only` (GDELT empty) or `ai-fallback` (both Gemini calls fail) for the degraded paths.
  - `node tools/preview-digest.mjs` (live) calls GDELT, CoinGecko, the Fed speeches feed and Gemini (retry on `GEMINI_FALLBACK_MODEL`) with keys from `.env`. Space GDELT calls at least a minute apart.
  - Both write `tests/previews/<date>[.sample[-variant]].html` and `.input.json`; then run the **digest-qa** agent.
  - `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt` writes the raw Gemini body to paste into Make module 4.
  - It evaluates the same Make expressions as the template (`if`, `ifempty`, `get`, `map`, `join`, `replace`, `substring`, `trim`, `length`, `escapeHTML`, `formatNumber`, `formatDate`, `parseDate`) and mirrors XML › Parse XML for the Fed RSS, so a template error shows up locally first.
- `scrub-blueprint.mjs` (planned) – copies `blueprints/raw/*.json` to `blueprints/` with emails, sheet IDs, keychain IDs and model names replaced by placeholders.
