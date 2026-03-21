/**
 * Google Search Console (Search Analytics API).
 * - "Page indexing" in the UI ≈ distinct URLs with search data in the period.
 * - "Organic keywords" / queries ≈ distinct search queries (dimension `query`) per month or per day.
 * GSC row limits can cap counts on very large properties (rows ordered by traffic).
 */

const GSC_API = "https://www.googleapis.com/webmasters/v3";

export type GscSite = { siteUrl: string; permissionLevel?: string };

function encodeSitePath(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch(`${GSC_API}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Failed to list Search Console sites");
  const sites: GscSite[] = [];
  for (const e of json.siteEntry ?? []) {
    const u = e.siteUrl?.trim();
    if (u) sites.push({ siteUrl: u, permissionLevel: e.permissionLevel });
  }
  sites.sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
  return sites;
}

/** Last calendar day of month (YYYY-MM-DD) for a month start string YYYY-MM-01. */
export function lastDayOfMonthUtc(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  if (!y || !m) return monthStart;
  const last = new Date(Date.UTC(y, m, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Count distinct URLs with Search Console data in [startDate, endDate] (inclusive).
 * Paginates up to maxPages * rowLimit rows (default ~500k) then stops.
 */
export async function countDistinctPagesInRange(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  maxPages?: number;
}): Promise<number> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 20;
  let total = 0;
  let startRow = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["page"],
        rowLimit,
        startRow,
        aggregationType: "byPage",
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { rows?: unknown[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    total += rows.length;
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return total;
}

/**
 * Distinct page count per calendar day (keys YYYY-MM-DD) for the given range.
 * Paginates; may undercount if more than cap rows exist (low-traffic URLs omitted by GSC ordering).
 */
export async function fetchDistinctPagesPerDay(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  maxPages?: number;
}): Promise<Map<string, number>> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 40;
  const byDate = new Map<string, number>();
  let startRow = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["date", "page"],
        rowLimit,
        startRow,
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      rows?: Array<{ keys?: string[] }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    for (const row of rows) {
      const d = row.keys?.[0];
      if (!d || d.length !== 10) continue;
      byDate.set(d, (byDate.get(d) ?? 0) + 1);
    }
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return byDate;
}

export async function fetchGscIndexedPagesMonthly(params: {
  accessToken: string;
  siteUrl: string;
  monthStarts: string[];
  /** Parallel batches to speed up many months (each month = 1+ API calls). */
  concurrency?: number;
}): Promise<{ date: string; pages: number }[]> {
  const concurrency = Math.max(1, Math.min(params.concurrency ?? 4, 8));
  const monthStarts = params.monthStarts;
  const out: { date: string; pages: number }[] = [];
  for (let i = 0; i < monthStarts.length; i += concurrency) {
    const chunk = monthStarts.slice(i, i + concurrency);
    const part = await Promise.all(
      chunk.map(async (monthStart) => {
        const end = lastDayOfMonthUtc(monthStart);
        const pages = await countDistinctPagesInRange({
          accessToken: params.accessToken,
          siteUrl: params.siteUrl,
          startDate: monthStart,
          endDate: end,
        });
        return { date: monthStart, pages };
      })
    );
    out.push(...part);
  }
  return out;
}

/** Merge GSC distinct-page counts into chart points as `organicPages`. */
export async function mergeGscPagesIntoHistory<T extends { date: string; organicPages: number }>(params: {
  accessToken: string;
  siteUrl: string;
  history: T[];
  granularity: "monthly" | "daily";
}): Promise<T[]> {
  const hist = params.history;
  if (hist.length === 0) return hist;
  const looksDaily = params.granularity === "daily" && hist[0]?.date?.length === 10;
  if (looksDaily) {
    const series = await fetchGscIndexedPagesDaily({
      accessToken: params.accessToken,
      siteUrl: params.siteUrl,
      dateList: hist.map((h) => h.date),
    });
    const map = new Map(series.map((s) => [s.date, s.pages]));
    return hist.map((p) => ({ ...p, organicPages: map.get(p.date) ?? p.organicPages }));
  }
  const monthStarts = [...new Set(hist.map((p) => `${p.date.slice(0, 7)}-01`))].sort();
  const series = await fetchGscIndexedPagesMonthly({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    monthStarts,
  });
  const map = new Map(series.map((s) => [s.date, s.pages]));
  return hist.map((p) => {
    const key = `${p.date.slice(0, 7)}-01`;
    return { ...p, organicPages: map.get(key) ?? p.organicPages };
  });
}

export async function fetchGscIndexedPagesDaily(params: {
  accessToken: string;
  siteUrl: string;
  dateList: string[];
}): Promise<{ date: string; pages: number }[]> {
  if (params.dateList.length === 0) return [];
  const sorted = [...params.dateList].sort();
  const startDate = sorted[0]!;
  const endDate = sorted[sorted.length - 1]!;
  const byDay = await fetchDistinctPagesPerDay({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    startDate,
    endDate,
  });
  return params.dateList.map((date) => ({ date, pages: byDay.get(date) ?? 0 }));
}

/** Yesterday (UTC) as YYYY-MM-DD — GSC data is typically complete through yesterday. */
export function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar months before `endDate` (YYYY-MM-DD), same day-of-month when possible (UTC). */
export function startDateMinusCalendarMonths(endDate: string, months: number): string {
  const n = Math.min(120, Math.max(1, Math.floor(months)));
  const [y, m, d] = endDate.split("-").map(Number);
  if (!y || !m || !d) return endDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() - n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Site-wide aggregate metrics (clicks, impressions, CTR) for a date range. No dimensions = single aggregate row. */
export async function fetchGscSiteWideCtr(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<{ clicks: number; impressions: number; ctr: number } | null> {
  const path = encodeSitePath(params.siteUrl);
  const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dataState: "final",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    rows?: Array<{ clicks?: number; impressions?: number; ctr?: number }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
  const row = json.rows?.[0];
  if (!row) return null;
  const clicks = typeof row.clicks === "number" ? row.clicks : 0;
  const impressions = typeof row.impressions === "number" ? row.impressions : 0;
  // GSC API returns ctr as decimal (0–1); convert to percentage (0–100)
  const ctrRaw = typeof row.ctr === "number" ? row.ctr : impressions > 0 ? clicks / impressions : 0;
  const ctr = Math.round(ctrRaw * 10000) / 100; // e.g. 2.34 for 2.34%
  return { clicks, impressions, ctr };
}

/** Inclusive date range for the last N days ending yesterday (UTC). */
export function gscDateRangeLastNDays(days: number = 28): { startDate: string; endDate: string } {
  const n = Math.min(366, Math.max(1, days));
  const endDate = yesterdayUtc();
  const end = new Date(`${endDate}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - (n - 1));
  const y = end.getUTCFullYear();
  const m = String(end.getUTCMonth() + 1).padStart(2, "0");
  const d = String(end.getUTCDate()).padStart(2, "0");
  return { startDate: `${y}-${m}-${d}`, endDate };
}

