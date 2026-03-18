import { NextRequest } from "next/server";
import { isDataforseoConfigured, fetchKeywordsForSite, fetchHistoricalRankOverview, fetchRankedKeywords, fetchSearchIntent } from "@/lib/dataforseo";
import { getOverviewCached, setOverviewCached, invalidateOverviewCache } from "@/lib/overview-cache";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";

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

  const cached = getOverviewCached<DomainOverviewApiResponse>(domain, locationCode);
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

    let history = visibilityResult.history ?? [];
    if (history.length > 0 && keywordsResult.keywordCount != null) {
      history = [...history];
      const last = history[history.length - 1];
      history[history.length - 1] = { ...last, organicKeywords: keywordsResult.keywordCount };
    }
    const payload: DomainOverviewApiResponse = {
      ok: true,
      configured: true,
      domain,
      visibilityEtv: visibilityResult.visibilityEtv,
      organicCount: visibilityResult.organicCount,
      history,
      historyError: visibilityResult.historyError,
      keywordCount: keywordsResult.keywordCount,
      totalSearchVolume: keywordsResult.totalSearchVolume,
      topKeywords,
      cached: false,
    };
    setOverviewCached(domain, payload, undefined, locationCode);
    return Response.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch domain overview";
    return Response.json(
      { ok: false, configured: true, domain, error: message } satisfies DomainOverviewApiResponse,
      { status: 500 }
    );
  }
}
