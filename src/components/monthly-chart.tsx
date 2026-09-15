"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTHS, money, usd0 } from "@/lib/format";
import type { UsageItem } from "@/lib/types";
import { Empty } from "@/components/bits";

const SERIES: { sku: string; label: string; color: string }[] = [
  { sku: "Copilot AI Credits", label: "AI credits", color: "#2a78d6" },
  { sku: "Copilot Business", label: "Licenças Business", color: "#eb6834" },
  { sku: "Copilot Premium Request", label: "Premium requests", color: "#1baf7a" },
];
const OTHER = { sku: "Outros", label: "Outros", color: "#eda100" };

export function MonthlyChart({ items }: { items: UsageItem[] }) {
  const data = useMemo(() => {
    const byMonth: Record<string, Record<string, number>> = {};
    for (const it of items) {
      const k = it.date.slice(0, 7);
      const s = SERIES.find((x) => x.sku === it.sku)?.sku ?? OTHER.sku;
      byMonth[k] ??= { net: 0 };
      byMonth[k][s] = (byMonth[k][s] ?? 0) + (it.grossAmount || 0);
      byMonth[k].net += it.netAmount || 0;
    }
    return Object.keys(byMonth).sort().slice(-12).map((k) => {
      const [y, m] = k.split("-");
      return { k, label: `${MONTHS[+m - 1]}/${y.slice(2)}`, ...byMonth[k] } as Record<string, number> & { k: string; label: string };
    });
  }, [items]);

  if (!data.length) return <Empty>Sem itens de uso no relatório.</Empty>;
  const series = [...SERIES, ...(data.some((d) => d[OTHER.sku]) ? [OTHER] : [])];

  return (
    <div className="h-64 w-full text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "currentColor", opacity: 0.6 }} />
          <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: "currentColor", opacity: 0.6 }} tickFormatter={(v: number) => usd0(v)} />
          <Tooltip
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number>;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <div className="mb-1 font-semibold">{label}</div>
                  {series.filter((s) => row[s.sku]).map((s) => (
                    <div key={s.sku} className="flex justify-between gap-4">
                      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                      <span className="tabular-nums">{money(row[s.sku])}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between gap-4 border-t pt-1 text-muted-foreground">
                    <span>Líquido (após descontos)</span><span className="tabular-nums">{money(row.net)}</span>
                  </div>
                </div>
              );
            }}
          />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v: string) => series.find((s) => s.sku === v)?.label ?? v} />
          {series.map((s, i) => (
            <Bar key={s.sku} dataKey={s.sku} stackId="a" fill={s.color} maxBarSize={28} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
