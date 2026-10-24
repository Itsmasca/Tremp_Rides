#!/usr/bin/env bash
# =============================================================================
# Tremp · App móvil local contra el backend de la VM (expuesto por Cloudflare)
#
#   ./scripts/mobile-vm.sh https://<tu-tunel>.trycloudflare.com          # LAN (Expo Go, misma Wi-Fi)
#   ./scripts/mobile-vm.sh https://api.tremp.example --tunnel            # celular en otra red
#   ./scripts/mobile-vm.sh --web                                         # reutiliza la URL guardada
#   ./scripts/mobile-vm.sh https://... --check                           # sólo verificar, no arrancar
#
# Opciones:
#   --web | --android | --ios   Abre esa plataforma al arrancar Expo
#   --tunnel                    Metro por túnel de Expo (el celular no está en la misma red que el PC)
#   --check                     Verifica el backend y escribe mobile/.env, pero no arranca Expo
#   --skip-install              No ejecuta npm install aunque falten dependencias
#   --clear                     Arranca Expo limpiando la caché de Metro (-c)
#   -h | --help                 Esta ayuda
#
# La URL también puede venir de TREMP_API_URL o de la última guardada en mobile/.env.
# Spec 004 (AC-I1, AC-I10).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"
ENV_FILE="$MOBILE/.env"
WEB_ORIGIN="http://localhost:8081"
MIN_NODE_MAJOR=20

if [[ -t 1 ]]; then R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'; else R= G= Y= B= N=; fi
ok()   { echo "${G}✔${N} $*"; }
warn() { echo "${Y}!${N} $*"; }
fail() { echo "${R}✘ $*${N}" >&2; exit 1; }
step() { echo; echo "${B}▸ $*${N}"; }

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# ── Argumentos ────────────────────────────────────────────────────────────────
API_URL="${TREMP_API_URL:-}"
PLATFORM=""; TUNNEL=0; CHECK_ONLY=0; SKIP_INSTALL=0; CLEAR=0
for arg in "$@"; do
  case "$arg" in
    --web|--android|--ios) PLATFORM="$arg" ;;
    --tunnel)       TUNNEL=1 ;;
    --check)        CHECK_ONLY=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --clear)        CLEAR=1 ;;
    -h|--help)      usage ;;
    http://*|https://*) API_URL="$arg" ;;
    *) fail "Argumento desconocido: $arg (usa --help)" ;;
  esac
done

if [[ -z "$API_URL" && -f "$ENV_FILE" ]]; then
  API_URL="$(sed -n 's/^EXPO_PUBLIC_API_URL=//p' "$ENV_FILE" | tail -1)"
  [[ -n "$API_URL" ]] && warn "Usando la URL guardada en mobile/.env: $API_URL"
fi
[[ -n "$API_URL" ]] || fail "Falta la URL del backend. Ej: ./scripts/mobile-vm.sh https://xxxx.trycloudflare.com"
API_URL="${API_URL%/}"
[[ "$API_URL" == https://* ]] || warn "La URL no es HTTPS; Cloudflare siempre sirve HTTPS y Android bloquea HTTP en builds de release."

# ── 1. Requisitos ─────────────────────────────────────────────────────────────
step "Requisitos"
command -v node >/dev/null || fail "Node.js no está instalado (se necesita >= $MIN_NODE_MAJOR)."
command -v npm  >/dev/null || fail "npm no está instalado."
command -v curl >/dev/null || fail "curl no está instalado."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= MIN_NODE_MAJOR )) || fail "Node $(node -v) es muy viejo; se necesita >= $MIN_NODE_MAJOR."
ok "node $(node -v), npm $(npm -v), curl"

# ── 2. Backend en la VM ───────────────────────────────────────────────────────
step "Backend en la VM ($API_URL)"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

