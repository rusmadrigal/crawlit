import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Site Audit
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Crawl your site and fix technical SEO issues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            Run an audit
          </CardTitle>
          <CardDescription>
            Enter a URL to crawl. Audits can take a few minutes for larger sites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md flex-col gap-3">
            <label htmlFor="audit-url" className="text-sm font-medium text-slate-700">
              Site URL
            </label>
            <input
              id="audit-url"
              type="url"
              placeholder="https://example.com"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Button variant="primary">Start audit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
