import {
  DataforseoLabsApi,
  DataforseoLabsGoogleKeywordIdeasLiveRequestInfo,
} from "dataforseo-client";

const API_BASE = "https://api.dataforseo.com";

function getApiKey(): string {
  const key = process.env.DATAFORSEO_API_KEY?.trim();
  if (!key) {
    throw new Error("DATAFORSEO_API_KEY is not set. Add it to .env.local.");
  }
  return key;
}

function createAuthenticatedFetch() {
  const apiKey = getApiKey();
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Basic ${apiKey}`);
    return fetch(url, { ...init, headers });
  };
}

export function isDataforseoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_API_KEY?.trim());
}

export type KeywordResearchItem = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  competition: number | null;
  intent: string | null;
  monthlySearches: { year: number; month: number; searchVolume: number }[];
};

function mapItem(item: Record<string, unknown>): KeywordResearchItem {
  const keyword = typeof item.keyword === "string" ? item.keyword : "";
  const keywordInfo = (item.keyword_info ?? item.keyword_info_normalized_with_clickstream) as Record<string, unknown> | undefined;
  const searchVolume = typeof keywordInfo?.search_volume === "number" ? keywordInfo.search_volume : null;
  const cpc = typeof keywordInfo?.cpc === "number" ? keywordInfo.cpc : null;
  const competition = typeof keywordInfo?.competition === "number" ? keywordInfo.competition : null;
  const monthlySearches = Array.isArray(keywordInfo?.monthly_searches)
    ? (keywordInfo.monthly_searches as Record<string, unknown>[]).map((m) => ({
        year: Number((m as Record<string, unknown>).year) || 0,
        month: Number((m as Record<string, unknown>).month) || 0,
        searchVolume: Number((m as Record<string, unknown>).search_volume) || 0,
      }))
    : [];
  const keywordProperties = item.keyword_properties as Record<string, unknown> | undefined;
  const keywordDifficulty =
    typeof keywordProperties?.keyword_difficulty === "number"
      ? keywordProperties.keyword_difficulty
      : null;
  const searchIntentInfo = item.search_intent_info as Record<string, unknown> | undefined;
  const intent =
    typeof searchIntentInfo?.main_intent === "string"
      ? searchIntentInfo.main_intent
      : null;

  return {
    keyword,
    searchVolume,
    cpc,
    keywordDifficulty,
    competition,
    intent,
    monthlySearches,
  };
}

export async function fetchKeywordIdeas(
  keyword: string,
  locationCode: number = 2840,
  languageCode: string = "en",
  limit: number = 50
): Promise<KeywordResearchItem[]> {
  const api = new DataforseoLabsApi(API_BASE, {
    fetch: createAuthenticatedFetch(),
  });

  const req = new DataforseoLabsGoogleKeywordIdeasLiveRequestInfo({
    keywords: [keyword.trim()],
    location_code: locationCode,
    language_code: languageCode,
    limit,
    include_clickstream_data: true,
    include_serp_info: false,
    ignore_synonyms: false,
    closely_variants: false,
  });

  const response = await api.googleKeywordIdeasLive([req]);

  if (!response || response.status_code !== 20000) {
    throw new Error(
      response?.status_message ?? `DataForSEO error ${response?.status_code ?? "unknown"}`
    );
  }

  const task = response.tasks?.[0];
  if (!task) {
    throw new Error("DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new Error(
      (task as { status_message?: string }).status_message ??
        `DataForSEO task error ${task.status_code}`
    );
  }

  const items = (task.result?.[0] as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
  return items.map(mapItem);
}

// --- Keywords for site (domain overview) ---

export type DomainOverviewKeywordsResult = {
  keywordCount: number;
  totalSearchVolume: number;
  topKeywords: { keyword: string; searchVolume: number; cpc?: number | null }[];
};

export async function fetchKeywordsForSite(
  domain: string,
  locationCode: number = 2840,
  languageCode: string = "en"
): Promise<DomainOverviewKeywordsResult> {
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
  if (!apiKey) throw new Error("DATAFORSEO_API_KEY is not set.");

  const target = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim() || domain;
  const url = `${API_BASE}/v3/keywords_data/google/keywords_for_site/live`;
  const body = JSON.stringify([
    { target, location_code: locationCode, language_code: languageCode, sort_by: "search_volume" },
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const json = (await res.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: Array<{
        keyword?: string;
        search_volume?: number;
        cpc?: number;
      }>;
    }>;
  };

  if (json.status_code !== 20000) {
    throw new Error(json.status_message ?? `DataForSEO error ${json.status_code ?? "unknown"}`);
  }

  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      (task as { status_message?: string })?.status_message ?? `Task error ${task?.status_code ?? "unknown"}`
    );
  }

  const results = task.result ?? [];
  const keywordCount = results.length;
  let totalSearchVolume = 0;
  const withVolume = results
    .map((r) => ({
      keyword: r.keyword ?? "",
      searchVolume: typeof r.search_volume === "number" ? r.search_volume : 0,
      cpc: typeof r.cpc === "number" ? r.cpc : null,
    }))
    .filter((r) => r.keyword);
  withVolume.forEach((r) => {
    totalSearchVolume += r.searchVolume;
  });
  const topKeywords = withVolume
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 15)
    .map(({ keyword, searchVolume, cpc }) => ({ keyword, searchVolume, cpc }));

  return { keywordCount, totalSearchVolume, topKeywords };
}

// --- Ranked Keywords (position + URL per keyword for domain) ---

export type RankedKeywordRow = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  position: number | null;
  url: string | null;
  keywordDifficulty: number | null;
  intent: string | null;
};

export async function fetchRankedKeywords(
  domain: string,
  locationCode: number = 2840,
  languageCode: string = "en",
  limit: number = 100
): Promise<RankedKeywordRow[]> {
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
  if (!apiKey) throw new Error("DATAFORSEO_API_KEY is not set.");

  const target = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim().replace(/^www\./, "") || domain;
  const url = `${API_BASE}/v3/dataforseo_labs/ranked_keywords/live`;
  const body = JSON.stringify([
    {
      target,
      location_code: locationCode,
      language_code: languageCode,
      item_types: ["organic"],
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    },
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const json = (await res.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: Array<{
        items?: Array<{
          keyword_data?: {
            keyword?: string;
            keyword_info?: { search_volume?: number; cpc?: number };
            keyword_properties?: { keyword_difficulty?: number };
            search_intent_info?: { main_intent?: string };
          };
          search_intent_info?: { main_intent?: string };
          ranked_serp_element?: {
            serp_item?: { rank_group?: number; url?: string; relative_url?: string };
            keyword_difficulty?: number;
          };
        }>;
      }>;
    }>;
  };

  if (json.status_code !== 20000) {
    throw new Error(json.status_message ?? `DataForSEO error ${json.status_code ?? "unknown"}`);
  }

  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      (task as { status_message?: string })?.status_message ?? `Task error ${task?.status_code ?? "unknown"}`
    );
  }

  const rows: RankedKeywordRow[] = [];
  const resultList = task.result ?? [];
  for (const result of resultList) {
    const items = result?.items ?? [];
    for (const item of items) {
      const kw = item.keyword_data?.keyword ?? "";
      if (!kw) continue;
      const info = item.keyword_data?.keyword_info;
      const searchVolume = typeof info?.search_volume === "number" ? info.search_volume : 0;
      const cpc = typeof info?.cpc === "number" ? info.cpc : null;
      const serp = item.ranked_serp_element?.serp_item;
      const position = typeof serp?.rank_group === "number" ? serp.rank_group : null;
      const urlVal = serp?.url ?? (serp?.relative_url ? `https://${target}${serp.relative_url}` : null);
      const kwData = item.keyword_data;
      const kdFromProps =
        kwData?.keyword_properties != null && typeof kwData.keyword_properties.keyword_difficulty === "number"
          ? kwData.keyword_properties.keyword_difficulty
          : null;
      const kdFromSerp =
        item.ranked_serp_element != null && typeof item.ranked_serp_element.keyword_difficulty === "number"
          ? item.ranked_serp_element.keyword_difficulty
          : null;
      const kd = kdFromProps ?? kdFromSerp ?? null;
      const intentInfo = kwData?.search_intent_info ?? item.search_intent_info;
      const intent =
        typeof intentInfo?.main_intent === "string" && intentInfo.main_intent.length > 0
          ? intentInfo.main_intent
          : null;
      rows.push({
        keyword: kw,
        searchVolume,
        cpc,
        position,
        url: urlVal || null,
        keywordDifficulty: kd,
        intent,
      });
    }
  }
  return rows.slice(0, 20);
}

