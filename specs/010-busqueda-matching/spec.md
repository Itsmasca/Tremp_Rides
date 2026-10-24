# 010 · Búsqueda de viajes con matching-py (`POST /rides/search`)

**Estado:** En desarrollo (aprobado 2026-10-24) · **Fecha:** 2026-10-24 · **Issue:** #3 · **Relacionado:** 006 (viajes con ruta),
008 (preferencias), 009 (JWT), matching-py `specs/001-osrm-matching`

## Objetivo

La app sólo habla con crud-ts. Cuando un pasajero busca viaje, crud-ts reenvía la búsqueda a
matching-py (`POST /match`, red interna), completa los resultados con datos del viaje y del conductor
y responde a la app. Además, crud-ts expone a matching-py sus tablas con los nombres que éste espera
(vistas), para que tanto `POST /match` como el consumer de preferencias con Bedrock funcionen sin
tocar el esquema de crud-ts.

## Dependencias (bloqueantes, fuera de este repo)

| # | Qué | Dónde | Sin esto |
|---|---|---|---|
| D1 | `REDIS_URL` y `DATABASE_URL` reales en SSM (`/matching-py/*`), apuntando al **mismo** Redis y Postgres que usa crud-ts | AWS / despliegue | El contenedor de ECS no arranca. |
| D2 | `POST /match` implementado (T010–T026 de matching-py) | matching-py | crud-ts responde `503` siempre. |
| D3 | Spec 006 implementada (columnas `ruta`, `salida_en`, `max_desvio_s`… en `trips`) | crud-ts | La vista `rides` no se puede crear (migración 005 depende de 004). |

## Historias de usuario

### US1 · Buscar viaje
Como pasajero quiero indicar recogida, destino y hora para ver los viajes que me pueden llevar.

- **AC1.1** `POST /rides/search` con `Authorization: Bearer <token>` (`JwtAuthGuard`) y
  `{ pickup: {lat,lng}, dropoff: {lat,lng}, departureAt, timeWindowMin?, limit? }` → `200`
  con la forma de *Contrato de respuesta*.
- **AC1.2** `passengerId` sale del token (`@CurrentUser().sub`), nunca del body: si viene en el body,
  `whitelist` lo descarta y se usa el del token (el `ValidationPipe` global no usa `forbidNonWhitelisted`).
  Sin token o token inválido → `401`.
- **AC1.3** Validaciones → `400`, antes de llamar a matching-py:
  - `pickup` y `dropoff` dentro de `PENINSULA_BBOX` (el mismo de 006).
  - `departureAt` ISO-8601 **con zona horaria**, no más de 1 h en el pasado ni más de `MAX_DAYS_AHEAD` días en el futuro.
  - `timeWindowMin` entero 0–120, default 30. `limit` entero 1–20, default 10.
- **AC1.4** Sin viajes viables → `200` con `results: []` (no es error).
- **AC1.5** Cualquier `tipo_usuario` puede buscar; matching-py ya excluye los viajes del propio usuario.

### US2 · Llamada a matching-py
- **AC2.1** crud-ts genera `requestId` (UUID v4) por búsqueda y llama a
  `POST {MATCHING_URL}/match` con `{ requestId, passengerId, pickup, dropoff, departureAt, timeWindowMin, limit }`,
  timeout `MATCHING_TIMEOUT_MS` (default 3000). Sin reintentos.
- **AC2.2** matching-py responde `503`, `5xx`, error de red o timeout → `503` "La búsqueda no está disponible".
- **AC2.3** matching-py responde `422` (o cualquier otro `4xx`) → `502` y log `error` con el cuerpo:
  crud-ts ya validó, así que es una diferencia de contrato entre servicios, no un error del usuario.
- **AC2.4** Respuesta `200` cuyo `requestId` no coincide o que no tiene `candidates` como arreglo → `502` y log `error`.
- **AC2.5** Cada búsqueda deja un log con `requestId`, `passengerId`, nº de candidatos recibidos y
  devueltos, y la latencia de matching-py.

### US3 · Resultados completos para la app
- **AC3.1** Con los `rideId` recibidos, crud-ts hace **una** consulta a `trips` + `users` y añade a cada
  resultado `departureAt`, `seatsAvailable`, `pricePerPassenger` y `driver { id, nombre, sexo, fotoUrl }` (`sexo` para el filtro "solo conductoras" de la app;
  matching-py todavía ignora `gender_preference`).
- **AC3.2** Se descartan los candidatos cuyo viaje ya no existe, no está `pendiente` o no tiene asientos
  (cambió entre la búsqueda y la respuesta). El orden de matching-py se mantiene y `rank` se renumera desde 1.
