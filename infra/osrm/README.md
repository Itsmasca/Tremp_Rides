# OSRM (grafo de Yucatán)

Lo usan `POST /rides` (spec 006) y matching-py (`POST /match`, spec 010). El grafo no se versiona.

```sh
sh infra/osrm/prepare.sh      # una vez; necesita Docker y ~2 GB libres
docker compose up -d osrm
curl "http://localhost:5000/route/v1/driving/-89.6237,20.9671;-89.5847,21.0186?overview=false"
```

En Windows se corre desde Git Bash. Para otra zona: `PENINSULA_BBOX=minLng,minLat,maxLng,maxLat sh infra/osrm/prepare.sh`.

`--max-table-size 100` en docker-compose debe coincidir con `OSRM_MAX_TABLE_SIZE` de matching-py.
