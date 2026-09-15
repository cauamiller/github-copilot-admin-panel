"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gate } from "@/components/gate";
import { DataTable, NativeSelect, type Column } from "@/components/data-table";
import { CcTag, Chip, HBars, SectionTitle } from "@/components/bits";
import { useStore } from "@/lib/store";
import { money, nf, usd0 } from "@/lib/format";
import type { CCRow } from "@/lib/types";

export default function CostCentersPage() {
  return (
    <Gate>
      <CostCenters />
    </Gate>
  );
}

function CostCenters() {
  const s = useStore();
  const d = s.d!;
  const [q, setQ] = useState("");
  const [st, setSt] = useState("active");
  const [flag, setFlag] = useState("");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return d.ccRows.filter((r) => {
      if (st && r.cc.state !== st) return false;
      if (ql && !(r.name.toLowerCase().includes(ql) || r.members.some((m) => m.toLowerCase().includes(ql)))) return false;
      if (flag === "nobudget" && r.budget) return false;
      if (flag === "nomembers" && r.members.length) return false;
      if (flag === "over" && !((r.over75 ?? 0) > 0)) return false;
      return true;
    });
  }, [d.ccRows, q, st, flag]);

  const columns: Column<CCRow>[] = [
    { id: "name", header: "Cost center", sortValue: (r) => r.name, cell: (r) => <span className="inline-flex items-center gap-2"><CcTag name={r.name} />{r.cc.ai_credit_pool_enabled && <Chip>pool</Chip>}</span> },
    { id: "state", header: "Estado", cell: (r) => (r.cc.state === "active" ? <Chip tone="good">ativo</Chip> : <Chip>excluído</Chip>) },
    { id: "n", header: "Membros", align: "right", sortValue: (r) => r.members.length, cell: (r) => <span className="inline-flex items-center gap-2">{r.members.length}{r.withoutSeat.length > 0 && <Chip tone="warn">{r.withoutSeat.length} sem seat</Chip>}</span> },
    { id: "amount", header: "Budget", align: "right", sortValue: (r) => r.budget?.budget_amount, cell: (r) => r.budget ? <span className="inline-flex items-center gap-2">{usd0(r.budget.budget_amount)}{!r.budget.prevent_further_usage && <Chip tone="warn">sem bloqueio</Chip>}</span> : r.cc.state === "active" ? <Chip tone="serious">sem budget</Chip> : "–" },
    { id: "consumed", header: "Consumo (membros)", sortValue: (r) => r.consumed, cell: (r) => (r.consumed == null ? <span className="text-muted-foreground">–</span> : <><span className="font-mono text-xs">{money(r.consumed)}</span> <span className="text-muted-foreground">/ {r.states?.length ?? 0} usuários</span></>) },
    { id: "over", header: "≥75%", align: "right", sortValue: (r) => r.over75, cell: (r) => (r.over75 == null ? "–" : r.over75 > 0 ? <Chip tone="serious">{r.over75}</Chip> : "0") },
    { id: "usage", header: "Uso do mês (relatório)", align: "right", sortValue: (r) => r.usage?.credits, cell: (r) => (r.usage ? <>{nf(r.usage.credits)} <span className="text-muted-foreground">cr · {money(r.usage.gross)}</span></> : <span className="text-muted-foreground">–</span>) },
  ];

  const usageRows = s.ccUsage ? d.ccRows.filter((r) => r.usage).sort((a, b) => b.usage!.credits - a.usage!.credits).slice(0, 25).map((r) => ({ name: r.name, key: r.cc.id, v: r.usage!.credits })) : null;

  return (
    <>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cost center ou membro…" className="w-64" />
          <NativeSelect value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="active">Ativos</option><option value="deleted">Excluídos</option><option value="">Todos</option>
          </NativeSelect>
          <NativeSelect value={flag} onChange={(e) => setFlag(e.target.value)}>
            <option value="">Todos</option><option value="nobudget">Sem budget</option><option value="nomembers">Sem membros</option><option value="over">Com usuários ≥75%</option>
          </NativeSelect>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void s.loadCCUsage()} disabled={!!s.progress} title="Consulta o relatório de uso do mês para cada cost center (1 requisição por cost center)">Carregar uso do mês</Button>
            <Button size="sm" render={<Link href="/actions#cost-center" />} nativeButton={false} >Novo cost center</Button>
          </div>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.cc.id} defaultSort={{ id: "name", dir: 1 }} onRowClick={(r) => s.showCC(r.cc.id)} footer={(n, t) => `${n} de ${t} cost centers`} />
      </Card>
      {usageRows && (
        <Card className="gap-0 py-0">
          <SectionTitle sub="AI credits (quantidade) — relatório de uso do mês">Uso do mês por cost center</SectionTitle>
          <CardContent className="px-4 py-4"><HBars rows={usageRows} fmt={(v) => `${nf(v)} cr`} onClick={(k) => s.showCC(k)} /></CardContent>
        </Card>
      )}
    </>
  );
}
