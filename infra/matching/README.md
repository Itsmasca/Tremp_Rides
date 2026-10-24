# matching-py en la VM (spec 010)

matching-py (repo [`Itsmasca/Tremp_smart`](https://github.com/Itsmasca/Tremp_smart)) corre en la misma VM que
`tremp-api`, en la red Docker `tremp`, con el **mismo RDS y el mismo Valkey**. En ECS (otra cuenta) no podía:
el RDS y el Valkey sólo aceptan a la VM, y el ECS usaba su propio Redis, así que no veía `rides.events`.

```
app ──https──▶ cloudflared ─▶ tremp-proxy ─▶ tremp-api ──POST /match──▶ matching-py ──▶ osrm
                                               │  XADD rides.events          │  XREADGROUP + Bedrock
                                               └──────────▶ Valkey ◀─────────┘
                                               └──────────▶  RDS   ◀─────────┘  (vistas rides/matches/user_preferences)
```

Nada se publica fuera de la VM: `matching-py` y `osrm` no exponen puertos (`POST /match` no tiene auth).

## Primera vez

1. **Bedrock.** Hoy (2026-10-24) matching-py usa el usuario IAM `tremp-matching-bedrock` de la cuenta 009160070658
   (`iam-user-bedrock-009.json`: sólo Haiku 5.5 + Titan v2 y sólo desde la IP de la VM). Sus llaves están en
   `/etc/tremp/matching.env`. Si cambia la IP de la VM, hay que actualizar la condición `aws:SourceIp`.
   - El rol de la VM (`aws-hack-vm`, cuenta 196582131532) ya tiene `iam-vm-matching.json` (Haiku 4.5 + Titan + logs),
     pero esa cuenta no ha enviado el formulario de caso de uso de Anthropic en Bedrock
     (`ResourceNotFoundException: Model use case details have not been submitted`). Para pasarse al rol:
     enviar el formulario, quitar `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` de `matching.env`, poner
     `BEDROCK_LLM_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0` y borrar el usuario IAM de la 009.
   - Logs en CloudWatch: crear `/trempapp/matching` y desplegar con `MATCHING_LOG_GROUP=/trempapp/matching`.

2. **Migraciones en RDS** (en la VM, desde el clon de Tremp_Rides actualizado):
   ```bash
   tremp-psql -c "SELECT name FROM pg_available_extensions WHERE name IN ('postgis','vector')"  # deben salir las dos
   tremp-psql -v ON_ERROR_STOP=1 < db/004_trips_geo_outbox.sql
   tremp-psql -v ON_ERROR_STOP=1 < db/005_matching_views.sql
   curl -fsSL https://raw.githubusercontent.com/Itsmasca/Tremp_smart/main/migrations/001_user_preference_embeddings.sql \
     | tremp-psql -v ON_ERROR_STOP=1
   ```

3. **Grafo de OSRM.** Prepararlo fuera de la VM (`sh infra/osrm/prepare.sh`, necesita ~2 GB de RAM) y copiarlo:
   ```bash
   ssh ubuntu@<vm> 'sudo mkdir -p /opt/tremp/osrm && sudo chown ubuntu /opt/tremp/osrm'
   scp infra/osrm/yucatan.osrm* ubuntu@<vm>:/opt/tremp/osrm/     # ~170 MB
   ```

4. **Scripts y configuración:**
   ```bash
   sudo install -m 755 infra/matching/tremp-matching-deploy infra/matching/tremp-osrm-up /usr/local/bin/
   sudo install -m 600 infra/matching/matching.env.example /etc/tremp/matching.env   # y editar claves/endpoints
   sudo tremp-osrm-up
   sudo tremp-matching-deploy
   ```

5. **Conectar tremp-api.** En el `.env` de tremp-api:
   ```
   MATCHING_URL=http://matching-py:8000
   OSRM_URL=http://osrm:5000
   ```
   y `sudo tremp-deploy latest`.

6. **Apagar el ECS de la otra cuenta** (desired count 0) para que no siga reiniciándose.

## Actualizar

```bash
sudo tremp-matching-deploy            # último main de Tremp_smart
sudo tremp-matching-deploy <sha>      # versión concreta
```

Construye en la VM, recrea el contenedor y prueba `/health`; si falla, vuelve a la imagen anterior.

## Comprobar

```bash
docker logs --tail 20 matching-py                       # "proveedor LLM activo", consumer y uvicorn arriba
aws logs tail /trempapp/matching --follow
redis-cli --tls -h <valkey> -a <token> XINFO GROUPS rides.events   # grupo matching-preferences
curl -s -X POST https://<url del túnel>/rides/search -H "authorization: Bearer <token>" \
  -H 'content-type: application/json' \
  -d '{"pickup":{"lat":21.0186,"lng":-89.5847},"dropoff":{"lat":20.9671,"lng":-89.6237},"departureAt":"<ISO con zona>"}'
```

Memoria (t3.small, 2 GB): `matching-py` limitado a 512 MB y `osrm` a 768 MB; revisar `free -m` tras desplegar.