/** Every calendar day YYYY-MM-DD from `startDate` through `endDate` (inclusive), UTC. */
export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** One value per day in `allDates`; forward-fills from first known position (GSC omits days with no data). */
export function densePositionSeriesForDates(
  allDates: string[],
  rows: { date: string; position: number }[]
): number[] {
  const m = new Map(rows.map((r) => [r.date, r.position]));
  if (m.size === 0) return [];

  const vals = allDates.map((d) => (m.has(d) ? (m.get(d) as number) : Number.NaN));
  const firstIdx = vals.findIndex((v) => !Number.isNaN(v));
  if (firstIdx === -1) return [];
  const firstVal = vals[firstIdx] as number;
  for (let j = 0; j < firstIdx; j++) vals[j] = firstVal;
  for (let j = firstIdx + 1; j < vals.length; j++) {
    if (Number.isNaN(vals[j]!)) vals[j] = vals[j - 1]!;
  }
  return vals as number[];
}

/**
 * Daily average position for a single search query (dimension `date` + filter on `query`).
 */
export async function fetchGscQueryPositionDailySeries(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  query: string;
  /** Paginate when the date range has many days (e.g. 12–24 months). */
  maxPages?: number;
}): Promise<{ date: string; position: number }[]> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 5;
  const byDate = new Map<string, number>();
  let startRow = 0;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["date"],
        dimensionFilterGroups: [
          {
            groupType: "and",
            filters: [
              {
                dimension: "query",
                operator: "equals",
                expression: params.query,
              },
            ],
          },
        ],
        rowLimit,
        startRow,
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      rows?: Array<{
        keys?: string[];
        position?: number;
      }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    for (const row of rows) {
      const d = row.keys?.[0]?.trim();
      if (!d || d.length !== 10) continue;
      const position = typeof row.position === "number" ? row.position : 0;
      byDate.set(d, position);
    }
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  const out = [...byDate.entries()]
    .map(([date, position]) => ({ date, position }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Position history (one series per query, aligned to `startDate`–`endDate`) for sparklines.
 * Runs GSC requests in small concurrent batches.
 */
export async function fetchGscTopQueriesPositionHistories(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  queries: string[];
  concurrency?: number;
}): Promise<Map<string, number[]>> {
  const allDates = eachDateInclusive(params.startDate, params.endDate);
  const concurrency = Math.max(1, Math.min(params.concurrency ?? 4, 6));
  const out = new Map<string, number[]>();
  const unique = [...new Set(params.queries.map((q) => q.trim()).filter(Boolean))];

  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (query) => {
        const key = query.toLowerCase();
        try {
          const rows = await fetchGscQueryPositionDailySeries({
            accessToken: params.accessToken,
            siteUrl: params.siteUrl,
            startDate: params.startDate,
            endDate: params.endDate,
            query,
          });
          out.set(key, densePositionSeriesForDates(allDates, rows));
        } catch {
          out.set(key, []);
        }
      })
    );
  }
  return out;
}

