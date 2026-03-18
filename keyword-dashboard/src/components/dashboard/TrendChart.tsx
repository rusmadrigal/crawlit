"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TrendChartProps {
  data: number[];
  className?: string;
}

export function TrendChart({ data, className }: TrendChartProps) {
  const chartData = useMemo(
    () =>
      data.map((value, i) => ({
        name: MONTHS[i] ?? String(i + 1),
        value,
        full: `${MONTHS[i] ?? ""} ${value}`,
      })),
    [data]
  );

  return (
    <div className={cn("h-[200px] w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => String(v)}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value) => [value ?? 0, "Volume"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#a1a1aa"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#71717a" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
