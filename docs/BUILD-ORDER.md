# Build order

Each check is pass/fail. The fallback is already chosen: if a check fails, apply it and move on. Owner = you (Make, Google, Vercel and Slack consoles); CC = Claude Code (files in this repo and in the site repo).

## 0. Local first (CC, 0 credits)
`node tools/preview-digest.mjs --sample` plus `--variant=no-crypto`, `one-headline`, `fed-only` and `ai-fallback` → previews + input JSON in `tests/previews/`; run **digest-qa** on all five. Generate the Make body: `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt`.
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
Build every tab in [SHEET.md](SHEET.md); seed News from `samples/news.csv`; share with the service account as Editor.
- **C2** Feed `gdelt_url` equals the URL printed by `preview-digest.mjs` (same terms). *Fallback:* fix the News tab or the formula until they match.

## 3. Site repo: functions and section (CC, then Owner deploys)
Build `/api/mm/*`, `/unsubscribe`, the "Live demo: MarketMorning" section, `/mm/chart-unavailable.png` and `/mm/coingecko-logo.png` (downloaded from the CoinGecko Brand Kit) per [SITE.md](SITE.md); set Vercel env vars; run PRD tests 8–11 on a preview deployment.
- **C11** Vercel Firewall has a free rate-limit rule slot on this Hobby project. *Fallback:* extend the existing rule's path condition to include `/api/mm/`; if none can be edited, use an in-function per-instance limiter and rely on the email budgets.
- **C16** Second request to the chart URL from a preview email returns `x-vercel-cache: HIT`; `&x=1` or a blank value returns the placeholder. *Fallback:* raise `s-maxage` to 604800.

