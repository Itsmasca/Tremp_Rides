-- =============================================================================
-- Migración 002: columnas de preferencias extendidas en users
-- Propietario: crud-ts
--
-- Agrega:
--   raw_text             — texto libre del usuario (lo leerá matching-py para Bedrock)
--   preferences_revision — contador monótono para idempotencia en matching-py
--
-- matching-py escribe sus propias columnas en user_preferences (tabla separada,
-- migración 001 de matching-py). Este script solo toca crud-ts.
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS raw_text             TEXT,
  ADD COLUMN IF NOT EXISTS preferences_revision INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.raw_text IS
  'Texto libre de preferencias de viaje. Solo lectura para matching-py.';

COMMENT ON COLUMN users.preferences_revision IS
  'Incrementa con cada PATCH /preferences. matching-py lo usa para garantizar idempotencia.';
