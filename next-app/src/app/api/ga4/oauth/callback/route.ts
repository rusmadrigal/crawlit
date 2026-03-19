import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens, GA4_COOKIE_NAMES, ga4CookieOptions, getOauthState } from "@/lib/ga4";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const res = NextResponse.redirect(new URL(`/?ga4_error=${encodeURIComponent(error)}`, request.url));
    res.cookies.set(GA4_COOKIE_NAMES.state, "", { ...ga4CookieOptions(0), maxAge: 0 });
    return res;
  }

  if (!code || !state) {
    const res = NextResponse.redirect(new URL(`/?ga4_error=${encodeURIComponent("missing_code_or_state")}`, request.url));
    res.cookies.set(GA4_COOKIE_NAMES.state, "", { ...ga4CookieOptions(0), maxAge: 0 });
    return res;
  }

  const expected = await getOauthState();
  if (!expected || expected !== state) {
    const res = NextResponse.redirect(new URL(`/?ga4_error=${encodeURIComponent("invalid_state")}`, request.url));
    res.cookies.set(GA4_COOKIE_NAMES.state, "", { ...ga4CookieOptions(0), maxAge: 0 });
    return res;
  }

  let redirectTo = "/";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { redirectTo?: string };
    if (decoded.redirectTo) redirectTo = decoded.redirectTo;
  } catch {
    // ignore
  }

  const redirectUri = new URL("/api/ga4/oauth/callback", request.url).toString();
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const res = NextResponse.redirect(new URL(redirectTo, request.url));
  // clear state cookie
  res.cookies.set(GA4_COOKIE_NAMES.state, "", { ...ga4CookieOptions(0), maxAge: 0 });
  // set refresh token cookie (only present on first consent)
  if (tokens.refreshToken) {
    res.cookies.set(GA4_COOKIE_NAMES.refresh, tokens.refreshToken, ga4CookieOptions(60 * 60 * 24 * 365));
  }
  return res;
}

