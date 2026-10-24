# 011 · Pagos con Stripe: retención al aceptar, cobro al terminar y comisión

**Estado:** En desarrollo (US1, US7 y cotización hechas) · **Fecha:** 2026-10-24 · **Issue:** #4 ·
**Relacionado:** 005 (catálogo), 006 (viajes), 009 (JWT), 001/003 (eventos)

## Objetivo

Cobrar al pasajero con tarjeta por Stripe lo que define el issue #4 (70% de la gasolina del viaje) **más una
comisión fija de la plataforma de $10 MXN**. El monto se **retiene** en la tarjeta cuando el conductor acepta y se
**cobra** al terminar; las cancelaciones siguen el issue #4. El conductor recibe su parte por **Stripe Connect** y
la plataforma se queda la comisión.

## Decisiones (dueño, 2026-10-24)

| Tema | Decisión |
|---|---|
| Comisión | $10 MXN por pasajero y viaje, **sumada** a lo que paga el pasajero. |
| Pago al conductor | Stripe Connect, cuentas **Express** (México). Cargos *destination*: la plataforma cobra, transfiere al conductor y retiene la comisión como `application_fee_amount`. |
| Momento del cobro | `PaymentIntent` con `capture_method=manual` al aceptar (retención); captura al finalizar. |
| Cuenta de Stripe | Ya existe. Llaves de prueba sólo en el `.env` de la VM, entregadas por un medio seguro. |

## Cálculo (siempre en el servidor)

```
gasolina  = redondear(km / rendimiento_km_l × precio_litro, 2)
pasajero  = redondear(gasolina × PAGO_REPARTO_PASAJERO, 2)   -- 0.70
comision  = PAGO_COMISION_MXN                                -- 10.00
total     = pasajero + comision                              -- lo que se retiene y cobra
conductor = pasajero                                         -- transferencia al conductor
```

