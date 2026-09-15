# Copilot Admin Embraer

Painel de administração do GitHub Copilot na enterprise: seats, cost centers, budgets, consumo, alertas e ações (criar/editar budgets, cost centers, mover usuários).

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
```

O token é lido no servidor de `GH_COPILOT` (ou `GITHUB_TOKEN` / `GH_TOKEN`) e nunca vai ao navegador. Se não estiver no ambiente, copie `.env.local.example` para `.env.local`.

## Estrutura

- `src/app/api/gh/[...path]` — proxy para `api.github.com` (só `/enterprises/{ent}/…`, `/user`, `/rate_limit`)
- `src/lib/gh-client.ts` — cliente + paginação (deduplica: `cost-centers` ignora `per_page`)
- `src/lib/derive.ts` — cruzamento seats × cost centers × budgets × user-states e regras de alerta
- `src/lib/store.tsx` — carregamento em 2 fases, ações e histórico
- `src/app/*` — uma rota por seção
