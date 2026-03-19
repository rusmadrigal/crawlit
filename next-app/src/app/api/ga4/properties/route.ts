import { getAccessTokenFromRefreshToken, getGa4RefreshToken, listGa4Properties } from "@/lib/ga4";

export async function GET() {
  const refreshToken = await getGa4RefreshToken();
  if (!refreshToken) {
    return Response.json({ ok: false, error: "GA4 not connected" }, { status: 401 });
  }
  try {
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const properties = await listGa4Properties(accessToken);
    return Response.json({ ok: true, properties });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list GA4 properties";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

