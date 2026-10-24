# 010 · Tareas

Requiere 006 T1–T4 (migración 004, compose, config, Jest).

- [ ] T1 `infra/postgres/Dockerfile` (PostGIS + pgvector) y docker-compose usándolo — *AC4.4*
- [ ] T2 Migración `db/005_matching_views.sql` (vistas `rides`, `matches`, `user_preferences`; columnas `pref_estructuradas*`) montada como `05-…` — *AC4.1, AC4.2*
- [ ] T3 Verificar contra la BD: el `UPDATE user_preferences …` de matching-py actualiza `users`; `EXPLAIN` de su consulta de candidatos usa `idx_trips_ruta_gist` — *AC4.2, AC4.3*
- [ ] T4 `MATCHING_URL`, `MATCHING_TIMEOUT_MS` en `configuration.ts` + `.env.example` — *AC5.1*
- [ ] T5 `src/matching/` (`MatchingClient`, tipos, errores, módulo) + unit tests — *AC2.1–AC2.4*
- [ ] T6 Slice `search-rides`: DTO, handler, consulta de enriquecimiento y recorte, controller con `JwtAuthGuard` + unit tests — *AC1.1–AC1.5, AC2.5, AC3.1–AC3.4*
- [ ] T7 Registrar `MatchingModule` y el controller en `RidesModule`/`AppModule`; arranque sin matching-py → API viva y búsqueda `503` — *AC5.2*
- [ ] T8 Integración (Testcontainers): vista actualizable y recorte P→D
- [ ] T9 Verificación manual con matching-py local (D2): búsqueda con un viaje sembrado de 006 → 1 resultado sin origen del conductor; matching-py parado → `503`; `match.shown` en `rides.events` con `XREVRANGE`
- [ ] T10 README (endpoint, cómo levantar matching-py en local) y fila en `specs/README.md`
