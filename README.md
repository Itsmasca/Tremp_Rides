# Trempapp backend

NestJS + Fastify + Redis (caché, Streams para eventos, Pub/Sub para SSE). Desarrollado con
**Spec-Driven Development**: lee `specs/constitution.md` y `specs/001-redis-events/` antes de cambiar nada.

## Arranque

```bash
cp .env.example .env
docker compose up -d redis
npm run start:dev          # o: npm run build && npm start
# todo en Docker:  docker compose up --build
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/events` | Publica `{ type, payload, correlationId? }` → `202 { id }` |
| GET | `/events?count=50` | Últimos eventos |
| GET | `/events/dlq?count=50` | Dead letters |
| GET | `/events/stream?types=a,b` | SSE en tiempo real |
| PUT/GET/DELETE | `/cache/:key` | Caché JSON con `ttl` opcional (segundos) |
| GET | `/health` | Estado y latencia de Redis |

## Añadir un handler

```ts
@Injectable()
export class OrdersHandler {
  @EventHandler('order.created', 'order.paid')
  async handle(event: EventEnvelope<{ orderId: number }>) {
    // idempotente: puede re-ejecutarse con el mismo event.id
  }
}
```

Regístralo como provider en cualquier módulo; el registry lo descubre solo.
Publicar desde código: `eventsService.publish('order.created', { orderId: 1 })`.
