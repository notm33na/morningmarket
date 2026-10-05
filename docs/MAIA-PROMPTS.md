# Building the scenario with Maia

How to build the MarketMorning scenario with Maia (Make's AI scenario builder), following [BUILD-ORDER](BUILD-ORDER.md) §4 and [ARCHITECTURE](ARCHITECTURE.md) §2. There are **6 Maia prompts**; everything else is done by hand.

**Before you start**
1. The Google Sheet is built with `tools/sheet-setup.gs` per [SHEET.md](SHEET.md) (Feed row 2 shows values in A–L), and you have its ID.
2. Make connections exist: Google Sheets and Gmail (Sign in with Google), and Slack (the same workspace as LeadFlow).
3. Your Gemini and CoinGecko Demo API keys are ready for two API-key keychains: "Gemini" (header `x-goog-api-key`) and "CoinGecko" (header `x-cg-demo-api-key`). Create them when Maia stops and asks.
4. The Subscribers tab has 3 rows you typed yourself: `{{TEST_EMAIL+mm1}}`, `+mm2` and `+mm3` (your real plus-addresses), each with status `active`.
5. An empty scenario "MarketMorning" exists and stays **OFF** until BUILD-ORDER §7.

## Why the build is split this way
- Every mapping uses fixed module IDs (`{{1.x}}`, `{{5.x}}`, `{{15.x}}`, `{{17.x}}`, `{{18.cpi}}` …), and Make assigns IDs in **creation order**.
- Routers and error-handler directives (Resume, Ignore) are modules too, so they also take IDs. Filters don't.
- **Phase A** (Steps 1–5b) therefore creates only modules 1–18, in order: a plain chain plus the error-route modules.
- **Phase B** (Step 5c) adds the routers, directives and filters. They take IDs 19 and up, which no mapping refers to.
- **After every step, check the IDs.** Open each new module, read its ID (shown on the module bubble), and confirm two things: the ID matches the spec, and the earlier modules are unchanged.
- **If an ID is wrong:**
  - If only the newest module is wrong, delete it and add it again. Make may not reuse the deleted ID; if the new one is still wrong, restart.
  - Otherwise, delete the scenario and restart from Step 1. IDs can't be renumbered.
- **Paste test:** text in `{{1.key}}` form, pasted into a Make field, should turn into purple mapping pills. Step 1 tests this once before you rely on it.

**Rules for Maia (in every prompt):**
- Maia adds modules and changes settings, and fills only single-item mappings such as `` {{1.`1`}} ``.
- Maia does not build filters, router conditions, error handlers, data structures, or any mapping that contains a function. Those are listed under "For you to do manually", with exact values.
- **Credits:** Maia's own replies may cost credits. Check **Credit usage** after Prompt 1. If Maia's 6 prompts would push the test total in Step 8 over 150, skip test 4 (−16) in addition to optional test 11.

---

## Step 1. Maia Prompt 1: modules 1–3
```
In the scenario "MarketMorning", create exactly three modules, in this order, linked in a chain 1 → 2 → 3. Do not create any other modules, routers, filters or error handlers. Do not run or activate the scenario. If a connection or keychain is needed, stop and ask me. Rename each module to the label I give.

Module 1 – Google Sheets › Get Range Values. Label: "1 Read Feed". Connection: my Google Sheets connection (ask me). Search method: Enter manually. Spreadsheet ID: [TYPE SHEET ID HERE YOURSELF]. Sheet name: Feed. Range: A1:L2. Table contains headers: Yes.

Module 2 – HTTP › Make a request. Label: "2 BLS latest numbers". URL: https://www.bls.gov/feed/bls_latest.rss . Method: GET. Authentication: none. Headers: one header, name User-Agent, value MarketMorning portfolio demo (then map {{1.`8`}} in brackets). Parse response: No. Timeout: 20 seconds. Evaluate all states as errors: Yes.

Module 3 – HTTP › Make a request. Label: "3 CoinGecko prices". URL: https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin,dogecoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true . Method: GET. Authentication: API key, keychain [COINGECKO KEYCHAIN] (stop and ask me to create it: key in header x-cg-demo-api-key). Parse response: Yes. Timeout: 20 seconds. Evaluate all states as errors: Yes.
```
**For you to do manually**
- Type the Sheet ID yourself if Maia left the placeholder.
- Create the "CoinGecko" keychain when Maia asks: API key placement **Header**, parameter name `x-cg-demo-api-key`.

**Check after Maia**
- IDs are 1, 2, 3, with the labels given.
- Module 2's User-Agent header reads `` MarketMorning portfolio demo ({{1.`8`}}) `` with the pill; parse response is No.
- Module 3 has no key typed into the URL.
- **Paste test (0 credits):** paste `` {{1.`8`}} `` into any empty text field. It should become a pill; then delete it. If it stays plain text, build every later paste with the mapping panel instead, and use Make's full-screen editor for the long ones.

**Checks now** (Run this module only; if Make asks for mapped inputs, paste the value of Feed!I2 for `` 1.`8` ``)
- **C21:** module 1 output shows the 12 keys `send_enabled` … `gemini_fallback_model`. ≈1 credit.
- **C25, day 1:** module 2 returns 200 with RSS text containing "Consumer Price Index". ≈1 credit.
- **Keychain sanity:** module 3 returns prices. ≈1 credit.

*Running total: 3 / 150.*

## Step 2. Maia Prompt 2: modules 4–5
```
In "MarketMorning", after module 3, add exactly two modules in this order, chained 3 → 4 → 5. Do not change modules 1–3. No other modules, routers, filters or error handlers. Do not run or activate the scenario. Stop and ask if a connection or keychain is needed. Rename each module to its label.

Module 4 – HTTP › Make a request. Label: "4 Gemini digest". URL: https://generativelanguage.googleapis.com/v1beta/models/{{1.`1`}}:generateContent (map 1.`1` as a pill). Method: POST. Authentication: API key, keychain [GEMINI KEYCHAIN] (stop and ask me to create it: key in header x-goog-api-key). Body type: Raw. Content type: JSON (application/json). Request content: {} (a temporary placeholder; Make will not save an empty JSON body – I will replace it). Parse response: Yes. Timeout: 60 seconds. Evaluate all states as errors: Yes.

Module 5 – JSON › Parse JSON. Label: "5 Parse digest". JSON string: leave EMPTY. Data structure: leave EMPTY – I will create it.
```
**For you to do manually**
- Create the "Gemini" keychain: placement **Header**, name `x-goog-api-key`.
- **Module 5, data structure:** **Add**, then **Generator** (content type JSON), and paste:
  `{"source":"","summary":"","crypto_note":""}`
- **Module 5, JSON string:** `` {{ifempty(4.data.candidates[1].content.parts[1].text; 1.`2`)}} ``
- Module 4's real body waits until Step 5c, because it references modules 17 and 18. Until then it holds the placeholder `{}` (Make won't save an empty Raw/JSON body); don't run module 4 before Step 5c.

