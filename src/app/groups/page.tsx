"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gate } from "@/components/gate";
import { DataTable, type Column } from "@/components/data-table";
import { ActivityChip, CcTag, Chip, CoverageChip, HBars, Kpi, Login, Meter, SectionTitle, StackBar } from "@/components/bits";
import { Note } from "@/components/confirm";
import { useStore } from "@/lib/store";
import { MONTHS, downloadText, money, nf, toCSV, usd0 } from "@/lib/format";
import type { UserRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEAT_PRICE = 19;
const NO_TEAM = "__none";

interface Group {
  key: string;
  name: string;
  users: UserRow[];
  seats: number;
  active7: number;
  active30: number;
  never: number;
  pending: number;
  addedThisMonth: number;
  licenseFull: number;      // seats × 19
  licenseToDate: number;    // rateado pelos dias de seat no mês até hoje
  credits: number;          // US$ consumidos em AI credits (ciclo atual)
  creditsKnown: number;     // usuários com consumo rastreável
  over: number;             // usuários no teto
  byCC: { name: string; id: string | null; n: number; credits: number }[];
}

function buildGroups(users: UserRow[]): Group[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const map = new Map<string, UserRow[]>();
  for (const u of users) {
    const k = u.seat.assigning_team?.slug ?? NO_TEAM;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(u);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const name = key === NO_TEAM ? "Sem grupo (atribuição direta)" : list[0].seat.assigning_team?.name ?? key;
      let licenseToDate = 0, addedThisMonth = 0;
      for (const u of list) {
        const created = new Date(u.seat.created_at);
        const from = created > monthStart ? created.getDate() : 1;
        if (created > monthStart) addedThisMonth++;
        licenseToDate += (SEAT_PRICE * Math.max(0, dayOfMonth - from + 1)) / daysInMonth;
      }
      const cc = new Map<string, { name: string; id: string | null; n: number; credits: number }>();
      for (const u of list) {
        const k = u.cc?.id ?? "__none";
        if (!cc.has(k)) cc.set(k, { name: u.cc?.name ?? "sem cost center", id: u.cc?.id ?? null, n: 0, credits: 0 });
        const e = cc.get(k)!;
        e.n++;
        e.credits += u.consumed ?? 0;
      }
      return {
        key, name, users: list, seats: list.length,
        active7: list.filter((u) => u.days <= 7).length,
        active30: list.filter((u) => u.days <= 30).length,
        never: list.filter((u) => u.days === Infinity).length,
        pending: list.filter((u) => u.pending).length,
        addedThisMonth,
        licenseFull: list.length * SEAT_PRICE,
        licenseToDate,
        credits: list.reduce((a, u) => a + (u.consumed ?? 0), 0),
        creditsKnown: list.filter((u) => u.consumed != null).length,
        over: list.filter((u) => (u.pct ?? 0) >= 100).length,
        byCC: [...cc.values()].sort((a, b) => b.credits - a.credits || b.n - a.n),
      };
    })
    .sort((a, b) => b.seats - a.seats);
}

export default function GroupsPage() {
  return (
    <Gate>
      <Groups />
    </Gate>
  );
}

