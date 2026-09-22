"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { derive } from "./derive";
import { ApiError, billing as billingPath, gh, mapLimit, onRate, pageAll } from "./gh-client";
import { usd0 } from "./format";
import type { BillingLine, BillingReport, BillingRow, Budget, BudgetScope, CCUsage, CostCenter, Derived, LogEntry, RateInfo, Seat, UsageItem, UserState } from "./types";
import { monthKey, monthsBetween } from "./format";

export interface Config {
  enterprise: string;
  hasToken: boolean;
  tokenHint: string | null;
  tokenVars: string[];
}

interface Progress {
  label: string;
  value: number;
}

export interface BudgetInput {
  scope: BudgetScope;
  user?: string;
  entity?: string;
  amount: number;
  prevent?: boolean;
  expires?: string;
}

export function budgetPayload({ scope, user, entity, amount, prevent, expires }: BudgetInput) {
  const forced = scope === "user" || scope === "multi_user_customer";
  const p: Record<string, unknown> = {
    budget_amount: Math.round(amount),
    prevent_further_usage: forced ? true : !!prevent,
    budget_scope: scope,
    budget_product_sku: "ai_credits",
    budget_entity_name: scope === "user" || scope === "enterprise" || scope === "multi_user_customer" ? "" : entity,
    budget_type: "BundlePricing",
    budget_alerting: { will_alert: false, alert_recipients: [] },
  };
  if (scope === "user") {
    p.user = user;
    if (expires) p.expires_at = expires;
  }
  return p;
}

interface Store {
  config: Config | null;
  configError: string | null;
  ent: string;
  me: { login: string } | null;
  cc: CostCenter[];
  budgets: Budget[];
  seats: Seat[];
  usage: UsageItem[];
  userStates: Record<string, UserState[]>;
  ccUsage: Record<string, CCUsage> | null;
  usageRange: Record<string, CCUsage> | null;
  usageRangeSpan: { from: string; to: string } | null;
  d: Derived | null;
  loadedAt: number | null;
  loading: boolean;
  progress: Progress | null;
  rate: RateInfo | null;
  error: string | null;
  log: LogEntry[];
  clearLog: () => void;
  loadAll: () => Promise<void>;
  reloadBudgets: () => Promise<void>;
  reloadCC: () => Promise<void>;
  loadCCUsage: () => Promise<void>;
  loadUsageRange: (from: string, to: string, ccIds: string[]) => Promise<void>;
  billing: Record<string, BillingReport>;
  loadBilling: (year: number, month: number, force?: boolean) => Promise<void>;
  runAction: (label: string, fn: () => Promise<string | void>, after?: () => Promise<void>) => Promise<void>;
  createBudget: (input: BudgetInput) => Promise<void>;
  editBudget: (id: string, body: { budget_amount: number; prevent_further_usage: boolean; expires_at?: string }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  deleteBudgets: (ids: string[]) => Promise<void>;
  createCostCenters: (names: string[], pool: boolean) => Promise<void>;
  deleteCostCenter: (id: string) => Promise<void>;
  moveUsers: (ccId: string, logins: string[], remove: boolean) => Promise<void>;
  bulkCreateUserBudgets: (logins: string[], amount: number) => Promise<void>;
  bulkSetUserBudgets: (items: { login: string; amount: number }[]) => Promise<void>;
  // drawers
  openUser: string | null;
  openCC: string | null;
  showUser: (login: string | null) => void;
  showCC: (id: string | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [me, setMe] = useState<{ login: string } | null>(null);
  const [cc, setCC] = useState<CostCenter[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [userStates, setUserStates] = useState<Record<string, UserState[]>>({});
  const [ccUsage, setCCUsage] = useState<Record<string, CCUsage> | null>(null);
  const [usageRange, setUsageRange] = useState<Record<string, CCUsage> | null>(null);
  const [usageRangeSpan, setUsageRangeSpan] = useState<{ from: string; to: string } | null>(null);
  const [billing, setBilling] = useState<Record<string, BillingReport>>({});
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rate, setRate] = useState<RateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [openCC, setOpenCC] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const ent = config?.enterprise ?? "embraer";
  const bp = billingPath(ent);

  useEffect(() => { const off = onRate(setRate); return () => { off(); }; }, []);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch((e) => setConfigError(String(e)));
  }, []);

