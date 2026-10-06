# MarketMorning site: signup, unsubscribe, chart proxy

Built in the site folder (`site/`, a sibling of this repo; plain HTML on Vercel, deployed with the Vercel CLI, see its README). Referenced from [ARCHITECTURE.md](ARCHITECTURE.md) §4.

## Vercel functions (`/api/mm/*`, Node 24, `nodemailer`, `@vercel/functions`; Sheet via the Apps Script web app `tools/site-sheet-api.gs`, no Google Cloud)
Env: `MM_SCRIPT_URL`, `MM_SCRIPT_SECRET`, `MM_HMAC_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SITE_URL`. Caps come from Config. All writes are stored as plain text (number format `@`), so input never becomes a formula. No logging of request bodies or emails. Static assets: `/mm/coingecko-logo.png` (from the CoinGecko Brand Kit), `/mm/chart-unavailable.png`.

**Token** = `b64url(JSON{h,a,n,x}) + "." + b64url(HMAC_SHA256(MM_HMAC_SECRET, part1))`: `h` = first 32 hex of HMAC(secret, lowercased email) (also TxLog `email_hash`), `a` = `confirm`|`unsub`, `n` = row `token_nonce`, `x` = expiry (confirm 72 h, unsub 24 h). Verify with `timingSafeEqual`, matching `a`, `x` > now, row with matching `h` and `n`; then rotate the nonce.

**Email budget** (rolling 24 h from TxLog): confirm ≤ 70, unsub_confirm ≤ 30 (separate pools); per `email_hash` ≤ 1 per 15 min and ≤ 3 per 24 h. Over budget → email silently skipped, same response.

| Endpoint | Request | Behaviour | Response |
|---|---|---|---|
| POST /api/mm/subscribe | JSON `{email, consent:true, website:""}` | Honeypot filled → no-op. Validate: trim, lowercase, ≤ 254, syntax, first char not `= + - @`, MX lookup (3 s). New → append `pending`; `pending`/`unsubscribed` → `pending` + new nonce; `active`/`waitlist` → nothing. If pending and in budget: send confirm via `waitUntil` (after the response), append TxLog. | 200 `{ok:true, message:"Check your inbox to confirm."}` for every valid input (incl. honeypot, budget hit, SMTP failure); 400 `{ok:false, error:"invalid_email"\|"consent_required"}`; 500 `{ok:false, error:"server_error"}` (Sheets down) |
| GET /api/mm/confirm?t= | token | Read-only page with a "Confirm subscription" POST button (link scanners don't press it). | HTML |
| POST /api/mm/confirm | form `t` | Verify `a=confirm`. Active < cap → `active`, else `waitlist`; set `confirmed_at`. | 303 → `/?mm=confirmed\|waitlisted\|expired\|invalid\|error#marketmorning` |
| GET /unsubscribe | – | Static page: email form + honeypot. | HTML |
| POST /api/mm/unsubscribe | JSON `{email, website:""}` | If pending/active/waitlist and in budget: send link (`a=unsub`) via `waitUntil`, append TxLog. | Always 200 `{ok:true, message:"If that address is subscribed, we've emailed a confirmation link."}`; 400 bad syntax |
| GET /api/mm/unsubscribe/confirm?t= | token | Read-only page with "Unsubscribe" POST button. | HTML |
| POST /api/mm/unsubscribe/confirm | form `t` | Verify `a=unsub`. Set `unsubscribed`, `unsubscribed_at`; promote oldest `waitlist` (by confirmed_at) if below cap. | 303 → `/?mm=unsubscribed\|expired\|invalid\|error#marketmorning` |
| GET /api/mm/chart?l=&v= | `l` = `[A-Z]{2,5}` comma list (≤ 10), `v` = same count of `-?\d{1,4}\.\d{2}` | Exactly these 2 params in this order and valid → build bar config (green ≥ 0, red < 0) and POST to `https://quickchart.io/chart` (552×300 png, white). Anything else → 302 to static `/mm/chart-unavailable.png` (no render, cached 1 day). QuickChart error → same redirect, `s-maxage=300`. | `image/png`, `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` |

Rate limit: the one Hobby WAF rule covers `/api/mm/` except `/api/mm/chart`, 10 req / 60 s per IP → 429. Waitlist: promotion only on unsubscribe; when the owner raises the cap they flip `waitlist` rows by hand. Two simultaneous confirms can exceed the cap by one; Feed `active_count` = MIN(count, cap).

Form privacy note: "We store your email, signup/confirmation times and status in a private Google Sheet, processed by Google, Make and Vercel only to send one email each weekday. It is never sold, never sent to AI or analytics tools, and unsubscribed or unconfirmed addresses are deleted monthly. Unsubscribe from any email; questions: reply to any digest."
