"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Gate } from "@/components/gate";
import { NativeSelect } from "@/components/data-table";
import { CcTag, Chip, SectionTitle } from "@/components/bits";
import { useConfirm, Json, Note } from "@/components/confirm";
import { budgetPayload, useStore } from "@/lib/store";
import { parseLogins, scopeLabel, usd0 } from "@/lib/format";
import type { BudgetScope, UserRow } from "@/lib/types";

export default function ActionsPage() {
  return (
    <Gate>
      <Suspense>
        <ActionsKeyed />
      </Suspense>
    </Gate>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ActionsKeyed() {
  const params = useSearchParams();
  return <Actions key={params.toString()} params={params} />;
}

function Actions({ params }: { params: ReadonlyURLSearchParams }) {
  const s = useStore();
  const d = s.d!;
  const confirm = useConfirm();
  const ccOptions = useMemo(() => d.activeCC.slice().sort((a, b) => a.name.localeCompare(b.name)), [d.activeCC]);
  const groupOptions = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; n: number }>();
    for (const u of d.users) { const t = u.seat.assigning_team; const k = t?.slug ?? "__none"; const e = m.get(k) ?? { slug: k, name: t?.name ?? "Sem grupo (atribuição direta)", n: 0 }; e.n++; m.set(k, e); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [d.users]);

  /* ---- create budget ---- */
  const [scope, setScope] = useState<BudgetScope>(() => (params.get("scope") as BudgetScope) || "user");
  const [user, setUser] = useState(() => params.get("user") ?? "");
  const [ccName, setCcName] = useState(() => params.get("cc") ?? "");
  const [amount, setAmount] = useState(19);
  const [expires, setExpires] = useState("");
  const [prevent, setPrevent] = useState(true);

  /* ---- bulk ---- */
  const [bulkAmount, setBulkAmount] = useState(19);
  const [bulkOnly, setBulkOnly] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkExcl, setBulkExcl] = useState<string[]>([]);
  const [skipCC, setSkipCC] = useState(false);
  const [skipEnt, setSkipEnt] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);
  const [plan, setPlan] = useState<UserRow[] | null>(null);

  /* ---- cost center ---- */
  const [ccNew, setCcNew] = useState("");
  const [pool, setPool] = useState(false);
  const [ccMulti, setCcMulti] = useState("");

  /* ---- move users ---- */
  const [moveCC, setMoveCC] = useState(() => params.get("addcc") ?? "");
  const [moveUsersText, setMoveUsersText] = useState(() => params.get("move") ?? "");

  useEffect(() => {
    if (window.location.hash === "#cost-center") document.getElementById("cost-center")?.scrollIntoView({ block: "start" });
  }, []);

  const needsUser = scope === "user";
  const needsCC = scope === "multi_user_cost_center" || scope === "cost_center";

  const submitBudget = () => {
    if (needsUser && !user.trim()) return toast.error("Informe o login");
    if (needsCC && !ccName) return toast.error("Escolha o cost center");
    const p = budgetPayload({ scope, user: user.trim(), entity: ccName, amount, prevent, expires });
    const who = (p.user as string) || (p.budget_entity_name as string) || "enterprise";
    const existing = p.user ? d.userBudget[(p.user as string).toLowerCase()] : scope === "multi_user_cost_center" ? d.ccBudget[ccName] : null;
    confirm({
      title: "Criar budget",
      confirmLabel: "Criar",
      body: (
        <>
          <p>Budget de <b>{usd0(p.budget_amount as number)}</b> · {scopeLabel(scope)} · <span className="font-mono">{who}</span></p>
          {existing && <Chip tone="warn">Já existe um budget ({usd0(existing.budget_amount)}) para esta entidade — a API vai recusar com 409.</Chip>}
          <Json value={p} />
        </>
      ),
      onConfirm: async () => {
        await s.createBudget({ scope, user: user.trim(), entity: ccName, amount, prevent, expires });
        setUser("");
      },
    });
  };

  const computePlan = () =>
    d.users
      .filter((u) => {
        if (u.ub) return false;
        if (bulkOnly === "__none" ? u.cc : bulkOnly && u.cc?.name !== bulkOnly) return false;
        if (bulkGroup && (u.seat.assigning_team?.slug ?? "__none") !== bulkGroup) return false;
        if (u.cc && bulkExcl.includes(u.cc.name)) return false;
        if (skipCC && u.ccb) return false;
        if (skipEnt && u.coverage === "ent") return false;
        if (onlyActive && u.days > 30) return false;
        return true;
      })
      .sort((a, b) => a.login.localeCompare(b.login));

  const runBulk = () => {
    if (!plan?.length) return;
    const logins = plan.map((u) => u.login);
    confirm({
      title: "Criar budgets em lote",
      confirmLabel: `Criar ${logins.length}`,
      body: <p>Criar <b>{logins.length}</b> budgets de usuário de <b>{usd0(bulkAmount)}</b> (bloqueio ao estourar). As requisições são feitas uma a uma; o progresso aparece no topo.</p>,
      onConfirm: async () => {
        setPlan(null);
        void s.bulkCreateUserBudgets(logins, Math.round(bulkAmount));
      },
    });
  };

  const submitCC = () => {
    const name = ccNew.trim();
    if (!name) return toast.error("Informe o nome");
    if (d.activeCC.some((c) => c.name === name)) return toast.error("Já existe um cost center ativo com esse nome");
    confirm({ title: "Criar cost center", confirmLabel: "Criar", body: <p>Criar o cost center <b>{name}</b>{pool ? " com AI credit pool" : ""}?</p>, onConfirm: async () => { await s.createCostCenters([name], pool); setCcNew(""); } });
  };
  const submitCCMulti = () => {
    const names = ccMulti.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!names.length) return toast.error("Informe ao menos um nome");
    const dup = names.filter((n) => d.activeCC.some((c) => c.name === n));
    const todo = names.filter((n) => !dup.includes(n));
    confirm({
      title: "Criar cost centers",
      confirmLabel: `Criar ${todo.length}`,
      body: (
        <>
          <p>Criar <b>{todo.length}</b> cost centers:</p>
          <div className="flex flex-wrap gap-1">{todo.map((n) => <CcTag key={n} name={n} />)}</div>
          {dup.length > 0 && <Chip tone="warn">{dup.length} já existem e serão pulados</Chip>}
        </>
      ),
      onConfirm: async () => { setCcMulti(""); void s.createCostCenters(todo, false); },
    });
  };

  const move = (remove: boolean) => {
    const c = d.activeCC.find((x) => x.name === moveCC);
    const logins = parseLogins(moveUsersText);
    if (!c) return toast.error("Escolha o cost center");
    if (!logins.length) return toast.error("Informe os logins");
    const unknown = logins.filter((l) => !d.usersByLogin[l.toLowerCase()]);
    const moving = remove ? [] : logins.map((l) => d.ccOfUser[l.toLowerCase()]).filter((x) => x && x.id !== c.id);
    confirm({
      title: remove ? "Remover do cost center" : "Adicionar ao cost center",
      danger: remove,
      confirmLabel: remove ? "Remover" : "Adicionar",
      body: (
        <>
          <p>{remove ? "Remover" : "Adicionar"} <b>{logins.length}</b> usuário(s) {remove ? "de" : "em"} <b>{moveCC}</b>:</p>
          <div className="flex flex-wrap gap-1">{logins.map((l) => <CcTag key={l} name={l} />)}</div>
          {unknown.length > 0 && <Chip tone="warn">{unknown.length} sem seat do Copilot: {unknown.slice(0, 5).join(", ")}{unknown.length > 5 ? "…" : ""}</Chip>}
          {moving.length > 0 && <Chip tone="warn">{moving.length} serão movidos de outro cost center ({[...new Set(moving.map((x) => x.name))].join(", ")})</Chip>}
        </>
      ),
      onConfirm: async () => { await s.moveUsers(c.id, logins, remove); setMoveUsersText(""); },
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="gap-0 py-0">
        <SectionTitle>Criar budget</SectionTitle>
        <CardContent className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          <Field label="Escopo">
            <NativeSelect value={scope} onChange={(e) => { const v = e.target.value as BudgetScope; setScope(v); if (v === "user") setPrevent(true); }}>
              <option value="user">Usuário</option>
              <option value="multi_user_cost_center">Cost center (por usuário)</option>
              <option value="cost_center">Cost center (agregado)</option>
              <option value="enterprise">Enterprise</option>
            </NativeSelect>
          </Field>
          {needsUser && (
            <Field label="Usuário">
              <Input list="dl-users" value={user} onChange={(e) => setUser(e.target.value)} placeholder="login" autoComplete="off" />
              <datalist id="dl-users">{d.users.map((u) => <option key={u.login} value={u.login} />)}</datalist>
            </Field>
          )}
          {needsCC && (
            <Field label="Cost center">
              <NativeSelect value={ccName} onChange={(e) => setCcName(e.target.value)}>
                <option value="">—</option>
                {ccOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Valor (US$)"><Input type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
          {needsUser && <Field label="Expira em (opcional)"><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={needsUser ? true : prevent} disabled={needsUser} onCheckedChange={(v) => setPrevent(!!v)} /> Bloquear uso ao estourar
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button onClick={submitBudget}>Criar budget</Button>
            <span className="text-xs text-muted-foreground">SKU <span className="font-mono">ai_credits</span> · tipo <span className="font-mono">BundlePricing</span></span>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <SectionTitle sub={<Chip tone="accent">usuários sem budget próprio</Chip>}>Criar budgets em lote</SectionTitle>
        <CardContent className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          <Field label="Valor (US$)"><Input type="number" min={0} step={1} value={bulkAmount} onChange={(e) => setBulkAmount(+e.target.value)} /></Field>
          <Field label="Só quem está em">
            <NativeSelect value={bulkOnly} onChange={(e) => setBulkOnly(e.target.value)}>
              <option value="">qualquer cost center (ou nenhum)</option><option value="__none">nenhum cost center</option>
              {ccOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Só quem está no grupo">
            <NativeSelect value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)}>
              <option value="">qualquer grupo</option>
              {groupOptions.map((g) => <option key={g.slug} value={g.slug}>{g.name} ({g.n})</option>)}
            </NativeSelect>
          </Field>
          <Field label="Excluir cost centers (ctrl+clique para vários)" className="sm:col-span-2">
            <NativeSelect multiple size={5} value={bulkExcl} onChange={(e) => setBulkExcl([...e.target.selectedOptions].map((o) => o.value))} className="h-auto py-1">
              {ccOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={skipCC} onCheckedChange={(v) => setSkipCC(!!v)} /> Pular quem já está coberto por budget do cost center</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={skipEnt} onCheckedChange={(v) => setSkipEnt(!!v)} /> Pular quem já aparece no budget enterprise por usuário</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} /> Só seats com atividade nos últimos 30 dias</label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setPlan(computePlan())}>Pré-visualizar</Button>
            <Button onClick={runBulk} disabled={!plan?.length}>Criar</Button>
            {plan && <span className="text-xs text-muted-foreground">{plan.length} usuário(s) receberiam budget de {usd0(bulkAmount)}</span>}
          </div>
          {plan && (
            <div className="sm:col-span-2 max-h-44 overflow-auto rounded-md border p-2 flex flex-wrap gap-1">
              {plan.length ? plan.map((u) => <span key={u.login} title={`${u.cc?.name ?? "sem cost center"} · ${u.seat.assigning_team?.name ?? "sem grupo"}`}><CcTag name={u.login} /></span>) : <span className="text-xs text-muted-foreground">ninguém se encaixa nos filtros</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0" id="cost-center">
        <SectionTitle>Criar cost center</SectionTitle>
        <CardContent className="grid gap-3 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Nome"><Input value={ccNew} onChange={(e) => setCcNew(e.target.value)} placeholder="Ex.: HackaEMB - Time 15" /></Field>
            <label className="flex h-8 items-center gap-2 text-sm"><Checkbox checked={pool} onCheckedChange={(v) => setPool(!!v)} /> AI credit pool</label>
            <Button onClick={submitCC}>Criar</Button>
          </div>
          <div className="border-t pt-3 grid gap-2">
            <Field label="Criar vários (um nome por linha)"><Textarea value={ccMulti} onChange={(e) => setCcMulti(e.target.value)} placeholder={"HackaEMB - Time 15\nHackaEMB - Time 16"} className="font-mono text-xs min-h-24" /></Field>
            <div><Button variant="outline" onClick={submitCCMulti}>Criar todos</Button></div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <SectionTitle>Mover usuários entre cost centers</SectionTitle>
        <CardContent className="grid gap-3 px-4 py-4">
          <Field label="Cost center">
            <NativeSelect value={moveCC} onChange={(e) => setMoveCC(e.target.value)}>
              <option value="">—</option>
              {ccOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Logins (um por linha, vírgula ou espaço)"><Textarea value={moveUsersText} onChange={(e) => setMoveUsersText(e.target.value)} placeholder={"fulano_embraer\nciclano_embraer"} className="font-mono text-xs min-h-24" /></Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => move(false)}>Adicionar ao cost center</Button>
            <Button variant="destructive" onClick={() => move(true)}>Remover do cost center</Button>
          </div>
          <Note>Um usuário só pode pertencer a um cost center — adicionar em outro move o usuário.</Note>
        </CardContent>
      </Card>
    </div>
  );
}
