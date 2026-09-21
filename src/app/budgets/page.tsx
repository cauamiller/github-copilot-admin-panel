"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Gate } from "@/components/gate";
import { DataTable, NativeSelect, type Column } from "@/components/data-table";
import { CcTag, Chip, Login, Meter } from "@/components/bits";
import { useBudgetDialogs } from "@/components/budget-dialogs";
import { useConfirm } from "@/components/confirm";
import { useStore } from "@/lib/store";
import { pct, scopeLabel, usd0 } from "@/lib/format";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  return (
    <Gate>
      <Budgets />
    </Gate>
  );
}

function Budgets() {
  const s = useStore();
  const bd = useBudgetDialogs();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const scopes = useMemo(() => [...new Set(s.budgets.map((b) => b.budget_scope))].sort(), [s.budgets]);
  const groupOf = (b: Budget) => (b.user ? s.d?.usersByLogin[b.user.toLowerCase()]?.team || "" : "");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return s.budgets.filter((b) => {
      const entity = (b.user ?? b.budget_entity_name ?? "").toLowerCase();
      const p = pct(b.consumed_amount, b.budget_amount);
      if (scope && b.budget_scope !== scope) return false;
      if (ql && !entity.includes(ql)) return false;
      if (level === "0" && (b.consumed_amount ?? 0) > 0) return false;
      if (level && level !== "0" && !((p ?? -1) >= +level)) return false;
      return true;
    });
  }, [s.budgets, q, scope, level]);

  const allSelected = rows.length > 0 && rows.every((b) => selected.has(b.id));
  const someSelected = !allSelected && rows.some((b) => selected.has(b.id));
  const toggleAll = () => setSelected((sel) => {
    const next = new Set(sel);
    if (allSelected) rows.forEach((b) => next.delete(b.id));
    else rows.forEach((b) => next.add(b.id));
    return next;
  });
  const toggleOne = (id: string) => setSelected((sel) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const bulkDelete = () => {
    const ids = [...selected];
    confirm({
      title: `Excluir ${ids.length} budget${ids.length > 1 ? "s" : ""}`,
      danger: true,
      confirmLabel: "Excluir",
      body: <p>Excluir os <b>{ids.length}</b> budgets selecionados? Essa ação não pode ser desfeita.</p>,
      onConfirm: async () => { await s.deleteBudgets(ids); setSelected(new Set()); },
    });
  };

  const columns: Column<Budget>[] = [
    { id: "sel", header: <Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />, cell: (b) => (
      <span onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleOne(b.id)} aria-label="Selecionar" /></span>
    ) },
    { id: "entity", header: "Entidade", sortValue: (b) => b.user ?? b.budget_entity_name ?? "", cell: (b) => (b.user ? <Login login={b.user} onClick={() => s.showUser(b.user!)} /> : <CcTag name={b.budget_entity_name || "(enterprise)"} />) },
    { id: "group", header: "Grupo", sortValue: (b) => groupOf(b), cell: (b) => { const g = groupOf(b); return g ? <Chip>{g}</Chip> : <span className="text-muted-foreground">–</span>; } },
    { id: "scope", header: "Escopo", sortValue: (b) => b.budget_scope, cell: (b) => <Chip>{scopeLabel(b.budget_scope)}</Chip> },
    { id: "amount", header: "Valor", align: "right", sortValue: (b) => b.budget_amount, cell: (b) => usd0(b.budget_amount) },
    { id: "consumed", header: "Consumo", sortValue: (b) => b.consumed_amount, cell: (b) => {
      if (b.consumed_amount != null) return <Meter consumed={b.consumed_amount} target={b.budget_amount} />;
      const th = b.budget_thresholds;
      if (!th) return <span className="text-muted-foreground">–</span>;
      const over = (th["75"] || 0) + (th["90"] || 0) + (th["100"] || 0);
      return <span className="inline-flex items-center gap-2 text-muted-foreground">{Object.values(th).reduce((a, c) => a + c, 0)} usuários{over > 0 && <Chip tone="serious">{over} ≥75%</Chip>}</span>;
    } },
    { id: "prevent", header: "Bloqueio", cell: (b) => (b.prevent_further_usage ? <Chip tone="good">bloqueia</Chip> : <Chip tone="warn">só alerta</Chip>) },
    { id: "exp", header: "Expira", sortValue: (b) => b.expires_at, className: "text-muted-foreground", cell: (b) => b.expires_at ?? "–" },
    { id: "actions", header: "", align: "right", cell: (b) => (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="icon-xs" variant="ghost" aria-label="Editar" onClick={() => bd.edit(b.id)}><Pencil /></Button>
        <Button size="icon-xs" variant="ghost" aria-label="Excluir" className="text-red-600" onClick={() => bd.remove(b.id)}><Trash2 /></Button>
      </span>
    ) },
  ];

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar entidade ou usuário…" className="w-64" />
        <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Todos os escopos</option>
          {scopes.map((x) => <option key={x} value={x}>{scopeLabel(x)}</option>)}
        </NativeSelect>
        <NativeSelect value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Todo consumo</option><option value="75">≥ 75%</option><option value="90">≥ 90%</option><option value="100">Estourado</option><option value="0">Sem consumo</option>
        </NativeSelect>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 /> Excluir {selected.size} selecionado{selected.size > 1 ? "s" : ""}</Button>
          )}
          <Button size="sm" render={<Link href="/actions" />} nativeButton={false} >Novo budget</Button>
        </div>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(b) => b.id} defaultSort={{ id: "consumed", dir: -1 }} footer={(n, t) => `${n} de ${t} budgets`} empty="Nenhum budget com esses filtros." />
    </Card>
  );
}
