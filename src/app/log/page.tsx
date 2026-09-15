"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, SectionTitle } from "@/components/bits";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function LogPage() {
  const s = useStore();
  return (
    <Card className="gap-0 py-0">
      <SectionTitle action={<Button size="sm" variant="outline" onClick={s.clearLog} disabled={!s.log.length}>Limpar</Button>}>Ações desta sessão</SectionTitle>
      {s.log.length === 0 ? (
        <Empty>Nenhuma ação executada nesta sessão.</Empty>
      ) : (
        <div className="divide-y text-[13px]">
          {s.log.map((e, i) => (
            <div key={i} className="grid grid-cols-[64px_48px_1fr] gap-3 px-4 py-2.5">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{e.t.toTimeString().slice(0, 8)}</span>
              <span className={cn("font-medium", e.status === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{e.status === "ok" ? "OK" : "Erro"}</span>
              <span><b className="font-medium">{e.action}</b> <span className="text-muted-foreground">{e.detail}</span></span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
