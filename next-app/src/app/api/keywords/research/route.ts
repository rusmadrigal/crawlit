import { NextRequest, NextResponse } from "next/server";
import { fetchKeywordIdeas, isDataforseoConfigured } from "@/lib/dataforseo";

export async function POST(request: NextRequest) {
  if (!isDataforseoConfigured()) {
    return NextResponse.json(
      { error: "DATAFORSEO_API_KEY is not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
    if (!keyword) {
      return NextResponse.json(
        { error: "Missing or invalid 'keyword' in body." },
        { status: 400 }
      );
    }

    const locationCode = typeof body.locationCode === "number" ? body.locationCode : 2840;
    const languageCode = typeof body.languageCode === "string" ? body.languageCode : "en";
    const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 700) : 50;

    const items = await fetchKeywordIdeas(keyword, locationCode, languageCode, limit);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Keyword research failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
