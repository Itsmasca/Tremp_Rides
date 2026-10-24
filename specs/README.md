# Specs

Índice único de specs. **Antes de crear una spec, reserva aquí su número** (añade la fila en el mismo PR)
para evitar colisiones. Reglas en `constitution.md`.

| # | Spec | Estado | Issue | Archivos | Notas |
|---|---|---|---|---|---|
| 001 | [Base Redis + eventos](001-redis-events/spec.md) | Implementado | #5 | spec · plan · tasks | Bus interno `trempapp:events`, DLQ, SSE, caché. |
| 002 | [Privacidad de ubicación](002-database-privacidad/spec.md) | Implementado | #6 | spec · tasks | Ubicación sólo en Redis con TTL. AC4.2 pendiente de enmienda (ver 006). |
| 003 | [Puente a EventBridge](003-eventbridge/spec.md) | Implementado | #5 | spec · plan · tasks | Deshabilitado por defecto. Despliegue de `infra/` pendiente. |
| 004 | [App móvil (Expo)](004-mobile-app/spec.md) | En desarrollo | #2 | spec · tasks | PR #11 mergeado, PR #12 abierto. |
| 005 | [CRUD de usuarios y vehículos](005-usuarios/spec.md) | Implementado | #10 | spec · plan · tasks | Catálogo de vehículos (#4). Sin auth. |
| 006 | [Publicar viaje con OSRM](006-publicar-viaje/spec.md) | Propuesto | #7 | spec · plan · tasks | Introduce PostGIS y outbox; excepción al principio 8. |
| 007 | [PostgreSQL](007-postgres/spec.md) | Implementado | #6 | spec · plan · tasks | Antes `002-postgres` (renumerada por colisión). |
| 008 | [Preferencias de viaje](008-preferencias/spec.md) | Implementado* | #8 | spec · tasks | *Spec retroactiva. Bug `solo_F` → `500` corregido; quedan T8 (espacios) y T9 (Redis caído). |

**Siguiente número libre: 009.**

## Estados

`Propuesto` (esperando aprobación) → `Aprobado` → `En desarrollo` → `Implementado` (todas las tareas
obligatorias verificadas) · `Descartado`.

## Issues sin spec

| Issue | Tema | Comentario |
|---|---|---|
| #1 | Estructura de la base de datos | Cubierto por `db/schema.sql` + 005 + 007; se puede cerrar. |
| #3 | Modelos para análisis de rutas | matching-py / Bedrock (otro repo). |
| #4 | Recuperación del conductor (precio 70/30) | Detallado en el comentario del issue. Catálogo de vehículos ya en 005; falta la spec de precios. |
| #9 | Vistas por tipo de usuario | Parcialmente en 004. |

## Pendientes transversales

- **Autenticación:** 002, 005, 006 y 008 aceptan el `id` del path o de una cabecera. Necesita su spec.
- **Enmienda del principio 8** para la retención de geometrías de viajes (solicitada por 006).
- **Datos del seed vs #4:** gasolina Magna $24 y reparto igualitario; #4 define Premium $27.39 y 70/30.
- **Tests automatizados:** ninguna spec los tiene todavía.

## Plantilla

Carpeta `specs/NNN-nombre/` con:
- `spec.md`: estado, fecha, issue; objetivo; historias con criterios `ACn.m` verificables; *Excepciones a
  la constitución* (si las hay); fuera de alcance; riesgos aceptados.
- `plan.md` (si hay decisiones técnicas): stack, decisiones con motivo, estructura de archivos.
- `tasks.md`: tareas `Tn` que referencian los AC; `[x]` sólo con la verificación descrita.