export type GscTopQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Top search queries by clicks (default GSC ordering) for the date range.
 * `searchVolume` in the app maps to `impressions` when displaying GSC-sourced rows.
 */
export async function fetchTopQueriesFromGsc(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowLimit?: number;
}): Promise<GscTopQueryRow[]> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = Math.min(25000, Math.max(1, params.rowLimit ?? 25));
  const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["query"],
      rowLimit,
      dataState: "final",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
  const out: GscTopQueryRow[] = [];
  for (const row of json.rows ?? []) {
    const q = row.keys?.[0]?.trim();
    if (!q) continue;
    out.push({
      query: q,
      clicks: typeof row.clicks === "number" ? row.clicks : 0,
      impressions: typeof row.impressions === "number" ? row.impressions : 0,
      ctr: typeof row.ctr === "number" ? row.ctr : 0,
      position: typeof row.position === "number" ? row.position : 0,
    });
  }
  return out;
}

/**
 * For each query, the landing page with the most clicks in the date range (among rows returned
 * by Search Analytics). Paginates up to `maxPages` × rowLimit rows; may miss pairs beyond the cap.
 */
export async function fetchGscBestPagePerQueryInRange(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  queries: string[];
  maxPages?: number;
}): Promise<Map<string, string>> {
  const wanted = new Set(params.queries.map((q) => q.trim().toLowerCase()).filter(Boolean));
  const best = new Map<string, { page: string; clicks: number }>();
  if (wanted.size === 0) return new Map();

  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 12;
  let startRow = 0;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["query", "page"],
        rowLimit,
        startRow,
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      rows?: Array<{
        keys?: string[];
        clicks?: number;
      }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    for (const row of rows) {
      const q = row.keys?.[0]?.trim();
      const p = row.keys?.[1]?.trim();
      if (!q || !p) continue;
      const qk = q.toLowerCase();
      if (!wanted.has(qk)) continue;
      const clicks = typeof row.clicks === "number" ? row.clicks : 0;
      const prev = best.get(qk);
      if (!prev || clicks > prev.clicks) best.set(qk, { page: p, clicks });
    }
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  const out = new Map<string, string>();
  for (const [qk, { page }] of best) out.set(qk, page);
  return out;
}

/**
 * Count distinct search queries with impressions/clicks in [startDate, endDate] (inclusive).
 * Paginates up to maxPages * rowLimit rows (may undercount if property exceeds cap; ordered by traffic).
 */
