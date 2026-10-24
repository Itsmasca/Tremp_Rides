# 009 · Autenticación: login, token y sesión

**Estado:** Implementado · **Fecha:** 2026-10-24 · **Relacionado:** spec 005 (registro), spec 004 (app móvil)

## Objetivo

Que la app móvil pueda iniciar sesión y restaurarla al abrir, sin duplicar el registro de spec 005.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Mismo body y validaciones que `POST /users` (`UsersService.create`); responde `201 { token, user }`. |
| POST | `/auth/login` | `{ correo, password }` → `200 { token, user }`; `401` "Correo o contraseña incorrectos" (mismo mensaje si el correo no existe). |
| GET | `/auth/me` | Con `Authorization: Bearer <token>` → `200 user`; `401` si falta, expiró o el usuario ya no existe. |

`user` es el mismo objeto que devuelve `GET /users/:id` (nunca incluye `password_hash`).

## Reglas

- Verificación de contraseña con `verifyPassword` de `src/users/password.ts` (scrypt, spec 005).
- JWT firmado con `JWT_SECRET`, expiración `JWT_EXPIRES_IN` (por defecto 30 días). Payload: `{ sub, tipoUsuario }`.
- `JwtAuthGuard` + `@CurrentUser()` quedan exportados para proteger rutas de otros módulos; cuando se apliquen,
  `:id` debe salir del token y no del path (riesgo aceptado en spec 005).

## Fuera de alcance

Verificación por correo, recuperación de contraseña, refresh tokens, revocación.

## Verificación

- `npx tsc --noEmit` sin errores. Pendiente probar contra Postgres con los `curl` del README del módulo.
