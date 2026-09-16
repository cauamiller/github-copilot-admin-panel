#!/bin/sh
# Sobe o painel em segundo plano no Android. Token e enterprise vêm de ./env (chmod 600).
cd "$(dirname "$0")"
set -a; . ./env; set +a
export HOSTNAME=0.0.0.0 PORT=${PORT:-3210} NODE_ENV=production
nohup node server.js > server.log 2>&1 &
echo $! > server.pid
IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -m1 '^[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*$')
echo "copilot-admin no ar: http://${IP:-localhost}:$PORT (pid $(cat server.pid))"
