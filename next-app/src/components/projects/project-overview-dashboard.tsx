"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Link2,
  ClipboardCheck,
  Bot,
  TrendingUp,
  FileText,
  BarChart3,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useProjects } from "@/components/providers/projects-provider";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { cn } from "@/lib/utils";

/** Mini sparkline for ranking history. Click opens modal with history. */
function RankingHistorySparkline({
  keyword,
  points,
  onOpenHistory,
}: {
  keyword: string;
  points: number[];
  onOpenHistory: (keyword: string) => void;
}) {
  const isEmpty = points.length < 2;
  const content = isEmpty ? (
    <span className="inline-flex h-6 w-12 cursor-pointer items-center justify-center rounded bg-[var(--muted-bg)] transition-opacity hover:opacity-80" title="View history">
      <svg width={32} height={16} className="opacity-50" aria-hidden>
        <line x1={2} y1={8} x2={30} y2={8} stroke="currentColor" strokeWidth={1} />
      </svg>
    </span>
  ) : (
    <span className="inline-flex cursor-pointer items-center justify-center" title="View history">
      <svg width={32} height={14} className="text-[var(--primary)]" aria-hidden>
        <path
          d={(() => {
            const max = Math.max(...points);
            const min = Math.min(...points);
            const range = max - min || 1;
            const w = 32;
            const h = 14;
            const pad = 1;
            const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - 2 * pad));
            const ys = points.map((p) => h - pad - ((p - min) / range) * (h - 2 * pad));
            return xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
          })()}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
  return (
    <button
      type="button"
      onClick={() => onOpenHistory(keyword)}
      className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      aria-label={`View ranking history for ${keyword}`}
    >
      {content}
    </button>
  );
}