  const d = useMemo(() => (seats.length || budgets.length || cc.length ? derive({ cc, budgets, seats, userStates, ccUsage }) : null), [cc, budgets, seats, userStates, ccUsage]);

  const logAdd = useCallback((action: string, status: "ok" | "err", detail: string) => {
    setLog((l) => [{ t: new Date(), action, status, detail }, ...l]);
  }, []);

  const fetchBudgets = useCallback(() => pageAll<Budget>(`${bp}/budgets`, "budgets"), [bp]);
  const fetchCC = useCallback(() => pageAll<CostCenter>(`${bp}/cost-centers`, "costCenters"), [bp]);
  const fetchStates = useCallback((id: string) => pageAll<UserState>(`${bp}/budgets/${id}/user-states`, "user_states"), [bp]);

  const loadAll = useCallback(async () => {
    if (!config?.hasToken || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setProgress({ label: "Carregando cost centers, budgets e seats…", value: 0.05 });
      const y = new Date().getFullYear();
      const [ccR, bR, sR, uA, uB, meR] = await Promise.all([
        fetchCC(),
        fetchBudgets(),
        pageAll<Seat>(`enterprises/${ent}/copilot/billing/seats`, "seats", {}, (j) => j.total_seats as number | undefined),
        gh<{ usageItems: UsageItem[] }>(`${bp}/usage`, { params: { year: y } }).catch(() => ({ usageItems: [] })),
        gh<{ usageItems: UsageItem[] }>(`${bp}/usage`, { params: { year: y - 1 } }).catch(() => ({ usageItems: [] })),
        me ? Promise.resolve(me) : gh<{ login: string }>("user").catch(() => null),
      ]);
      setCC(ccR);
      setBudgets(bR);
      setSeats(sR);
      setUsage([...(uB.usageItems || []), ...(uA.usageItems || [])]);
      setMe(meR);
      setUserStates({});
      setCCUsage(null);
      setLoadedAt(Date.now());

      const multi = bR.filter((b) => b.budget_scope === "multi_user_cost_center" || b.budget_scope === "multi_user_customer");
      setProgress({ label: `Consumo por usuário dos ${multi.length} budgets compartilhados…`, value: 0.3 });
      const states: Record<string, UserState[]> = {};
      await mapLimit(multi, 6, async (b) => {
        states[b.id] = await fetchStates(b.id);
      }, (done, total) => setProgress({ label: `Consumo por usuário (${done}/${total})…`, value: 0.3 + (0.7 * done) / total }));
      setUserStates({ ...states });
    } catch (e) {
      const err = e as ApiError;
      const msg = err.status === 404 ? "Enterprise não encontrada ou token sem permissão de billing (404)." : err.status === 401 || err.status === 403 ? `Token inválido ou sem permissão (${err.status}).` : err.message;
      setError(msg);
      toast.error("Falha ao carregar: " + msg);
    } finally {
      setProgress(null);
      setLoading(false);
      loadingRef.current = false;
    }
  }, [config?.hasToken, ent, bp, me, fetchBudgets, fetchCC, fetchStates]);

  useEffect(() => {
    if (config?.hasToken && !loadedAt && !loadingRef.current) void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.hasToken]);

  const reloadBudgets = useCallback(async () => setBudgets(await fetchBudgets()), [fetchBudgets]);
  const reloadCC = useCallback(async () => setCC(await fetchCC()), [fetchCC]);
  const reloadStates = useCallback(async (id: string) => {
    const list = await fetchStates(id);
    setUserStates((s) => ({ ...s, [id]: list }));
  }, [fetchStates]);

  const loadCCUsage = useCallback(async () => {
    if (!d) return;
    const active = d.activeCC;
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    const res: Record<string, CCUsage> = {};
    setProgress({ label: `Uso do mês por cost center (0/${active.length})…`, value: 0 });
    await mapLimit(active, 6, async (c) => {
      const j = await gh<{ usageItems: UsageItem[] }>(`${bp}/usage`, { params: { cost_center_id: c.id, year: y, month: m } });
      const items = j.usageItems || [];
      res[c.id] = {
        credits: items.filter((i) => i.unitType === "AICredits").reduce((s, i) => s + i.quantity, 0),
        gross: items.reduce((s, i) => s + (i.grossAmount || 0), 0),
        net: items.reduce((s, i) => s + (i.netAmount || 0), 0),
        items: items.length,
      };
    }, (done, total) => setProgress({ label: `Uso do mês por cost center (${done}/${total})…`, value: done / total }));
    setCCUsage(res);
    setProgress(null);
  }, [d, bp]);

