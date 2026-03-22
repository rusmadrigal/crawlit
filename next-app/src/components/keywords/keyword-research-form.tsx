"use client";

import { useState } from "react";
import Link from "next/link";
import { useDataforseoPreference } from "@/components/providers/dataforseo-preference-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertCircle, TrendingUp, PieChart } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";

type KeywordItem = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  competition: number | null;
  intent: string | null;
  monthlySearches: { year: number; month: number; searchVolume: number }[];
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function aggregateVolumeTrend(items: KeywordItem[]): { month: string; volume: number }[] {
  const byKey: Record<string, number> = {};
  for (const item of items) {
    for (const m of item.monthlySearches ?? []) {
      const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
      byKey[key] = (byKey[key] ?? 0) + m.searchVolume;
    }
  }
  return Object.entries(byKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, volume]) => {
      const [y, mo] = key.split("-");
      const monthIndex = parseInt(mo, 10) - 1;
      return { month: `${MONTH_LABELS[monthIndex]} ${y}`, volume };
    });
}

function intentDistribution(items: KeywordItem[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const intent = item.intent?.trim() || "Unknown";
    counts[intent] = (counts[intent] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

const INTENT_COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5"];

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-[var(--muted)]">—</span>;
  const colorIndex = Math.abs(intent.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % INTENT_COLORS.length;
  const bg = INTENT_COLORS[colorIndex];
  return (
    <span
      className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      {intent}
    </span>
  );
}

export function KeywordResearchForm() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<KeywordItem[]>([]);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const { dataforseoApiEnabled } = useDataforseoPreference();

  async function checkConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setApiConfigured(data.dataforseoConfigured === true);
    } catch {
      setApiConfigured(false);
    }
  }

  if (apiConfigured === null) {
    checkConfig();
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  if (!apiConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Search keywords
          </CardTitle>
          <CardDescription>
            Add your DataForSEO API key to run keyword research.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
            Set <code className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--muted-bg)" }}>DATAFORSEO_API_KEY</code> in{" "}
            <code className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--muted-bg)" }}>.env.local</code> in the{" "}
            <code className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--muted-bg)" }}>next-app</code> folder (Base64 of login:password).
          </p>
          <Link
            href="/help/dataforseo-api-key"
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium shadow-sm transition-colors hover:opacity-90"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            Setup guide
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!dataforseoApiEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Search keywords
          </CardTitle>
          <CardDescription>
            DataForSEO API requests are disabled in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
            Enable &quot;Allow API requests&quot; in Settings to run keyword research.
          </p>
          <Link
            href="/config"
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium shadow-sm transition-colors hover:opacity-90"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            Open Settings
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setItems([]);
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/keywords/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), limit: 50 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Search keywords
          </CardTitle>
          <CardDescription>
            Enter a seed keyword to get volume, KD, and CPC estimates from DataForSEO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
            <label htmlFor="keyword" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Keyword or topic
            </label>
            <div className="flex gap-2">
              <input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. best running shoes"
                disabled={loading}
                className="flex-1 rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
              />
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <>
          {aggregateVolumeTrend(items).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5" />
                  Search volume trend
                </CardTitle>
                <CardDescription>Aggregated monthly search volume across keywords (from DataForSEO).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregateVolumeTrend(items)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--card-border)",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "var(--foreground)" }}
                        formatter={(value) => [Number(value ?? 0).toLocaleString(), "Volume"]}
                      />
                      <Line type="monotone" dataKey="volume" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="size-5" />
                Intent distribution
              </CardTitle>
              <CardDescription>Share of keywords by search intent.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={intentDistribution(items)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {intentDistribution(items).map((_, i) => (
                        <Cell key={i} fill={INTENT_COLORS[i % INTENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--card-border)",
                        borderRadius: 8,
                      }}
                      formatter={(value, name) => [Number(value ?? 0), String(name ?? "")]}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results ({items.length})</CardTitle>
              <CardDescription>Keyword ideas for &quot;{keyword}&quot;</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left font-medium" style={{ borderColor: "var(--border)", color: "var(--table-head)" }}>
                      <th className="pb-3 pr-4">Keyword</th>
                      <th className="pb-3 pr-4 text-right">Volume</th>
                      <th className="pb-3 pr-4 text-right">KD</th>
                      <th className="pb-3 pr-4 text-right">CPC</th>
                      <th className="pb-3">Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => (
                      <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                        <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--foreground)" }}>{row.keyword}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--muted)]">
                          {row.searchVolume != null ? row.searchVolume.toLocaleString() : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--muted)]">
                          {row.keywordDifficulty != null ? row.keywordDifficulty : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--muted)]">
                          {row.cpc != null ? `$${row.cpc.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5">
                          <IntentBadge intent={row.intent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
