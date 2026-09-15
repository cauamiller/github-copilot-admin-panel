"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, HBars, Kpi, SectionTitle, StackBar } from "@/components/bits";
import { Gate } from "@/components/gate";
import { AlertCard } from "@/components/alert-card";
import { MonthlyChart } from "@/components/monthly-chart";
import { useStore } from "@/lib/store";
import { MONTHS, money, nf, pct, usd0 } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function OverviewPage() {
  return (
    <Gate>
      <Overview />
    </Gate>
  );
}

function Overview() {
  const s = useStore();
  const router = useRouter();
  const d = s.d!;
  const u = d.users;
  const active7 = u.filter((x) => x.days <= 7).length;
  const active30 = u.filter((x) => x.days <= 30).length;
  const cov = { user: 0, cc: 0, ent: 0, none: 0 };
  for (const x of u) cov[x.coverage]++;
  const ub = s.budgets.filter((b) => b.budget_scope === "user");
  const spentUser = u.filter((x) => x.ub).reduce((a, x) => a + (x.consumed ?? 0), 0);
  const spentShared = u.filter((x) => !x.ub).reduce((a, x) => a + (x.consumed ?? 0), 0);
  const over = ub.filter((b) => (pct(b.consumed_amount, b.budget_amount) ?? 0) >= 100).length + u.filter((x) => !x.ub && x.us && !x.us.override_budget_id && (x.pct ?? 0) >= 100).length;
  const ccNoBudget = d.ccRows.filter((r) => r.cc.state === "active" && !r.budget).length;
  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]}/${now.getFullYear()}`;
  const top = u.filter((x) => (x.consumed ?? 0) > 0).sort((a, b) => b.consumed! - a.consumed!).slice(0, 12);
  const known = u.filter((x) => x.consumed != null).length;
  const topAlerts = d.alerts.filter((a) => a.level).slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Seats do Copilot" value={nf(u.length)} href="/users" foot={<Chip tone="good" dot>{active7} ativos em 7 d</Chip>} />
        <Kpi label="Cost centers ativos" value={nf(d.activeCC.length)} href="/cost-centers" foot={ccNoBudget ? <Chip tone="serious">{ccNoBudget} sem budget</Chip> : <Chip tone="good">todos com budget</Chip>} />
        <Kpi label="Budgets" value={nf(s.budgets.length)} href="/budgets" foot={`${ub.length} de usuário · ${s.budgets.length - ub.length} compartilhados`} />
        <Kpi label="Sem budget rastreável" value={nf(cov.none)} href="/alerts" foot={cov.none ? <Chip tone="crit">verificar cobertura</Chip> : <Chip tone="good">todos cobertos</Chip>} />
        <Kpi label={`Gasto em AI credits (${monthLabel})`} value={money(spentUser + spentShared)} href="/consumption" foot={`${money(spentUser)} em budgets de usuário · ${money(spentShared)} em compartilhados`} />
        <Kpi label="Usuários no teto" value={nf(over)} href="/alerts" foot={over ? <Chip tone="crit">bloqueados pelo budget</Chip> : <Chip tone="good">nenhum</Chip>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <SectionTitle sub={
            <Tooltip>
              <TooltipTrigger render={<span />}><Chip>fora de cost centers</Chip></TooltipTrigger>
              <TooltipContent className="max-w-xs">Relatório /settings/billing/usage sem filtro de cost center. O que é atribuído a cost centers com assinatura Azure não entra aqui.</TooltipContent>
            </Tooltip>
          }>Faturado direto na enterprise por mês</SectionTitle>
          <CardContent className="px-4 py-4">
            <MonthlyChart items={s.usage} />
            <div className="mt-1 text-xs text-muted-foreground">valor bruto (antes de descontos)</div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <SectionTitle sub={`${known} de ${u.length} seats com consumo rastreável`}>Maiores consumos do mês</SectionTitle>
          <CardContent className="px-4 py-4">
            <HBars rows={top.map((x) => ({ name: x.login, key: x.login, v: x.consumed!, color: (x.pct ?? 0) >= 100 ? "bg-red-500" : (x.pct ?? 0) >= 90 ? "bg-orange-500" : "bg-blue-500" }))} onClick={(k) => s.showUser(k)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <SectionTitle>Cobertura de budget dos seats</SectionTitle>
          <CardContent className="px-4 py-4">
            <StackBar total={u.length} parts={[
              { label: "Budget de usuário", v: cov.user, color: "bg-blue-500" },
              { label: "Budget do cost center", v: cov.cc, color: "bg-emerald-500" },
              { label: `Budget enterprise por usuário${d.entBudget ? ` (${usd0(d.entBudget.budget_amount)})` : ""}`, v: cov.ent, color: "bg-amber-500" },
              { label: "Nenhum rastreável", v: cov.none, color: "bg-red-500" },
            ]} />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <SectionTitle>Atividade dos seats</SectionTitle>
          <CardContent className="px-4 py-4">
            <StackBar total={u.length} parts={[
              { label: "Últimos 7 dias", v: active7, color: "bg-blue-500" },
              { label: "8 a 30 dias", v: active30 - active7, color: "bg-emerald-500" },
              { label: "Mais de 30 dias", v: u.filter((x) => x.days > 30 && x.days !== Infinity).length, color: "bg-amber-500" },
              { label: "Nunca", v: u.filter((x) => x.days === Infinity).length, color: "bg-muted-foreground/40" },
            ]} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <SectionTitle action={<Button size="sm" variant="outline" render={<Link href="/alerts" />} nativeButton={false} >Ver todos</Button>}>Alertas que pedem atenção</SectionTitle>
        <CardContent className="px-4 py-4">
          {topAlerts.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
              {topAlerts.map((a) => <AlertCard key={a.id} a={a} onToggle={() => router.push(`/alerts?open=${a.id}`)} />)}
            </div>
          ) : <div className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta crítico agora.</div>}
        </CardContent>
      </Card>
    </>
  );
}
