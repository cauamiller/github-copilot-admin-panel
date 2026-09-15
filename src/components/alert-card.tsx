"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { nf } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { AlertGroup } from "@/lib/types";

const STRIPE: Record<string, string> = { crit: "border-l-red-500", serious: "border-l-orange-500", warn: "border-l-amber-500", "": "border-l-muted-foreground/40" };

export function AlertCard({ a, open, onToggle }: { a: AlertGroup; open?: boolean; onToggle?: () => void }) {
  const s = useStore();
  return (
    <div className={cn("flex min-h-28 flex-col overflow-hidden rounded-xl border border-l-4 bg-card", STRIPE[a.level], open && "col-span-full")}>
      <button type="button" onClick={onToggle} className="flex flex-1 items-start gap-3 p-4 text-left hover:bg-muted/40">
        <span className="w-11 shrink-0 pt-0.5 text-2xl font-semibold leading-none tabular-nums">{nf(a.items.length)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug">{a.title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{a.hint}</span>
        </span>
        {onToggle && (open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />)}
      </button>
      {open && (
        <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-6 gap-y-0.5 overflow-auto border-t px-4 py-2 text-xs">
          {a.items.slice(0, 500).map((it) => (
            <div key={it.key} className="flex justify-between gap-2 py-0.5">
              {it.login ? (
                <button type="button" className="font-mono hover:underline" onClick={() => s.showUser(it.login!)}>{it.primary}</button>
              ) : it.ccId ? (
                <button type="button" className="font-mono hover:underline" onClick={() => s.showCC(it.ccId!)}>{it.primary}</button>
              ) : (
                <span className="font-mono">{it.primary}</span>
              )}
              <span className="text-muted-foreground truncate">{it.secondary}</span>
            </div>
          ))}
          {a.items.length > 500 && <div className="text-muted-foreground">… e mais {a.items.length - 500}</div>}
        </div>
      )}
    </div>
  );
}
