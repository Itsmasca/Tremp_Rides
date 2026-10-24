# 006 · Publicar viaje con ruta OSRM (`POST /rides`)

**Estado:** Aprobado · **Fecha:** 2026-10-24 · **Relacionado:** 001 (eventos), 002 (privacidad), 005 (usuarios)

## Objetivo

El conductor publica un viaje: el backend calcula la ruta con OSRM, la guarda como geometría
PostGIS en `trips`, encola `ride.created` en la **misma transacción** (outbox) y devuelve la ruta
para que la app la dibuje. matching-py consume `ride.created` de `rides.events` para el matching
proactivo y usa la geometría (`ST_DWithin` sobre índice GiST).

## Historias de usuario

### US1 · Publicar un viaje
Como conductor quiero publicar mi viaje para que otros alumnos puedan unirse.

- **AC1.1** `POST /rides` con
  `{ origin: {lat,lng}, destination: {lat,lng}, departureAt, seatsTotal, maxDetourMin? }`
  responde `201` con el viaje (forma en *Contrato de respuesta*).
- **AC1.2** El conductor sale del usuario autenticado (`@CurrentUser()`), nunca del body.
  Un `driverId` en el body se rechaza (`400`, por `whitelist`). Sin usuario → `401`.
- **AC1.3** El usuario debe ser `tipo_usuario = 'conductor'` con vehículo; si no, `403`.
- **AC1.4** Validaciones → `400`:
  - `lat`/`lng` de origen y destino dentro de `PENINSULA_BBOX` (`minLng,minLat,maxLng,maxLat`).
  - `departureAt` ISO-8601, en el futuro y a menos de `MAX_DAYS_AHEAD` días (default 14).
  - `seatsTotal` entero 1–6 y no mayor que `vehicles.capacidad` del conductor.
  - `maxDetourMin` entero 0–30, default 10.
  - Origen y destino separados más de 200 m (haversine).
- **AC1.5** Un conductor no puede tener dos viajes `pendiente` con `salida_en` a menos de
  `OVERLAP_WINDOW_MIN` minutos (default 60) entre sí → `409`. La comprobación es segura ante
  peticiones concurrentes del mismo conductor.
- **AC1.6** Se persisten los puntos **ajustados** por OSRM (`waypoints[].location`) como
  `origen`/`destino`; los puntos originales del usuario no se guardan.
- **AC1.7** `seatsAvailable` empieza igual a `seatsTotal`; `maxDetourS = maxDetourMin * 60`.

### US2 · Cálculo de ruta con OSRM
- **AC2.1** La ruta se pide a `GET {OSRM_URL}/route/v1/{OSRM_PROFILE}/{lng,lat;lng,lat}`
  con `overview=full&geometries=geojson&steps=false` y timeout `OSRM_TIMEOUT_MS` (default 2000).
- **AC2.2** OSRM responde `NoRoute` o `NoSegment` (punto sin calle cercana) → `422`
  "No hay ruta entre esos puntos".
- **AC2.3** Timeout, error de red o `5xx` de OSRM → `503`. Sin reintentos en la petición.
- **AC2.4** La llamada a OSRM ocurre **antes** de abrir la transacción (no se retienen locks
  durante I/O de red).
- **AC2.5** En BD se guarda siempre la geometría completa. Si la ruta supera `ROUTE_MAX_POINTS`
  puntos, la **respuesta** devuelve una versión simplificada (`ST_SimplifyPreserveTopology`).

### US3 · Consultar un viaje
- **AC3.1** `GET /rides/:id` → `200` con la misma forma que AC1.1. Sólo el conductor del viaje
  puede verlo por ahora; para cualquier otro usuario o id inexistente → `404`
  (qué ven los pasajeros lo define la spec de búsqueda/matches).
- **AC3.2** Si la geometría ya fue purgada (US6), `origin`, `destination`, `snapped*` y `route`
  vienen en `null`; el resto de campos se mantiene.

### US4 · Mis viajes
- **AC4.1** `GET /rides/mine?status=&limit=&after=` lista los viajes del conductor autenticado,
  **sin** `route` ni coordenadas, paginada por cursor (orden `salida_en DESC, id DESC`;
  `limit` 1–100, default 20) → `{ items, nextCursor }`.
- **AC4.2** `status ∈ { scheduled, in_progress, completed, cancelled }`, opcional.

### US5 · Evento `ride.created` (outbox)
- **AC5.1** En UNA transacción: lock del conductor, comprobación de traslape, `INSERT` en `trips`
  e `INSERT` en `outbox`. Si algo falla, no queda ni viaje ni evento.
- **AC5.2** Un publicador lee `outbox` pendiente (`FOR UPDATE SKIP LOCKED`), hace `XADD` a
  `RIDES_EVENTS_STREAM` (`rides.events`) con el campo `envelope` (JSON) y marca `published_at`.
  Si falla, incrementa `attempts` y guarda `last_error`; la fila se reintenta en la siguiente vuelta.
- **AC5.3** Dos publicadores concurrentes no publican la misma fila dos veces en condiciones normales.
  La entrega es **al menos una vez**: `envelope.id` (= `outbox.event_id`) es la clave de
  deduplicación para matching-py.
- **AC5.4** El publicador corre dentro de la API (`OUTBOX_INLINE=true`) o como proceso aparte
  (`node dist/outbox-worker.main.js`); ambos se apagan limpio (principio 16).
- **AC5.5** Una fila con `attempts >= OUTBOX_MAX_ATTEMPTS` se sigue reintentando pero se registra
  como `error` en cada intento (fallar visible, principio 7).

