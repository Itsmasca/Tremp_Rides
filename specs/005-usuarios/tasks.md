# 005 · Tareas

- [x] T1 Migración `db/003_vehiculo_catalogo.sql` + montar migraciones en docker-compose — *AC7.1, AC7.2*
  (verificada sobre BD vacía y sobre datos con el formato viejo: 9.2 → suv, 6.0 → camioneta; idempotente)
- [x] T2 `password.ts` (scrypt hash/verify) — *AC1.3*
- [x] T3 DTOs con validación (`@anahuac.mx`, `solo_F`, catálogo, whitelist) — *AC1.2–1.4, AC2.1, AC2.2, AC2.5, AC4.2*
- [x] T4 `UsersRepository` (insert en transacción, get, list por cursor, update, delete, vehículo) — *AC1.5, AC3.x, AC4.1, AC5.1*
- [x] T5 `UsersService`: reglas, traducción de errores PG, borrado de ubicación en Redis, eventos post-commit — *AC1.x, AC2.3, AC2.4, AC5.x, AC6.1*
- [x] T6 `UsersController` + `UsersModule` en `AppModule`
- [x] T7 Verificación manual con BD real: script de 35 casos (todos los AC, 400/404/409, cascada,
  ubicación borrada, cursor sin repetidos, eventos sin contraseña ni hash) → 35/35
- [x] T8 README (tabla de API)
- [ ] T9 Tests automatizados (convertir el script de T7 en e2e)
- [ ] T10 Autenticación (spec propio): `:id` desde el token