  /** Uso diário por cost center dentro de um intervalo de datas (YYYY-MM-DD); 1 chamada por cost center por mês tocado pelo intervalo. */
  const loadUsageRange = useCallback(async (from: string, to: string, ccIds: string[]) => {
    if (!from || !to || !ccIds.length) { setUsageRange(null); setUsageRangeSpan(null); return; }
    const targets = cc.filter((c) => ccIds.includes(c.id));
    if (!targets.length) { setUsageRange({}); setUsageRangeSpan({ from, to }); return; }
    const months = monthsBetween(from, to);
    const res: Record<string, CCUsage> = {};
    setProgress({ label: `Uso de ${from} a ${to} por cost center (0/${targets.length})…`, value: 0 });
    await mapLimit(targets, 6, async (c) => {
      let credits = 0, gross = 0, net = 0, items = 0;
      for (const mo of months) {
        const j = await gh<{ usageItems: UsageItem[] }>(`${bp}/usage`, { params: { cost_center_id: c.id, year: mo.year, month: mo.month } });
        for (const i of j.usageItems ?? []) {
          if (i.date < from || i.date > to) continue;
          if (i.unitType === "AICredits") credits += i.quantity;
          gross += i.grossAmount || 0;
          net += i.netAmount || 0;
          items++;
        }
      }
      res[c.id] = { credits, gross, net, items };
    }, (done, total) => setProgress({ label: `Uso de ${from} a ${to} por cost center (${done}/${total})…`, value: done / total }));
    setUsageRange(res);
    setUsageRangeSpan({ from, to });
    setProgress(null);
  }, [cc, bp]);

  /** Uso faturado no mês por cost center (1 chamada por cost center + 1 para o que ficou fora). */
  const loadBilling = useCallback(async (year: number, month: number, force = false) => {
    const key = monthKey(year, month);
    if (!force && billing[key]) return;
    const memberCount = (c: CostCenter) => (c.resources ?? []).filter((r) => r.type === "User").length;
    const targets: { ccId: string | null; name: string; state: BillingRow["state"]; members: number }[] = [
      ...cc.map((c) => ({ ccId: c.id, name: c.name, state: c.state, members: memberCount(c) })),
      { ccId: null, name: "Fora de cost centers (enterprise)", state: "enterprise" as const, members: 0 },
    ];
    setProgress({ label: `Relatório de ${key} (0/${targets.length})…`, value: 0 });
    const rows: BillingRow[] = [];
    await mapLimit(targets, 6, async (t) => {
      const base: BillingRow = { ...t, lines: [], userMonths: 0, credits: 0, premiumRequests: 0, gross: 0, discount: 0, net: 0 };
      try {
        const j = await gh<{ usageItems: UsageItem[] }>(`${bp}/usage`, { params: { cost_center_id: t.ccId ?? undefined, year, month } });
        const bySku: Record<string, BillingLine> = {};
        for (const i of j.usageItems ?? []) {
          const k = `${i.sku}|${i.unitType}`;
          bySku[k] ??= { sku: i.sku, unitType: i.unitType, quantity: 0, gross: 0, discount: 0, net: 0, items: 0 };
          const l = bySku[k];
          l.quantity += i.quantity; l.gross += i.grossAmount || 0; l.discount += i.discountAmount || 0; l.net += i.netAmount || 0; l.items++;
        }
        base.lines = Object.values(bySku).sort((a, b) => b.gross - a.gross);
        for (const l of base.lines) {
          base.gross += l.gross; base.discount += l.discount; base.net += l.net;
          if (l.unitType === "UserMonths") base.userMonths += l.quantity;
          else if (l.unitType === "AICredits") base.credits += l.quantity;
          else if (l.unitType === "Requests") base.premiumRequests += l.quantity;
        }
      } catch (e) {
        base.error = (e as ApiError).body?.message || (e as Error).message;
      }
      rows.push(base);
    }, (done, total) => setProgress({ label: `Relatório de ${key} (${done}/${total})…`, value: done / total }));
    setBilling((b) => ({ ...b, [key]: { key, year, month, generatedAt: Date.now(), rows } }));
    setProgress(null);
  }, [bp, cc, billing]);

