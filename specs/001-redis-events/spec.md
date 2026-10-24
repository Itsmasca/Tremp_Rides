# 001 · Base Redis + gestión de eventos

**Estado:** Implementado · **Fecha:** 2026-10-24

## Objetivo

Backend base que ofrezca acceso a Redis (caché) y un bus de eventos durable, escalable horizontalmente
y con notificación en tiempo real.

## Historias de usuario

### US1 · Publicar eventos
Como servicio/cliente quiero publicar un evento `{ type, payload, correlationId? }` para que otros
módulos reaccionen.

- **AC1.1** `POST /events` con body válido responde `202 { id, occurredAt }`.
- **AC1.2** `type` debe cumplir `dominio.accion` (`/^[a-z0-9]+([._-][a-z0-9]+)*$/i`, ≤100); si no, `400`.
- **AC1.3** El evento queda persistido en el stream `<prefix>events`, acotado a `EVENTS_MAXLEN` (aprox.).

### US2 · Consumir eventos
Como desarrollador quiero declarar handlers con `@EventHandler('tipo')` en cualquier provider.

- **AC2.1** Los handlers se descubren automáticamente al arrancar (sin registro manual).
- **AC2.2** `@EventHandler('*')` recibe todos los eventos.
- **AC2.3** Un evento se confirma (`XACK`) sólo si **todos** sus handlers terminan sin error.
- **AC2.4** Varias instancias comparten el consumer group: cada evento lo procesa una sola instancia.

### US3 · Reintentos y DLQ
- **AC3.1** Eventos pendientes con idle ≥ `EVENTS_CLAIM_IDLE_MS` se reclaman y reprocesan
  (cubre handlers fallidos e instancias caídas).
- **AC3.2** Con entregas ≥ `EVENTS_MAX_DELIVERIES` el evento se copia a `<stream>:dlq` (con `originalId`) y se confirma.
- **AC3.3** `GET /events/dlq?count=N` lista la DLQ.

### US4 · Tiempo real
- **AC4.1** `GET /events/stream?types=a,b` (SSE) emite cada evento publicado, filtrable por tipo.
- **AC4.2** Una sola suscripción Redis por proceso, compartida entre todos los clientes SSE.

### US5 · Caché
- **AC5.1** `PUT /cache/:key { value, ttl? }` → `204`; `GET /cache/:key` → `200 { key, value }` o `404`;
  `DELETE /cache/:key` → `204`.
- **AC5.2** `RedisService.getOrSet` deduplica cargas concurrentes de la misma key en el proceso.

### US6 · Operación
- **AC6.1** `GET /health` → `200` con latencia de Redis, o `503` si Redis no responde.
- **AC6.2** SIGTERM detiene el consumer y cierra conexiones sin perder eventos (quedan pendientes y se reclaman).

## Fuera de alcance
Autenticación, esquemas tipados por evento, métricas Prometheus, Redis Cluster/Sentinel.
