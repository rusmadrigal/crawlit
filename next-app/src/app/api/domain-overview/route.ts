import { NextRequest } from "next/server";
import { isDataforseoConfigured, fetchKeywordsForSite, fetchHistoricalRankOverview, fetchRankedKeywords, fetchSearchIntent } from "@/lib/dataforseo";
import { getOverviewCached, setOverviewCached, invalidateOverviewCache } from "@/lib/overview-cache";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { fetchGa4OrganicSessionsDaily, fetchGa4OrganicSessionsMonthly, getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";
import {
  countDistinctQueriesLastNDays,
  mergeGscPagesIntoHistory,
  mergeGscQueriesIntoHistory,
} from "@/lib/gsc";

export type DomainOverviewApiResponse = {
  ok: boolean;
  configured: boolean;
  domain?: string;
  visibilityEtv?: number | null;
  organicCount?: number | null;
  /** Time series for Performance chart: { date, organicPages, organicTraffic, organicKeywords? } */
  history?: { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number }[];
  /** Set when historical_rank_overview failed (e.g. domain not in index, rate limit) */
  historyError?: string;
  /** Distinct ranking keywords (DataForSEO) or distinct search queries last 28 days (GSC when site linked). */
  keywordCount?: number;
  totalSearchVolume?: number;
  topKeywords?: { keyword: string; searchVolume: number; cpc?: number | null; position?: number | null; url?: string | null; keywordDifficulty?: number | null; intent?: string | null }[];
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
        cpc: k.cpc ?? null,
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
        fetchRankedKeywords(domain, locationCode).catch(() => [] as { keyword: string; searchVolume: number; cpc: number | null; position: number | null; url: string | null; keywordDifficulty: number | null; intent: string | null }[]),
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
      topKeywords =
        rankedRows.length > 0
          ? rankedRows.map((r) => ({
              keyword: r.keyword,
              searchVolume: r.searchVolume,
              cpc: r.cpc,
              position: r.position,
              url: r.url,
              keywordDifficulty: r.keywordDifficulty ?? null,
              intent: (r.intent?.trim() || intentByKeyword[r.keyword] || intentByKeyword[r.keyword.toLowerCase()] || null) as string | null,
            }))
          : (keywordsResult.topKeywords ?? []).map((k) => ({
              ...k,
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
    if (ga4PropertyId) {
      try {
        const refreshToken = await getGa4RefreshToken();
        if (refreshToken) {
          const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
          const lastOrganicCount = visibilityResult.organicCount ?? 0;
          const lastKeywordCount = keywordsResult.keywordCount ?? 0;
          if (granularity === "daily") {
            const gaDaily = await fetchGa4OrganicSessionsDaily({
              accessToken,
              propertyId: ga4PropertyId,
              days,
            });
            history = gaDaily.map((r) => ({
              date: r.date,
              organicPages: lastOrganicCount,
              organicTraffic: r.sessions,
              organicKeywords: gscSiteUrl ? 0 : lastKeywordCount,
            }));
          } else {
            // Request Organic Search sessions without country filter so the chart matches
            // GA4 "Traffic acquisition > Session primary channel group = Organic Search" (all countries).
            const gaSeries = await fetchGa4OrganicSessionsMonthly({
              accessToken,
              propertyId: ga4PropertyId,
              months: 24,
            });
            const gaByDate = new Map(gaSeries.map((r) => [r.date, r.sessions]));
            if (history.length > 0) {
              history = history.map((p) => ({
                ...p,
                organicTraffic: gaByDate.get(p.date) ?? 0,
              }));
            } else {
              history = gaSeries.map((r) => ({ date: r.date, organicPages: 0, organicTraffic: r.sessions }));
            }
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
