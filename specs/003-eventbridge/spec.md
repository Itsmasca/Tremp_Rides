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

---

## Enmienda 1 · Publicar desde una VM en otra cuenta AWS

**Estado:** Propuesto · **Fecha:** 2026-10-24

**Contexto:** el bus vive en la cuenta **A** (`009160070658`, `us-east-1`). El backend corre en Docker
dentro de una VM EC2 de **otra cuenta B**. La revisión encontró:
- Sin timeouts en el SDK, un EventBridge inalcanzable **congela todo el consumer**: verificado, un segundo
  evento esperó >60 s en Windows (≈21 s × 3 intentos); en Linux serían ≈6 min por evento.
- Con IMDSv2 y hop limit 1 (valor por defecto) un contenedor Docker no obtiene credenciales del perfil de instancia.
- La managed policy de AC4.1 vive en la cuenta A y no sirve para un rol de la cuenta B.

### US5 · Resiliencia de red
- **AC5.1** El cliente usa `EVENTBRIDGE_CONNECT_TIMEOUT_MS` (def. 3000), `EVENTBRIDGE_REQUEST_TIMEOUT_MS`
  (def. 5000) y `EVENTBRIDGE_MAX_ATTEMPTS` (def. 3). Con EventBridge inalcanzable, un evento falla en
  **≤ 15 s** y el consumer sigue procesando (el evento va a reintento/DLQ, AC2.1).
- **AC5.2** Al arrancar con `EVENTBRIDGE_ENABLED=true` se resuelven las credenciales; si fallan se registra
  un `ERROR` que indica las causas probables (perfil de instancia ausente, hop limit IMDS < 2) sin tumbar el proceso.

### US6 · Publicación cross-account
- **AC6.1** `EVENTBRIDGE_BUS` acepta el **ARN** del bus (obligatorio cross-account). Si es ARN y su región
  no coincide con `AWS_REGION`, el arranque falla con un error de configuración.
- **AC6.2** `infra/eventbridge.yaml` (cuenta A) reemplaza la managed policy por una **política de recurso
  del bus** que permite `events:PutEvents` sólo al `PublisherRoleArn` (parámetro) y sólo con
  `events:source = EVENTBRIDGE_SOURCE`. Sirve igual para un rol de la misma cuenta.
- **AC6.3** Nueva plantilla `infra/eventbridge-publisher.yaml` (cuenta B): rol `trempapp-backend` +
  instance profile, con `events:PutEvents` sólo sobre el ARN del bus y la misma condición de `source`;
  `AmazonSSMManagedInstanceCore` opcional (parámetro) para Session Manager.
- **AC6.4** README con el runbook: orden de despliegue (B → A, porque la política del bus valida que el
  rol exista), lanzar la VM con el instance profile, `HttpTokens=required` y
  `HttpPutResponseHopLimit=2`, `.env` de la VM (`EVENTBRIDGE_ENABLED=true`, `EVENTBRIDGE_BUS=<ARN>`,
  `AWS_REGION=us-east-1`, sin claves) y salida HTTPS a `events.us-east-1.amazonaws.com`
  (subred pública/NAT, o VPC endpoint `com.amazonaws.us-east-1.events` si la VM está en `us-east-1`).

### Excepciones
Ninguna. Principios 7 (fallar visible), 14 (mínimo privilegio, sin claves) y 15 (todo en `infra/`).

### Fuera de alcance de la enmienda
Crear la VM, la VPC o el VPC endpoint (los gestiona la cuenta B); AssumeRole entre cuentas (no hace falta
con política de recurso).
