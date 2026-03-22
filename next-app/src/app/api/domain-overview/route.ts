import { NextRequest } from "next/server";
import {
  isDataforseoConfigured,
  fetchKeywordDifficulties,
  fetchKeywordSearchVolumes,
  fetchKeywordsForSite,
  fetchHistoricalRankOverview,
  fetchRankedKeywords,
  fetchSearchIntent,
} from "@/lib/dataforseo";
import {
  getOverviewCachedAsync,
  setOverviewCachedAsync,
  invalidateOverviewCacheAsync,
} from "@/lib/overview-cache";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { fetchGa4OrganicSessionsDaily, fetchGa4OrganicSessionsMonthly, getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";
import {
  countDistinctQueriesLastNDays,
  fetchGscBestPagePerQueryInRange,
  fetchGscSiteWideCtr,
  fetchGscTopQueriesPositionHistories,
  fetchTopQueriesFromGsc,
  gscDateRangeLastNDays,
  lastDayOfMonthUtc,
  mergeGscPagesIntoHistory,
  mergeGscQueriesIntoHistory,
} from "@/lib/gsc";

/** Organic traffic YoY: last full month vs same month last year. From GA4 (sessions) or GSC (clicks). */
export type OrganicTrafficYoY = {
  lastMonth: number;
  sameMonthLastYear: number;
  changePercent: number; // e.g. 5.3 or -2.1
  source: "ga4" | "gsc";
};

export type DomainOverviewApiResponse = {
  ok: boolean;
  configured: boolean;
  domain?: string;
  visibilityEtv?: number | null;
  organicCount?: number | null;
  /** Organic traffic YoY: from GSC (clicks) when connected, else GA4 (sessions). */
  organicTrafficYoY?: OrganicTrafficYoY | null;
  /** Time series for Performance chart: { date, organicPages, organicTraffic, organicKeywords? } */
  history?: { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number }[];
  /** Set when historical_rank_overview failed (e.g. domain not in index, rate limit) */
  historyError?: string;
  /** Distinct ranking keywords (DataForSEO) or distinct search queries last 28 days (GSC when site linked). */
  keywordCount?: number;
  totalSearchVolume?: number;
  /** GSC site-wide CTR (last 28 days), percentage e.g. 2.34. Only when GSC connected. */
  gscCtr?: number | null;
  topKeywords?: {
    keyword: string;
    searchVolume: number;
    position?: number | null;
    url?: string | null;
    keywordDifficulty?: number | null;
    intent?: string | null;
    /** Daily average position (GSC), oldest→newest; same window as top queries (e.g. 28d). */
    positionHistory?: number[];
  }[];
  /** True when rows are ordered from GSC (last 28d, by clicks); volume/KD/intent from DataForSEO (or cache when API off). */
  topKeywordsFromGsc?: boolean;
  cached?: boolean;
  error?: string;
};

export async function GET(request: NextRequest) {
  const configured = isDataforseoConfigured();
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get("domain")?.trim();
  const refresh = searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";
  const dataforseoEnabled = searchParams.get("dataforseo_enabled") !== "0";
  const locationCode = Math.floor(Number(searchParams.get("location_code")) || DEFAULT_LOCATION_CODE);
  const ga4PropertyId = searchParams.get("ga4_property_id")?.trim() || null;
  const gscSiteUrl = searchParams.get("gsc_site_url")?.trim() || null;
  const granularity = (searchParams.get("granularity")?.trim() || "monthly") as "monthly" | "daily";
  const daysParam = searchParams.get("days");
  const days = Math.min(366, Math.max(1, Math.floor(Number(daysParam)) || 90));

  if (!domain) {
    return Response.json(
      { ok: false, configured, error: "Missing domain" } satisfies DomainOverviewApiResponse,
      { status: 400 }
    );
  }

  if (!configured) {
    return Response.json(
      { ok: false, configured: false, domain, error: "DataForSEO not configured" } satisfies DomainOverviewApiResponse
    );
  }

  // When DataForSEO API is disabled (client preference): use cache or build from GSC/GA4 only.
  if (!dataforseoEnabled) {
    const cached = await getOverviewCachedAsync<DomainOverviewApiResponse>(domain, locationCode);
    if (cached && cached.keywordCount !== undefined) {
      const payload: DomainOverviewApiResponse = {
        ...cached,
        history: cached.history ? cached.history.map((h) => ({ ...h })) : undefined,
      };
      const gscErr = await tryApplySearchConsole(payload, true);
      if (gscErr) {
        payload.historyError = [payload.historyError, gscErr].filter(Boolean).join(" ");
      }
      return Response.json({ ...payload, cached: true });
    }
    // No cache: build payload from GSC and/or GA4 so the dashboard still shows data.
    if (ga4PropertyId || gscSiteUrl) {
      let history: NonNullable<DomainOverviewApiResponse["history"]> = [];
      let organicTrafficYoY: DomainOverviewApiResponse["organicTrafficYoY"] = null;
      let historyError: string | undefined;
      if (ga4PropertyId) {
        try {
          const refreshToken = await getGa4RefreshToken();
          if (refreshToken) {
            const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
            const gaMonthly = await fetchGa4OrganicSessionsMonthly({
              accessToken,
              propertyId: ga4PropertyId,
              months: 24,
            });
            history = gaMonthly.map((r) => ({ date: r.date, organicPages: 0, organicTraffic: r.sessions }));
            const lastMonth = gaMonthly[gaMonthly.length - 1];
            const sameMonthLastYear = gaMonthly.find((r) => {
              const [y, m] = r.date.split("-").map(Number);
              if (!lastMonth) return false;
              const [ly, lm] = lastMonth.date.split("-").map(Number);
              return y === ly - 1 && m === lm;
            });
            if (lastMonth && sameMonthLastYear) {
              const prev = sameMonthLastYear.sessions;
              const curr = lastMonth.sessions;
              const changePercent = prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);
              organicTrafficYoY = { lastMonth: curr, sameMonthLastYear: prev, changePercent, source: "ga4" };
            }
          }
        } catch (gaErr) {
          historyError = gaErr instanceof Error ? gaErr.message : "Failed to load GA4 traffic";
        }
      }
      if (history.length === 0 && gscSiteUrl) {
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          const y = d.getUTCFullYear();
          const m = d.getUTCMonth() + 1;
          history.push({ date: `${y}-${String(m).padStart(2, "0")}-01`, organicPages: 0, organicTraffic: 0 });
        }
      }
      const payload: DomainOverviewApiResponse = {
        ok: true,
        configured: true,
        domain,
        visibilityEtv: null,
        organicCount: null,
        organicTrafficYoY: organicTrafficYoY ?? undefined,
        history,
        historyError,
        keywordCount: undefined,
        totalSearchVolume: undefined,
        topKeywords: [],
        cached: false,
      };
      const gscErr = await tryApplySearchConsole(payload, true);
      if (gscErr) {
        payload.historyError = [payload.historyError, gscErr].filter(Boolean).join(" ");
      }
      return Response.json(payload);
    }
    return Response.json(
      {
        ok: false,
        configured: true,
        domain,
        error: "DataForSEO API is disabled. Connect GA4 or GSC to see data without the API, or enable it in Settings.",
      } satisfies DomainOverviewApiResponse,
      { status: 200 }
    );
  }

  if (refresh) {
    await invalidateOverviewCacheAsync(domain, locationCode);
  }

  // Always try monthly cache first: for daily view we reuse it and only fetch GA4 (saves DataForSEO calls).
  const cachedMonthly = await getOverviewCachedAsync<DomainOverviewApiResponse>(domain, locationCode);
  const useCacheForResponse = granularity === "monthly" && !refresh && cachedMonthly?.keywordCount !== undefined;

  if (useCacheForResponse && cachedMonthly && !gscSiteUrl) {
    return Response.json({ ...cachedMonthly, cached: true });
  }

  async function tryApplySearchConsole(payload: DomainOverviewApiResponse, skipDataforseo = false): Promise<string | undefined> {
    if (!gscSiteUrl || !payload.history?.length) return undefined;
    try {
      const refreshToken = await getGa4RefreshToken();
      if (!refreshToken) {
        return "Search Console: connect Google (Connect GA4) and grant Search Console access.";
      }
      const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
      payload.history = await mergeGscPagesIntoHistory({
        accessToken,
        siteUrl: gscSiteUrl,
        history: payload.history,
        granularity,
      });
      payload.history = await mergeGscQueriesIntoHistory({
        accessToken,
        siteUrl: gscSiteUrl,
        history: payload.history,
        granularity,
      });
      payload.keywordCount = await countDistinctQueriesLastNDays({
        accessToken,
        siteUrl: gscSiteUrl,
        days: 28,
      });

      try {
        const { startDate, endDate } = gscDateRangeLastNDays(28);
        const ctrResult = await fetchGscSiteWideCtr({ accessToken, siteUrl: gscSiteUrl, startDate, endDate });
        payload.gscCtr = ctrResult?.ctr ?? null;
      } catch {
        payload.gscCtr = null;
      }

      try {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const lastMonthY = m === 0 ? y - 1 : y;
        const lastMonthM = m === 0 ? 12 : m;
        const lastMonthStart = `${lastMonthY}-${String(lastMonthM).padStart(2, "0")}-01`;
        const sameMonthLastYearStart = `${lastMonthY - 1}-${String(lastMonthM).padStart(2, "0")}-01`;
        const [lastMonthResult, sameMonthLastYearResult] = await Promise.all([
          fetchGscSiteWideCtr({
            accessToken,
            siteUrl: gscSiteUrl,
            startDate: lastMonthStart,
            endDate: lastDayOfMonthUtc(lastMonthStart),
          }),
          fetchGscSiteWideCtr({
            accessToken,
            siteUrl: gscSiteUrl,
            startDate: sameMonthLastYearStart,
            endDate: lastDayOfMonthUtc(sameMonthLastYearStart),
          }),
        ]);
        const curr = lastMonthResult?.clicks ?? 0;
        const prev = sameMonthLastYearResult?.clicks ?? 0;
        const changePercent = prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);
        payload.organicTrafficYoY = { lastMonth: curr, sameMonthLastYear: prev, changePercent, source: "gsc" };
      } catch {
        // keep existing organicTrafficYoY from GA4 if any
      }

      try {
        const { startDate, endDate } = gscDateRangeLastNDays(28);
        const raw = await fetchTopQueriesFromGsc({
          accessToken,
          siteUrl: gscSiteUrl,
          startDate,
          endDate,
          rowLimit: 25,
        });
        const top = raw.slice(0, 20);
        if (top.length === 0) {
          payload.topKeywords = [];
          payload.topKeywordsFromGsc = true;
        } else {
          const queries = top.map((r) => r.query);

          const cachedByKw = new Map<string, { searchVolume: number; keywordDifficulty: number | null; intent: string | null }>();
          for (const row of payload.topKeywords ?? []) {
            const k = row.keyword?.trim().toLowerCase();
            if (k && (row.searchVolume != null || row.keywordDifficulty != null || row.intent != null)) {
              cachedByKw.set(k, {
                searchVolume: typeof row.searchVolume === "number" ? row.searchVolume : 0,
                keywordDifficulty: row.keywordDifficulty ?? null,
                intent: row.intent ?? null,
              });
            }
          }
          const [pagesSettled, volSettled, intentSettled, kdSettled] = skipDataforseo
            ? await Promise.allSettled([
                fetchGscBestPagePerQueryInRange({
                  accessToken,
                  siteUrl: gscSiteUrl,
                  startDate,
                  endDate,
                  queries,
                }),
                Promise.resolve(new Map<string, { searchVolume: number | null; cpc: number | null }>()),
                Promise.resolve({} as Record<string, string>),
                Promise.resolve(new Map<string, number>()),
              ])
            : await Promise.allSettled([
                fetchGscBestPagePerQueryInRange({
                  accessToken,
                  siteUrl: gscSiteUrl,
                  startDate,
                  endDate,
                  queries,
                }),
                fetchKeywordSearchVolumes(queries, locationCode, "en"),
                fetchSearchIntent(queries.filter((q) => q.trim().length >= 3), "en"),
                fetchKeywordDifficulties(queries, locationCode, "en"),
              ]);
          const pageByQuery = pagesSettled.status === "fulfilled" ? pagesSettled.value : new Map<string, string>();
          const volumeByKeyword =
            volSettled.status === "fulfilled"
              ? volSettled.value
              : new Map<string, { searchVolume: number | null; cpc: number | null }>();
          const intentByKeyword = intentSettled.status === "fulfilled" ? intentSettled.value : {};
          const kdByKeyword = kdSettled.status === "fulfilled" ? kdSettled.value : new Map<string, number>();

          let positionHistories = new Map<string, number[]>();
          try {
            positionHistories = await fetchGscTopQueriesPositionHistories({
              accessToken,
              siteUrl: gscSiteUrl,
              startDate,
              endDate,
              queries,
              concurrency: 4,
            });
          } catch {
            // Per-query handler already fills empty series; keep map empty on total failure
          }

          payload.topKeywords = top.map((r) => {
            const key = r.query.trim().toLowerCase();
            const vol = volumeByKeyword.get(key);
            const cached = cachedByKw.get(key);
            const searchVolume =
              vol?.searchVolume != null
                ? vol.searchVolume
                : cached?.searchVolume != null
                  ? cached.searchVolume
                  : r.impressions;
            const landing = pageByQuery.get(key) ?? null;
            const positionHistory = positionHistories.get(key) ?? [];
            const kd = kdByKeyword.get(key) ?? cached?.keywordDifficulty ?? null;
            const intent =
              (intentByKeyword[r.query] ?? intentByKeyword[r.query.toLowerCase()] ?? cached?.intent ?? null) as string | null;
            return {
              keyword: r.query,
              searchVolume,
              position: Math.round(r.position * 10) / 10,
              url: landing,
              keywordDifficulty: kd,
              intent,
              positionHistory,
            };
          });
          payload.topKeywordsFromGsc = true;
        }
      } catch {
        // Keep DataForSEO-backed topKeywords already on the payload
      }
      return undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search Console request failed";
      if (/403|insufficient|permission/i.test(msg)) {
        return "Search Console: reconnect Google and approve Search Console (webmasters) permission.";
      }
      return `Search Console: ${msg}`;
    }
  }

  if (useCacheForResponse && cachedMonthly && gscSiteUrl) {
    const payload: DomainOverviewApiResponse = {
      ...cachedMonthly,
      history: cachedMonthly.history ? cachedMonthly.history.map((h) => ({ ...h })) : undefined,
    };
    // skipDataforseo=true: cache already has volume/KD/intent; only refresh GSC position/URL
    const gscErr = await tryApplySearchConsole(payload, true);
    if (gscErr) {
      payload.historyError = [payload.historyError, gscErr].filter(Boolean).join(" ");
    }
    return Response.json({ ...payload, cached: true });
  }

  try {
    let keywordsResult: Awaited<ReturnType<typeof fetchKeywordsForSite>>;
    let visibilityResult: { visibilityEtv: number | null; organicCount: number | null; history?: { date: string; organicPages: number; organicTraffic: number }[]; historyError?: string };
    let rankedRows: Awaited<ReturnType<typeof fetchRankedKeywords>>;
    let topKeywords: DomainOverviewApiResponse["topKeywords"];

    if (granularity === "daily" && !refresh && cachedMonthly && cachedMonthly.keywordCount !== undefined) {
      // Reuse cached monthly data — no DataForSEO calls. Only GA4 daily will be fetched below for history.
      keywordsResult = {
        keywordCount: cachedMonthly.keywordCount,
        totalSearchVolume: cachedMonthly.totalSearchVolume ?? 0,
        topKeywords: cachedMonthly.topKeywords ?? [],
      };
      visibilityResult = {
        visibilityEtv: cachedMonthly.visibilityEtv ?? null,
        organicCount: cachedMonthly.organicCount ?? null,
        history: [],
        historyError: undefined,
      };
      rankedRows = (cachedMonthly.topKeywords ?? []).map((k) => ({
        keyword: k.keyword,
        searchVolume: k.searchVolume,
        cpc: null as number | null,
        position: k.position ?? null,
        url: k.url ?? null,
        keywordDifficulty: k.keywordDifficulty ?? null,
        intent: k.intent ?? null,
      }));
      topKeywords = cachedMonthly.topKeywords;
    } else {
      const [kwResult, visResult, ranked] = await Promise.all([
        fetchKeywordsForSite(domain, locationCode),
        fetchHistoricalRankOverview(domain, locationCode).then((r) => ({ ...r, historyError: undefined as string | undefined })).catch((err) => ({
          visibilityEtv: null as number | null,
          organicCount: null as number | null,
          history: [] as { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number }[],
          historyError: err instanceof Error ? err.message : "Failed to load historical data",
        })),
        gscSiteUrl
          ? Promise.resolve(
              [] as {
                keyword: string;
                searchVolume: number;
                cpc: number | null;
                position: number | null;
                url: string | null;
                keywordDifficulty: number | null;
                intent: string | null;
              }[]
            )
          : fetchRankedKeywords(domain, locationCode).catch(
              () =>
                [] as {
                  keyword: string;
                  searchVolume: number;
                  cpc: number | null;
                  position: number | null;
                  url: string | null;
                  keywordDifficulty: number | null;
                  intent: string | null;
                }[]
            ),
      ]);
      keywordsResult = kwResult;
      visibilityResult = visResult;
      rankedRows = ranked;
      topKeywords = undefined; // will be computed below from rankedRows
    }

    const usedCachedForDaily = granularity === "daily" && !refresh && cachedMonthly?.keywordCount !== undefined;
    if (!usedCachedForDaily) {
      let intentByKeyword: Record<string, string> = {};
      if (rankedRows.length > 0) {
        const needIntent = rankedRows.filter((r) => !r.intent?.trim()).map((r) => r.keyword);
        if (needIntent.length > 0) {
          try {
            intentByKeyword = await fetchSearchIntent(needIntent, "en");
          } catch {
            // keep empty map
          }
        }
      }
      topKeywords = gscSiteUrl
        ? (keywordsResult.topKeywords ?? []).map((k) => ({
            keyword: k.keyword,
            searchVolume: k.searchVolume,
            position: null as number | null,
            url: null as string | null,
            keywordDifficulty: null as number | null,
            intent: null as string | null,
          }))
        : rankedRows.length > 0
          ? rankedRows.map((r) => ({
              keyword: r.keyword,
              searchVolume: r.searchVolume,
              position: r.position,
              url: r.url,
              keywordDifficulty: r.keywordDifficulty ?? null,
              intent: (r.intent?.trim() || intentByKeyword[r.keyword] || intentByKeyword[r.keyword.toLowerCase()] || null) as string | null,
            }))
          : (keywordsResult.topKeywords ?? []).map((k) => ({
              keyword: k.keyword,
              searchVolume: k.searchVolume,
              position: null as number | null,
              url: null as string | null,
              keywordDifficulty: null as number | null,
              intent: null as string | null,
            }));
    }

    let history: NonNullable<DomainOverviewApiResponse["history"]> = (visibilityResult.history ?? []) as NonNullable<DomainOverviewApiResponse["history"]>;
    if (history.length > 0 && keywordsResult.keywordCount != null && !gscSiteUrl) {
      history = [...history];
      const last = history[history.length - 1];
      history[history.length - 1] = { ...last, organicKeywords: keywordsResult.keywordCount };
    }

    // Replace organicTraffic with GA4 Organic Search sessions when GA4 is connected.
    let ga4TrafficError: string | undefined = undefined;
    let organicTrafficYoY: DomainOverviewApiResponse["organicTrafficYoY"] = null;
    if (ga4PropertyId) {
      try {
        const refreshToken = await getGa4RefreshToken();
        if (refreshToken) {
          const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
          const lastOrganicCount = visibilityResult.organicCount ?? 0;
          const lastKeywordCount = keywordsResult.keywordCount ?? 0;

          // Always fetch monthly for MoM widget (last month vs previous month).
          let gaMonthly: { date: string; sessions: number }[];
          let gaDailyOrNull: { date: string; sessions: number }[] | null = null;
          if (granularity === "daily") {
            const [monthly, daily] = await Promise.all([
              fetchGa4OrganicSessionsMonthly({ accessToken, propertyId: ga4PropertyId, months: 24 }),
              fetchGa4OrganicSessionsDaily({ accessToken, propertyId: ga4PropertyId, days }),
            ]);
            gaMonthly = monthly;
            gaDailyOrNull = daily;
          } else {
            gaMonthly = await fetchGa4OrganicSessionsMonthly({
              accessToken,
              propertyId: ga4PropertyId,
              months: 24,
            });
          }

          if (granularity === "daily" && gaDailyOrNull) {
            history = gaDailyOrNull.map((r) => ({
              date: r.date,
              organicPages: lastOrganicCount,
              organicTraffic: r.sessions,
              organicKeywords: gscSiteUrl ? 0 : lastKeywordCount,
            }));
          } else {
            const gaByDate = new Map(gaMonthly.map((r) => [r.date, r.sessions]));
            if (history.length > 0) {
              history = history.map((p) => ({
                ...p,
                organicTraffic: gaByDate.get(p.date) ?? 0,
              }));
            } else {
              history = gaMonthly.map((r) => ({ date: r.date, organicPages: 0, organicTraffic: r.sessions }));
            }
          }

          // Compute YoY: last full month vs same month last year.
          const lastMonth = gaMonthly[gaMonthly.length - 1];
          const sameMonthLastYear = gaMonthly.find((r) => {
            const [y, m] = r.date.split("-").map(Number);
            if (!lastMonth) return false;
            const [ly, lm] = lastMonth.date.split("-").map(Number);
            return y === ly - 1 && m === lm;
          });
          if (lastMonth && sameMonthLastYear) {
            const prev = sameMonthLastYear.sessions;
            const curr = lastMonth.sessions;
            const changePercent = prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);
            organicTrafficYoY = { lastMonth: curr, sameMonthLastYear: prev, changePercent, source: "ga4" };
          }
        }
      } catch (gaErr) {
        ga4TrafficError = gaErr instanceof Error ? gaErr.message : "Failed to load GA4 traffic";
      }
    } else if (granularity === "daily") {
      history = [];
      ga4TrafficError = "Connect GA4 to see daily Organic Search sessions.";
    }
    const payload: DomainOverviewApiResponse = {
      ok: true,
      configured: true,
      domain,
      visibilityEtv: visibilityResult.visibilityEtv,
      organicCount: visibilityResult.organicCount,
      organicTrafficYoY: organicTrafficYoY ?? undefined,
      history,
      historyError: visibilityResult.historyError || ga4TrafficError,
      keywordCount: keywordsResult.keywordCount,
      totalSearchVolume: keywordsResult.totalSearchVolume,
      topKeywords: topKeywords ?? [],
      cached: false,
    };
    const gscErr = await tryApplySearchConsole(payload, false);
    if (gscErr) {
      payload.historyError = [payload.historyError, gscErr].filter(Boolean).join(" ");
    }
    // Cache AFTER GSC enrichment so cached data includes volume/KD/intent + GSC position/URL.
    // Persists to DB so it survives when DataForSEO API is turned off or serverless cold starts.
    if (!usedCachedForDaily) {
      const toCache: DomainOverviewApiResponse =
        granularity === "monthly"
          ? structuredClone(payload)
          : {
              ...structuredClone(payload),
              history: (() => {
                const h = (visibilityResult.history ?? []) as NonNullable<DomainOverviewApiResponse["history"]>;
                if (h.length > 0 && keywordsResult.keywordCount != null && !gscSiteUrl) {
                  const out = [...h];
                  const last = out[out.length - 1];
                  out[out.length - 1] = { ...last, organicKeywords: keywordsResult.keywordCount };
                  return out;
                }
                return h;
              })(),
            };
      await setOverviewCachedAsync(domain, toCache, undefined, locationCode);
    }
    return Response.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch domain overview";
    return Response.json(
      { ok: false, configured: true, domain, error: message } satisfies DomainOverviewApiResponse,
      { status: 500 }
    );
  }
}
