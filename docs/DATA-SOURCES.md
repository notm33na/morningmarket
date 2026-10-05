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
- **Stocks: no free source qualifies.** The email shows **no stock prices, % changes or index levels**. Stock coverage comes from GDELT headlines plus Gemini's narrative, and the prompt forbids stock numbers.
- **Crypto: CoinGecko Demo API**, one `/simple/price` call per run (~23/month of 10,000). We show price and 24 h % change for BTC, ETH, SOL, XRP, BNB and DOGE, with "Powered by CoinGecko" (14 px ≈ 10.5 pt) and the logo beside the table and in the footer. The use is non-commercial (free, no ads); anything commercial needs a paid CoinGecko plan.
- **Headlines: GDELT** (unlimited use with citation and a link to gdeltproject.org), unchanged.
- **GOOGLEFINANCE is removed from the design**, so it is no longer in the risk register.
