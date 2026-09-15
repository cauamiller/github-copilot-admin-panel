import { ago, daysSince, money, pct } from "./format";
import type {
  AlertGroup,
  Budget,
  CCRow,
  CCUsage,
  CostCenter,
  Derived,
  Seat,
  UserRow,
  UserState,
  UserStateEntry,
} from "./types";

export interface RawData {
  cc: CostCenter[];
  budgets: Budget[];
  seats: Seat[];
  userStates: Record<string, UserState[]>;
  ccUsage: Record<string, CCUsage> | null;
}

export function derive(raw: RawData): Derived {
  const { cc, budgets, seats, userStates, ccUsage } = raw;
  const activeCC = cc.filter((c) => c.state === "active");

  const ccOfUser: Record<string, CostCenter> = {};
  for (const c of activeCC) for (const r of c.resources ?? []) if (r.type === "User") ccOfUser[r.name.toLowerCase()] = c;

  const userBudget: Record<string, Budget> = {};
  const dupUserBudgets: Budget[] = [];
  for (const b of budgets) {
    if (b.budget_scope !== "user" || !b.user) continue;
    const k = b.user.toLowerCase();
    if (userBudget[k]) dupUserBudgets.push(b);
    else userBudget[k] = b;
  }

  const ccBudget: Record<string, Budget> = {};
  for (const b of budgets) if (b.budget_scope === "multi_user_cost_center") ccBudget[b.budget_entity_name] = b;
  const entBudget = budgets.find((b) => b.budget_scope === "multi_user_customer") ?? null;
  const budgetById = Object.fromEntries(budgets.map((b) => [b.id, b]));

  // cost-center budgets win over the enterprise-wide per-user budget
  const stateByUser: Record<string, UserStateEntry> = {};
  const entStateByUser: Record<string, UserStateEntry> = {};
  for (const [bid, list] of Object.entries(userStates)) {
    const scope = budgetById[bid]?.budget_scope;
    for (const u of list) {
      const e: UserStateEntry = { ...u, budgetId: bid, scope };
      if (scope === "multi_user_customer") entStateByUser[u.user.toLowerCase()] = e;
      else stateByUser[u.user.toLowerCase()] = e;
    }
  }
  for (const [k, e] of Object.entries(entStateByUser)) if (!stateByUser[k]) stateByUser[k] = e;

  const seatLogins = new Set(seats.map((s) => s.assignee?.login?.toLowerCase()).filter(Boolean));

  const users: UserRow[] = seats.map((s) => {
    const login = s.assignee?.login || "?";
    const k = login.toLowerCase();
    const c = ccOfUser[k] ?? null;
    const ub = userBudget[k] ?? null;
    const ccb = c ? (ccBudget[c.name] ?? null) : null;
    const us = stateByUser[k] ?? null;
    const consumed = ub?.consumed_amount ?? us?.consumed_amount ?? null;
    const target = ub?.budget_amount ?? us?.target_amount ?? null;
    const coverage = ub ? "user" : ccb ? "cc" : entBudget && entStateByUser[k] ? "ent" : "none";
    return {
      login,
      k,
      seat: s,
      cc: c,
      ub,
      ccb,
      entBudget,
      us,
      consumed,
      target,
      pct: pct(consumed, target),
      coverage,
      days: daysSince(s.last_activity_at),
      lastActivity: s.last_activity_at,
      editor: s.last_activity_editor || "",
      team: s.assigning_team?.name || "",
      pending: !!s.pending_cancellation_date,
      plan: s.plan_type || "",
    };
  });
  const usersByLogin = Object.fromEntries(users.map((u) => [u.k, u]));

  const ccRows: CCRow[] = cc.map((c) => {
    const members = (c.resources ?? []).filter((r) => r.type === "User").map((r) => r.name);
    const b = ccBudget[c.name] ?? null;
    const st = b ? (userStates[b.id] ?? null) : null;
    const th = b?.budget_thresholds ?? null;
    const over75 = th ? (th["75"] || 0) + (th["90"] || 0) + (th["100"] || 0) : null;
    const consumed = st ? st.reduce((s, u) => s + (u.consumed_amount || 0), 0) : null;
    return {
      cc: c,
      name: c.name,
      members,
      budget: b,
      states: st,
      over75,
      consumed,
      withoutSeat: members.filter((m) => !seatLogins.has(m.toLowerCase())),
      usage: ccUsage?.[c.id] ?? null,
      otherResources: (c.resources ?? []).filter((r) => r.type !== "User").length,
    };
  });

  const alerts = buildAlerts(users, ccRows, budgets, dupUserBudgets);
  return { activeCC, ccOfUser, userBudget, ccBudget, entBudget, stateByUser, users, usersByLogin, ccRows, alerts, dupUserBudgets };
}