  const runAction = useCallback(async (label: string, fn: () => Promise<string | void>, after?: () => Promise<void>) => {
    try {
      const r = await fn();
      logAdd(label, "ok", typeof r === "string" ? r : "");
      toast.success(`${label} — feito`);
      if (after) await after();
    } catch (e) {
      const err = e as ApiError;
      const msg = err.body?.message || err.message;
      logAdd(label, "err", msg);
      toast.error(`${label}: ${msg}`);
      throw new Error(msg);
    }
  }, [logAdd]);

  const createBudget = useCallback(async (input: BudgetInput) => {
    const p = budgetPayload(input);
    const who = (p.user as string) || (p.budget_entity_name as string) || "enterprise";
    await runAction(`Criar budget ${who}`, async () => {
      const j = await gh<{ budget?: { id: string }; id?: string }>(`${bp}/budgets`, { method: "POST", body: p });
      return `${usd0(p.budget_amount as number)} · id ${j?.budget?.id ?? j?.id ?? "?"}`;
    }, reloadBudgets);
  }, [bp, runAction, reloadBudgets]);

  const editBudget = useCallback(async (id: string, body: { budget_amount: number; prevent_further_usage: boolean; expires_at?: string }) => {
    const b = budgets.find((x) => x.id === id);
    await runAction(`Editar budget ${b?.user ?? b?.budget_entity_name ?? id}`, async () => {
      await gh(`${bp}/budgets/${id}`, { method: "PATCH", body: { ...body, budget_alerting: { will_alert: false, alert_recipients: [] } } });
      return `${usd0(b?.budget_amount)} → ${usd0(body.budget_amount)}`;
    }, reloadBudgets);
  }, [bp, budgets, runAction, reloadBudgets]);

  const deleteBudget = useCallback(async (id: string) => {
    const b = budgets.find((x) => x.id === id);
    await runAction(`Excluir budget ${b?.user ?? b?.budget_entity_name ?? id}`, async () => {
      await gh(`${bp}/budgets/${id}`, { method: "DELETE" });
      return usd0(b?.budget_amount);
    }, reloadBudgets);
  }, [bp, budgets, runAction, reloadBudgets]);

