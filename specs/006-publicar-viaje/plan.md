# 006 · Plan técnico

## Stack
`pg` (`DatabaseService`) · PostGIS 3 · `fetch` nativo de Node 22 · ioredis · class-validator ·
Jest + `@swc/jest` + `@nestjs/testing` · Testcontainers (`@testcontainers/postgresql`, `@testcontainers/redis`).

## Decisiones

| Decisión | Motivo |
|---|---|
| OSRM antes de la transacción; TX = lock conductor → traslape → `INSERT trips` → `INSERT outbox` | AC2.4 / AC5.1. No hay locks abiertos durante I/O de red. |
| Lock por conductor con `SELECT 1 FROM users WHERE id = $1 FOR UPDATE` | El borrador bloqueaba los viajes del conductor: si no tiene ninguno no hay filas que bloquear y dos peticiones concurrentes pasarían ambas. |
| `ride.created` va sólo a `RIDES_EVENTS_STREAM` (`rides.events`), no a `trempapp:events` | Es el stream que matching-py consume con su consumer group (principio 4); no se publica en paralelo en ambos (principio 5). |
| Geometría escrita con `ST_SetSRID(ST_MakePoint($lng, $lat), 4326)` y `ST_SetSRID(ST_GeomFromGeoJSON($n), 4326)` | Parametrizado, sin construir WKT a mano, SRID explícito contra columnas `geometry(…, 4326)`. |
| Geometría leída con `ST_AsGeoJSON(…)::json`, `ST_X`, `ST_Y` | No se parsea WKB en TS. |
| `INSERT … RETURNING` con las mismas expresiones de lectura que `GET` | La respuesta 201 y la de `GET` salen del mismo SQL (`rides.queries.ts`). |
| Simplificación sólo en lectura: `CASE WHEN ST_NPoints(ruta) > $max THEN ST_SimplifyPreserveTopology(ruta, $tol) ELSE ruta END` | La BD conserva la ruta completa (AC2.5); `ROUTE_SIMPLIFY_TOLERANCE` en grados (~0.00005 ≈ 5 m). |
| lat/lng ↔ lng,lat sólo en `OsrmClient` | Un único punto de conversión; el resto del código usa `LatLng`. |
| `NoRoute`/`NoSegment` → 422; timeout/red/5xx → 503 | AC2.2 / AC2.3. Otro 4xx de OSRM es un bug nuestro → 500 con log. |
| Validaciones dependientes de config (bbox, horizonte, 200 m) en el handler, no en el DTO | Los decoradores de class-validator no tienen acceso a `ConfigService`. El DTO valida forma y rangos fijos. |
| Publicador: una TX por lote, `XADD` en pipeline, `UPDATE … WHERE id = ANY($1)` | Principio 3 (lotes, sin `await` por elemento). `SKIP LOCKED` reparte filas entre instancias. |
| Si el pipeline falla, `ROLLBACK` del lote y `UPDATE attempts = attempts + 1, last_error` en TX aparte | Las filas vuelven a estar pendientes; el error queda visible. Si el `XADD` entró pero el `COMMIT` falla, se republica (al menos una vez, dedupe por `envelope.id`). |
| Purga de geometría como `setInterval` en `RidesModule`, siempre activa | Un `UPDATE` idempotente; varias instancias no se pisan (AC6.3). |
| Estado API ↔ BD mapeado en `rides.mapper.ts` | Un solo lugar para `pendiente ↔ scheduled`, etc. |
| `@CurrentUser()` lee `x-user-id` | Stub hasta que exista JWT (riesgo aceptado). |

## Adaptación del borrador original

El borrador asumía otro stack; se adapta al repo actual:

| Borrador | Aquí | Motivo |
|---|---|---|
| ESM (`nodenext`, imports `.js`) | CommonJS | Migrar a ESM es un cambio transversal fuera de alcance. |
| Drizzle + tipos `geoPoint`/`geoLine` con EWKT | `pg` + SQL parametrizado (`DatabaseService`) | Principio 9 y patrón de `users.repository.ts`. El problema del SRID lo resuelve `ST_SetSRID` (ver Decisiones). |
| Migración Drizzle | `db/004_trips_geo_outbox.sql` | Principio 9. |
| `config/env.ts` con zod | `src/config/configuration.ts` | Principio 12. |
| Tabla `rides`, enum en inglés | Columnas nuevas en `trips`, enum `estado_viaje` | Evita dos tablas de viajes (principio 17). La API y el evento siguen diciendo `ride`. |
| `EVENTS_STREAM=rides.events` | `RIDES_EVENTS_STREAM` (ya existe) | `EVENTS_STREAM` es el stream interno `trempapp:events`. |
| `src/infra/…`, `src/shared/…` | `src/osrm/`, `src/outbox/`, `src/rides/<slice>/` | Mismo nivel que `src/database/` y `src/redis/`. |

## Estructura

