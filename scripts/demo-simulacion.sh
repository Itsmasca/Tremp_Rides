#!/usr/bin/env bash
# =============================================================================
# Tremp · Simulación en vivo de un viaje completo (para la demo)
#
#   DEMO_PASSWORD=... ./scripts/demo-simulacion.sh https://<tu-tunel>.trycloudflare.com
#   DEMO_PASSWORD=... ./scripts/demo-simulacion.sh https://... --rapido   # sin pausas largas
#   DEMO_PASSWORD=... ./scripts/demo-simulacion.sh https://... --no-llega # la pasajera no llega
#
# Usa las cuentas demo demo4@anahuac.mx (conductora) y demo5@anahuac.mx (pasajera).
# En ~1 minuto: la pasajera pide el viaje, la conductora acepta y se retiene el pago,
# se acerca al punto de recogida, espera con 5 min de tolerancia (cuenta regresiva),
# hacen el recorrido y se cobra (issue #4: 70% de la gasolina + comisión de $10).
# Con --no-llega se agota la tolerancia y se cancela cobrando el 70% de la gasolina
# de los km que ya manejó la conductora.
#
# La ubicación sólo vive en Redis con TTL (nunca en Postgres ni en los eventos): los eventos
# llevan kilómetros restantes y minutos estimados. Pasan por Redis Streams, llegan a
# EventBridge y se ven en vivo en el dashboard `trempapp-demo` de CloudWatch.
# Los viajes y pagos aún no tienen endpoints: esto sólo publica los eventos.
# =============================================================================
set -euo pipefail

if [[ -t 1 ]]; then G=$'\e[32m'; B=$'\e[1m'; D=$'\e[2m'; R=$'\e[31m'; N=$'\e[0m'; else G= B= D= R= N=; fi
ok()   { echo "${G}✔${N} $*"; }
info() { echo "  ${D}$*${N}"; }
fail() { echo "${R}✘ $*${N}" >&2; exit 1; }
step() { echo; echo "${B}▸ $*${N}"; }

API_URL=""; PAUSA=4; NO_SHOW=0; TOLERANCIA_MIN=5
for arg in "$@"; do
  case "$arg" in
    --rapido) PAUSA=1 ;;
    --no-llega) NO_SHOW=1 ;;
    -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) API_URL="$arg" ;;
  esac
done
API_URL="${API_URL:-${TREMP_API_URL:-}}"
[[ -n "$API_URL" ]] || fail "Falta la URL del backend (argumento o TREMP_API_URL)."
API_URL="${API_URL%/}"
[[ -n "${DEMO_PASSWORD:-}" ]] || fail "Falta DEMO_PASSWORD (contraseña de las cuentas demo)."
command -v python3 >/dev/null || fail "Se necesita python3 para leer el JSON."

json() { python3 -c "import sys, json; print(json.load(sys.stdin)$1)"; }
post() { curl -sS --max-time 15 -X POST "$API_URL$1" -H 'content-type: application/json' -d "$2"; }
loc()  { curl -sS --max-time 15 -o /dev/null -X PUT "$API_URL/location/$1" -H 'content-type: application/json' \
           -d "{\"lat\":$2,\"lng\":$3,\"ttlSeconds\":600}"; }
evento() { post /events "{\"type\":\"$1\",\"correlationId\":\"$VIAJE\",\"payload\":$2}" >/dev/null; }
# Punto intermedio entre (lat1,lng1) y (lat2,lng2) en la fracción f
interp() { python3 -c "a,b,c,d,f=map(float,'$1 $2 $3 $4 $5'.split()); print(f'{a+(c-a)*f:.5f} {b+(d-b)*f:.5f}')"; }

# Puntos de referencia en Mérida (sólo se mandan a Redis, con TTL)
INICIO=(21.0712 -89.6524)   # donde está la conductora al aceptar
RECOGIDA=(21.0590 -89.6355) # Anáhuac Mayab
DESTINO=(21.0215 -89.5835)  # Altabrisa
KM_AL_PUNTO=2.4; KM_VIAJE=12
GASOLINA=29.88; PASAJERO=20.92; COMISION=10; TOTAL=30.92

step "Backend"
curl -sS --max-time 15 "$API_URL/health" | json "['status']" | grep -q ok || fail "El backend no responde en $API_URL"
ok "API, Postgres y Redis arriba"

step "Login"
login() { post /auth/login "{\"correo\":\"$1\",\"password\":\"$DEMO_PASSWORD\"}"; }
C_JSON="$(login demo4@anahuac.mx)"; P_JSON="$(login demo5@anahuac.mx)"
C_ID="$(json "['user']['id']" <<<"$C_JSON")" || fail "No entró la conductora"
P_ID="$(json "['user']['id']" <<<"$P_JSON")" || fail "No entró la pasajera"
ok "Demo Conductora · Mazda 3 sedán"
ok "Demo Pasajera"
VIAJE="viaje-$(date +%H%M%S)"

step "1. La pasajera pide el viaje ($KM_VIAJE km, Anáhuac Mayab → Altabrisa)"
loc "$P_ID" "${RECOGIDA[@]}"
evento viaje.solicitado "{\"viajeId\":\"$VIAJE\",\"estado\":\"buscando conductora\",\"kmViaje\":$KM_VIAJE}"
ok "Solicitud enviada · buscando conductora cercana…"; sleep "$PAUSA"

