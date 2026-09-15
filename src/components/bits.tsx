"use client";

import { cn } from "@/lib/utils";
import { ago, levelOf, money, pct, usd0 } from "@/lib/format";
import type { AlertLevel, UserRow } from "@/lib/types";
import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

/* ---------- status chip ---------- */
export type ChipTone = AlertLevel | "good" | "accent" | "neutral";
const TONE: Record<ChipTone, string> = {
  crit: "bg-red-500/10 text-red-700 dark:text-red-400",
  serious: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  accent: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground",
  "": "bg-muted text-muted-foreground",
};
export function Chip({ tone = "neutral", className, children, dot }: { tone?: ChipTone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function CcTag({ name, className, onClick }: { name: string; className?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("inline-flex items-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-xs", onClick && "hover:border-foreground/40 cursor-pointer", className)}>
      {name}
    </Tag>
  );
}

export function Login({ login, onClick, className }: { login: string; onClick?: () => void; className?: string }) {
  if (!onClick) return <span className={cn("font-mono text-[13px]", className)}>{login}</span>;
  return (
    <button type="button" onClick={onClick} className={cn("font-mono text-[13px] hover:underline underline-offset-2 text-left", className)}>
      {login}
    </button>
  );
}

/* ---------- meter ---------- */
const FILL: Record<AlertLevel, string> = { crit: "bg-red-500", serious: "bg-orange-500", warn: "bg-amber-500", "": "bg-blue-500" };
const TRACK: Record<AlertLevel, string> = { crit: "bg-red-500/15", serious: "bg-orange-500/15", warn: "bg-amber-500/15", "": "bg-blue-500/15" };
export function Meter({ consumed, target, wide }: { consumed: number | null | undefined; target: number | null | undefined; wide?: boolean }) {
  if (consumed == null) return <span className="text-muted-foreground">–</span>;
  if (!target) return <span className="font-mono text-xs">{money(consumed)}</span>;
  const p = pct(consumed, target) ?? 0;
  const lv = levelOf(p);
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-1.5 shrink-0 overflow-hidden rounded-full", TRACK[lv], wide ? "flex-1" : "w-24")}>
        <div className={cn("h-full rounded-full", FILL[lv])} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {money(consumed)} / {usd0(target)}
      </span>
    </div>
  );
}

export function CoverageChip({ u }: { u: UserRow }) {
  if (u.coverage === "user") return <Chip tone="accent">usuário {usd0(u.ub!.budget_amount)}</Chip>;
  if (u.coverage === "cc") return <Chip tone="good">cost center {usd0(u.ccb!.budget_amount)}</Chip>;
  if (u.coverage === "ent") return <Chip>enterprise {usd0(u.entBudget!.budget_amount)}</Chip>;
  return <Chip tone="crit">nenhum</Chip>;
}
export function ActivityChip({ u }: { u: UserRow }) {
  if (u.days === Infinity) return <Chip>nunca</Chip>;
  return <Chip tone={u.days <= 7 ? "good" : u.days <= 30 ? "neutral" : "warn"}>{ago(u.lastActivity)}</Chip>;
}

/* ---------- KPI tile ---------- */
export function Kpi({ label, value, foot, href, onClick }: { label: string; value: ReactNode; foot?: ReactNode; href?: string; onClick?: () => void }) {
  const inner = (
    <Card className={cn("gap-1 px-4 py-3.5 h-full", (href || onClick) && "transition-colors hover:border-foreground/30")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[26px] font-semibold leading-tight tracking-tight">{value}</div>
      {foot && <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{foot}</div>}
    </Card>
  );
  if (href) return <Link href={href} className="block h-full rounded-xl focus-visible:outline-2">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block h-full w-full text-left rounded-xl">{inner}</button>;
  return inner;
}

/* ---------- horizontal bars ---------- */
export interface HBarRow { name: string; key: string; v: number; color?: string }
export function HBars({ rows, fmt = money, onClick }: { rows: HBarRow[]; fmt?: (v: number) => string; onClick?: (key: string) => void }) {
  if (!rows.length) return <div className="py-8 text-center text-sm text-muted-foreground">Sem dados.</div>;
  const mx = Math.max(...rows.map((r) => r.v)) || 1;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={onClick ? () => onClick(r.key) : undefined}
          title={`${r.name}: ${fmt(r.v)}`}
          className={cn("grid grid-cols-[minmax(110px,200px)_1fr_80px] items-center gap-2.5 text-left text-xs rounded-sm", onClick && "hover:bg-muted/60 cursor-pointer")}
        >
          <span className="truncate font-mono">{r.name}</span>
          <span className="block">
            <span className={cn("block h-3.5 rounded-r-[4px]", r.color ?? "bg-blue-500")} style={{ width: `${Math.max(1, (r.v / mx) * 100)}%` }} />
          </span>
          <span className="text-right font-mono text-muted-foreground tabular-nums">{fmt(r.v)}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- stacked proportion bar ---------- */
export function StackBar({ parts, total }: { parts: { label: string; v: number; color: string }[]; total: number }) {
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-md bg-muted">
        {parts.filter((p) => p.v > 0).map((p) => (
          <div key={p.label} title={`${p.label}: ${p.v}`} className={p.color} style={{ width: `${(p.v / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", p.color)} />
            {p.label} <b className="text-foreground tabular-nums">{p.v}</b>
            <span>({total ? Math.round((p.v / total) * 100) : 0}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function SectionTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <h3 className="mr-auto text-sm font-semibold">{children}</h3>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      {action}
    </div>
  );
}
