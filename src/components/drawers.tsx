"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { useConfirm, Note } from "@/components/confirm";
import { useBudgetDialogs } from "@/components/budget-dialogs";
import { ActivityChip, CcTag, Chip, CoverageChip, Login, Meter } from "@/components/bits";
import { ago, money, nf, usd0 } from "@/lib/format";
import type { CCRow, Derived } from "@/lib/types";
import type { ReactNode } from "react";

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function Block({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <span className="mr-auto">{title}</span>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function MembersBlock({ r, d }: { r: CCRow; d: Derived }) {
  const s = useStore();
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const members = r.members.map((m) => {
    const u = d.usersByLogin[m.toLowerCase()];
    const st = r.states?.find((x) => x.user.toLowerCase() === m.toLowerCase());
    return { m, u, st, consumed: u?.consumed ?? st?.consumed_amount ?? null };
  }).sort((a, b) => (b.consumed ?? -1) - (a.consumed ?? -1));

  const startEdit = () => {
    const init: Record<string, string> = {};
    for (const x of members) init[x.m] = x.u?.ub ? String(x.u.ub.budget_amount) : "";
    setEdits(init);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setEdits({}); };
  const saveEdits = async () => {
    const changed = members
      .map((x) => ({ login: x.m, raw: edits[x.m]?.trim() ?? "", cur: x.u?.ub?.budget_amount }))
      .filter((x) => x.raw !== "" && !Number.isNaN(+x.raw) && +x.raw !== x.cur)
      .map((x) => ({ login: x.login, amount: +x.raw }));
    if (!changed.length) { cancelEdit(); return; }
    await s.bulkSetUserBudgets(changed);
    cancelEdit();
  };
  const changedCount = members.filter((x) => { const raw = edits[x.m]?.trim() ?? ""; return raw !== "" && !Number.isNaN(+raw) && +raw !== x.u?.ub?.budget_amount; }).length;

  return (
    <Block title="Membros" right={
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            {changedCount > 0 && <span className="text-xs text-muted-foreground">{changedCount} alterado(s)</span>}
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={!!s.progress}>Cancelar</Button>
            <Button size="sm" onClick={saveEdits} disabled={!!s.progress || !changedCount}>Salvar</Button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{r.members.length}</span>
            {members.length > 0 && <Button size="sm" variant="outline" onClick={startEdit}>Editar budgets em lote</Button>}
          </>
        )}
      </div>
    }>
      {editing && <div className="mb-3"><Note>Preencha o valor (US$) por linha e clique em Salvar. Em branco = sem alteração; quem ainda não tem budget de usuário ganha um novo, com bloqueio ativo.</Note></div>}
      <div className="-m-3 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Login</TableHead><TableHead>Consumo</TableHead><TableHead>Cobertura</TableHead><TableHead>Atividade</TableHead><TableHead className="text-right">Budget de usuário</TableHead></TableRow></TableHeader>
          <TableBody>
            {members.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem membros.</TableCell></TableRow>}
            {members.map((x) => (
              <TableRow key={x.m} className={editing ? undefined : "cursor-pointer"} onClick={editing ? undefined : () => { s.showCC(null); s.showUser(x.m); }}>
                <TableCell><Login login={x.m} /></TableCell>
                <TableCell>{x.u ? <Meter consumed={x.u.consumed} target={x.u.target} /> : x.st ? <Meter consumed={x.st.consumed_amount} target={x.st.target_amount} /> : "–"}</TableCell>
                <TableCell>{x.u ? <CoverageChip u={x.u} /> : <Chip tone="warn">sem seat</Chip>}</TableCell>
                <TableCell>{x.u ? <ActivityChip u={x.u} /> : "–"}</TableCell>
                <TableCell className="text-right">
                  {editing ? (
                    <Input
                      type="number" min={0} step={1} placeholder="—"
                      className="h-7 w-24 text-right"
                      value={edits[x.m] ?? ""}
                      onChange={(e) => setEdits((s2) => ({ ...s2, [x.m]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : x.u?.ub ? usd0(x.u.ub.budget_amount) : <span className="text-muted-foreground">–</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Block>
  );
}

export function UserDrawer() {
  const s = useStore();
  const router = useRouter();
  const bd = useBudgetDialogs();
  const login = s.openUser;
  const d = s.d;
  const u = login && d ? d.usersByLogin[login.toLowerCase()] : null;
  const ub = login && d ? d.userBudget[login.toLowerCase()] : null;
  const us = login && d ? d.stateByUser[login.toLowerCase()] : null;
  const cc = login && d ? d.ccOfUser[login.toLowerCase()] : null;
  const seat = u?.seat;

  return (
    <Sheet open={!!login} onOpenChange={(o) => !o && s.showUser(null)}>
      <SheetContent className="data-[side=right]:sm:max-w-2xl overflow-y-auto gap-0 p-0">
        {login && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="font-mono text-base">{login}</SheetTitle>
              <SheetDescription>{u ? seat?.assignee.html_url : "sem seat do Copilot"}</SheetDescription>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {u ? <CoverageChip u={u} /> : <Chip>sem seat</Chip>}
                {u && <ActivityChip u={u} />}
                {cc ? <CcTag name={cc.name} onClick={() => { s.showUser(null); s.showCC(cc.id); }} /> : <Chip tone="warn">sem cost center</Chip>}
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-5 py-4">
              <Block title="Consumo do mês">
                {u ? <Meter consumed={u.consumed} target={u.target} wide /> : "–"}
                <div className="mt-3">
                  <KV rows={[
                    ["Budget de usuário", ub ? <>{usd0(ub.budget_amount)} · {ub.prevent_further_usage ? "bloqueia" : "só alerta"} · expira {ub.expires_at ?? "–"} <span className="font-mono text-[11px] text-muted-foreground">{ub.id}</span></> : <span className="text-muted-foreground">nenhum</span>],
                    ["Budget do cost center", u?.ccb ? `${usd0(u.ccb.budget_amount)} (${u.ccb.budget_entity_name})` : <span className="text-muted-foreground">nenhum</span>],
                    ["Budget compartilhado", us ? <>{money(us.consumed_amount)} de {usd0(us.target_amount)} · {us.scope === "multi_user_customer" ? "enterprise" : "cost center"}{us.override_budget_id && <> · <Chip tone="accent">override</Chip></>}</> : <span className="text-muted-foreground">não aparece em nenhum</span>],
                  ]} />
                </div>
              </Block>
              {seat && (
                <Block title="Seat">
                  <KV rows={[
                    ["Plano", seat.plan_type ?? "–"],
                    ["Atribuído em", `${(seat.created_at || "").slice(0, 10)} via ${seat.assigning_team?.name ?? "–"}`],
                    ["Última atividade", seat.last_activity_at ? `${seat.last_activity_at.replace("T", " ").slice(0, 16)} (${ago(seat.last_activity_at)})` : "nunca"],
                    ["Editor", <span key="e" className="font-mono text-xs">{seat.last_activity_editor ?? "–"}</span>],
                    ["Último login", seat.last_authenticated_at ? ago(seat.last_authenticated_at) : "–"],
                    ["Cancelamento", seat.pending_cancellation_date ? <Chip tone="warn">{seat.pending_cancellation_date}</Chip> : "não"],
                  ]} />
                </Block>
              )}
              <Block title="Ações">
                <div className="flex flex-wrap gap-2">
                  {ub ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => bd.edit(ub.id)}>Editar budget</Button>
                      <Button variant="destructive" size="sm" onClick={() => bd.remove(ub.id)}>Excluir budget</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => { s.showUser(null); router.push(`/actions?scope=user&user=${encodeURIComponent(login)}`); }}>Criar budget de usuário</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { s.showUser(null); router.push(`/actions?move=${encodeURIComponent(login)}`); }}>
                    {cc ? "Mover de cost center" : "Adicionar a cost center"}
                  </Button>
                </div>
              </Block>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CCDrawer() {
  const s = useStore();
  const router = useRouter();
  const confirm = useConfirm();
  const bd = useBudgetDialogs();
  const id = s.openCC;
  const r = id && s.d ? s.d.ccRows.find((x) => x.cc.id === id) : null;
  const d = s.d;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && s.showCC(null)}>
      <SheetContent className="data-[side=right]:sm:max-w-2xl overflow-y-auto gap-0 p-0">
        {r && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="font-mono text-base">{r.name}</SheetTitle>
              <SheetDescription>cost center</SheetDescription>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {r.cc.state === "active" ? <Chip tone="good">ativo</Chip> : <Chip>excluído</Chip>}
                {r.budget ? <Chip tone="accent">budget {usd0(r.budget.budget_amount)} por usuário</Chip> : <Chip tone="serious">sem budget</Chip>}
                {r.cc.ai_credit_pool_enabled && <Chip>AI credit pool</Chip>}
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-5 py-4">
              <KV rows={[
                ["ID", <span key="id" className="font-mono text-xs">{r.cc.id}</span>],
                ["Assinatura Azure", <span key="az" className="font-mono text-xs">{r.cc.azure_subscription ?? "–"}</span>],
                ["Consumo (membros)", r.consumed == null ? "–" : money(r.consumed)],
                ["Uso do mês (relatório)", r.usage ? `${nf(r.usage.credits)} créditos · bruto ${money(r.usage.gross)} · líquido ${money(r.usage.net)}` : <span className="text-muted-foreground">não carregado</span>],
                ...(r.budget?.budget_thresholds
                  ? [["Faixas", <div key="th" className="flex flex-wrap gap-1">{Object.entries(r.budget.budget_thresholds).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => <Chip key={k} tone={k === "100" ? "crit" : k === "90" ? "serious" : k === "75" ? "warn" : "neutral"}>≥{k}%: {v}</Chip>)}</div>] as [string, ReactNode]]
                  : []),
              ]} />
              <MembersBlock key={r.cc.id} r={r} d={d!} />
              <Block title="Ações">
                <div className="flex flex-wrap gap-2">
                  {r.budget ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => bd.edit(r.budget!.id)}>Editar budget</Button>
                      <Button variant="destructive" size="sm" onClick={() => bd.remove(r.budget!.id)}>Excluir budget</Button>
                    </>
                  ) : r.cc.state === "active" ? (
                    <Button size="sm" onClick={() => { s.showCC(null); router.push(`/actions?scope=multi_user_cost_center&cc=${encodeURIComponent(r.name)}`); }}>Criar budget por usuário</Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => { s.showCC(null); router.push(`/actions?addcc=${encodeURIComponent(r.name)}`); }}>Adicionar usuários</Button>
                  {r.cc.state === "active" && (
                    <Button variant="destructive" size="sm" onClick={() => confirm({
                      title: "Excluir cost center", danger: true, confirmLabel: "Excluir",
                      body: <><p>Excluir <b>{r.name}</b>?</p><Note>{(r.cc.resources?.length ?? 0) ? `${r.cc.resources!.length} recurso(s) ficam sem cost center. ` : ""}O budget multi-usuário associado, se existir, deixa de valer.</Note></>,
                      onConfirm: () => s.deleteCostCenter(r.cc.id),
                    })}>Excluir cost center</Button>
                  )}
                </div>
              </Block>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
