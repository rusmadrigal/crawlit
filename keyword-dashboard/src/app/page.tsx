"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { TopBar } from "@/components/dashboard/TopBar";
import { FiltersBar } from "@/components/dashboard/FiltersBar";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import { KeywordDetailsPanel } from "@/components/dashboard/KeywordDetailsPanel";
import { MobileInsightsSheet } from "@/components/dashboard/MobileInsightsSheet";
import { Command, type CommandItem } from "@/components/ui/command";
import { ThemeToggle } from "@/components/providers/ThemeProvider";
import {
  MOCK_KEYWORDS,
  getSerpForKeyword,
  type KeywordRow,
  type Intent,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("us");
  const [device, setDevice] = useState("desktop");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordRow | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [volumeRange, setVolumeRange] = useState<[number, number]>([0, 200000]);
  const [kdRange, setKdRange] = useState<[number, number]>([0, 100]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");

  const filteredKeywords = useMemo(() => {
    let list = MOCK_KEYWORDS.filter((k) => {
      if (search && !k.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (k.volume < volumeRange[0] || k.volume > volumeRange[1]) return false;
      if (k.kd < kdRange[0] || k.kd > kdRange[1]) return false;
      if (intents.length > 0 && !intents.includes(k.intent)) return false;
      if (includeKeywords) {
        const terms = includeKeywords.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (terms.length && !terms.every((t) => k.keyword.toLowerCase().includes(t))) return false;
      }
      if (excludeKeywords) {
        const terms = excludeKeywords.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (terms.some((t) => k.keyword.toLowerCase().includes(t))) return false;
      }
      return true;
    });
    return list;
  }, [search, volumeRange, kdRange, intents, includeKeywords, excludeKeywords]);

  const serpResults = useMemo(() => {
    if (!selectedKeyword) return [];
    return getSerpForKeyword(selectedKeyword.id);
  }, [selectedKeyword]);

  const handleExport = useCallback(() => {
    // Mock export
    const data = selectedKeyword
      ? [selectedKeyword]
      : filteredKeywords;
    console.log("Export", data);
    alert(`Export ${data.length} keyword(s) (mock).`);
  }, [selectedKeyword, filteredKeywords]);

  const handleOpenSerp = useCallback(() => {
    if (selectedKeyword) {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(selectedKeyword.keyword)}`,
        "_blank"
      );
    }
  }, [selectedKeyword]);

  const handleTrackKeyword = useCallback(() => {
    if (selectedKeyword) {
      console.log("Track keyword", selectedKeyword.keyword);
      alert(`Track "${selectedKeyword.keyword}" (mock).`);
    }
  }, [selectedKeyword]);

  const handleFiltersApply = useCallback(() => {
    setFiltersOpen(false);
  }, []);

  const handleFiltersClear = useCallback(() => {
    setVolumeRange([0, 200000]);
    setKdRange([0, 100]);
    setIntents([]);
    setIncludeKeywords("");
    setExcludeKeywords("");
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commandItems: CommandItem[] = useMemo(
    () => [
      { id: "search", label: "Focus search", shortcut: "⌘K", onSelect: () => document.querySelector<HTMLInputElement>("[aria-label='Keyword search']")?.focus() },
      { id: "filters", label: "Open filters", onSelect: () => setFiltersOpen(true) },
      { id: "export", label: "Export data", onSelect: () => handleExport() },
      { id: "clear", label: "Clear selection", onSelect: () => setSelectedKeyword(null) },
    ],
    [handleExport]
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        country={country}
        onCountryChange={setCountry}
        device={device}
        onDeviceChange={setDevice}
        onFiltersClick={() => setFiltersOpen(true)}
        onExportClick={handleExport}
        onCommandPaletteOpen={() => setCommandOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-4 min-w-0">
          <KeywordTable
            data={filteredKeywords}
            selectedRowId={selectedKeyword?.id ?? null}
            onSelectRow={setSelectedKeyword}
            loading={loading}
          />
        </main>

        {/* Desktop: right panel */}
        <div className="hidden w-full flex-shrink-0 lg:block lg:max-w-[400px] xl:max-w-[420px]">
          <KeywordDetailsPanel
            keyword={selectedKeyword}
            serpResults={serpResults}
            onOpenSerp={handleOpenSerp}
            onTrackKeyword={handleTrackKeyword}
            onExportData={handleExport}
          />
        </div>
      </div>

      {/* Mobile: insights sheet when a keyword is selected */}
      {selectedKeyword && (
        <MobileInsightsSheet
          open={!!selectedKeyword}
          onOpenChange={(open) => !open && setSelectedKeyword(null)}
          keyword={selectedKeyword}
          serpResults={serpResults}
          onOpenSerp={handleOpenSerp}
          onTrackKeyword={handleTrackKeyword}
          onExportData={handleExport}
        />
      )}

      <FiltersBar
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        volumeRange={volumeRange}
        onVolumeRangeChange={setVolumeRange}
        kdRange={kdRange}
        onKdRangeChange={setKdRange}
        intents={intents}
        onIntentsChange={setIntents}
        includeKeywords={includeKeywords}
        onIncludeKeywordsChange={setIncludeKeywords}
        excludeKeywords={excludeKeywords}
        onExcludeKeywordsChange={setExcludeKeywords}
        onApply={handleFiltersApply}
        onClear={handleFiltersClear}
      />

      <Command open={commandOpen} onOpenChange={setCommandOpen} items={commandItems} />

      <div className="fixed bottom-4 right-4 flex gap-2">
        <ThemeToggle />
      </div>
    </div>
  );
}
