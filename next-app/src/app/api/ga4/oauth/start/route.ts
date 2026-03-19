import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildGa4OauthUrl, GA4_COOKIE_NAMES, ga4CookieOptions, getGa4OauthEnvStatus } from "@/lib/ga4";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect_to") || "/";

  // Temporary debug: do NOT print secrets; only whether they are set.
  const env = getGa4OauthEnvStatus();
  console.log("[GA4 OAuth] env", env, "redirectTo", redirectTo);
  if (!env.hasClientId || !env.hasClientSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Google OAuth environment variables",
        missing: {
          GOOGLE_OAUTH_CLIENT_ID: !env.hasClientId,
          GOOGLE_OAUTH_CLIENT_SECRET: !env.hasClientSecret,
        },
        expectedEnvFile: "next-app/.env.local",
      },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  // Encode redirect target into state payload (simple + sufficient for now)
  const statePayload = JSON.stringify({ state, redirectTo });
  const stateB64 = Buffer.from(statePayload, "utf8").toString("base64url");

  const redirectUri = new URL("/api/ga4/oauth/callback", request.url).toString();
  let authUrl: string;
  try {
    authUrl = buildGa4OauthUrl(redirectUri, stateB64);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start GA4 OAuth";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  const res = NextResponse.redirect(authUrl);
  res.cookies.set(GA4_COOKIE_NAMES.state, stateB64, ga4CookieOptions(60 * 10));
  return res;
}

