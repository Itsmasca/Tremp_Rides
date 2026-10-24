# Constitución del proyecto

Principios no negociables. Todo spec, plan y PR se valida contra ellos.

**Versión:** 2.1 · **Última enmienda:** 2026-10-24

## Proceso

1. **Spec primero.** Ninguna funcionalidad se implementa sin `specs/NNN-nombre/spec.md` aprobado.
   El código sigue al spec; si el código cambia el comportamiento, el spec se actualiza en el mismo PR.
   El número `NNN` se reserva en el índice `specs/README.md` antes de crear la carpeta; los números
   no se reutilizan ni se repiten.
2. **Verificar antes de cerrar.** Una tarea sólo se marca `[x]` en `tasks.md` cuando se ha comprobado
   contra sus AC (manual o automatizado), y la verificación queda descrita en la propia tarea.
   Lo no verificado se dice explícitamente.

## Rendimiento

3. **Rendimiento por defecto.** Fastify como HTTP adapter, auto-pipelining en Redis, lotes (`COUNT`,
   `PutEvents` de hasta 10) y operaciones O(1)/O(log n). Nada de `KEYS`, `SCAN` en hot path, ni bucles
   con `await` por elemento cuando se puede usar pipeline o lote.

## Eventos

4. **Entrega al menos una vez.** Todo evento de negocio pasa por Redis Streams con consumer group.
   Los handlers deben ser **idempotentes** (usar `event.id` como clave de deduplicación cuando aplique).
5. **Redis Streams es la fuente de verdad de eventos.** Los sistemas externos (Amazon EventBridge y
   futuros) se integran como `@EventHandler`, nunca publicando en paralelo al stream, para heredar
   reintentos y DLQ.
6. **Pub/Sub es best-effort.** Sólo para notificaciones en vivo (SSE). Nunca para lógica de negocio.
7. **Fallar visible.** Errores de handler no se tragan: se reintentan y, tras `EVENTS_MAX_DELIVERIES`,
   van a la DLQ consultable.

## Datos y privacidad

8. **La ubicación nunca es permanente.** PostgreSQL no guarda coordenadas, origen ni destino: sólo
   magnitudes derivadas (`distancia_km`). La ubicación/ruta vive en Redis con TTL.
9. **PostgreSQL para datos permanentes.** Consultas siempre parametrizadas (`$1, $2…`), nunca SQL
   concatenado. Todo cambio de esquema se hace en `db/` y se refleja en un spec: `schema.sql` es la
   base y cada cambio posterior es una migración `db/NNN_descripcion.sql` **idempotente**, numerada
   en orden y montada en `docker-compose.yml` entre `schema.sql` y `seed.sql`. El seed se mantiene
   compatible con la última migración.
10. **Comunidad cerrada.** Sólo correos `@anahuac.mx`; las reglas de negocio críticas (dominio,
    preferencia `solo_F`) se refuerzan con `CHECK` en la BD además de en la app.
11. **Datos demo ficticios.** Seeds y ejemplos usan datos inventados (`demoN@anahuac.mx`); nunca
    datos de personas reales.

## Configuración e infraestructura

12. **Configuración por entorno.** Sin valores hardcodeados; todo en `src/config/configuration.ts`
    y documentado en `.env.example`.
13. **Local sin nube.** Toda integración externa (AWS) está deshabilitada por defecto; `docker compose up`
    debe bastar para desarrollar.
14. **Seguridad en AWS.** Credenciales sólo por la cadena por defecto del SDK (rol IAM, perfil);
    nunca en código, `.env` versionado ni logs. Permisos IAM de mínimo privilegio, acotados al recurso.
15. **Infraestructura como código.** Los recursos de AWS se definen en `infra/` y se despliegan desde
    ahí; nada creado a mano en consola sin reflejarlo en una plantilla.
16. **Apagado limpio.** Toda conexión, pool, loop o cola pendiente se cierra/vacía en `OnApplicationShutdown`.

## Convenciones

17. **Idioma.** Specs, comentarios, logs y mensajes de error en español; identificadores de código
    en inglés, salvo los del dominio que ya existen en el esquema (`conductor`, `pasajero`, `viaje`…).

## Enmiendas

- Cambiar esta constitución requiere un PR propio que explique el motivo y suba la versión
  (mayor si se elimina o contradice un principio, menor si se añade o aclara).
- Si un spec necesita violar un principio, lo declara en su sección "Excepciones a la constitución"
  con justificación; sin eso, el PR no se aprueba. Los principios se citan por número, así que no se
  renumeran: uno eliminado deja su número vacío.

## Historial

| Versión | Fecha | Cambio |
|---|---|---|
| 2.1 | 2026-10-24 | Reserva de números en `specs/README.md` (1); migraciones `db/NNN_*.sql` idempotentes (9); no renumerar principios. |
| 2.0 | 2026-10-24 | Se añaden 2, 5, 8–11, 13–15 y 17; secciones temáticas. |
| 1.0 | 2026-10-24 | 7 principios iniciales (spec 001). |

Pendiente: enmienda del principio 8 para la retención de rutas de viajes publicados (solicitada por la spec 006).
