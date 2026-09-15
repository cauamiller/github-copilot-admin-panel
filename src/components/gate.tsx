"use client";

import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

/** Renders children only when data is loaded; otherwise a setup notice or skeleton. */
export function Gate({ children }: { children: ReactNode }) {
  const s = useStore();
  if (s.configError) return <Notice title="Não foi possível ler a configuração do servidor">{s.configError}</Notice>;
  if (s.config && !s.config.hasToken)
    return (
      <Notice title="Token do GitHub não configurado">
        Defina <code className="font-mono">{s.config.tokenVars[0]}</code> no ambiente (ou em <code className="font-mono">.env.local</code>) e reinicie o servidor. Veja <Link href="/settings" className="underline">Configurações</Link>.
      </Notice>
    );
  if (s.error && !s.d) return <Notice title="Falha ao carregar">{s.error} <Button size="sm" variant="outline" className="ml-2" onClick={() => void s.loadAll()}>Tentar de novo</Button></Notice>;
  if (!s.d)
    return (
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        <Skeleton className="h-72 rounded-xl sm:col-span-3" />
        <Skeleton className="h-72 rounded-xl sm:col-span-3" />
      </div>
    );
  return <>{children}</>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="flex gap-3 py-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div><div className="font-semibold">{title}</div><div className="mt-1 text-muted-foreground">{children}</div></div>
      </CardContent>
    </Card>
  );
}
