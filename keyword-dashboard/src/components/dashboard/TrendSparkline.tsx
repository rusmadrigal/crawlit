"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TrendSparklineProps {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}

export function TrendSparkline({ data, className, width = 80, height = 24 }: TrendSparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = (width - 4) / (data.length - 1);
    const points = data.map((v, i) => {
      const x = 2 + i * stepX;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [data, width, height]);

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-500"
      />
    </svg>
  );
}
