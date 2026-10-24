# 005 · Plan técnico

## Stack
`pg` (`DatabaseService`, spec 007) · class-validator · `node:crypto` (scrypt).

## Decisiones

| Decisión | Motivo |
|---|---|
| Hash con `scrypt` de `node:crypto` (formato `scrypt$N$r$p$salt$hash`) | Sin dependencias nativas (la imagen es Alpine); KDF resistente a fuerza bruta. Comparación con `timingSafeEqual`. |
| Catálogo de vehículos como tabla `vehicle_catalogo` (`categoria` PK, `rendimiento_km_l`) | El rendimiento queda fijo en BD (#4: "el conductor no puede cambiarlo") y se puede ajustar sin desplegar código. `vehicles.rendimiento_km_l` se elimina y se lee por JOIN. |
| `ON CONFLICT`/código `23505` → `409`; `23514` (CHECK) → `400` | La BD es la última barrera (principio 10); los errores se traducen a HTTP en un solo lugar. |
| Paginación por cursor (`creado_en, id`) | O(log n) con índice; sin `OFFSET` (principio 3). |
| Eventos después del `COMMIT` | No publicar cambios que podrían deshacerse con `ROLLBACK`. |
| Repositorio separado del servicio | Mismo patrón que `src/preferences/`. |

## Estructura

```
db/
  003_vehiculo_catalogo.sql       # vehicle_catalogo + vehicles.categoria
src/users/
  dto/create-user.dto.ts          # + VehicleDto anidado
  dto/update-user.dto.ts
  dto/list-users.query.ts
  password.ts                     # hash/verify con scrypt
  users.repository.ts             # SQL parametrizado
  users.service.ts                # reglas, transacciones, eventos
  users.controller.ts             # /users, /users/:id, /users/:id/vehicle
  users.module.ts
```

## Respuesta de usuario

```json
{
  "id": "uuid", "nombre": "Demo Uno", "correo": "demo1@anahuac.mx", "sexo": "F",
  "tipoUsuario": "conductor", "verificado": false, "prefSexoViaje": "solo_F",
  "fotoUrl": null, "creadoEn": "2026-10-24T18:00:00.000Z",
  "vehiculo": { "categoria": "sedan", "marca": "Nissan", "modelo": "Versa", "capacidad": 4, "rendimientoKmL": 11 }
}
```

## Mapeo con la app móvil
`hombre/mujer` → `M/F` · `Sedan/SUV/Camioneta` → `sedan/suv/camioneta` · `womenOnly` → `prefSexoViaje = solo_F`.
