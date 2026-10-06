# MarketMorning PRD

**Status:** spec v2, 2026-10-05. **Type:** portfolio demo by M&S Manger on Make.com. Not financial advice.

## Problem, users, goals
Busy readers want a 2-minute, trustworthy view of what the Federal Reserve is saying, what the latest official US data show, and where crypto stands, before their day starts. **Users:** members of the public who opt in on the site and read it daily. **Owner:** M&S Manger (operates it; private Dashboard).

**Goals:**
1. One accurate brief every weekday at 08:00 New York time, at $0.
2. Only data we are licensed to show, and no invented numbers or links.
3. Show production habits on Make Free: credit budget, error handling, double opt-in and monitoring.

**Non-goals:**
- Stock prices, market headlines and paid data. The [DATA-SOURCES.md](DATA-SOURCES.md) research found no free licensed source, and GDELT was unreachable in testing.
- Personal watchlists.
- Advice, predictions or interpretation.
- Non-English content, real-time alerts and public stats.

*Change from the original brief:* "headlines with links" and "top movers" were replaced by official Fed and BLS content, a licensing and reliability decision the owner made on 2026-10-05.

## Functional requirements
| # | Requirement | Acceptance criteria | Arch |
|---|---|---|---|
| FR1 | Make schedule Weekdays (Mon–Fri) 08:00, org time zone America/New_York; runs on market holidays. | Starts at 08:00 ET before and after the 2026-11-01 DST change. | §2 |
| FR2 | **Latest US economic data:** one BLS Public Data API request per run; CPI, unemployment rate, payroll jobs and PPI (latest, with BLS 1-month changes) shown with their month; "Source: U.S. Bureau of Labor Statistics, retrieved <date>" + BLS's "cannot vouch" statement. | Values equal the API response; hidden if the call fails. | §2 (2) |
| FR3 | **From the Federal Reserve:** latest 3 speeches (date, linked title), "Source: Federal Reserve Board", not-affiliated note. | Links equal the feed's `link`s. | §2 (16–17) |
| FR4 | **Crypto:** one CoinGecko Demo call; price and 24 h % for BTC, ETH, SOL, XRP, BNB, DOGE; "Prices as of <last_updated_at> ET"; "Powered by CoinGecko" + logo + link. | Numbers match the response; attribution visible. | §2 (3) |
| FR5 | One Gemini call per run (plus one retry on the fallback model if it fails): a 3-sentence summary (Fed, data, crypto) and a crypto note. Only numbers from the input, exactly as given; no stock talk, causation or advice. | QA.md PASS on 5 live previews on 5 different days and on all `--sample` variants. | §2 (4–5), §3.2 |
| FR6 | Deterministic parts: data table, speech list, crypto table, chart and all links come from the feeds, not AI. | – | template |
| FR7 | QuickChart bar chart of crypto 24 h % via the cached `/api/mm/chart` proxy, data frozen in the URL. | Correct chart a day later in Gmail web and iOS Mail; alt text. | SITE, §5 |
| FR8 | One email for all, from the owner's Gmail, BCC batches of 100 (To: owner). Footer: "For information only. Not financial advice." + unsubscribe link + "A portfolio demo by M&S Manger" + credits for the sections shown; `List-Unsubscribe` header. | No one sees another address. | §2 (6–8) |
| FR9 | Fallbacks: Gemini fails → one retry on `GEMINI_FALLBACK_MODEL`, then a plain brief whose footer says it was not written by AI. A failed source hides only its own section. All sources empty or SEND_ENABLED off → no send + alert. | Forced failures behave as stated. | §6 |
| FR10 | Site section "Live demo: MarketMorning": email + consent + privacy note → `pending` → double opt-in email; link (72 h) opens a page whose button (POST) confirms. | → `active` (or `waitlist` at cap); expired, reused or prefetched links change nothing. | SITE |
| FR11 | Cap of 300 active; confirmations beyond go to `waitlist`; the oldest waitlisted is promoted on unsubscribe. | The 301st confirmation goes to `waitlist`. | SITE, §5 |
| FR12 | `/unsubscribe` page → link (24 h) → POST button → `unsubscribed`; replies saying "unsubscribe" handled by the owner. | Never reveals whether an address is subscribed. | SITE |
| FR13 | Abuse controls: honeypot, syntax + MX check, WAF 10 req/60 s per IP, rolling-24 h email budgets (70 confirm / 30 unsubscribe), ≤ 1 email per address per 15 min and ≤ 3 per 24 h. | Bot fill creates no row; signup floods can't block unsubscribes. | SITE |
| FR14 | One SendLog row per run (except when the Sheet is unreadable); Slack message each run; Dashboard tab. | All update after each test run. | §2 (9–12), SHEET |
| FR15 | Public scrubbed repo, live section, Loom, README case study, 0-credit local preview tool. | Secret scan clean; `--sample` variants pass QA.md. | BUILD-ORDER |

