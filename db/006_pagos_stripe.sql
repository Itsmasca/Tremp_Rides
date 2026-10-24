-- =============================================================================
-- Migración 006: pagos con Stripe (retención, cobro y comisión)
-- Propietario: crud-ts · Spec: specs/011-pagos-stripe
--
-- Guarda sólo ids de Stripe y el cálculo congelado del cobro (issue #4, punto 7).
-- Nunca datos de tarjeta.
-- =============================================================================

ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'retenido';
ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'cancelado';
ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'reembolsado';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,   -- Customer del pasajero (tarjetas guardadas)
  ADD COLUMN IF NOT EXISTS stripe_account_id  TEXT;   -- Cuenta Connect Express del conductor

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_stripe_customer ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_stripe_account  ON users (stripe_account_id)  WHERE stripe_account_id IS NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS km               NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS rendimiento_km_l NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS precio_litro     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS gasolina         NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS comision         NUMERIC(8,2),   -- se queda la plataforma
  ADD COLUMN IF NOT EXISTS monto_conductor  NUMERIC(8,2),   -- se transfiere al conductor
  ADD COLUMN IF NOT EXISTS capturado        NUMERIC(8,2),   -- lo que realmente se cobró
  ADD COLUMN IF NOT EXISTS moneda           TEXT NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_trip_passenger ON payments (trip_passenger_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_referencia     ON payments (referencia_externa) WHERE referencia_externa IS NOT NULL;
