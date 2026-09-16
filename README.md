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

## Rodar no Android (Debian/PRoot via SSH)

O build precisa do SWC nativo, que não existe para armv7; por isso o build acontece no PC e só o runtime standalone vai para o celular (Node 20 do Debian basta).

```bash
scripts/deploy-android.sh root@192.168.1.17 8022   # builda, envia, (re)inicia
```

No celular fica em `/root/copilot-admin` (`start.sh` / `stop.sh`, token em `env` com chmod 600, log em `server.log`).
