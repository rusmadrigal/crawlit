/**
 * Google Ads API - Keyword Plan (volume + competition).
 * Uses GenerateKeywordHistoricalMetrics. Requires:
 * - GOOGLE_ADS_DEVELOPER_TOKEN (env)
 * - OAuth with scope https://www.googleapis.com/auth/adwords (same as GA4/GSC)
 * - Google Ads customer ID (project-level)
 */

const GOOGLE_ADS_API_VERSION = "v18";
const API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export type KeywordVolumeAndCompetition = {
  searchVolume: number | null;
  competition: number | null; // 0-100, from competition_index
};

/**
 * Batch fetch search volume and competition for keywords via Google Ads API.
 * Returns map keyed by lowercase keyword. Uses GenerateKeywordHistoricalMetrics.
 */
export async function fetchKeywordVolumesAndCompetition(params: {
  accessToken: string;
  customerId: string;
  keywords: string[];
  geoTargetConstant: number;
  languageConstant?: number;
}): Promise<Map<string, KeywordVolumeAndCompetition>> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not set. Add it in .env for keyword volume/competition from Google Ads.");
  }

  const list = [...new Set(params.keywords.map((k) => k.trim()).filter((k) => k.length > 0))].slice(0, 8000);
  if (list.length === 0) return new Map();

  const customerIdClean = params.customerId.replace(/-/g, "");
  const languageConstant = params.languageConstant ?? 1000; // 1000 = English

  const body = {
    keywords: list,
    geoTargetConstants: [`geoTargetConstants/${params.geoTargetConstant}`],
    language: `languageConstants/${languageConstant}`,
    keywordPlanNetwork: "GOOGLE_SEARCH",
  };

  const url = `${API_BASE}/customers/${customerIdClean}:generateKeywordHistoricalMetrics`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim?.();
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: {
    results?: Array<{
      text?: string;
      keywordMetrics?: {
        avgMonthlySearches?: number | null;
        competitionIndex?: number | null;
        competition?: string;
      };
    }>;
    error?: { message?: string; code?: number };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Google Ads API returned HTML instead of JSON (status ${res.status}). ` +
        `Test developer tokens only work with test accounts. For production accounts (511-720-3937) request Basic Access. ` +
        `Response preview: ${preview}`
    );
  }

  if (!res.ok) {
    const msg = json.error?.message ?? `Google Ads API error ${res.status}`;
    throw new Error(msg);
  }

  const map = new Map<string, KeywordVolumeAndCompetition>();
  for (const r of json.results ?? []) {
    const kw = typeof r.text === "string" ? r.text.trim().toLowerCase() : "";
    if (!kw) continue;
    const metrics = r.keywordMetrics;
    // REST API returns int64 as string; parse both number and string
    const avgRaw = metrics?.avgMonthlySearches;
    let searchVolume: number | null = null;
    if (avgRaw != null) {
      const n = typeof avgRaw === "number" ? avgRaw : (typeof avgRaw === "string" ? parseInt(avgRaw, 10) : NaN);
      if (!Number.isNaN(n) && n >= 0) searchVolume = n;
    }
    const compRaw = metrics?.competitionIndex;
    let competition: number | null = null;
    if (compRaw != null) {
      const n = typeof compRaw === "number" ? compRaw : (typeof compRaw === "string" ? parseInt(compRaw, 10) : NaN);
      if (!Number.isNaN(n)) competition = Math.min(100, Math.max(0, n));
    } else if (metrics?.competition) {
      const m: Record<string, number> = { LOW: 25, MEDIUM: 50, HIGH: 75 };
      competition = m[metrics.competition] ?? null;
    }
    map.set(kw, { searchVolume, competition });
  }
  return map;
}

export function isGoogleAdsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim());
}