// --- Search Intent (for keywords when ranked_keywords doesn't return intent) ---

/**
 * Returns a map of keyword -> intent label (informational, navigational, commercial, transactional).
 * Uses DataForSEO Search Intent API; up to 1000 keywords per request.
 */
export async function fetchSearchIntent(
  keywords: string[],
  languageCode: string = "en"
): Promise<Record<string, string>> {
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
  if (!apiKey) throw new Error("DATAFORSEO_API_KEY is not set.");
  const list = keywords.filter((k) => k.trim().length >= 3).slice(0, 100);
  if (list.length === 0) return {};

  const url = `${API_BASE}/v3/dataforseo_labs/google/search_intent/live`;
  const body = JSON.stringify([{ keywords: list, language_code: languageCode }]);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const json = (await res.json()) as {
    status_code?: number;
    tasks?: Array<{
      status_code?: number;
      result?: Array<{
        items?: Array<{
          keyword?: string;
          keyword_intent?: { label?: string };
        }>;
      }>;
    }>;
  };

  if (json.status_code !== 20000) return {};
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) return {};

  const result = task.result?.[0];
  const items = result?.items ?? [];
  const map: Record<string, string> = {};
  for (const item of items) {
    const kw = item.keyword?.trim();
    const label = item.keyword_intent?.label;
    if (kw && typeof label === "string" && label.length > 0) {
      map[kw] = label;
    }
  }
  return map;
}

