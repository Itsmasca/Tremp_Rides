# 010 · Plan técnico

## Stack
`fetch` nativo de Node (ya decidido en 006 para OSRM; no se añade `@nestjs/axios`) · `pg` (`DatabaseService`) ·
PostGIS · `JwtAuthGuard` + `@CurrentUser()` de `src/auth/` (009) · class-validator.

## Decisiones

| Decisión | Motivo |
|---|---|
| Cliente HTTP con `fetch` + `AbortSignal.timeout(MATCHING_TIMEOUT_MS)` en `MatchingClient` | Mismo patrón que `OsrmClient` (006); sin dependencia nueva. Un solo lugar que conoce el contrato de matching-py. |
| Errores tipados en `MatchingClient`: `MatchingUnavailable` (→ 503) y `MatchingContractError` (→ 502) | El handler no conoce códigos HTTP de matching-py. 4xx de matching-py = bug de contrato, no del usuario (AC2.3). |
| Sin reintentos | matching-py ya reintenta OSRM una vez; reintentar aquí duplicaría latencia y `match.shown`. |
| Validar bbox con `PENINSULA_BBOX` de 006 antes de llamar | El bbox de crud-ts (`-90.5,19.5,-87.4,21.7`) está dentro del de matching-py (lat 17.8–21.7, lng −92.5…−86.7), así que matching-py nunca debería devolver 422 por bbox. |
| Enriquecer con **una** consulta `WHERE t.id = ANY($1::uuid[])` y recortar la geometría en la misma consulta | Principio 3. El recorte usa los puntos ajustados que manda matching-py (ver *Consultas*). |
| Recorte P→D con `ST_LineSubstring` + `ST_LineLocatePoint` | La geometría A→P→D→B de matching-py revela casa del conductor (principio 8). Si P está después de D en la línea (no debería), se devuelve `null` y log `warn`. |
| Vistas en lugar de renombrar tablas | Decisión del usuario (2026-10-24). matching-py no cambia código; crud-ts conserva su esquema. |
| `user_preferences` como vista simple (una tabla, sin agregados) | Postgres la hace actualizable sin triggers; el `UPDATE … WHERE structured_revision < $2` de matching-py funciona tal cual. |
| Postgres local con imagen propia `infra/postgres/Dockerfile`: `FROM postgis/postgis:17-3.5` + `postgresql-17-pgvector` | No hay imagen oficial con PostGIS y pgvector juntos. La variante alpine de postgis no tiene apt; la debian sí trae el repo PGDG. Sustituye la imagen de 006 (`17-3.5-alpine`). |

## Estructura

```
src/matching/
  matching.client.ts        # POST /match, timeout, errores tipados
  matching.types.ts         # MatchRequest/MatchResponse/Candidate (contrato de matching-py, no se cambia sin coordinar)
  matching.errors.ts
  matching.module.ts        # exporta MatchingClient
src/rides/search-rides/
  search-rides.dto.ts
  search-rides.handler.ts   # valida → MatchingClient → enriquecer → respuesta
  search-rides.controller.ts  # POST /rides/search con JwtAuthGuard
  search-rides.queries.ts
db/005_matching_views.sql
infra/postgres/Dockerfile
test/matching/matching.client.spec.ts
test/rides/search-rides.handler.spec.ts
```

`SearchRidesController` se registra en el `RidesModule` de 006. Si 006 aún no está, se crea
`RidesModule` con sólo este slice.

## Migración 005

```sql
-- Requiere 004 (columnas geo en trips).
CREATE OR REPLACE VIEW rides AS
SELECT t.id,
       t.conductor_id                 AS driver_id,
       t.origen                       AS origin,
       t.destino                      AS destination,
       t.ruta                         AS route,
       round(t.duracion_s)::int       AS duration_s,
       round(t.distancia_m)::int      AS distance_m,
       t.salida_en                    AS departure_at,
       t.capacidad_disponible::int    AS seats_available,
       t.max_desvio_s                 AS max_detour_s,
       CASE t.estado WHEN 'pendiente'  THEN 'scheduled'
                     WHEN 'en_curso'   THEN 'in_progress'
                     WHEN 'finalizado' THEN 'completed'
                     WHEN 'cancelado'  THEN 'cancelled' END AS status
  FROM trips t;

CREATE OR REPLACE VIEW matches AS
SELECT tp.id, tp.trip_id AS ride_id, tp.pasajero_id AS passenger_id,
       CASE tp.estado WHEN 'solicitado' THEN 'pending'
                      WHEN 'aceptado'   THEN 'accepted'
                      WHEN 'rechazado'  THEN 'rejected'
                      WHEN 'completado' THEN 'completed' END AS status,
       tp.creado_en AS created_at
  FROM trip_passengers tp;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pref_estructuradas          JSONB,
  ADD COLUMN IF NOT EXISTS pref_estructuradas_revision INTEGER,
  ADD COLUMN IF NOT EXISTS pref_estructuradas_en       TIMESTAMPTZ;

CREATE OR REPLACE VIEW user_preferences AS
SELECT id                          AS user_id,
       raw_text,
       preferences_revision        AS revision,
       pref_estructuradas          AS structured,
       pref_estructuradas_revision AS structured_revision,
       pref_estructuradas_en       AS structured_at
  FROM users;

COMMENT ON VIEW rides IS 'Contrato de lectura para matching-py (spec 010). No usar desde crud-ts.';
-- (igual para matches y user_preferences)
```

