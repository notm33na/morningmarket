# tools/

Local Node scripts (Node 18+, no dependencies, read `.env`). They cost 0 Make credits.

- `preview-digest.mjs` – builds the digest exactly as the Make scenario will:
  - `node tools/preview-digest.mjs --sample` uses `samples/` only (no network); add `--variant=no-crypto`, `no-bls`, `no-fed` or `ai-fallback` (both Gemini calls fail) for the degraded paths.
  - `node tools/preview-digest.mjs` (live) calls BLS, CoinGecko, the Fed speeches feed and Gemini (retry on `GEMINI_FALLBACK_MODEL`) with keys from `.env`.
  - `node tools/preview-digest.mjs --from=<folder>` replays outputs saved from a Make run (`bls.rss`, `coingecko.json`, `fed.xml`, `gemini-output.json`) for check C18; keep that folder outside the repo.
  - Both write `tests/previews/<date>[.sample[-variant]].html` and `.input.json`; then run the **digest-qa** agent.
  - `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt` writes the raw Gemini body to paste into Make module 4.
  - It evaluates the same Make expressions as the template (`if`, `ifempty`, `get`, `map`, `join`, `replace`, `substring`, `trim`, `toString`, `length`, `escapeHTML`, `formatNumber`, `formatDate`, `parseDate`) mirrors XML › Parse XML for the Fed RSS, and applies `prompts/bls-pattern.make.txt` like Text parser › Match pattern, so a template error shows up locally first.
- `scrub-blueprint.mjs` (planned) – copies `blueprints/raw/*.json` to `blueprints/` with emails, sheet IDs, keychain IDs and model names replaced by placeholders.
