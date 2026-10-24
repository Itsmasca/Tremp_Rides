# 005 · CRUD de usuarios y vehículos (issue #10)

**Estado:** Implementado · **Fecha:** 2026-10-24 · **Issue:** #10 (relacionado: #4, #8)

## Objetivo

Exponer en la API la gestión de la comunidad (alumnos `@anahuac.mx`): registro, consulta,
actualización y baja de usuarios, y el alta del vehículo del conductor según el catálogo del issue #4.
Es lo que necesita el registro de la app móvil (`mobile/src/app/register.tsx`, spec 004) para dejar
de guardar el usuario sólo en memoria.

## Historias de usuario

### US1 · Registro
Como alumno quiero registrarme con mi correo institucional para usar Trempapp.

- **AC1.1** `POST /users` con `{ nombre, correo, password, sexo, prefSexoViaje?, vehiculo? }` responde
  `201` con el usuario creado (sin `password_hash`).
- **AC1.2** `correo` debe ser `@anahuac.mx` (se normaliza a minúsculas); si no, `400`.
  Si ya existe, `409`.
- **AC1.3** `password` de 8 a 128 caracteres; se guarda sólo su hash (nunca en claro, nunca en logs
  ni en respuestas).
- **AC1.4** `prefSexoViaje = 'solo_F'` sólo se acepta con `sexo = 'F'`; si no, `400`. Por defecto `cualquiera`.
- **AC1.5** Con `vehiculo` el usuario queda `tipo_usuario = 'conductor'`; sin él, `pasajero`.
  Usuario y vehículo se crean en una sola transacción.
- **AC1.6** `verificado` siempre empieza en `false` (la verificación por correo es otra feature).

### US2 · Vehículo con catálogo (issue #4)
- **AC2.1** `vehiculo = { categoria, capacidad, marca?, modelo? }` con `categoria ∈ { sedan, suv, camioneta }`.
- **AC2.2** El rendimiento **no lo envía el conductor**: sale del catálogo (sedán 11, SUV 9,
  camioneta 7 km/L). Un `rendimientoKmL` en el body se descarta (`whitelist` global) y se usa el del catálogo.
- **AC2.3** `PUT /users/:id/vehicle` crea o reemplaza el vehículo y pasa al usuario a `conductor`.
- **AC2.4** `DELETE /users/:id/vehicle` borra el vehículo y pasa al usuario a `pasajero` (`204`).
- **AC2.5** `capacidad` entre 1 y 8.

### US3 · Consulta
- **AC3.1** `GET /users/:id` → `200` con usuario + vehículo (si tiene), o `404`.
- **AC3.2** `GET /users?tipo=&verificado=&limit=&after=` lista paginada por cursor
  (orden `creado_en, id`; `limit` 1–100, por defecto 20) → `{ items, nextCursor }`.

### US4 · Actualización
- **AC4.1** `PATCH /users/:id` permite cambiar `nombre` y `fotoUrl` → `200` con el usuario.
- **AC4.2** `correo`, `password`, `sexo`, `tipo_usuario` y `verificado` **no** se cambian aquí
  (el tipo cambia sólo vía vehículo; las preferencias vía `/users/:id/preferences`, #8).

### US5 · Baja
- **AC5.1** `DELETE /users/:id` → `204`; vehículo, viajes, pasajes e historial se borran en cascada
  (`ON DELETE CASCADE`). La ubicación efímera en Redis (`ubicacion_actual:{id}`) también se borra.
- **AC5.2** Borrar un usuario inexistente → `404`.

### US6 · Eventos
- **AC6.1** Tras confirmar la transacción se publica en el bus (`EventsService`, spec 001):
  `user.registered`, `user.updated`, `user.deleted`, `vehicle.updated`, `vehicle.removed`,
  con `{ userId }` y los campos cambiados. Nunca el hash ni la contraseña.

### US7 · Base de datos
- **AC7.1** Migración `db/003_vehiculo_catalogo.sql`: columna `vehicles.categoria` y el rendimiento
  tomado del catálogo; datos existentes migrados.
- **AC7.2** Las migraciones de `db/` (`002_…`, `003_…`) se aplican al iniciar Postgres en
  docker-compose, después de `schema.sql` y antes de `seed.sql`.

## Fuera de alcance
Login / sesiones / JWT, verificación por correo, subida de foto a S3 (sólo se guarda la URL),
roles de administrador, preferencias (#8), outbox transaccional para eventos.

## Riesgos aceptados
- **Sin autenticación:** igual que `/location/:userId`, cualquiera con el `id` puede modificar o
  borrar un usuario. Aceptable para la demo; bloqueante antes de producción. Cuando haya auth,
  `:id` sale del token.
- **Eventos best-effort:** si el proceso cae entre el `COMMIT` y la publicación, el evento se pierde.
