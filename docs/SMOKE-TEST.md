# Live smoke test, 2026-10-07

Target: https://media-and-software-manger.vercel.app/#marketmorning (live). Synthetic data only: one disposable [mail.tm](https://mail.tm) inbox (`mms***@<mail.tm domain>`; used instead of `{{TEST_EMAIL+tag}}` so the test can read its own inbox without the owner's mail; mail.tm's API docs allow programmatic use, 8 QPS, attribution requested; the inbox was deleted after the test). Calls went to the same endpoints the page and emails use (SITE.md). No live system was changed beyond the test subscriber row and its TxLog rows.

**Note for IT:** signing up sends a **confirmation email first** (double opt-in). The digest arrives at the **next scheduled run** (weekdays 08:00 New York), not straight after signup. This is by design.

## Results
| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | Signup accepted | PASS | `POST /api/mm/subscribe` → 200 `{"ok":true,"message":"Check your inbox to confirm."}` (18:56:03 UTC) |
| 1b | Confirmation email arrives | PASS | "Confirm your MarketMorning subscription" in the inbox after 10 s; footer "Not financial advice" + "portfolio demo by M&S Manger" and the 72-hour expiry note present |
| 1c | Confirm flow (page + POST button) | PASS | `GET /api/mm/confirm?t=…` → 200, `no-store`, hidden-field POST form (link scanners can't confirm). `POST /api/mm/confirm` → 303 `/?mm=confirmed#marketmorning` |
| 1d | Token single use | PASS | Replaying the same token → 303 `/?mm=invalid#marketmorning`, so the row's `token_nonce` was rotated in the Sheet |
| 1e | Sheet status = `active` | Needs human glance | `confirmed` is only returned after `status` is written as `active` (`waitlisted` if at the cap; confirm.js), but the repo has no local read path: the Apps Script secret lives only in Vercel env. Owner: check the Subscribers row for `mms…@` |
| 2 | Digest run | Not run | See below |
| 3a | Unsubscribe request | PASS | Sent 16 min after the confirm email (per-address 15-min limit, F1). `GET /unsubscribe` → 200 with form; `POST /api/mm/unsubscribe` → 200 `{"ok":true,…}`; "Confirm: unsubscribe from MarketMorning" arrived after 10 s |
| 3b | Unsubscribe confirm (page + POST button) | PASS | `GET /api/mm/unsubscribe/confirm?t=…` → 200, `no-store`, POST form. `POST` → 303 `/?mm=unsubscribed#marketmorning` (19:13:21 UTC); replay → 303 `/?mm=invalid#marketmorning` (nonce rotated) |
| 3c | Sheet status = `unsubscribed` | Needs human glance | `unsubscribed` is only returned after the row is written as `unsubscribed` (unsubscribe/confirm.js). Owner: check the `mms…@` row, and delete it with the monthly purge |

**Credits:** 0 Make credits (scenario not run). Vercel: ~10 function invocations. Gmail: 2 transactional emails (confirm + unsubscribe).

## 2. Digest: why not run, and how to enable it
- `.env` has no Make API token, and Make's pricing page lists "Access to the Make API" only from **Core** up: the Free plan cannot call `POST /scenarios/{id}/run` (https://www.make.com/en/pricing).
- **Next scheduled run:** Thu 2026-10-08, 08:00 America/New_York = **17:00 PKT** (until DST ends on Sun 2026-11-01; from Mon 2026-11-02 it is **18:00 PKT**). The test address is unsubscribed before then, so the owner copy (To: owner, one per batch) is the email to check against [QA.md](QA.md), with SendLog status `ok` (or `ok_no_ai` if Gemini fell back) and the Slack message.
- **Make token setup (only after upgrading to Core or above):** Make › avatar (bottom left) › **Profile** › **API** tab › **Add token** › label `marketmorning-smoke`, scopes `scenarios:read` + `scenarios:run` › **Save** › copy it at once (parts are hidden later) › add `MAKE_API_TOKEN=` and `MAKE_ZONE=` (e.g. `eu1.make.com`, from your Make URL) and `MAKE_SCENARIO_ID=` (from the scenario URL) to `.env`. The scenario must be active to run via the API. Run: `POST https://<zone>/api/v2/scenarios/<id>/run` with `Authorization: Token <token>`; logs via `GET …/scenarios/<id>/logs`. Each run costs ~12 credits (worst 15) and counts toward the monthly budget; in October 2026 check BUILD-ORDER §7 first.

## Findings and proposed fixes (nothing changed live)
| # | Finding | Proposed fix |
|---|---|---|
| F1 | The per-address limit (1 email / 15 min, 3 / 24 h) counts **confirm and unsubscribe emails together** (`withinBudget` in `_lib.js` filters by hash only). Someone who signs up and unsubscribes within 15 min gets the "we've emailed a link" answer but no email. SITE.md:10 is ambiguous ("separate pools" is written next to the global caps only), so it's unclear whether this is intended. | Count the per-address limit per `type` (`mine = recent.filter(([, t, h]) => h === hash && t === type)`, types `confirm` / `unsub_confirm`), and change SITE.md:10 to "per `email_hash` and `type`". |
| F2 | No safe read path for status checks, so smoke tests can't verify the Sheet. | Owner-only `GET /api/mm/status?h=<email_hash>` behind a separate `MM_ADMIN_TOKEN` returning just `status`, or a read-only check in the Apps Script by hash. |

## Vercel Hobby plan
Honest line: Vercel's Fair Use Guidelines limit Hobby to "non-commercial personal use only" and count "advertising the sale of a product or service" as commercial, so a portfolio that markets M&S Manger's Make services is likely outside Hobby terms; owner decision (ask Vercel Support, or accept Pro despite the free-tier rule).

Sources: https://vercel.com/docs/limits/fair-use-guidelines · https://www.make.com/en/pricing · https://developers.make.com/api-documentation/authentication/create-authentication-token · https://developers.make.com/api-documentation/api-reference/scenarios · https://docs.mail.tm
