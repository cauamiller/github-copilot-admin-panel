export type BudgetScope =
  | "user"
  | "multi_user_cost_center"
  | "multi_user_customer"
  | "cost_center"
  | "enterprise"
  | "organization"
  | "repository";

export interface Budget {
  id: string;
  budget_type: string;
  budget_product_sku: string;
  budget_scope: BudgetScope;
  budget_amount: number;
  prevent_further_usage: boolean;
  budget_entity_name: string;
  budget_alerting?: { will_alert: boolean; alert_recipients: string[] };
  expires_at?: string;
  consumed_amount?: number;
  user?: string;
  budget_thresholds?: Record<string, number>;
}

export interface CostCenterResource {
  type: "User" | "Organization" | "Repository" | "EnterpriseTeam" | string;
  name: string;
}

export interface CostCenter {
  id: string;
  name: string;
  state: "active" | "deleted";
  ai_credit_pool_enabled?: boolean;
  azure_subscription?: string | null;
  resources?: CostCenterResource[];
}

export interface Seat {
  created_at: string;
  updated_at?: string;
  pending_cancellation_date: string | null;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  last_authenticated_at?: string | null;
  plan_type?: string;
  assignee: { login: string; id: number; avatar_url?: string; html_url?: string };
  assigning_team?: { name: string; slug?: string } | null;
}

export interface UsageItem {
  date: string;
  product: string;
  sku: string;
  quantity: number;
  unitType: string;
  pricePerUnit: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  organizationName?: string;
  repositoryName?: string;
}

export interface UserState {
  user: string;
  consumed_amount: number;
  target_amount: number;
  override_budget_id?: string;
}

export interface UserStateEntry extends UserState {
  budgetId: string;
  scope: BudgetScope | undefined;
}

export type Coverage = "user" | "cc" | "ent" | "none";

export interface UserRow {
  login: string;
  k: string;
  seat: Seat;
  cc: CostCenter | null;
  ub: Budget | null;
  ccb: Budget | null;
  entBudget: Budget | null;
  us: UserStateEntry | null;
  consumed: number | null;
  target: number | null;
  pct: number | null;
  coverage: Coverage;
  days: number;
  lastActivity: string | null;
  editor: string;
  team: string;
  pending: boolean;
  plan: string;
}

export interface CCUsage {
  credits: number;
  gross: number;
  net: number;
  items: number;
}

export interface CCRow {
  cc: CostCenter;
  name: string;
  members: string[];
  budget: Budget | null;
  states: UserState[] | null;
  over75: number | null;
  consumed: number | null;
  withoutSeat: string[];
  usage: CCUsage | null;
  otherResources: number;
}

export type AlertLevel = "crit" | "serious" | "warn" | "";

export interface AlertItem {
  key: string;
  primary: string;
  secondary: string;
  login?: string;
  ccId?: string;
}

export interface AlertGroup {
  id: string;
  level: AlertLevel;
  title: string;
  hint: string;
  items: AlertItem[];
}

export interface Derived {
  activeCC: CostCenter[];
  ccOfUser: Record<string, CostCenter>;
  userBudget: Record<string, Budget>;
  ccBudget: Record<string, Budget>;
  entBudget: Budget | null;
  stateByUser: Record<string, UserStateEntry>;
  users: UserRow[];
  usersByLogin: Record<string, UserRow>;
  ccRows: CCRow[];
  alerts: AlertGroup[];
  dupUserBudgets: Budget[];
}

export interface LogEntry {
  t: Date;
  action: string;
  status: "ok" | "err";
  detail: string;
}

export interface RateInfo {
  remaining: number;
  limit: number;
  reset: number;
}

/* ---------- relatório de cobrança por cost center ---------- */
export interface BillingLine {
  sku: string;
  unitType: string;
  quantity: number;
  gross: number;
  discount: number;
  net: number;
  items: number;
}

export interface BillingRow {
  /** null = uso fora de qualquer cost center (faturado direto na enterprise) */
  ccId: string | null;
  name: string;
  state: "active" | "deleted" | "enterprise";
  members: number;
  lines: BillingLine[];
  userMonths: number;
  credits: number;
  premiumRequests: number;
  gross: number;
  discount: number;
  net: number;
  error?: string;
}

export interface BillingReport {
  key: string; // YYYY-MM
  year: number;
  month: number;
  generatedAt: number;
  rows: BillingRow[];
}
