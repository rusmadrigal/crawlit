"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type Row,
} from "@tanstack/react-table";
import { useMemo, useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { TrendSparkline } from "./TrendSparkline";
import type { KeywordRow, Intent } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: unknown) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-zinc-400 focus:ring-zinc-500"
      aria-label="Select all"
    />
  );
}

const intentVariant: Record<Intent, "informational" | "commercial" | "transactional"> = {
  Informational: "informational",
  Commercial: "commercial",
  Transactional: "transactional",
};

interface KeywordTableProps {
  data: KeywordRow[];
  selectedRowId: string | null;
  onSelectRow: (row: KeywordRow | null) => void;
  loading?: boolean;
  className?: string;
}

export function KeywordTable({ data, selectedRowId, onSelectRow, loading, className }: KeywordTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "volume", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo<ColumnDef<KeywordRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <SelectAllCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-zinc-400 focus:ring-zinc-500"
            aria-label={`Select ${row.original.keyword}`}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ getValue }) => (
          <span className="font-medium text-white">{getValue() as string}</span>
        ),
        size: 220,
      },
      {
        accessorKey: "volume",
        header: "Volume",
        cell: ({ getValue }) => (
          <span className="text-zinc-300 tabular-nums">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "kd",
        header: () => (
          <Tooltip content="Keyword Difficulty (0–100)">
            <span className="cursor-help">KD</span>
          </Tooltip>
        ),
        cell: ({ getValue }) => (
          <span className="text-zinc-300 tabular-nums">{getValue() as number}</span>
        ),
        size: 70,
      },
      {
        accessorKey: "cpc",
        header: () => (
          <Tooltip content="Cost per click (USD)">
            <span className="cursor-help">CPC</span>
          </Tooltip>
        ),
        cell: ({ getValue }) => (
          <span className="text-zinc-300 tabular-nums">
            ${(getValue() as number).toFixed(2)}
          </span>
        ),
        size: 80,
      },
      {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ getValue }) => (
          <Badge variant={intentVariant[getValue() as Intent]} className="shrink-0">
            {(getValue() as Intent).slice(0, 4)}
          </Badge>
        ),
        size: 110,
      },
      {
        accessorKey: "trend",
        header: "Trend",
        enableSorting: false,
        cell: ({ getValue }) => <TrendSparkline data={getValue() as number[]} />,
        size: 100,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
  });

  const handleRowClick = (row: Row<KeywordRow>) => {
    onSelectRow(row.original);
  };

  if (loading) {
    return <KeywordTableSkeleton className={className} />;
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 py-16 text-center",
          className
        )}
      >
        <p className="text-zinc-400">No keywords match your search or filters.</p>
        <p className="mt-1 text-sm text-zinc-500">Try adjusting filters or search term.</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900", className)}>
      <div className="overflow-auto max-h-[calc(100vh-8rem)]">
        <table className="w-full border-collapse" style={{ minWidth: table.getCenterTotalSize() }}>
          <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-zinc-300"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize resize-handle",
                        "hover:bg-zinc-600"
                      )}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={cn(
                  "transition-colors cursor-pointer",
                  selectedRowId === row.original.id
                    ? "bg-zinc-800/80"
                    : "hover:bg-zinc-800/50"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeywordTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900", className)}>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-zinc-800 bg-zinc-900">
            <tr>
              {["", "Keyword", "Volume", "KD", "CPC", "Intent", "Trend"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-4 w-10 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-5 w-14 rounded bg-zinc-700" /></td>
                <td className="px-4 py-3"><div className="h-6 w-20 rounded bg-zinc-700" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