## 4. Make scenario (Owner with Maia or by hand)
Create modules 1–12 in ID order, leaving unconfigured every field that references module 17 (R1 filter, module 4 body, Gmail HTML in 6–8, ERR in 9). Then create 13–15 (error routes), then insert 16–17 on the 3 → R1 link (right-click the link › Add a module), then 18 only if C6 fails, per ARCHITECTURE §2. Only now set R1, paste `prompts/gemini-body.make.txt` into module 4 and `templates/digest-email.html` into 6–8, and map ERR. Use 3 `{{TEST_EMAIL+mmN}}` active rows in Subscribers. Single-module checks (C6, C12, C22, C23) use "Run this module only" (≈ 1 credit each).
- **C19** In the editor, Parse JSON is ID 5, Gmail 6–8, retry 15, Fed RSS 16, Parse XML 17. *Fallback:* rebuild in the documented order (IDs can't be renumbered; every `{{5.x}}`/`{{15.x}}` mapping depends on them).
- **C21** Module 1 output shows keys `send_enabled` … `gemini_fallback_model` (13 header names). *Fallback:* change the `1.*` references in the template and prompt to Make's actual keys and mirror them in `buildFeed()` of the preview tool.
- **C6** Module 4 returns 200 when a headline contains `"` and `\`, and the schema is accepted. *Fallback:* add JSON › Create JSON (ID 18) before module 4 (+1 credit, already in the 15 worst case); if `responseJsonSchema` is rejected, use `responseSchema` with the same schema minus `additionalProperties`. If Make treats `\`/`\"` in string literals differently from the preview tool, change the tool's tokenizer to match.
- **C9** BCC from `split(1.batch_n; ",")` delivers to all 3 test addresses with none visible to others. *Fallback:* map BCC as one item per address.
- **C22** Module 17's output path is `17.rss.channel.item[]` with `title`, `link`, `pubDate` as plain text (CDATA unwrapped), and `trim(substring(pubDate; 5; 16))` gives e.g. "1 Oct 2026". *Fallback:* change the `17.…` paths in the template and user prompt to Make's actual structure, mirror it in `parseRss()` of the preview tool, and regenerate the Make body. Items must be newest-first (the section shows the first 3). If module 16's HTTP "Parse response" already yields the parsed XML, drop module 17 (−1 credit) and change `17.rss…` to `16.data.rss…` everywhere: template, user prompt, the `FED` expression in R1/ERR, and `ctx.bundles` in the preview tool.
- **C23** Module 16 returns 200 RSS (not a challenge page) from Make on 3 test days. *Fallback:* add header `Accept: application/rss+xml`; if still blocked, delete 16–17 (−2 credits: normal 10, worst 13), remove `length(FED)` from R1/ERR and the Fed blocks from the template and prompt, and mirror that in the tool.
- **C12** GDELT returns 200 with ≥ 4 relevant English market articles from Make on 3 test days (Make's shared IPs vs GDELT throttling, seen locally on 2026-10-05). *Fallback:* if results are irrelevant, replace `(stock OR shares OR crypto)` with `(domain:reuters.com OR domain:cnbc.com OR domain:apnews.com OR domain:marketwatch.com)`; if GDELT fails on 2+ of 3 runs, keep it but rely on the Fed section (no retry, no extra credits) and revisit DATA-SOURCES candidates.
- **C13** R1 filter passes with text `TRUE` and the `length(ARTS)`/`exists` conditions. *Fallback:* Boolean "Equal to" `true`; for crypto use "Basic: exists" on `3.data.bitcoin`.
- **C13b** Modules 9/10 on R2's last route can map `6.id`, `7.id`, `8.id`. *Fallback:* drop R2 and chain 6→7→8→9→10 with no filters; an empty batch then sends an owner-only copy (same credits, ≤ 2 extra recipients/day).
- **C14b** Resume with empty `data` (modules 2, 3, 16, 17) and module 5's Resume fields work; **4 fails, 15 succeeds** → module 5 parses the fallback model's text; **4 and 15 fail** → module 5 uses `fallback_json` and the footer says "not written by AI". *Fallback:* give modules 2/3 a response data structure and resume with empty collections; if Resume can't carry `{{15.data}}`, set module 5 to `{{ifempty(4.data.candidates[1].content.parts[1].text; ifempty(15.data.candidates[1].content.parts[1].text; 1.fallback_json))}}`.
- **C20** PRD test 5 (CoinGecko empty): the email still sends and shows "Crypto prices unavailable today." *Fallback:* if `parseDate`/`formatDate` still error on empty input, replace the as-of expression with a fixed "Crypto prices: last 24 hours" label.
- **C18** The email rendered by Make matches the local preview for the same inputs (formatNumber, formatDate, get by id). *Fallback:* adjust the template expression and re-run `--sample`.

## 5. Quality gate (CC)
`node tools/preview-digest.mjs` (live) on 5 different days (plus the C0 variants); run **digest-qa** on each.
- **C17** 5/5 PASS. *Fallback:* tighten `prompts/digest.system.md`, regenerate the Make body, re-run; ship only after 5/5.

## 6. End-to-end (Owner)
Run PRD tests 1–7 with "Run once". Test budget: ≤ 150 credits for §4–§6 (≈ 10 full runs + single-module checks).
- **C8** Received message source shows `List-Unsubscribe`. *Fallback:* remove the header; the footer link stays.
- **C15** Make credit usage ≤ 12 per normal run, ≤ 15 worst, and a run with forced Gemini timeouts finishes in < 4 min. *Fallback:* remove the Gemini retry route (−2).

## 7. Go live (Owner)
Activate the schedule on a date where (remaining weekdays × 15) + credits already used this month (incl. the ≤ 150 test credits) ≤ 400, e.g. go live in the month after testing; open the site section. Reminders: Make Gmail reauthorize every 5 months; monthly purge (Dashboard B9); quarterly CoinGecko terms review.
- **C14** Runs on Fri 2026-10-30 and Mon 2026-11-02 both start at 08:00 ET. *Fallback:* set the schedule time manually after each DST change.

## 8. Publish (CC + Owner)
Export the blueprint to `blueprints/raw/`, scrub it into `blueprints/`, run the secret scan, push the public repo, add README screenshots, record the Loom.
