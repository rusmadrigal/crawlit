import { cookies } from "next/headers";

const GA_REFRESH_COOKIE = "crawlit_ga4_refresh_token";
const GA_OAUTH_STATE_COOKIE = "crawlit_ga4_oauth_state";

export type Ga4Property = { propertyId: string; displayName: string };
export const GA4_COOKIE_NAMES = { refresh: GA_REFRESH_COOKIE, state: GA_OAUTH_STATE_COOKIE } as const;

/** Single OAuth client for GA4 + Search Console (same refresh token must cover both). */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;

export function ga4CookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function getEnvOptional(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export async function getGa4RefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(GA_REFRESH_COOKIE)?.value ?? null;
}

export async function getOauthState(): Promise<string | null> {
  const store = await cookies();
  return store.get(GA_OAUTH_STATE_COOKIE)?.value ?? null;
}

export function buildGa4OauthUrl(redirectUri: string, state: string): string {
  const clientId = getEnv("GOOGLE_OAUTH_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...GOOGLE_OAUTH_SCOPES].join(" "),
    /** Required for refresh_token */
    access_type: "offline",
    /** Force consent screen so new scopes apply and refresh_token can be re-issued */
    prompt: "consent",
    /** Incremental authorization: keep previously granted scopes when adding new ones */
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGa4OauthEnvStatus(): { hasClientId: boolean; hasClientSecret: boolean } {
  return {
    hasClientId: Boolean(getEnvOptional("GOOGLE_OAUTH_CLIENT_ID")),
    hasClientSecret: Boolean(getEnvOptional("GOOGLE_OAUTH_CLIENT_SECRET")),
  };
}

export type GoogleTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  /** Space-separated scopes granted for this access token (when Google returns it). */
  scope?: string;
};

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenExchangeResult> {
  const clientId = getEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Failed to exchange OAuth code");
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, scope: json.scope };
}

export async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const clientId = getEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Failed to refresh access token");
  }
  return json.access_token;
}

function nowPartsInTimeZone(timeZone: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() };
  return { year, month, day };
}

export function buildFullMonthRange(timeZone: string, months: 12 | 24): { startDate: string; endDate: string; monthStarts: string[] } {
  const { year, month } = nowPartsInTimeZone(timeZone);
  // Exclude current partial month: end at last day of previous month
  const endYear = month === 1 ? year - 1 : year;
  const endMonth = month === 1 ? 12 : month - 1;
  const endDateObj = new Date(endYear, endMonth, 0); // last day of endMonth
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

  // Start at first day of month (months) months ago from current month
  let startYear = year;
  let startMonth = month - months;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;

  const monthStarts: string[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < months; i++) {
    monthStarts.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return { startDate, endDate, monthStarts };
}

/** Build a daily date range in property timezone: from (yesterday - days + 1) through yesterday. */
export function buildDailyRange(timeZone: string, days: number): { startDate: string; endDate: string; dateList: string[] } {
  const { year, month, day } = nowPartsInTimeZone(timeZone);
  let y = year,
    m = month,
    d = day - 1;
  if (d < 1) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    d = new Date(y, m, 0).getDate();
  }
  const endDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const endUtc = new Date(`${endDate}T12:00:00Z`);
  const startUtc = new Date(endUtc);
  startUtc.setUTCDate(startUtc.getUTCDate() - (days - 1));
  const startDate = startUtc.toISOString().slice(0, 10);
  const dateList: string[] = [];
  const cur = new Date(startUtc.getTime());
  const endDay = new Date(endUtc.getTime());
  while (cur <= endDay) {
    dateList.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { startDate, endDate, dateList };
}

export async function fetchGa4OrganicSessionsDaily(params: {
  accessToken: string;
  propertyId: string;
  days: number;
}): Promise<{ date: string; sessions: number }[]> {
  const timeZone = await getGa4PropertyTimeZone(params.accessToken, params.propertyId);
  const { startDate, endDate, dateList } = buildDailyRange(timeZone, params.days);
  const dimensionFilter: Record<string, unknown> = {
    andGroup: {
      expressions: [
        {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Organic Search", caseSensitive: false },
          },
        },
      ],
    },
  };
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${params.propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter,
      keepEmptyRows: false,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Failed to fetch GA4 sessions");
  const byDate = new Map<string, number>();
  for (const row of json.rows ?? []) {
    const d = row.dimensionValues?.[0]?.value;
    const v = Number(row.metricValues?.[0]?.value ?? "0");
    if (!d || d.length !== 8) continue;
    const dateKey = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    byDate.set(dateKey, Math.round(Number.isFinite(v) ? v : 0));
  }
  return dateList.map((date) => ({ date, sessions: byDate.get(date) ?? 0 }));
}

export async function listGa4Properties(accessToken: string): Promise<Ga4Property[]> {
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || "Failed to list GA4 properties");
  const props: Ga4Property[] = [];
  for (const acct of json.accountSummaries ?? []) {
    for (const p of acct.propertySummaries ?? []) {
      const raw = p.property ?? "";
      const propertyId = raw.replace("properties/", "").trim();
      if (!propertyId) continue;
      props.push({ propertyId, displayName: p.displayName || propertyId });
    }
  }
  props.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return props;
}

export async function getGa4PropertyTimeZone(accessToken: string, propertyId: string): Promise<string> {
  const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = (await res.json()) as { timeZone?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Failed to read GA4 property");
  return json.timeZone || "UTC";
}

export async function fetchGa4OrganicSessionsMonthly(params: {
  accessToken: string;
  propertyId: string;
  countryIso?: string;
  months: 12 | 24;
}): Promise<{ date: string; sessions: number }[]> {
  const timeZone = await getGa4PropertyTimeZone(params.accessToken, params.propertyId);
  const { startDate, endDate, monthStarts } = buildFullMonthRange(timeZone, params.months);

  const dimensionFilter: Record<string, unknown> = {
    andGroup: {
      expressions: [
        {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Organic Search", caseSensitive: false },
          },
        },
      ],
    },
  };
  if (params.countryIso && params.countryIso.trim()) {
    (dimensionFilter.andGroup as { expressions: unknown[] }).expressions.push({
      filter: {
        fieldName: "countryId",
        stringFilter: { matchType: "EXACT", value: params.countryIso.toUpperCase(), caseSensitive: false },
      },
    });
  }

  // Use date dimension and aggregate by monthStart on our side to avoid schema drift across API versions.
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${params.propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter,
      keepEmptyRows: true,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || "Failed to fetch GA4 sessions");

  // Bucket daily rows into month starts.
  const byMonth = new Map<string, number>();
  for (const m of monthStarts) byMonth.set(m, 0);
  for (const row of json.rows ?? []) {
    const d = row.dimensionValues?.[0]?.value; // YYYYMMDD
    const v = Number(row.metricValues?.[0]?.value ?? "0");
    if (!d || d.length !== 8) continue;
    const monthKey = `${d.slice(0, 4)}-${d.slice(4, 6)}-01`;
    if (!byMonth.has(monthKey)) continue;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + (Number.isFinite(v) ? v : 0));
  }

  return monthStarts.map((date) => ({ date, sessions: Math.round(byMonth.get(date) ?? 0) }));
}

