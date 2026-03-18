"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function BannerApiKey({
  showWarning,
  showError,
}: {
  showWarning?: boolean;
  showError?: boolean;
}) {
  if (showWarning) {
    return (
      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            Add your DataForSEO API key to use CrawliT.{" "}
            <Link href="/help/dataforseo-api-key" className="font-medium underline underline-offset-2">
              Setup guide
            </Link>
          </span>
        </div>
      </div>
    );
  }
  if (showError) {
    return (
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-slate-600">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            We couldn&apos;t verify your DataForSEO setup.{" "}
            <Link href="/help/dataforseo-api-key" className="font-medium underline underline-offset-2">
              Help
            </Link>
          </span>
        </div>
      </div>
    );
  }
  return null;
}
