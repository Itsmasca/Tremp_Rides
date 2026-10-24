# Trempapp backend

NestJS + Fastify + PostgreSQL (datos permanentes) + Redis (caché, Streams para eventos, Pub/Sub para SSE) + Amazon EventBridge (opcional). Desarrollado con
**Spec-Driven Development**: lee `specs/constitution.md` y el índice `specs/README.md` antes de cambiar nada.

## Arranque

```bash
cp .env.example .env
docker compose up -d redis postgres   # aplica db/schema.sql + db/seed.sql la 1ª vez
npm run start:dev          # o: npm run build && npm start
# todo en Docker:  docker compose up --build
```

App móvil contra el backend de la VM (Cloudflare): `./scripts/mobile-vm.sh https://<tunel>` (ver `mobile/README.md`).

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/events` | Publica `{ type, payload, correlationId? }` → `202 { id }` |
| GET | `/events?count=50` | Últimos eventos |
| GET | `/events/dlq?count=50` | Dead letters |
| GET | `/events/stream?types=a,b` | SSE en tiempo real |
| PUT/GET/DELETE | `/cache/:key` | Caché JSON con `ttl` opcional (segundos) |
| POST | `/users` | Registro `{ nombre, correo, password, sexo, prefSexoViaje?, vehiculo? }` → `201` |
| GET | `/users?tipo=&verificado=&limit=&after=` | Lista paginada → `{ items, nextCursor }` |
| GET/PATCH/DELETE | `/users/:id` | Consulta, cambia `nombre`/`fotoUrl`, baja en cascada |
| PUT/DELETE | `/users/:id/vehicle` | Vehículo del catálogo `{ categoria, capacidad, marca?, modelo? }` → conductor / pasajero |
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
aws cloudformation deploy --template-file infra/eventbridge.yaml --stack-name trempapp-eventbridge --capabilities CAPABILITY_NAMED_IAM

# adjunta la política publicadora (output PublisherPolicyArn) al rol de la VM
aws iam attach-role-policy --role-name <rol-de-la-vm> \
  --policy-arn $(aws cloudformation describe-stacks --stack-name trempapp-eventbridge \
    --query "Stacks[0].Outputs[?OutputKey=='PublisherPolicyArn'].OutputValue" --output text)
```

Credenciales: cadena por defecto del SDK (rol IAM en ECS/EC2, `AWS_PROFILE` en local). En la VM no hay keys:
el rol de la instancia da credenciales temporales, y la política solo permite `events:PutEvents` sobre el bus
con `source = EVENTBRIDGE_SOURCE`.

### Probar EventBridge

```bash
aws events put-events --entries '[{"EventBusName":"trempapp","Source":"trempapp.backend","DetailType":"test.ping","Detail":"{\"hola\":\"mundo\"}"}]'
```

Debe responder `"FailedEntryCount": 0`. El bus no muestra el contenido por sí solo; para verlo en vivo, una regla de
depuración envía los eventos a CloudWatch Logs (borrar al terminar):

```bash
aws logs create-log-group --log-group-name /aws/events/trempapp-debug
aws logs put-retention-policy --log-group-name /aws/events/trempapp-debug --retention-in-days 1
aws logs put-resource-policy --policy-name EventBridgeToCWLogs-trempapp --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["events.amazonaws.com","delivery.logs.amazonaws.com"]},"Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:<region>:<cuenta>:log-group:/aws/events/*:*"}]}'
aws events put-rule --name trempapp-debug --event-bus-name trempapp --event-pattern '{"source":["trempapp.backend"]}'
aws events put-targets --rule trempapp-debug --event-bus-name trempapp --targets "Id=logs,Arn=arn:aws:logs:<region>:<cuenta>:log-group:/aws/events/trempapp-debug"
aws logs filter-log-events --log-group-name /aws/events/trempapp-debug --query 'events[].message' --output text
```

## Despliegue en AWS (EC2 + ECR)

El backend se despliega como contenedor en una VM EC2 (Ubuntu 24.04, `t3.small`, disco cifrado, región `us-east-1`).
La app móvil (`mobile/`) no va en la VM: solo necesita la URL pública del backend.

- **Red:** el security group solo abre el 22 (SSH) desde la IP del dueño; `ufw` solo permite el 22. La API se
  publica en `127.0.0.1:3001`; delante, un Nginx (`tremp-proxy`) en `127.0.0.1:3000` registra cada petición, y el
  túnel de Cloudflare expone ese puerto (conexión de salida, sin puertos abiertos).