```
db/
  004_trips_geo_outbox.sql
src/
  auth/current-user.decorator.ts        # stub: x-user-id → 401 si falta o no es UUID
  osrm/
    osrm.client.ts                      # route(points) → { distanceM, durationS, geometry, snapped }
    osrm.module.ts
    osrm.types.ts                       # LatLng, LngLat, respuesta OSRM
  outbox/
    outbox.service.ts                   # enqueue(client: PoolClient, event)
    outbox.publisher.ts                 # loop de polling, OnApplicationShutdown
    outbox.module.ts                    # OutboxModule.forRoot({ inline })
  events/rides-events.ts                # catálogo tipado: EventPayloads, EVENT_VERSIONS
  rides/
    create-ride/
      create-ride.controller.ts         # POST /rides
      create-ride.dto.ts
      create-ride.handler.ts            # validar → OSRM → TX(lock, traslape, insert, enqueue)
    get-ride/
      get-ride.controller.ts            # GET /rides/:id
    list-my-rides/
      list-my-rides.controller.ts       # GET /rides/mine
      list-my-rides.query.ts
    purge-geo.job.ts                    # US6
    rides.mapper.ts                     # fila → respuesta, estado BD ↔ API
    rides.queries.ts                    # SQL compartido (selects con ST_AsGeoJSON / ST_X / ST_Y)
    rides.module.ts
  outbox-worker.main.ts                 # NestFactory.createApplicationContext(OutboxWorkerModule)
infra/osrm/
  README.md                             # cómo preparar el grafo
  prepare.sh                            # descarga México (Geofabrik), recorta península, extract/partition/customize
  .gitignore                            # *.osm.pbf, *.osrm*
test/
  osrm.client.spec.ts
  create-ride.handler.spec.ts
  fixtures/osrm-route-ok.json, osrm-noroute.json
  integration/rides.int-spec.ts         # postgis/postgis
  integration/outbox-publisher.int-spec.ts  # postgis + redis
```

`GET /rides/mine` se registra antes que `GET /rides/:id` (o `:id` lleva `ParseUUIDPipe`) para que
`mine` no se interprete como id.

## Migración `db/004_trips_geo_outbox.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE trips
  ADD COLUMN origen          geometry(Point, 4326),        -- NULL tras la purga (US6)
  ADD COLUMN destino         geometry(Point, 4326),
  ADD COLUMN ruta            geometry(LineString, 4326),
  ADD COLUMN distancia_m     REAL,
  ADD COLUMN duracion_s      REAL,
  ADD COLUMN salida_en       TIMESTAMPTZ,
  ADD COLUMN asientos_totales SMALLINT,
  ADD COLUMN max_desvio_s    INTEGER NOT NULL DEFAULT 600 CHECK (max_desvio_s BETWEEN 0 AND 1800),
  ADD COLUMN actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill de filas existentes (seed): salida = fecha, asientos = capacidad disponible.
UPDATE trips SET salida_en = fecha, asientos_totales = capacidad_disponible,
                 distancia_m = distancia_km * 1000;

ALTER TABLE trips
  ALTER COLUMN salida_en SET NOT NULL,
  ALTER COLUMN asientos_totales SET NOT NULL,
  ADD CONSTRAINT chk_asientos CHECK (asientos_totales BETWEEN 1 AND 8
                                     AND capacidad_disponible <= asientos_totales);

CREATE INDEX idx_trips_ruta_gist        ON trips USING GIST (ruta);           -- matching-py: ST_DWithin
CREATE INDEX idx_trips_estado_salida    ON trips (estado, salida_en);
CREATE INDEX idx_trips_conductor_salida ON trips (conductor_id, salida_en DESC, id DESC);  -- traslape y /mine

CREATE TABLE outbox (
  id             BIGSERIAL PRIMARY KEY,
  event_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,
  version        SMALLINT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  payload        JSONB NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);
CREATE INDEX idx_outbox_pendientes ON outbox (id) WHERE published_at IS NULL;
```

En volúmenes nuevos `seed.sql` (09) corre **después** de la 004: su `INSERT INTO trips` debe añadir
`salida_en` (p. ej. `now() + interval '1 day'`) y `asientos_totales`, o fallará por `NOT NULL`.
El backfill cubre sólo volúmenes ya existentes.

`distancia_km` (existente) se sigue rellenando: `round(distancia_m / 1000, 2)`. `fecha` queda como
fecha de creación de facto.

Volúmenes ya inicializados no ejecutan scripts de `docker-entrypoint-initdb.d`: hay que aplicar 004 a
mano (`psql -f`) o recrear con `docker compose down -v`. Cambiar la imagen a `postgis/postgis:17-3.5`
sobre un volumen existente es compatible (misma versión mayor de Postgres).

## Consultas clave

Traslape (dentro de la TX, tras el lock):
```sql
SELECT 1 FROM trips
WHERE conductor_id = $1 AND estado = 'pendiente'
  AND salida_en BETWEEN $2::timestamptz - make_interval(mins => $3)
                    AND $2::timestamptz + make_interval(mins => $3)
