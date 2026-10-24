# Constitución del proyecto

Principios no negociables. Todo spec, plan y PR se valida contra ellos.

1. **Spec primero.** Ninguna funcionalidad se implementa sin `specs/NNN-nombre/spec.md` aprobado.
   El código sigue al spec; si el código cambia el comportamiento, el spec se actualiza en el mismo PR.
2. **Rendimiento por defecto.** Fastify como HTTP adapter, auto-pipelining en Redis, lotes (`COUNT`) y
   operaciones O(1)/O(log n). Nada de `KEYS`, `SCAN` en hot path, ni bucles con `await` por elemento cuando
   se puede usar pipeline.
3. **Entrega al menos una vez.** Todo evento de negocio pasa por Redis Streams con consumer group.
   Los handlers deben ser **idempotentes** (usar `event.id` como clave de deduplicación cuando aplique).
4. **Pub/Sub es best-effort.** Sólo para notificaciones en vivo (SSE). Nunca para lógica de negocio.
5. **Fallar visible.** Errores de handler no se tragan: se reintentan y, tras `EVENTS_MAX_DELIVERIES`,
   van a la DLQ consultable.
6. **Configuración por entorno.** Sin valores hardcodeados; todo en `src/config/configuration.ts`.
7. **Apagado limpio.** Toda conexión o loop se cierra en `OnApplicationShutdown`.