- **AC3.3** **Privacidad:** `routeGeometry` se recorta en PostGIS al tramo recogida → bajada
  (`ST_LineSubstring` entre `snappedPickup` y `snappedDropoff`). El origen y destino del conductor nunca
  llegan al pasajero. Si matching-py manda `null`, sigue `null`.
- **AC3.4** No se devuelven `score`, `features` ni `modelVersion` a la app (`modelVersion` sólo va al log).

### US4 · Esquema compatible con matching-py
- **AC4.1** Migración `db/005_matching_views.sql` (después de 004) crea vistas de sólo lectura:
  - `rides`: `trips` con nombres en inglés (`driver_id`, `origin`, `destination`, `route`, `duration_s`,
    `distance_m`, `departure_at`, `seats_available`, `max_detour_s`, `status`), con
    `pendiente → scheduled`, `en_curso → in_progress`, `finalizado → completed`, `cancelado → cancelled`.
  - `matches`: `trip_passengers` (`ride_id`, `passenger_id`, `status`), con
    `solicitado → pending`, `aceptado → accepted`, `rechazado → rejected`, `completado → completed`.
- **AC4.2** La misma migración añade a `users` `pref_estructuradas JSONB`, `pref_estructuradas_revision INTEGER`
  y `pref_estructuradas_en TIMESTAMPTZ`, y crea la vista **actualizable** `user_preferences`
  (`user_id`, `raw_text`, `revision`, `structured`, `structured_revision`, `structured_at`).
  El `UPDATE user_preferences SET structured = …` de matching-py escribe en `users` sin cambios en su código.
- **AC4.3** La vista `rides` usa los índices de 006 (GiST en `ruta`, `salida_en`): `EXPLAIN` de la consulta
  de candidatos de matching-py muestra un escaneo de índice sobre `idx_trips_ruta_gist`.
- **AC4.4** Local: la imagen de Postgres incluye PostGIS **y** pgvector (la migración 001 de matching-py
  hace `CREATE EXTENSION vector`).

### US5 · Configuración
- **AC5.1** `MATCHING_URL` (default `http://localhost:8000`) y `MATCHING_TIMEOUT_MS` en
  `src/config/configuration.ts` y `.env.example`.
- **AC5.2** Si matching-py no está corriendo, la API arranca igual y sólo `POST /rides/search` responde `503`.

## Contrato de respuesta

```json
{
  "requestId": "uuid",
  "results": [
    {
      "rideId": "uuid",
      "rank": 1,
      "departureAt": "2026-10-26T13:30:00.000Z",
      "seatsAvailable": 2,
      "pricePerPassenger": 18.5,
      "detourS": 140,
      "pickupEtaS": 420,
      "driver": { "id": "uuid", "nombre": "Ana", "sexo": "F", "fotoUrl": null },
      "snappedPickup": { "lat": 21.0186, "lng": -89.5847 },
      "snappedDropoff": { "lat": 20.9671, "lng": -89.6237 },
      "routeGeometry": { "type": "LineString", "coordinates": [[-89.5847, 21.0186], [-89.6237, 20.9671]] }
    }
  ]
}
```

`pricePerPassenger` es `trips.precio_por_pasajero` (puede ser `null` hasta que exista la spec de precios, #4).

## Excepciones a la constitución

### Principio 17 · Identificadores en inglés salvo nombres de dominio existentes
**Qué:** las vistas `rides`, `matches` y `user_preferences` duplican con nombres en inglés tablas que en
crud-ts se llaman en español.
**Por qué:** es el contrato que matching-py ya tiene escrito (`data-model.md`); la alternativa era reescribir
sus queries o renombrar `trips`.
**Mitigación:** las vistas son la única capa de traducción; viven en una migración propia y llevan
`COMMENT ON VIEW` que dice que son para matching-py.

## Fuera de alcance

Reservar un asiento (`POST /rides/:id/join`), consumir `match.shown`, ranker aprendido, despliegue de
crud-ts en AWS, configurar SSM (D1), autenticación entre servicios.

## Riesgos aceptados

- **`/match` sin autenticación:** el contrato de matching-py supone red interna. Si crud-ts y ECS quedan en
  redes distintas (cuentas AWS distintas, como en 003), hay que añadir un secreto compartido o una VPC
  privada antes de exponerlo.
- **matching-py escribe en `users`** a través de `user_preferences`. Hoy comparten el mismo usuario de BD;
  un rol `matching_py` con `UPDATE` sólo sobre las tres columnas `pref_estructuradas*` queda pendiente.
- **Doble `match.shown`:** sin reintentos en crud-ts no se espera, pero matching-py ya documenta que sus
  consumidores deduplican por `requestId`.
