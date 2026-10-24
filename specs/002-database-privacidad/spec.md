# 002 · Privacidad de ubicación (ubicación efímera en Redis)

**Estado:** Implementado · **Fecha:** 2026-10-24

## Objetivo

Gestionar la ubicación del usuario como dato **efímero**: vive únicamente en Redis con TTL
y nunca se persiste en PostgreSQL. Es un requisito de producto no negociable derivado de que
Trempapp es una comunidad cerrada de carpooling universitario: compartir ubicación debe ser
temporal y "olvidarse" solo.

## Regla de negocio (no negociable)

- La ubicación del usuario **NUNCA** se escribe en PostgreSQL: ni coordenadas, ni origen,
  ni destino reales.
- En PostgreSQL solo existe `trips.distancia_km` (un número), como rastro agregado sin
  capacidad de reconstruir la ruta.
- La ubicación vive solo en Redis con TTL y expira sola (privacidad por diseño).

## Historias de usuario

### US1 · Compartir ubicación temporalmente
- **AC1.1** `PUT /location/:userId` con `{ lat, lng }` guarda la ubicación en Redis bajo
  la key `ubicacion_actual:{userId}` con TTL `LOCATION_TTL_SEGUNDOS` (default 1800s = 30 min).
- **AC1.2** El body admite `ttlSeconds` opcional (1..86400) para sobrescribir el TTL por petición.
- **AC1.3** `lat` y `lng` se validan como latitud/longitud; un valor inválido responde `400`.
- **AC1.4** La respuesta incluye `{ lat, lng, actualizadaEn }` (epoch ms de registro).

### US2 · Consultar la ubicación vigente
- **AC2.1** `GET /location/:userId` devuelve la ubicación mientras no haya expirado.
- **AC2.2** Si la key expiró o nunca existió, responde `404` (no se distingue uno de otro).

### US3 · Dejar de compartir
- **AC3.1** `DELETE /location/:userId` borra la key de inmediato y responde `204`.
- **AC3.2** Al expirar el TTL, la key desaparece sin intervención; un `GET` posterior da `404`.

### US4 · Privacidad por diseño
- **AC4.1** Ningún código del módulo `location` escribe en PostgreSQL (`DatabaseService`).
- **AC4.2** El esquema `db/schema.sql` no contiene columnas de coordenadas ni de ubicación;
  el único dato geográfico derivado es `trips.distancia_km`.
- **AC4.3** La key y su contrato están documentados en `db/redis_keys.md`.

## Diseño

```
src/location/
  dto/set-location.dto.ts   # lat (@IsLatitude), lng (@IsLongitude), ttlSeconds? opcional
  location.service.ts       # setJson/getJson/del sobre ubicacion_actual:{userId} (Redis + TTL)
  location.controller.ts    # PUT / GET / DELETE  /location/:userId
  location.module.ts        # controller + service (RedisModule es @Global)
```

- Config: `location.ttlSeconds` en `src/config/configuration.ts`, desde `LOCATION_TTL_SEGUNDOS`.
- Almacenamiento: `RedisService.setJson(key, value, ttl)` / `getJson` / `del`. El prefijo global
  (`REDIS_PREFIX`) lo antepone `RedisService`.
- Valor almacenado: `{ lat, lng, actualizadaEn }`.

## Fuera de alcance

- Autenticación: hoy `:userId` viaja por la ruta; cuando exista auth, el usuario debe salir
  del token, no del path.
- Historial o rastreo de posiciones (prohibido por la regla de privacidad).
- Geocoding, cálculo de rutas y matching (algoritmo de Bedrock, de otro compañero).
- Persistencia relacional de usuarios/viajes (ver `specs/002-postgres/`).
