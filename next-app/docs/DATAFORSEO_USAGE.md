# DataForSEO API usage and cost control

This app uses DataForSEO for **Keywords Data API** and **DataForSEO Labs** (historical rank overview, ranked keywords, search intent). Below is how we reduce calls and cost.

## Where we call DataForSEO

| Feature | API / endpoint | When |
|--------|----------------|------|
| **Project Overview** (visibility, keywords, history, top keywords) | `keywords_data/google/keywords_for_site`, `historical_rank_overview`, `ranked_keywords`, optionally `search_intent` | Loading a project overview or clicking "Refresh" |
| **Keyword research** (ideas) | Labs keyword ideas | Submitting the keyword research form |

Each **full** overview request can trigger **3–4** DataForSEO calls (keywords for site, historical rank overview, ranked keywords, and search intent if needed).

## Optimizations in place

1. **Monthly cache (1 hour)**  
   Overview data is cached in memory for **1 hour** per domain + location. Repeated requests for the same project within that window are served from cache and do **not** call DataForSEO.

2. **Daily view reuses monthly cache**  
   When you switch the Performance chart to **Daily**, the app:
   - Reuses the **cached monthly** overview (keywords, visibility, top keywords).
   - Calls **only GA4** for the daily Organic Search series.
   - So **no** DataForSEO calls are made for daily view if monthly data was already loaded.

3. **Cache after full fetch**  
   After any full fetch (monthly or daily with no cache), we store the monthly overview in cache. So the next daily view can use that cache and only hit GA4.

4. **Intent in one batch**  
   Search intent is requested in a single batch (up to 100 keywords) when ranked keywords lack intent, instead of one call per keyword.

## How to reduce cost further

- Use **Refresh** only when you need fresh data; normal navigation uses cache.
- Prefer **Monthly** view when possible; switch to **Daily** when you need it (daily uses cache + GA4 only once monthly data exists).
- **Keyword research** runs only when you submit the form; it is not automatic.

## Cache TTL

Default overview cache TTL is **60 minutes** (`overview-cache.ts`). You can change `CACHE_TTL_MS` to balance freshness vs. API usage (e.g. 30 min for fresher data, 2 hours for fewer calls).
