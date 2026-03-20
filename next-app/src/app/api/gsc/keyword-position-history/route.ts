import { NextRequest } from "next/server";
import { getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";
import {
  fetchGscQueryPositionDailySeries,
  startDateMinusCalendarMonths,
  yesterdayUtc,
} from "@/lib/gsc";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 800;

export type KeywordPositionHistoryResponse = {
  ok: boolean;
  points?: { date: string; position: number }[];
  range?: {
    startDate: string;
    endDate: string;
    monthsRequested?: number;
    custom?: boolean;
  };
  /** Explains GSC data limits for the client UI. */
  note?: string;
  error?: string;
};

function daysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00.000Z`).getTime();
  const b = new Date(`${end}T12:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Daily average position for one query from Search Analytics (OAuth: same refresh token as GA4).
 * Either `months` (12 or 24) or both `start_date` and `end_date` (YYYY-MM-DD, inclusive).
 */
export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword")?.trim();
  const gscSiteUrl = request.nextUrl.searchParams.get("gsc_site_url")?.trim();
  const monthsRaw = request.nextUrl.searchParams.get("months");
  const startQ = request.nextUrl.searchParams.get("start_date")?.trim();
  const endQ = request.nextUrl.searchParams.get("end_date")?.trim();

  if (!keyword || !gscSiteUrl) {
    return Response.json(
      { ok: false, error: "Missing keyword or gsc_site_url" } satisfies KeywordPositionHistoryResponse,
      { status: 400 }
    );
  }

  const refreshToken = await getGa4RefreshToken();
  if (!refreshToken) {
    return Response.json(
      { ok: false, error: "Connect Google (GA4 / Search Console) to view position history." } satisfies KeywordPositionHistoryResponse,
      { status: 401 }
    );
  }

  let startDate: string;
  let endDate: string;
  let monthsRequested: number | undefined;
  let custom = false;

  const latest = yesterdayUtc();

  if (startQ && endQ) {
    if (!YMD.test(startQ) || !YMD.test(endQ)) {
      return Response.json(
        { ok: false, error: "Invalid start_date or end_date (use YYYY-MM-DD)." } satisfies KeywordPositionHistoryResponse,
        { status: 400 }
      );
    }
    if (startQ > endQ) {
      return Response.json(
        { ok: false, error: "start_date must be on or before end_date." } satisfies KeywordPositionHistoryResponse,
        { status: 400 }
      );
    }
    if (endQ > latest) {
      return Response.json(
        { ok: false, error: `end_date cannot be after the latest Search Console day (${latest}).` } satisfies KeywordPositionHistoryResponse,
        { status: 400 }
      );
    }
    if (startQ > latest) {
      return Response.json(
        { ok: false, error: "start_date cannot be after the latest Search Console day." } satisfies KeywordPositionHistoryResponse,
        { status: 400 }
      );
    }
    const span = daysInclusive(startQ, endQ);
    if (span > MAX_RANGE_DAYS) {
      return Response.json(
        { ok: false, error: `Date range too large (max ${MAX_RANGE_DAYS} days).` } satisfies KeywordPositionHistoryResponse,
        { status: 400 }
      );
    }
    startDate = startQ;
    endDate = endQ;
    custom = true;
  } else if (startQ || endQ) {
    return Response.json(
      { ok: false, error: "Provide both start_date and end_date for a custom range." } satisfies KeywordPositionHistoryResponse,
      { status: 400 }
    );
  } else {
    monthsRequested = monthsRaw === "24" ? 24 : 12;
    endDate = latest;
    startDate = startDateMinusCalendarMonths(endDate, monthsRequested);
  }

  try {
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const points = await fetchGscQueryPositionDailySeries({
      accessToken,
      siteUrl: gscSiteUrl,
      startDate,
      endDate,
      query: keyword,
      maxPages: custom ? 12 : 8,
    });

    const baseNote =
      "Search Console typically retains about 16 months of performance data. If you choose 24 months, the chart shows everything the API returns (older data may be missing).";

    return Response.json({
      ok: true,
      points,
      range: custom
        ? { startDate, endDate, custom: true }
        : { startDate, endDate, monthsRequested: monthsRequested! },
      note: custom ? `${baseNote} Custom range selected.` : baseNote,
    } satisfies KeywordPositionHistoryResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load position history";
    return Response.json({ ok: false, error: message } satisfies KeywordPositionHistoryResponse, { status: 500 });
  }
}