  const deleteBudgets = useCallback(async (ids: string[]) => {
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const b = budgets.find((x) => x.id === ids[i]);
      const who = b?.user ?? b?.budget_entity_name ?? ids[i];
      setProgress({ label: `Excluindo budgets (${i + 1}/${ids.length}) — ${who}`, value: (i + 1) / ids.length });
      try {
        await gh(`${bp}/budgets/${ids[i]}`, { method: "DELETE" });
        ok++;
      } catch (e) {
        fails.push(`${who}: ${(e as ApiError).body?.message || (e as Error).message}`);
      }
    }
    setProgress(null);
    logAdd("Excluir budgets em lote", fails.length ? "err" : "ok", `${ok} excluídos, ${fails.length} falhas${fails.length ? " — " + fails.slice(0, 8).join("; ") : ""}`);
    (fails.length ? toast.error : toast.success)(`${ok} budgets excluídos${fails.length ? `, ${fails.length} falhas (veja o histórico)` : ""}`);
    await reloadBudgets();
  }, [bp, budgets, logAdd, reloadBudgets]);

  const createCostCenters = useCallback(async (names: string[], pool: boolean) => {
    if (names.length === 1) {
      await runAction(`Criar cost center ${names[0]}`, async () => {
        const j = await gh<{ id?: string }>(`${bp}/cost-centers`, { method: "POST", body: { name: names[0], ai_credit_pool_enabled: pool } });
        return `id ${j?.id ?? "?"}`;
      }, reloadCC);
      return;
    }
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < names.length; i++) {
      setProgress({ label: `Criando cost centers (${i + 1}/${names.length})`, value: (i + 1) / names.length });
      try {
        await gh(`${bp}/cost-centers`, { method: "POST", body: { name: names[i], ai_credit_pool_enabled: pool } });
        ok++;
      } catch (e) {
        fails.push(`${names[i]}: ${(e as ApiError).body?.message || (e as Error).message}`);
      }
    }
    setProgress(null);
    logAdd("Cost centers em lote", fails.length ? "err" : "ok", `${ok} criados, ${fails.length} falhas${fails.length ? " — " + fails.join("; ") : ""}`);
    (fails.length ? toast.error : toast.success)(`${ok} cost centers criados${fails.length ? `, ${fails.length} falhas` : ""}`);
    await reloadCC();
  }, [bp, runAction, reloadCC, logAdd]);

  const deleteCostCenter = useCallback(async (id: string) => {
    const c = cc.find((x) => x.id === id);
    await runAction(`Excluir cost center ${c?.name ?? id}`, async () => {
      await gh(`${bp}/cost-centers/${id}`, { method: "DELETE" });
    }, async () => {
      setOpenCC(null);
      await reloadCC();
      await reloadBudgets();
    });
  }, [bp, cc, runAction, reloadCC, reloadBudgets]);

  const moveUsers = useCallback(async (ccId: string, logins: string[], remove: boolean) => {
    const c = cc.find((x) => x.id === ccId);
    await runAction(`${remove ? "Remover" : "Adicionar"} ${logins.length} usuário(s) ${remove ? "de" : "em"} ${c?.name ?? ccId}`, async () => {
      await gh(`${bp}/cost-centers/${ccId}/resource`, { method: remove ? "DELETE" : "POST", body: { users: logins } });
      return logins.join(", ");
    }, async () => {
      await reloadCC();
      const b = c && d?.ccBudget[c.name];
      if (b) await reloadStates(b.id);
    });
  }, [bp, cc, d, runAction, reloadCC, reloadStates]);

  const bulkCreateUserBudgets = useCallback(async (logins: string[], amount: number) => {
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < logins.length; i++) {
      setProgress({ label: `Criando budgets (${i + 1}/${logins.length}) — ${logins[i]}`, value: (i + 1) / logins.length });
      try {
        await gh(`${bp}/budgets`, { method: "POST", body: budgetPayload({ scope: "user", user: logins[i], amount }) });
        ok++;
      } catch (e) {
        fails.push(`${logins[i]}: ${(e as ApiError).body?.message || (e as Error).message}`);
      }
    }
    setProgress(null);
    logAdd("Budgets em lote", fails.length ? "err" : "ok", `${ok} criados, ${fails.length} falhas${fails.length ? " — " + fails.slice(0, 8).join("; ") : ""}`);
    (fails.length ? toast.error : toast.success)(`${ok} budgets criados${fails.length ? `, ${fails.length} falhas (veja o histórico)` : ""}`);
    await reloadBudgets();
  }, [bp, logAdd, reloadBudgets]);

  /** Cria ou edita, conforme o caso, o budget de usuário de cada login — usado na edição em lote por linha. */
  const bulkSetUserBudgets = useCallback(async (items: { login: string; amount: number }[]) => {
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const { login, amount } = items[i];
      setProgress({ label: `Salvando budgets (${i + 1}/${items.length}) — ${login}`, value: (i + 1) / items.length });
      try {
        const existing = budgets.find((b) => b.budget_scope === "user" && b.user?.toLowerCase() === login.toLowerCase());
        if (existing) {
          await gh(`${bp}/budgets/${existing.id}`, { method: "PATCH", body: { budget_amount: Math.round(amount), prevent_further_usage: true, budget_alerting: { will_alert: false, alert_recipients: [] } } });
        } else {
          await gh(`${bp}/budgets`, { method: "POST", body: budgetPayload({ scope: "user", user: login, amount }) });
        }
        ok++;
      } catch (e) {
        fails.push(`${login}: ${(e as ApiError).body?.message || (e as Error).message}`);
      }
    }
    setProgress(null);
    logAdd("Budgets de usuário em lote (edição)", fails.length ? "err" : "ok", `${ok} salvos, ${fails.length} falhas${fails.length ? " — " + fails.slice(0, 8).join("; ") : ""}`);
    (fails.length ? toast.error : toast.success)(`${ok} budgets salvos${fails.length ? `, ${fails.length} falhas (veja o histórico)` : ""}`);
    await reloadBudgets();
  }, [bp, budgets, logAdd, reloadBudgets]);

  const value: Store = {
    config, configError, ent, me, cc, budgets, seats, usage, userStates, ccUsage, usageRange, usageRangeSpan, d, loadedAt, loading, progress, rate, error, log,
    clearLog: () => setLog([]),
    loadAll, reloadBudgets, reloadCC, loadCCUsage, loadUsageRange, billing, loadBilling, runAction,
    createBudget, editBudget, deleteBudget, deleteBudgets, createCostCenters, deleteCostCenter, moveUsers, bulkCreateUserBudgets, bulkSetUserBudgets,
    openUser, openCC, showUser: setOpenUser, showCC: setOpenCC,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do DataProvider");
  return s;
}