export async function countDistinctQueriesInRange(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  maxPages?: number;
}): Promise<number> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 20;
  let total = 0;
  let startRow = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["query"],
        rowLimit,
        startRow,
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { rows?: unknown[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    total += rows.length;
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return total;
}

/** Distinct query count per calendar day (keys YYYY-MM-DD). */
export async function fetchDistinctQueriesPerDay(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  maxPages?: number;
}): Promise<Map<string, number>> {
  const path = encodeSitePath(params.siteUrl);
  const rowLimit = 25000;
  const maxPages = params.maxPages ?? 40;
  const byDate = new Map<string, number>();
  let startRow = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${GSC_API}/sites/${path}/searchAnalytics/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["date", "query"],
        rowLimit,
        startRow,
        dataState: "final",
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      rows?: Array<{ keys?: string[] }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? "Search Console searchAnalytics query failed");
    const rows = json.rows ?? [];
    for (const row of rows) {
      const d = row.keys?.[0];
      if (!d || d.length !== 10) continue;
      byDate.set(d, (byDate.get(d) ?? 0) + 1);
    }
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return byDate;
}

export async function fetchGscDistinctQueriesMonthly(params: {
  accessToken: string;
  siteUrl: string;
  monthStarts: string[];
  concurrency?: number;
}): Promise<{ date: string; queries: number }[]> {
  const concurrency = Math.max(1, Math.min(params.concurrency ?? 4, 8));
  const monthStarts = params.monthStarts;
  const out: { date: string; queries: number }[] = [];
  for (let i = 0; i < monthStarts.length; i += concurrency) {
    const chunk = monthStarts.slice(i, i + concurrency);
    const part = await Promise.all(
      chunk.map(async (monthStart) => {
        const end = lastDayOfMonthUtc(monthStart);
        const queries = await countDistinctQueriesInRange({
          accessToken: params.accessToken,
          siteUrl: params.siteUrl,
          startDate: monthStart,
          endDate: end,
        });
        return { date: monthStart, queries };
      })
    );
    out.push(...part);
  }
  return out;
}

export async function fetchGscDistinctQueriesDaily(params: {
  accessToken: string;
  siteUrl: string;
  dateList: string[];
}): Promise<{ date: string; queries: number }[]> {
  if (params.dateList.length === 0) return [];
  const sorted = [...params.dateList].sort();
  const startDate = sorted[0]!;
  const endDate = sorted[sorted.length - 1]!;
  const byDay = await fetchDistinctQueriesPerDay({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    startDate,
    endDate,
  });
  return params.dateList.map((date) => ({ date, queries: byDay.get(date) ?? 0 }));
}

/** Merge GSC distinct-query counts into chart points as `organicKeywords`. */
export async function mergeGscQueriesIntoHistory<T extends { date: string; organicKeywords?: number }>(params: {
  accessToken: string;
  siteUrl: string;
  history: T[];
  granularity: "monthly" | "daily";
}): Promise<T[]> {
  const hist = params.history;
  if (hist.length === 0) return hist;
  const looksDaily = params.granularity === "daily" && hist[0]?.date?.length === 10;
  if (looksDaily) {
    const series = await fetchGscDistinctQueriesDaily({
      accessToken: params.accessToken,
      siteUrl: params.siteUrl,
      dateList: hist.map((h) => h.date),
    });
    const map = new Map(series.map((s) => [s.date, s.queries]));
    return hist.map((p) => ({ ...p, organicKeywords: map.get(p.date) ?? p.organicKeywords ?? 0 }));
  }
  const monthStarts = [...new Set(hist.map((p) => `${p.date.slice(0, 7)}-01`))].sort();
  const series = await fetchGscDistinctQueriesMonthly({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    monthStarts,
  });
  const map = new Map(series.map((s) => [s.date, s.queries]));
  return hist.map((p) => {
    const key = `${p.date.slice(0, 7)}-01`;
    return { ...p, organicKeywords: map.get(key) ?? p.organicKeywords ?? 0 };
  });
}

/** Distinct queries in the last N full days ending yesterday (UTC), inclusive. */
export async function countDistinctQueriesLastNDays(params: {
  accessToken: string;
  siteUrl: string;
  days?: number;
}): Promise<number> {
  const { startDate, endDate } = gscDateRangeLastNDays(params.days ?? 28);
  return countDistinctQueriesInRange({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    startDate,
    endDate,
  });
}
