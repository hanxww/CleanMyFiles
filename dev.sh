#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Rust is required"; exit 1; }
[ -d node_modules ] || npm install
npm run tauri dev
