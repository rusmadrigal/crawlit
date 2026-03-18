"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

export function Select<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex h-9 min-w-[120px] items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-white shadow-sm transition-colors",
          "hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-zinc-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onValueChange(opt.value as T);
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm transition-colors",
                value === opt.value ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              )}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
