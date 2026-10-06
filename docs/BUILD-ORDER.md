# Build order

Each check is pass/fail. The fallback is already chosen: if a check fails, apply it and move on. Owner = you (Make, Google, Vercel and Slack consoles); Dev = changes to files in this repo and in the site folder.

## 0. Local first (Dev, 0 credits)
`node tools/preview-digest.mjs --sample` plus `--variant=no-crypto`, `no-bls`, `no-fed` and `ai-fallback` → previews + input JSON in `tests/previews/`; check all five against [QA.md](QA.md). Generate the Make body: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`.
- **C0** All five sample previews pass [QA.md](QA.md). *Fallback:* fix template/prompt before anything is built in Make.

## 1. Accounts and settings (Owner)
1. Make › Profile › Time zone options › Scenarios › organization = **America/New_York**.
   - **C1** Retired 2026-10-06: MarketMorning has its own Make account, so no other scenario is affected by the time zone.
2. Slack: create **#marketmorning-alerts**; add a Make Slack **bot** connection and invite the Make app to the channel.
3. Make connections: Gmail and Google Sheets with Make's built-in **Sign in with Google**. No Google Cloud OAuth app is needed: Make's custom client is optional, and personal Gmail just needs reauthorizing every 6 months (calendar reminder at 5).
4. No Google Cloud project: the site reaches the Sheet through `tools/site-sheet-api.gs` (§2).
5. API keys: BLS Public Data API (free registration at data.bls.gov/registrationEngine) → `.env` as `BLS_API_KEY` and typed into module 2's body in Make; Gemini (AI Studio) → Make keychain "Gemini" (header `x-goog-api-key`) + `.env`; CoinGecko Demo (developer dashboard) → Make keychain "CoinGecko" (header `x-cg-demo-api-key`) + `.env`.
   - **C7** Both `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` are set, different, listed by `models.list` for your key, and have a free-tier quota in AI Studio. *Fallback:* pick another stable free-tier Flash/Flash-Lite model from the models page for the failing one (in .env and Config).
6. Google Account: 2-Step Verification on, create app password "marketmorning-vercel".
   - **C10** App password can be created and nodemailer sends a test mail via smtp.gmail.com:465. *Fallback:* only then create an OAuth client (+ consent screen published to Production) and use nodemailer OAuth2 with a refresh token (env `GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`).

## 2. Google Sheet (Owner)
Run `tools/sheet-setup.gs` (Extensions › Apps Script › paste › run `setupMarketMorning`), which builds every tab in [SHEET.md](SHEET.md); replace the three `[PLACEHOLDERS]` in Config. Then add `tools/site-sheet-api.gs` as a second script file, run `setupSecret()` and deploy it as a Web app (Execute as Me, access Anyone) → Vercel env `MM_SCRIPT_URL`, `MM_SCRIPT_SECRET`.
- **C2** Feed row 2 shows all 12 values with no `[...]` placeholders left in B2, J2 or L2 (the setup log lists any), and `fallback_json` (cell C2) is valid JSON (paste it into any JSON validator). *Fallback:* fix the formula until it is.

## 3. Site repo: functions and section (Dev, then Owner deploys)
Build `/api/mm/*`, `/unsubscribe`, the "Live demo: MarketMorning" section, `/mm/chart-unavailable.png` and `/mm/coingecko-logo.png` (downloaded from the CoinGecko Brand Kit) per [SITE.md](SITE.md); set Vercel env vars; run PRD tests 9–11 on a preview deployment.
- **C11** Vercel Firewall has a free rate-limit rule slot on this Hobby project. *Fallback:* extend the existing rule's path condition to include `/api/mm/`; if none can be edited, use an in-function per-instance limiter and rely on the email budgets.
- **C16** Second request to the chart URL from a preview email returns `x-vercel-cache: HIT`; `&x=1` or a blank value returns the placeholder. *Fallback:* raise `s-maxage` to 604800.

## 4. Make scenario (Dev generates, Owner imports)
`node tools/build-blueprint.mjs`, then follow [IMPORT.md](IMPORT.md): import, connect, run its import checks. Test runs: MAIA-PROMPTS Step 8.

*Fallback (manual or Maia build, [MAIA-PROMPTS.md](MAIA-PROMPTS.md)):*

**Phase A:**
1. Create modules 1–12 in ID order as a plain chain, with no routers, directives or filters yet.
2. Leave unconfigured every field that references modules 17 or 18: the module 4 and 15 bodies, the Gmail HTML in 6–8, ERR in 9 and the text in 10.
3. Create 13–15 (the error-route modules only).
4. Insert 16–17 on the 3 → 4 link (right-click the link › Add a module).

**Phase B:**
1. Add router R1, then all directives and filters; 6 → 10 stays a chain (C13b). These take IDs ≥ 19.
2. Create JSON only if C6 fails.
3. Now set R1, paste the bodies and the HTML, and map ERR.

Use 3 `{{TEST_EMAIL+mmN}}` active rows in Subscribers. Single-module checks (C6, C22, C23, C25) use "Run this module only" (≈ 1 credit each).
- **C19** *Result 2026-10-06:* blueprint import keeps the IDs. Module order matches ARCHITECTURE §2 and every Make ID is label number + 1 (Read Feed = ID 2 … 17 Parse Fed RSS = ID 18; routers/directives ≥ 19), matching the IDs used in the template and prompts. *Fallback:* if a new build (or an import) has a different offset, regenerate the template and Gemini body for those IDs (Dev) instead of rebuilding; IDs can't be renumbered in Make.
- **C21** Module 1 output lists columns 0–11 labelled `send_enabled` … `gemini_fallback_model`. *Result 2026-10-05:* Make keys them by column number, so every Feed mapping uses `` {{2.`N`}} `` (raw pill text confirmed by copying a pill). *Fallback if a later export differs:* copy one pill's raw text and update the template, prompts and `feedRow` in the preview tool to match.
- **C6** *Result 2026-10-06 (export):* Make's editor saves `" "` as an empty argument and breaks on `\"`; the template and prompt now use the `space` keyword and `escapeHTML` instead, and `build-blueprint.mjs` refuses both. Module 4 returns 200 when a Fed title contains `"` and `\`, and the schema is accepted. *Fallback:* add JSON › Create JSON (next free ID) before module 4 (+1 credit, already in the 15 worst case). If `responseJsonSchema` is rejected, use `responseSchema` with the same schema minus `additionalProperties`. If Make treats `\`/`\"` in string literals differently from the preview tool, change the tool's tokenizer to match.
- **C9** BCC from `` split(2.`5`/`6`/`7`; ",") `` (field in Map mode) delivers to all 3 test addresses with none visible to others. *Fallback:* map BCC as one item per address.
- **C22** *Result 2026-10-06 (run 1):* Make wraps every XML element in an array, so the paths are `18.rss.channel[1].item[N].title[1]` (also `link[1]`, `pubDate[1]`); template, prompt, generator and `parseRss()` updated. CDATA is unwrapped, items newest first, and `trim(substring(pubDate; 5; 16))` gives e.g. "1 Oct 2026". Dates are the feed's GMT day (a speech after 20:00 ET shows the next day); accepted.
  - *Fallback:* change the `18.rss…` paths in the template and user prompt to Make's actual structure. Mirror the change in `parseRss()` of the preview tool, then regenerate the Make body.
  - If module 16's "Parse response" already yields the parsed XML, drop module 17 (−1 credit). Then change `18.rss…` to `17.data.rss…` everywhere: template, user prompt, the `FED` expression in R1/ERR, and `ctx.bundles` in the tool.
- **C23** *Result 2026-10-06:* 200 RSS on day 1 (several runs); days 2–3 skipped by the owner, so the Slack "No Fed feed." alert is the live monitor. Module 16 returns 200 RSS (not a challenge page) from Make on 3 test days, and `17.data` shows as text (else map `{{toString(17.data)}}` in module 17). *Fallback:* add header `Accept: application/rss+xml`. If it is still blocked, delete 16–17 (−2 credits), remove `length(FED)` from R1/ERR and the Fed blocks from the template and prompt, and mirror that in the tool.
- **C24** Retired: BLS now comes from the JSON API, so there is no text parser.
- **C25** *Result 2026-10-06:* `REQUEST_SUCCEEDED` with 4 series on day 1; days 2–3 skipped by the owner, so the Slack "No BLS data." alert is the live monitor. Module 2 returns `REQUEST_SUCCEEDED` from Make with 4 series in request order and `calculations.pct_changes` filled (2026-10-05: the BLS RSS feed returned 403 "Access Denied" from Make even with contact details; the keyless API answered 200, so the design moved to the API). *Fallback:* if the API is blocked or over its daily limit, delete module 2, remove the `3.data.Results.series[1].data[1].value` gates from R1, ERR and module 10 and the BLS blocks from the template and prompt, mirror that in the tool, and regenerate the Make body (−1 credit).
- **C13** R1 "Content OK" passes on a normal run and sends all-empty runs to the fallback route. R1 is one AND group: `` 2.`0` `` Text = `TRUE`, and the source count Numeric > 0. *Fallback:* use Boolean "Equal to" `true` for the first condition. If the count expression errors, split it into three OR groups, each `send_enabled = TRUE` AND one source condition.
- **C13b** Modules 9/10 on R2's last route can map `7.id`, `8.id`, `9.id`. *Result 2026-10-06 (import):* fails, Make reports "references inaccessible module"; fallback applied in `tools/build-blueprint.mjs`, and `SENT` counts only batches ≤ `` 2.`4` `` (ARCHITECTURE §2). *Fallback:* drop R2 and chain 6 → 7 → 8 → 9 → 10 with no filters; an empty batch then sends an owner-only copy (same credits, ≤ 2 extra recipients/day).
- **C14b** These must all work:
  - Resume with empty `data` on modules 2, 3, 16, 17 and 18.
  - Module 5's Resume fields.
  - **4 fails, 15 succeeds:** module 5 parses the fallback model's text.
  - **4 and 15 both fail:** module 5 uses `fallback_json`, and the footer says "not written by AI".

  *Fallback:*
  - If Make offers no error handler on module 15, set 15's "Evaluate all states as errors" to No.
  - If Resume can't carry `{{16.data}}`, set module 5 to `` {{ifempty(5.data.candidates[1].content.parts[1].text; ifempty(16.data.candidates[1].content.parts[1].text; 2.`2`))}} ``.
- **C20** PRD test 5 (CoinGecko empty): the email still sends and shows "Crypto prices unavailable today." *Fallback:* if `parseDate`/`formatDate` still error on empty input, replace the as-of expression with a fixed "Crypto prices: last 24 hours" label.
- **C18** The email rendered by Make matches the local preview for the same inputs: save module 2, 3, 16 and 4-text outputs as `bls.json`, `coingecko.json`, `fed.xml`, `gemini-output.json` in a folder outside the repo and run `node tools/preview-digest.mjs --from=<folder>`. *Fallback:* adjust the template expression and re-run `--sample`.

## 5. Quality gate (Dev)
`node tools/preview-digest.mjs` (live) on 5 different days (plus the C0 variants); check each against [QA.md](QA.md).
- **C17** *2026-10-06:* live preview passed QA.md; a tighter summary prompt (crypto as rose/fell only, $ and % in the note) was tried and kept out by the owner, so Make and the repo run the original, longer prompt. 5/5 PASS. *Fallback:* tighten `prompts/digest.system.md`, regenerate the Make body, re-run; ship only after 5/5.

## 6. End-to-end (Owner)
Run the PRD tests per MAIA-PROMPTS Step 8 with "Run once". Test budget: ≤ 150 credits for §4–§6.
- **C8** Received message source shows `List-Unsubscribe`. *Fallback:* remove the header; the footer link stays.
- **C15** Make credit usage is ≤ 12 per normal run and ≤ 15 worst, and every test run's recorded duration stays near the ≈ 3.3-min estimate (< 4 min). *Fallback:* remove the Gemini retry route (−2).

## 7. Go live (Owner)
Turn **Data is confidential** back on (it is off during testing). Activate the schedule on a date where (remaining weekdays × 15) + credits already used this month (including the ≤ 150 test credits) ≤ 400; for example, go live in the month after testing. Open the site section.
*Decision 2026-10-06:* the owner went live the same day. The scenario now runs on its own Make account (1,000 credits, not shared with LeadFlow), so October's estimated ~370–440 credits (tests + 18 weekdays) can pass the 400 target once without hitting Make's limit; from November it is back to ≤ 345/month.

Reminders: reauthorize Make Gmail every 5 months; monthly purge (Dashboard B9); quarterly CoinGecko terms review.
- **C14** Runs on Fri 2026-10-30 and Mon 2026-11-02 both start at 08:00 ET. *Fallback:* set the schedule time manually after each DST change.

## 8. Publish (Dev + Owner)
Export the blueprint to `blueprints/raw/`, run `node tools/scrub-blueprint.mjs` (must exit 0), review the scrubbed file (on the first real export, also check no numeric `key`/`keychain` fields remain), run the secret scan `git grep -nIE "AIza|CG-[0-9A-Za-z]{15}|xox[abprs]-|ya29.|@gmail.com|gemini-[0-9]"` (must print nothing), push the public repo, add README screenshots, record the Loom.
