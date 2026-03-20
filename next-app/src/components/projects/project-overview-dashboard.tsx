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
import { DayPicker, type DateRange } from "react-day-picker";
import { enUS } from "date-fns/locale";
import { format, subDays, subMonths } from "date-fns";
import "react-day-picker/style.css";
import { useProjects } from "@/components/providers/projects-provider";
import { DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { cn } from "@/lib/utils";
import type { PerformanceNote } from "@/types/project";

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
    <span
      className="inline-flex h-6 w-12 cursor-pointer items-center justify-center rounded bg-[var(--muted-bg)] transition-opacity hover:opacity-80"
      title="View position history (Search Console)"
    >
      <svg width={32} height={16} className="opacity-50" aria-hidden>
        <line x1={2} y1={8} x2={30} y2={8} stroke="currentColor" strokeWidth={1} />
      </svg>
    </span>
  ) : (
    <span className="inline-flex cursor-pointer items-center justify-center" title="View position history (12–24 months)">
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
      aria-label={`View position history for ${keyword}`}
    >
      {content}
    </button>
  );
}

type GscKeywordHistoryPoint = { date: string; position: number };

function localYesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

type HistoryRangePreset = "12" | "24" | "custom";

/** Modal: position history from GSC (presets, custom calendar range) or short fallback from overview. */
function KeywordPositionHistoryModal({
  keyword,
  open,
  onClose,
  gscSiteUrl,
  shortPositionHistory,
}: {
  keyword: string;
  open: boolean;
  onClose: () => void;
  gscSiteUrl: string | null;
  shortPositionHistory?: number[];
}) {
  const [rangePreset, setRangePreset] = useState<HistoryRangePreset>("12");
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(undefined);
  const [customApplied, setCustomApplied] = useState<{ from: Date; to: Date } | null>(null);
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [points, setPoints] = useState<GscKeywordHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retentionNote, setRetentionNote] = useState<string | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);

  const yMax = localYesterday();

  const handlePreset12 = () => {
    setRangePreset("12");
    setCustomApplied(null);
    setShowCustomCalendar(false);
  };
  const handlePreset24 = () => {
    setRangePreset("24");
    setCustomApplied(null);
    setShowCustomCalendar(false);
  };
  const handlePresetCustom = () => {
    setRangePreset("custom");
    setCustomApplied(null);
    setShowCustomCalendar(true);
    setPoints([]);
    setRangeLabel(null);
    setRetentionNote(null);
    setError(null);
    const y = localYesterday();
    setCalendarRange({ from: subDays(y, 27), to: y });
  };
  const applyCustomRange = () => {
    if (!calendarRange?.from || !calendarRange?.to) return;
    setPoints([]);
    setError(null);
    setRetentionNote(null);
    setRangeLabel(null);
    setCustomApplied({ from: calendarRange.from, to: calendarRange.to });
    setShowCustomCalendar(false);
  };

  useEffect(() => {
    if (open) {
      setRangePreset("12");
      setCustomApplied(null);
      setShowCustomCalendar(false);
      const y = localYesterday();
      setCalendarRange({ from: subDays(y, 27), to: y });
    }
  }, [open, keyword]);

  useEffect(() => {
    if (!open || !gscSiteUrl || !keyword.trim()) {
      if (!open) {
        setPoints([]);
        setError(null);
        setRetentionNote(null);
        setRangeLabel(null);
      }
      return;
    }

    if (rangePreset === "custom") {
      if (!customApplied?.from || !customApplied?.to) {
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const base = `/api/gsc/keyword-position-history?keyword=${encodeURIComponent(keyword)}&gsc_site_url=${encodeURIComponent(gscSiteUrl)}`;
    const url =
      rangePreset === "custom" && customApplied?.from && customApplied?.to
        ? `${base}&start_date=${format(customApplied.from, "yyyy-MM-dd")}&end_date=${format(customApplied.to, "yyyy-MM-dd")}`
        : `${base}&months=${rangePreset === "24" ? 24 : 12}`;

    fetch(url)
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          points?: GscKeywordHistoryPoint[];
          range?: { startDate: string; endDate: string; monthsRequested?: number; custom?: boolean };
          note?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load position history");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPoints(data.points ?? []);
        setRetentionNote(data.note ?? null);
        const r = data.range;
        setRangeLabel(r ? `${r.startDate} → ${r.endDate}` : null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, keyword, gscSiteUrl, rangePreset, customApplied]);

  if (!open) return null;

  const showLong = Boolean(gscSiteUrl);
  const shortChartData =
    shortPositionHistory && shortPositionHistory.length >= 2
      ? shortPositionHistory.map((position, i) => ({ day: i + 1, position }))
      : [];

  const formatDateTick = (dateStr: string) => {
    const [y, m] = dateStr.split("-");
    if (!y || !m) return dateStr;
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${mo[Number(m) - 1] ?? m} ${y}`;
  };

  const chartMargin = { top: 12, right: 16, left: 4, bottom: 8 };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyword-position-history-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h3 id="keyword-position-history-title" className="text-lg font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
              Position history
            </h3>
            <p className="mt-1 text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>
              {keyword}
            </p>
            {rangeLabel && (
              <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                {rangeLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--muted-bg)]"
            aria-label="Close"
          >
            <span className="text-xl leading-none" style={{ color: "var(--muted)" }}>
              ×
            </span>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {showLong ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Range
                  </span>
                  <div className="inline-flex flex-wrap rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
                    <button
                      type="button"
                      onClick={handlePreset12}
                      className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: rangePreset === "12" ? "var(--muted-bg)" : "transparent",
                        color: "var(--foreground)",
                      }}
                    >
                      Last 12 months
                    </button>
                    <button
                      type="button"
                      onClick={handlePreset24}
                      className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: rangePreset === "24" ? "var(--muted-bg)" : "transparent",
                        color: "var(--foreground)",
                      }}
                    >
                      Last 24 months
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetCustom}
                      className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: rangePreset === "custom" ? "var(--muted-bg)" : "transparent",
                        color: "var(--foreground)",
                      }}
                    >
                      Custom range
                    </button>
                  </div>
                </div>

                {rangePreset === "custom" && showCustomCalendar && (
                  <div
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
                    style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}
                  >
                    <DayPicker
                      mode="range"
                      selected={calendarRange}
                      onSelect={(range) => {
                        setCalendarRange(range);
                      }}
                      numberOfMonths={2}
                      locale={enUS}
                      defaultMonth={subMonths(yMax, 1)}
                      disabled={{ after: yMax }}
                      className="mx-auto sm:mx-0"
                      style={{
                        color: "var(--foreground)",
                        // Make the calendar visually consistent with the app theme.
                        ["--rdp-accent-color" as any]: "var(--primary)",
                        ["--rdp-accent-background-color" as any]: "color-mix(in srgb, var(--primary) 18%, transparent)",
                        ["--rdp-day_button-border" as any]: "1px solid var(--border)",
                        ["--rdp-weekday-text-transform" as any]: "none",
                      }}
                    />
                    <div className="flex flex-col gap-2 sm:min-w-[140px]">
                      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                        {calendarRange?.from && calendarRange?.to
                          ? `${format(calendarRange.from, "MMM d, yyyy")} – ${format(calendarRange.to, "MMM d, yyyy")}`
                          : "Select a start and end date."}
                      </p>
                      <button
                        type="button"
                        onClick={applyCustomRange}
                        disabled={!calendarRange?.from || !calendarRange?.to || loading}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        Apply range
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {loading && (
                <div className="flex h-72 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--muted-bg)" }}>
                  <Loader2 className="size-8 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
                </div>
              )}

              {!loading && error && (
                <p className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "#dc2626" }}>
                  {error}
                </p>
              )}

              {!loading && !error && points.length >= 2 && (
                <div className="h-80 w-full rounded-xl border pt-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={chartMargin}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickFormatter={formatDateTick}
                        minTickGap={28}
                        stroke="var(--border)"
                      />
                      <YAxis
                        reversed
                        domain={["auto", "auto"]}
                        width={44}
                        tick={{ fontSize: 11, fill: "var(--muted)" }}
                        stroke="var(--border)"
                        label={{
                          value: "Avg. position",
                          angle: -90,
                          position: "insideLeft",
                          style: { fill: "var(--muted)", fontSize: 11 },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        }}
                        labelFormatter={(label) => label}
                        formatter={(value) => [`${Number(value).toFixed(1)}`, "Avg. position"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="position"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={points.length <= 45}
                        activeDot={{ r: 4 }}
                        name="position"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!loading && !error && points.length < 2 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {rangePreset === "custom" && !customApplied
                    ? "Select start and end dates, then click Apply range to load the chart."
                    : "No daily position data in Search Console for this query in the selected range."}
                </p>
              )}

              {retentionNote && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {retentionNote}
                </p>
              )}
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Lower values mean a better average position. Source: Google Search Console (Search Analytics).
              </p>
            </>
          ) : shortChartData.length >= 2 ? (
            <>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Quick view: last 28 days (same window as the table). Link Search Console to load 12 / 24 months or a custom range.
              </p>
              <div className="h-64 w-full rounded-xl border pt-2" style={{ borderColor: "var(--border)" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={shortChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)" }} stroke="var(--border)" />
                    <YAxis
                      reversed
                      domain={["auto", "auto"]}
                      width={44}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      stroke="var(--border)"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`${Number(value).toFixed(1)}`, "Avg. position"]}
                    />
                    <Line type="monotone" dataKey="position" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : !gscSiteUrl ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Link a Search Console property to this project to load position history (presets or custom dates).
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No position history is available for this keyword.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Modal: Add and manage Performance chart notes (date, rich text, resource link). */
function PerformanceNotesModal({
  open,
  onClose,
  notes,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  notes: PerformanceNote[];
  onSave: (notes: PerformanceNote[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formResourceUrl, setFormResourceUrl] = useState("");
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const resetForm = useCallback(() => {
    setFormDate("");
    setFormContent("");
    setFormResourceUrl("");
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "";
    }
    setAddOpen(false);
    setEditingId(null);
  }, []);

  const handleSaveNote = useCallback(() => {
    const content = contentEditableRef.current?.innerHTML?.trim() || formContent;
    if (!formDate.trim()) return;
    const resourceUrl = formResourceUrl.trim() || undefined;
    if (editingId) {
      const next = notes.map((n) =>
        n.id === editingId ? { ...n, date: formDate, content: content || n.content, resourceUrl } : n
      );
      onSave(next);
    } else {
      const newNote: PerformanceNote = {
        id: crypto.randomUUID(),
        date: formDate,
        content: content || "<p></p>",
        resourceUrl,
        createdAt: new Date().toISOString(),
      };
      onSave([...notes, newNote]);
    }
    resetForm();
  }, [editingId, formDate, formContent, formResourceUrl, notes, onSave, resetForm]);

  const handleDelete = useCallback(
    (id: string) => {
      onSave(notes.filter((n) => n.id !== id));
      if (editingId === id) resetForm();
    },
    [notes, onSave, editingId, resetForm]
  );

  const setBold = useCallback(() => document.execCommand("bold", false), []);
  const setItalic = useCallback(() => document.execCommand("italic", false), []);
  const setLink = useCallback(() => {
    const url = window.prompt("Link URL:", "https://");
    if (url?.trim()) document.execCommand("createLink", false, url.trim());
  }, []);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="performance-notes-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border shadow-lg"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
          <h3 id="performance-notes-title" className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Performance notes
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
        <div className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}
              >
                {editingId === n.id ? (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      />
                      <button type="button" onClick={() => handleSaveNote()} className="rounded bg-[var(--primary)] px-3 py-1 text-sm text-white">Save</button>
                      <button type="button" onClick={() => { setEditingId(null); resetForm(); }} className="rounded border px-3 py-1 text-sm" style={{ borderColor: "var(--border)" }}>Cancel</button>
                    </div>
                    <div className="mb-2 flex gap-1 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                      <button type="button" onClick={setBold} className="rounded border px-2 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>B</button>
                      <button type="button" onClick={setItalic} className="rounded border px-2 py-1 text-xs italic" style={{ borderColor: "var(--border)" }}>I</button>
                      <button type="button" onClick={setLink} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>Link</button>
                    </div>
                    <div
                      ref={contentEditableRef}
                      contentEditable
                      className="min-h-[80px] rounded border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      dangerouslySetInnerHTML={{ __html: n.content }}
                      suppressContentEditableWarning
                    />
                    <input
                      type="url"
                      placeholder="Resource link (URL)"
                      value={formResourceUrl}
                      onChange={(e) => setFormResourceUrl(e.target.value)}
                      className="mt-2 w-full rounded border px-2 py-1 text-sm"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{n.date}</span>
                      <span className="flex gap-1">
                        <button type="button" onClick={() => { setAddOpen(false); setEditingId(n.id); setFormDate(n.date); setFormContent(n.content); setFormResourceUrl(n.resourceUrl ?? ""); }} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>Edit</button>
                        <button type="button" onClick={() => handleDelete(n.id)} className="rounded border px-2 py-0.5 text-xs text-red-600" style={{ borderColor: "var(--border)" }}>Delete</button>
                      </span>
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--muted)" }} dangerouslySetInnerHTML={{ __html: n.content }} />
                    {n.resourceUrl && (
                      <a href={n.resourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--primary)] underline">
                        <Link2 className="size-3" /> Resource
                      </a>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {!addOpen && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setAddOpen(true); setFormDate(new Date().toISOString().slice(0, 10)); setFormContent(""); setFormResourceUrl(""); }}
              className="mt-4 inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted-bg)]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <MessageSquare className="size-4" /> Add note
            </button>
          )}
          {addOpen && (
            <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--foreground)" }}>Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mb-3 w-full rounded border px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--foreground)" }}>Content (rich text)</label>
              <div className="mb-2 flex gap-1" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={setBold} className="rounded border px-2 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>B</button>
                <button type="button" onClick={setItalic} className="rounded border px-2 py-1 text-xs italic" style={{ borderColor: "var(--border)" }}>I</button>
                <button type="button" onClick={setLink} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>Link</button>
              </div>
              <div
                ref={contentEditableRef}
                contentEditable
                className="min-h-[100px] rounded border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                suppressContentEditableWarning
              />
              <label className="mt-3 mb-1 block text-sm font-medium" style={{ color: "var(--foreground)" }}>Resource (link)</label>
              <input
                type="url"
                placeholder="https://..."
                value={formResourceUrl}
                onChange={(e) => setFormResourceUrl(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={handleSaveNote} className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">Save note</button>
                <button type="button" onClick={resetForm} className="rounded border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type TopKeywordRow = {
  keyword: string;
  searchVolume: number;
  position?: number | null;
  url?: string | null;
  keywordDifficulty?: number | null;
  intent?: string | null;
  /** Daily average position from GSC (oldest → newest), when top keywords are GSC-backed. */
  positionHistory?: number[];
};

/**
 * WoW-style change: avg position last 7 days vs prior 7 days (same window as GSC `positionHistory`).
 * @returns positive = better (average position number went down), null if not enough days.
 */
function computeAvgPositionWowChange(positionHistory: number[] | undefined): number | null {
  if (!positionHistory || positionHistory.length < 14) return null;
  const last7 = positionHistory.slice(-7);
  const prev7 = positionHistory.slice(-14, -7);
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return avg(prev7) - avg(last7);
}

function PositionWowChangeCell({ positionHistory }: { positionHistory: number[] | undefined }) {
  const ch = computeAvgPositionWowChange(positionHistory);
  if (ch === null) {
    return <span style={{ color: "var(--muted)" }}>—</span>;
  }
  if (Math.abs(ch) < 0.05) {
    return (
      <span className="tabular-nums" style={{ color: "var(--muted)" }} title="Avg position stable vs prior 7 days">
        ≈0
      </span>
    );
  }
  const t = ch.toFixed(1);
  if (ch > 0) {
    return (
      <span
        className="tabular-nums font-medium"
        style={{ color: "#059669" }}
        title="Better average position vs the 7 days before (lower is better)"
      >
        +{t}
      </span>
    );
  }
  return (
    <span
      className="tabular-nums font-medium"
      style={{ color: "#dc2626" }}
      title="Worse average position vs the 7 days before"
    >
      {t}
    </span>
  );
}

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

const KEYWORD_FILTER_OPERATORS = [
  { value: "is", label: "Is" },
  { value: "is_not", label: "Is not" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Doesn't contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "not_starts_with", label: "Doesn't start with" },
  { value: "not_ends_with", label: "Doesn't end with" },
  { value: "regex", label: "Matches regex" },
  { value: "not_regex", label: "Doesn't match regex" },
] as const;

function matchKeywordFilter(keyword: string, operator: string, value: string, matchMode: "all" | "any"): boolean {
  const raw = value.trim();
  if (!raw) return true;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return true;
  const kw = keyword.toLowerCase();
  const isNegative = ["is_not", "not_contains", "not_starts_with", "not_ends_with", "not_regex"].includes(operator);
  if (isNegative) {
    return values.every((v) => {
      const vLower = v.toLowerCase();
      try {
        switch (operator) {
          case "is_not":
            return kw !== vLower;
          case "not_contains":
            return !kw.includes(vLower);
          case "not_starts_with":
            return !kw.startsWith(vLower);
          case "not_ends_with":
            return !kw.endsWith(vLower);
          case "not_regex":
            return !new RegExp(v, "i").test(keyword);
          default:
            return true;
        }
      } catch {
        return true;
      }
    });
  }
  const testOne = (v: string): boolean => {
    const vLower = v.toLowerCase();
    try {
      switch (operator) {
        case "is":
          return kw === vLower;
        case "contains":
          return kw.includes(vLower);
        case "starts_with":
          return kw.startsWith(vLower);
        case "ends_with":
          return kw.endsWith(vLower);
        case "regex":
          return new RegExp(v, "i").test(keyword);
        default:
          return kw.includes(vLower);
      }
    } catch {
      return false;
    }
  };
  return matchMode === "all" ? values.every(testOne) : values.some(testOne);
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
  /** GSC order (28d); volume from DataForSEO Google Ads; KD/intent from DataForSEO. */
  topKeywordsFromGsc?: boolean;
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
  const { projects, deleteProject, updateProject } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  const [overviewData, setOverviewData] = useState<OverviewData>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [historyModalKeyword, setHistoryModalKeyword] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "position">("volume");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showOrganicPages, setShowOrganicPages] = useState(true);
  const [showOrganicTraffic, setShowOrganicTraffic] = useState(true);
  const [showOrganicKeywords, setShowOrganicKeywords] = useState(false);
  const [perfTimeRange, setPerfTimeRange] = useState<"12m" | "2y">("12m");
  const [perfGranularity, setPerfGranularity] = useState<"daily" | "monthly">("daily");
  const [intentFilter, setIntentFilter] = useState<string[]>([]);
  const [intentDropdownOpen, setIntentDropdownOpen] = useState(false);
  const intentDropdownRef = useRef<HTMLDivElement>(null);
  const [keywordFilter, setKeywordFilter] = useState<{ operator: string; value: string; matchMode: "all" | "any" } | null>(null);
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const [keywordFilterDraft, setKeywordFilterDraft] = useState<{ operator: string; value: string; matchMode: "all" | "any" }>({ operator: "contains", value: "", matchMode: "any" });
  const keywordDropdownRef = useRef<HTMLDivElement>(null);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [ga4Properties, setGa4Properties] = useState<{ propertyId: string; displayName: string }[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);
  const [gscSites, setGscSites] = useState<{ siteUrl: string }[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chartNoteOpen, setChartNoteOpen] = useState<PerformanceNote | null>(null);

  const locationCode = project?.locationCode ?? DEFAULT_LOCATION_CODE;

  const fetchOverview = useCallback(
    async (refresh = false, granularityOverride?: "daily" | "monthly", timeRangeOverride?: "12m" | "2y") => {
      if (!project?.domain) return;
      const gran = granularityOverride ?? perfGranularity;
      const range = timeRangeOverride ?? perfTimeRange;
      if (refresh) setRefreshing(true);
      else setOverviewLoading(true);
      setOverviewError(null);
      try {
        const gaParam = project?.ga4PropertyId ? `&ga4_property_id=${encodeURIComponent(project.ga4PropertyId)}` : "";
        const gscParam = project?.gscSiteUrl ? `&gsc_site_url=${encodeURIComponent(project.gscSiteUrl)}` : "";
        const granParam = gran === "daily" ? `&granularity=daily&days=${range === "2y" ? 365 : 90}` : "";
        const url = `/api/domain-overview?domain=${encodeURIComponent(project.domain)}&location_code=${locationCode}${refresh ? "&refresh=1" : ""}${gaParam}${gscParam}${granParam}`;
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
          topKeywordsFromGsc: data.topKeywordsFromGsc === true,
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
    [project?.domain, project?.ga4PropertyId, project?.gscSiteUrl, locationCode, perfGranularity, perfTimeRange]
  );


  const fetchGa4Properties = useCallback(async () => {
    setGa4Loading(true);
    setGa4Error(null);
    try {
      const res = await fetch("/api/ga4/properties");
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setGa4Error(data?.error ?? "Failed to load GA4 properties");
        setGa4Properties([]);
        return;
      }
      setGa4Properties(Array.isArray(data.properties) ? data.properties : []);
    } catch {
      setGa4Error("Failed to load GA4 properties");
      setGa4Properties([]);
    } finally {
      setGa4Loading(false);
    }
  }, []);

  const fetchGscSites = useCallback(async () => {
    setGscLoading(true);
    setGscError(null);
    try {
      const res = await fetch("/api/gsc/sites");
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setGscError(data?.error ?? "Failed to load Search Console sites");
        setGscSites([]);
        return;
      }
      setGscSites(Array.isArray(data.sites) ? data.sites : []);
    } catch {
      setGscError("Failed to load Search Console sites");
      setGscSites([]);
    } finally {
      setGscLoading(false);
    }
  }, []);

  const pagesChartLabel = project?.gscSiteUrl ? "Page indexing (GSC)" : "Organic pages";
  const keywordsChartLabel = project?.gscSiteUrl ? "Organic queries (GSC)" : "Organic keywords";

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

  useEffect(() => {
    if (!keywordDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (keywordDropdownRef.current && !keywordDropdownRef.current.contains(e.target as Node)) {
        setKeywordDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [keywordDropdownOpen]);

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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGa4Error(null);
                  fetchGa4Properties();
                }}
                disabled={ga4Loading}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                title="Connect GA4 and select a property for this project"
              >
                {ga4Loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                GA4
              </button>
              {ga4Properties.length > 0 && (
                <select
                  value={project.ga4PropertyId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const prop = ga4Properties.find((p) => p.propertyId === value);
                    updateProject(projectId, {
                      ga4PropertyId: value || undefined,
                      ga4PropertyName: prop?.displayName || undefined,
                    });
                    // refresh overview to use GA4 traffic
                    fetchOverview(true);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
                  title="GA4 property for this project"
                >
                  <option value="">Select GA4 property…</option>
                  {ga4Properties.map((p) => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              )}
              {!ga4Loading && ga4Properties.length === 0 && (
                <a
                  href={`/api/ga4/oauth/start?redirect_to=${encodeURIComponent(`/p/${projectId}`)}&reauth=1`}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted-bg)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  title="Connect Google (GA4 + Search Console read access)"
                >
                  Connect Google
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setGscError(null);
                  fetchGscSites();
                }}
                disabled={gscLoading}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                title="Load Search Console properties (uses same Google sign-in)"
              >
                {gscLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                GSC
              </button>
              {gscSites.length > 0 && (
                <select
                  value={project.gscSiteUrl ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const site = gscSites.find((s) => s.siteUrl === value);
                    updateProject(projectId, {
                      gscSiteUrl: value || undefined,
                      gscSiteLabel: site?.siteUrl || undefined,
                    });
                    fetchOverview(true);
                  }}
                  className="max-w-[220px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
                  title="Search Console property for page indexing in Performance chart"
                >
                  <option value="">Select GSC property…</option>
                  {gscSites.map((s) => (
                    <option key={s.siteUrl} value={s.siteUrl}>
                      {s.siteUrl}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
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
      {ga4Error && (
        <p className="text-sm" style={{ color: "var(--muted)" }} role="alert">
          {ga4Error}
        </p>
      )}
      {gscError && (
        <p className="text-sm" style={{ color: "var(--muted)" }} role="alert">
          {gscError}
        </p>
      )}

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
              {project?.gscSiteUrl ? "Search queries" : "Organic keywords"}
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
                  {overviewData.cached ? "Cached · " : ""}
                  {project?.gscSiteUrl ? "Distinct queries (last 28 days)" : "From DataForSEO"}
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
                  <span className="text-sm font-medium" style={{ color: "#2b76b9" }}>{pagesChartLabel}</span>
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
                  <span className="text-sm font-medium" style={{ color: "#059669" }}>{keywordsChartLabel}</span>
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
                <div className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }} title={project?.ga4PropertyId ? "GA4 Organic Search by day" : "Connect GA4 to see daily sessions"}>
                  <select
                    value={perfGranularity}
                    onChange={(e) => setPerfGranularity(e.target.value as "daily" | "monthly")}
                    className="cursor-pointer border-0 bg-transparent focus:outline-none focus:ring-0"
                    style={{ color: "var(--foreground)" }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="rounded border p-2 transition-colors hover:bg-[var(--muted-bg)]"
                  style={{ borderColor: "var(--border)" }}
                  title="Add or view notes on the chart"
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
                    const isDailyExport = chartData.length > 0 && chartData[0]?.date?.length === 10;
                    const cutoff = perfTimeRange === "2y" ? 24 : 12;
                    const filtered = isDailyExport ? chartData : chartData.slice(-cutoff);
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
              const isDaily = perfGranularity === "daily" && chartData.length > 0 && chartData[0]?.date?.length === 10;
              const formatDate = (d: string) => {
                const parts = d.split("-");
                const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                if (parts.length >= 3 && isDaily) return `${months[Number(parts[1]) - 1]} ${Number(parts[2])}`;
                if (parts.length >= 2) return `${months[Number(parts[1]) - 1]} ${parts[0]}`;
                return d;
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
              const filtered = isDaily ? [...chartData] : [...chartData].slice(-monthsBack);
              // Use data size to decide note matching: many points = daily (match by date), few = monthly (match by month).
              // So notes show in both views and while daily data is loading (we still have monthly points).
              const chartHasDailyPoints = filtered.length > 31;
              const notesForDate = (date: string) =>
                (project?.performanceNotes ?? []).filter((n) =>
                  chartHasDailyPoints ? n.date === date : `${n.date.slice(0, 7)}-01` === date
                );
              const filteredWithNotes = filtered.map((d) => {
                const _notes = notesForDate(d.date);
                return { ...d, _notes, noteY: _notes.length ? 0 : undefined };
              });
              const maxPages = Math.max(1, ...filtered.map((r) => r.organicPages));
              const maxKeywords = Math.max(0, ...filtered.map((r) => r.organicKeywords ?? 0));
              const maxLeft = Math.max(maxPages, maxKeywords);
              const maxTraffic = Math.max(1, ...filtered.map((r) => r.organicTraffic));
              const leftTicks = [0, Math.round(maxLeft / 2), maxLeft];
              const rightTicks = [0, Math.round(maxTraffic / 2), maxTraffic];

              const NoteDot = (props: { cx?: number; cy?: number; payload?: { _notes?: PerformanceNote[] } }) => {
                const { cx = 0, cy = 0, payload } = props;
                const notes = payload?._notes;
                if (!notes?.length) return null;
                const note = notes[0];
                const toggleNote = () => setChartNoteOpen((prev) => (prev?.id === note.id ? null : note));
                return (
                  <g
                    transform={`translate(${cx}, ${cy})`}
                    onClick={toggleNote}
                    onKeyDown={(e) => e.key === "Enter" && toggleNote()}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    aria-label={chartNoteOpen?.id === note.id ? `Close note for ${note.date}` : `Note for ${note.date}`}
                  >
                    <circle r={10} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
                    <text y={4} textAnchor="middle" fill="var(--card)" fontSize={10} fontWeight="bold">i</text>
                  </g>
                );
              };

              return (
                <>
                <div className="h-[320px] w-full rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredWithNotes} margin={{ top: 16, right: 56, left: 48, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--muted)" }}
                        tickFormatter={formatDate}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={{ stroke: "var(--border)" }}
                        interval={isDaily ? Math.max(0, Math.floor(filtered.length / 10)) : 0}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 11, fill: "#2b76b9" }}
                        tickFormatter={(v) => String(v)}
                        ticks={leftTicks}
                        axisLine={false}
                        tickLine={{ stroke: "var(--border)" }}
                        label={{ value: pagesChartLabel, angle: -90, position: "insideLeft", style: { fill: "#2b76b9", fontSize: 11 } }}
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
                        formatter={(value, name) => {
                          const n = Number(value ?? 0);
                          const label =
                            name === "organicPages"
                              ? pagesChartLabel
                              : name === "organicTraffic"
                                ? "Organic traffic"
                                : keywordsChartLabel;
                          const shown = name === "organicTraffic" && n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n;
                          return [shown, label];
                        }}
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
                      <Line
                        type="monotone"
                        dataKey="noteY"
                        yAxisId="left"
                        stroke="none"
                        dot={<NoteDot />}
                        connectNulls={false}
                        name=""
                        legendType="none"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {chartNoteOpen && (
                  <div
                    className="mt-3 rounded-lg border p-4"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}
                    role="dialog"
                    aria-label="Note"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>{chartNoteOpen.date}</p>
                        <div className="mt-1 text-sm" style={{ color: "var(--foreground)" }} dangerouslySetInnerHTML={{ __html: chartNoteOpen.content }} />
                        {chartNoteOpen.resourceUrl && (
                          <a href={chartNoteOpen.resourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--primary)] underline">
                            <Link2 className="size-3.5" /> Resource
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setChartNoteOpen(null)}
                        className="shrink-0 rounded p-1.5 transition-colors hover:bg-[var(--border)]"
                        aria-label="Close note"
                      >
                        <span className="text-lg leading-none" style={{ color: "var(--muted)" }}>×</span>
                      </button>
                    </div>
                  </div>
                )}
                {perfGranularity === "daily" && (
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {isDaily ? "GA4 Organic Search sessions by day." : "Connect GA4 to see daily sessions."}
                  </p>
                )}
                {project?.gscSiteUrl && (
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Page indexing (GSC): count of distinct URLs with search impressions per period (Search Analytics API). Reconnect with &quot;Connect Google&quot; if GSC sites fail to load.
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

      <PerformanceNotesModal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={project?.performanceNotes ?? []}
        onSave={(notes) => project?.id && updateProject(project.id, { performanceNotes: notes })}
      />

      {/* Top keywords table — GSC-backed list can be empty (no queries in 28d) */}
      {overviewData &&
        ((overviewData.topKeywords && overviewData.topKeywords.length > 0) || overviewData.topKeywordsFromGsc) &&
        (() => {
        const topKeywords = overviewData.topKeywords ?? [];
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
        let filteredKeywords =
          intentFilter.length === 0
            ? topKeywords
            : topKeywords.filter((kw) => intentFilter.includes(normalizeIntentKey(kw.intent)));
        if (keywordFilter && keywordFilter.value.trim()) {
          filteredKeywords = filteredKeywords.filter((kw) =>
            matchKeywordFilter(kw.keyword, keywordFilter.operator, keywordFilter.value, keywordFilter.matchMode)
          );
        }
        return (
        <div className="ml-2 mt-2 md:ml-4">
          <h2
            className={`text-lg font-semibold ${overviewData.topKeywordsFromGsc ? "mb-1" : "mb-4"}`}
            style={{ color: "var(--foreground)" }}
          >
            Top keywords
          </h2>
          {overviewData.topKeywordsFromGsc ? (
            <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
              Queries ordered by Search Console performance (last 28 days). Volume from DataForSEO (Google Ads search volume);
              KD from DataForSEO Labs (bulk keyword difficulty); intent from DataForSEO. If Ads has no volume for a query,
              GSC impressions are shown instead. Change compares average position in the last 7 days vs the previous 7 days
              (+ = better ranking).
            </p>
          ) : null}
          <Card className="overflow-hidden border-[var(--card-border)] bg-[var(--card)]">
            <div className="overflow-x-auto px-4">
              {topKeywords.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No search queries with data in the last 28 days in Search Console.
                </p>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b text-left font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--table-head)" }}
                  >
                    <th className="py-3 pl-4 pr-4">
                      <div ref={keywordDropdownRef} className="relative inline-flex items-center gap-1">
                        <span>Keyword</span>
                        <button
                          type="button"
                          onClick={() => {
                            setKeywordDropdownOpen((o) => !o);
                            if (!keywordDropdownOpen && keywordFilter) {
                              setKeywordFilterDraft({ operator: keywordFilter.operator, value: keywordFilter.value, matchMode: keywordFilter.matchMode });
                            } else if (!keywordDropdownOpen) {
                              setKeywordFilterDraft({ operator: "contains", value: "", matchMode: "any" });
                            }
                          }}
                          className="rounded p-0.5 transition-colors hover:bg-[var(--muted-bg)]"
                          style={{ color: "var(--muted)" }}
                          aria-label="Filter by keyword"
                          aria-expanded={keywordDropdownOpen}
                        >
                          <ChevronDown className="size-4 shrink-0" aria-hidden />
                        </button>
                        {keywordDropdownOpen && (
                          <div
                            className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border shadow-lg"
                            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                          >
                            <div className="border-b p-2" style={{ borderColor: "var(--border)" }}>
                              <div className="mb-2 flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--muted-bg)" }}>
                                <button
                                  type="button"
                                  onClick={() => setKeywordFilterDraft((d) => ({ ...d, matchMode: "all" }))}
                                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${keywordFilterDraft.matchMode === "all" ? "" : "opacity-70"}`}
                                  style={{
                                    backgroundColor: keywordFilterDraft.matchMode === "all" ? "var(--card)" : "transparent",
                                    color: "var(--foreground)",
                                    boxShadow: keywordFilterDraft.matchMode === "all" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                  }}
                                >
                                  All rules
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setKeywordFilterDraft((d) => ({ ...d, matchMode: "any" }))}
                                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${keywordFilterDraft.matchMode === "any" ? "" : "opacity-70"}`}
                                  style={{
                                    backgroundColor: keywordFilterDraft.matchMode === "any" ? "var(--card)" : "transparent",
                                    color: "var(--foreground)",
                                    boxShadow: keywordFilterDraft.matchMode === "any" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                  }}
                                >
                                  Any rule
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <select
                                  value={keywordFilterDraft.operator}
                                  onChange={(e) => setKeywordFilterDraft((d) => ({ ...d, operator: e.target.value }))}
                                  className="flex-1 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
                                >
                                  {KEYWORD_FILTER_OPERATORS.map((op) => (
                                    <option key={op.value} value={op.value}>
                                      {op.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="text"
                                value={keywordFilterDraft.value}
                                onChange={(e) => setKeywordFilterDraft((d) => ({ ...d, value: e.target.value }))}
                                placeholder="Values separated by commas"
                                className="mt-2 w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t p-2" style={{ borderColor: "var(--border)" }}>
                              {keywordFilter && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKeywordFilter(null);
                                    setKeywordFilterDraft({ operator: "contains", value: "", matchMode: "any" });
                                    setKeywordDropdownOpen(false);
                                  }}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: "var(--muted)" }}
                                >
                                  Clear filter
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (keywordFilterDraft.value.trim()) {
                                    setKeywordFilter({
                                      operator: keywordFilterDraft.operator,
                                      value: keywordFilterDraft.value,
                                      matchMode: keywordFilterDraft.matchMode,
                                    });
                                  } else {
                                    setKeywordFilter(null);
                                  }
                                  setKeywordDropdownOpen(false);
                                }}
                                className="ml-auto rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                                style={{ backgroundColor: "var(--primary)", color: "white" }}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
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
                    <th
                      className="py-3 pr-4"
                      title="Average position: last 7 days vs the 7 days before. + = improved (lower avg position). Uses Search Console daily series when available."
                    >
                      Change
                    </th>
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
                          {kw.position != null ? kw.position : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <PositionWowChangeCell positionHistory={kw.positionHistory} />
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
                            points={kw.positionHistory ?? []}
                            onOpenHistory={setHistoryModalKeyword}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              )}
            </div>
          </Card>
        </div>
        );
      })()}

      <KeywordPositionHistoryModal
        keyword={historyModalKeyword ?? ""}
        open={historyModalKeyword !== null}
        onClose={() => setHistoryModalKeyword(null)}
        gscSiteUrl={project?.gscSiteUrl ?? null}
        shortPositionHistory={overviewData?.topKeywords?.find((k) => k.keyword === historyModalKeyword)?.positionHistory}
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
