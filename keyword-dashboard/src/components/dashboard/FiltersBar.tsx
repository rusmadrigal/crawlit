"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Intent } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volumeRange: [number, number];
  onVolumeRangeChange: (v: [number, number]) => void;
  kdRange: [number, number];
  onKdRangeChange: (v: [number, number]) => void;
  intents: Intent[];
  onIntentsChange: (v: Intent[]) => void;
  includeKeywords: string;
  onIncludeKeywordsChange: (v: string) => void;
  excludeKeywords: string;
  onExcludeKeywordsChange: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}

const INTENT_OPTIONS: Intent[] = ["Informational", "Commercial", "Transactional"];

export function FiltersBar({
  open,
  onOpenChange,
  volumeRange,
  onVolumeRangeChange,
  kdRange,
  onKdRangeChange,
  intents,
  onIntentsChange,
  includeKeywords,
  onIncludeKeywordsChange,
  excludeKeywords,
  onExcludeKeywordsChange,
  onApply,
  onClear,
}: FiltersBarProps) {
  const toggleIntent = (intent: Intent) => {
    if (intents.includes(intent)) {
      onIntentsChange(intents.filter((i) => i !== intent));
    } else {
      onIntentsChange([...intents, intent]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filters" side="right">
      <div className="flex flex-col gap-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Volume range</label>
          <Slider
            value={volumeRange}
            onChange={onVolumeRangeChange}
            min={0}
            max={200000}
            step={1000}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Keyword Difficulty (KD)</label>
          <Slider value={kdRange} onChange={onKdRangeChange} min={0} max={100} step={5} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Intent</label>
          <div className="flex flex-wrap gap-2">
            {INTENT_OPTIONS.map((intent) => (
              <button
                key={intent}
                type="button"
                onClick={() => toggleIntent(intent)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  intents.includes(intent)
                    ? "border-zinc-500 bg-zinc-700 text-white"
                    : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                {intent}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Include keywords</label>
          <textarea
            value={includeKeywords}
            onChange={(e) => onIncludeKeywordsChange(e.target.value)}
            placeholder="e.g. seo, marketing"
            rows={2}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Exclude keywords</label>
          <textarea
            value={excludeKeywords}
            onChange={(e) => onExcludeKeywordsChange(e.target.value)}
            placeholder="e.g. free, cheap"
            rows={2}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onApply}>
            Apply
          </Button>
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
