# 008 · Tareas

- [x] T1 Migración `db/002_add_preferences_columns.sql` (montada en docker-compose)
- [x] T2 `PreferencesRepository` / `PreferencesService` / `PreferencesController`
- [x] T3 Verificación manual (2026-10-24): `GET` → `200`; `PATCH` → `204` y `revision` 0 → 1; usuario
  inexistente → `404`; evento `preferences.updated` en `rides.events` con el envelope esperado
  — *AC1.1, AC2.1, AC2.2, AC2.4, AC3.1*
- [x] T4 Bug: traducir `chk_pref_solo_mujeres` a `400` en `PreferencesRepository` — *AC2.3*
  (verificado: `solo_F` con `M` → `400`, sin subir `revision` ni publicar evento; con `F` → `204`)
- [ ] T5 Leer `RIDES_EVENTS_STREAM` desde `configuration.ts` (lo cubre la spec 006, T3)
- [ ] T6 Revisión de esta spec por el responsable de #8
- [ ] T7 Tests automatizados
- [ ] T8 Rechazar `rawText` sólo con espacios (`@Transform(trim)` + `@IsNotEmpty`): hoy se guarda `"    "`
  y se envía a matching-py
- [ ] T9 Con Redis caído el `PATCH` se queda colgado (ioredis encola el `XADD`) y el cliente recibe timeout
  aunque Postgres ya guardó el cambio; si Redis no vuelve, el evento se pierde. Se resuelve con el outbox
  de la spec 006

## Prueba exploratoria (2026-10-24)

| Caso | Resultado |
|---|---|
| UUID inválido, sin `rawText`, vacío, 2001 caracteres, enum inválido, número, JSON roto | `400` ✅ |
| `rawText` de 2000 caracteres | `204` ✅ |
| Campo extra `revision: 999` | Se descarta; la revisión sigue en +1 ✅ |
| Inyección SQL en `rawText` | Se guarda literal, tabla intacta ✅ |
| Unicode / emoji (UTF-8) | Ida y vuelta exacta ✅ |
| Usuario inexistente (`GET` / `PATCH`) | `404` ✅ |
| 20 `PATCH` concurrentes | Revisiones 6..25 sin huecos ni repetidas, 20 eventos ✅ (el orden en el stream puede no seguir `revision`; matching-py ordena por `revision`, AC3.2) |
| `PATCH` parcial (sólo `prefSexoViaje`) | `400`: los dos campos son obligatorios aunque sea `PATCH` (decisión de diseño, no bug) |
| `rawText` sólo espacios | `204` y se guarda ⚠️ → T8 |
| Redis detenido durante el `PATCH` | Cliente: timeout; BD: guardado; evento: llega al volver Redis ⚠️ → T9 |
