import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2 } from "lucide-react";

export default function BacklinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Backlinks
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          See who links to your site and track new or lost links.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            Backlink analysis
          </CardTitle>
          <CardDescription>
            Requires DataForSEO Backlinks to be enabled on your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md flex-col gap-2">
            <label htmlFor="target" className="text-sm font-medium text-slate-700">
              Target URL or domain
            </label>
            <input
              id="target"
              type="text"
              placeholder="example.com or https://example.com/page"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
