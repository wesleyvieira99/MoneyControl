#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/wesleyvieira/Documents/MoneyControl"
BACKEND_PORT=8081
FRONTEND_PORT=4200
MAX_WAIT=180
BACKEND_LOG="/tmp/mc-backend.log"
FRONTEND_LOG="/tmp/mc-frontend.log"
BACKEND_PID_FILE="/tmp/moneycontrol-backend.pid"
FRONTEND_PID_FILE="/tmp/moneycontrol-frontend.pid"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; PURPLE='\033[0;35m'
BOLD='\033[1m'; RESET='\033[0m'

log_info()  { echo "${CYAN}[INFO]${RESET}  $1"; }
log_ok()    { echo "${GREEN}[ OK ]${RESET}  $1"; }
log_warn()  { echo "${YELLOW}[WARN]${RESET}  $1"; }
log_error() { echo "${RED}[FAIL]${RESET}  $1"; }
log_step()  { echo "\n${PURPLE}${BOLD}▶ $1${RESET}"; }
log_banner() {
  echo ""
  echo "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
  echo "${BLUE}${BOLD}║          💰  MoneyControl — Starting Up...          ║${RESET}"
  echo "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

stop_pid() {
  local pidfile=$1
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pidfile"
  fi
}

close_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
      done
      sleep 1
    fi
  fi
}

check_deps() {
  log_step "Verificando dependências"
  for cmd in java node npm curl python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
      log_ok "$cmd → $(command -v "$cmd")"
    else
      log_error "$cmd não encontrado."
      exit 1
    fi
  done
}

ensure_frontend_deps() {
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    log_warn "Dependências do frontend ausentes. Instalando..."
    (cd "$ROOT/frontend" && npm install)
  fi
}

ensure_backend_artifact() {
  local jar="$ROOT/backend/target/moneycontrol-backend-0.0.1-SNAPSHOT.jar"
  if [ ! -f "$jar" ]; then
    log_warn "Artefato do backend ausente. Preparando build..."
    (cd "$ROOT" && npm run desktop:prepare)
  fi
}

wait_for_url() {
  local url=$1
  local elapsed=0
  while (( elapsed < MAX_WAIT )); do
    if curl -sf "$url" -o /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}

start_backend() {
  log_step "Iniciando backend na porta ${BACKEND_PORT}"
  stop_pid "$BACKEND_PID_FILE"
  close_port "$BACKEND_PORT"

  local jar="$ROOT/backend/target/moneycontrol-backend-0.0.1-SNAPSHOT.jar"
  if [ ! -f "$jar" ]; then
    log_error "JAR do backend não encontrado em $jar"
    exit 1
  fi

  nohup java -jar "$jar" \
    --server.port="$BACKEND_PORT" \
    --spring.datasource.url="jdbc:h2:file:$ROOT/data/moneycontrol;AUTO_SERVER=TRUE" \
    --spring.web.cors.allowed-origins="http://localhost:4200,http://127.0.0.1:4200,null,app://." \
    >"$BACKEND_LOG" 2>&1 &

  echo $! > "$BACKEND_PID_FILE"
  log_ok "Backend iniciado. Log: $BACKEND_LOG"
}

start_frontend() {
  log_step "Iniciando frontend na porta ${FRONTEND_PORT}"
  stop_pid "$FRONTEND_PID_FILE"
  close_port "$FRONTEND_PORT"

  nohup bash -lc "cd '$ROOT/frontend' && npx ng serve --host 127.0.0.1 --port $FRONTEND_PORT --disable-host-check" \
    >"$FRONTEND_LOG" 2>&1 &

  echo $! > "$FRONTEND_PID_FILE"
  log_ok "Frontend iniciado. Log: $FRONTEND_LOG"
}

open_browser() {
  local url="http://127.0.0.1:${FRONTEND_PORT}"
  if wait_for_url "$url"; then
    if command -v open >/dev/null 2>&1; then
      open "$url"
    else
      python3 -c "import sys, webbrowser; webbrowser.open(sys.argv[1])" "$url"
    fi
    log_ok "Navegador aberto em $url"
  else
    log_warn "Frontend ainda não respondeu em $url. Verifique os logs."
  fi
}

log_banner
check_deps
ensure_frontend_deps
ensure_backend_artifact
start_backend
start_frontend

if wait_for_url "http://127.0.0.1:${BACKEND_PORT}/actuator/health"; then
  log_ok "Backend pronto em http://127.0.0.1:${BACKEND_PORT}"
else
  log_warn "Backend ainda não respondeu no health check."
fi

open_browser

echo ""
echo "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${BLUE}${BOLD}║              ✅  MoneyControl — Online!              ║${RESET}"
echo "${BLUE}${BOLD}╠══════════════════════════════════════════════════════╣${RESET}"
printf "${BLUE}${BOLD}║${RESET}  🌐 Frontend  : ${CYAN}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://127.0.0.1:${FRONTEND_PORT}"
printf "${BLUE}${BOLD}║${RESET}  🔧 Backend   : ${GREEN}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://127.0.0.1:${BACKEND_PORT}"
printf "${BLUE}${BOLD}║${RESET}  🗄️  H2 Console: ${YELLOW}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://127.0.0.1:${BACKEND_PORT}/h2-console"
echo "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
