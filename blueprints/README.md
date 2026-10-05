# blueprints/

Make scenario exports. Raw exports go in `blueprints/raw/` (gitignored); only scrubbed copies made by `tools/scrub-blueprint.mjs` are committed. A scrubbed blueprint contains no emails, Sheet IDs, Slack IDs, connection/keychain IDs, keys or model names; `tools/scrub-blueprint.mjs` refuses to write one that does. After re-importing it into Make, replace every `{{UPPER_CASE}}` value (they are valid mapping syntax, so Make will not warn).