step "2. La conductora acepta y se retiene el pago en la tarjeta"
loc "$C_ID" "${INICIO[@]}"
evento viaje.aceptado "{\"viajeId\":\"$VIAJE\",\"estado\":\"conductora asignada\",\"kmAlPunto\":$KM_AL_PUNTO,\"etaMin\":6}"
evento pago.retenido "{\"viajeId\":\"$VIAJE\",\"estadoPago\":\"retenido\",\"gasolina\":$GASOLINA,\"pasajero70\":$PASAJERO,\"comision\":$COMISION,\"total\":$TOTAL,\"moneda\":\"MXN\"}"
ok "Conductora a $KM_AL_PUNTO km · llega en ~6 min"
ok "Retenidos \$$TOTAL MXN (gasolina 70% \$$PASAJERO + comisión \$$COMISION)"; sleep "$PAUSA"

step "3. La conductora se acerca al punto de recogida"
for i in 1 2 3 4 5 6; do
  f="$(python3 -c "print($i/6)")"
  loc "$C_ID" $(interp "${INICIO[@]}" "${RECOGIDA[@]}" "$f")
  km="$(python3 -c "print(round($KM_AL_PUNTO*(1-$i/6), 1))")"; eta="$(python3 -c "print(max(0, 6-$i))")"
  evento viaje.en_camino "{\"viajeId\":\"$VIAJE\",\"estado\":\"en camino\",\"kmAlPunto\":$km,\"etaMin\":$eta}"
  info "a $km km del punto · ~$eta min"; sleep "$PAUSA"
done

step "4. Llegó: tolerancia de $TOLERANCIA_MIN min para que suba la pasajera"
evento viaje.llegada "{\"viajeId\":\"$VIAJE\",\"estado\":\"esperando a la pasajera\",\"kmAlPunto\":0,\"toleranciaSeg\":$((TOLERANCIA_MIN * 60))}"
ok "La conductora está en el punto"
# Cuenta regresiva comprimida: cada pausa equivale a 1 minuto de tolerancia
for ((min = TOLERANCIA_MIN - 1; min >= 0; min--)); do
  sleep "$PAUSA"
  if [[ "$NO_SHOW" == 0 && "$min" -lt $((TOLERANCIA_MIN - 2)) ]]; then break; fi
  evento viaje.esperando "{\"viajeId\":\"$VIAJE\",\"estado\":\"esperando a la pasajera\",\"toleranciaSeg\":$((min * 60))}"
  info "tolerancia: quedan $min:00 min"
done

if [[ "$NO_SHOW" == 1 ]]; then
  step "5. Se acabó la tolerancia: la pasajera no llegó"
  # issue #4: se cobra el 70% de la gasolina de los km que la conductora ya recorrió; sin comisión (supuesto)
  read -r gas cobro <<<"$(python3 -c "g=$KM_AL_PUNTO/11*27.39; print(f'{g:.2f} {g*0.7:.2f}')")"
  evento viaje.cancelado "{\"viajeId\":\"$VIAJE\",\"estado\":\"cancelado: la pasajera no llegó\",\"toleranciaSeg\":0,\"kmRecorridos\":$KM_AL_PUNTO}"
  evento pago.cobrado "{\"viajeId\":\"$VIAJE\",\"estadoPago\":\"cobro por cancelación\",\"gasolina\":$gas,\"total\":$cobro,\"comision\":0,\"conductor\":$cobro,\"moneda\":\"MXN\"}"
  ok "Cancelado · se cobran \$$cobro MXN (70% de \$$gas de gasolina por $KM_AL_PUNTO km) y se libera el resto"
  curl -sS --max-time 15 -o /dev/null -X DELETE "$API_URL/location/$C_ID"
  curl -sS --max-time 15 -o /dev/null -X DELETE "$API_URL/location/$P_ID"
  ok "Ubicaciones borradas de Redis"
  step "Listo · $VIAJE"
  echo "Dashboard en vivo: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards/dashboard/trempapp-demo"
  exit 0
fi
ok "La pasajera subió a tiempo"

step "5. Viaje en curso"
evento viaje.iniciado "{\"viajeId\":\"$VIAJE\",\"estado\":\"en viaje\",\"kmADestino\":$KM_VIAJE,\"etaMin\":18}"
for i in 1 2 3 4 5 6; do
  f="$(python3 -c "print($i/6)")"
  read -r lat lng <<<"$(interp "${RECOGIDA[@]}" "${DESTINO[@]}" "$f")"
  loc "$C_ID" "$lat" "$lng"; loc "$P_ID" "$lat" "$lng"
  km="$(python3 -c "print(round($KM_VIAJE*(1-$i/6), 1))")"; eta="$(python3 -c "print(max(0, 18-3*$i))")"
  evento viaje.en_ruta "{\"viajeId\":\"$VIAJE\",\"estado\":\"en viaje\",\"kmADestino\":$km,\"etaMin\":$eta}"
  info "faltan $km km · ~$eta min"; sleep "$PAUSA"
done

step "6. Llegaron y se cobra"
evento viaje.finalizado "{\"viajeId\":\"$VIAJE\",\"estado\":\"finalizado\",\"kmRecorridos\":$KM_VIAJE}"
evento pago.cobrado "{\"viajeId\":\"$VIAJE\",\"estadoPago\":\"cobrado\",\"total\":$TOTAL,\"comision\":$COMISION,\"conductor\":$PASAJERO,\"moneda\":\"MXN\"}"
ok "Cobrados \$$TOTAL MXN · conductora \$$PASAJERO · plataforma \$$COMISION"
# La ubicación se borra al terminar (privacidad); si no, expira sola con su TTL
curl -sS --max-time 15 -o /dev/null -X DELETE "$API_URL/location/$C_ID"
curl -sS --max-time 15 -o /dev/null -X DELETE "$API_URL/location/$P_ID"
ok "Ubicaciones borradas de Redis"

step "Listo · $VIAJE"
echo "Dashboard en vivo: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards/dashboard/trempapp-demo"