### US6 · Retención de la geometría (mitigación de privacidad)
- **AC6.1** Un job periódico (`ROUTE_PURGE_INTERVAL_MS`) pone en `NULL` `origen`, `destino` y `ruta`
  de los viajes `finalizado`/`cancelado`, o cuya `salida_en` sea anterior a
  `now() - ROUTE_RETENTION_HOURS` (default 24). Sólo quedan `distancia_km`, `distancia_m`, `duracion_s`.
- **AC6.2** El mismo job borra filas de `outbox` publicadas hace más de `ROUTE_RETENTION_HOURS`
  (el payload lleva coordenadas).
- **AC6.3** El job es idempotente; correrlo en varias instancias a la vez no rompe nada.

### US7 · Base de datos e infraestructura local
- **AC7.1** Migración `db/004_trips_geo_outbox.sql`: `CREATE EXTENSION IF NOT EXISTS postgis`,
  columnas nuevas en `trips`, tabla `outbox`, índices y `CHECK` (ver plan). Filas existentes de
  `trips` migradas sin perder datos.
- **AC7.2** `docker-compose.yml` usa `postgis/postgis` en lugar de `postgres`, monta la migración 004
  y añade el servicio `osrm` sirviendo el grafo de Yucatán desde `infra/osrm/`.
- **AC7.3** Toda la configuración nueva está en `src/config/configuration.ts` y en `.env.example`.

## Contrato de respuesta

```json
{
  "id": "uuid",
  "status": "scheduled",
  "origin": { "lat": 21.0, "lng": -89.6 },
  "destination": { "lat": 21.0, "lng": -89.6 },
  "snappedOrigin": { "lat": 21.0, "lng": -89.6 },
  "snappedDestination": { "lat": 21.0, "lng": -89.6 },
  "departureAt": "2026-10-25T13:00:00.000Z",
  "seatsTotal": 3,
  "seatsAvailable": 3,
  "maxDetourS": 600,
  "distanceM": 8420.5,
  "durationS": 912.3,
  "route": { "type": "LineString", "coordinates": [[-89.6, 21.0]] }
}
```

Como los originales no se persisten (AC1.6), `origin`/`destination` son iguales a
`snappedOrigin`/`snappedDestination`. Se mantienen los dos pares para no romper el contrato de la app.

`status` se traduce del enum `estado_viaje`: `pendiente → scheduled`, `en_curso → in_progress`,
`finalizado → completed`, `cancelado → cancelled`.

## Evento `ride.created` v1

Campo `envelope` del `XADD` en `rides.events` (mismo formato que `preferences.updated`):

```json
{
  "id": "uuid", "type": "ride.created", "version": 1, "source": "crud-ts",
  "aggregateType": "ride", "aggregateId": "<trip id>", "occurredAt": "ISO-8601",
  "data": {
    "rideId": "uuid", "driverId": "uuid",
    "origin": { "lat": 0, "lng": 0 }, "destination": { "lat": 0, "lng": 0 },
    "departureAt": "ISO-8601", "seatsAvailable": 3, "maxDetourS": 600,
    "distanceM": 0, "durationS": 0
  }
}
```

El contrato se comparte con matching-py: no se cambia sin coordinarlo (mismo criterio que
`preferences.types.ts`). La ruta no viaja en el evento: matching-py la lee de `trips.ruta`.

## Excepciones a la constitución

### Principio 8 · "La ubicación nunca es permanente"
**Qué se viola:** `trips` guarda `origen`, `destino` (puntos ajustados) y `ruta` como geometría
PostGIS, y `outbox.payload` guarda origen/destino.

**Por qué:** matching-py necesita consultar rutas de viajes publicados con `ST_DWithin` sobre un
índice GiST, y un viaje se publica hasta `MAX_DAYS_AHEAD` días antes; una key de Redis con TTL
no da consultas espaciales indexadas sobre la línea ni sobrevive a ese horizonte.

**Mitigación:**
- Se guarda sólo la ruta de un viaje **publicado por el conductor**, no la ubicación en vivo de
  nadie; `ubicacion_actual:{id}` sigue sólo en Redis (spec 002 intacta).
- Retención acotada (US6): la geometría se borra al terminar/cancelar o `ROUTE_RETENTION_HOURS`
  después de la salida; el outbox publicado también.
- Los puntos originales del usuario no se guardan nunca (AC1.6).
- `GET /rides/:id` sólo lo ve el conductor (AC3.1).

**Seguimiento:** enmendar el principio 8 (y AC4.2 de la spec 002) en un PR propio para recoger
esta regla de retención; hasta entonces rige esta excepción.

## Fuera de alcance

Búsqueda (`/rides/search`) y matches, cancelación y edición de viajes, notificaciones push,
cálculo de precio (`precio_total`, issue #4), login/JWT real.

## Riesgos aceptados

- **Autenticación simulada:** no hay JWT (spec 005). `@CurrentUser()` lee la cabecera `x-user-id`
  (UUID de un usuario existente). Cualquiera puede publicar en nombre de otro. Bloqueante antes
  de producción; cuando exista auth, sólo cambia el decorador.
- **Coordenadas en `rides.events`:** el stream conserva eventos hasta `MAXLEN` (~200 000), más allá
  de `ROUTE_RETENTION_HOURS`. Recortar por tiempo podría tirar eventos que matching-py no ha leído.
- **OSRM obligatorio:** sin OSRM, `POST /rides` responde `503`. El grafo hay que prepararlo una vez
  (ver plan); `docker compose up` no lo descarga solo.