**Check after Maia:** IDs 1–3 unchanged and still configured; new IDs 4 and 5; the URL has the `` 1.`1` `` pill; the body is just `{}`.

*No runs. Running total: 3 / 150.*

## Step 3. Maia Prompt 3: modules 6–8
```
In "MarketMorning", after module 5, add exactly three Gmail modules, chained 5 → 6 → 7 → 8 (I will rewire them later). Do not change modules 1–5. No routers, filters or error handlers. Do not run or activate. Stop and ask for the Gmail connection. Rename each to its label.

For each of the three: Gmail › Send an Email. Connection: my Gmail connection (ask me). To: map {{1.`9`}}. Body type: Raw HTML. Content: placeholder (a temporary word; Make may not save an empty required field – I will replace it). Subject: placeholder. BCC: leave EMPTY.
Labels, in creation order: "6 Send batch 1", "7 Send batch 2", "8 Send batch 3".
```
**For you to do manually**
- **Now, in each module:**
  - **BCC:** click the field's **Map** toggle, then paste `` {{split(1.`5`; ",")}} `` (6), `` {{split(1.`6`; ",")}} `` (7) or `` {{split(1.`7`; ",")}} `` (8).
  - **Subject:** `MarketMorning · {{formatDate(now; "ddd, MMM D"; "America/New_York")}}: the Fed, US data and crypto`
  - **Additional email headers:** name `List-Unsubscribe`, value `` <{{1.`8`}}/unsubscribe> ``.
- **In Step 5c:** paste the content (the email HTML).

**Check after Maia:** IDs 1–5 unchanged; new IDs 6, 7, 8; To is the `` 1.`9` `` pill; body type Raw HTML. Any field Maia couldn't leave empty holds the word `placeholder`; replace it as listed (subject now, content in Step 5c).

*No runs. Running total: 3 / 150.*

