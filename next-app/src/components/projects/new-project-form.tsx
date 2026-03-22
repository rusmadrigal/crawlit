"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/components/providers/projects-provider";
import { normalizeDomain } from "@/lib/projects";
import { COUNTRY_LOCATIONS, DEFAULT_LOCATION_CODE, getCountryFlagEmoji } from "@/lib/locations";
import { Loader2, ChevronDown, Search } from "lucide-react";

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
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addProject, refreshProjects } = useProjects();
  const router = useRouter();

  const selectedLocation = COUNTRY_LOCATIONS.find((l) => l.locationCode === locationCode);
  const filteredLocations = countrySearch.trim()
    ? COUNTRY_LOCATIONS.filter((l) =>
        l.locationName.toLowerCase().includes(countrySearch.trim().toLowerCase())
      )
    : COUNTRY_LOCATIONS;

  useEffect(() => {
    if (!countryOpen) return;
    searchInputRef.current?.focus();
    setCountrySearch("");
  }, [countryOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    }
    if (countryOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [countryOpen]);

  async function handleSubmit(e: React.FormEvent) {
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
      const project = await addProject(
        normalized,
        name.trim() || undefined,
        locationCode,
        selectedLocation?.locationName
      );
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
      <div ref={countryRef} className="relative">
        <label id="new-project-country-label" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Country
        </label>
        <button
          type="button"
          id="new-project-country"
          aria-haspopup="listbox"
          aria-expanded={countryOpen}
          aria-labelledby="new-project-country-label"
          disabled={loading}
          onClick={() => setCountryOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--foreground)" }}
        >
          <span className="flex items-center gap-2">
            {selectedLocation && (
              <>
                <span className="text-lg leading-none" aria-hidden>
                  {getCountryFlagEmoji(selectedLocation.countryIso)}
                </span>
                <span>{selectedLocation.locationName}</span>
              </>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0" style={{ color: "var(--muted)" }} aria-hidden />
        </button>
        {countryOpen && (
          <div
            role="listbox"
            aria-labelledby="new-project-country-label"
            className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-lg border shadow-lg"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            <div className="flex items-center gap-2 border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
              <Search className="size-4 shrink-0" style={{ color: "var(--muted)" }} aria-hidden />
              <input
                ref={searchInputRef}
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCountryOpen(false);
                }}
                placeholder="Search country..."
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm focus:outline-none focus:ring-0"
                style={{ color: "var(--foreground)" }}
                aria-label="Search country"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredLocations.length === 0 ? (
                <li className="px-3 py-2 text-sm" style={{ color: "var(--muted)" }}>
                  No country found
                </li>
              ) : (
                filteredLocations.map((loc) => (
                  <li key={loc.locationCode} role="option" aria-selected={loc.locationCode === locationCode}>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationCode(loc.locationCode);
                        setCountryOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--muted-bg)] focus:bg-[var(--muted-bg)] focus:outline-none"
                      style={{
                        backgroundColor: loc.locationCode === locationCode ? "var(--muted-bg)" : undefined,
                        color: "var(--foreground)",
                      }}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {getCountryFlagEmoji(loc.countryIso)}
                      </span>
                      <span>{loc.locationName}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
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
