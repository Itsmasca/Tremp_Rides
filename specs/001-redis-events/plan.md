# 001 · Plan técnico

## Stack
NestJS 12 · Fastify · ioredis 6 · class-validator · SWC (build) · TypeScript 6 · Redis 7.

## Decisiones

| Decisión | Motivo |
|---|---|
| Fastify en vez de Express | ~2x throughput HTTP, menor overhead por request. |
| Redis Streams + consumer group | Durable, ACK, reintentos y escalado horizontal sin broker adicional. |
| Pub/Sub sólo para SSE | Latencia mínima para UI; la durabilidad la da el stream. |
| 3 conexiones Redis por proceso | `main` (auto-pipelining), `sub` (SUBSCRIBE), `consumer` (XREADGROUP BLOCK). Los modos bloqueantes no pueden compartir conexión. |
| Lotes de `EVENTS_BATCH` en paralelo + un solo `XACK` | Menos round-trips; throughput alto. |
| `XPENDING IDLE` + `XCLAIM` en vez de `XAUTOCLAIM` | Necesitamos el contador de entregas para decidir DLQ. |
| `MAXLEN ~` | Recorte aproximado: O(1) amortizado y memoria acotada. |
| Prefijo manual (`RedisService.key`) en lugar de `keyPrefix` de ioredis | `keyPrefix` no se aplica de forma consistente a canales pub/sub. |
| Discovery con `DiscoveryService` + decorador | Handlers declarativos sin acoplar módulos al bus. |

## Estructura

```
src/
  config/configuration.ts      # config tipada desde env
  redis/                       # módulo global: clientes + RedisService (JSON, TTL, getOrSet)
  events/
    events.service.ts          # publish (XADD + PUBLISH), recent, dlq, live$
    events.consumer.ts         # loop XREADGROUP, reclaim, DLQ
    event-handler.registry.ts  # descubre @EventHandler
    decorators/                # @EventHandler, ANY_EVENT
    handlers/                  # handlers de ejemplo / por dominio
    events.controller.ts       # REST + SSE
  cache/                       # endpoints de caché
  health/                      # /health
```

## Claves Redis
- `<prefix>events` — stream principal
- `<prefix>events:dlq` — dead letters
- `<prefix>events:live` — canal pub/sub
- `<prefix>cache:<key>` — caché JSON
