# 003 · Puente de eventos a Amazon EventBridge

**Estado:** Implementado · **Fecha:** 2026-10-24

## Objetivo

Publicar los eventos de negocio del bus interno (Redis Streams, spec 001) en un bus de
**Amazon EventBridge**, para que otros servicios de AWS (Lambda, Step Functions, SQS, Bedrock…)
reaccionen a ellos sin acoplarse al backend.

Redis Streams sigue siendo la fuente de verdad interna; EventBridge es un destino más.

## Historias de usuario

### US1 · Reenvío a EventBridge
Como equipo quiero que cada evento publicado en `POST /events` / `EventsService.publish` llegue a
EventBridge para conectar reglas y targets de AWS.

- **AC1.1** Con `EVENTBRIDGE_ENABLED=true`, todo evento del stream se envía al bus `EVENTBRIDGE_BUS`
  con `Source = EVENTBRIDGE_SOURCE`, `DetailType = event.type`, `Time = event.occurredAt` y
  `Detail = { id, type, payload, occurredAt, correlationId? }`.
- **AC1.2** Con `EVENTBRIDGE_ENABLED=false` (por defecto) no se crea cliente AWS ni se envía nada.
- **AC1.3** `EVENTBRIDGE_TYPES` opcional (lista separada por comas, admite prefijo `trip.*`) limita
  qué tipos se reenvían; vacío = todos.

### US2 · Entrega fiable
- **AC2.1** El reenvío es un `@EventHandler`: si `PutEvents` falla para un evento (error de red o
  entrada en `FailedEntries`), el handler lanza, el evento no se confirma y se reintenta; tras
  `EVENTS_MAX_DELIVERIES` va a la DLQ (spec 001, AC3.x).
- **AC2.2** Entrega al menos una vez: los consumidores en AWS deduplican por `detail.id`.
- **AC2.3** Un evento cuyo tamaño supere el límite de EventBridge (256 KB) falla de forma visible
  (log + DLQ), sin bloquear al resto del lote.

### US3 · Rendimiento
- **AC3.1** Los eventos se agrupan en llamadas `PutEvents` de hasta 10 entradas / 256 KB,
  esperando como mucho `EVENTBRIDGE_FLUSH_MS` (por defecto 50 ms) para llenar un lote.
- **AC3.2** Al apagar, los envíos pendientes se vacían antes de cerrar el cliente.

### US4 · Infraestructura y entorno local
- **AC4.1** `infra/eventbridge.yaml` (CloudFormation) crea el bus, un archive para replay y una
  managed policy con `events:PutEvents` restringida a ese bus.
- **AC4.2** Credenciales por la cadena por defecto del SDK (rol IAM en ECS/EC2, perfil o env en local);
  nunca en código. `EVENTBRIDGE_ENDPOINT` opcional para emuladores (LocalStack).

## Fuera de alcance
Consumir eventos *desde* EventBridge hacia el backend, esquemas en Schema Registry, reglas/targets
de negocio concretos, reemplazar Redis Streams.
