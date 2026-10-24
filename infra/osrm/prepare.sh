#!/usr/bin/env sh
# Prepara el grafo de OSRM de la península de Yucatán (spec 006). Se corre una vez desde la raíz:
#   sh infra/osrm/prepare.sh
# Deja yucatan.osrm* en infra/osrm/, que el servicio `osrm` de docker-compose monta en /data.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
BBOX="${PENINSULA_BBOX:--90.5,19.5,-87.4,21.7}"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v6.0.0"
OSMIUM_IMAGE="iboates/osmium:1.18.0"

cd "$DIR"

if [ ! -f mexico-latest.osm.pbf ]; then
  echo "Descargando México de Geofabrik (~700 MB)…"
  curl -fL -o mexico-latest.osm.pbf https://download.geofabrik.de/north-america/mexico-latest.osm.pbf
fi

echo "Recortando a la península ($BBOX)…"
docker run --rm -v "$DIR:/data" "$OSMIUM_IMAGE" \
  extract --bbox "$BBOX" --overwrite -o /data/yucatan.osm.pbf /data/mexico-latest.osm.pbf

echo "extract / partition / customize (MLD)…"
docker run --rm -v "$DIR:/data" "$OSRM_IMAGE" osrm-extract -p /opt/car.lua /data/yucatan.osm.pbf
docker run --rm -v "$DIR:/data" "$OSRM_IMAGE" osrm-partition /data/yucatan.osrm
docker run --rm -v "$DIR:/data" "$OSRM_IMAGE" osrm-customize /data/yucatan.osrm

echo "Listo. docker compose up -d osrm"
