# 010 · Tareas

Requiere 006 T1–T4 (migración 004, compose, config, Jest).

- [x] T1 `infra/postgres/Dockerfile` (PostGIS + pgvector) y docker-compose usándolo — *AC4.4*
  - Base `pgvector/pgvector:0.8.1-pg17` + PostGIS: `postgis/postgis:17-3.5` es bullseye y su repo PGDG ya no existe. `docker build` ✅
- [x] T2 Migración `db/005_matching_views.sql` (vistas `rides`, `matches`, `user_preferences`; columnas `pref_estructuradas*`) montada como `05-…` — *AC4.1, AC4.2*
  - schema → 002 → 003 → 004 → 005 → seed en contenedor limpio sin errores ✅
- [x] T3 Verificar contra la BD: el `UPDATE user_preferences …` de matching-py actualiza `users`; `EXPLAIN` de su consulta de candidatos usa `idx_trips_ruta_gist` — *AC4.2, AC4.3*
  - `UPDATE 1` y `users.pref_estructuradas` actualizado; migración 001 de matching-py (pgvector) corre; con 5 000 viajes el plan hace `Bitmap Index Scan on idx_trips_ruta_gist` ✅
- [x] T4 `MATCHING_URL`, `MATCHING_TIMEOUT_MS` en `configuration.ts` + `.env.example` — *AC5.1*
- [x] T5 `src/matching/` (`MatchingClient`, tipos, errores, módulo) + unit tests — *AC2.1–AC2.4*
  - `test/matching/matching.client.spec.ts`: 9 tests ✅
- [x] T6 Slice `search-rides`: DTO, handler, consulta de enriquecimiento y recorte, controller con `JwtAuthGuard` + unit tests — *AC1.1–AC1.5, AC2.5, AC3.1–AC3.4*
  - `test/rides/search-rides.handler.spec.ts`: 9 tests ✅
- [x] T7 Registrar `MatchingModule` y el controller en `RidesModule`/`AppModule`; arranque sin matching-py → API viva y búsqueda `503` — *AC5.2*
  - API real con matching-py apagado: sin token `401`, con token `503`, fuera del bbox `400`, `passengerId` en body ignorado ✅
- [x] T8 Integración (Testcontainers): vista actualizable y recorte P→D
  - `npm run test:int`: 5 tests ✅ (también con la imagen sin caché)
- [x] T9 Verificación manual con matching-py local (D2): búsqueda con un viaje sembrado de 006 → 1 resultado sin origen del conductor; matching-py parado → `503`; `match.shown` en `rides.events` con `XREVRANGE`
  - 2026-10-24, contra la versión de la VM (`96f4a5e`) con Postgres 18, OSRM con el grafo real, matching-py de `Tremp_smart@main` y **Bedrock real**:
    búsqueda `200` en 0.43 s con 1 resultado y ruta recortada a recogida → bajada; `match.shown` con el mismo `requestId`;
    matching-py parado → `503`; `PATCH /preferences` → Bedrock → `users.pref_estructuradas` vía la vista ✅
  - Hallazgos en matching-py: Claude 3.5 Haiku llegó a fin de vida en Bedrock (usar `us.anthropic.claude-haiku-5-5`);
    el embedding no se guardaba por falta de `register_vector` en el pool de asyncpg (arreglo probado, pendiente en Tremp_smart).
- [x] T9b App: `PassengerView` usa `POST /rides/search` (rides "En vivo" primero, de prueba como respaldo) y `driver.sexo` para "solo conductoras"
  - `npm run typecheck` y `expo lint` de `mobile/` ✅; `toRide`/`departureFor` probados con una respuesta real ✅
- [x] T9c `scripts/smoke-matching.sh` (sólo lecturas; en la VM también matching-py, osrm y errores de modelo de Bedrock)
  - Contra el stack e2e: todo `ok` ✅
- [ ] T10 README (endpoint, cómo levantar matching-py en local) y fila en `specs/README.md`
