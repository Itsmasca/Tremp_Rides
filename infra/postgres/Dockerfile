# Postgres local con PostGIS (spec 006) y pgvector (migración 001 de matching-py, spec 010).
# No hay imagen oficial con ambas. Se parte de la de pgvector (debian bookworm, repo PGDG activo)
# y se añade PostGIS; la de postgis/postgis:17-3.5 es bullseye y su repo PGDG ya no existe.
FROM pgvector/pgvector:0.8.1-pg17

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-postgis-3 postgresql-17-postgis-3-scripts \
 && rm -rf /var/lib/apt/lists/*
