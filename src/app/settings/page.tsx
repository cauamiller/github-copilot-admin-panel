"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, SectionTitle } from "@/components/bits";
import { useStore } from "@/lib/store";
import { gh } from "@/lib/gh-client";
import { inFuture, nf } from "@/lib/format";

export default function SettingsPage() {
  const s = useStore();
  const [testing, setTesting] = useState(false);
  const test = async () => {
    setTesting(true);
    try {
      const me = await gh<{ login: string }>("user");
      toast.success(`Token válido — ${me.login}`);
    } catch (e) {
      toast.error(`Token inválido: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };
  const rows: [string, React.ReactNode][] = [
    ["Enterprise", <span key="e" className="font-mono">{s.ent}</span>],
    ["Token", s.config?.hasToken ? <span className="inline-flex items-center gap-2"><Chip tone="good" dot>configurado</Chip><span className="font-mono text-xs text-muted-foreground">{s.config.tokenHint}</span></span> : <Chip tone="crit">não configurado</Chip>],
    ["Autenticado como", s.me ? <span key="m" className="font-mono">{s.me.login}</span> : "–"],
    ["Rate limit", s.rate ? `${nf(s.rate.remaining)} de ${nf(s.rate.limit)} · renova ${inFuture(s.rate.reset)}` : "–"],
    ["Último carregamento", s.loadedAt ? new Date(s.loadedAt).toLocaleString("pt-BR") : "–"],
  ];

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="gap-0 py-0">
        <SectionTitle action={<Button size="sm" variant="outline" onClick={test} disabled={testing || !s.config?.hasToken}>{testing ? "Testando…" : "Testar token"}</Button>}>Conexão</SectionTitle>
        <CardContent className="px-4 py-4">
          <dl className="grid grid-cols-[170px_1fr] gap-x-3 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 rounded-md border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            O token é lido no servidor Next.js das variáveis <span className="font-mono">{(s.config?.tokenVars ?? ["GH_COPILOT"]).join(", ")}</span> (ou de <span className="font-mono">.env.local</span>) e nunca é enviado ao navegador. A enterprise vem de <span className="font-mono">GH_ENTERPRISE</span> (padrão <span className="font-mono">embraer</span>). Escopos necessários: <span className="font-mono">manage_billing:enterprise</span>, <span className="font-mono">read:enterprise</span>, <span className="font-mono">manage_billing:copilot</span>.
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <SectionTitle>Endpoints usados</SectionTitle>
        <CardContent className="px-4 py-4 font-mono text-xs leading-7 text-muted-foreground">
          GET /enterprises/{"{ent}"}/settings/billing/cost-centers<br />
          GET /enterprises/{"{ent}"}/settings/billing/budgets<br />
          GET /enterprises/{"{ent}"}/settings/billing/budgets/{"{id}"}/user-states<br />
          GET /enterprises/{"{ent}"}/settings/billing/usage[?cost_center_id]<br />
          GET /enterprises/{"{ent}"}/copilot/billing/seats<br />
          POST/PATCH/DELETE …/budgets, …/cost-centers, …/cost-centers/{"{id}"}/resource
        </CardContent>
      </Card>
    </div>
  );
}
