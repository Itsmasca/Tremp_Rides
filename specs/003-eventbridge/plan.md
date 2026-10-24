# 003 · Plan técnico

## Stack
`@aws-sdk/client-eventbridge` v3 · CloudFormation.

## Decisiones

| Decisión | Motivo |
|---|---|
| Puente (handler `*`) en vez de reemplazar Redis Streams | EventBridge es push, sin consumer groups: los handlers in-process, el SSE y la DLQ siguen necesitando el stream. Reutilizamos reintentos/DLQ sin código nuevo. |
| Micro-batching (≤10 entradas, ≤256 KB, ≤`EVENTBRIDGE_FLUSH_MS`) | El consumer procesa lotes en paralelo; agrupar reduce llamadas HTTP hasta 10x (principio 2). |
| Resultado por entrada (`Entries[i]`) | `PutEvents` es parcialmente exitoso: sólo reintentamos los eventos que fallaron. |
| `Detail` con `id` del stream | Clave de idempotencia para consumidores en AWS (principio 3). |
| Archive en el bus | Permite replay ante fallos de targets en AWS. |
| Deshabilitado por defecto | El entorno local funciona sin cuenta AWS. |

## Estructura

```
src/eventbridge/
  eventbridge.module.ts      # cliente EventBridge (sólo si está habilitado)
  eventbridge.publisher.ts   # micro-batcher PutEvents, flush en shutdown
  eventbridge.handler.ts     # @EventHandler('*') -> publisher (filtra EVENTBRIDGE_TYPES)
infra/
  eventbridge.yaml           # bus + archive + managed policy
```

## Configuración (`src/config/configuration.ts`)

| Variable | Por defecto |
|---|---|
| `EVENTBRIDGE_ENABLED` | `false` |
| `EVENTBRIDGE_BUS` | `trempapp` |
| `EVENTBRIDGE_SOURCE` | `trempapp.backend` |
| `EVENTBRIDGE_TYPES` | *(vacío = todos)* |
| `EVENTBRIDGE_FLUSH_MS` | `50` |
| `EVENTBRIDGE_ENDPOINT` | *(vacío)* |
| `AWS_REGION` | `us-east-1` |

## Ejemplo de evento en EventBridge

```json
{
  "source": "trempapp.backend",
  "detail-type": "trip.created",
  "time": "2026-10-24T18:00:00.000Z",
  "detail": { "id": "1761328800000-0", "type": "trip.created", "payload": { "tripId": "…" } }
}
```
