import { NextRequest } from "next/server";
import { isDataforseoConfigured, fetchKeywordsForSite, fetchHistoricalRankOverview, fetchRankedKeywords, fetchSearchIntent } from "@/lib/dataforseo";
import { getOverviewCached, setOverviewCached, invalidateOverviewCache } from "@/lib/overview-cache";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { fetchGa4OrganicSessionsDaily, fetchGa4OrganicSessionsMonthly, getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";

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

  const useCache = granularity === "monthly";
  const cached = useCache ? getOverviewCached<DomainOverviewApiResponse>(domain, locationCode) : null;
  if (!refresh && cached && cached.keywordCount !== undefined) {
    return Response.json({ ...cached, cached: true });
  }

  try {
    const [keywordsResult, visibilityResult, rankedRows] = await Promise.all([
      fetchKeywordsForSite(domain, locationCode),
      fetchHistoricalRankOverview(domain, locationCode).then((r) => ({ ...r, historyError: undefined as string | undefined })).catch((err) => ({
        visibilityEtv: null as number | null,
        organicCount: null as number | null,
        history: [] as { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number }[],
        historyError: err instanceof Error ? err.message : "Failed to load historical data",
      })),
      fetchRankedKeywords(domain, locationCode).catch(() => [] as { keyword: string; searchVolume: number; cpc: number | null; position: number | null; url: string | null; keywordDifficulty: number | null; intent: string | null }[]),
    ]);

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

    const topKeywords =
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

    let history: NonNullable<DomainOverviewApiResponse["history"]> = (visibilityResult.history ?? []) as NonNullable<DomainOverviewApiResponse["history"]>;
    if (history.length > 0 && keywordsResult.keywordCount != null) {
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
              organicKeywords: lastKeywordCount,
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
      topKeywords,
      cached: false,
    };
    if (useCache) setOverviewCached(domain, payload, undefined, locationCode);
    return Response.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch domain overview";
    return Response.json(
      { ok: false, configured: true, domain, error: message } satisfies DomainOverviewApiResponse,
      { status: 500 }
    );
  }
}
