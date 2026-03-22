# DataForSEO API usage and cost control

This app uses DataForSEO for **Keywords Data API** and **DataForSEO Labs** (historical rank overview, ranked keywords, search intent). Below is how we reduce calls and cost.

## Where we call DataForSEO

| Feature | API / endpoint | When |
|--------|----------------|------|
| **Project Overview** (visibility, keywords, history, top keywords) | `keywords_data/google/keywords_for_site`, `historical_rank_overview`, `ranked_keywords`, optionally `search_intent` | Loading a project (first time) or clicking "Refresh" |
| **Keyword research** (ideas) | Labs keyword ideas | Submitting the keyword research form |

Each **full** overview request can trigger **3–4** DataForSEO calls (keywords for site, historical rank overview, ranked keywords, and search intent if needed).

## Optimizations in place

1. **Monthly cache (4 hours)**  
   Overview data is cached in memory and DB for **4 hours** per domain + location. Repeated requests for the same project within that window are served from cache and do **not** call DataForSEO.  
   **Note:** Cache is also persisted in the database so it survives serverless cold starts.

2. **Daily view reuses monthly cache**  
   When you switch the Performance chart to **Daily**, the app:
   - Reuses the **cached monthly** overview (keywords, visibility, top keywords).
   - Calls **only GA4** for the daily Organic Search series.
   - So **no** DataForSEO calls are made for daily view if monthly data was already loaded.

3. **Cache after full fetch**  
   After any full fetch (monthly or daily with no cache), we store the monthly overview in cache. So the next daily view can use that cache and only hit GA4.

4. **Intent in one batch**  
   Search intent is requested in a single batch (up to 100 keywords) when ranked keywords lack intent, instead of one call per keyword.

5. **Refresh cooldown (2 minutes)**  
   The Refresh button is disabled for 2 minutes after use to prevent accidental repeated DataForSEO calls.

6. **No auto-fetch on view change**  
   Switching between Monthly/Daily or 12m/2y does *not* trigger a new fetch. Data updates only on initial project load or when you click Refresh. If the current view doesn't match the loaded data, a Refresh link is shown.

7. **Reduced ranked keywords limit**  
   Ranked keywords are limited to 50 per request (was 100) to lower cost per overview.

## How to reduce cost further

- Use **Refresh** only when you need fresh data; normal navigation uses cache.
- Prefer **Monthly** view when possible; switch to **Daily** when you need it (daily uses cache + GA4 only once monthly data exists).
- **Keyword research** runs only when you submit the form; it is not automatic.
- For production, the **DB-backed cache** already persists across serverless cold starts.

## Cache TTL

Default overview cache TTL is **4 hours** (`overview-cache.ts`). You can change `CACHE_TTL_MS` to balance freshness vs. API usage (e.g. 2 hours for fewer calls, 6 hours for minimal usage).
