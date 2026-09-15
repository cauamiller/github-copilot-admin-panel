"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gate } from "@/components/gate";
import { AlertCard } from "@/components/alert-card";
import { Empty } from "@/components/bits";
import { useStore } from "@/lib/store";

export default function AlertsPage() {
  return (
    <Gate>
      <Suspense>
        <AlertsKeyed />
      </Suspense>
    </Gate>
  );
}

function AlertsKeyed() {
  const params = useSearchParams();
  const initial = params.get("open");
  return <Alerts key={initial ?? ""} initial={initial} />;
}

function Alerts({ initial }: { initial: string | null }) {
  const s = useStore();
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial ? [initial] : []));

  const alerts = s.d!.alerts;
  if (!alerts.length) return <Empty>Nenhum alerta. Tudo em ordem.</Empty>;
  const ordered = [...alerts.filter((a) => open.has(a.id)), ...alerts.filter((a) => !open.has(a.id))];
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
      {ordered.map((a) => (
        <AlertCard key={a.id} a={a} open={open.has(a.id)} onToggle={() => setOpen((x) => { const n = new Set(x); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} />
      ))}
    </div>
  );
}
