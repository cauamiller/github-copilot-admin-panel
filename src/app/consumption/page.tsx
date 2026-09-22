"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gate } from "@/components/gate";
import { DataTable, MultiSelect, type Column } from "@/components/data-table";
import { CcTag, Chip, HBars, Kpi, Login, SectionTitle } from "@/components/bits";
import { useStore } from "@/lib/store";
import { levelOf, money, monthLabel, nf, usd0 } from "@/lib/format";
import type { UserRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_CC = "__none";

export default function ConsumptionPage() {
  return (
    <Gate>
      <Consumption />
    </Gate>
  );
}

function Consumption() {
  const s = useStore();
  const d = s.d!;
  const [ccSel, setCcSel] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ccOptions = useMemo(
    () => [{ value: NO_CC, label: "Sem cost center" }, ...d.activeCC.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))],
    [d.activeCC],
  );
  const matchesCC = useCallback((u: UserRow) => ccSel.size === 0 || (u.cc ? ccSel.has(u.cc.id) : ccSel.has(NO_CC)), [ccSel]);

  const all = useMemo(() => d.users.filter((u) => u.consumed != null && matchesCC(u)), [d.users, matchesCC]);
  const rows = useMemo(() => all.slice().sort((a, b) => b.consumed! - a.consumed!), [all]);
  const total = rows.reduce((a, u) => a + u.consumed!, 0);
  const withUse = rows.filter((u) => u.consumed! > 0);
  const top10 = withUse.slice(0, 10).reduce((a, u) => a + u.consumed!, 0);

  const byCC = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of all) if (u.cc) m[u.cc.name] = (m[u.cc.name] ?? 0) + u.consumed!;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, v]) => ({ name, key: d.activeCC.find((c) => c.name === name)?.id ?? name, v }));
  }, [all, d.activeCC]);

  const rangeCcIds = [...ccSel].filter((v) => v !== NO_CC);
  const range = s.usageRangeSpan;
  const byCCRange = useMemo(() => {
    if (!s.usageRange) return [];
    return Object.entries(s.usageRange)
      .map(([id, u]) => ({ name: d.activeCC.find((c) => c.id === id)?.name ?? id, key: id, v: u.credits * 0.01 }))
      .sort((a, b) => b.v - a.v);
  }, [s.usageRange, d.activeCC]);

  const applyRange = () => { if (dateFrom && dateTo && rangeCcIds.length) void s.loadUsageRange(dateFrom, dateTo, rangeCcIds); };
  const clearRange = () => { setDateFrom(""); setDateTo(""); void s.loadUsageRange("", "", []); };

  const columns: Column<UserRow & { rank: number }>[] = [
    { id: "rank", header: "#", align: "right", className: "text-muted-foreground", cell: (u) => u.rank },
    { id: "login", header: "Login", sortValue: (u) => u.login, cell: (u) => <Login login={u.login} /> },
    { id: "cc", header: "Cost center", sortValue: (u) => u.cc?.name ?? "", cell: (u) => (u.cc ? <CcTag name={u.cc.name} /> : <span className="text-muted-foreground">–</span>) },
    { id: "consumed", header: "Consumo", align: "right", sortValue: (u) => u.consumed, cell: (u) => money(u.consumed) },
    { id: "target", header: "Teto", align: "right", sortValue: (u) => u.target, cell: (u) => (u.target != null ? usd0(u.target) : "–") },
    { id: "pct", header: "% do teto", sortValue: (u) => u.pct, cell: (u) => (u.pct != null ? <Chip tone={levelOf(u.pct) || "neutral"}>{u.pct}%</Chip> : "–") },
    { id: "src", header: "Fonte", className: "text-muted-foreground", cell: (u) => (u.ub ? "budget de usuário" : u.us?.scope === "multi_user_customer" ? "budget enterprise" : "budget do cost center") },
  ];
  const ranked = rows.map((u, i) => ({ ...u, rank: i + 1 }));

  return (
    <>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-end gap-2 px-4 py-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Cost centers</Label>
            <MultiSelect options={ccOptions} selected={ccSel} onChange={setCcSel} placeholder="Todos os cost centers" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cons-from" className="text-xs text-muted-foreground">De</Label>
            <Input id="cons-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cons-to" className="text-xs text-muted-foreground">Até</Label>
            <Input id="cons-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" onClick={applyRange} disabled={!dateFrom || !dateTo || !rangeCcIds.length || !!s.progress}>
            <RefreshCw className={cn(s.progress && "animate-spin")} /> Aplicar período
          </Button>
          {range && <Button size="sm" variant="ghost" onClick={clearRange}><X /> Limpar período</Button>}
        </div>
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
          O ranking por usuário e os KPIs abaixo são sempre do <b>ciclo de budget vigente</b> (a API não atribui uso diário a um login). O filtro de período busca o uso real dia a dia por cost center (<span className="font-mono">/settings/billing/usage</span>) e substitui o gráfico &quot;Consumo por cost center&quot; por esses dados — selecione ao menos 1 cost center para poder aplicar (1 chamada por cost center por mês tocado pelo intervalo).
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Consumo total rastreado" value={money(total)} foot={`${rows.length} usuários com dado de consumo`} />
        <Kpi label="Usuários com consumo > 0" value={nf(withUse.length)} foot={`${rows.length - withUse.length} zerados`} />
        <Kpi label="Média por usuário ativo" value={money(withUse.length ? total / withUse.length : 0)} foot="entre quem consumiu algo" />
        <Kpi label="Concentração no top 10" value={`${total ? Math.round((top10 / total) * 100) : 0}%`} foot={money(top10)} />
        <Kpi label="Sem dado de consumo" value={nf(d.users.length - all.length)} foot="fora de qualquer budget rastreável" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <SectionTitle>Top 20 usuários</SectionTitle>
          <CardContent className="px-4 py-4">
            <HBars rows={withUse.slice(0, 20).map((u) => ({ name: u.login, key: u.login, v: u.consumed!, color: (u.pct ?? 0) >= 100 ? "bg-red-500" : (u.pct ?? 0) >= 90 ? "bg-orange-500" : "bg-blue-500" }))} onClick={(k) => s.showUser(k)} />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <SectionTitle sub={range ? `${range.from} a ${range.to} · uso real por cost center` : "soma dos membros com consumo rastreável (ciclo vigente)"}>Consumo por cost center</SectionTitle>
          <CardContent className="px-4 py-4">
            {range ? <HBars rows={byCCRange} onClick={(k) => s.showCC(k)} /> : <HBars rows={byCC} onClick={(k) => s.showCC(k)} />}
          </CardContent>
        </Card>
      </div>
      <Card className="gap-0 py-0">
        <SectionTitle sub={`consumo do ${monthLabel(new Date().getFullYear(), new Date().getMonth() + 1)} em US$ (AI credits), via budgets de usuário e user-states dos budgets compartilhados`}>Ranking completo</SectionTitle>
        <DataTable rows={ranked} columns={columns} rowKey={(u) => u.login} defaultSort={{ id: "consumed", dir: -1 }} onRowClick={(u) => s.showUser(u.login)} empty="Sem dados de consumo." />
      </Card>
    </>
  );
}
