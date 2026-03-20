import { getAccessTokenFromRefreshToken, getGa4RefreshToken } from "@/lib/ga4";
import { listGscSites } from "@/lib/gsc";

export async function GET() {
  const refreshToken = await getGa4RefreshToken();
  if (!refreshToken) {
    return Response.json({ ok: false, error: "Google not connected" }, { status: 401 });
  }
  try {
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const sites = await listGscSites(accessToken);
    return Response.json({ ok: true, sites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list Search Console sites";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
