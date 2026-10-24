# 007 · Plan técnico

## Stack
PostgreSQL 17 (alpine) · `pg` (node-postgres) 8.

## Decisiones

| Decisión | Motivo |
|---|---|
| `pg` directo en vez de ORM | El esquema ya existe en SQL; consultas parametrizadas y cero overhead. |
| `docker-entrypoint-initdb.d` para schema + seed | Sin herramienta de migraciones mientras el esquema sea de demo. |
| Pool global con `max = DB_POOL_MAX` | Reutiliza conexiones; una sola instancia por proceso. |
| Health en paralelo (Redis + Postgres) | La latencia del endpoint es la del más lento, no la suma. |

## Estructura

```
db/
  schema.sql                 # DDL base (01 al iniciar)
  NNN_*.sql                  # migraciones idempotentes (02, 03… en orden)
  seed.sql                   # datos demo (09, al final)
  operaciones_comunidad.sql  # ejemplos manuales
src/database/
  database.constants.ts      # PG_POOL
  database.module.ts         # módulo global: Pool
  database.service.ts        # query, queryOne, transaction, ping
```
