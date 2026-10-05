# Google Sheet spec: "MarketMorning"

File settings: **Locale United States, Time zone (GMT-05:00) New York**. Share the file as Editor with the Vercel service account email. Row 1 of every tab is the header row exactly as written. The Sheet holds no market data (see [DATA-SOURCES.md](DATA-SOURCES.md)).

## Config (A key, B value)
| Key | Value |
|---|---|
| SEND_ENABLED | TRUE (kill switch: FALSE stops sends) |
| SUBSCRIBER_CAP | 300 |
| BATCH_SIZE | 100 |
| TX_CONFIRM_CAP | 70 (confirm emails per rolling 24 h) |
| TX_UNSUB_CAP | 30 (unsubscribe emails per rolling 24 h) |
| GEMINI_MODEL | same value as `GEMINI_MODEL` in .env |
| SITE_URL | https://media-and-software-manger.vercel.app |
| OWNER_EMAIL | your Gmail address |
| FALLBACK_SUMMARY | Today's AI summary is unavailable. The headlines and crypto prices below come straight from our sources. |

Below, `cfg("KEY")` means `VLOOKUP("KEY",Config!$A:$B,2,FALSE)`.

## News (owner-edited; drives the GDELT query)
`topic | news_term` (A–B). Seed from [samples/news.csv](../samples/news.csv). One word or a quoted phrase per row.

## Subscribers (written only by the Vercel function)
`email | status | created_at | confirmed_at | unsubscribed_at | token_nonce` (A–F). `status` ∈ pending, active, waitlist, unsubscribed. Timestamps ISO 8601 UTC. `token_nonce` 32 hex chars, rotated after every token use.

## TxLog (written by the function, one row per transactional email)
`sent_at | type | email_hash` (A–C). `sent_at` ISO 8601 UTC; `type` ∈ confirm, unsub_confirm; `email_hash` = token `h` (no plain addresses).

## SendLog (written by Make, one row per run)
`date | subscribers | batches | status | error` (A–E). `status` ∈ ok, ok_no_ai, partial, failed, skipped.

## Feed (read by Make module 1)
Row 1 = keys (A–L), row 2 = formulas.

| Col | Key | Formula (row 2) |
|---|---|---|
| A | send_enabled | `=IF(cfg("SEND_ENABLED")=TRUE,"TRUE","FALSE")` |
| B | gdelt_url | `="https://api.gdeltproject.org/api/v2/doc/doc?query="&ENCODEURL("("&TEXTJOIN(" OR ",TRUE,News!B2:B40)&") (stock OR shares OR crypto) sourcelang:english")&"&mode=artlist&maxrecords=6&timespan=24h&sort=hybridrel&format=json"` |
| C | gemini_model | `=cfg("GEMINI_MODEL")` |
| D | fallback_json | `="{""source"":""fallback"",""summary"":"""&SUBSTITUTE(cfg("FALLBACK_SUMMARY"),"""","'")&""",""story1_id"":1,""story1_why"":"""",""story2_id"":2,""story2_why"":"""",""crypto_note"":""""}"` |
| E | active_count | `=MIN(COUNTIF(Subscribers!B2:B,"active"),cfg("SUBSCRIBER_CAP"))` |
| F | batch_count | `=ROUNDUP(E2/cfg("BATCH_SIZE"),0)` |
| G | batch_1 | `=IFERROR(TEXTJOIN(",",TRUE,QUERY(FILTER(Subscribers!A2:A,Subscribers!B2:B="active"),"select Col1 limit "&MIN(cfg("BATCH_SIZE"),cfg("SUBSCRIBER_CAP")-0*cfg("BATCH_SIZE"))&" offset "&0*cfg("BATCH_SIZE"),0)),"")` |
| H | batch_2 | as G2 with `1*` in both places |
| I | batch_3 | as G2 with `2*` in both places |
| J | site_url | `=cfg("SITE_URL")` |
| K | owner_email | `=cfg("OWNER_EMAIL")` |
| L | fallback_summary | `=cfg("FALLBACK_SUMMARY")` |

Three batch columns cover the 300 cap at 100 per batch; a higher cap breaks the Gmail budget (ARCHITECTURE §5).

## Dashboard (owner only; no public stats)
| Cell | Metric | Formula |
|---|---|---|
| B2–B5 | Active / Pending / Waitlist / Unsubscribed | `=COUNTIF(Subscribers!B:B,"active")` (etc.) |
| B6 | Cap used | `=B2/cfg("SUBSCRIBER_CAP")` (format %) |
| B7 | Transactional emails today (UTC date) | `=COUNTIF(TxLog!A:A,TEXT(TODAY(),"yyyy-mm-dd")&"*")` |
| B8 | Last run status | `=INDEX(SendLog!D:D,COUNTA(SendLog!D:D))` |
| B9 | Rows due for purge | `=COUNTIF(Subscribers!B:B,"unsubscribed")+SUMPRODUCT((Subscribers!B2:B="pending")*(IFERROR(DATEVALUE(LEFT(Subscribers!C2:C,10)),TODAY())<TODAY()-7))` |
| D2 | Signups per day (table) | `=QUERY({ARRAYFORMULA(IFERROR(DATEVALUE(LEFT(Subscribers!C2:C,10)))),Subscribers!A2:A},"select Col1, count(Col2) where Col1 is not null group by Col1 label Col1 'day', count(Col2) 'signups'",0)` |
| G2 | Failures (table) | `=IFERROR(FILTER(SendLog!A2:E,SendLog!D2:D<>"ok"),"none")` |

Charts: (1) column chart of D:E "Signups per day"; (2) line chart of SendLog A:B "Subscribers sent per run"; (3) pie of A2:B5 "Status mix".