`rides.status` es un `CASE`, así que el filtro `status = 'scheduled'` no usa `idx_trips_estado_salida`;
el prefiltro lo hace el GiST de `ruta` (AC4.3). Si el `EXPLAIN` sale mal con datos reales, se añade
`estado` como columna extra de la vista y se pide a matching-py filtrar por ella.

docker-compose monta `005` como `05-migracion-005.sql` (después de `04`, antes de `09-seed`).

## Consultas

Enriquecimiento y recorte (una sola ida a la BD; `$1` es un JSON con `[{ride_id, p_lng, p_lat, d_lng, d_lat, geom}]`):

```sql
WITH c AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS c(ride_id uuid, p_lng float8, p_lat float8, d_lng float8, d_lat float8, geom jsonb)
), g AS (
  SELECT c.*, ST_SetSRID(ST_GeomFromGeoJSON(c.geom::text), 4326) AS line FROM c WHERE c.geom IS NOT NULL
)
SELECT t.id, t.salida_en, t.capacidad_disponible, t.precio_por_pasajero,
       u.id AS driver_id, u.nombre, u.foto_url,
       CASE WHEN g.line IS NULL THEN NULL
            WHEN ST_LineLocatePoint(g.line, ST_SetSRID(ST_MakePoint(g.p_lng, g.p_lat), 4326))
               < ST_LineLocatePoint(g.line, ST_SetSRID(ST_MakePoint(g.d_lng, g.d_lat), 4326))
            THEN ST_AsGeoJSON(ST_LineSubstring(g.line,
                   ST_LineLocatePoint(g.line, ST_SetSRID(ST_MakePoint(g.p_lng, g.p_lat), 4326)),
                   ST_LineLocatePoint(g.line, ST_SetSRID(ST_MakePoint(g.d_lng, g.d_lat), 4326))))::json
       END AS route_pd
  FROM c
  JOIN trips t ON t.id = c.ride_id
  JOIN users u ON u.id = t.conductor_id
  LEFT JOIN g ON g.ride_id = c.ride_id
 WHERE t.estado = 'pendiente' AND t.capacidad_disponible > 0;
```

El orden final lo da el arreglo de matching-py, no el SQL.

## Configuración

| Variable | Default | Uso |
|---|---|---|
| `MATCHING_URL` | `http://localhost:8000` | Base de matching-py. En ECS, el DNS interno del servicio. |
| `MATCHING_TIMEOUT_MS` | `3000` | Timeout de `POST /match` (SC-001 de matching-py: p95 < 400 ms + reintento OSRM). |

`PENINSULA_BBOX` y `MAX_DAYS_AHEAD` se reutilizan de 006.

## Desarrollo local

1. `docker compose up -d` (Postgres con PostGIS + pgvector, Redis, OSRM).
2. En `awsLionRidealghoritm/`, `.env` con `REDIS_URL=redis://localhost:6379/0`,
   `DATABASE_URL=postgresql://trempapp:trempapp@localhost:5432/trempapp`, `OSRM_URL=http://localhost:5000`,
   `LLM_PROVIDER=fake` (o `bedrock` con credenciales AWS); aplicar su `migrations/001`.
3. `uvicorn`/`python main.py` en `:8000`; `npm run start:dev` en crud-ts.

## Tests

- `matching.client.spec.ts` (`fetch` mockeado): body enviado, timeout → `MatchingUnavailable`, `503`/`500`/red →
  `MatchingUnavailable`, `422` → `MatchingContractError` con el cuerpo, `requestId` distinto → `MatchingContractError`.
- `search-rides.handler.spec.ts` (cliente y BD falsos): bbox fuera → 400 sin llamar al cliente; lista vacía → `[]`;
  viaje que ya no está `pendiente` se descarta y `rank` se renumera; orden de matching-py se respeta.
- Integración (Testcontainers con la imagen de `infra/postgres`): la vista `user_preferences` acepta el `UPDATE`
  exacto de `app/features/preferences/repository.py`; el recorte devuelve una línea que empieza en P y acaba en D.
