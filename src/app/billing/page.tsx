"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gate } from "@/components/gate";
import { DataTable, NativeSelect, type Column } from "@/components/data-table";
import { CcTag, Chip, Empty, HBars, Kpi, Login, SectionTitle } from "@/components/bits";
import { Note } from "@/components/confirm";
import { useStore } from "@/lib/store";
import { downloadText, lastMonths, money, monthLabel, nf, toCSV } from "@/lib/format";
import type { BillingRow, UserRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Basis = "gross" | "net";
const chargeOf = (r: BillingRow, basis: Basis) => (basis === "gross" ? r.gross : r.net);
const SKU_LABEL: Record<string, string> = {
  "Copilot Business": "Licenças Copilot Business",
  "Copilot AI Credits": "AI credits",
  "Copilot Premium Request": "Premium requests",
};
const skuLabel = (s: string) => SKU_LABEL[s] ?? s;
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillingPage() {
  return (
    <Gate>
      <Billing />
    </Gate>
  );
}

function Billing() {
  const s = useStore();
  const d = s.d!;
  const months = useMemo(() => lastMonths(12), []);
  const [sel, setSel] = useState(months[0].key);
  const [basis, setBasis] = useState<Basis>("gross");
  const [hideZero, setHideZero] = useState(true);
  const [detail, setDetail] = useState<BillingRow | null>(null);
  const cur = months.find((m) => m.key === sel)!;
  const report = s.billing[sel];
  const isCurrentMonth = sel === months[0].key;

  const rows = useMemo(() => {
    if (!report) return [];
    return report.rows.filter((r) => !hideZero || r.gross > 0 || r.error);
  }, [report, hideZero]);

  const totals = useMemo(() => {
    const t = { charge: 0, gross: 0, net: 0, discount: 0, userMonths: 0, credits: 0, ccWithUse: 0, outside: 0 };
    for (const r of report?.rows ?? []) {
      t.gross += r.gross; t.net += r.net; t.discount += r.discount; t.userMonths += r.userMonths; t.credits += r.credits;
      t.charge += chargeOf(r, basis);
      if (r.ccId && r.gross > 0) t.ccWithUse++;
      if (!r.ccId) t.outside = chargeOf(r, basis);
    }
    return t;
  }, [report, basis]);

  const columns: Column<BillingRow>[] = [
    { id: "name", header: "Cost center", sortValue: (r) => r.name, cell: (r) => (
      <span className="inline-flex items-center gap-2">
        {r.ccId ? <CcTag name={r.name} /> : <span className="text-muted-foreground italic">{r.name}</span>}
        {r.state === "deleted" && <Chip>excluído</Chip>}
        {r.error && <Chip tone="crit">erro</Chip>}
      </span>
    ) },
    { id: "members", header: "Membros", align: "right", sortValue: (r) => r.members, cell: (r) => (r.ccId ? nf(r.members) : "–") },
    { id: "um", header: "User-months", align: "right", sortValue: (r) => r.userMonths, cell: (r) => <span className="text-muted-foreground">{nf2.format(r.userMonths)}</span> },
    { id: "credits", header: "AI credits", align: "right", sortValue: (r) => r.credits, cell: (r) => <span className="text-muted-foreground">{nf(r.credits)}</span> },
    { id: "gross", header: "Bruto", align: "right", sortValue: (r) => r.gross, cell: (r) => money(r.gross) },
    { id: "discount", header: "Descontos", align: "right", sortValue: (r) => r.discount, cell: (r) => <span className="text-muted-foreground">{r.discount ? `− ${money(r.discount)}` : "–"}</span> },
    { id: "net", header: "Líquido", align: "right", sortValue: (r) => r.net, cell: (r) => money(r.net) },
    { id: "charge", header: "A cobrar", align: "right", sortValue: (r) => chargeOf(r, basis), cell: (r) => <b className={cn(chargeOf(r, basis) > 0 && "text-foreground")}>{money(chargeOf(r, basis))}</b> },
    { id: "share", header: "% do total", align: "right", sortValue: (r) => chargeOf(r, basis), cell: (r) => (totals.charge ? `${((chargeOf(r, basis) / totals.charge) * 100).toFixed(1)}%` : "–") },
  ];

  const csvSummary = () => toCSV(rows, [
    { h: "mes", v: () => sel }, { h: "cost_center", v: (r) => r.name }, { h: "estado", v: (r) => r.state }, { h: "membros", v: (r) => (r.ccId ? r.members : "") },
    { h: "licencas_user_months", v: (r) => r.userMonths.toFixed(4) }, { h: "ai_credits", v: (r) => r.credits.toFixed(2) }, { h: "premium_requests", v: (r) => r.premiumRequests.toFixed(2) },
    { h: "bruto_usd", v: (r) => r.gross.toFixed(2) }, { h: "desconto_usd", v: (r) => r.discount.toFixed(2) }, { h: "liquido_usd", v: (r) => r.net.toFixed(2) },
    { h: `a_cobrar_usd_${basis === "gross" ? "bruto" : "liquido"}`, v: (r) => chargeOf(r, basis).toFixed(2) }, { h: "erro", v: (r) => r.error ?? "" },
  ]);
  const csvDetail = () => {
    const flat = rows.flatMap((r) => r.lines.map((l) => ({ r, l })));
    return toCSV(flat, [
      { h: "mes", v: () => sel }, { h: "cost_center", v: (x) => x.r.name }, { h: "sku", v: (x) => x.l.sku }, { h: "unidade", v: (x) => x.l.unitType },
      { h: "quantidade", v: (x) => x.l.quantity.toFixed(4) }, { h: "bruto_usd", v: (x) => x.l.gross.toFixed(2) }, { h: "desconto_usd", v: (x) => x.l.discount.toFixed(2) }, { h: "liquido_usd", v: (x) => x.l.net.toFixed(2) },
    ]);
  };
  const perUserRows = (r: BillingRow) => (r.ccId ? d.users.filter((u) => u.cc?.id === r.ccId && u.consumed != null).sort((a, b) => b.consumed! - a.consumed!) : []);
  const csvUsers = () => {
    const flat = rows.flatMap((r) => perUserRows(r).map((u) => ({ r, u })));
    return toCSV(flat, [
      { h: "mes", v: () => sel }, { h: "cost_center", v: (x) => x.r.name }, { h: "login", v: (x) => x.u.login }, { h: "consumo_ai_credits_usd", v: (x) => x.u.consumed!.toFixed(2) },
      { h: "teto_usd", v: (x) => x.u.target ?? "" }, { h: "fonte", v: (x) => (x.u.ub ? "budget de usuário" : x.u.us?.scope === "multi_user_customer" ? "budget enterprise" : "budget do cost center") },
    ]);
  };
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copiado")).catch(() => toast.error("Não foi possível copiar"));

  return (
    <>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <NativeSelect value={sel} onChange={(e) => setSel(e.target.value)}>
            {months.map((m) => <option key={m.key} value={m.key}>{m.label}{m.key === months[0].key ? " (em andamento)" : ""}</option>)}
          </NativeSelect>
          <Button onClick={() => void s.loadBilling(cur.year, cur.month, !!report)} disabled={!!s.progress}>
            <RefreshCw className={cn(s.progress && "animate-spin")} /> {report ? "Atualizar" : "Gerar relatório"}
          </Button>
          <div className="ml-1 inline-flex rounded-lg border p-0.5 text-xs">
            {(["gross", "net"] as Basis[]).map((b) => (
              <button key={b} type="button" onClick={() => setBasis(b)} className={cn("rounded-md px-2.5 py-1", basis === b ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {b === "gross" ? "Cobrar valor bruto" : "Cobrar valor líquido"}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> ocultar sem uso</label>
          {report && (
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => downloadText(`cobranca-copilot-${sel}.csv`, csvSummary())}><Download /> CSV resumo</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(`cobranca-copilot-${sel}-detalhado.csv`, csvDetail())}><FileSpreadsheet /> CSV por SKU</Button>
              {isCurrentMonth && <Button size="sm" variant="outline" onClick={() => downloadText(`cobranca-copilot-${sel}-usuarios.csv`, csvUsers())}><FileSpreadsheet /> CSV por usuário</Button>}
              <Button size="sm" variant="ghost" onClick={() => copy(csvSummary())}><Copy /> Copiar</Button>
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
          Fonte: relatório de uso do GitHub (<span className="font-mono">/settings/billing/usage</span>) filtrado por cost center. <b>Bruto</b> = licenças (US$ 19/user-month, rateadas por dia) + AI credits (US$ 0,01/crédito) a preço de lista; <b>líquido</b> = o que o GitHub fatura após descontos — no plano atual os AI credits têm 100% de desconto, então o líquido reflete só licenças. Para cobrar <i>pelo consumo</i>, use o bruto.
          {isCurrentMonth && " Mês em andamento: valores parciais até hoje."}
        </div>
      </Card>

      {!report ? (
        <Card className="gap-0 py-0"><Empty>Escolha o mês e clique em “Gerar relatório” — são {s.cc.length + 1} consultas à API ({s.cc.length} cost centers + uso fora de cost center).</Empty></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label={`Total a cobrar (${monthLabel(cur.year, cur.month)})`} value={money(totals.charge)} foot={basis === "gross" ? "valor bruto" : "valor líquido"} />
            <Kpi label="Licenças" value={money(totals.userMonths * 19)} foot={`${nf2.format(totals.userMonths)} user-months`} />
            <Kpi label="AI credits (bruto)" value={money(totals.credits * 0.01)} foot={`${nf(totals.credits)} créditos`} />
            <Kpi label="Cost centers com uso" value={nf(totals.ccWithUse)} foot={`de ${s.cc.length} cadastrados`} />
            <Kpi label="Fora de cost center" value={money(totals.outside)} foot="faturado direto na enterprise" />
          </div>

          <div className="grid gap-4">
            <Card className="gap-0 py-0">
              <SectionTitle sub={`gerado ${new Date(report.generatedAt).toLocaleString("pt-BR")}`}>Valor por cost center</SectionTitle>
              <DataTable rows={rows} columns={columns} rowKey={(r) => r.ccId ?? "__ent"} defaultSort={{ id: "charge", dir: -1 }} onRowClick={setDetail} pageSize={200} footer={(n, t) => `${n} de ${t} linhas · total ${money(totals.charge)}`} empty="Nenhum uso no período." />
            </Card>
            <Card className="gap-0 py-0">
              <SectionTitle sub="valor a cobrar">Top 15 cost centers</SectionTitle>
              <CardContent className="px-4 py-4 max-w-3xl">
                <HBars rows={rows.filter((r) => chargeOf(r, basis) > 0).sort((a, b) => chargeOf(b, basis) - chargeOf(a, basis)).slice(0, 15).map((r) => ({ name: r.name, key: r.ccId ?? "__ent", v: chargeOf(r, basis), color: r.ccId ? "bg-blue-500" : "bg-muted-foreground/50" }))} onClick={(k) => setDetail(rows.find((r) => (r.ccId ?? "__ent") === k) ?? null)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="data-[side=right]:sm:max-w-2xl overflow-y-auto gap-0 p-0">
          {detail && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <SheetTitle className="font-mono text-base">{detail.name}</SheetTitle>
                <SheetDescription>{monthLabel(cur.year, cur.month)} · {detail.ccId ? `${detail.members} membros` : "uso não atribuído a cost center"}</SheetDescription>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip tone="accent">a cobrar {money(chargeOf(detail, basis))}</Chip>
                  <Chip>bruto {money(detail.gross)}</Chip>
                  <Chip>líquido {money(detail.net)}</Chip>
                </div>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-5 py-4">
                {detail.error && <Note>Erro ao consultar: {detail.error}</Note>}
                <section className="rounded-lg border">
                  <div className="border-b px-3 py-2 text-sm font-semibold">Itens faturados</div>
                  <Table>
                    <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detail.lines.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem itens.</TableCell></TableRow>}
                      {detail.lines.map((l) => (
                        <TableRow key={`${l.sku}|${l.unitType}`}>
                          <TableCell>{skuLabel(l.sku)}<div className="text-[11px] text-muted-foreground">{l.items} lançamentos</div></TableCell>
                          <TableCell className="text-right tabular-nums">{nf2.format(l.quantity)} <span className="text-muted-foreground text-xs">{l.unitType === "UserMonths" ? "user-months" : l.unitType === "AICredits" ? "créditos" : l.unitType}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{money(l.gross)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{l.discount ? `− ${money(l.discount)}` : "–"}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(l.net)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
                {detail.ccId && (
                  <section className="rounded-lg border">
                    <div className="flex items-center border-b px-3 py-2 text-sm font-semibold">
                      <span className="mr-auto">Rateio por usuário (AI credits)</span>
                      {isCurrentMonth ? <span className="text-xs font-normal text-muted-foreground">consumo do mês via budgets</span> : <Chip tone="warn">só disponível para o mês em andamento</Chip>}
                    </div>
                    {isCurrentMonth ? <PerUser row={detail} rows={perUserRows(detail)} /> : <div className="px-3 py-4 text-xs text-muted-foreground">A API só expõe consumo por usuário do ciclo atual (user-states dos budgets). Para meses passados, exporte o CSV por usuário antes do fechamento.</div>}
                  </section>
                )}
                <Button variant="outline" size="sm" onClick={() => { const r = detail; copy(toCSV(r.lines, [{ h: "cost_center", v: () => r.name }, { h: "sku", v: (l) => l.sku }, { h: "quantidade", v: (l) => l.quantity.toFixed(4) }, { h: "bruto", v: (l) => l.gross.toFixed(2) }, { h: "liquido", v: (l) => l.net.toFixed(2) }])); }}><Copy /> Copiar itens</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PerUser({ row, rows }: { row: BillingRow; rows: UserRow[] }) {
  const s = useStore();
  const total = rows.reduce((a, u) => a + (u.consumed ?? 0), 0);
  const creditsUsd = row.credits * 0.01;
  return (
    <div>
      <div className="max-h-80 overflow-auto">
      <Table>
        <TableHeader><TableRow><TableHead>Login</TableHead><TableHead className="text-right">Consumo</TableHead><TableHead className="text-right">% do CC</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Nenhum membro com consumo rastreável.</TableCell></TableRow>}
          {rows.map((u) => (
            <TableRow key={u.login} className="cursor-pointer" onClick={() => s.showUser(u.login)}>
              <TableCell><Login login={u.login} /></TableCell>
              <TableCell className="text-right tabular-nums">{money(u.consumed)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{total ? `${(((u.consumed ?? 0) / total) * 100).toFixed(1)}%` : "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      <div className="flex justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>soma dos usuários: <b className="text-foreground">{money(total)}</b></span>
        <span>AI credits do relatório: <b className="text-foreground">{money(creditsUsd)}</b>{Math.abs(total - creditsUsd) > 1 && <span title="Diferença normal: os budgets zeram no ciclo e o relatório inclui uso de membros sem budget rastreável"> · Δ {money(creditsUsd - total)}</span>}</span>
      </div>
    </div>
  );
}