LIMIT 1;
```

Publicador:
```sql
SELECT id, event_id, type, version, aggregate_type, aggregate_id, payload, occurred_at
FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED;
```

Purga:
```sql
UPDATE trips SET origen = NULL, destino = NULL, ruta = NULL, actualizado_en = now()
WHERE ruta IS NOT NULL
  AND (estado IN ('finalizado', 'cancelado') OR salida_en < now() - make_interval(hours => $1));
DELETE FROM outbox WHERE published_at < now() - make_interval(hours => $1);
```

## Configuración (`configuration.ts` → `rides`, `osrm`, `outbox`)

| Variable | Default | Uso |
|---|---|---|
| `RIDES_EVENTS_STREAM` | `rides.events` | Ya existe; pasa de `process.env` suelto a `configuration.ts`. |
| `OSRM_URL` | `http://localhost:5000` | En compose: `http://osrm:5000`. |
| `OSRM_PROFILE` | `driving` | |
| `OSRM_TIMEOUT_MS` | `2000` | |
| `PENINSULA_BBOX` | `-90.5,19.5,-87.4,21.7` | `minLng,minLat,maxLng,maxLat`. |
| `MAX_DAYS_AHEAD` | `14` | |
| `OVERLAP_WINDOW_MIN` | `60` | |
| `ROUTE_MAX_POINTS` | `500` | Umbral para simplificar la respuesta. |
| `ROUTE_SIMPLIFY_TOLERANCE` | `0.00005` | Grados. |
| `ROUTE_RETENTION_HOURS` | `24` | US6. |
| `ROUTE_PURGE_INTERVAL_MS` | `600000` | US6. |
| `OUTBOX_INLINE` | `true` | `false` si corre `outbox-worker`. |
| `OUTBOX_POLL_MS` | `500` | |
| `OUTBOX_BATCH_SIZE` | `100` | |
| `OUTBOX_MAX_ATTEMPTS` | `10` | A partir de aquí, log `error` por intento. |

## docker-compose

- `postgres`: imagen propia `infra/postgres` (PostGIS + pgvector, ver spec 010; `postgis/postgis:17-3.5` ya no construye extensiones por apt); montar `./db/004_trips_geo_outbox.sql` como
  `04-migracion-004.sql` (antes de `09-seed.sql`).
- `osrm`: `image: ghcr.io/project-osrm/osrm-backend:v6.0.0`,
  `command: osrm-routed --algorithm mld /data/yucatan.osrm`, volumen `./infra/osrm:/data:ro`,
  puerto `5000`. Healthcheck con una ruta fija en Mérida.
- `api`: `OSRM_URL: http://osrm:5000`, `depends_on: osrm`.
- `outbox-worker` (perfil `worker`, opcional): misma imagen que `api`,
  `command: node dist/outbox-worker.main.js`; con este perfil, la API usa `OUTBOX_INLINE=false`.

`infra/osrm/prepare.sh` (una vez): descarga `mexico-latest.osm.pbf` de Geofabrik, recorta con
`osmium extract --bbox -90.5,19.5,-87.4,21.7` a `yucatan.osm.pbf` y corre `osrm-extract -p
/opt/car.lua`, `osrm-partition` y `osrm-customize` dentro del mismo contenedor de OSRM.

## Tests

No hay framework de tests en el repo; se añade Jest con `@swc/jest` (el repo ya usa swc) y
scripts `test` (unitarios) y `test:int` (Testcontainers, requiere Docker).

- `osrm.client.spec.ts`: `fetch` mockeado con fixtures reales de OSRM. Verifica la URL (`lng,lat`),
  que `geometry` viene en `[lng, lat]`, que `snapped` sale de `waypoints[].location` convertido a
  `{lat, lng}`, `NoRoute`/`NoSegment` → 422, `AbortSignal` de timeout → 503, 502 → 503.
- `create-ride.handler.spec.ts`: `OsrmClient` y `DatabaseService` mockeados. 422 y 503 sin abrir TX;
  traslape → 409 sin `INSERT`; `OutboxService.enqueue` recibe el **mismo** `PoolClient` que el
  `INSERT` de `trips`; validaciones de bbox, horizonte, 200 m y capacidad → 400; no conductor → 403.
- `rides.int-spec.ts` (`postgis/postgis`, con `schema.sql` + 002–004): crear viaje con OSRM
  mockeado, leerlo con `ST_AsGeoJSON`, fila en `outbox` con el `event_id`; dos `POST` concurrentes
  del mismo conductor con salida traslapada → uno 201 y otro 409; purga deja la geometría en `NULL`.
- `outbox-publisher.int-spec.ts` (postgis + redis): publica, marca `published_at`, `envelope` con
  la forma del contrato; dos publicadores en paralelo sobre 200 filas → 200 entradas en el stream,
  sin duplicados; Redis caído → `attempts` y `last_error` actualizados, fila sigue pendiente.
