"use client";

import { Sheet } from "@/components/ui/sheet";
import { KeywordDetailsPanel } from "./KeywordDetailsPanel";
import type { KeywordRow, SerpResult } from "@/lib/mock-data";

interface MobileInsightsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: KeywordRow;
  serpResults: SerpResult[];
  onOpenSerp: () => void;
  onTrackKeyword: () => void;
  onExportData: () => void;
}

export function MobileInsightsSheet({
  open,
  onOpenChange,
  keyword,
  serpResults,
  onOpenSerp,
  onTrackKeyword,
  onExportData,
}: MobileInsightsSheetProps) {
  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={onOpenChange} title="Keyword insights" side="right" className="max-w-full sm:max-w-md">
        <div className="pb-8">
          <KeywordDetailsPanel
            keyword={keyword}
            serpResults={serpResults}
            onOpenSerp={onOpenSerp}
            onTrackKeyword={onTrackKeyword}
            onExportData={onExportData}
            embedded
          />
        </div>
      </Sheet>
    </div>
  );
}
