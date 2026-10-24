# 004 · App móvil Tremp (Expo)

**Estado:** En desarrollo (hackathon) · **Carpeta:** `mobile/`

## Objetivo

App nativa (React Native + Expo Router) para estudiantes de la Anáhuac Mayab que ofrecen o buscan
ride casa → universidad. Es el cliente del backend de este repo; hoy usa datos de prueba
(`mobile/src/data/rides.ts`) hasta conectar la API.

## Pantallas

| Ruta | Pantalla | Comportamiento |
|---|---|---|
| `/` | Login | Correo institucional + contraseña. `Entrar` → `/home`. |
| `/register` | Registro | Nombre, correo, contraseña, foto (UI). Sexo (Hombre/Mujer). Si Mujer: pregunta "¿solo viajes de conductoras?" (`pref_sexo_viaje = solo_F`). ¿Tienes vehículo? Si sí: tipo (Sedan/SUV/Camioneta) y el usuario queda como `conductor`; si no, `pasajero`. |
| `/home` | Home | Vista fija según `tipo_usuario`, estilo Uber/DiDi: mapa a pantalla completa + panel inferior. |

### Home · pasajero
Ruta "Tu ubicación → Anáhuac Mayab", filtros (Todos / Solo conductoras / Más barato / Llega antes),
lista de rides seleccionables y botón "Pedir lugar". Tras pedir: estado "esperando confirmación" con cancelar.

### Home · conductor
Desconectado: botón "IR". Conectado: publica viaje (hora, precio por lugar, lugares) y recibe
solicitudes que acepta/rechaza hasta llenar la capacidad.

## Precio del viaje (issue #4)

La app muestra únicamente el monto final que paga el pasajero; no explica la fórmula ni expone inputs de precio.
Mientras no hay backend, `mobile/src/constants/pricing.ts` replica el cálculo del issue (km ÷ rendimiento por categoría
× gasolina Premium × 70%) con los valores iniciales. El conductor solo elige hora de salida y lugares.

## Reglas alineadas con el esquema (`db/schema.sql`)
- Sólo correos `@anahuac.mx` (validado en el formulario y en el backend).
- La pregunta `solo_F` sólo se muestra cuando `sexo = 'F'`.
- La app no persiste coordenadas: el mapa usa la ubicación en vivo y datos efímeros.

## Integración con el backend: sesión (2026-10-24)

Login y registro conectados con la spec 009 (`/auth/*`) en el PR #16. Rides, precios y foto siguen con datos de prueba.

- **AC-I1** Cliente HTTP único (`mobile/src/api/http.ts`). URL base en `src/constants/api.ts`: `EXPO_PUBLIC_API_URL`
  (de `mobile/.env`) o, si no está, la URL de Cloudflare por defecto. Timeout de 15 s. Al usuario sólo se le muestran
  mensajes en español por código HTTP; el detalle técnico va a la consola.
- **AC-I2** Registro → `POST /auth/register` (`src/api/auth.ts`) con el mapeo `hombre/mujer` → `M/F`,
  `Sedan/SUV/Camioneta` → `sedan/suv/camioneta`, `womenOnly` → `prefSexoViaje: 'solo_F'`. La capacidad del vehículo
  se envía fija (`DEFAULT_SEATS`, máximo 3 lugares por decisión del PR #15).
- **AC-I3** Validación en el formulario (`src/utils/validation.ts`): correo `@anahuac.mx` y contraseña ≥ 8;
  `409` → "Ese correo ya está registrado".
- **AC-I4** Login → `POST /auth/login`; `401` → "Correo o contraseña incorrectos".
- **AC-I5** *(pendiente)* Persistir el token (`expo-secure-store`; web: `localStorage`) y restaurar la sesión al abrir
  la app con `GET /auth/me`. Hoy el token vive sólo en memoria y `me()` existe pero no se llama.
- **AC-I6** El usuario de la API llena el store (`toAppUser`); el home decide conductor/pasajero con `tipoUsuario`.
- **AC-I7** *(pendiente)* Cerrar sesión debe borrar token y store; hoy sólo vuelve al login.
- **AC-I8** Botones con estado de carga y deshabilitado (sin doble envío).
- **AC-I9** Backend: CORS para el cliente web de Expo, orígenes en `CORS_ORIGINS` (por defecto
  `http://localhost:8081`), métodos `GET/HEAD/POST/PUT/PATCH/DELETE`. La app nativa no lo necesita.
- **AC-I10** `scripts/mobile-vm.sh <url-cloudflare>` arranca la app local contra el backend de la VM: verifica
  requisitos, `/health` (incluidas Redis/Postgres), que exista `/auth/login` y CORS para web; escribe
  `EXPO_PUBLIC_API_URL` en `mobile/.env` (ignorado por git); instala dependencias si hace falta y arranca Expo
  (`--web`, `--tunnel`, `--check`…). Cada fallo da un mensaje con la causa probable y sale con código ≠ 0.

## Pendiente
- [ ] Conectar rides con la API (spec 006).
- [ ] Subida real de foto de perfil.