## Step 4. Maia Prompt 4: modules 9–12
```
In "MarketMorning", after module 8, add exactly four modules, chained 8 → 9 → 10 → 11 → 12 (I will rewire them later). Do not change modules 1–8. No routers, filters or error handlers. Do not run or activate. Stop and ask for connections. Rename each to its label.

Module 9 – Google Sheets › Add a Row. Label: "9 Log run". Connection: my Google Sheets connection (ask me). Search method: Enter manually. Spreadsheet ID: [TYPE SHEET ID HERE YOURSELF]. Sheet name: SendLog. Table contains headers: Yes. Column "subscribers": map {{1.`3`}}. Leave date, batches, status and error EMPTY.
Module 10 – Slack › Create a Message. Label: "10 Report run". Connection: my Slack connection (ask me). Channel ID: [SLACK CHANNEL ID]. Text: placeholder (temporary; I will replace it).
Module 11 – Google Sheets › Add a Row. Label: "11 Log skip". Connection: my Google Sheets connection (ask me). Search method: Enter manually. Spreadsheet ID: [TYPE SHEET ID HERE YOURSELF]. Sheet name: SendLog. Table contains headers: Yes. subscribers: map {{1.`3`}}. batches: 0. status: skipped. error: send disabled or no content. Leave date EMPTY.
Module 12 – Slack › Create a Message. Label: "12 Alert skip". Connection: my Slack connection (ask me). Channel ID: [SLACK CHANNEL ID]. Text: MarketMorning SKIPPED: SEND_ENABLED off, or the Fed feed, BLS and CoinGecko all empty.
```
**For you to do manually** (paste each value whole; don't combine pieces)
- **Module 9 and module 11, date:** `{{formatDate(now; "YYYY-MM-DD"; "America/New_York")}}`
- **Module 9, batches:** `{{if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)}}`
- **In Step 5c,** paste these two into module 9 and this text into module 10:
  - **Module 9, status:**
    `` {{if(1.`4` = 0; "ok"; if((if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)) = 0; "failed"; if((if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)) < 1.`4`; "partial"; if(5.source = "fallback"; "ok_no_ai"; "ok"))))}} ``
  - **Module 9, error:**
    `` {{if(5.source = "fallback"; "AI fallback. "; "")}}{{if(18.cpi; ""; "No BLS data. ")}}{{if(3.data.bitcoin.usd; ""; "No crypto data. ")}}{{if(length(ifempty(17.rss.channel.item; emptyarray)) = 0; "No Fed feed. "; "")}}{{if((if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)) < 1.`4`; "Batch failures. "; "")}} ``
  - **Module 10, text:**
    `` MarketMorning {{if(1.`4` = 0; "ok"; if((if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)) = 0; "failed"; if((if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)) < 1.`4`; "partial"; if(5.source = "fallback"; "ok_no_ai"; "ok"))))}}: attempted {{1.`3`}} subscribers, {{if(6.id; 1; 0) + if(7.id; 1; 0) + if(8.id; 1; 0)}}/{{1.`4`}} batches delivered. {{if(5.source = "fallback"; "AI fallback. "; "")}}{{if(18.cpi; ""; "No BLS data. ")}}{{if(3.data.bitcoin.usd; ""; "No crypto data. ")}}{{if(length(ifempty(17.rss.channel.item; emptyarray)) = 0; "No Fed feed. "; "")}} ``
- **If Gmail's output field isn't `id`** (for example `Message ID`), replace every `6.id`, `7.id` and `8.id` in modules 9 and 10 with that field.

**Check after Maia:** IDs 1–8 unchanged; new IDs 9–12; sheet names; channel IDs typed by you.

*No runs. Running total: 3 / 150.*

## Step 5a. BUILD BY HAND: modules 13–15 (error routes)
Maia can't add error-handler routes, so do these by hand.
1. Right-click **module 1**, choose **Add error handler**, then pick **Slack › Create a Message** (not a directive).
   - Label it "13 Alert sheet fail".
   - Channel `[SLACK CHANNEL ID]`; text `MarketMorning FAILED: Sheet read: {{error.message}}`.
2. Right-click **module 4**, choose **Add error handler**, then pick **Tools › Sleep**.
   - Label it "14 Wait before retry"; delay **10** seconds.
3. Right-click **module 4** again and choose **Clone**. This creates exactly one module, ID 15.
   - Drag from module 14's right handle to the clone to link 14 → 15.
   - Label it "15 Gemini fallback model".
   - URL `` https://generativelanguage.googleapis.com/v1beta/models/{{1.`11`}}:generateContent ``; timeout **40 s**.
   - If Clone doesn't work, add **HTTP › Make a request** after 14 and copy module 4's settings by hand.
4. Add **no** directives yet.

