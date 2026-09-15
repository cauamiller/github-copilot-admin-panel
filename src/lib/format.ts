import type { AlertLevel, BudgetScope } from "./types";

const usdFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usd0Fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const nfFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const money = (v: number | null | undefined) => (v == null ? "–" : usdFmt.format(v));
export const usd0 = (v: number | null | undefined) => (v == null ? "–" : usd0Fmt.format(v));
export const nf = (v: number) => nfFmt.format(v);
export const pct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  b != null && b > 0 && a != null ? Math.round((a / b) * 100) : null;

const DAY = 86_400_000;
export function daysSince(iso: string | null | undefined): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity;
}
export function ago(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const d = daysSince(iso);
  if (d < 1 / 24) return "agora há pouco";
  if (d < 1) return `há ${Math.round(d * 24)} h`;
  if (d < 60) return `há ${Math.round(d)} d`;
  return `há ${Math.round(d / 30)} meses`;
}
export function inFuture(epochSec: number): string {
  const m = Math.max(0, Math.round((epochSec * 1000 - Date.now()) / 60_000));
  return m < 60 ? `em ${m} min` : `em ${Math.round(m / 60)} h`;
}

export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function levelOf(p: number | null | undefined): AlertLevel {
  if (p == null) return "";
  if (p >= 100) return "crit";
  if (p >= 90) return "serious";
  if (p >= 75) return "warn";
  return "";
}

export const SCOPE_LABEL: Record<BudgetScope, string> = {
  user: "Usuário",
  multi_user_cost_center: "Cost center · por usuário",
  multi_user_customer: "Enterprise · por usuário",
  cost_center: "Cost center",
  enterprise: "Enterprise",
  organization: "Organização",
  repository: "Repositório",
};
export const scopeLabel = (s: string) => SCOPE_LABEL[s as BudgetScope] ?? s;

export function parseLogins(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean))];
}

export function toCSV<T>(rows: T[], cols: { h: string; v: (r: T) => string | number | null | undefined }[]): string {
  const q = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => q(c.h)).join(";"), ...rows.map((r) => cols.map((c) => q(c.v(r))).join(";"))].join("\n");
}