## Non-functional requirements
- **Credits:** ≤ 400/month. Worst case 15/run × 23 weekdays = 345. Build and test ≤ 150 credits, run in the month before go-live (exception: went live 2026-10-06 on its own account, BUILD-ORDER §7).
- **Sending:** ≤ 403 Gmail recipients in any rolling 24 h (303 digest + 100 transactional), under the 500 personal limit.
- **Timeliness:** Make run history shows completion by 08:10 ET on ≥ 95% of weekdays (checked monthly).
- **Accuracy and licensing:**
  - Zero invented numbers or links.
  - Every dataset shown is public domain or licensed for display, with the required credit: BLS, the Federal Reserve Board, CoinGecko.
- **Privacy:**
  - Store only email, status, timestamps and nonce (TxLog keeps a hash only).
  - Processors are Google, Make (scenario set to "Data is confidential") and Vercel. Subscriber data never goes to Gemini, Slack or analytics.
  - Purge unsubscribed rows and rows pending > 7 days monthly. The form carries a privacy note.
- **Security:** no secrets in files; HMAC-SHA256 tokens with single-use nonces; state changes only via POST; Sheet writes as RAW.
- **Cost:** $0, no paid APIs.

## Assumptions
The owner sends ≤ ~95 other recipients/day. Gmail counts every BCC recipient. The brief stays free and ad-free (non-commercial).

## Test list
1. **Happy path,** 3 `{{TEST_EMAIL+tag}}` subscribers: content, BCC privacy, SendLog `ok`, Slack message.
2. **Both Gemini models fail** → `ok_no_ai`, fallback summary and footer.
3. **Bad JSON** → fallback. 3b. **Main model fails, fallback answers** → AI summary.
4. **BLS URL broken** → data section hidden.
5. **CoinGecko bad key** → "Crypto prices unavailable today."; no table, chart or credit.
6. **Fed feed broken** → Fed section hidden.
7. **All three sources broken,** or SEND_ENABLED FALSE → `skipped` + alert.
8. **Invalid BCC in batch 2** → `partial`; SendLog and Slack still run.
9. **Signup:** valid, bad syntax, no MX record, honeypot filled, duplicate, resubscribe, leading `=`.
10. **Tokens:** valid, expired, tampered, reused, wrong action, GET-only.
11. **Cap 2** → the 3rd confirmation gets `waitlist`; an unsubscribe promotes it. **Rate limits:** 429 at 11 requests in 60 s; unsubscribe emails still send when the confirm budget is exhausted.
12. **QA ([QA.md](QA.md)):** live and sample previews pass. **Rendering:** checked in Gmail web, Gmail Android, iOS Mail and Outlook web.
13. **DST:** runs on 2026-10-30 and 2026-11-02 both start at 08:00 ET.

## Risks
| Risk | Level | Mitigation |
|---|---|---|
| Gmail flags bulk BCC from a personal account. | Medium | 100/batch, ≤ 403 per 24 h, opt-in only, MX check, email budgets. |
| Spam-folder delivery. | Medium | Gmail-signed mail, steady sender/subject, simple HTML, opt-in, `List-Unsubscribe`, confirmation email asks readers to add the sender to contacts. |
| Abuse / mail-bombing via signup. | Medium | Honeypot, WAF, per-address cooldown, split budgets. |
| AI misstates a number or adds interpretation. | Medium | Strict prompt + schema, deterministic tables, QA checklist gate, fallback copy. |
| Less appeal without market headlines. | Medium | Official, dated, relevant content every day; clear positioning as a Fed/data/crypto brief; a paid feed only if the project goes commercial. |
| BLS API limits or Fed feed changes/blocking from Make's IPs (BLS RSS already blocked). | Medium | Each section hides itself; checks C22, C23, C25; Slack shows "No BLS data" / "No Fed feed". |
| Make Gmail connection expires (6 months). | Medium | 5-month reauth reminder; Slack failure alert. |

Low: CoinGecko changes Demo terms (quarterly review); Gemini demand spikes (fallback model); chart quota (placeholder image).
