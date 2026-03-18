"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
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
  Activity,
  Calendar,
  Download,
  MessageSquare,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

const INTENT_UNKNOWN_KEY = "__unknown__";

const INTENT_BADGE_LETTER: Record<string, string> = {
  informational: "I",
  navigational: "N",
  commercial: "C",
  transactional: "T",
  transaction: "T",
  "commercial investigation": "CI",
};

function getIntentBadgeLetter(key: string): string {
  if (key === INTENT_UNKNOWN_KEY) return "—";
  return INTENT_BADGE_LETTER[key] ?? key.slice(0, 1).toUpperCase();
}

function normalizeIntentKey(intent: string | null | undefined): string {
  if (intent == null || !String(intent).trim()) return INTENT_UNKNOWN_KEY;
  return intent.toLowerCase().replace(/\s+/g, " ").trim();
}

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

type HistoryPoint = { date: string; organicPages: number; organicTraffic: number; organicKeywords?: number };

type OverviewData = {
  visibilityEtv?: number | null;
  organicCount?: number | null;
  history?: HistoryPoint[];
  historyError?: string;
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
  const [showOrganicPages, setShowOrganicPages] = useState(true);
  const [showOrganicTraffic, setShowOrganicTraffic] = useState(true);
  const [showOrganicKeywords, setShowOrganicKeywords] = useState(false);
  const [perfTimeRange, setPerfTimeRange] = useState<"12m" | "2y">("12m");
  const [perfGranularity, setPerfGranularity] = useState<"daily" | "monthly">("monthly");
  const [intentFilter, setIntentFilter] = useState<string[]>([]);
  const [intentDropdownOpen, setIntentDropdownOpen] = useState(false);
  const intentDropdownRef = useRef<HTMLDivElement>(null);

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
          history: data.history,
          historyError: data.historyError,
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

  useEffect(() => {
    if (!intentDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (intentDropdownRef.current && !intentDropdownRef.current.contains(e.target as Node)) {
        setIntentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [intentDropdownOpen]);

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

      {/* Performance chart — always show when overview is loaded */}
      {overviewData ? (
        <Card className="overflow-hidden border-[var(--card-border)] bg-[var(--card)] shadow-sm">
          <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Performance</span>
          </div>
          <CardContent className="pt-4">
            {/* Legend toggles + right controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOrganicPages}
                    onChange={(e) => setShowOrganicPages(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                    style={{ accentColor: "#2b76b9" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "#2b76b9" }}>Organic pages</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOrganicTraffic}
                    onChange={(e) => setShowOrganicTraffic(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                    style={{ accentColor: "#e68a00" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "#e68a00" }}>Organic traffic</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOrganicKeywords}
                    onChange={(e) => setShowOrganicKeywords(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                    style={{ accentColor: "#059669" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "#059669" }}>Organic keywords</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  <Calendar className="size-4 shrink-0" style={{ color: "var(--muted)" }} aria-hidden />
                  <select
                    value={perfTimeRange}
                    onChange={(e) => setPerfTimeRange(e.target.value as "12m" | "2y")}
                    className="cursor-pointer border-0 bg-transparent focus:outline-none focus:ring-0"
                    style={{ color: "var(--foreground)" }}
                  >
                    <option value="12m">Last 12 months</option>
                    <option value="2y">Last 2 years</option>
                  </select>
                </div>
                <div className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }} title="DataForSEO only provides monthly data">
                  <select
                    value={perfGranularity}
                    onChange={(e) => setPerfGranularity(e.target.value as "daily" | "monthly")}
                    className="cursor-pointer border-0 bg-transparent focus:outline-none focus:ring-0"
                    style={{ color: "var(--foreground)" }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily (monthly data)</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="rounded border p-2 transition-colors hover:bg-[var(--muted-bg)]"
                  style={{ borderColor: "var(--border)" }}
                  title="Notes"
                  aria-label="Notes"
                >
                  <MessageSquare className="size-4" style={{ color: "var(--muted)" }} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const chartData = (overviewData?.history?.length
                      ? overviewData.history
                      : (() => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = String(now.getMonth() + 1).padStart(2, "0");
                          return [
                            {
                              date: `${y}-${m}-01`,
                              organicPages: overviewData?.organicCount ?? 0,
                              organicTraffic: overviewData?.visibilityEtv ?? overviewData?.totalSearchVolume ?? 0,
                            },
                          ];
                        })()) as HistoryPoint[];
                    const cutoff = perfTimeRange === "2y" ? 24 : 12;
                    const filtered = chartData.slice(-cutoff);
                    const header = "date,organic_pages,organic_traffic\n";
                    const rows = filtered.map((d) => `${d.date},${d.organicPages},${d.organicTraffic}`).join("\n");
                    const blob = new Blob([header + rows], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `performance-${project?.domain ?? "export"}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted-bg)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Download className="size-4" aria-hidden />
                  Export
                </button>
              </div>
            </div>
            {/* Dual-axis line chart — use history or fallback to current metrics */}
            {(() => {
              const rawHistory = overviewData.history && overviewData.history.length > 0
                ? overviewData.history
                : null;
              const fallbackPoint: HistoryPoint[] = !rawHistory && (overviewData.organicCount != null || overviewData.visibilityEtv != null || (overviewData.totalSearchVolume != null && overviewData.totalSearchVolume > 0))
                ? (() => {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, "0");
                    return [
                      {
                        date: `${y}-${m}-01`,
                        organicPages: overviewData.organicCount ?? 0,
                        organicTraffic: Math.round(Number(overviewData.visibilityEtv ?? overviewData.totalSearchVolume ?? 0)),
                        organicKeywords: overviewData.keywordCount ?? undefined,
                      },
                    ];
                  })()
                : [];
              let chartData = rawHistory ?? fallbackPoint;
              if (chartData.length > 0 && overviewData.keywordCount != null) {
                chartData = chartData.map((p) => ({
                  ...p,
                  organicKeywords: p.organicKeywords ?? overviewData.keywordCount ?? undefined,
                }));
              }
              const formatDate = (d: string) => {
                const [y, m] = d.split("-");
                const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return `${months[Number(m) - 1]} ${y}`;
              };

              if (chartData.length === 0) {
                return (
                  <>
                    <div className="flex h-[280px] items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        No data yet. Refresh data to load Performance history.
                      </p>
                    </div>
                    {overviewData.historyError && (
                      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                        History unavailable: {overviewData.historyError}. Try Refresh later.
                      </p>
                    )}
                  </>
                );
              }

              const monthsBack = perfTimeRange === "2y" ? 24 : 12;
              const filtered = [...chartData].slice(-monthsBack);
              const maxPages = Math.max(1, ...filtered.map((r) => r.organicPages));
              const maxKeywords = Math.max(0, ...filtered.map((r) => r.organicKeywords ?? 0));
              const maxLeft = Math.max(maxPages, maxKeywords);
              const maxTraffic = Math.max(1, ...filtered.map((r) => r.organicTraffic));
              const leftTicks = [0, Math.round(maxLeft / 2), maxLeft];
              const rightTicks = [0, Math.round(maxTraffic / 2), maxTraffic];

              return (
                <>
                <div className="h-[320px] w-full rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filtered} margin={{ top: 16, right: 56, left: 48, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--muted)" }}
                        tickFormatter={formatDate}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 11, fill: "#2b76b9" }}
                        tickFormatter={(v) => String(v)}
                        ticks={leftTicks}
                        axisLine={false}
                        tickLine={{ stroke: "var(--border)" }}
                        label={{ value: "Organic pages", angle: -90, position: "insideLeft", style: { fill: "#2b76b9", fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "#e68a00" }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
                        ticks={rightTicks}
                        axisLine={false}
                        tickLine={{ stroke: "var(--border)" }}
                        label={{ value: "Organic traffic", angle: 90, position: "insideRight", style: { fill: "#e68a00", fontSize: 11 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                        labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                        labelFormatter={(label) => formatDate(label)}
                        formatter={(value: number, name: string) => [
                          name === "organicTraffic" && value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value,
                          name === "organicPages" ? "Organic pages" : name === "organicTraffic" ? "Organic traffic" : "Organic keywords",
                        ]}
                      />
                      {showOrganicPages && (
                        <Line
                          type="monotone"
                          dataKey="organicPages"
                          yAxisId="left"
                          stroke="#2b76b9"
                          strokeWidth={2}
                          dot={filtered.length <= 3}
                          name="organicPages"
                        />
                      )}
                      {showOrganicTraffic && (
                        <Line
                          type="monotone"
                          dataKey="organicTraffic"
                          yAxisId="right"
                          stroke="#e68a00"
                          strokeWidth={2}
                          dot={filtered.length <= 3}
                          name="organicTraffic"
                        />
                      )}
                      {showOrganicKeywords && (
                        <Line
                          type="monotone"
                          dataKey="organicKeywords"
                          yAxisId="left"
                          stroke="#059669"
                          strokeWidth={2}
                          dot={false}
                          name="organicKeywords"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {perfGranularity === "daily" && (
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Data is in monthly resolution; DataForSEO does not provide a daily series.
                  </p>
                )}
                {(!rawHistory || rawHistory.length === 0) && chartData.length > 0 ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {overviewData.historyError
                      ? `History unavailable: ${overviewData.historyError}. The chart shows only the current month with estimated data.`
                      : "Only the current month is shown. History (up to 2 years) is provided by DataForSEO; use Refresh to load previous months."}
                  </p>
                ) : null}
              </>
              );
            })()}
          </CardContent>
        </Card>
      ) : null}

      {/* Top keywords table */}
      {overviewData?.topKeywords && overviewData.topKeywords.length > 0 && (() => {
        const topKeywords = overviewData.topKeywords;
        const intentOptions = Array.from(
          new Map(
            topKeywords.map((kw) => {
              const key = normalizeIntentKey(kw.intent);
              const label = kw.intent?.trim() ? kw.intent : "Unknown";
              return [key, label] as const;
            })
          ).entries()
        )
          .map(([key, label]) => ({ key, label }))
          .sort((a, b) => a.label.localeCompare(b.label));
        const filteredKeywords =
          intentFilter.length === 0
            ? topKeywords
            : topKeywords.filter((kw) => intentFilter.includes(normalizeIntentKey(kw.intent)));
        return (
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
                    <th className="py-3 pr-4 text-right">
                      <div ref={intentDropdownRef} className="relative inline-flex items-center justify-end gap-1">
                        <span>Intent</span>
                        <button
                          type="button"
                          onClick={() => setIntentDropdownOpen((o) => !o)}
                          className="rounded p-0.5 transition-colors hover:bg-[var(--muted-bg)]"
                          style={{ color: "var(--muted)" }}
                          aria-label="Filter by intent"
                          aria-expanded={intentDropdownOpen}
                        >
                          <ChevronDown className="size-4 shrink-0" aria-hidden />
                        </button>
                        {intentDropdownOpen && (
                          <div
                            className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-lg border shadow-lg"
                            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                          >
                            <p className="px-3 py-2 text-xs font-medium" style={{ color: "var(--muted)" }}>
                              User intents
                            </p>
                            <ul className="max-h-64 overflow-y-auto py-1">
                              {intentOptions.map(({ key, label }) => {
                                const isChecked = intentFilter.length === 0 || intentFilter.includes(key);
                                const bgColor = key === INTENT_UNKNOWN_KEY ? "#64748b" : (INTENT_COLORS[key] ?? "#64748b");
                                return (
                                  <li key={key}>
                                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--muted-bg)]" style={{ color: "var(--foreground)" }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (intentFilter.length === 0) {
                                            setIntentFilter(intentOptions.map((o) => o.key).filter((k) => k !== key));
                                          } else if (intentFilter.includes(key)) {
                                            const next = intentFilter.filter((k) => k !== key);
                                            setIntentFilter(next.length === 0 ? [] : next);
                                          } else {
                                            setIntentFilter([...intentFilter, key]);
                                          }
                                        }}
                                        className="h-3.5 w-3.5 rounded border-[var(--border)]"
                                        style={{ accentColor: "var(--primary)" }}
                                      />
                                      <span className="flex-1">{label}</span>
                                      <span
                                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                                        style={{ backgroundColor: bgColor }}
                                      >
                                        {getIntentBadgeLetter(key)}
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                            {intentFilter.length > 0 && (
                              <div className="border-t py-1.5" style={{ borderColor: "var(--border)" }}>
                                <button
                                  type="button"
                                  onClick={() => setIntentFilter([])}
                                  className="w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-[var(--muted-bg)]"
                                  style={{ color: "var(--muted)" }}
                                >
                                  Clear filter
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </th>
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
                  {[...filteredKeywords]
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
        );
      })()}

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
