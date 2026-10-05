# MarketMorning PRD

**Status:** spec v1, 2026-10-05. **Type:** portfolio demo by M&S Manger on Make.com. Not financial advice.

## Problem, users, goals
Busy retail readers want a 2-minute view of what moved US markets and crypto, and why, before their day starts; apps are noisy and newsletters are paid. **Users:** members of the public who opt in on the site and read it daily. **Owner:** M&S Manger (operates it; private Dashboard).

**Goals:** (1) one accurate digest every weekday at 08:00 New York time at $0; (2) no invented numbers or links, and only data we are licensed to show; (3) show production habits on Make Free: credit budget, error handling, double opt-in, monitoring.
**Non-goals:** stock prices, % changes or index levels (no free source licenses third-party display; see [DATA-SOURCES.md](DATA-SOURCES.md)); personal watchlists; advice or signals; non-English; real-time alerts; public stats; paid data.

## Functional requirements
| # | Requirement | Acceptance criteria | Arch |
|---|---|---|---|
| FR1 | Make schedule Weekdays (Mon–Fri) 08:00, org time zone America/New_York; runs on market holidays. | Starts at 08:00 ET before and after the 2026-11-01 DST change. | §2 |
| FR2 | Headlines: one GDELT DOC call per run (last 24 h, English, ≤ 6 articles) from the News tab terms. | Every email link equals a GDELT `url` from that run. | §2 (2) |
| FR3 | Crypto: one CoinGecko Demo call per run; price + 24 h % for BTC, ETH, SOL, XRP, BNB, DOGE; "Prices as of <last_updated_at> ET"; "Powered by CoinGecko" + logo + link beside the data. | Numbers match the CoinGecko response; attribution visible. | §2 (3), template |
| FR4 | One Gemini call per run: 3-sentence summary, the 2 most market-relevant headlines (by id) with one "why it matters" sentence each, a crypto note. No stock numbers; only crypto numbers from input. | digest-qa PASS on 5 live previews on 5 different days, plus the degraded `--sample` variants; no advice words. | §2 (4–5), §3.2 |
| FR5 | Deterministic parts: crypto table, chart data and all links come from API responses, not AI. | Story links are GDELT links looked up by id. | template |
| FR6 | QuickChart bar chart of crypto 24 h % via the cached `/api/mm/chart` proxy, data frozen in the URL. | Correct chart in Gmail web and iOS Mail a day later; alt text. | §4, §5 |
| FR7 | One digest for all, from the owner's Gmail, BCC batches of 100 (To: owner). Footer: "For information only. Not financial advice." + unsubscribe link + "A portfolio demo by M&S Manger" + GDELT and CoinGecko credits; `List-Unsubscribe` header. | Test subscribers receive it; no one sees another address. | §2 (6–8) |
| FR8 | Fallbacks: Gemini error/bad JSON → plain digest; GDELT error → no headlines; CoinGecko error → no crypto; both empty or SEND_ENABLED off → no send + alert. | Forced failures behave as stated. | §6 |
| FR9 | Site section "Live demo: MarketMorning": email + consent + privacy note → `pending` → double opt-in email; link (72 h) opens a page whose button (POST) confirms. | → `active` (or `waitlist` at cap); expired/reused/prefetched link changes nothing. | SITE |
| FR10 | Cap 300 active; confirmations beyond → `waitlist`; oldest waitlisted promoted on unsubscribe. | 301st confirmation → `waitlist`. | SITE, §5 |
| FR11 | `/unsubscribe` page → email → link (24 h) → page button (POST) → `unsubscribed`. Replies saying "unsubscribe" handled by the owner. | Responses never reveal whether an address is subscribed. | SITE |
| FR12 | Abuse controls: honeypot, syntax + MX check, WAF 10 req/60 s per IP, rolling-24 h email budgets (70 confirm, 30 unsubscribe), ≤ 1 email per address per 15 min and ≤ 3/24 h. | Bot fill creates no row; 11th request in 60 s → 429; signup floods can't block unsubscribes. | SITE |
| FR13 | One SendLog row per run (except when the Sheet itself is unreadable); Slack to #marketmorning-alerts each run; Dashboard tab. | All update after each test run. | §2 (9–12), SHEET |
| FR14 | Public scrubbed repo, live section, Loom, README case study; local preview tool (0 credits). | Secret/real-email scan clean; `--sample` preview passes digest-qa. | BUILD-ORDER |

