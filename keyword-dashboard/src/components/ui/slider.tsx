"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: [number, number];
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: [number, number]) => void;
}

export function Slider({ value, min = 0, max = 100, step = 1, onChange, className, ...props }: SliderProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const isControlled = onChange !== undefined;
  const [low, high] = isControlled ? value : localValue;

  const update = React.useCallback(
    (next: [number, number]) => {
      if (!isControlled) setLocalValue(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  const handleLow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), high - step);
    update([v, high]);
  };
  const handleHigh = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), low + step);
    update([low, v]);
  };

  const lowPct = ((low - min) / (max - min)) * 100;
  const highPct = ((high - min) / (max - min)) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <div className="relative flex h-6 items-center">
        <div className="h-1.5 w-full rounded-full bg-zinc-800" />
        <div
          className="absolute h-1.5 rounded-full bg-zinc-500"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={handleLow}
          className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={handleHigh}
          className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
