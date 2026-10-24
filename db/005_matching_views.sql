-- =============================================================================
-- Migración 005: vistas para matching-py
-- Propietario: crud-ts · Spec: specs/010-busqueda-matching · Requiere: 004
--
-- matching-py lee rides/matches/user_preferences con nombres en inglés
-- (su data-model.md). Estas vistas son la única capa de traducción; crud-ts
-- sigue usando trips/trip_passengers/users.
-- =============================================================================

CREATE OR REPLACE VIEW rides AS
SELECT t.id,
       t.conductor_id              AS driver_id,
       t.origen                    AS origin,
       t.destino                   AS destination,
       t.ruta                      AS route,
       round(t.duracion_s)::int    AS duration_s,
       round(t.distancia_m)::int   AS distance_m,
       t.salida_en                 AS departure_at,
       t.capacidad_disponible::int AS seats_available,
       t.max_desvio_s              AS max_detour_s,
       CASE t.estado WHEN 'pendiente'  THEN 'scheduled'
                     WHEN 'en_curso'   THEN 'in_progress'
                     WHEN 'finalizado' THEN 'completed'
                     WHEN 'cancelado'  THEN 'cancelled' END AS status
  FROM trips t;

CREATE OR REPLACE VIEW matches AS
SELECT tp.id,
       tp.trip_id     AS ride_id,
       tp.pasajero_id AS passenger_id,
       CASE tp.estado WHEN 'solicitado' THEN 'pending'
                      WHEN 'aceptado'   THEN 'accepted'
                      WHEN 'rechazado'  THEN 'rejected'
                      WHEN 'completado' THEN 'completed' END AS status,
       tp.creado_en   AS created_at
  FROM trip_passengers tp;

-- Preferencias estructuradas que extrae matching-py con Bedrock.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pref_estructuradas          JSONB,
  ADD COLUMN IF NOT EXISTS pref_estructuradas_revision INTEGER,
  ADD COLUMN IF NOT EXISTS pref_estructuradas_en       TIMESTAMPTZ;

-- Vista simple (una tabla, sin agregados): Postgres la hace actualizable sin triggers,
-- así el UPDATE user_preferences SET structured = ... de matching-py escribe en users.
CREATE OR REPLACE VIEW user_preferences AS
SELECT id                          AS user_id,
       raw_text,
       preferences_revision        AS revision,
       pref_estructuradas          AS structured,
       pref_estructuradas_revision AS structured_revision,
       pref_estructuradas_en       AS structured_at
  FROM users;

COMMENT ON VIEW rides            IS 'Contrato de lectura para matching-py (spec 010). No usar desde crud-ts.';
COMMENT ON VIEW matches          IS 'Contrato de lectura para matching-py (spec 010). No usar desde crud-ts.';
COMMENT ON VIEW user_preferences IS 'Contrato para matching-py (spec 010): lee raw_text, escribe structured*. No usar desde crud-ts.';
