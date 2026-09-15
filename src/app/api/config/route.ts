import { enterprise, token, TOKEN_VARS } from "@/lib/server-env";

export async function GET() {
  const t = token();
  return Response.json({
    enterprise: enterprise(),
    hasToken: !!t,
    tokenHint: t ? `${t.slice(0, 7)}…${t.slice(-4)}` : null,
    tokenVars: TOKEN_VARS,
  });
}