**Check:** IDs 1–12 unchanged, new IDs 13, 14, 15 (C19, part 1). *0 credits.*

## Step 5b. BUILD BY HAND: modules 16–18 between 3 and 4
1. Right-click the **link 3 → 4**, choose **Add a module**, then pick **HTTP › Make a request**.
   - Label it "16 Fed speeches".
   - Method GET; URL `https://www.federalreserve.gov/feeds/speeches.xml`.
   - Header `User-Agent` = `` MarketMorning portfolio demo ({{1.`8`}}) ``.
   - Parse response **No**; timeout **20 s**; Evaluate all states as errors **Yes**.
2. Right-click the **link 16 → 4**, choose **Add a module**, then pick **XML › Parse XML**.
   - Label it "17 Parse Fed RSS". XML: `{{16.data}}`.
   - Data structure: **Add**, then **Generator**, content type **XML**; paste the contents of `samples/fed-speeches.sample.xml`.

3. Right-click the **link 17 → 4**, choose **Add a module**, then pick **Text parser › Match pattern**.
   - Label it "18 Match BLS numbers".
   - Pattern: paste the whole of `prompts/bls-pattern.make.txt`. Text: `{{2.data}}`.
   - Global match **No**; case sensitive **Yes**; multiline **No**; singleline **No**.
   - Continue the execution of the route even if the module finds no matches: **Yes**.

**Check:** IDs 16, 17 and 18; the chain reads 1 → 2 → 3 → 16 → 17 → 18 → 4 → 5 → 6 … 12.

