/**
 * Google Search Console (Search Analytics API).
 * "Page indexing" in the UI is approximated as distinct URLs with search impressions
 * in the period (GSC does not expose the Page indexing report totals via API).
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
