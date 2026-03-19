import { getGa4OauthEnvStatus } from "@/lib/ga4";

export async function GET() {
  const env = getGa4OauthEnvStatus();
  return Response.json({
    ok: true,
    env: {
      GOOGLE_OAUTH_CLIENT_ID: env.hasClientId ? "set" : "missing",
      GOOGLE_OAUTH_CLIENT_SECRET: env.hasClientSecret ? "set" : "missing",
    },
    expectedEnvFile: "next-app/.env.local",
  });
}

