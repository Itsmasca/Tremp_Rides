# 004 · App móvil Tremp (Expo)

**Estado:** en desarrollo (hackathon) · **Carpeta:** `mobile/`

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

Todo lo calcula el servidor; la app solo lo muestra y no tiene inputs para editarlo (`mobile/src/constants/pricing.ts`
replica la fórmula con los valores iniciales mientras no hay backend):

- Rendimiento fijo por categoría del catálogo: Sedán 11 km/L · SUV 9 km/L · Camioneta 7 km/L. El conductor elige su coche
  de un catálogo (`mobile/src/data/vehicles.ts`) y sube documentos para validarlo; no puede escribir el rendimiento.
- Gasolina Premium (Yucatán) $27.39/L, actualizada por el sistema; se muestra como solo lectura al conductor.
- `km = tramo conductor→recogida + recogida→destino` (calculados por el navegador en el servidor).
- `litros = km / rendimiento` → `costo = litros × precio_litro` → `pasajero = costo × 0.70` → `conductor = costo − pasajero`.
- El pasajero ve el monto y un desglose ("¿Cómo se calcula?"). Al aceptar el conductor, el monto se muestra como congelado.
- Cancelaciones: pasajero antes de arrancar → $0; pasajero a medio camino → 70% de la gasolina de los km recorridos (GPS);
  conductor → el pasajero no paga. La app lo avisa en el diálogo de cancelar.

## Reglas alineadas con el esquema (`db/schema.sql`)
- Sólo correos `@anahuac.mx` (pendiente validar en la app).
- La pregunta `solo_F` sólo se muestra cuando `sexo = 'F'`.
- La app no persiste coordenadas: el mapa usa la ubicación en vivo y datos efímeros.

## Pendiente
- [ ] Conectar login/registro/rides con la API del backend.
- [ ] Subida real de foto de perfil.
- [ ] Validar dominio `@anahuac.mx` en el formulario.
- [ ] Subida real de documentos del vehículo.
