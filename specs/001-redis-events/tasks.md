# 001 · Tareas

- [x] T1 Scaffold Nest + Fastify + SWC, config tipada, Docker/compose — *AC6*
- [x] T2 RedisModule global (main/sub) + RedisService con JSON/TTL/getOrSet — *AC5.2*
- [x] T3 `EventsService.publish` (XADD MAXLEN~ + PUBLISH), `recent` — *AC1.1–1.3*
- [x] T4 `PublishEventDto` con validación — *AC1.2*
- [x] T5 `@EventHandler` + registry por discovery — *AC2.1, AC2.2*
- [x] T6 Consumer con lotes paralelos y XACK selectivo — *AC2.3, AC2.4*
- [x] T7 Reclaim de pendientes + DLQ + `GET /events/dlq` — *AC3.1–3.3*
- [x] T8 SSE con suscripción compartida y filtro por tipo — *AC4.1, AC4.2*
- [x] T9 Endpoints de caché — *AC5.1*
- [x] T10 `/health` y apagado limpio — *AC6.1, AC6.2*
- [x] T11 Verificación manual end-to-end (publicar, consumir, SSE, reclaim, DLQ, caché)
- [ ] T12 Tests automatizados (unit del consumer con Redis real vía Testcontainers + e2e HTTP)

## Plantilla para nuevas features
Copia `specs/001-redis-events/` a `specs/NNN-nombre/`, reescribe `spec.md` (historias + AC),
luego `plan.md`, luego `tasks.md` referenciando los AC. Implementa tarea por tarea.