function Groups() {
  const s = useStore();
  const d = s.d!;
  const groups = useMemo(() => buildGroups(d.users), [d.users]);
  const [open, setOpen] = useState<Group | null>(null);
  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]}/${now.getFullYear()}`;
  const total = groups.reduce((a, g) => ({ seats: a.seats + g.seats, lic: a.lic + g.licenseFull, licTD: a.licTD + g.licenseToDate, cr: a.cr + g.credits }), { seats: 0, lic: 0, licTD: 0, cr: 0 });
  const totalCost = (g: Group) => g.licenseFull + g.credits;
  const PALETTE = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500"];
  const colorOf = (i: number) => PALETTE[i % PALETTE.length];

  const columns: Column<Group>[] = [
    { id: "name", header: "Grupo", sortValue: (g) => g.name, cell: (g) => <span className="inline-flex items-center gap-2"><span className={cn("size-2.5 rounded-sm", colorOf(groups.indexOf(g)))} /><span className="font-medium">{g.name}</span>{g.key !== NO_TEAM && <span className="font-mono text-[11px] text-muted-foreground">{g.key.replace(/^ent:/, "")}</span>}</span> },
    { id: "seats", header: "Seats", align: "right", sortValue: (g) => g.seats, cell: (g) => <span className="inline-flex items-center gap-2">{nf(g.seats)}{g.addedThisMonth > 0 && <Chip tone="accent">+{g.addedThisMonth} no mês</Chip>}{g.pending > 0 && <Chip tone="warn">{g.pending} cancelando</Chip>}</span> },
    { id: "active", header: "Ativos 7d / 30d", align: "right", sortValue: (g) => g.active30, cell: (g) => <span className="text-muted-foreground">{nf(g.active7)} / {nf(g.active30)}</span> },
    { id: "never", header: "Nunca usaram", align: "right", sortValue: (g) => g.never, cell: (g) => (g.never ? <Chip tone={g.never / g.seats > 0.3 ? "warn" : "neutral"}>{nf(g.never)} ({Math.round((g.never / g.seats) * 100)}%)</Chip> : "0") },
    { id: "lic", header: "Licenças (cheio)", align: "right", sortValue: (g) => g.licenseFull, cell: (g) => money(g.licenseFull) },
    { id: "licTD", header: "Até hoje", align: "right", sortValue: (g) => g.licenseToDate, cell: (g) => <span className="text-muted-foreground">{money(g.licenseToDate)}</span> },
    { id: "credits", header: "AI credits", align: "right", sortValue: (g) => g.credits, cell: (g) => <span className="inline-flex items-center gap-2">{money(g.credits)}{g.over > 0 && <Chip tone="crit">{g.over} no teto</Chip>}</span> },
    { id: "avg", header: "Por ativo", align: "right", sortValue: (g) => (g.active30 ? g.credits / g.active30 : 0), cell: (g) => <span className="text-muted-foreground">{money(g.active30 ? g.credits / g.active30 : 0)}</span> },
    { id: "total", header: "Custo mês", align: "right", sortValue: totalCost, cell: (g) => <b>{money(totalCost(g))}</b> },
    { id: "share", header: "%", align: "right", sortValue: totalCost, cell: (g) => `${((totalCost(g) / (total.lic + total.cr)) * 100).toFixed(1)}%` },
  ];

  const csvGroups = () => toCSV(groups, [
    { h: "mes", v: () => monthLabel }, { h: "grupo", v: (g) => g.name }, { h: "slug", v: (g) => (g.key === NO_TEAM ? "" : g.key) }, { h: "seats", v: (g) => g.seats },
    { h: "ativos_7d", v: (g) => g.active7 }, { h: "ativos_30d", v: (g) => g.active30 }, { h: "nunca_usaram", v: (g) => g.never }, { h: "adicionados_no_mes", v: (g) => g.addedThisMonth }, { h: "cancelamento_pendente", v: (g) => g.pending },
    { h: "licencas_mes_cheio_usd", v: (g) => g.licenseFull.toFixed(2) }, { h: "licencas_ate_hoje_usd", v: (g) => g.licenseToDate.toFixed(2) }, { h: "ai_credits_usd", v: (g) => g.credits.toFixed(2) }, { h: "custo_mes_usd", v: (g) => totalCost(g).toFixed(2) },
  ]);
  const csvUsers = () => toCSV(groups.flatMap((g) => g.users.map((u) => ({ g, u }))), [
    { h: "mes", v: () => monthLabel }, { h: "grupo", v: (x) => x.g.name }, { h: "login", v: (x) => x.u.login }, { h: "cost_center", v: (x) => x.u.cc?.name ?? "" },
    { h: "licenca_usd", v: () => SEAT_PRICE }, { h: "ai_credits_usd", v: (x) => (x.u.consumed == null ? "" : x.u.consumed.toFixed(2)) }, { h: "teto_usd", v: (x) => x.u.target ?? "" },
    { h: "ultima_atividade", v: (x) => x.u.lastActivity ?? "" }, { h: "seat_desde", v: (x) => x.u.seat.created_at.slice(0, 10) },
  ]);
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado")).catch(() => toast.error("Não foi possível copiar"));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Custo total (${monthLabel})`} value={money(total.lic + total.cr)} foot={`${money(total.lic)} licenças · ${money(total.cr)} AI credits`} />
        <Kpi label="Grupos" value={nf(groups.length)} foot={`${nf(total.seats)} seats`} />
        <Kpi label="Licenças até hoje" value={money(total.licTD)} foot={`rateio por dia · ${now.getDate()}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} do mês`} />
        <Kpi label="AI credits por seat" value={money(total.seats ? total.cr / total.seats : 0)} foot="média do ciclo atual" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <SectionTitle sub="licenças (mês cheio) + AI credits">Custo por grupo</SectionTitle>
          <CardContent className="px-4 py-4">
            <StackBar total={total.lic + total.cr} parts={groups.map((g, i) => ({ label: g.name, v: Math.round(totalCost(g)), color: colorOf(i) }))} />
            <div className="mt-4">
              <HBars rows={groups.map((g, i) => ({ name: g.name, key: g.key, v: totalCost(g), color: colorOf(i) }))} onClick={(k) => setOpen(groups.find((g) => g.key === k) ?? null)} />
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <SectionTitle sub="onde o consumo em créditos está">AI credits por grupo</SectionTitle>
          <CardContent className="px-4 py-4">
            <StackBar total={total.cr || 1} parts={groups.map((g, i) => ({ label: g.name, v: Math.round(g.credits), color: colorOf(i) }))} />
            <div className="mt-4">
              <HBars rows={groups.map((g, i) => ({ name: g.name, key: g.key, v: g.credits, color: colorOf(i) }))} onClick={(k) => setOpen(groups.find((g) => g.key === k) ?? null)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <SectionTitle action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => downloadText(`custo-por-grupo-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`, csvGroups())}><Download /> CSV grupos</Button>
            <Button size="sm" variant="outline" onClick={() => downloadText(`custo-por-grupo-usuarios-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`, csvUsers())}><Download /> CSV usuários</Button>
            <Button size="sm" variant="ghost" onClick={() => copy(csvGroups())}><Copy /> Copiar</Button>
          </div>
        }>Detalhe por grupo</SectionTitle>
        <DataTable rows={groups} columns={columns} rowKey={(g) => g.key} defaultSort={{ id: "total", dir: -1 }} onRowClick={setOpen} footer={(n) => `${n} grupos · clique para ver usuários e cost centers`} />
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
          Grupo = enterprise team que atribuiu o seat (vem do IdP: <span className="font-mono">github-copilot-users</span>, <span className="font-mono">github-copilot-hackaemb</span>). Licença a {usd0(SEAT_PRICE)}/seat/mês: <b>mês cheio</b> = seats atuais × {usd0(SEAT_PRICE)}; <b>até hoje</b> = rateado pelos dias em que cada seat existiu neste mês. AI credits = consumo do ciclo atual via budgets (a preço de lista); seats sem budget rastreável entram como zero.
        </div>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="data-[side=right]:sm:max-w-2xl overflow-y-auto gap-0 p-0">
          {open && <GroupDetail g={open} colorClass={colorOf(groups.indexOf(open))} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function GroupDetail({ g, colorClass }: { g: Group; colorClass: string }) {
  const s = useStore();
  const users = g.users.slice().sort((a, b) => (b.consumed ?? -1) - (a.consumed ?? -1));
  const [limit, setLimit] = useState(30);
  return (
    <>
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle className="flex items-center gap-2"><span className={cn("size-3 rounded-sm", colorClass)} />{g.name}</SheetTitle>
        <SheetDescription>{g.key === NO_TEAM ? "seats atribuídos sem enterprise team" : <span className="font-mono">{g.key}</span>}</SheetDescription>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="accent">{nf(g.seats)} seats</Chip>
          <Chip>licenças {money(g.licenseFull)}</Chip>
          <Chip>AI credits {money(g.credits)}</Chip>
          <Chip tone={g.never / g.seats > 0.3 ? "warn" : "neutral"}>{nf(g.never)} nunca usaram</Chip>
          {g.over > 0 && <Chip tone="crit">{g.over} no teto</Chip>}
        </div>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-5 py-4">
        <section className="rounded-lg border">
          <div className="flex items-center border-b px-3 py-2 text-sm font-semibold"><span className="mr-auto">Cost centers do grupo</span><span className="text-xs font-normal text-muted-foreground">{g.byCC.length}</span></div>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Cost center</TableHead><TableHead className="text-right">Seats</TableHead><TableHead className="text-right">Licenças</TableHead><TableHead className="text-right">AI credits</TableHead></TableRow></TableHeader>
              <TableBody>
                {g.byCC.map((c) => (
                  <TableRow key={c.id ?? "__none"} className={cn(c.id && "cursor-pointer")} onClick={c.id ? () => s.showCC(c.id!) : undefined}>
                    <TableCell>{c.id ? <CcTag name={c.name} /> : <span className="text-muted-foreground">{c.name}</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.n}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(c.n * SEAT_PRICE)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.credits)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
        <section className="rounded-lg border">
          <div className="flex items-center border-b px-3 py-2 text-sm font-semibold"><span className="mr-auto">Usuários</span><span className="text-xs font-normal text-muted-foreground">por consumo</span></div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Login</TableHead><TableHead>Cost center</TableHead><TableHead>Consumo</TableHead><TableHead>Cobertura</TableHead><TableHead>Atividade</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.slice(0, limit).map((u) => (
                  <TableRow key={u.login} className="cursor-pointer" onClick={() => s.showUser(u.login)}>
                    <TableCell><Login login={u.login} /></TableCell>
                    <TableCell>{u.cc ? <CcTag name={u.cc.name} /> : <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell><Meter consumed={u.consumed} target={u.target} /></TableCell>
                    <TableCell><CoverageChip u={u} /></TableCell>
                    <TableCell><ActivityChip u={u} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {users.length > limit && <div className="border-t px-3 py-2"><Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 50)}>Mostrar mais ({users.length - limit} restantes)</Button></div>}
        </section>
        {g.never > 0 && <Note>{nf(g.never)} seats deste grupo nunca registraram atividade — {money(g.never * SEAT_PRICE)}/mês em licenças sem uso.</Note>}
      </div>
    </>
  );
}
