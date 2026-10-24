# Keys de Redis (Trempapp)

Todas las keys llevan el prefijo configurable `REDIS_PREFIX` (por defecto `trempapp:`),
que `RedisService` antepone automáticamente. En esta tabla se muestran **sin** el prefijo.

| Key | Tipo | TTL | Escrita por | Descripción |
|---|---|---|---|---|
| `ubicacion_actual:{userId}` | string (JSON) | **sí** (`LOCATION_TTL_SEGUNDOS`, def. 1800s) | `LocationService` | Ubicación efímera del usuario. **Nunca se persiste en PostgreSQL.** |
| `cache:{key}` | string (JSON) | opcional (`ttl` por petición) | `CacheController` | Caché genérico JSON. |

> Las keys de eventos (Redis Streams / Pub-Sub del feature `001-redis-events`) viven bajo
> `trempapp:events*` y están documentadas aparte en ese feature; no se listan aquí.

## `ubicacion_actual:{userId}` — ubicación efímera

Regla de negocio no negociable: **la ubicación del usuario NUNCA se guarda en PostgreSQL.**
Vive solo en Redis con TTL y "se reinicia" sola al expirar (privacidad por diseño). En Postgres
solo existe `trips.distancia_km` (un número), nunca coordenadas ni origen/destino real.

- **Key:** `ubicacion_actual:{userId}` (más el prefijo global).
- **Valor (JSON):**
  ```json
  { "lat": 19.4326, "lng": -99.1332, "actualizadaEn": 1750000000000 }
  ```
  - `lat` / `lng`: coordenadas validadas (`@IsLatitude` / `@IsLongitude`).
  - `actualizadaEn`: epoch en ms del momento de registro.
- **TTL:** `LOCATION_TTL_SEGUNDOS` (default `1800` = 30 min). Se puede sobrescribir por petición
  con `ttlSeconds` en el body. Al expirar, la key desaparece y `GET` devuelve `404`.

### Endpoints (`src/location/`)

| Método | Ruta | Efecto |
|---|---|---|
| `PUT` | `/location/:userId` | Guarda/renueva la ubicación con TTL. Devuelve el valor almacenado. |
| `GET` | `/location/:userId` | Devuelve la ubicación vigente, o `404` si expiró / nunca existió. |
| `DELETE` | `/location/:userId` | Borrado explícito ("dejar de compartir"). `204`. |

> Nota: hoy `:userId` viaja por la ruta sin autenticación. Cuando exista la capa de auth,
> el usuario debe tomarse del token y no del path.
