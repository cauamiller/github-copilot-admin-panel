import type { RateInfo } from "./types";

export class ApiError extends Error {
  status: number;
  body: { message?: string } | null;
  constructor(message: string, status: number, body: { message?: string } | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Listener = (r: RateInfo) => void;
const rateListeners = new Set<Listener>();
export function onRate(fn: Listener) {
  rateListeners.add(fn);
  return () => rateListeners.delete(fn);
}

export interface GhOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | null | undefined>;
}

/** Calls the GitHub API through the local proxy (`/api/gh/...`); the token never reaches the browser. */
export async function gh<T = unknown>(path: string, { method = "GET", body, params }: GhOptions = {}): Promise<T> {
  const url = new URL(`/api/gh/${path.replace(/^\//, "")}`, window.location.origin);
  if (params) for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const rem = res.headers.get("x-ratelimit-remaining");
  if (rem != null) {
    const r = { remaining: +rem, limit: +(res.headers.get("x-ratelimit-limit") || 0), reset: +(res.headers.get("x-ratelimit-reset") || 0) };
    rateListeners.forEach((fn) => fn(r));
  }
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const b = json as { message?: string } | null;
    throw new ApiError(b?.message || `HTTP ${res.status}`, res.status, b);
  }
  return json as T;
}

/** Paginates a list endpoint. Some endpoints ignore per_page and return everything on every page, so results are deduped. */
export async function pageAll<T extends object>(
  path: string,
  key: string,
  params: Record<string, string | number> = {},
  total?: (j: Record<string, unknown>) => number | undefined,
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 60; page++) {
    const j = await gh<Record<string, unknown>>(path, { params: { ...params, per_page: 100, page } });
    const items = (j?.[key] as T[]) || [];
    let added = 0;
    for (const it of items) {
      const o = it as Record<string, unknown>;
      const id = String(o.id ?? (o.assignee as { id?: number } | undefined)?.id ?? o.user ?? JSON.stringify(it));
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(it);
      added++;
    }
    if (j?.has_next_page === false || added === 0) break;
    if (j?.has_next_page === true) continue;
    const t = total ? total(j) : undefined;
    if (t != null ? out.length >= t : items.length < 100) break;
  }
  return out;
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
  onEach?: (done: number, total: number) => void,
): Promise<(R | { __error: unknown })[]> {
  const out: (R | { __error: unknown })[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i], i);
        } catch (e) {
          out[i] = { __error: e };
        }
        done++;
        onEach?.(done, items.length);
      }
    }),
  );
  return out;
}

export const billing = (ent: string) => `enterprises/${ent}/settings/billing`;