function buildAlerts(users: UserRow[], ccRows: CCRow[], budgets: Budget[], dupUserBudgets: Budget[]): AlertGroup[] {
  const A: AlertGroup[] = [];
  const activeRows = ccRows.filter((r) => r.cc.state === "active");
  const userBudgets = budgets.filter((b) => b.budget_scope === "user" && b.budget_amount > 0);
  // capped by a shared (cost center / enterprise) per-user budget, not by one of their own
  const shared = users.filter((u) => !u.ub && u.us && !u.us.override_budget_id && u.pct != null);
  const srcOf = (u: UserRow) => (u.us?.scope === "multi_user_customer" ? "budget enterprise" : `cost center ${u.cc?.name ?? ""}`);
  const bp = (b: Budget) => pct(b.consumed_amount, b.budget_amount) ?? -1;

  const push = (g: Omit<AlertGroup, "items"> & { items: AlertGroup["items"] }) => {
    if (g.items.length) A.push(g);
  };
  const fromUsers = (list: UserRow[], secondary: (u: UserRow) => string) =>
    list.map((u) => ({ key: u.login, primary: u.login, secondary: secondary(u), login: u.login }));
  const fromBudgets = (list: Budget[], secondary: (b: Budget) => string) =>
    list.map((b) => ({ key: b.id, primary: b.user ?? b.budget_entity_name, secondary: secondary(b), login: b.user }));
  const fromCC = (list: CCRow[], secondary: (r: CCRow) => string) =>
    list.map((r) => ({ key: r.cc.id, primary: r.name, secondary: secondary(r), ccId: r.cc.id }));

  push({ id: "b-over", level: "crit", title: "Budgets de usuário estourados", hint: "Consumo ≥ 100% do valor; com bloqueio ativo o usuário está travado.",
    items: fromBudgets(userBudgets.filter((b) => bp(b) >= 100).sort((a, b) => (b.consumed_amount ?? 0) - (a.consumed_amount ?? 0)), (b) => `${money(b.consumed_amount)} / ${money(b.budget_amount)}`) });
  push({ id: "s-over", level: "crit", title: "Usuários no teto do budget compartilhado", hint: "Bateram 100% do budget por usuário do cost center ou da enterprise e não têm budget próprio — estão bloqueados.",
    items: fromUsers(shared.filter((u) => u.pct! >= 100).sort((a, b) => (b.consumed ?? 0) - (a.consumed ?? 0)), (u) => `${money(u.consumed)} · ${srcOf(u)}`) });
  push({ id: "s-90", level: "serious", title: "Usuários entre 90% e 100% do budget compartilhado", hint: "Sem budget próprio; vão travar em breve.",
    items: fromUsers(shared.filter((u) => u.pct! >= 90 && u.pct! < 100).sort((a, b) => b.pct! - a.pct!), (u) => `${u.pct}% · ${srcOf(u)}`) });
  push({ id: "u-none", level: "crit", title: "Seats sem nenhum budget rastreável", hint: "Sem budget de usuário, fora de cost center com budget e ausentes do budget enterprise por usuário — ou nunca consumiram, ou estão sem teto.",
    items: fromUsers(users.filter((u) => u.coverage === "none"), (u) => u.cc?.name ?? "sem cost center") });
  push({ id: "b-90", level: "serious", title: "Budgets de usuário entre 90% e 100%", hint: "Vão estourar em breve.",
    items: fromBudgets(userBudgets.filter((b) => bp(b) >= 90 && bp(b) < 100).sort((a, b) => bp(b) - bp(a)), (b) => `${bp(b)}%`) });
  push({ id: "b-75", level: "warn", title: "Budgets de usuário entre 75% e 90%", hint: "Acompanhar.",
    items: fromBudgets(userBudgets.filter((b) => bp(b) >= 75 && bp(b) < 90).sort((a, b) => bp(b) - bp(a)), (b) => `${bp(b)}%`) });
  push({ id: "cc-over", level: "serious", title: "Cost centers com usuários ≥75% do budget", hint: "Contagem informada pelos thresholds do budget multi-usuário.",
    items: fromCC(activeRows.filter((r) => (r.over75 ?? 0) > 0), (r) => `${r.over75} usuário(s)`) });
  push({ id: "cc-nobudget", level: "serious", title: "Cost centers ativos sem budget", hint: "Membros sem budget próprio ficam sem teto.",
    items: fromCC(activeRows.filter((r) => !r.budget), (r) => `${r.members.length} membro(s)`) });
  push({ id: "u-nocc", level: "warn", title: "Seats fora de qualquer cost center", hint: "Uso cai no faturamento direto da enterprise.",
    items: fromUsers(users.filter((u) => !u.cc), (u) => (u.ub ? "tem budget de usuário" : "sem budget")) });
  push({ id: "cc-nomembers", level: "warn", title: "Cost centers ativos sem membros", hint: "Budget multi-usuário não pode ser criado sem membros (erro 400).",
    items: fromCC(activeRows.filter((r) => r.members.length === 0), (r) => (r.otherResources ? `${r.otherResources} outro(s) recurso(s)` : "vazio")) });
  push({ id: "cc-noseat", level: "warn", title: "Membros de cost center sem seat do Copilot", hint: "Estão no cost center mas não têm licença atribuída.",
    items: activeRows.flatMap((r) => r.withoutSeat.map((m) => ({ key: `${r.cc.id}:${m}`, primary: m, secondary: r.name, login: m, ccId: r.cc.id }))) });
  push({ id: "s-pending", level: "warn", title: "Seats com cancelamento pendente", hint: "Licença será removida no fim do ciclo.",
    items: fromUsers(users.filter((u) => u.pending), (u) => u.seat.pending_cancellation_date ?? "") });
  push({ id: "s-stale", level: "", title: "Seats parados há mais de 30 dias", hint: "Candidatos a revisão de licença.",
    items: fromUsers(users.filter((u) => u.days > 30 && u.days !== Infinity).sort((a, b) => b.days - a.days), (u) => ago(u.lastActivity)) });
  push({ id: "s-never", level: "", title: "Seats que nunca usaram o Copilot", hint: "Sem atividade registrada desde a atribuição.",
    items: fromUsers(users.filter((u) => u.days === Infinity), (u) => `atribuído ${ago(u.seat.created_at)}`) });
  push({ id: "b-dup", level: "serious", title: "Usuários com mais de um budget de usuário", hint: "Duplicidade — só um deveria existir por usuário.",
    items: fromBudgets(dupUserBudgets, (b) => money(b.budget_amount)) });
  return A;
}
