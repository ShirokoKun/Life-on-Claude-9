#!/usr/bin/env bash
# Linux (or any Unix shell): set up (first time) and open Claude Nine Studio.   ./start-studio.sh [--port 8090]
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ is needed: https://nodejs.org (or your package manager)."; exit 1; }
node studio/setup.mjs || exit 1
exec node studio/server.mjs --open "$@"
