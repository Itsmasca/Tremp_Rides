# 008 · Preferencias de viaje (issue #8)

**Estado:** Implementado (spec retroactiva, pendiente de revisión del responsable) · **Fecha:** 2026-10-24 ·
**Issue:** #8 · **Relacionado:** 005 (usuarios), 006 (`rides.events`)

> Esta spec documenta código que ya existía (`src/preferences/`, `db/002_add_preferences_columns.sql`)
> sin spec previa (principio 1). El responsable de #8 debe revisarla y corregir lo que no refleje su intención.

## Objetivo

Que el usuario guarde sus preferencias de viaje: la estructurada (`pref_sexo_viaje`) para filtros SQL y
un texto libre (`raw_text`) que **matching-py** procesa con Bedrock para extraer preferencias más ricas.

## Historias de usuario

### US1 · Consultar preferencias
- **AC1.1** `GET /users/:id/preferences` → `200 { userId, prefSexoViaje, rawText, revision }`; `404` si no existe.

### US2 · Actualizar preferencias
- **AC2.1** `PATCH /users/:id/preferences` con `{ rawText (1–2000), prefSexoViaje }` → `204`.
- **AC2.2** Cada actualización incrementa `users.preferences_revision` (monótono) en la misma sentencia.
- **AC2.3** `prefSexoViaje = 'solo_F'` con `sexo ≠ 'F'` → `400` (regla `chk_pref_solo_mujeres`).
- **AC2.4** Usuario inexistente → `404`.

### US3 · Integración con matching-py
- **AC3.1** Tras el `UPDATE` se publica `preferences.updated` en el stream `rides.events` con el
  envelope `{ id, type, version: 1, source: 'crud-ts', aggregateType: 'user', aggregateId, occurredAt,
  data: { userId, revision, rawText } }` en el campo `envelope`.
- **AC3.2** matching-py usa `revision` para idempotencia y orden. El contrato no cambia sin coordinarlo.

## Base de datos
`db/002_add_preferences_columns.sql`: `users.raw_text TEXT`, `users.preferences_revision INTEGER NOT NULL DEFAULT 0`.

## Excepciones a la constitución

| Principio | Excepción | Motivo / salida |
|---|---|---|
| 5 · Redis Streams interno como fuente de verdad | `preferences.updated` va a `rides.events`, no a `trempapp:events` | Contrato con matching-py (mismo criterio que la spec 006). |
| 12 · Configuración en `configuration.ts` | `RIDES_EVENTS_STREAM` se lee de `process.env` en el servicio | Temporal: la spec 006 (T3) lo mueve a config. |

## Defectos conocidos
- ~~AC2.3: `solo_F` con `sexo = 'M'` respondía `500`~~ → corregido (tasks T4).
- `rawText` sólo con espacios se acepta (tasks T8).
- Con Redis caído el `PATCH` se cuelga y puede perder el evento (tasks T9).

## Fuera de alcance
Extracción con Bedrock (matching-py), outbox transaccional (el evento se pierde si el proceso cae entre
el `UPDATE` y el `XADD`).