// --- Historical Rank Overview (visibility / estimated traffic) ---

export type HistoricalRankOverviewResult = {
  visibilityEtv: number | null;
  organicCount: number | null;
  /** Time series by month for charts: organic pages (count) and organic traffic (etv) */
  history?: { date: string; organicPages: number; organicTraffic: number }[];
};

export async function fetchHistoricalRankOverview(
  domain: string,
  locationCode: number = 2840,
  languageCode: string = "en"
): Promise<HistoricalRankOverviewResult> {
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
  if (!apiKey) throw new Error("DATAFORSEO_API_KEY is not set.");

  const target = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase().trim() || domain;
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - 24); // up to 2 years (API: from 2020-10-01)
  const dateFromStr = dateFrom.toISOString().slice(0, 10);

  // Only send date_from; API uses today as date_to by default (date_to can trigger "Invalid Field" on some endpoints)
  const url = `${API_BASE}/v3/dataforseo_labs/historical_rank_overview/live`;
  const body = JSON.stringify([
    { target, location_code: locationCode, language_code: languageCode, date_from: dateFromStr },
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const jsonTyped = (await res.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: Array<{
        items?: Array<{
          year?: number;
          month?: number;
          metrics?: { organic?: { etv?: number; count?: number } };
        }>;
      }>;
    }>;
  };

  if (jsonTyped.status_code !== 20000) {
    throw new Error(jsonTyped.status_message ?? `DataForSEO error ${jsonTyped.status_code ?? "unknown"}`);
  }

  const task = jsonTyped.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      (task as { status_message?: string })?.status_message ?? `Task error ${task?.status_code ?? "unknown"}`
    );
  }

  const resultList = task.result ?? [];
  const allItems: Array<{ year: number; month: number; etv: number; count: number }> = [];

  function addItem(item: { year?: number; month?: number; metrics?: { organic?: { etv?: number; count?: number } } }) {
    const year = item.year;
    const month = item.month;
    if (typeof year !== "number" || typeof month !== "number") return;
    const etv = item.metrics?.organic?.etv;
    const count = item.metrics?.organic?.count;
    allItems.push({
      year,
      month,
      etv: typeof etv === "number" ? etv : 0,
      count: typeof count === "number" ? count : 0,
    });
  }

  for (const result of resultList) {
    const r = result as Record<string, unknown> | undefined;
    if (!r) continue;
    if (Array.isArray(r.items)) {
      for (const item of r.items as Array<{ year?: number; month?: number; metrics?: { organic?: { etv?: number; count?: number } } }>) {
        addItem(item);
      }
    } else if (typeof r.year === "number" && typeof r.month === "number") {
      addItem(r as { year?: number; month?: number; metrics?: { organic?: { etv?: number; count?: number } } });
    }
  }

  if (allItems.length === 0) {
    return { visibilityEtv: null, organicCount: null, history: [] };
  }

  const sorted = [...allItems].sort((a, b) => a.year - b.year || a.month - b.month);
  const latest = sorted[sorted.length - 1];
  const history = sorted.map(({ year, month, etv, count }) => ({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    organicPages: count,
    organicTraffic: Math.round(etv),
  }));

  return {
    visibilityEtv: latest.etv > 0 ? Math.round(latest.etv) : null,
    organicCount: latest.count > 0 ? latest.count : null,
    history,
  };
}