/** Modal: Ranking history for a keyword */
function RankingHistoryModal({
  keyword,
  open,
  onClose,
  historyPoints,
}: {
  keyword: string;
  open: boolean;
  onClose: () => void;
  historyPoints?: number[];
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-history-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl border shadow-lg"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
          <h3 id="ranking-history-title" className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Ranking history
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-[var(--muted-bg)]"
            aria-label="Close"
          >
            <span className="text-xl leading-none" style={{ color: "var(--muted)" }}>×</span>
          </button>
        </div>
        <div className="p-4">
          <p className="mb-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {keyword}
          </p>
          {historyPoints && historyPoints.length >= 2 ? (
            <div className="h-40 w-full">
              <svg viewBox={`0 0 300 120`} className="h-full w-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={historyPoints
                    .map((p, i) => {
                      const x = (i / (historyPoints.length - 1)) * 280 + 10;
                      const max = Math.max(...historyPoints);
                      const min = Math.min(...historyPoints);
                      const range = max - min || 1;
                      const y = 110 - ((p - min) / range) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
              <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                Position over time (lower is better)
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No ranking history data yet. History will appear when position tracking data is available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type TopKeywordRow = {
  keyword: string;
  searchVolume: number;
  cpc?: number | null;
  position?: number | null;
  url?: string | null;
  keywordDifficulty?: number | null;
  intent?: string | null;
};

const INTENT_COLORS: Record<string, string> = {
  informational: "#2563eb",
  transaction: "#059669",
  transactional: "#059669",
  commercial: "#d97706",
  navigational: "#7c3aed",
  "commercial investigation": "#0891b2",
};

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span style={{ color: "var(--muted)" }}>—</span>;
  const key = intent.toLowerCase().replace(/\s+/g, " ");
  const bg = INTENT_COLORS[key] ?? "#64748b";
  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      {intent}
    </span>
  );
}

function SortableHeader({
  label,
  active,
  order,
  onClick,
}: {
  label: string;
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded"
    >
      {label}
      {active ? (
        order === "desc" ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronUp className="size-4 shrink-0" aria-hidden />
        )
      ) : (
        <span className="inline-block w-4" aria-hidden />
      )}
    </button>
  );
}

type OverviewData = {
  visibilityEtv?: number | null;
  organicCount?: number | null;
  keywordCount?: number;
  totalSearchVolume?: number;
  topKeywords?: TopKeywordRow[];
  cached?: boolean;
} | null;

const overviewActions = [
  {
    segment: "keywords",
    label: "GAP Analysis",
    description: "Find keywords by volume, difficulty and intent for this domain.",
    icon: Search,
  },
  {
    segment: "backlinks",
    label: "Backlinks",
    description: "Explore referring domains and backlink profile.",
    icon: Link2,
  },
  {
    segment: "audit",
    label: "Site Audit",
    description: "Crawl and check technical SEO issues.",
    icon: ClipboardCheck,
  },
  {
    segment: "ai",
    label: "AI Visibility",
    description: "AI-powered SEO suggestions and content ideas.",
    icon: Bot,
  },
] as const;

export function ProjectOverviewDashboard({ projectId }: { projectId: string }) {
  const { projects, deleteProject } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  const [overviewData, setOverviewData] = useState<OverviewData>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [historyModalKeyword, setHistoryModalKeyword] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "cpc" | "position">("volume");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const locationCode = project?.locationCode ?? DEFAULT_LOCATION_CODE;

  const fetchOverview = useCallback(
    async (refresh = false) => {
      if (!project?.domain) return;
      if (refresh) setRefreshing(true);
      else setOverviewLoading(true);
      setOverviewError(null);
      try {
        const url = `/api/domain-overview?domain=${encodeURIComponent(project.domain)}&location_code=${locationCode}${refresh ? "&refresh=1" : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setOverviewError(data.error ?? "Failed to load");
          setOverviewData(null);
          return;
        }
        setOverviewData({
          visibilityEtv: data.visibilityEtv,
          organicCount: data.organicCount,
          keywordCount: data.keywordCount,
          totalSearchVolume: data.totalSearchVolume,
          topKeywords: data.topKeywords,
          cached: data.cached,
        });
      } catch {
        setOverviewError("Request failed");
        setOverviewData(null);
      } finally {
        setOverviewLoading(false);
        setRefreshing(false);
      }
    },
    [project?.domain, locationCode]
  );

  useEffect(() => {
    if (project?.domain) fetchOverview();
    else setOverviewData(null);
  }, [project?.domain, fetchOverview]);

  const isLoading = overviewLoading && !overviewData;
  const isRefreshing = refreshing;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: "var(--foreground)" }}
          >
            {project ? project.name : "Project"}
          </h1>
          <p className="mt-1 font-mono text-sm" style={{ color: "var(--muted)" }}>
            {project?.domain ?? projectId}
            {project?.locationName && (
              <span className="ml-2 text-[var(--muted)]">· {project.locationName}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project?.domain && (
            <button
              type="button"
              onClick={() => fetchOverview(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} aria-hidden />
              {isRefreshing ? "Updating…" : overviewData?.cached ? "Refresh data" : "Refresh"}
            </button>
          )}
          {project && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                  deleteProject(projectId);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
              title="Delete project"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete project
            </button>
          )}
        </div>
      </div>

      {/* Summary cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[var(--card-border)] bg-[var(--card)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
              <TrendingUp className="size-4" aria-hidden />
              Visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
            ) : overviewError ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>{overviewError}</p>
            ) : overviewData?.visibilityEtv != null && overviewData.visibilityEtv > 0 ? (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {overviewData.visibilityEtv >= 1000
                    ? `${(overviewData.visibilityEtv / 1000).toFixed(1)}K`
                    : overviewData.visibilityEtv.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {overviewData.cached ? "Cached · " : ""}Est. monthly traffic
                </p>
              </>
            ) : overviewData?.totalSearchVolume != null && overviewData.totalSearchVolume > 0 ? (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {overviewData.totalSearchVolume >= 1000
                    ? `${(overviewData.totalSearchVolume / 1000).toFixed(1)}K`
                    : overviewData.totalSearchVolume.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {overviewData.cached ? "Cached · " : ""}Keyword volume (est.)
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>—</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {overviewData?.keywordCount !== undefined ? "No traffic data" : "Add API key to load"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-[var(--card-border)] bg-[var(--card)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
              <BarChart3 className="size-4" aria-hidden />
              Organic keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
            ) : overviewError ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>{overviewError}</p>
            ) : overviewData?.keywordCount !== undefined ? (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {overviewData.keywordCount.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {overviewData.cached ? "Cached · " : ""}From DataForSEO
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>—</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Add API key to load</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-[var(--card-border)] bg-[var(--card)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
              <FileText className="size-4" aria-hidden />
              Total search volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
            ) : overviewData?.totalSearchVolume !== undefined ? (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {overviewData.totalSearchVolume >= 1000
                    ? `${(overviewData.totalSearchVolume / 1000).toFixed(1)}K`
                    : overviewData.totalSearchVolume.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Est. monthly
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>—</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>From keywords data</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-[var(--card-border)] bg-[var(--card)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
              <Link2 className="size-4" aria-hidden />
              Backlinks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>—</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Check Backlinks section</p>
          </CardContent>
        </Card>
      </div>

      {/* Top keywords table */}
      {overviewData?.topKeywords && overviewData.topKeywords.length > 0 && (
        <div className="ml-2 mt-2 md:ml-4">
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Top keywords
          </h2>
          <Card className="overflow-hidden border-[var(--card-border)] bg-[var(--card)]">
            <div className="overflow-x-auto px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b text-left font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--table-head)" }}
                  >
                    <th className="py-3 pl-4 pr-4">Keyword</th>
                    <th className="py-3 pr-4 text-right">
                      <SortableHeader
                        label="Volume"
                        active={sortBy === "volume"}
                        order={sortOrder}
                        onClick={() => {
                          if (sortBy === "volume") setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
                          else {
                            setSortBy("volume");
                            setSortOrder("desc");
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 pr-4 text-right">Intent</th>
                    <th className="py-3 pr-4 text-right">KD</th>
                    <th className="py-3 pr-4 text-right">
                      <SortableHeader
                        label="CPC"
                        active={sortBy === "cpc"}
                        order={sortOrder}
                        onClick={() => {
                          if (sortBy === "cpc") setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
                          else {
                            setSortBy("cpc");
                            setSortOrder("desc");
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 pr-4 text-right">
                      <SortableHeader
                        label="Position"
                        active={sortBy === "position"}
                        order={sortOrder}
                        onClick={() => {
                          if (sortBy === "position") setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
                          else {
                            setSortBy("position");
                            setSortOrder("asc");
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 pr-4">Change</th>
                    <th className="py-3 pr-4 min-w-[180px]">URL</th>
                    <th className="py-3 pl-4 pr-4 w-20 text-center">History</th>
                  </tr>
                </thead>
                <tbody>
                  {[...overviewData.topKeywords]
                    .sort((a, b) => {
                      let va: number, vb: number;
                      if (sortBy === "volume") {
                        va = a.searchVolume;
                        vb = b.searchVolume;
                      } else if (sortBy === "cpc") {
                        va = a.cpc ?? 0;
                        vb = b.cpc ?? 0;
                      } else {
                        va = a.position ?? 999;
                        vb = b.position ?? 999;
                      }
                      if (sortOrder === "asc") return va - vb;
                      return vb - va;
                    })
                    .map((kw, i) => (
                      <tr
                        key={i}
                        className="group border-b transition-all duration-200 ease-out hover:bg-[var(--muted-bg)]/60"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="py-2.5 pl-4 pr-4 font-medium transition-shadow duration-200 ease-out group-hover:shadow-[inset_2px_0_0_0_var(--primary)]" style={{ color: "var(--foreground)" }}>
                          {kw.keyword}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                          {kw.searchVolume.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <IntentBadge intent={kw.intent ?? null} />
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                          {kw.keywordDifficulty != null ? kw.keywordDifficulty : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                          {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                          {kw.position != null ? kw.position : "—"}
                        </td>
                        <td className="py-2.5 pr-4" style={{ color: "var(--muted)" }}>
                          —
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs" style={{ color: "var(--muted)" }}>
                          {kw.url ? (
                            <a
                              href={kw.url.startsWith("http") ? kw.url : `https://${kw.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate max-w-[200px] inline-block align-bottom hover:underline"
                              style={{ color: "var(--primary)" }}
                            >
                              {kw.url}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pl-4 pr-4">
                          <RankingHistorySparkline
                            keyword={kw.keyword}
                            points={[]}
                            onOpenHistory={setHistoryModalKeyword}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <RankingHistoryModal
        keyword={historyModalKeyword ?? ""}
        open={historyModalKeyword !== null}
        onClose={() => setHistoryModalKeyword(null)}
        historyPoints={undefined}
      />

      {/* Quick actions - main tools */}
      <div>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overviewActions.map(({ segment, label, description, icon: Icon }) => (
            <Link key={segment} href={`/p/${projectId}/${segment}`}>
              <Card
                className={cn(
                  "h-full transition-shadow hover:shadow-md",
                  "border-[var(--card-border)] bg-[var(--card)]"
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-5" style={{ color: "var(--primary)" }} aria-hidden />
                    {label}
                  </CardTitle>
                  <CardDescription className="text-sm">{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
