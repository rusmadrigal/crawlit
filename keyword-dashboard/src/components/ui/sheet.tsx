"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Sheet({ open, onOpenChange, title, children, side = "right", className }: SheetProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={title ? "sheet-title" : undefined}
        className={cn(
          "fixed top-0 z-50 flex h-full w-full max-w-sm flex-col border-zinc-800 bg-zinc-900 shadow-xl transition-transform sm:max-w-md",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          {title && (
            <h2 id="sheet-title" className="text-sm font-semibold text-white">
              {title}
            </h2>
          )}
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </>
  );
}
