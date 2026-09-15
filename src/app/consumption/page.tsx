"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gate } from "@/components/gate";
import { DataTable, NativeSelect, type Column } from "@/components/data-table";
import { CcTag, Chip, HBars, Kpi, Login, SectionTitle } from "@/components/bits";
import { useStore } from "@/lib/store";
import { levelOf, money, nf, usd0 } from "@/lib/format";
import type { UserRow } from "@/lib/types";

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
  const [cc, setCc] = useState("");

  const all = useMemo(() => d.users.filter((u) => u.consumed != null), [d.users]);
  const rows = useMemo(() => all.filter((u) => (cc === "__none" ? !u.cc : !cc || u.cc?.name === cc)).sort((a, b) => b.consumed! - a.consumed!), [all, cc]);
  const total = rows.reduce((a, u) => a + u.consumed!, 0);
  const withUse = rows.filter((u) => u.consumed! > 0);
  const top10 = withUse.slice(0, 10).reduce((a, u) => a + u.consumed!, 0);
  const byCC = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of all) if (u.cc) m[u.cc.name] = (m[u.cc.name] ?? 0) + u.consumed!;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, v]) => ({ name, key: d.activeCC.find((c) => c.name === name)?.id ?? name, v }));
  }, [all, d.activeCC]);

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Consumo total rastreado" value={money(total)} foot={`${rows.length} usuários com dado de consumo`} />
        <Kpi label="Usuários com consumo > 0" value={nf(withUse.length)} foot={`${rows.length - withUse.length} zerados`} />
        <Kpi label="Média por usuário ativo" value={money(withUse.length ? total / withUse.length : 0)} foot="entre quem consumiu algo" />
        <Kpi label="Concentração no top 10" value={`${total ? Math.round((top10 / total) * 100) : 0}%`} foot={money(top10)} />
        <Kpi label="Sem dado de consumo" value={nf(d.users.length - all.length)} foot="fora de qualquer budget rastreável" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <SectionTitle action={
            <NativeSelect value={cc} onChange={(e) => setCc(e.target.value)}>
              <option value="">Todos os cost centers</option><option value="__none">Sem cost center</option>
              {d.activeCC.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </NativeSelect>
          }>Top 20 usuários</SectionTitle>
          <CardContent className="px-4 py-4">
            <HBars rows={withUse.slice(0, 20).map((u) => ({ name: u.login, key: u.login, v: u.consumed!, color: (u.pct ?? 0) >= 100 ? "bg-red-500" : (u.pct ?? 0) >= 90 ? "bg-orange-500" : "bg-blue-500" }))} onClick={(k) => s.showUser(k)} />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <SectionTitle sub="soma dos membros com consumo rastreável">Consumo por cost center</SectionTitle>
          <CardContent className="px-4 py-4"><HBars rows={byCC} onClick={(k) => s.showCC(k)} /></CardContent>
        </Card>
      </div>
      <Card className="gap-0 py-0">
        <SectionTitle sub="consumo do mês em US$ (AI credits), via budgets de usuário e user-states dos budgets compartilhados">Ranking completo</SectionTitle>
        <DataTable rows={ranked} columns={columns} rowKey={(u) => u.login} defaultSort={{ id: "consumed", dir: -1 }} onRowClick={(u) => s.showUser(u.login)} empty="Sem dados de consumo." />
      </Card>
    </>
  );
}
