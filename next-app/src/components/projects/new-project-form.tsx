"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/components/providers/projects-provider";
import { normalizeDomain } from "@/lib/projects";
import { COUNTRY_LOCATIONS, DEFAULT_LOCATION_CODE } from "@/lib/locations";
import { Loader2 } from "lucide-react";

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  submitLabel?: string;
};

export function NewProjectForm({ onSuccess, onCancel, showCancel, submitLabel = "Create project" }: Props) {
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState<number>(DEFAULT_LOCATION_CODE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { addProject, refreshProjects } = useProjects();
  const router = useRouter();

  const selectedLocation = COUNTRY_LOCATIONS.find((l) => l.locationCode === locationCode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const raw = domain.trim();
    if (!raw) {
      setError("Enter a domain (e.g. example.com)");
      return;
    }
    const normalized = normalizeDomain(raw);
    if (!normalized) {
      setError("Enter a valid domain");
      return;
    }
    setLoading(true);
    try {
      const project = addProject(
        normalized,
        name.trim() || undefined,
        locationCode,
        selectedLocation?.locationName
      );
      refreshProjects();
      onSuccess?.();
      router.push(`/p/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-project-domain" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Domain
        </label>
        <input
          id="new-project-domain"
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          disabled={loading}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
        />
      </div>
      <div>
        <label htmlFor="new-project-name" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Project name <span className="font-normal text-[var(--muted)]">(optional)</span>
        </label>
        <input
          id="new-project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main site"
          disabled={loading}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
        />
      </div>
      <div>
        <label htmlFor="new-project-country" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Country
        </label>
        <select
          id="new-project-country"
          value={locationCode}
          onChange={(e) => setLocationCode(Number(e.target.value))}
          disabled={loading}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
        >
          {COUNTRY_LOCATIONS.map((loc) => (
            <option key={loc.locationCode} value={loc.locationCode}>
              {loc.locationName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Keyword volumes and rankings will use data for this country.
        </p>
      </div>
      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : submitLabel}
        </Button>
        {showCancel && onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