`km` sale del servidor (OSRM, 006), `rendimiento_km_l` del catálogo (005), `precio_litro` de
`config.precio_litro_gasolina` (D1). Stripe recibe centavos (`total × 100`, `mxn`).
Ejemplo (#4, 17 km, sedán, $27.39/L): gasolina $42.33 → pasajero $29.63 + $10 = **$39.63**.

## Historias de usuario

### US0 · Cotización
- **AC0.1** `GET /payments/quote?km=&categoria=` (JWT) → `200 { km, categoria, rendimientoKmL, precioLitro,
  gasolina, pasajero, comision, total, conductor, moneda }`. `km` 0.1–500 y `categoria ∈ {sedan, suv, camioneta}`;
  si no, `400`. Funciona sin Stripe.

### US1 · Guardar tarjeta (pasajero)
- **AC1.1** `POST /payments/setup-intent` (JWT) crea o reutiliza el `Customer` del usuario
  (`users.stripe_customer_id`) y un `SetupIntent` (`usage=off_session`) → `{ setupIntentClientSecret, customerId,
  ephemeralKeySecret, publishableKey }` para el PaymentSheet de `@stripe/stripe-react-native`.
- **AC1.2** `GET /payments/methods` (JWT) → tarjetas `{ id, brand, last4, expMonth, expYear }`.
- **AC1.3** Con `STRIPE_ENABLED=false` (local, principio 13) estos endpoints responden `503`.
- **AC1.4** Los datos de tarjeta nunca pasan por el backend ni se guardan en Postgres: sólo ids de Stripe.

### US2 · Alta del conductor en Stripe Connect
- **AC2.1** `POST /payments/connect/onboarding` (JWT, conductor; si no, `403`) crea la cuenta Express (`MX`,
  `card_payments` + `transfers`) si no existe (`users.stripe_account_id`) y responde `{ url }` de un `AccountLink`.
- **AC2.2** `GET /payments/connect/status` → `{ chargesEnabled, payoutsEnabled, detailsSubmitted }`.
- **AC2.3** Sin cuenta activa, el conductor no puede aceptar pasajeros con pago (`409`).

### US3 · Retención al aceptar
- **AC3.1** Al aceptar a un pasajero (`trip_passengers` `solicitado → aceptado`, D3) se crea un `PaymentIntent`:
  `amount = total`, `mxn`, `customer`, tarjeta guardada, `off_session`, `confirm`, `capture_method = manual`,
  `application_fee_amount = comision × 100`, `transfer_data.destination` = cuenta del conductor,
  `metadata { tripId, tripPassengerId }`, idempotencia `"<trip_passenger_id>:retener"`.
- **AC3.2** Se congela el cálculo (#4 punto 7) en `payments` (`km`, `rendimiento_km_l`, `precio_litro`, `gasolina`,
  `monto`, `comision`, `monto_conductor`, `estado = 'retenido'`, `referencia_externa = pi_…`). Un pago por
  `trip_passenger_id`.
- **AC3.3** Tarjeta rechazada → `402` y pago `fallido`; si pide 3-D Secure → `402 { clientSecret }` para confirmar
  en la app.
- **AC3.4** Una retención dura 7 días: si la salida está a más de 6 días, se retiene 24 h antes (job).

### US4 · Cobro al terminar
- **AC4.1** Viaje `finalizado` → captura completa, `estado = 'pagado'`, idempotencia `"<trip_passenger_id>:cobrar"`.
- **AC4.2** Captura fallida → `fallido`, reintento por el consumer de eventos y DLQ.

### US5 · Cancelaciones (issue #4)
- **AC5.1** Pasajero cancela antes de que arranque el conductor → se cancela el `PaymentIntent`; no paga nada.
- **AC5.2** Pasajero cancela en camino o a bordo, **o no llega** en `TOLERANCIA_RECOGIDA_MIN` (default 5) → captura
  parcial del 70% de la gasolina de los km ya recorridos, sin comisión (D2); el resto se libera.
- **AC5.3** Cancela el conductor → se cancela el `PaymentIntent`; el pasajero no paga.
- **AC5.4** Los km recorridos los mide el servidor con la ubicación en Redis (002), nunca la app.

### US6 · Webhooks
- **AC6.1** `POST /payments/webhook` valida la firma (`STRIPE_WEBHOOK_SECRET`) sobre el body crudo; si no, `400`.
- **AC6.2** Maneja `payment_intent.*` y `account.updated`; idempotente por `event.id` (Redis, TTL 7 días).
- **AC6.3** Requiere URL estable (D4).

### US7 · Datos (`db/006_pagos_stripe.sql`, idempotente)
- **AC7.1** `users`: `stripe_customer_id`, `stripe_account_id` (`UNIQUE`).
- **AC7.2** `payments`: `km`, `rendimiento_km_l`, `precio_litro`, `gasolina`, `comision`, `monto_conductor`,
  `capturado`, `moneda` (`MXN`), `actualizado_en`; `UNIQUE (trip_passenger_id)` y `UNIQUE (referencia_externa)`.
- **AC7.3** `estado_pago` gana `retenido`, `cancelado`, `reembolsado`.

### US8 · Eventos y panel
- **AC8.1** Eventos por Redis Streams → EventBridge: `pago.retenido`, `pago.cobrado`, `pago.cancelado`,
  `pago.fallido`, `conductor.pagos_actualizado`. Sólo ids y montos.
- **AC8.2** `MontoCobradoMXN`, `MontoRetenidoMXN` y `ComisionesMXN` en el dashboard `trempapp-demo`.

## Configuración

| Variable | Default | Nota |
|---|---|---|
| `STRIPE_ENABLED` | `false` | En local no se llama a Stripe (`503`). |
| `STRIPE_SECRET_KEY` | — | Sólo en el `.env` de la VM. Nunca en logs. |
| `STRIPE_PUBLISHABLE_KEY` | — | Se devuelve a la app (AC1.1). |
| `STRIPE_WEBHOOK_SECRET` | — | AC6.1. |
| `PAGO_COMISION_MXN` | `10` | |
| `PAGO_REPARTO_PASAJERO` | `0.70` | Fijo en el servidor (#4). |
| `TOLERANCIA_RECOGIDA_MIN` | `5` | AC5.2. |

Tarjetas de prueba: `4242 4242 4242 4242` (aprobada), `4000 0025 0000 3155` (3-D Secure),
`4000 0000 0000 9995` (fondos insuficientes).

## Decisiones abiertas y dependencias

| # | Qué | Sin esto |
|---|---|---|
| D1 | Precio por litro: #4 usa Premium $27.39; `config`/seed tienen $24.00. | Montos distintos entre app y servidor. |
| D2 | Comisión en cancelaciones con cobro parcial: **supuesto** $0. | — |
| D3 | Endpoints del ciclo del viaje (unirse, aceptar, iniciar, finalizar, cancelar): no existen. Spec 012 o enmienda de 006. | US3–US5 no tienen dónde engancharse. |
| D4 | URL estable para el webhook (el *quick tunnel* cambia al reiniciar). | Sin avisos asíncronos de Stripe. |
| D5 | Cuenta de plataforma de Stripe en México con Connect habilitado. | No se crean cuentas Express MX. |

## Excepciones a la constitución

- `POST /payments/webhook` sin JWT: se autentica con la firma de Stripe.
- Principio 14: la llave de Stripe no es de AWS; va en el `.env` de la VM (`chmod 600`, no versionado).

## Fuera de alcance

Reembolsos y disputas desde la app, OXXO/SPEI, CFDI, propinas, varias monedas, efectivo.

## Riesgos aceptados

- Cargos *destination*: contracargos y comisiones de Stripe los absorbe la plataforma.
- Un cobro `off_session` puede pedir 3-D Secure; si el pasajero no confirma, no se acepta (AC3.3).
