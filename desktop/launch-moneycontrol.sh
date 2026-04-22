#!/bin/zsh
set -euo pipefail

# macOS apps launched from Finder do not inherit terminal PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

REPO_ROOT="/Users/wesleyvieira/Documents/MoneyControl"
LOG_FILE="/tmp/moneycontrol-launcher.log"

NPM_BIN="$(command -v npm || true)"
if [ -z "$NPM_BIN" ]; then
  echo "npm nao encontrado no PATH: $PATH" >> "$LOG_FILE"
  exit 1
fi

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando launcher MoneyControl"
  cd "$REPO_ROOT"

  if [ ! -d "$REPO_ROOT/node_modules/electron" ]; then
    echo "Dependencias desktop ausentes. Instalando npm..."
    "$NPM_BIN" install
  fi

  echo "Abrindo app desktop..."
  "$NPM_BIN" run desktop:run
} >> "$LOG_FILE" 2>&1