**Checks now** (Run this module only; for module 17, paste module 16's output as `16.data` if asked)
- **C22:** module 17 outputs `rss.channel.item[]` with plain `title`, `link` and `pubDate`, newest first. ≈1 credit.
- **C24:** module 18 outputs four values in fields `cpi`, `unemployment`, `payrolls`, `ppi` (for this run, paste module 2's output or `samples/bls-latest.sample.rss` as `2.data` if asked). If they have other names, apply the C24 fallback. ≈1 credit.

If C22 shows a different path, apply its fallback, then run `node tools/preview-digest.mjs --make-body > prompts/gemini-body.make.txt` before Step 5c.

*Running total: 5 / 150.*

## Step 5c. BUILD BY HAND: routers, rewiring, directives, pastes
**R1.** Routers take IDs 19 and up.
1. Right-click the **link 18 → 4** and choose **Add a router**. Module 4 is now on R1's first route.
2. Right-click the **link 10 → 11** and choose **Unlink**. Drag from R1's handle to module 11 to make route 2.
   - If dragging doesn't link them, click R1's **+**, add any module, delete it, then drag that route's end onto 11.
3. On route 2's wrench, choose **Set up a filter**: name "Skip", and tick **Fallback route**.
4. On route 1 (R1 → 4), set the filter **"Content OK"**. It is one AND group with two conditions:
   - `` {{1.`0`}} `` **Text: Equal to** `TRUE`
   - AND `{{length(ifempty(17.rss.channel.item; emptyarray)) + if(3.data.bitcoin.usd; 1; 0) + if(18.cpi; 1; 0)}}` **Numeric: Greater than** `0`

   (C13.)

**R2.**
1. Right-click the **link 5 → 6** and choose **Add a router**.
2. Unlink 6 → 7, 7 → 8 and 8 → 9.
3. Connect R2 → 7, R2 → 8 and R2 → 9, in that order. The routes then run 6, 7, 8, 9; if not, use the router's **Order routes** option.
4. Filters:
   - "Batch 1" (R2 → 6): `` {{1.`4`}} `` **Numeric: Greater than or equal to** `1`
   - "Batch 2" (R2 → 7): ≥ `2`
   - "Batch 3" (R2 → 8): ≥ `3`
   - R2 → 9: no filter

**Directives.** How you add a directive depends on where it goes:

| Where | How |
|---|---|
| Error handler of 2, 3, 16, 17, 18, 6, 7, 8, 9, 11 | Right-click the module, **Add error handler**, **Resume**, leave the output empty |
| Error handler of 5 | Right-click, **Add error handler**, **Resume**. Set `source` = `fallback`, `summary` = `` {{1.`10`}} ``, `crypto_note` empty |
| Error handler of 10, 12, 13 | Right-click, **Add error handler**, **Ignore** |
| After 13 (end of module 1's error route) | Click 13's right handle, **Flow control**, **Ignore** |
| After 15 (end of module 4's error route) | Click 15's right handle, **Flow control**, **Resume**. This replaces module 4's output: set `data` = `{{15.data}}` |
| Error handler of 15 | Right-click 15, **Add error handler**, **Resume** with `data` empty. If Make doesn't offer this, use the C14b fallback |

**Pastes** (do these now that modules 17 and 18 exist)

| Module | Field | What to paste |
|---|---|---|
| 4 and 15 | Request content | The whole of `prompts/gemini-body.make.txt` |
| 6, 7, 8 | Content | The whole of `templates/digest-email.html` |
| 9 | status, error | The values from Step 4 |
| 10 | Text | The value from Step 4 |

**Check after**
- **C19:** IDs 1–18 match ARCHITECTURE §2, and routers and directives have IDs of 19 or higher.
- Every pill is purple; none shows grey "missing" text.

*0 credits.*

## Step 6. Maia Prompt 5: scenario settings (the schedule stays OFF)
```
In "MarketMorning", change only scenario settings; do not add, remove or edit modules, and do not run or activate the scenario. Set: Data is confidential = On. Max number of cycles = 1. Sequential processing = Off. Allow storing of incomplete executions = Off. Schedule: Days of the week, Monday–Friday, at 08:00 (organization time zone America/New_York). Keep the scenario inactive.
```
**For you to do manually:** confirm the organization time zone is America/New_York (C1 was done in BUILD-ORDER §1).
**Check after Maia:** settings as listed, and the scenario toggle is still **OFF**. *0 run credits (plus Maia usage).*

## Step 7. Maia Prompt 6: read-only audit
```
In "MarketMorning", do not change anything. List every module with its ID, label, app and module type; for each HTTP module its URL, method, timeout and "Evaluate all states as errors" value; and each router's routes in order with their filter names.
```
**Check:** compare the list with ARCHITECTURE §2 line by line (C19, final). *0 run credits (plus Maia usage).*

## Step 8. Test runs (BUILD-ORDER §6; "Run once" with the scenario OFF)
Restore every change after each test. Note each run's duration for C15: compare it with the about 3.3-minute estimate in ARCHITECTURE §5.

| # | Test (PRD) | How | Checks | Credits | Total |
|---|---|---|---|---|---|
| 0 | JSON escaping | Run this module only on 4; in the input dialog give a Fed title containing `"` and `\` | C6 | 1 | 6 |
| 1 | Happy path (1) | as built | C9, C13, C13b, C18 (save module 2, 3, 17 and 5 outputs and feed them to the preview tool), C8 | 13 | 19 |
| 2 | Both models fail (2) | Config GEMINI_MODEL and GEMINI_FALLBACK_MODEL = `x` | C14b (both fail) | 16 | 35 |
| 3 | Bad JSON (3) | module 5 JSON string `{` | C14b (Resume) | 13 | 48 |
| 4 | Main model fails, fallback answers (3b) | Config GEMINI_MODEL = `x` | C14b (15 succeeds) | 16 | 64 |
| 5 | BLS broken (4) | module 2 URL `…/bls_latest-x.rss` | C24 (empty bundle) | 13 | 77 |
| 6 | CoinGecko down (5) | keychain key = `x` | C20 | 13 | 90 |
| 7 | Fed feed down (6) | module 16 URL `…/speeches-x.xml` | – | 13 | 103 |
| 8 | All three sources down (7) | tests 5, 6 and 7 together | C13 (fallback route) | 8 | 111 |
| 9 | Send disabled (7) | Config SEND_ENABLED = FALSE | – | 8 | 119 |
| 10 | Partial batches (8) | BATCH_SIZE 2. Add a 4th row whose email is the plain string `invalid-address`, placed so it lands in batch 2. Afterwards restore BATCH_SIZE 100 and delete the row | C13b | 13 | 132 |
| 11 | *Optional* worst-case credits | module 4 timeout 1 s and Config GEMINI_FALLBACK_MODEL = `x` | C15 (≤ 16 credits) | (16) | (skip) |
| 12 | Days 2 and 3 | Run this module only on 2 and 16, on each of 2 more days | C23, C25 | 4 | 136 |

**Total ≈ 136 of the 150 test credits** (per-run figures are upper bounds). Test 11 (16 credits) is optional; without it, C15 relies on the credit counts from tests 2 and 4. If Make asks for mapped inputs on test 0, paste the value. If test 0 can't take a crafted title, rely on test 1, and treat C6 as passed only once a live Fed title with a quote or backslash has gone through.

Step 8 is BUILD-ORDER §6. §5 (the local quality gate) can run in parallel; then go to §7.
