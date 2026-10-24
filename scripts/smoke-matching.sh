#!/usr/bin/env bash
# Smoke test de la búsqueda con matching-py (spec 010). Sólo lecturas: no crea usuarios ni viajes.
#   API_URL=https://<túnel> SMOKE_CORREO=<correo> SMOKE_PASSWORD=<clave> scripts/smoke-matching.sh
# En la VM (con Docker y la red `tremp`) además prueba matching-py y osrm por dentro.
# Sale con código 1 en el primer fallo.
set -uo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000}"
# Credenciales: SMOKE_TOKEN (JWT ya firmado) o SMOKE_CORREO + SMOKE_PASSWORD de un usuario existente.
# En la VM, sin tocar la base:
#   SMOKE_TOKEN=$(docker exec tremp-api node -e "new (require('@nestjs/jwt').JwtService)({secret:process.env.JWT_SECRET}).signAsync({sub:require('crypto').randomUUID(),tipoUsuario:'pasajero'},{expiresIn:'5m'}).then(console.log)")
TOKEN="${SMOKE_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  CORREO="${SMOKE_CORREO:?Falta SMOKE_TOKEN o SMOKE_CORREO (usuario existente para iniciar sesión)}"
  PASSWORD="${SMOKE_PASSWORD:?Falta SMOKE_PASSWORD}"
fi
# Recogida en Altabrisa → Anáhuac Mayab; salida en 1 h (UTC, con zona)
BODY_POINTS='"pickup":{"lat":21.021,"lng":-89.585},"dropoff":{"lat":21.0436,"lng":-89.6295}'
DEPARTURE="$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1H +%Y-%m-%dT%H:%M:%SZ)"

fail=0
ok()  { printf '  ok    %s\n' "$1"; }
bad() { printf '  FALLA %s\n' "$1"; fail=1; }

# code <método> <ruta> [body] [token] → imprime el código HTTP y deja el cuerpo en $OUT
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
code() {
  curl -s -o "$OUT" -w '%{http_code}' -m 10 -X "$1" "$API_URL$2" -H 'content-type: application/json' \
    ${4:+-H "authorization: Bearer $4"} ${3:+-d "$3"}
}

echo "Smoke matching contra $API_URL"

c=$(code GET /health)
[ "$c" = 200 ] && grep -q '"postgres":{"status":"up"' "$OUT" && grep -q '"redis":{"status":"up"' "$OUT" \
  && ok "/health: postgres y redis arriba" || bad "/health → $c $(head -c 200 "$OUT")"

c=$(code POST /rides/search "{$BODY_POINTS,\"departureAt\":\"$DEPARTURE\"}")
[ "$c" = 401 ] && ok "/rides/search sin token → 401" || bad "/rides/search sin token → $c (esperado 401)"

if [ -z "$TOKEN" ]; then
  c=$(code POST /auth/login "{\"correo\":\"$CORREO\",\"password\":\"$PASSWORD\"}")
  TOKEN="$(sed -n 's/.*"token":"\([^"]*\)".*/\1/p' "$OUT")"
  [ "$c" = 200 ] && [ -n "$TOKEN" ] && ok "login de $CORREO" || { bad "login → $c"; exit 1; }
fi

c=$(code POST /rides/search "{\"pickup\":{\"lat\":19.43,\"lng\":-99.13},\"dropoff\":{\"lat\":21.0436,\"lng\":-89.6295},\"departureAt\":\"$DEPARTURE\"}" "$TOKEN")
[ "$c" = 400 ] && ok "/rides/search fuera de la península → 400" || bad "fuera de la península → $c (esperado 400)"

c=$(code POST /rides/search "{$BODY_POINTS,\"departureAt\":\"$DEPARTURE\"}" "$TOKEN")
case "$c" in
  200)
    n=$(grep -o '"rideId"' "$OUT" | wc -l | tr -d ' ')
    ok "/rides/search → 200 vía matching-py ($n resultados)"
    # Privacidad (AC3.3): ningún resultado trae el origen del conductor ni campos internos
    grep -q '"score"\|"modelVersion"\|"features"' "$OUT" && bad "la respuesta expone score/modelVersion/features" \
      || ok "sin score/modelVersion/features en la respuesta"
    ;;
  503) bad "/rides/search → 503: matching-py u OSRM no responden" ;;
  502) bad "/rides/search → 502: matching-py respondió fuera de contrato (ver logs de tremp-api)" ;;
  *)   bad "/rides/search → $c $(head -c 200 "$OUT")" ;;
esac

# Dentro de la VM: los contenedores que no publican puertos
if command -v docker >/dev/null 2>&1 && docker network inspect tremp >/dev/null 2>&1; then
  incurl() { docker run --rm --network tremp curlimages/curl:8.10.1 -fsS -m 5 "$1" 2>/dev/null; }
  incurl http://matching-py:8000/health | grep -q '"ok"' && ok "matching-py /health" || bad "matching-py /health"
  incurl "http://osrm:5000/route/v1/driving/-89.6237,20.9671;-89.5847,21.0186?overview=false" | grep -q '"Ok"' \
    && ok "osrm: ruta en Mérida" || bad "osrm no responde"
  docker logs --since 10m matching-py 2>&1 | grep -q 'ResourceNotFoundException\|end of its life' \
    && bad "matching-py: modelo de Bedrock no disponible (ver BEDROCK_LLM_MODEL_ID)" || ok "matching-py sin errores de modelo de Bedrock"
fi

[ "$fail" = 0 ] && echo "Smoke OK" || echo "Smoke con fallas"
exit "$fail"
