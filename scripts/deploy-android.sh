#!/usr/bin/env bash
# Builda no PC (Next standalone) e publica o runtime no Android (Debian/PRoot via SSH).
# O celular só precisa de Node >= 20.9 — nenhum binário nativo do build vai junto.
#
# Uso: scripts/deploy-android.sh [user@host] [porta-ssh]
#   HOST padrão: root@192.168.1.17   PORTA padrão: 8022
# Na primeira vez, cria /root/copilot-admin/env com o GH_COPILOT do ambiente do PC.
set -euo pipefail

HOST="${1:-root@192.168.1.17}"
PORT="${2:-8022}"
REMOTE_DIR="/root/copilot-admin"
APP_PORT="${APP_PORT:-3210}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$(mktemp -d)/copilot-admin"

cd "$ROOT"
echo "» build standalone"
npx next build >/dev/null

echo "» empacotando runtime"
mkdir -p "$PKG/.next/static"
cp -r .next/standalone/. "$PKG/"
rm -rf "$PKG/node_modules/@img" "$PKG/node_modules/sharp"   # otimização de imagem: não usada, e é binário do PC
cp -r .next/static/. "$PKG/.next/static/"
cp -r public "$PKG/public"
cp scripts/remote/start.sh scripts/remote/stop.sh "$PKG/"
chmod +x "$PKG"/*.sh
tar czf "$PKG.tgz" -C "$(dirname "$PKG")" copilot-admin

echo "» enviando para $HOST:$PORT"
scp -q -P "$PORT" "$PKG.tgz" "$HOST:/tmp/copilot-admin.tgz"

echo "» instalando e reiniciando"
ssh -p "$PORT" "$HOST" bash -s "$REMOTE_DIR" "$APP_PORT" <<'REMOTE'
set -e
DIR="$1"; PORT="$2"
command -v node >/dev/null || { export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq nodejs procps >/dev/null; }
[ -f "$DIR/stop.sh" ] && "$DIR/stop.sh" >/dev/null 2>&1 || true
mkdir -p "$DIR.new" && tar xzf /tmp/copilot-admin.tgz -C "$DIR.new" --strip-components=1 && rm /tmp/copilot-admin.tgz
[ -f "$DIR/env" ] && cp "$DIR/env" "$DIR.new/env"
rm -rf "$DIR" && mv "$DIR.new" "$DIR"
if [ ! -f "$DIR/env" ]; then echo "SEM_ENV"; exit 0; fi
PORT="$PORT" "$DIR/start.sh"
REMOTE

# primeira vez: cria o env pelo stdin (o token não passa por argv nem por log)
if ssh -p "$PORT" "$HOST" "test ! -f $REMOTE_DIR/env"; then
  : "${GH_COPILOT:?defina GH_COPILOT no ambiente do PC para criar o env remoto}"
  printf 'GH_COPILOT=%s\nGH_ENTERPRISE=%s\n' "$GH_COPILOT" "${GH_ENTERPRISE:-embraer}" \
    | ssh -p "$PORT" "$HOST" "umask 077; cat > $REMOTE_DIR/env && PORT=$APP_PORT $REMOTE_DIR/start.sh"
fi

sleep 3
echo "» verificando"
curl -s -m 15 "http://${HOST#*@}:$APP_PORT/api/config" && echo
