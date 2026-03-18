"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  className?: string;
}

export function Command({ open, onOpenChange, items, className }: CommandProps) {
  const [selected, setSelected] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelected(0);
  }, [open]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, items.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter") {
        e.preventDefault();
        items[selected]?.onSelect();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selected, items, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => onOpenChange(false)} />
      <div
        ref={ref}
        role="dialog"
        aria-modal
        className={cn(
          "fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden",
          className
        )}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
          <Search className="size-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            autoFocus
          />
          <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-500">ESC</kbd>
        </div>
        <ul className="max-h-72 overflow-auto py-1">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  item.onSelect();
                  onOpenChange(false);
                }}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                  i === selected ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                {item.label}
                {item.shortcut && <span className="text-xs text-zinc-500">{item.shortcut}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