code="$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 15 "$API_URL/health" 2>/dev/null || true)"
case "$code" in
  000) fail "No hay respuesta de $API_URL. ¿Está corriendo el túnel (cloudflared) en la VM? Las URLs *.trycloudflare.com cambian en cada reinicio." ;;
  302|303|401|403)
    if grep -qi 'cloudflareaccess\|cf-access' "$TMP" 2>/dev/null || [[ "$code" == 302 || "$code" == 303 ]]; then
      fail "Cloudflare responde $code: la URL parece protegida por Cloudflare Access. La app no puede pasar el login de Access; excluye la ruta de la API o usa un service token."
    fi
    fail "El backend respondió $code en /health." ;;
  502|503|504|530)
    if grep -q '"redis"\|"postgres"' "$TMP" 2>/dev/null; then
      fail "El backend está arriba pero una dependencia cayó: $(cat "$TMP")"
    fi
    fail "Cloudflare responde $code: el túnel existe pero no llega al backend (¿API caída o puerto distinto de 3000 en la VM?)." ;;
  200) ;;
  404) fail "$API_URL/health no existe: esa URL no apunta al backend de Tremp (¿el túnel apunta a otro puerto/servicio?)." ;;
  *) fail "Respuesta inesperada $code en /health: $(head -c 200 "$TMP")" ;;
esac
grep -q '"status":"ok"' "$TMP" || fail "/health no devolvió el JSON esperado (¿la URL apunta a otro servicio?): $(head -c 200 "$TMP")"
ok "/health → $(tr -d '\n' < "$TMP" | head -c 160)"

# La ruta de login debe existir: un body vacío da 400 (validación), no 404.
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' -d '{}' 2>/dev/null || true)"
case "$code" in
  400) ok "/auth/login disponible (spec 009)" ;;
  404) fail "/auth/login no existe en la VM: el backend desplegado es anterior a la spec 009. Actualízalo." ;;
  *)   fail "/auth/login respondió $code (se esperaba 400 con body vacío)." ;;
esac

# CORS sólo importa para la versión web (--web); la app nativa no lo usa.
allow="$(curl -sS -o /dev/null -D - --max-time 15 -X OPTIONS "$API_URL/auth/login" \
  -H "Origin: $WEB_ORIGIN" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' 2>/dev/null \
  | tr -d '\r' | sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin: *//p' || true)"
if [[ "$allow" == "$WEB_ORIGIN" || "$allow" == "*" ]]; then
  ok "CORS permite $WEB_ORIGIN (web)"
elif [[ "$PLATFORM" == "--web" ]]; then
  fail "CORS no permite $WEB_ORIGIN y pediste --web. En la VM agrega CORS_ORIGINS=$WEB_ORIGIN al .env y reinicia la API."
else
  warn "CORS no permite $WEB_ORIGIN: la app nativa funciona, pero --web fallará hasta agregar CORS_ORIGINS=$WEB_ORIGIN en la VM."
fi

# ── 3. Configurar la app ──────────────────────────────────────────────────────
step "Configurar la app (mobile/.env)"
touch "$ENV_FILE"
grep -v '^EXPO_PUBLIC_API_URL=' "$ENV_FILE" > "$TMP" || true
{ cat "$TMP"; echo "EXPO_PUBLIC_API_URL=$API_URL"; } > "$ENV_FILE"
ok "EXPO_PUBLIC_API_URL=$API_URL"

# ── 4. Dependencias ───────────────────────────────────────────────────────────
step "Dependencias de mobile/"
if [[ ! -d "$MOBILE/node_modules" || "$MOBILE/package-lock.json" -nt "$MOBILE/node_modules/.package-lock.json" ]]; then
  if (( SKIP_INSTALL )); then
    warn "Faltan dependencias o están desactualizadas (omitido por --skip-install)."
  else
    (cd "$MOBILE" && npm install --no-audit --no-fund)
    ok "npm install"
  fi
else
  ok "node_modules al día"
fi

if (( CHECK_ONLY )); then
  echo; ok "Todo listo (--check). Arranca con: ./scripts/mobile-vm.sh${PLATFORM:+ $PLATFORM}"
  exit 0
fi

# ── 5. Arrancar Expo ──────────────────────────────────────────────────────────
step "Arrancando Expo"
EXPO_ARGS=(start)
(( CLEAR ))  && EXPO_ARGS+=(-c)
(( TUNNEL )) && EXPO_ARGS+=(--tunnel)
[[ -n "$PLATFORM" ]] && EXPO_ARGS+=("$PLATFORM")
echo "  API:  $API_URL"
if (( TUNNEL )); then
  echo "  Metro por túnel: escanea el QR con Expo Go desde cualquier red."
else
  echo "  Escanea el QR con Expo Go (celular y PC en la misma Wi-Fi), o usa --tunnel."
fi
echo
cd "$MOBILE"
exec npx expo "${EXPO_ARGS[@]}"