- **Bases administradas** (misma VPC que la VM, sin acceso público; sus security groups solo aceptan a la VM):
  - Postgres 18 en RDS `trempapp-db` (`db.t4g.micro`, 20 GB gp3 cifrado, respaldo automático de 1 día por el plan
    gratuito). `.env`: `DB_HOST=<endpoint de RDS>`, `PGSSLMODE=no-verify` (RDS exige SSL; `pg` lo lee solo).
  - Valkey en ElastiCache `trempapp-cache` (`cache.t4g.micro`, TLS + auth token). `.env`: `REDIS_HOST=<endpoint>`,
    `REDIS_PASSWORD=<auth token>`, `REDIS_TLS=true`.
  - Los contenedores `postgres` y `redis` de la VM quedaron detenidos (volúmenes `pg-data` y `redis-data`
    conservados) como plan B: para volver a ellos, `docker start postgres redis` y regresar los hosts del `.env`.
- **Respaldos de Postgres:** `tremp-backup.timer` (diario, 09:00 UTC) hace `pg_dump` de RDS a `/var/backups/trempapp`
  (últimos 7) y a `s3://trempapp-backups-196582131532/postgres/` (privado, cifrado, se borran a los 14 días).
  Restaurar: `gunzip -c <archivo> | tremp-psql`.
- **Consultar la base:** en la VM, `tremp-psql` (abre psql con los datos del `.env`). Desde la Mac con un cliente
  gráfico: `ssh -i ~/.ssh/aws-hack.pem -N -L 5433:<endpoint de RDS>:5432 ubuntu@<IP de la VM>` y conectar a
  `localhost:5433` (usuario `trempapp`, base `trempapp`, SSL requerido).
- **Rol de la VM:** lectura de ECR, `events:PutEvents` (política del stack de EventBridge), escribir en sus log groups
  y métricas `Trempapp`, y subir respaldos a S3. El hop limit del token IMDS es 2 para que el contenedor reciba las
  credenciales del rol.
- **Imagen:** la construye GitHub Actions y la sube a ECR `tremp-api` (ver abajo).
- **`.env`:** se crea en la VM a partir de `.env.example` (`chmod 600`, ya está en `.gitignore`); nunca se sube.

```bash
# En la VM
git clone https://github.com/Itsmasca/Tremp_Rides.git && cd Tremp_Rides
cp .env.example .env && chmod 600 .env        # editar DB_*, REDIS_*, EVENTBRIDGE_ENABLED=true

# primera imagen a mano; después la construye y sube GitHub Actions (ver abajo)
docker build -t <cuenta>.dkr.ecr.<region>.amazonaws.com/tremp-api:latest .
aws ecr get-login-password | docker login --username AWS --password-stdin <cuenta>.dkr.ecr.<region>.amazonaws.com
docker push <cuenta>.dkr.ecr.<region>.amazonaws.com/tremp-api:latest

docker network create tremp
docker run -d --name postgres --network tremp --restart unless-stopped \
  -e POSTGRES_USER=trempapp -e POSTGRES_PASSWORD=<clave> -e POSTGRES_DB=trempapp -v pg-data:/var/lib/postgresql/data \
  -v "$PWD/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" \
  -v "$PWD/db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro" postgres:17-alpine
docker run -d --name redis --network tremp --restart unless-stopped -v redis-data:/data \
  redis:7-alpine redis-server --requirepass <clave> --appendonly yes

# migraciones posteriores al esquema base (aplicar en orden)
docker exec -i postgres psql -v ON_ERROR_STOP=1 -U trempapp -d trempapp < db/002_add_preferences_columns.sql
docker exec -i postgres psql -v ON_ERROR_STOP=1 -U trempapp -d trempapp < db/003_vehiculo_catalogo.sql

docker run -d --name tremp-api --network tremp --restart unless-stopped --env-file .env \
  -p 127.0.0.1:3000:3000 <cuenta>.dkr.ecr.<region>.amazonaws.com/tremp-api:latest
```

### URL pública (Cloudflare Tunnel)

`cloudflared` corre en la VM como servicio `systemd` (`cloudflared-quick`) y expone `127.0.0.1:3000` en una URL
`https://<algo>.trycloudflare.com`. Sin dominio es un *quick tunnel*: la URL cambia si se reinicia el servicio o la VM,
y no soporta Server-Sent Events (`/events/stream`). Para una URL fija y SSE hace falta un dominio en Cloudflare
(túnel con nombre).

