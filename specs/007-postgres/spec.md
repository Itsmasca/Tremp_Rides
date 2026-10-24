# 007 · Integración PostgreSQL (`db/`)

**Estado:** Implementado · **Fecha:** 2026-10-24 · **Issue:** #6 · *(antes `002-postgres`; renumerada por colisión)*

## Objetivo

Integrar el esquema relacional de `db/` (usuarios, vehículos, viajes, pagos, historial de confianza)
en el entorno local y en el backend, como almacén de datos permanentes junto a Redis.

## Historias de usuario

### US1 · Base de datos local reproducible
- **AC1.1** `docker compose up -d postgres` levanta PostgreSQL 17 aplicando automáticamente la primera vez
  (volumen vacío), en orden: `db/schema.sql`, las migraciones `db/NNN_*.sql` y `db/seed.sql`.
- **AC1.2** Los datos persisten en el volumen `pg-data`; `docker compose down -v` reinicia la BD desde cero.
- **AC1.3** `db/operaciones_comunidad.sql` **no** se ejecuta al iniciar: son consultas de ejemplo
  (incluye `DELETE`) para ejecutar a mano.

### US2 · Acceso desde el backend
- **AC2.1** `DatabaseModule` global expone un `Pool` (`PG_POOL`) y `DatabaseService`
  (`query`, `queryOne`, `transaction`).
- **AC2.2** Toda la conexión se configura por entorno (`DB_*`) en `src/config/configuration.ts`.
- **AC2.3** Errores de clientes inactivos se registran sin tumbar el proceso; el pool se recupera solo.
- **AC2.4** El pool se cierra en `OnApplicationShutdown`.

### US3 · Operación
- **AC3.1** `GET /health` incluye `postgres: { status, latencyMs }`; responde `503` si Redis **o** PostgreSQL caen.

## Fuera de alcance
Migraciones versionadas, ORM, endpoints de dominio (usuarios, viajes), `db/redis_keys.md` (vacío).