## Non-functional requirements
- **Credits:** ≤ 400/month. Max 13/run × 23 weekdays = 299; build/test ≤ 100, scheduled so the go-live month stays ≤ 400.
- **Sending:** ≤ 403 Gmail recipients in any rolling 24 h (303 digest + 100 transactional), under the 500 personal limit.
- **Timeliness:** Make run history shows completion by 08:10 ET on ≥ 95% of weekdays (owner checks monthly).
- **Accuracy and licensing:** zero invented numbers/links; no stock numbers; every displayed dataset has a licence for display plus the required attribution.
- **Privacy:** store only email, status, timestamps, nonce (TxLog keeps a hash only). Processors: Google (Sheets, Gmail), Make (reads BCC lists; "Data is confidential"), Vercel. Never sent to Gemini, Slack or analytics. Unsubscribed and > 7-day pending rows purged monthly. Privacy note on the form.
- **Security:** no secrets in files; HMAC-SHA256 tokens with expiry + single-use nonce; state changes only via POST; Sheet writes as RAW.
- **Cost:** $0.

## Assumptions
LeadFlow uses ≤ 600 credits/month and its timing survives the org time-zone change (check C1). The owner sends ≤ ~95 other recipients/day from this Gmail. Gmail counts every BCC recipient. The digest stays free and ad-free (non-commercial), which the CoinGecko Demo licence and GDELT terms require or allow.

## Test list
1. Happy path, 3 `{{TEST_EMAIL+tag}}` subscribers: content, BCC privacy, SendLog `ok`, Slack.
2. Gemini wrong key → `ok_no_ai`, fallback summary, stories = headlines 1–2, still sent. 3. Bad JSON → fallback.
4. GDELT bad URL → "Headlines unavailable today." 5. CoinGecko bad key → crypto unavailable + placeholder chart; email still sent (C20). 6. Both 4 and 5, or SEND_ENABLED FALSE → `skipped` + alert.
7. Invalid BCC in batch 2 (4 test rows, BATCH_SIZE 2) → `partial`; SendLog + Slack still run; 1 batch only → SendLog + Slack run.
8. Signup: valid, bad syntax, no-MX, honeypot, duplicate, resubscribe, leading `=`.
9. Tokens: valid, expired, tampered, reused, wrong action, GET-only (scanner) → no state change.
10. Cap 2 → 3rd `waitlist`; unsubscribe → promotion. 11. 429 from WAF; confirm budget exhausted → unsubscribe still sends; per-address cooldown.
12. digest-qa 5/5 (no stock numbers, crypto numbers match input, links from GDELT); render in Gmail web/Android, iOS Mail, Outlook web.
13. DST: runs on 2026-10-30 and 2026-11-02 at 08:00 ET.

## Risks
| Risk | Level | Mitigation |
|---|---|---|
| Gmail flags bulk BCC from a personal account. | Medium | 100/batch, ≤ 403/24 h, opt-in only, MX check, email budgets. |
| Spam-folder delivery. | Medium | Gmail-signed mail, steady sender/subject, simple HTML, opt-in, `List-Unsubscribe`, confirm email asks to add sender to contacts. |
| Abuse / mail-bombing via signup. | Medium | Honeypot, WAF, per-address cooldown, split budgets, confirm email has no content. |
| AI states a stock number or an unsupported claim. | Medium | Prompt rule 1 + schema, digest-qa gate (rejects any stock number), fallback copy. |
| Less value without stock prices. | Medium | Stories + "why it matters" + crypto data; a licensed stock feed can be added if the project ever goes commercial. |
| Make Gmail connection expires (personal accounts: 6 months). | Medium | 5-month reauth reminder; Slack failure alert. |

Low: CoinGecko changes Demo terms (quarterly review; crypto degrades to "unavailable"); GDELT relevance/throttling (checks C12, C12b); chart quota (placeholder image).
