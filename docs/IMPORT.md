# Building the scenario by blueprint import

The default way to build the scenario: no Maia prompts and no paid plan. [MAIA-PROMPTS.md](MAIA-PROMPTS.md) stays as the fallback.

`node tools/build-blueprint.mjs` writes `blueprints/raw/MarketMorning.import.json` (gitignored). It contains the whole of ARCHITECTURE §2, with the Gemini body, the email HTML and every expression already pasted in. **Make ID = label + 1**; routers and directives ≥ 19. It contains no connections, keychains or keys. Set `MM_SHEET_ID` and `SLACK_CHANNEL_ID` in `.env` first, or fill in the `[SHEET ID]` / `[SLACK CHANNEL ID]` placeholders after import. Re-run the script after any template or prompt change, then re-import (0 credits).

## 1. Account (once, new Make account)
First: the Sheet is built and C2 passes (BUILD-ORDER §2), Subscribers holds the 3 `{{TEST_EMAIL+mmN}}` test rows, #marketmorning-alerts exists, and you have the BLS, Gemini and CoinGecko keys (BUILD-ORDER §1.5).

| # | Where | What |
|---|---|---|
| 1 | Organization › Time zone | **America/New_York** (C1) |
| 2 | Connections | Google Sheets and Gmail (Sign in with Google); Slack (channel #marketmorning-alerts) |
| 3 | Keychains (API key, placement Header) | "Gemini": `x-goog-api-key`; "CoinGecko": `x-cg-demo-api-key` |

## 2. Import (0 credits)
Create a new scenario › **⋯** › **Import Blueprint** › choose the file › Save. The scenario stays **OFF**.

## 3. After import (by hand, 0 credits)
| Module (label) | Do |
|---|---|
| 1, 9, 11 | Choose the Google Sheets connection; check the Sheet ID |
| 6, 7, 8 | Choose the Gmail connection |
| 10, 12, 13 | Choose the Slack connection; check the channel ID (invite the Make app to the channel) |
| 2 | In the body, replace `[BLS API KEY - type it in Make only]` with your BLS key |
| 3 | Authentication: API key › keychain "CoinGecko" |
| 4, 15 | Authentication: API key › keychain **"Gemini"**, not "CoinGecko" (with the wrong one every Gemini call fails and the fallback summary is sent) |
| 5 | Data structure: **Add › Generator** (JSON) `{"source":"","summary":"","crypto_note":""}`. Then open module 5's Resume handler and check source = `fallback`, summary = `` {{2.`10`}} `` |
| 17 | Data structure: **Add › Generate** (XML); paste the file *contents* of `samples/fed-speeches.sample.xml` without the `<?xml …?>` line and the comment, not its path |
| Settings | Max cycles 1, sequential off, incomplete executions off; **Data is confidential: off while testing** (with it on, run logs show no input/output), **on** before go-live (BUILD-ORDER §7) |
| Schedule | Days of the week Mon–Fri, 08:00. Keep the scenario OFF until BUILD-ORDER §7 |

## 4. Import checks (0 credits)
These are the parts of the blueprint format that can't be checked locally. If one fails, fix it in Make by hand, using the value in the "Expect" column.

| Check | Expect |
|---|---|
| **C19** IDs | Labels 1–17 are IDs 2–18 (hover a module). If Make renumbered them, regenerate with `tools/build-blueprint.mjs` for the new IDs; the template and body are regenerated for the new IDs |
| Pills | Every mapping is a purple pill; no grey text in 4, 6–8 (HTML), 9, 10 |
| Filters | R1 → 4 "Content OK" (two AND conditions); R1 → 11 "Skip" (two OR groups: `` 2.`0` `` Text not equal `TRUE` / source count Numeric = 0); no R2: 5 → 6 → 7 → 8 → 9 → 10 is a chain with no filters (C13b) |
| Error routes | Resume on 2, 3, 16, 17, 6–9, 11 and 15; Ignore on 10, 12, 13; 1 → 13 → Ignore; 4 → 14 (Sleep **10 s**) → 15 → Resume with `data` = `{{16.data}}` |
| Gmail 6–8 | BCC in Map mode `` {{split(2.`5`; ",")}} `` (6/7/8 use columns 5/6/7); Additional email headers `List-Unsubscribe` = `` <{{2.`8`}}/unsubscribe> ``; body type Raw HTML |
| Sheets 9, 11 | Column range A-Z; columns A–E (date, subscribers, batches, status, error) filled, values as in `tools/build-blueprint.mjs` |
| HTTP 2, 3, 4, 15, 16 | "Return error if HTTP request fails" Yes; timeouts 20/20/60/40/20; 16 parse response No |

Then continue with BUILD-ORDER §4 checks (C21, C25, C22 …) and MAIA-PROMPTS **Step 8** test runs.
