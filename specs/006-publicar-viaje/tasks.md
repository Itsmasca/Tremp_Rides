# 006 · Tareas

- [ ] T1 Migración `db/004_trips_geo_outbox.sql` (PostGIS, columnas de `trips`, `outbox`, índices, CHECK, backfill) y ajustar el `INSERT INTO trips` de `seed.sql` — *AC7.1*
- [ ] T2 docker-compose: imagen `postgis/postgis`, montar 004, servicio `osrm`, perfil `worker`; `infra/osrm/prepare.sh` + README — *AC7.2*
- [ ] T3 Configuración `rides`/`osrm`/`outbox` en `configuration.ts` + `.env.example`; `PreferencesService` lee `RIDES_EVENTS_STREAM` de config — *AC7.3*
- [ ] T4 Jest + `@swc/jest` + Testcontainers; scripts `test` y `test:int`
- [ ] T5 `OsrmClient` (+ fixtures y unit tests) — *AC2.1–AC2.3, AC1.6*
- [ ] T6 Catálogo de eventos `rides-events.ts` + `OutboxService.enqueue(client, event)` — *AC5.1*
- [ ] T7 `OutboxPublisher` (polling, `SKIP LOCKED`, pipeline `XADD`, attempts/last_error, apagado limpio) + `outbox-worker.main.ts` — *AC5.2–AC5.5*
- [ ] T8 `@CurrentUser()` stub (`x-user-id`) — *AC1.2*
- [ ] T9 Slice `create-ride`: DTO, handler (validaciones → OSRM → TX), controller + unit tests — *AC1.1–AC1.7, AC2.4, AC2.5, AC5.1*
- [ ] T10 `rides.queries.ts` + `rides.mapper.ts`; slices `get-ride` y `list-my-rides` — *AC3.1, AC3.2, AC4.1, AC4.2*
- [ ] T11 `PurgeGeoJob` — *AC6.1–AC6.3*
- [ ] T12 `RidesModule`, `OsrmModule`, `OutboxModule` en `AppModule`
- [ ] T13 Tests de integración (rides con postgis, publicador con redis, concurrencia de traslape) — *AC1.5, AC5.1–AC5.3, AC6.1*
- [ ] T14 Verificación manual con `docker compose up` y OSRM real: ruta Mérida centro → Anáhuac Mayab, 409, 422 (punto en el mar), 503 (OSRM parado), evento en `rides.events` con `XRANGE`
- [ ] T15 README (tabla de API, cómo preparar OSRM) y PR aparte para enmendar el principio 8 / spec 002 AC4.2
