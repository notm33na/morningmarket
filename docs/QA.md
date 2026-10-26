# Digest QA checklist

Run after `node tools/preview-digest.mjs` (live or `--sample`): check each `tests/previews/*.html` against its `.input.json`. Every item is pass/fail; a digest ships only when all pass.

For each preview HTML (`tests/previews/*.html`) and its `.input.json`:
- No stock-market content (prices, indexes, companies, bonds) anywhere in the email.
- Every BLS value shown or quoted matches `bls.Results.series` in the input: CPI and PPI = `calculations.pct_changes["1"]` with a sign and "%", unemployment = `value` + "%", payrolls = `calculations.net_changes["1"]` × 1,000 with a sign, each with its `periodName` and `year`, and "(p)" when the footnote code is P. The BLS citation (retrieval date and "cannot vouch" statement) is present when the section is shown. Every crypto price and % in the email must exist in the CoinGecko input (allowing the template's formatting: 2 decimals, 4 for XRP and DOGE, thousands separators, a + sign). Flag any number the AI invented or changed.
- Every link must come from the Fed feed (`fed_speeches[].link`), except the fixed footer and attribution links (site, unsubscribe, bls.gov home page, federalreserve.gov home page, coingecko.com). No made-up URLs.
- Fed speeches are mentioned in AI text only by speaker name, topic and date as given in their titles (no added roles or content); their dates and any numbers inside speech titles, BLS values and crypto values are the only allowed numbers (unit words like "1-month" or "24 hours" from the input labels are fine).
- No implied causation between speeches, data and price moves, and no interpretation of data as good or bad.
- When CoinGecko data is empty, no crypto table, chart image or crypto note is rendered; when BLS or the Fed feed is empty, its section renders no markup (no `<a href="">`).
- Present: footer "For information only. Not financial advice.", an unsubscribe link, "A portfolio demo by M&S Manger", "Powered by CoinGecko" next to the crypto data (when shown), "Source: U.S. Bureau of Labor Statistics" next to the data section (when shown), and "Source: Federal Reserve Board" next to the Fed section (when shown).
- Email-safe HTML: inline CSS, table layout, no JavaScript, max width 600px, every image has alt text, no leftover `{{` placeholders.
- The tone stays factual: no buy/sell/hold recommendations or predictions.

Record PASS/FAIL per file with reasons.
