"use client";

import { ExternalLink, TrendingUp, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendChart } from "./TrendChart";
import { SerpList } from "./SerpList";
import type { KeywordRow, Intent, SerpResult } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const intentVariant: Record<Intent, "informational" | "commercial" | "transactional"> = {
  Informational: "informational",
  Commercial: "commercial",
  Transactional: "transactional",
};

interface KeywordDetailsPanelProps {
  keyword: KeywordRow | null;
  serpResults: SerpResult[];
  loading?: boolean;
  onOpenSerp: () => void;
  onTrackKeyword: () => void;
  onExportData: () => void;
  className?: string;
  /** When true, render without border/background (e.g. inside a sheet) */
  embedded?: boolean;
}

export function KeywordDetailsPanel({
  keyword,
  serpResults,
  loading,
  onOpenSerp,
  onTrackKeyword,
  onExportData,
  className,
  embedded = false,
}: KeywordDetailsPanelProps) {
  if (!keyword) {
    return (
      <aside
        className={cn(
          !embedded && "border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950",
          "flex flex-col items-center justify-center p-8 text-center",
          className
        )}
      >
        <p className="text-zinc-500 dark:text-zinc-400">Select a keyword to view insights.</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Click a row in the table.</p>
      </aside>
    );
  }

  if (loading) {
    return <KeywordDetailsSkeleton className={className} />;
  }

  const wrapperClass = cn(
    "flex flex-col overflow-auto",
    !embedded && "border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950",
    className
  );

  return (
    <aside className={wrapperClass}>
      <div className="flex flex-col gap-6 p-4">
        {/* A. Keyword Summary */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{keyword.keyword}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Vol: <span className="font-medium text-zinc-700 dark:text-zinc-300">{keyword.volume.toLocaleString()}</span>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              KD: <span className="font-medium text-zinc-700 dark:text-zinc-300">{keyword.kd}</span>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              CPC: <span className="font-medium text-zinc-700 dark:text-zinc-300">${keyword.cpc.toFixed(2)}</span>
            </span>
            <Badge variant={intentVariant[keyword.intent]}>{keyword.intent}</Badge>
          </div>
        </section>

        {/* B. Trend Chart */}
        <section>
          <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Search volume trend</h3>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <TrendChart data={keyword.trend} />
          </div>
        </section>

        {/* C. SERP Analysis */}
        <section>
          <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Top SERP results</h3>
          <SerpList results={serpResults} />
        </section>

        {/* D. Actions */}
        <section className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenSerp} className="gap-2">
            <ExternalLink className="size-4" />
            Open SERP
          </Button>
          <Button variant="outline" size="sm" onClick={onTrackKeyword} className="gap-2">
            <TrendingUp className="size-4" />
            Track keyword
          </Button>
          <Button variant="outline" size="sm" onClick={onExportData} className="gap-2">
            <FileDown className="size-4" />
            Export data
          </Button>
        </section>
      </div>
    </aside>
  );
}

function KeywordDetailsSkeleton({ className }: { className?: string }) {
  return (
    <aside className={cn("flex flex-col border-l border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 overflow-auto", className)}>
      <div className="h-8 w-3/4 animate-pulse rounded bg-zinc-800" />
      <div className="mt-3 flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
        ))}
      </div>
      <div className="mt-6 h-[200px] w-full animate-pulse rounded-lg bg-zinc-800" />
      <div className="mt-6 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-800" />
        ))}
      </div>
    </aside>
  );
}
