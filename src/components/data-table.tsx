"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** value used for sorting; omit to make the column unsortable */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  defaultSort?: { id: string; dir: 1 | -1 };
  pageSize?: number;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  footer?: (shown: number, total: number) => ReactNode;
}

export function DataTable<T>({ rows, columns, rowKey, defaultSort, pageSize = 100, onRowClick, empty = "Nenhum registro.", footer }: Props<T>) {
  const [sort, setSort] = useState(defaultSort ?? { id: "", dir: 1 as 1 | -1 });
  const [limit, setLimit] = useState(pageSize);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return rows.slice().sort((a, b) => {
      const x = sv(a), y = sv(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * sort.dir;
      return (x - y) * sort.dir;
    });
  }, [rows, columns, sort]);

  const shown = sorted.slice(0, limit);
  const toggle = (id: string) => setSort((s) => (s.id === id ? { id, dir: (s.dir * -1) as 1 | -1 } : { id, dir: 1 }));

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.id}
                  onClick={c.sortValue ? () => toggle(c.id) : undefined}
                  className={cn("h-9 text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none", c.sortValue && "cursor-pointer hover:text-foreground", c.align === "right" && "text-right", c.className)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort.id === c.id && (sort.dir > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">{empty}</TableCell>
              </TableRow>
            )}
            {shown.map((r) => (
              <TableRow key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn(onRowClick && "cursor-pointer")}>
                {columns.map((c) => (
                  <TableCell key={c.id} className={cn("py-2 whitespace-nowrap", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {c.cell(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>{footer ? footer(shown.length, sorted.length) : `${shown.length} de ${sorted.length}`}</span>
        {sorted.length > limit && (
          <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 200)}>Mostrar mais</Button>
        )}
      </div>
    </div>
  );
}

/* native select styled like the shadcn input: reliable with long option lists */
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn("h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50", className)}
    />
  );
}

/* checkbox dropdown for filtering by multiple values at once */
export function MultiSelect({ options, selected, onChange, placeholder = "Todos", className }: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  const label = selected.size === 0 ? placeholder : selected.size === 1 ? (options.find((o) => o.value === [...selected][0])?.label ?? "1 selecionado") : `${selected.size} selecionados`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("h-8 min-w-40 rounded-lg border border-input bg-background px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50", selected.size === 0 ? "text-muted-foreground" : "text-foreground")}
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => onChange(new Set(options.map((o) => o.value)))}>Selecionar todos</button>
            <button type="button" className="hover:text-foreground" onClick={() => onChange(new Set())}>Limpar</button>
          </div>
          {options.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma opção.</div>}
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
              <Checkbox checked={selected.has(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
