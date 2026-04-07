#!/bin/zsh
# ╔══════════════════════════════════════════════════════════════╗
# ║           MoneyControl — Launcher Premium v2.0              ║
# ╚══════════════════════════════════════════════════════════════╝

ROOT="/Users/wesleyvieira/Documents/MoneyControl/MoneyControl"
BACKEND_PORT=8080
FRONTEND_PORT=4200
MAX_WAIT=120   # segundos máximos aguardando backend

# ── ANSI Colors ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; PURPLE='\033[0;35m'
BOLD='\033[1m'; RESET='\033[0m'

log_info()  { echo "${CYAN}[INFO]${RESET}  $1"; }
log_ok()    { echo "${GREEN}[  OK]${RESET}  $1"; }
log_warn()  { echo "${YELLOW}[WARN]${RESET}  $1"; }
log_error() { echo "${RED}[FAIL]${RESET}  $1"; }
log_step()  { echo "\n${PURPLE}${BOLD}▶ $1${RESET}"; }
log_banner() {
  echo ""
  echo "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
  echo "${BLUE}${BOLD}║        💰  MoneyControl  — Starting Up...           ║${RESET}"
  echo "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

# ── Abre nova janela do Terminal com um comando ───────────────
# Uso: open_terminal "título" "comando shell"
# Evita heredoc para não quebrar o AppleScript com aspas/escapes
open_terminal() {
  local title="$1"
  local cmd="$2"
  # Escapa aspas duplas dentro do comando para o AppleScript
  local safe_cmd="${cmd//\"/\\\"}"
  osascript \
    -e 'tell application "Terminal"' \
    -e '  activate' \
    -e "  set w to do script \"${safe_cmd}\"" \
    -e "  set custom title of tab 1 of w to \"${title}\"" \
    -e 'end tell'
}

# ── Verifica dependências ─────────────────────────────────────
check_deps() {
  log_step "Verificando dependências"
  for cmd in java mvn node npm curl; do
    if command -v $cmd &>/dev/null; then
      log_ok "$cmd → $(command -v $cmd)"
    else
      log_error "$cmd não encontrado! Instale antes de continuar."
      exit 1
    fi
  done
  log_info "Java: $(java -version 2>&1 | head -1)"
  log_info "Node: $(node -v)  |  npm: $(npm -v)"
}

# ── Verifica se porta já está em uso ─────────────────────────
check_port() {
  local port=$1 name=$2
  if lsof -ti tcp:$port &>/dev/null; then
    log_warn "Porta $port ($name) já está em uso."
    echo -n "    Deseja matar o processo existente? (s/N): "
    read -r answer
    if [[ "$answer" =~ ^[sS]$ ]]; then
      lsof -ti tcp:$port | xargs kill -9 2>/dev/null
      sleep 1
      log_ok "Processo na porta $port encerrado."
    else
      log_warn "Continuando com porta $port ocupada (pode causar falha)."
    fi
  fi
}

# ── Health check com spinner e timeout ───────────────────────
wait_for_backend() {
  log_step "Aguardando backend inicializar (timeout: ${MAX_WAIT}s)"
  local elapsed=0
  local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local si=0

  while true; do
    if curl -sf "http://localhost:${BACKEND_PORT}/actuator/health" -o /dev/null 2>/dev/null; then
      echo ""
      log_ok "Backend respondeu em /actuator/health ✅"
      return 0
    elif curl -sf "http://localhost:${BACKEND_PORT}/api/accounts" -o /dev/null 2>/dev/null; then
      echo ""
      log_ok "Backend respondeu em /api/accounts ✅"
      return 0
    fi

    if (( elapsed >= MAX_WAIT )); then
      echo ""
      log_warn "Backend não respondeu após ${MAX_WAIT}s."
      log_warn "Frontend iniciará no modo offline (dados mock ativos)."
      return 1
    fi

    printf "\r    ${CYAN}${spinner[$si]}${RESET} Aguardando backend... ${elapsed}s / ${MAX_WAIT}s"
    si=$(( (si + 1) % ${#spinner[@]} ))
    sleep 2
    elapsed=$(( elapsed + 2 ))
  done
}

# ── Verifica CORS ─────────────────────────────────────────────
verify_cors() {
  log_step "Verificando configuração CORS"
  local resp
  resp=$(curl -sI -X OPTIONS \
    -H "Origin: http://localhost:${FRONTEND_PORT}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "http://localhost:${BACKEND_PORT}/api/accounts" 2>/dev/null)

  if echo "$resp" | grep -qi "access-control-allow-origin"; then
    log_ok "CORS OK ✅"
    echo "$resp" | grep -i "access-control" | while read -r line; do
      echo "    ${GREEN}${line}${RESET}"
    done
  else
    log_warn "CORS pode nao estar configurado corretamente."
    log_warn "Verifique: backend/src/main/java/com/moneycontrol/config/CorsConfig.java"
    log_warn "Esperado: Access-Control-Allow-Origin: http://localhost:${FRONTEND_PORT}"
  fi
}

# ── Smoke test dos endpoints principais ──────────────────────
smoke_test() {
  log_step "Smoke test dos endpoints da API"
  local endpoints=(
    "/api/accounts"
    "/api/transactions"
    "/api/investments"
    "/api/credit-cards"
    "/api/categories"
  )
  local ok=0 warn=0
  for ep in "${endpoints[@]}"; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Origin: http://localhost:${FRONTEND_PORT}" \
      "http://localhost:${BACKEND_PORT}${ep}" 2>/dev/null)
    if [[ "$code" == "200" ]]; then
      log_ok "GET ${ep}  ->  ${code} OK"
      (( ok++ ))
    else
      log_warn "GET ${ep}  ->  ${code}"
      (( warn++ ))
    fi
  done
  echo ""
  log_info "Resultado: ${ok} OK | ${warn} com aviso"
}

# ═══════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════
log_banner
check_deps
check_port $BACKEND_PORT "Backend Spring Boot"
check_port $FRONTEND_PORT "Frontend Angular"

# ── Backend ───────────────────────────────────────
log_step "Iniciando Backend (Spring Boot — porta ${BACKEND_PORT})"
open_terminal \
  "MC Backend :${BACKEND_PORT}" \
  "cd ${ROOT}/backend && mvn spring-boot:run 2>&1 | tee /tmp/mc-backend.log"
log_ok "Terminal do Backend aberto."

# ── Aguarda backend ficar pronto ──────────────────
wait_for_backend
BACKEND_OK=$?

if (( BACKEND_OK == 0 )); then
  verify_cors
  smoke_test
fi

# ── Frontend ──────────────────────────────────────
log_step "Iniciando Frontend (Angular — porta ${FRONTEND_PORT})"
open_terminal \
  "MC Frontend :${FRONTEND_PORT}" \
  "cd ${ROOT}/frontend && npm install --prefer-offline 2>&1 | tail -3 && npx ng serve --open 2>&1 | tee /tmp/mc-frontend.log"
log_ok "Terminal do Frontend aberto."

# ── Resumo ────────────────────────────────────────
echo ""
echo "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${BLUE}${BOLD}║              ✅  MoneyControl — Online!              ║${RESET}"
echo "${BLUE}${BOLD}╠══════════════════════════════════════════════════════╣${RESET}"
printf "${BLUE}${BOLD}║${RESET}  🌐 Frontend  : ${CYAN}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://localhost:${FRONTEND_PORT}"
printf "${BLUE}${BOLD}║${RESET}  🔧 Backend   : ${GREEN}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://localhost:${BACKEND_PORT}"
printf "${BLUE}${BOLD}║${RESET}  🗄️  H2 Console: ${YELLOW}%-38s${RESET}${BLUE}${BOLD}║${RESET}\n" "http://localhost:${BACKEND_PORT}/h2-console"
echo "${BLUE}${BOLD}╠══════════════════════════════════════════════════════╣${RESET}"
printf "${BLUE}${BOLD}║${RESET}  📋 Backend log : %-36s${BLUE}${BOLD}║${RESET}\n" "/tmp/mc-backend.log"
printf "${BLUE}${BOLD}║${RESET}  📋 Frontend log: %-36s${BLUE}${BOLD}║${RESET}\n" "/tmp/mc-frontend.log"
echo "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
