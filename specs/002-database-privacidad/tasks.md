# 002 · Tareas

- [x] T1 `SetLocationDto` (lat/lng validados, `ttlSeconds` 1..86400) — *AC1.2, AC1.3*
- [x] T2 `LocationService` sobre `RedisService` (`setJson` con TTL / `getJson` / `del`) — *AC1.1, AC1.4, AC2.1*
- [x] T3 `LocationController` `PUT/GET/DELETE /location/:userId` — *AC2.2, AC3.1*
- [x] T4 Config `location.ttlSeconds` desde `LOCATION_TTL_SEGUNDOS` + `.env.example`
- [x] T5 Documentar la key en `db/redis_keys.md` — *AC4.3*
- [x] T6 Verificación manual (2026-10-24): `PUT` → `200` con TTL 1799 s; `lat: 91` → `400`; `GET` → `200`;
  `DELETE` → `204` y luego `404`; `ttlSeconds: 1` → `404` a los 2 s; key inexistente → `404`;
  `src/location/` no usa `DatabaseService` — *AC1.x–AC4.1*
- [ ] T7 Tests automatizados
- [ ] T8 Cuando exista auth: `userId` desde el token, no del path
