"use client";

import { Filter, Download, Command } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { COUNTRIES, DEVICES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface TopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  device: string;
  onDeviceChange: (v: string) => void;
  onFiltersClick: () => void;
  onExportClick: () => void;
  onCommandPaletteOpen: () => void;
  className?: string;
}

export function TopBar({
  search,
  onSearchChange,
  country,
  onCountryChange,
  device,
  onDeviceChange,
  onFiltersClick,
  onExportClick,
  onCommandPaletteOpen,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-100 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <SearchBar value={search} onChange={onSearchChange} className="min-w-[200px] max-w-md flex-1" />
        <Select
          value={country}
          onValueChange={onCountryChange}
          options={COUNTRIES}
          aria-label="Country"
        />
        <Select
          value={device}
          onValueChange={onDeviceChange}
          options={DEVICES}
          aria-label="Device"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onFiltersClick} className="gap-2">
          <Filter className="size-4" />
          Filters
        </Button>
        <Button variant="outline" size="sm" onClick={onExportClick} className="gap-2">
          <Download className="size-4" />
          Export
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCommandPaletteOpen}
          aria-label="Open command palette (Cmd+K)"
          className="hidden sm:inline-flex"
        >
          <Command className="size-4" />
        </Button>
      </div>
    </header>
  );
}
