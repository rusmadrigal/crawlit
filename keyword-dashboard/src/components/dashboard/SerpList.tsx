"use client";

import { ExternalLink } from "lucide-react";
import type { SerpResult } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface SerpListProps {
  results: SerpResult[];
  className?: string;
}

export function SerpList({ results, className }: SerpListProps) {
  if (results.length === 0) {
    return (
      <div className={cn("rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center text-sm text-zinc-500", className)}>
        No SERP data available.
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {results.map((r) => (
        <li
          key={r.position}
          className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:bg-zinc-800/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="mr-2 text-xs font-medium tabular-nums text-zinc-500">
                #{r.position}
              </span>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-white hover:underline"
              >
                {r.title}
              </a>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{r.domain}</p>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-white"
              aria-label={`Open ${r.domain}`}
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
