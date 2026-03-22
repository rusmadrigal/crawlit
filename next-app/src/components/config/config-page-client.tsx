"use client";

import Link from "next/link";
import { useDataforseoPreference } from "@/components/providers/dataforseo-preference-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-blue-600" : "bg-slate-300"}
        focus:ring-blue-500
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
          transition-transform
          ${checked ? "translate-x-6" : "translate-x-1"}
        `}
      />
    </button>
  );
}

export function ConfigPageClient() {
  const { dataforseoApiEnabled, setDataforseoApiEnabled } = useDataforseoPreference();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12" style={{ backgroundColor: "var(--background)" }}>
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--muted)" }}
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Configure app behavior and API usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DataForSEO API</CardTitle>
          <CardDescription>
            When off, the app uses only cached data. No new API requests are made until you turn it back on.
            Use this to avoid API costs when you don&apos;t need fresh data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium" style={{ color: "var(--foreground)" }}>
                Allow API requests
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {dataforseoApiEnabled ? "On – Overview and keyword research fetch new data" : "Off – Only cached data is shown"}
              </p>
            </div>
            <Switch checked={dataforseoApiEnabled} onCheckedChange={setDataforseoApiEnabled} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
