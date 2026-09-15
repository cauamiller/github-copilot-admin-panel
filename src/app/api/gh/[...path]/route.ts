import { NextRequest } from "next/server";
import { enterprise, token, TOKEN_VARS } from "@/lib/server-env";

const API = "https://api.github.com";


// Only the enterprise billing/copilot tree plus identity/rate-limit checks are proxied.
function allowed(path: string): boolean {
  if (path === "user" || path === "rate_limit") return true;
  return path.startsWith(`enterprises/${enterprise()}/`);
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = path.join("/");
  const t = token();
  if (!t) return Response.json({ message: `Token não configurado: defina ${TOKEN_VARS[0]} no ambiente ou em .env.local` }, { status: 500 });
  if (!allowed(rel)) return Response.json({ message: "Caminho não permitido pelo proxy" }, { status: 403 });

  const url = new URL(`${API}/${rel}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${t}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
    if (body) headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { method: req.method, headers, body, cache: "no-store" });
  const text = await res.text();
  const out = new Headers({ "Content-Type": res.headers.get("content-type") || "application/json" });
  for (const h of ["x-ratelimit-remaining", "x-ratelimit-limit", "x-ratelimit-reset"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(text, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
