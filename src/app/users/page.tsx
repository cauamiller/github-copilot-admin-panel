"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gate } from "@/components/gate";
import { DataTable, NativeSelect, type Column } from "@/components/data-table";
import { ActivityChip, CcTag, Chip, CoverageChip, Login, Meter } from "@/components/bits";
import { useStore } from "@/lib/store";
import { toCSV } from "@/lib/format";
import type { UserRow } from "@/lib/types";

export default function UsersPage() {
  return (
    <Gate>
      <Users />
    </Gate>
  );
}

function Users() {
  const s = useStore();
  const d = s.d!;
  const [q, setQ] = useState("");
  const [cc, setCc] = useState("");
  const [cov, setCov] = useState("");
  const [act, setAct] = useState("");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return d.users.filter((u) => {
      if (ql && !(u.k.includes(ql) || (u.cc?.name ?? "").toLowerCase().includes(ql) || u.editor.toLowerCase().includes(ql) || u.team.toLowerCase().includes(ql))) return false;
      if (cc === "__none" ? u.cc : cc && u.cc?.name !== cc) return false;
      if (cov && u.coverage !== cov) return false;
      if (act === "7" && u.days > 7) return false;
      if (act === "30" && u.days > 30) return false;
      if (act === "stale" && !(u.days > 30 && u.days !== Infinity)) return false;
      if (act === "never" && u.days !== Infinity) return false;
      return true;
    });
  }, [d.users, q, cc, cov, act]);

  const columns: Column<UserRow>[] = [
    { id: "login", header: "Login", sortValue: (u) => u.login, cell: (u) => <span className="inline-flex items-center gap-2"><Login login={u.login} />{u.pending && <Chip tone="warn">cancelando</Chip>}</span> },
    { id: "cc", header: "Cost center", sortValue: (u) => u.cc?.name ?? "", cell: (u) => (u.cc ? <CcTag name={u.cc.name} /> : <span className="text-muted-foreground">–</span>) },
    { id: "cov", header: "Cobertura", sortValue: (u) => u.coverage, cell: (u) => <CoverageChip u={u} /> },
    { id: "consumed", header: "Consumo do mês", sortValue: (u) => u.consumed, cell: (u) => <Meter consumed={u.consumed} target={u.target} /> },
    { id: "act", header: "Última atividade", sortValue: (u) => (u.days === Infinity ? 1e9 : u.days), cell: (u) => <ActivityChip u={u} /> },
    { id: "editor", header: "Editor", sortValue: (u) => u.editor, className: "max-w-56 truncate text-muted-foreground", cell: (u) => u.editor.split("/").slice(0, 2).join("/") },
    { id: "team", header: "Time de origem", sortValue: (u) => u.team, className: "text-muted-foreground", cell: (u) => u.team },
  ];

  const copy = () => {
    const csv = toCSV(rows, [
      { h: "login", v: (r) => r.login }, { h: "cost_center", v: (r) => r.cc?.name ?? "" }, { h: "cobertura", v: (r) => r.coverage },
      { h: "budget_usuario", v: (r) => r.ub?.budget_amount ?? "" }, { h: "budget_cost_center", v: (r) => r.ccb?.budget_amount ?? "" },
      { h: "consumo", v: (r) => (r.consumed == null ? "" : r.consumed.toFixed(2)) }, { h: "ultima_atividade", v: (r) => r.lastActivity ?? "" },
      { h: "editor", v: (r) => r.editor }, { h: "time", v: (r) => r.team }, { h: "cancelamento_pendente", v: (r) => (r.pending ? "sim" : "") },
    ]);
    navigator.clipboard.writeText(csv).then(() => toast.success(`CSV com ${rows.length} linhas copiado`)).catch(() => toast.error("Não foi possível copiar"));
  };

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar login, cost center, editor…" className="w-64" />
        <NativeSelect value={cc} onChange={(e) => setCc(e.target.value)}>
          <option value="">Todos os cost centers</option>
          <option value="__none">Sem cost center</option>
          {d.activeCC.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </NativeSelect>
        <NativeSelect value={cov} onChange={(e) => setCov(e.target.value)}>
          <option value="">Toda cobertura</option>
          <option value="user">Budget de usuário</option>
          <option value="cc">Budget do cost center</option>
          <option value="ent">Budget enterprise por usuário</option>
          <option value="none">Nenhum rastreável</option>
        </NativeSelect>
        <NativeSelect value={act} onChange={(e) => setAct(e.target.value)}>
          <option value="">Toda atividade</option>
          <option value="7">Ativos em 7 dias</option>
          <option value="30">Ativos em 30 dias</option>
          <option value="stale">Parados há +30 dias</option>
          <option value="never">Nunca usaram</option>
        </NativeSelect>
        <Button size="sm" variant="outline" onClick={copy} className="ml-auto"><Copy /> Copiar CSV</Button>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(u) => u.login} defaultSort={{ id: "consumed", dir: -1 }} onRowClick={(u) => s.showUser(u.login)} footer={(n, t) => `${n} de ${t} usuários`} empty="Nenhum usuário com esses filtros." />
    </Card>
  );
}
