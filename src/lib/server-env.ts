export const TOKEN_VARS = ["GH_COPILOT", "GITHUB_TOKEN", "GH_TOKEN"];

export function token(): string | null {
  for (const v of TOKEN_VARS) if (process.env[v]) return process.env[v]!;
  return null;
}

export function enterprise(): string {
  return process.env.GH_ENTERPRISE || "embraer";
}
