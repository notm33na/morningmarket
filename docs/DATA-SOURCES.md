# Market-data licensing (decided 2026-10-05)

**Rule:** use a source only if its official terms clearly allow showing its data to end users of a free product (our subscribers' emails), with attribution.

## Candidates
| Source | Asset | Terms | Display to third parties on the free tier? | Attribution | Free limits | Prev close / % change |
|---|---|---|---|---|---|---|
| GOOGLEFINANCE (Sheets) | Stocks, crypto | [google.com/googlefinance/disclaimer](https://www.google.com/googlefinance/disclaimer/) | **No**: "not to … transmit or redistribute any data … without obtaining prior written consent" | – | n/a | Yes (`closeyest`, `changepct`) |
| Alpha Vantage | Stocks | [alphavantage.co/terms_of_service](https://www.alphavantage.co/terms_of_service/) | **No**: licence is "for personal, non-commercial use" on devices "that you own or control"; nothing grants display to others | Not stated | 25 requests/day | Yes (Global Quote) |
| Finnhub | Stocks | [finnhub.io/terms-of-service](https://finnhub.io/terms-of-service) | **No**: "not redistribute or share access to data or derived results … with anyone or any 3rd party without written approval" | Not stated | 60 calls/min | Yes (`/quote`) |
| Twelve Data | Stocks | [twelvedata.com/terms](https://twelvedata.com/terms), [usage article](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) | **No**: individual plans "do not permit redistribution of data or commercial display of data to third parties"; Basic = internal non-display | Required when display is licensed | 800 requests/day | Yes (`/quote`) |
| Tiingo | Stocks | [app.tiingo.com/tos](https://app.tiingo.com/tos/) | **No**: free data is "internal and personal use only"; you "may not display or share the data with another person" | "Data sourced by Tiingo" only if redistribution is granted | 1,000/day, 50/hour | Yes (EOD) |
| Financial Modeling Prep | Stocks | [FMP terms](https://site.financialmodelingprep.com/developer/docs/terms-of-service) | **No**: no display on websites, apps or products used by multiple people "irrespective of whether such usage is complimentary or paid" | – | 250 requests/day | Yes (`/quote`) |
| **CoinGecko Demo API** | Crypto | [coingecko.com/en/api_terms](https://www.coingecko.com/en/api_terms), [pricing](https://www.coingecko.com/en/api/pricing) | **Yes, with attribution**: the Demo plan's licence column reads "Attribution required" (paid plans: "Commercial"). Terms §4.4 require attribution when data is shown. The ban in §4.1.6 covers re-distributing or syndicating *access to the API*, not showing data in your product. | "Powered by CoinGecko" (≥ 10 pt) next to the data, linked, with the logo from the Brand Kit ([guide](https://brand.coingecko.com/resources/attribution-guide)) | 10,000 calls/month, 100/min, data refreshed ~60 s | 24 h % change (`usd_24h_change`); no "previous close" (crypto trades 24/7) |

## Decision
- **Stocks: no free source qualifies.** The email shows **no stock prices, % changes or index levels**. The prompt forbids any stock-market content.
- **Crypto: CoinGecko Demo API**, one `/simple/price` call per run (~23/month of 10,000). We show price and 24 h % change for BTC, ETH, SOL, XRP, BNB and DOGE, with "Powered by CoinGecko" (14 px ≈ 10.5 pt) and the logo beside the table, plus a text credit in the footer. The use is non-commercial (free, no ads); anything commercial needs a paid CoinGecko plan.
- **Headlines:** see below (no headline source in the final design).
- **GOOGLEFINANCE is removed from the design**, so it is no longer in the risk register.

# Headline sources (decided 2026-10-05)

**Why this was revisited:** live previews on 2026-10-05 got HTTP 429 ("Please limit requests to one every 5 seconds") and connection timeouts from GDELT at a few requests per hour, and one response with zero articles. GDELT's own documentation only says its APIs "are rate limited to protect the underlying ElasticSearch clusters" ([blog](https://blog.gdeltproject.org/ukraine-api-rate-limiting-web-ngrams-3-0/)); it does not document per-IP throttling. Make's shared outbound IPs are used by many customers, so the same throttling is likely there (confirmed in the reliability test below).

## Commercial news APIs
| Source | Terms | Free-tier display to subscribers? | Notes |
|---|---|---|---|
| NewsAPI.org | [pricing](https://newsapi.org/pricing) | **No**: Developer plan "cannot be used in a staging or production environment"; 24 h delay | 100 requests/day |
| GNews | [pricing](https://gnews.io/pricing) | **No**: "for non-commercial projects, development and testing only. Commercial and published projects need a paid plan." | 100/day, 12 h delay |
| Marketaux | [pricing](https://www.marketaux.com/pricing) | **Not verifiable**: the pricing page states no licence and the terms URL returned 404 | 100/day |
| The Guardian Open Platform, NYT APIs | – | **Not verifiable**: both sites block our research tool, so their terms could not be read from the source | Excluded until the owner verifies |

No commercial source clearly qualifies.

## US government feeds (public domain)
Measured live on 2026-10-05; "weekdays with items" = distinct weekdays with a new item in the last 30 days.
| Feed | URL (RSS 2.0) | Terms (agency's own page) | Weekdays with items / 20 | Relevance |
|---|---|---|---|---|
| **Fed speeches** | federalreserve.gov/feeds/speeches.xml | "information on Board's website is in the public domain and may be copied and distributed without permission. Please cite to the Board as the source"; seals/logos need permission ([disclaimer](https://www.federalreserve.gov/disclaimer.htm)) | 7 (15 items) | High: every item is a Governor on policy, the economy or regulation |
| Fed press releases (all) | federalreserve.gov/feeds/press_all.xml | same | 10 | Low–mixed: mostly bank approvals and enforcement actions; FOMC statements are in press_monetary.xml (1 day in 30) |
| SEC press releases | sec.gov/news/pressreleases.rss | "considered public information and may be copied or further distributed … without the SEC's permission"; ≤ 10 requests/s, no "unclassified" bots ([privacy page](https://www.sec.gov/about/privacy-information)) | 11 | Medium–low: mostly enforcement; occasional crypto policy |
| BLS | bls.gov/feed/bls_latest.rss (+ cpi_latest, empsit) | "everything that we publish … is in the public domain … we do ask that you cite the Bureau of Labor Statistics" ([copyright](https://www.bls.gov/opub/copyright-information.htm)) | 1 item, updated on release days | High on CPI/jobs days, otherwise unchanged |
| BEA | apps.bea.gov/rss/rss.xml | "in the public domain and may be used or reproduced without specific permission … 'Source: U.S. Bureau of Economic Analysis'" ([FAQ](https://www.bea.gov/help/faq/147)) | 2 | High on GDP/PCE days; returns 406 if an `Accept` header is sent |
| Treasury | press releases page | Policy page states no copyright position we could quote | – | Excluded |

**Relevance, honestly:** government releases cannot replace market news. On most days nothing new appears in the last 24 hours, and the useful feeds (FOMC, CPI, jobs, GDP) publish a few days a month. The Fed speeches feed is the exception worth carrying daily: it always has recent, dated, policy-relevant items, and Fed speeches are a standing market topic.

## GDELT reliability test (2026-10-05)
| From | Result |
|---|---|
| Owner's PC (curl, Node, ~10 tries over hours) | 429s, 16 s responses, connection timeouts, one empty `{}` |
| Make (3 tries, Run this module only) | 429 every time |
| Google Apps Script (UrlFetchApp) | 429, then 200 with `{}` (0 articles) |
| Claude Code test machine | mostly 429; one 200 with 0 articles |

Not one response with articles across four networks.

## Decision (owner, 2026-10-05: "Fed, no paid APIs")
- **No market headlines.** GDELT is dropped: not reliable from any network, so a daily 08:00 email can't depend on it. No free commercial API qualifies.
- **Fed speeches RSS:** a fixed section with the latest 3 speeches, linked and dated, "Source: Federal Reserve Board" (no seal).
- **BLS Public Data API v2** (free registration key): one POST returns the latest CPI, unemployment rate, payroll employment and PPI with BLS-calculated 1-month changes. Shown verbatim with month and "(p)" for preliminary, plus "Source: U.S. Bureau of Labor Statistics, retrieved <date> via the BLS Public Data API" and BLS's statement that "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov" ([API terms](https://www.bls.gov/developers/termsOfService.htm): "users of the public API should cite the date that data were accessed"; no BLS logo). The BLS RSS feed was tried first but BLS bot protection returns 403 "Access Denied" to Make's servers (2026-10-05), while the API, built for automated use, answers.
- **Not used:** BEA (+2 credits would push the worst case to 414/month), SEC (mostly enforcement), Fed press releases (mostly bank approvals), Treasury (no quotable policy).
- Gemini may mention a speech only by speaker, topic and date as given, and BLS values only exactly as given; never causation or interpretation.
