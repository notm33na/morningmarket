# Build order

Each check is pass/fail. The fallback is already chosen: if a check fails, apply it and move on. Owner = you (Make, Google, Vercel and Slack consoles); CC = Claude Code (files in this repo and in the site repo).

## 0. Local first (CC, 0 credits)
`node tools/preview-digest.mjs --sample` plus `--variant=no-crypto`, `no-bls`, `no-fed` and `ai-fallback` → previews + input JSON in `tests/previews/`; run **digest-qa** on all five. Generate the Make body: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`.
- **C0** All five sample previews pass digest-qa. *Fallback:* fix template/prompt before anything is built in Make.

## 1. Accounts and settings (Owner)
1. Make › Profile › Time zone options › Scenarios › organization = **America/New_York**.
   - **C1** LeadFlow still fires at its intended time. *Fallback:* re-enter LeadFlow's schedule in New York time.
2. Slack: create **#marketmorning-alerts**; reuse the existing Make Slack connection.
3. Make connections: Gmail and Google Sheets with Make's built-in **Sign in with Google** (same as LeadFlow). No Google Cloud OAuth app is needed: Make's custom client is optional, and personal Gmail just needs reauthorizing every 6 months (calendar reminder at 5).
4. Google Cloud project "marketmorning" **for the service account only**: enable the Google Sheets API, create a service account (no roles), create a JSON key → Vercel env (`GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`) and a local file outside the repo. No OAuth consent screen.
5. API keys: Gemini (AI Studio) → Make keychain "Gemini" (header `x-goog-api-key`) + `.env`; CoinGecko Demo (developer dashboard) → Make keychain "CoinGecko" (header `x-cg-demo-api-key`) + `.env`.
   - **C7** Both `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` are set, different, listed by `models.list` for your key, and have a free-tier quota in AI Studio. *Fallback:* pick another stable free-tier Flash/Flash-Lite model from the models page for the failing one (in .env and Config).
6. Google Account: 2-Step Verification on, create app password "marketmorning-vercel".
   - **C10** App password can be created and nodemailer sends a test mail via smtp.gmail.com:465. *Fallback:* only then create an OAuth client (+ consent screen published to Production) and use nodemailer OAuth2 with a refresh token (env `GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`).

## 2. Google Sheet (Owner)
Build every tab in [SHEET.md](SHEET.md); share with the service account as Editor.
- **C2** Feed row 2 shows all 12 values, and `fallback_json` (cell C2) is valid JSON (paste it into any JSON validator). *Fallback:* fix the formula until it is.

## 3. Site repo: functions and section (CC, then Owner deploys)
Build `/api/mm/*`, `/unsubscribe`, the "Live demo: MarketMorning" section, `/mm/chart-unavailable.png` and `/mm/coingecko-logo.png` (downloaded from the CoinGecko Brand Kit) per [SITE.md](SITE.md); set Vercel env vars; run PRD tests 9–11 on a preview deployment.
- **C11** Vercel Firewall has a free rate-limit rule slot on this Hobby project. *Fallback:* extend the existing rule's path condition to include `/api/mm/`; if none can be edited, use an in-function per-instance limiter and rely on the email budgets.
- **C16** Second request to the chart URL from a preview email returns `x-vercel-cache: HIT`; `&x=1` or a blank value returns the placeholder. *Fallback:* raise `s-maxage` to 604800.

## 4. Make scenario (Owner with Maia or by hand)
Follow [MAIA-PROMPTS.md](MAIA-PROMPTS.md).

**Phase A:**
1. Create modules 1–12 in ID order as a plain chain, with no routers, directives or filters yet.
2. Leave unconfigured every field that references modules 17 or 18: the module 4 and 15 bodies, the Gmail HTML in 6–8, ERR in 9 and the text in 10.
3. Create 13–15 (the error-route modules only).
4. Insert 16–17 on the 3 → 4 link (right-click the link › Add a module).
5. Insert 18 on the 17 → 4 link.

**Phase B:**
1. Add routers R1/R2, then all directives and filters. These take IDs ≥ 19.
2. Create JSON only if C6 fails.
3. Now set R1, paste the bodies and the HTML, and map ERR.

Use 3 `{{TEST_EMAIL+mmN}}` active rows in Subscribers. Single-module checks (C6, C22, C23, C24, C25) use "Run this module only" (≈ 1 credit each).
- **C19** In the editor, IDs 1–18 match ARCHITECTURE §2 (Parse JSON 5, Gmail 6–8, retry 15, Fed RSS 16, Parse XML 17, BLS match 18), and routers/directives are ≥ 19. *Fallback:* rebuild in the documented order; IDs can't be renumbered.
- **C21** Module 1 output shows the 12 keys `send_enabled` … `gemini_fallback_model`. *Fallback:* change the `1.*` references in the template and prompt to Make's actual keys, and mirror them in `buildFeed()` of the preview tool.
- **C6** Module 4 returns 200 when a Fed title contains `"` and `\`, and the schema is accepted. *Fallback:* add JSON › Create JSON (next free ID) before module 4 (+1 credit, already in the 16 worst case). If `responseJsonSchema` is rejected, use `responseSchema` with the same schema minus `additionalProperties`. If Make treats `\`/`\"` in string literals differently from the preview tool, change the tool's tokenizer to match.
- **C9** BCC from `split(1.batch_n; ",")` (field in Map mode) delivers to all 3 test addresses with none visible to others. *Fallback:* map BCC as one item per address.
- **C22** Module 17's output path is `17.rss.channel.item[]`, with `title`, `link` and `pubDate` as plain text (CDATA unwrapped), and `trim(substring(pubDate; 5; 16))` gives e.g. "1 Oct 2026". Items are newest first. Dates are the feed's GMT day (a speech after 20:00 ET shows the next day); accepted.
  - *Fallback:* change the `17.…` paths in the template and user prompt to Make's actual structure. Mirror the change in `parseRss()` of the preview tool, then regenerate the Make body.
  - If module 16's "Parse response" already yields the parsed XML, drop module 17 (−1 credit). Then change `17.rss…` to `16.data.rss…` everywhere: template, user prompt, the `FED` expression in R1/ERR, and `ctx.bundles` in the tool.
- **C23** Module 16 returns 200 RSS (not a challenge page) from Make on 3 test days, and `16.data` shows as text (else map `{{toString(16.data)}}` in module 17). *Fallback:* add header `Accept: application/rss+xml`. If it is still blocked, delete 16–17 (−2 credits), remove `length(FED)` from R1/ERR and the Fed blocks from the template and prompt, and mirror that in the tool.
- **C24** Module 18 outputs fields `cpi`, `unemployment`, `payrolls`, `ppi` (named groups), with values such as "+0.4%  in Aug 2026"; copy one pill's raw text to confirm the mapping syntax. With BLS empty, it continues with an empty bundle.
  - *Fallback:* if Make names the groups differently (or needs backticks), replace `18.cpi`…`18.ppi` in the template, user prompt, R1/ERR and module 10 with the exact pill text, and mirror it in `matchBls()` of the tool.
  - If BLS changed its markup, update `prompts/bls-pattern.make.txt` (test it locally first), then paste the new pattern.
- **C25** Module 2 returns 200 RSS from Make on 3 test days, and `2.data` shows as text, not binary. *Fallback:* if binary, map `{{toString(2.data)}}` in module 18. If blocked (403), type a contact email into module 2's User-Agent **in Make only** (never in files; the blueprint scrub removes emails). If still blocked, delete modules 2 and 18 (−2 credits), remove the `18.*` gates from R1, ERR and module 10, remove the BLS blocks from the template and prompt, mirror that in the tool, and regenerate the Make body.
- **C13** R1 "Content OK" passes on a normal run and sends all-empty runs to the fallback route. R1 is one AND group: `1.send_enabled` Text = `TRUE`, and the source count Numeric > 0. *Fallback:* use Boolean "Equal to" `true` for the first condition. If the count expression errors, split it into three OR groups, each `send_enabled = TRUE` AND one source condition.
- **C13b** Modules 9/10 on R2's last route can map `6.id`, `7.id`, `8.id`. *Fallback:* drop R2 and chain 6 → 7 → 8 → 9 → 10 with no filters; an empty batch then sends an owner-only copy (same credits, ≤ 2 extra recipients/day).
- **C14b** These must all work:
  - Resume with empty `data` on modules 2, 3, 16, 17 and 18.
  - Module 5's Resume fields.
  - **4 fails, 15 succeeds:** module 5 parses the fallback model's text.
  - **4 and 15 both fail:** module 5 uses `fallback_json`, and the footer says "not written by AI".

  *Fallback:*
  - If Make offers no error handler on module 15, set 15's "Evaluate all states as errors" to No.
  - If Resume can't carry `{{15.data}}`, set module 5 to `{{ifempty(4.data.candidates[1].content.parts[1].text; ifempty(15.data.candidates[1].content.parts[1].text; 1.fallback_json))}}`.
- **C20** PRD test 5 (CoinGecko empty): the email still sends and shows "Crypto prices unavailable today." *Fallback:* if `parseDate`/`formatDate` still error on empty input, replace the as-of expression with a fixed "Crypto prices: last 24 hours" label.
- **C18** The email rendered by Make matches the local preview for the same inputs: save module 2, 3, 16 and 4-text outputs as `bls.rss`, `coingecko.json`, `fed.xml`, `gemini-output.json` in a folder outside the repo and run `node tools/preview-digest.mjs --from=<folder>`. *Fallback:* adjust the template expression and re-run `--sample`.

## 5. Quality gate (CC)
`node tools/preview-digest.mjs` (live) on 5 different days (plus the C0 variants); run **digest-qa** on each.
- **C17** 5/5 PASS. *Fallback:* tighten `prompts/digest.system.md`, regenerate the Make body, re-run; ship only after 5/5.

## 6. End-to-end (Owner)
Run the PRD tests per MAIA-PROMPTS Step 8 with "Run once". Test budget: ≤ 150 credits for §4–§6.
- **C8** Received message source shows `List-Unsubscribe`. *Fallback:* remove the header; the footer link stays.
- **C15** Make credit usage is ≤ 13 per normal run and ≤ 16 worst, and every test run's recorded duration stays near the ≈ 3.3-min estimate (< 4 min). *Fallback:* remove the Gemini retry route (−2).

## 7. Go live (Owner)
Activate the schedule on a date where (remaining weekdays × 16) + credits already used this month (including the ≤ 150 test credits) ≤ 400; for example, go live in the month after testing. Open the site section.

Reminders: reauthorize Make Gmail every 5 months; monthly purge (Dashboard B9); quarterly CoinGecko terms review.
- **C14** Runs on Fri 2026-10-30 and Mon 2026-11-02 both start at 08:00 ET. *Fallback:* set the schedule time manually after each DST change.

## 8. Publish (CC + Owner)
Export the blueprint to `blueprints/raw/`, scrub it into `blueprints/`, run the secret scan, push the public repo, add README screenshots, record the Loom.
