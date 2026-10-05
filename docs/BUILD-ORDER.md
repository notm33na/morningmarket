# Build order

Each check is pass/fail. The fallback is already chosen: if a check fails, apply it and move on. Owner = you (Make, Google, Vercel and Slack consoles); CC = Claude Code (files in this repo and in the site repo).

## 0. Local first (CC, 0 credits)
`node tools/preview-digest.mjs --sample` plus `--sample --variant=no-crypto` and `--sample --variant=one-headline` → previews + input JSON in `tests/previews/`; run **digest-qa** on all three. Generate the Make body: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`.
- **C0** All three sample previews pass digest-qa. *Fallback:* fix template/prompt before anything is built in Make.

## 1. Accounts and settings (Owner)
1. Make › Profile › Time zone options › Scenarios › organization = **America/New_York**.
   - **C1** LeadFlow still fires at its intended time. *Fallback:* re-enter LeadFlow's schedule in New York time.
2. Slack: create **#marketmorning-alerts**; reuse the existing Make Slack connection.
3. Make connections: Gmail and Google Sheets with Make's built-in **Sign in with Google** (same as LeadFlow). No Google Cloud OAuth app is needed: Make's custom client is optional, and personal Gmail just needs reauthorizing every 6 months (calendar reminder at 5).
4. Google Cloud project "marketmorning" **for the service account only**: enable the Google Sheets API, create a service account (no roles), create a JSON key → Vercel env (`GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`) and a local file outside the repo. No OAuth consent screen.
5. API keys: Gemini (AI Studio) → Make keychain "Gemini" (header `x-goog-api-key`) + `.env`; CoinGecko Demo (developer dashboard) → Make keychain "CoinGecko" (header `x-cg-demo-api-key`) + `.env`.
   - **C7** AI Studio lists `GEMINI_MODEL` with a free-tier quota. *Fallback:* set GEMINI_MODEL (in .env and Config) to a stable Flash-Lite model that the models page lists with a free tier.
6. Google Account: 2-Step Verification on, create app password "marketmorning-vercel".
   - **C10** App password can be created and nodemailer sends a test mail via smtp.gmail.com:465. *Fallback:* only then create an OAuth client (+ consent screen published to Production) and use nodemailer OAuth2 with a refresh token (env `GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`).

## 2. Google Sheet (Owner)
Build every tab in [SHEET.md](SHEET.md); seed News from `samples/news.csv`; share with the service account as Editor.
- **C2** Feed `gdelt_url` equals the URL printed by `preview-digest.mjs` (same terms). *Fallback:* fix the News tab or the formula until they match.

## 3. Site repo: functions and section (CC, then Owner deploys)
Build `/api/mm/*`, `/unsubscribe`, the "Live demo: MarketMorning" section, `/mm/chart-unavailable.png` and `/mm/coingecko-logo.png` (downloaded from the CoinGecko Brand Kit) per [SITE.md](SITE.md); set Vercel env vars; run PRD tests 8–11 on a preview deployment.
- **C11** Vercel Firewall has a free rate-limit rule slot on this Hobby project. *Fallback:* extend the existing rule's path condition to include `/api/mm/`; if none can be edited, use an in-function per-instance limiter and rely on the email budgets.
- **C16** Second request to the chart URL from a preview email returns `x-vercel-cache: HIT`; `&x=1` or a blank value returns the placeholder. *Fallback:* raise `s-maxage` to 604800.

## 4. Make scenario (Owner with Maia or by hand)
Create modules 1–12 in ID order, then error-route modules 13–15 (16 only if C6 fails) per ARCHITECTURE §2, with 3 `{{TEST_EMAIL+mmN}}` active rows in Subscribers. Paste `prompts/gemini-body.make.txt` into module 4 and `templates/digest-email.html` into 6–8.
- **C19** In the editor, Parse JSON is ID 5, Gmail 6–8, retry 15. *Fallback:* rebuild in the documented order (IDs can't be renumbered; every `{{5.x}}`/`{{15.x}}` mapping depends on them).
- **C21** Module 1 output shows keys `send_enabled` … `fallback_summary` (header names). *Fallback:* change the `1.*` references in the template and prompt to Make's actual keys and mirror them in `buildFeed()` of the preview tool.
- **C6** Module 4 returns 200 when a headline contains `"` and `\`, and the schema is accepted. *Fallback:* add JSON › Create JSON before module 4 (+1 credit, already in the 13 worst case); if `responseJsonSchema` is rejected, use `responseSchema` with the same schema minus `additionalProperties`. If Make treats `\`/`\"` in string literals differently from the preview tool, change the tool's tokenizer to match.
- **C9** BCC from `split(1.batch_n; ",")` delivers to all 3 test addresses with none visible to others. *Fallback:* map BCC as one item per address.
- **C12b** GDELT answers 200 with articles when called from Make on 3 runs (shared Make IPs vs GDELT's ~1 request/5 s limit). *Fallback:* error route Sleep 6 s + retry on module 2 (+2 credits; worst 15 × 23 = 345 ≤ 400).
- **C12** GDELT returns ≥ 4 relevant English market articles on 3 test days. *Fallback:* replace `(stock OR shares OR crypto)` with `(domain:reuters.com OR domain:cnbc.com OR domain:apnews.com OR domain:marketwatch.com)`.
- **C13** R1 filter passes with text `TRUE` and the `length(ARTS)`/`exists` conditions. *Fallback:* Boolean "Equal to" `true`; for crypto use "Basic: exists" on `3.data.bitcoin`.
- **C13b** Modules 9/10 on R2's last route can map `6.id`, `7.id`, `8.id`. *Fallback:* drop R2 and chain 6→7→8→9→10 with no filters; an empty batch then sends an owner-only copy (same credits, ≤ 2 extra recipients/day).
- **C14b** Resume with empty `data` (modules 2, 3), module 5's Resume fields, and the nested case (4 fails, 15 fails → module 5 uses `fallback_json`) work as documented. *Fallback:* give modules 2/3 a response data structure and resume with empty collections.
- **C20** PRD test 5 (CoinGecko empty): the email still sends and shows "Crypto prices unavailable today." *Fallback:* if `parseDate`/`formatDate` still error on empty input, replace the as-of expression with a fixed "Crypto prices: last 24 hours" label.
- **C18** The email rendered by Make matches the local preview for the same inputs (formatNumber, formatDate, get by id). *Fallback:* adjust the template expression and re-run `--sample`.

## 5. Quality gate (CC)
`node tools/preview-digest.mjs` (live) on 5 different days (plus the C0 variants); run **digest-qa** on each.
- **C17** 5/5 PASS. *Fallback:* tighten `prompts/digest.system.md`, regenerate the Make body, re-run; ship only after 5/5.

## 6. End-to-end (Owner)
Run PRD tests 1–7 with "Run once". Test budget: ≤ 100 credits for §4–§6 (≈ 10 runs).
- **C8** Received message source shows `List-Unsubscribe`. *Fallback:* remove the header; the footer link stays.
- **C15** Make credit usage ≤ 10 per normal run, ≤ 13 worst. *Fallback:* remove the Gemini retry route (−2).

## 7. Go live (Owner)
Activate the schedule on a date where (remaining weekdays × 13) + credits already used this month ≤ 400; open the site section. Reminders: Make Gmail reauthorize every 5 months; monthly purge (Dashboard B9); quarterly CoinGecko terms review.
- **C14** Runs on Fri 2026-10-30 and Mon 2026-11-02 both start at 08:00 ET. *Fallback:* set the schedule time manually after each DST change.

## 8. Publish (CC + Owner)
Export the blueprint to `blueprints/raw/`, scrub it into `blueprints/`, run the secret scan, push the public repo, add README screenshots, record the Loom.
