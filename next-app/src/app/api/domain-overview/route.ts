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
import { getOverviewCached, setOverviewCached, invalidateOverviewCache } from "@/lib/overview-cache";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { fetchGa4OrganicSessionsDaily, fetchGa4OrganicSessionsMonthly, getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";
import {
  countDistinctQueriesLastNDays,
  fetchGscBestPagePerQueryInRange,
  fetchGscTopQueriesPositionHistories,
  fetchTopQueriesFromGsc,
  gscDateRangeLastNDays,
  mergeGscPagesIntoHistory,
  mergeGscQueriesIntoHistory,
} from "@/lib/gsc";

/** GA4 Organic Search sessions: last full month vs same month last year, for YoY widget. */
export type Ga4OrganicTrafficYoY = {
  lastMonthSessions: number;
  sameMonthLastYearSessions: number;
  changePercent: number; // e.g. 5.3 or -2.1
};

export type DomainOverviewApiResponse = {
  ok: boolean;
  configured: boolean;
  domain?: string;
  visibilityEtv?: number | null;
  organicCount?: number | null;
  /** GA4 Organic Search YoY (last month vs same month last year). Only when GA4 connected. */
  ga4OrganicTrafficYoY?: Ga4OrganicTrafficYoY | null;
  /** Time series for Performance chart: { date, organicPages, organicTraffic, organicKeywords? } */
  history?: { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number }[];
  /** Set when historical_rank_overview failed (e.g. domain not in index, rate limit) */
  historyError?: string;
  /** Distinct ranking keywords (DataForSEO) or distinct search queries last 28 days (GSC when site linked). */
  keywordCount?: number;
  totalSearchVolume?: number;
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
  /** True when rows are ordered from GSC (last 28d, by clicks); volume from DataForSEO Google Ads; intent/KD from DataForSEO. */
  topKeywordsFromGsc?: boolean;
  cached?: boolean;
  error?: string;
};

export async function GET(request: NextRequest) {
  const configured = isDataforseoConfigured();
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get("domain")?.trim();
  const refresh = searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";
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

  if (refresh) {
    invalidateOverviewCache(domain, locationCode);
  }

  // Always try monthly cache first: for daily view we reuse it and only fetch GA4 (saves DataForSEO calls).
  const cachedMonthly = getOverviewCached<DomainOverviewApiResponse>(domain, locationCode);
  const useCacheForResponse = granularity === "monthly" && !refresh && cachedMonthly?.keywordCount !== undefined;

  if (useCacheForResponse && cachedMonthly && !gscSiteUrl) {
    return Response.json({ ...cachedMonthly, cached: true });
  }

  async function tryApplySearchConsole(payload: DomainOverviewApiResponse): Promise<string | undefined> {
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
          const intentQueries = queries.filter((q) => q.trim().length >= 3);

          const [volSettled, intentSettled, pagesSettled, kdSettled] = await Promise.allSettled([
            fetchKeywordSearchVolumes(queries, locationCode, "en"),
            fetchSearchIntent(intentQueries, "en"),
            fetchGscBestPagePerQueryInRange({
              accessToken,
              siteUrl: gscSiteUrl,
              startDate,
              endDate,
              queries,
            }),
            fetchKeywordDifficulties(queries, locationCode, "en"),
          ]);
          const volumeByKeyword =
            volSettled.status === "fulfilled"
              ? volSettled.value
              : new Map<string, { searchVolume: number | null; cpc: number | null }>();
          const intentByKeyword = intentSettled.status === "fulfilled" ? intentSettled.value : {};
          const pageByQuery =
            pagesSettled.status === "fulfilled" ? pagesSettled.value : new Map<string, string>();
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
            const searchVolume =
              vol?.searchVolume != null ? vol.searchVolume : r.impressions;
            const landing = pageByQuery.get(key) ?? null;
            const positionHistory = positionHistories.get(key) ?? [];
            return {
              keyword: r.query,
              searchVolume,
              position: Math.round(r.position * 10) / 10,
              url: landing,
              keywordDifficulty: kdByKeyword.get(key) ?? null,
              intent: (intentByKeyword[r.query] ?? intentByKeyword[r.query.toLowerCase()] ?? null) as string | null,
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
    const gscErr = await tryApplySearchConsole(payload);
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
    let ga4OrganicTrafficYoY: DomainOverviewApiResponse["ga4OrganicTrafficYoY"] = null;
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
            ga4OrganicTrafficYoY = {
              lastMonthSessions: curr,
              sameMonthLastYearSessions: prev,
              changePercent,
            };
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
      ga4OrganicTrafficYoY,
      history,
      historyError: visibilityResult.historyError || ga4TrafficError,
      keywordCount: keywordsResult.keywordCount,
      totalSearchVolume: keywordsResult.totalSearchVolume,
      topKeywords: topKeywords ?? [],
      cached: false,
    };
    // After any full fetch, cache monthly data so daily view can reuse it (saves DataForSEO calls).
    // Clone before caching so Search Console merges below do not mutate the cached snapshot.
    if (!usedCachedForDaily) {
      const toCache: DomainOverviewApiResponse =
        granularity === "monthly"
          ? payload
          : {
              ...payload,
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
      setOverviewCached(domain, structuredClone(toCache), undefined, locationCode);
    }
    const gscErr = await tryApplySearchConsole(payload);
    if (gscErr) {
      payload.historyError = [payload.historyError, gscErr].filter(Boolean).join(" ");
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
