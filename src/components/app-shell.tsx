"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Activity, BellRing, Building2, History, LayoutDashboard, Moon, Receipt, RefreshCw, Settings, Sun, Users, Wallet, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ago, nf } from "@/lib/format";
import { Chip } from "@/components/bits";
import { UserDrawer, CCDrawer } from "@/components/drawers";

const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/users", label: "Usuários", icon: Users, count: "users" },
  { href: "/cost-centers", label: "Cost centers", icon: Building2, count: "cc" },
  { href: "/budgets", label: "Budgets", icon: Wallet, count: "budgets" },
  { href: "/consumption", label: "Consumo", icon: Activity },
  { href: "/billing", label: "Cobrança", icon: Receipt },
  { href: "/alerts", label: "Alertas", icon: BellRing, count: "alerts" },
  { href: "/actions", label: "Ações", icon: Wand2 },
  { href: "/log", label: "Histórico", icon: History, count: "log" },
] as const;

const TITLES: Record<string, string> = {
  "/": "Visão geral", "/users": "Usuários", "/cost-centers": "Cost centers", "/budgets": "Budgets", "/consumption": "Consumo", "/billing": "Cobrança",
  "/alerts": "Alertas", "/actions": "Ações", "/log": "Histórico", "/settings": "Configurações",
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const s = useStore();
  const counts: Record<string, { n: number; hot?: boolean }> = {
    users: { n: s.d?.users.length ?? 0 },
    cc: { n: s.d?.activeCC.length ?? 0 },
    budgets: { n: s.budgets.length },
    alerts: { n: s.d?.alerts.reduce((a, g) => a + g.items.length, 0) ?? 0, hot: (s.d?.alerts.some((g) => g.level === "crit") ?? false) },
    log: { n: s.log.length },
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[224px_1fr]">
      <aside className="sticky top-0 z-20 flex h-auto flex-row gap-1 overflow-x-auto border-b bg-sidebar px-3 py-2 md:h-dvh md:flex-col md:border-r md:border-b-0 md:px-3 md:py-4">
        <div className="hidden md:block px-2 pb-3 mb-1 border-b">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">GitHub Enterprise</div>
          <div className="text-[15px] font-semibold">Copilot Admin</div>
        </div>
        {NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const c = "count" in rest ? counts[rest.count] : null;
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", active && "bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium")}
            >
              <Icon className="size-4 shrink-0" />
              <span className="md:flex-1">{label}</span>
              {c && s.d && (
                <span className={cn("hidden md:inline-block min-w-6 rounded-full px-1.5 text-center font-mono text-[11px]", c.hot ? "bg-red-500 text-white" : active ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground")}>
                  {c.n}
                </span>
              )}
            </Link>
          );
        })}
        <div className="hidden md:block flex-1" />
        <Link href="/settings" aria-current={path === "/settings" ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", path === "/settings" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium")}>
          <Settings className="size-4" /> Configurações
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2.5 border-b bg-background/90 px-4 py-2.5 backdrop-blur md:px-6">
          <h1 className="mr-auto text-[15px] font-semibold">{TITLES[path] ?? ""}</h1>
          <Chip tone={s.config?.hasToken ? "good" : "crit"} dot>{s.ent}</Chip>
          {s.rate && (
            <Chip tone={s.rate.remaining < 300 ? "crit" : s.rate.remaining < 1000 ? "warn" : "neutral"} className="font-mono">
              API {nf(s.rate.remaining)}/{nf(s.rate.limit)}
            </Chip>
          )}
          <LoadedAgo />
          <ThemeToggle />
          <Button size="sm" variant="outline" onClick={() => void s.loadAll()} disabled={s.loading || !s.config?.hasToken}>
            <RefreshCw className={cn("size-3.5", s.loading && "animate-spin")} /> Atualizar
          </Button>
        </header>

        {s.progress && (
          <div className="border-b bg-muted/40 px-4 py-2 md:px-6">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{s.progress.label}</span>
              <span className="tabular-nums">{Math.round(s.progress.value * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-blue-500 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${s.progress.value * 100}%` }} />
            </div>
          </div>
        )}

        <main className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 pb-16 md:px-6">{children}</main>
      </div>

      <UserDrawer />
      <CCDrawer />
    </div>
  );
}

function LoadedAgo() {
  const { loadedAt } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!loadedAt) return null;
  return <span className="text-xs text-muted-foreground">atualizado {ago(new Date(loadedAt).toISOString())}</span>;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button size="icon-sm" variant="ghost" aria-label="Alternar tema" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
