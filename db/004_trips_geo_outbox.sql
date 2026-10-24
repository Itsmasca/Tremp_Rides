-- =============================================================================
-- Migración 004: geometría de viajes (PostGIS) y outbox transaccional
-- Propietario: crud-ts · Spec: specs/006-publicar-viaje
--
-- Excepción al principio 8 (ver spec 006): origen/destino/ruta se guardan como
-- geometría y el job de purga los pone en NULL tras ROUTE_RETENTION_HOURS.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS origen           geometry(Point, 4326),        -- NULL tras la purga (US6)
  ADD COLUMN IF NOT EXISTS destino          geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS ruta             geometry(LineString, 4326),
  ADD COLUMN IF NOT EXISTS distancia_m      REAL,
  ADD COLUMN IF NOT EXISTS duracion_s       REAL,
  ADD COLUMN IF NOT EXISTS salida_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asientos_totales SMALLINT,
  ADD COLUMN IF NOT EXISTS max_desvio_s     INTEGER NOT NULL DEFAULT 600 CHECK (max_desvio_s BETWEEN 0 AND 1800),
  ADD COLUMN IF NOT EXISTS actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill de filas existentes (seed): salida = fecha, asientos = capacidad disponible.
UPDATE trips
   SET salida_en        = COALESCE(salida_en, fecha),
       asientos_totales = COALESCE(asientos_totales, GREATEST(capacidad_disponible, 1)),
       distancia_m      = COALESCE(distancia_m, distancia_km * 1000);

ALTER TABLE trips
  ALTER COLUMN salida_en SET NOT NULL,
  ALTER COLUMN asientos_totales SET NOT NULL;

ALTER TABLE trips DROP CONSTRAINT IF EXISTS chk_asientos;
ALTER TABLE trips
  ADD CONSTRAINT chk_asientos CHECK (asientos_totales BETWEEN 1 AND 8
                                     AND capacidad_disponible <= asientos_totales);

CREATE INDEX IF NOT EXISTS idx_trips_ruta_gist        ON trips USING GIST (ruta);  -- matching-py: ST_DWithin
CREATE INDEX IF NOT EXISTS idx_trips_estado_salida    ON trips (estado, salida_en);
CREATE INDEX IF NOT EXISTS idx_trips_conductor_salida ON trips (conductor_id, salida_en DESC, id DESC);  -- traslape y /mine

CREATE TABLE IF NOT EXISTS outbox (
  id             BIGSERIAL PRIMARY KEY,
  event_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,
  version        SMALLINT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  payload        JSONB NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pendientes ON outbox (id) WHERE published_at IS NULL;