```bash
# URL actual
sudo journalctl -u cloudflared-quick --no-pager | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

### Despliegue automático (GitHub Actions)

`.github/workflows/deploy-api.yml`: cada push a `main` que toque el backend construye la imagen, la sube a ECR con
tag `<sha>` y `latest`, y ordena a la VM por SSM ejecutar `/usr/local/bin/tremp-deploy <sha>` (descarga la imagen,
recrea el contenedor `tremp-api` con el mismo `.env` y comprueba que la API responda; si no responde, vuelve a
levantar la imagen anterior). También se puede lanzar a mano desde la pestaña *Actions* (`workflow_dispatch`).

- GitHub entra a AWS por OIDC, sin keys: el rol `tremp-github-deploy` solo lo puede asumir este repo en `main`, y
  solo puede subir a `tremp-api` y mandar comandos a la VM.
- La VM tiene el agente SSM y la política `AmazonSSMManagedInstanceCore`; no se abren puertos para desplegar.
- Las migraciones de `db/` no se aplican solas: van a mano con `docker exec -i postgres psql ...` como arriba.

```bash
# Desplegar a mano desde la VM (mismo script que usa Actions)
sudo /usr/local/bin/tremp-deploy latest
```

### Demo en vivo

`scripts/demo-simulacion.sh` simula un viaje completo con las cuentas demo `demo4@anahuac.mx` (conductora) y
`demo5@anahuac.mx` (pasajera): solicitud, aceptación con pago retenido, acercamiento al punto de recogida, 5 min de
tolerancia con cuenta regresiva, recorrido y cobro (70% de la gasolina + comisión de $10). Con `--no-llega` se agota
la tolerancia y se cancela cobrando el 70% de la gasolina ya manejada. La ubicación sólo va a Redis con TTL; los
eventos llevan km y minutos. Se ve en vivo en el dashboard `trempapp-demo` de CloudWatch (refresco de 10 s).

```bash
DEMO_PASSWORD=... ./scripts/demo-simulacion.sh https://<tunel>.trycloudflare.com [--rapido] [--no-llega]
```

Datos demo en la base (cuentas `demo4`–`demo9`, idempotentes; correr en la VM):

- `scripts/demo-datos.sql`: viajes de la última semana en todos los estados, pasajeros y pagos (`pagado`, `retenido`,
  `cancelado`, `fallido`) para llenar las gráficas: `tremp-psql -f scripts/demo-datos.sql`.
- `scripts/demo-viajes-ruta.py`: 42 viajes `pendiente` con ruta real de OSRM, cada 30 min de 6:00 a 22:00 hoy y
  mañana, desde y hacia la Anáhuac Mayab, para que aparezcan en "Buscar viaje" de la app. Vencen al pasar su hora:
  `python3 scripts/demo-viajes-ruta.py && tremp-psql -f /tmp/viajes-ruta.sql`.

### Logs y alertas (CloudWatch)

`tremp-deploy` levanta la API con el driver `awslogs` (y `NO_COLOR=1`): los logs van al log group `/trempapp/api`
(7 días, un stream por contenedor) y `docker logs` sigue funcionando en la VM. El rol de la VM solo puede escribir en
ese log group y publicar métricas en el namespace `Trempapp`.

- Peticiones: `tremp-proxy` (Nginx, config en `/etc/tremp/nginx.conf` de la VM) escribe una línea JSON por petición
  (`method`, `path` sin query string, `status`, `rt` en segundos, `bytes`; sin IP ni bodies) en `/trempapp/requests`
  (7 días). Metric filters: `Requests` (sin `/health`), `Requests4xx`, `Requests5xx`, `RequestLatency`.
- `tremp-health.timer` (systemd, cada minuto) publica `Trempapp/ApiUp` = 1 si `/health` responde, 0 si no.
- Un metric filter cuenta las líneas `ERROR` del log group como `Trempapp/ApiErrors`.
- Alarmas: `trempapp-api-caida` (ApiUp < 1 durante 3 min o sin datos), `trempapp-api-5xx` (≥ 5 respuestas 5xx en
  5 min), `trempapp-api-errores` (≥ 5 errores en 5 min) y `trempapp-vm-status` (status check de EC2). Avisan por
  correo (al activarse y al volver a OK) por el tema SNS `trempapp-alertas`.
- Dashboard `trempapp` en CloudWatch: alarmas, peticiones por minuto, errores 4xx/5xx, tiempo de respuesta p50/p95,
  rutas más usadas, últimas peticiones, salud, CPU de la VM, eventos del bus y logs de la API.
- Decisión: el monitoreo es solo CloudWatch, sin OpenTelemetry.

```bash
aws logs tail /trempapp/api --follow
aws logs tail /trempapp/requests --follow
```

Pendiente: autenticación en los endpoints (hoy todos responden sin login) y el servicio `matching-py`.

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
