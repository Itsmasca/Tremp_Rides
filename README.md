# Trempapp backend

NestJS + Fastify + PostgreSQL (datos permanentes) + Redis (caché, Streams para eventos, Pub/Sub para SSE) + Amazon EventBridge (opcional). Desarrollado con
**Spec-Driven Development**: lee `specs/constitution.md` y `specs/` antes de cambiar nada.

## Arranque

```bash
cp .env.example .env
docker compose up -d redis postgres   # aplica db/schema.sql + db/seed.sql la 1ª vez
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
| GET | `/health` | Estado y latencia de Redis y PostgreSQL |

## Base de datos

El esquema vive en `db/`. Para reiniciar la BD desde cero: `docker compose down -v && docker compose up -d postgres`.
Consola: `docker compose exec postgres psql -U trempapp`. `db/operaciones_comunidad.sql` son ejemplos para ejecutar a mano.

```ts
constructor(private readonly db: DatabaseService) {}

const users = await this.db.query<{ nombre: string }>('SELECT nombre FROM users WHERE tipo_usuario = $1', ['conductor']);
await this.db.transaction(async (client) => { /* client.query(...) */ });
```

## Amazon EventBridge

Con `EVENTBRIDGE_ENABLED=true` cada evento del stream se reenvía al bus `EVENTBRIDGE_BUS`
(`source = EVENTBRIDGE_SOURCE`, `detail-type = event.type`, `detail = { id, type, payload, ... }`).
Si el envío falla, el evento se reintenta y acaba en la DLQ como cualquier handler. Consumidores en AWS:
deduplicar por `detail.id`. Ver `specs/003-eventbridge/`.

```bash
aws cloudformation deploy --template-file infra/eventbridge.yaml --stack-name trempapp-eventbridge   --capabilities CAPABILITY_NAMED_IAM
# adjunta PublisherPolicyArn (output) al rol del backend
```

Credenciales: cadena por defecto del SDK (rol IAM en ECS/EC2, `AWS_PROFILE` en local).

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
