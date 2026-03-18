import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const API_ACCESS_URL = "https://app.dataforseo.com/api-access";

export const metadata = {
  title: "DataForSEO API key",
  description: "How to get and set your DataForSEO API key in Craw iT.",
};

export default function DataforseoApiKeyHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          DataForSEO API key
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Craw iT uses DataForSEO to fetch SEO data. You need an API key to connect.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Get your API credentials</CardTitle>
          <CardDescription>
            Go to DataForSEO API Access and request credentials by email (API key or password).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={API_ACCESS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            Open DataForSEO API Access
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Encode your key</CardTitle>
          <CardDescription>
            Use your DataForSEO login and API password. Encode <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">login:password</code> in Base64.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {`# In terminal (replace with your login and password):
printf '%s' 'YOUR_LOGIN:YOUR_PASSWORD' | base64`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Set the environment variable</CardTitle>
          <CardDescription>
            Add the Base64 string as <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">DATAFORSEO_API_KEY</code> in your environment (e.g. <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">.env.local</code> for local dev, or in Vercel project settings for production).
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          Back to Craw iT
        </Link>
      </div>
    </div>
  );
}
